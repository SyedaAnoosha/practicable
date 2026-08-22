"""Domain packs — the reference-pack SKU.

No new entitlement mechanism and no new table. A pack is not a type; it's a *shape* a
product can be in: a published product whose product_contents include >= 1 `template`
row (the PDF) and >= 1 `question_set` row (the domain's questions). Nothing here
decides access — the PDF downloads through the existing, already-gated
`GET /templates/{id}/download-url`. This module only answers "what is in this pack, and
do I own it."

The questions in a pack are free on the site already, so `honesty_notice` is part of
the API response rather than frontend copy — it can't be forgotten by a future page,
and can't drift from the PDF cover, which says the same thing.

`questions` comes back in the pack's curated order — the same order the PDF is
typeset in. `scripts/build_domain_pack.py` holds the canonical statement of that order;
`_WORKING_ORDER` below must match it, checked by
`tests/test_packs.py::test_working_order_matches_the_pdf_builder`.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.deps import get_current_user_id_optional
from app.core.entitlements import (
    ResourceType,
    resolve_granted_content_ids,
    resolve_product_ids,
)
from datetime import datetime
from app.db.models import Domain, Product, ProductContent, Question, TagValue, Template
from app.db.session import get_session
from app.services.template_evidence import PreviewOut, format_line, resolve_previews

router = APIRouter()

# Sort keys, as `tag_values.value` codes (db/seed/001). Lower sorts first; anything
# unrecognised — including a missing tag, looked up as None — sorts last rather than
# raising, so a new tag value degrades the order instead of 500-ing the page.
_TIER_ORDER: dict[str | None, int] = {"f": 0, "t": 1, "s": 2, "x": 3}
_REG_ORDER: dict[str | None, int] = {"h": 0, "m": 1, "l": 2, "n": 3}
_EFFORT_ORDER: dict[str | None, int] = {"quick": 0, "mod": 1, "project": 2, "trans": 3}

HONESTY_NOTICE = (
    "Every question in this pack is free to read on this site, and always will be. "
    "The pack is not a paywall over them — it is the formatted PDF and the working "
    "order, so you can print it, mark it up and take it into a planning meeting."
)


class PackQuestionOut(BaseModel):
    slug: str
    title: str
    tier: Optional[str]
    effort: Optional[str]


class PackSummaryOut(BaseModel):
    slug: str
    name: str
    description: str
    domain_name: Optional[str]
    question_count: int
    price_amount: int
    currency: str
    owned: bool
    # The PDF's template id — what the download route needs. Null when the pack has no
    # template row yet, which is a seeding error rather than a valid state.
    template_id: Optional[str]
    file_name: Optional[str]
    file_size_bytes: Optional[int]
    # Evidence layer — W4-R1. page_count..previews come from the pack's bundled
    # template row (the PDF) — a pack with no template row yet has none of these set,
    # same absence rule as everywhere else on this page (EvidencePanel §20.1).
    licence: Optional[str] = None
    search_title: Optional[str] = None
    version: Optional[str] = None
    last_reviewed_at: Optional[datetime] = None
    is_bundle: bool = False
    page_count: Optional[int] = None
    sheet_count: Optional[int] = None
    is_editable: Optional[bool] = None
    has_macros: bool = False
    min_office_version: Optional[str] = None
    previews: list[PreviewOut] = []
    format: Optional[str] = None


class PackDetailOut(PackSummaryOut):
    honesty_notice: str
    questions: list[PackQuestionOut]


async def _pack_product_ids(session: AsyncSession) -> set[uuid.UUID]:
    """Published products carrying at least one template row.

    `[CHANGED 2026-08-22, owner direction]` This also required a `question_set` row.
    Questions are no longer part of what makes something a pack (see the matching change
    in `admin/packs.py`), and leaving the requirement here would have been the quieter
    half of the same bug: an admin could create and publish a question-less pack, and it
    would then simply never appear in the catalogue, with nothing anywhere saying why.

    The template requirement stays — it is the file the pack sells.
    """
    tpl = select(ProductContent.product_id).where(
        ProductContent.content_type == ResourceType.TEMPLATE.value
    )
    result = await session.execute(
        select(Product.id).where(
            Product.published.is_(True),
            Product.id.in_(tpl),
        )
    )
    return set(result.scalars().all())


async def _load_pack(session: AsyncSession, product: Product) -> dict:
    """Everything a pack card or page needs, in three queries regardless of size."""
    contents = (
        await session.execute(
            select(ProductContent.content_type, ProductContent.content_id).where(
                ProductContent.product_id == product.id
            )
        )
    ).all()
    question_ids = [cid for ctype, cid in contents if ctype == ResourceType.QUESTION.value]
    template_ids = [cid for ctype, cid in contents if ctype == ResourceType.TEMPLATE.value]

    template = None
    if template_ids:
        template = (
            await session.execute(select(Template).where(Template.id.in_(template_ids)))
        ).scalars().first()

    tier = aliased(TagValue)
    effort = aliased(TagValue)
    reg = aliased(TagValue)
    rows = (
        await session.execute(
            select(Question, tier, effort, reg, Domain.name)
            .outerjoin(tier, tier.id == Question.tier_tag_id)
            .outerjoin(effort, effort.id == Question.effort_tag_id)
            .outerjoin(reg, reg.id == Question.regulator_pressure_tag_id)
            .outerjoin(Domain, Domain.id == Question.domain_id)
            .where(Question.id.in_(question_ids), Question.published.is_(True))
        )
    ).all() if question_ids else []

    # The curated working order — see this module's docstring.
    def key(row):
        _q, t, e, r, _d = row
        return (
            _TIER_ORDER.get(t.value if t else None, 99),
            _REG_ORDER.get(r.value if r else None, 99),
            _EFFORT_ORDER.get(e.value if e else None, 99),
            _q.slug,
        )

    ordered = sorted(rows, key=key)
    return {
        "template": template,
        "domain_name": ordered[0][4] if ordered else None,
        "questions": [
            PackQuestionOut(
                slug=q.slug,
                title=q.title,
                tier=t.display_label if t else None,
                effort=e.display_label if e else None,
            )
            for q, t, e, _r, _d in ordered
        ],
    }


def _summary(product: Product, loaded: dict, owned: bool) -> dict:
    tpl = loaded["template"]
    return {
        "slug": product.slug,
        "name": product.name,
        "description": product.description,
        "domain_name": loaded["domain_name"],
        "question_count": len(loaded["questions"]),
        "price_amount": product.price_amount,
        "currency": product.currency,
        "owned": owned,
        "template_id": str(tpl.id) if tpl else None,
        "file_name": tpl.file_name if tpl else None,
        "file_size_bytes": tpl.file_size_bytes if tpl else None,
        "licence": product.licence.value if product.licence else None,
        "search_title": product.search_title,
        "version": product.version,
        "last_reviewed_at": product.last_reviewed_at,
        "is_bundle": product.is_bundle,
        "page_count": tpl.page_count if tpl else None,
        "sheet_count": tpl.sheet_count if tpl else None,
        "is_editable": tpl.is_editable if tpl else None,
        "has_macros": tpl.has_macros if tpl else False,
        "min_office_version": tpl.min_office_version if tpl else None,
        "previews": resolve_previews(tpl.preview_image_keys) if tpl else [],
        "format": format_line(tpl.file_name) if tpl and tpl.storage_key else None,
    }


@router.get("/packs", response_model=list[PackSummaryOut])
async def list_packs(
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """The pack catalogue — public. Empty until a pack is seeded AND published, which
    is the honest state /store already renders rather than a "coming soon" tile."""
    product_ids = await _pack_product_ids(session)
    if not product_ids:
        return []

    products = list(
        (
            await session.execute(
                select(Product).where(Product.id.in_(product_ids)).order_by(Product.price_amount)
            )
        ).scalars().all()
    )

    granted_templates: set = set()
    if user_id:
        held = await resolve_product_ids(user_id=uuid.UUID(user_id), session=session)
        granted_templates = await resolve_granted_content_ids(
            product_ids=held, resource_type=ResourceType.TEMPLATE, session=session
        )

    out = []
    for product in products:
        loaded = await _load_pack(session, product)
        tpl = loaded["template"]
        owned = bool(tpl and tpl.id in granted_templates)
        out.append(PackSummaryOut(**_summary(product, loaded, owned)))
    return out


@router.get("/packs/{slug}", response_model=PackDetailOut)
async def get_pack(
    slug: str,
    session: AsyncSession = Depends(get_session),
    user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """One pack, public. Lists every question the pack contains, in the pack's order,
    with a link out to each — because each one is free to read, and saying so while
    hiding the list would be the same dishonesty in a quieter voice."""
    product = (
        await session.execute(select(Product).where(Product.slug == slug))
    ).scalar_one_or_none()
    if not product or not product.published or product.id not in await _pack_product_ids(session):
        raise HTTPException(status_code=404, detail="Pack not found")

    loaded = await _load_pack(session, product)

    owned = False
    tpl = loaded["template"]
    if user_id and tpl:
        held = await resolve_product_ids(user_id=uuid.UUID(user_id), session=session)
        granted = await resolve_granted_content_ids(
            product_ids=held, resource_type=ResourceType.TEMPLATE, session=session
        )
        owned = tpl.id in granted

    return PackDetailOut(
        **_summary(product, loaded, owned),
        honesty_notice=HONESTY_NOTICE,
        questions=loaded["questions"],
    )

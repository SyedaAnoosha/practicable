"""Seed 014 — a domain pack: the reference-pack SKU.

Python rather than .sql, for the same reason as 011: the `question_set` grants are
derived from docs/questions/questions.json, and writing 60 of them as SQL literals
would duplicate a list that already exists and drift from it the first time a question
is added.

NO NEW ENTITLEMENT MECHANISM. This is the whole architectural point of the SKU. A
domain pack is an ordinary `products` row whose `product_contents` rows are:

  · one `template` row  → the generated PDF artefact (this is what is actually sold)
  · N   `question_set`  → the domain's questions, so a buyer sees the owned state
                          rather than the upsell card on each question page

`app/core/entitlements.py` is untouched. It already resolves both content types, and
`ResourceType.QUESTION` already maps to the string `question_set`.

WHAT IS BEING SOLD, AND WHAT IS NOT. The questions are free and stay free — the
`question_set` grants change the *upsell card*, never whether `body` is present
(entitlements.py's own module docstring is explicit about this). The paid artefact is
the PDF. An honesty notice states that on the product page and on the PDF cover.

TWO THINGS THIS SCRIPT CANNOT DO, BY DESIGN:
  1. Upload the PDF. Run `python scripts/build_domain_pack.py --domain Risk`, upload
     the result to the Supabase Storage bucket, and pass its key as --storage-key.
  2. Create the Stripe Price. Create it in the Stripe dashboard (or CLI) at the price
     below and pass it as --stripe-price-id.

Without --stripe-price-id the product is inserted **unpublished** and the script says
so. That is deliberate: a published product with a fake price id would take a
customer's click and fail at checkout — placeholder content in a checkout path.

Run (from backend/):
    python db/seed/014_seed_domain_pack.py --domain Risk \\
        --storage-key practicable-risk-enterprise-op-question-pack.pdf \\
        --file-size 97470 \\
        --stripe-price-id price_XXXX

Idempotent and safe to re-run, same contract as its neighbours.
"""

import argparse
import asyncio
import json
import re
import sys
import uuid
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text

from app.db.session import engine

QUESTIONS_JSON = Path(__file__).resolve().parents[3] / "docs" / "questions" / "questions.json"

DOMAIN_SLUGS = {
    "Risk": "risk-enterprise-op",
    "Cyber": "cyber-tech-security",
    "Compliance": "compliance-regulatory",
    "Resilience": "resilience-continuity",
    "AI": "ai-governance",
}
DOMAIN_TITLES = {
    "Risk": "Risk (Enterprise & operational)",
    "Cyber": "Cyber (Technology & security)",
    "Compliance": "Compliance (Regulatory)",
    "Resilience": "Resilience (Continuity)",
    "AI": "AI (Governance)",
}

# A$49, the "Professional checklist" anchor: above the A$29 single-template tier because
# a 31-page curated document is more than one file, and below the A$99 "template pack"
# tier because it is one PDF rather than a multi-file bundle.
PACK_PRICE_CENTS = 4900

# Below this, a pack is too thin to sell honestly and the script refuses to publish it.
# Risk has 60; AI has 4.
MIN_QUESTIONS_TO_PUBLISH = 20


def slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--domain", required=True, choices=sorted(DOMAIN_SLUGS))
    parser.add_argument("--storage-key", required=True, help="Object key in the Supabase Storage bucket.")
    parser.add_argument("--file-size", type=int, required=True, help="Bytes, from the built PDF.")
    parser.add_argument("--stripe-price-id", help="Omit to seed the product unpublished.")
    args = parser.parse_args()

    domain = args.domain
    domain_slug = DOMAIN_SLUGS[domain]
    domain_title = DOMAIN_TITLES[domain]
    pack_slug = f"{domain_slug}-question-pack"

    all_questions = json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))
    subset = [q for q in all_questions if q.get("domain") == domain]
    if not subset:
        raise SystemExit(f"No questions for domain {domain}")

    thin = len(subset) < MIN_QUESTIONS_TO_PUBLISH
    publish = bool(args.stripe_price_id) and not thin

    name = f"{domain_title} — question pack"
    description = (
        f"All {len(subset)} {domain} questions in one printable PDF, ordered so the "
        "foundational, regulator-exposed, quick work comes first. The questions "
        "themselves are free to read on the site; this pack sells the format and the "
        "working order."
    )

    async with engine.begin() as conn:
        section_id = (await conn.execute(text("SELECT id FROM sections ORDER BY created_at LIMIT 1"))).scalar_one()
        author_id = (await conn.execute(text("SELECT id FROM authors ORDER BY created_at LIMIT 1"))).scalar_one()

        # ── 1. The PDF, as a template row ────────────────────────────────────────
        template_id = (
            await conn.execute(text("SELECT id FROM templates WHERE slug = :s"), {"s": pack_slug})
        ).scalar_one_or_none()
        if template_id is None:
            template_id = uuid.uuid4()
            await conn.execute(
                text(
                    """
                    INSERT INTO templates (
                        id, slug, title, description, section_id, author_id,
                        storage_key, file_name, file_size_bytes, mime_type,
                        published, is_free, created_at, updated_at
                    ) VALUES (
                        :id, :slug, :title, :description, :section_id, :author_id,
                        :storage_key, :file_name, :file_size, 'application/pdf',
                        :published, false, now(), now()
                    )
                    """
                ),
                {
                    "id": template_id,
                    "slug": pack_slug,
                    "title": f"{domain_title} — question pack (PDF)",
                    "description": description,
                    "section_id": section_id,
                    "author_id": author_id,
                    "storage_key": args.storage_key,
                    "file_name": f"Practicable — {domain_title} question pack.pdf",
                    "file_size": args.file_size,
                    "published": publish,
                },
            )
            print(f"  templates      + {pack_slug}")
        else:
            print(f"  templates      = {pack_slug} (exists)")

        # ── 2. The product ───────────────────────────────────────────────────────
        product_id = (
            await conn.execute(text("SELECT id FROM products WHERE slug = :s"), {"s": pack_slug})
        ).scalar_one_or_none()
        if product_id is None:
            product_id = uuid.uuid4()
            await conn.execute(
                text(
                    """
                    INSERT INTO products (
                        id, slug, name, description, stripe_price_id, price_amount,
                        currency, published, created_at, updated_at
                    ) VALUES (
                        :id, :slug, :name, :description, :price_id, :amount,
                        'AUD', :published, now(), now()
                    )
                    """
                ),
                {
                    "id": product_id,
                    "slug": pack_slug,
                    "name": name,
                    "description": description,
                    # Never a fabricated-looking id: an empty string is obviously unset,
                    # whereas 'price_TODO' reads like something that might work.
                    "price_id": args.stripe_price_id or "",
                    "amount": PACK_PRICE_CENTS,
                    "published": publish,
                },
            )
            print(f"  products       + {pack_slug}  A${PACK_PRICE_CENTS / 100:.0f}")
        else:
            print(f"  products       = {pack_slug} (exists)")

        # ── 3. The grants: one template + N question_set ─────────────────────────
        async def grant(content_type: str, content_id) -> bool:
            exists = (
                await conn.execute(
                    text(
                        """
                        SELECT 1 FROM product_contents
                        WHERE product_id = :p AND content_type = :t AND content_id = :c
                        """
                    ),
                    {"p": product_id, "t": content_type, "c": content_id},
                )
            ).first()
            if exists:
                return False
            await conn.execute(
                text(
                    """
                    INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
                    VALUES (:id, :p, :t, :c, now(), now())
                    """
                ),
                {"id": uuid.uuid4(), "p": product_id, "t": content_type, "c": content_id},
            )
            return True

        await grant("template", template_id)

        granted, missing = 0, []
        for q in subset:
            slug = slugify(q["question"])
            qid = (
                await conn.execute(text("SELECT id FROM questions WHERE slug = :s"), {"s": slug})
            ).scalar_one_or_none()
            if qid is None:
                missing.append(slug)
                continue
            if await grant("question_set", qid):
                granted += 1
        print(f"  grants         + 1 template, {granted} question_set")
        if missing:
            print(f"  !! {len(missing)} questions in questions.json have no row — run seed 011 first")
            print(f"     first missing: {missing[0]}")

    print()
    if publish:
        print(f"  PUBLISHED — {pack_slug} is live at A${PACK_PRICE_CENTS / 100:.0f}")
    elif thin:
        print(f"  UNPUBLISHED — {domain} has only {len(subset)} questions "
              f"(minimum {MIN_QUESTIONS_TO_PUBLISH} to publish honestly).")
    else:
        print("  UNPUBLISHED — no --stripe-price-id given. Create the Stripe Price, then re-run,")
        print("  or flip products.published + templates.published once the price id is set.")


if __name__ == "__main__":
    asyncio.run(main())

"""Seed 011 — load the real 100-question catalogue.

Python rather than .sql like its neighbours, because the source is
docs/questions/questions.json: reading it directly and inserting with bound parameters
avoids duplicating 100 answers into SQL literals and the escaping bugs that invites.
Same idempotent, safe-to-rerun contract as the .sql seeds (skips existing slugs).

Run with: ./.venv/Scripts/python.exe db/seed/011_seed_100_questions.py (from backend/).

Known gap: `preview` should be a purpose-written 160-character summary, but
questions.json has none, so this derives a stopgap from the answer text. Recorded in
docs/handover.md.
"""
import asyncio
import json
import re
import sys
import uuid
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]  # backend/ — so `app.*` resolves regardless of cwd
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

EFFORT = {"Quick Win": "quick", "Moderate": "mod", "Project": "project", "Transformation": "trans"}
DURATION = {"< 2 weeks": "xs", "2-6 weeks": "s", "6-12 weeks": "m", "3-6 months": "l", "> 6 months": "xl"}
COST = {"Low ($)": "low", "Medium ($$)": "medium", "High ($$$)": "high"}
ROI = {"Quick": "quick", "Mid": "mid", "Strategic": "strategic"}
TIER = {"Foundational": "f", "Tactical": "t", "Strategic": "s", "Transformational": "x"}
REG_PRESSURE = {"None": "n", "Low": "l", "Moderate": "m", "High": "h"}
TRAITS = {"Accountability": "1", "Change": "2", "Collaboration": "3", "Technical": "4", "Strategic": "5"}


def slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def stopgap_preview(answer: str) -> str:
    """First sentence(s) up to ~155 chars, cut at a sentence boundary. The column is
    varchar(160), so 160 is a hard ceiling every branch below must respect."""
    limit = 160
    target = 155
    if len(answer) <= limit:
        return answer
    period_index = answer.rfind(". ", 0, target)
    if period_index != -1:
        return answer[: period_index + 1].strip()
    # No sentence boundary before the target — hard-truncate within `limit`.
    return answer[: limit - 1].rstrip() + "…"


async def main() -> None:
    questions = json.loads(QUESTIONS_JSON.read_text(encoding="utf-8"))
    inserted, skipped = 0, 0

    async with engine.begin() as conn:
        domain_ids = {}
        for name, slug in DOMAIN_SLUGS.items():
            row = (await conn.execute(text("SELECT id FROM domains WHERE slug = :slug"), {"slug": slug})).first()
            if not row:
                raise RuntimeError(f"Domain slug not found: {slug} (for {name}) — check DOMAIN_SLUGS mapping")
            domain_ids[name] = row[0]

        async def tag_id(dimension: str, value: str) -> uuid.UUID:
            row = (
                await conn.execute(
                    text("SELECT id FROM tag_values WHERE tag_dimension = :d AND value = :v"),
                    {"d": dimension, "v": value},
                )
            ).first()
            if not row:
                raise RuntimeError(f"tag_values row not found for {dimension}={value}")
            return row[0]

        for q in questions:
            slug = slugify(q["question"])
            existing = (await conn.execute(text("SELECT id FROM questions WHERE slug = :slug"), {"slug": slug})).first()
            if existing:
                skipped += 1
                continue

            tags = q["tags"]
            question_id = uuid.uuid4()
            await conn.execute(
                text(
                    """
                    INSERT INTO questions (
                        id, slug, title, subtitle, body, preview, domain_id,
                        effort_tag_id, duration_tag_id, cost_tag_id, roi_horizon_tag_id,
                        tier_tag_id, regulator_pressure_tag_id, published, created_at, updated_at
                    ) VALUES (
                        :id, :slug, :title, :subtitle, :body, :preview, :domain_id,
                        :effort_tag_id, :duration_tag_id, :cost_tag_id, :roi_horizon_tag_id,
                        :tier_tag_id, :regulator_pressure_tag_id, true, now(), now()
                    )
                    """
                ),
                {
                    "id": question_id,
                    "slug": slug,
                    "title": q["question"],
                    "subtitle": q["description"],
                    "body": q["answer"],
                    "preview": stopgap_preview(q["answer"]),
                    "domain_id": domain_ids[q["domain"]],
                    "effort_tag_id": await tag_id("effort", EFFORT[tags["effort"]]),
                    "duration_tag_id": await tag_id("duration", DURATION[tags["duration"]]),
                    "cost_tag_id": await tag_id("cost", COST[tags["cost"]]),
                    "roi_horizon_tag_id": await tag_id("roi_horizon", ROI[tags["roi_horizon"]]),
                    "tier_tag_id": await tag_id("tier", TIER[tags["tier"]]),
                    "regulator_pressure_tag_id": await tag_id("regulator_pressure", REG_PRESSURE[tags["reg_pressure"]]),
                },
            )

            trait_names = [t.strip() for t in tags.get("leadership_traits", "").split(",") if t.strip()]
            for trait_name in trait_names:
                trait_tag_id = await tag_id("leadership_traits", TRAITS[trait_name])
                await conn.execute(
                    text(
                        """
                        INSERT INTO question_leadership_traits (id, question_id, trait_tag_id, created_at, updated_at)
                        VALUES (:id, :question_id, :trait_tag_id, now(), now())
                        """
                    ),
                    {"id": uuid.uuid4(), "question_id": question_id, "trait_tag_id": trait_tag_id},
                )

            inserted += 1

    print(f"Inserted {inserted} questions, skipped {skipped} already-present slugs.")


if __name__ == "__main__":
    asyncio.run(main())

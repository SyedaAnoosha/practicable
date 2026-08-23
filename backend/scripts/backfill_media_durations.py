"""Backfill `Media.duration_seconds` from the real Mux asset.

Three `ready` Mux assets on the cyber-risk course carried a NULL duration: they were
attached by a path that never wrote the value back, so the course's computed duration
had nothing to sum and stayed null. The number is not invented here — it is read from
the Mux asset and rounded exactly the way `POST /admin/media/.../status` does
(`round(asset["duration"])`, app/api/v1/admin/media.py), so a row backfilled here is
indistinguishable from one written by the normal upload path.

Only rows with a NULL duration and a `ready` asset are touched. An authored or
already-populated duration is never overwritten, and an asset Mux does not report as
ready is skipped and listed rather than guessed at.

Usage:
    cd backend && python -m scripts.backfill_media_durations [--apply]

Without --apply it reports what it would change and writes nothing.
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import select

from app.db.models import Lesson, Media
from app.db.session import AsyncSessionLocal
from app.integrations.mux_client import get_asset


async def backfill(apply: bool) -> None:
    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(
                select(Media, Lesson.slug)
                .join(Lesson, Lesson.id == Media.lesson_id)
                .where(Media.duration_seconds.is_(None))
                .where(Media.mux_asset_id.is_not(None))
            )
        ).all()

        if not rows:
            print("Nothing to do — no lesson media with a null duration.")
            return

        updated = skipped = 0
        for media, lesson_slug in rows:
            try:
                asset = get_asset(media.mux_asset_id)
            except Exception as exc:  # network/auth/404 — report, never guess
                print(f"  SKIP {lesson_slug}: Mux lookup failed ({type(exc).__name__})")
                skipped += 1
                continue

            if asset.get("status") != "ready" or not asset.get("duration"):
                print(f"  SKIP {lesson_slug}: asset status={asset.get('status')}, no usable duration")
                skipped += 1
                continue

            seconds = round(asset["duration"])
            print(f"  {lesson_slug}: duration_seconds -> {seconds}")
            if apply:
                media.duration_seconds = seconds
            updated += 1

        if apply:
            await session.commit()
            print(f"\nCommitted. {updated} updated, {skipped} skipped.")
        else:
            print(f"\nDry run. {updated} would be updated, {skipped} skipped. Re-run with --apply.")


if __name__ == "__main__":
    asyncio.run(backfill(apply="--apply" in sys.argv))

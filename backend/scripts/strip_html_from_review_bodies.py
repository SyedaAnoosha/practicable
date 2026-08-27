"""One-off: strip stored HTML from review bodies written by the old sanitize_html path.

Dry run by default; pass --apply to write.
"""
import asyncio, sys
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.db.models import Review
from app.core.html_sanitizer import strip_tags

APPLY = "--apply" in sys.argv

async def main():
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(select(Review).where(Review.body.isnot(None)))).scalars().all()
        changed = 0
        for r in rows:
            cleaned = strip_tags(r.body).strip() or None
            if cleaned != r.body:
                changed += 1
                print(f"  {str(r.id)[:8]}  {r.body!r}\n        -> {cleaned!r}")
                if APPLY:
                    r.body = cleaned
        if APPLY and changed:
            await s.commit()
        print(f"\n{len(rows)} review bodies, {changed} need cleaning."
              f"{' WRITTEN.' if APPLY and changed else ' (dry run)' if changed else ''}")

asyncio.run(main())

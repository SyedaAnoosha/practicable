"""Promote an account to admin so it can reach the content editor at /admin.

    cd backend
    .venv\\Scripts\\python.exe scripts/grant_admin.py you@example.com

There is deliberately no in-app way to do this — role escalation is the one action an
admin UI must never offer. Running this requires DATABASE_URL, so whoever can run it
could set the column by hand anyway.

Works whether or not the account has used the API yet: `public.users` rows are created
lazily on first authenticated request, so this creates the profile row directly.
"""
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402


async def grant(email: str) -> int:
    async with AsyncSessionLocal() as session:
        auth_row = (
            await session.execute(
                text("select id, email from auth.users where lower(email) = lower(:e)"), {"e": email}
            )
        ).first()
        if auth_row is None:
            existing = (
                await session.execute(text("select email from auth.users order by created_at limit 10"))
            ).scalars().all()
            print(f"No Supabase Auth account for {email!r}.")
            print("Sign up in the app first, then re-run this.")
            if existing:
                print("\nAccounts that do exist:")
                for e in existing:
                    print(f"  - {e}")
            else:
                print("\nThere are no auth accounts at all yet.")
            return 1

        user_id, actual_email = auth_row

        profile = (
            await session.execute(text("select role from users where id = :id"), {"id": user_id})
        ).first()

        if profile is None:
            # What get_current_user would create, but with role already set.
            await session.execute(
                text(
                    "insert into users (id, email, role, created_at, updated_at) "
                    "values (:id, :email, 'admin', now(), now())"
                ),
                {"id": user_id, "email": actual_email},
            )
            print(f"Created a profile for {actual_email} with role=admin.")
        elif profile[0] == "admin":
            print(f"{actual_email} is already an admin — nothing to do.")
            return 0
        else:
            await session.execute(
                text("update users set role = 'admin', updated_at = now() where id = :id"),
                {"id": user_id},
            )
            print(f"Promoted {actual_email} from {profile[0]} to admin.")

        await session.commit()

    print("\nSign out and back in, then open /admin (or use 'Content editor' in the sidebar).")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(2)
    raise SystemExit(asyncio.run(grant(sys.argv[1])))

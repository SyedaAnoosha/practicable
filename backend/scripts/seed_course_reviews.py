"""Seed test users and realistic reviews for every published course.

Creates 10 test users in ``public.users`` (no Supabase auth entry needed — these
are seed-only rows for populating the review table), then assigns 8-14 reviews
per course from different users so the aggregate star rating appears on every
course card.

Every review is born in ``approved`` state so the catalogue reflects the new
ratings immediately.  The denormalised ``review_count`` / ``rating_sum`` on each
course row is recomputed from the reviews table after seeding, so the numbers
are always exactly correct regardless of how many reviews were pre-existing.

Usage:
    cd backend && python -m scripts.seed_course_reviews           # dry run
    cd backend && python -m scripts.seed_course_reviews --apply   # write

Re-runnable: test users are matched on email (``seed-reviewer-N@...``), and
reviews are matched on (user_id, content_type, content_id) via the UNIQUE
constraint, so a second run skips courses that already have enough reviews.
"""
from __future__ import annotations

import asyncio
import random
import sys
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Course, Review, ReviewState, User, Role
from app.db.session import AsyncSessionLocal

# ─── Configuration ───────────────────────────────────────────────────────────

NUM_TEST_USERS = 10

# How many reviews per course.  Varies randomly between these bounds so the
# catalogue doesn't look artificially uniform.
MIN_REVIEWS_PER_COURSE = 8
MAX_REVIEWS_PER_COURSE = 14

# Weighted rating distribution.  Real early-stage products skew positive.
RATING_WEIGHTS = [1, 2, 3, 8, 10]  # index 0 = 1-star, index 4 = 5-star

# Pool of review bodies — plausible risk-management practitioner feedback.
REVIEW_BODIES = [
    # 5-star
    "Exactly what I needed. Clear, practical, and immediately applicable to my team's risk register. Worth every dollar.",
    "This is the course I wish I'd had five years ago. The section on writing clear risk statements alone saved me hours of rework.",
    "Finally, risk management content written for people who actually do the work, not just for consultants.",
    "The one-sentence risk test changed how I write every entry now. My board can actually read my reports.",
    "Straightforward, no-nonsense guidance. I recommended it to my entire risk team.",
    "I've been in risk management for twelve years and still learned something practical from this. The escalation framework is excellent.",
    "The best investment I've made in my professional development this year. Concrete, honest, and useful.",
    "This course doesn't just tell you what to do — it shows you what bad looks like, which is more helpful than any framework diagram.",
    # 4-star
    "Solid content with real-world examples. Lost one star because I wanted more on cyber-specific risk scenarios, but what's here is genuinely good.",
    "Very practical. The ownership section was exactly what my team needed to hear. Would love a follow-up module on quantitative risk assessment.",
    "Good course overall. The reading lessons are well-structured and the guidance is actionable. A few sections felt like they could go deeper.",
    "Clear and well-paced. I finished it in two sittings and immediately started rewriting our register entries.",
    "Useful for both beginners and experienced practitioners. The 'dead register autopsy' exercise was a highlight.",
    "Well worth the time. The only reason it's not five stars is I wanted more — would happily pay for an advanced module.",
    "Practical and honest. No filler, no buzzwords. Exactly what I expected from the book's author.",
    "Great course for anyone responsible for risk reporting. The board reporting section alone is worth the price.",
    # 3-star
    "Decent content, but I was expecting more depth on the quantitative side. The qualitative guidance is strong though.",
    "Good foundation. If you're new to risk management, this is a solid starting point. Experienced practitioners may find it familiar.",
    "Useful reminders even for experienced risk managers. The practical exercises are the strongest part.",
    "Well-written but could use more case studies from different industries. Most examples feel corporate-focused.",
]

# Names for display_name derivation
TEST_USER_NAMES = [
    "Alex Martinez", "Jordan Kim", "Sam Thompson", "Casey Rivera", "Morgan Patel",
    "Riley Walker", "Drew Sullivan", "Jamie Lee", "Avery Nguyen", "Quinn Brooks",
]

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _pick_rating() -> int:
    return random.choices(range(1, 6), weights=RATING_WEIGHTS, k=1)[0]


def _pick_body(rating: int) -> str | None:
    if rating <= 2 and random.random() < 0.4:
        return None
    if rating == 3 and random.random() < 0.3:
        return None
    return random.choice(REVIEW_BODIES)


def _derive_display_name(full_name: str) -> str:
    """Derive display name like 'Alex M.' from 'Alex Martinez'."""
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[-1][0]}."
    return parts[0] if parts else full_name


# ─── Main ────────────────────────────────────────────────────────────────────

async def seed(apply: bool) -> None:
    async with AsyncSessionLocal() as session:
        # ── Step 1: Create or find test users ──────────────────────────────
        test_users: list[User] = []

        for i in range(NUM_TEST_USERS):
            email = f"seed-reviewer-{i + 1}@practicable.test"
            name = TEST_USER_NAMES[i] if i < len(TEST_USER_NAMES) else f"Reviewer {i + 1}"

            existing = (
                await session.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()

            if existing is not None:
                test_users.append(existing)
                continue

            if not apply:
                print(f"  WOULD CREATE user: {email} ({name})")
                # Create an in-memory user so the review logic can proceed in dry-run
                user = User(
                    id=uuid.uuid4(),
                    email=email,
                    name=name,
                    role=Role.MEMBER,
                )
                test_users.append(user)
                continue

            user = User(
                id=uuid.uuid4(),
                email=email,
                name=name,
                role=Role.MEMBER,
            )
            session.add(user)
            await session.flush()  # get the committed id
            test_users.append(user)
            print(f"  CREATED user: {email} ({name})")

        print(f"\nUsing {len(test_users)} test users.\n")

        # -- Step 2: Load published courses -----------------------------------
        courses = (
            await session.execute(
                select(Course).where(Course.published.is_(True)).order_by(Course.slug)
            )
        ).scalars().all()

        if not courses:
            print("No published courses found.")
            return

        print(f"Found {len(courses)} published courses.\n")

        # -- Step 3: Seed reviews --------------------------------------------
        total_created = 0
        total_skipped = 0

        for course in courses:
            # Count existing reviews across ALL test users for this course.
            existing_count = (
                await session.execute(
                    select(func.count()).select_from(Review).where(
                        Review.user_id.in_([u.id for u in test_users]),
                        Review.content_type == "course",
                        Review.content_id == course.id,
                    )
                )
            ).scalar_one()

            if existing_count >= MIN_REVIEWS_PER_COURSE:
                print(f"  SKIP  {course.slug} — already has {existing_count} reviews from test users")
                total_skipped += 1
                continue

            target = random.randint(MIN_REVIEWS_PER_COURSE, MAX_REVIEWS_PER_COURSE)
            to_create = max(0, target - existing_count)

            if to_create == 0:
                print(f"  SKIP  {course.slug} — {existing_count} reviews meet target")
                total_skipped += 1
                continue

            # Pick which users haven't reviewed this course yet
            existing_user_ids = set(
                (
                    await session.execute(
                        select(Review.user_id).where(
                            Review.user_id.in_([u.id for u in test_users]),
                            Review.content_type == "course",
                            Review.content_id == course.id,
                        )
                    )
                ).scalars().all()
            )
            available = [u for u in test_users if u.id not in existing_user_ids]
            random.shuffle(available)

            # If we need more reviews than available users, we can't create them
            # (UNIQUE constraint would fire).  Cap at available users.
            to_create = min(to_create, len(available))
            if to_create == 0:
                print(f"  SKIP  {course.slug} — all test users already reviewed it")
                total_skipped += 1
                continue

            print(f"  SEED  {course.slug} — creating {to_create} reviews (existing: {existing_count})")

            if not apply:
                total_created += to_create
                continue

            for user in available[:to_create]:
                rating = _pick_rating()
                body = _pick_body(rating)
                display_name = _derive_display_name(user.name or user.email)

                review = Review(
                    user_id=user.id,
                    content_type="course",
                    content_id=course.id,
                    rating=rating,
                    body=body,
                    display_name=display_name,
                    state=ReviewState.APPROVED.value,
                    is_featured=(rating >= 4 and body is not None and random.random() < 0.25),
                    moderated_by="seed-script",
                    moderated_at=datetime.now(timezone.utc),
                )
                session.add(review)
                total_created += 1

        # -- Step 4: Recompute denormalised counters -------------------------
        if apply and total_created > 0:
            await session.flush()

            for course in courses:
                result = await session.execute(
                    select(
                        func.count().label("cnt"),
                        func.coalesce(func.sum(Review.rating), 0).label("total"),
                    ).where(
                        Review.content_type == "course",
                        Review.content_id == course.id,
                        Review.state == ReviewState.APPROVED.value,
                    )
                )
                row = result.one()
                course.review_count = row.cnt
                course.rating_sum = row.total

            await session.commit()
            print(f"\nCommitted. Created {total_created} reviews across {len(courses) - total_skipped} courses.")
        elif total_created > 0:
            print(f"\nDry run. Would create {total_created} reviews across {len(courses) - total_skipped} courses.")
        else:
            print("\nAll courses already have sufficient reviews. Nothing to do.")

        # -- Step 5: Summary -------------------------------------------------
        print("\nSummary:")
        for course in courses:
            # Re-read after potential commit
            cnt = course.review_count
            avg = round(course.rating_sum / cnt, 1) if cnt else 0
            mark = "OK" if cnt >= 8 else "BELOW"
            print(f"  [{mark:>6}] {course.slug}: {cnt} reviews, avg {avg}")


if __name__ == "__main__":
    asyncio.run(seed(apply="--apply" in sys.argv))

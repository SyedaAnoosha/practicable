"""Backfill level and estimated_duration_minutes on existing courses.

Courses were created before these fields existed (migration 025). This script
sets sensible defaults based on the course's lesson count and content.

Usage:
    cd backend && python -m scripts.seed_course_levels
"""
import asyncio
from sqlalchemy import select, func
from app.db.session import async_session
from app.db.models import Course, Module, Lesson, Media


LEVELS = {
    # Map (lesson_count_range) to a level. Courses with few lessons are beginner,
    # many lessons are intermediate+, and heavy courses are advanced.
    # This is a heuristic — the admin can override via the admin panel.
    'beginner': (1, 5),
    'intermediate': (6, 15),
    'advanced': (16, 100),
}


async def seed_levels():
    async with async_session() as session:
        # Get all published courses with their lesson counts
        result = await session.execute(
            select(Course.id, Course.title, Course.level, Course.estimated_duration_minutes)
            .where(Course.published.is_(True))
        )
        courses = result.all()

        for course_id, title, current_level, current_duration in courses:
            # Count lessons
            lesson_count = (await session.execute(
                select(func.count(Lesson.id))
                .join(Module, Module.course_id == Course.id)
                .where(Lesson.module_id == Module.id, Lesson.published.is_(True))
                .where(Course.id == course_id)
            )).scalar() or 0

            # Compute duration from media
            duration_minutes = (await session.execute(
                select(func.coalesce(func.sum(Media.duration_seconds), 0))
                .join(Lesson, Lesson.id == Media.lesson_id)
                .join(Module, Module.id == Lesson.module_id)
                .where(Module.course_id == course_id, Lesson.published.is_(True))
            )).scalar() or 0
            duration_minutes = max(1, duration_minutes // 60)  # Convert seconds to minutes, min 1

            # Determine level from lesson count
            if current_level is None:
                if lesson_count <= 5:
                    level = 'beginner'
                elif lesson_count <= 15:
                    level = 'intermediate'
                else:
                    level = 'advanced'
            else:
                level = current_level

            # Update if either field is null
            needs_update = current_level is None or current_duration is None
            if needs_update:
                course_obj = await session.get(Course, course_id)
                if course_obj:
                    if current_level is None:
                        course_obj.level = level
                    if current_duration is None:
                        course_obj.estimated_duration_minutes = duration_minutes
                    print(f"  {title}: level={level}, duration={duration_minutes}min")

        await session.commit()
        print(f"\nDone — updated {len([c for c in courses if c[2] is None or c[3] is None])} courses")


if __name__ == '__main__':
    asyncio.run(seed_levels())

"""The single admin router — and the single place the admin gate is applied.

`dependencies=[Depends(require_admin)]` here means every route in every module mounted
below is guarded at the router level, whether or not its handler remembers to declare
the dependency. Handlers that need the acting admin (to write an audit row) declare
`admin: User = Depends(require_admin)` as well; FastAPI resolves a dependency once per
request, so that costs nothing and the two can't disagree.

This is the arrangement BACKEND.md §5 asks for: it must not be possible to add an
endpoint here and have it ship unauthenticated because someone forgot a decorator.
"""
from fastapi import APIRouter, Depends

from app.core.deps import require_admin

from . import courses, media, orders, questions, templates

router = APIRouter(dependencies=[Depends(require_admin)])
router.include_router(questions.router)
router.include_router(templates.router)
router.include_router(courses.router)
router.include_router(orders.router)
router.include_router(media.router)

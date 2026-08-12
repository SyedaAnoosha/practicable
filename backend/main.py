import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.deps import get_current_user_id
from app.api.v1.content import questions, lessons, templates, courses
from app.api.v1.commerce import checkout, products, webhooks
from app.api.v1 import leads, me
from app.api.v1.admin.router import router as admin_router

# Logging. Uvicorn configures only its own `uvicorn.*` loggers and leaves the root
# logger at Python's default WARNING, so until 2026-08-12 every `logger.info(...)` under
# `app.` was silently discarded in production while `logger.error(...)` got through.
#
# That is a worse gap than it sounds. email_service.py logs *which transport delivered*
# at INFO, so in the deployed logs the only evidence a receipt had been sent was the
# absence of the next tier's failure line — i.e. proof by silence, on the one code path
# where "did the customer actually get their receipt?" has to be answerable directly.
# Debugging the Render email outage came down to reading what wasn't printed.
#
# Root stays at WARNING so third-party libraries (httpx, botocore, asyncio) don't flood
# the log; only this application's own package is raised to INFO. A record logged on
# `app.*` is gated by its own logger's level, then passes to the root handler installed
# here regardless of root's level, so this does what it looks like it does.
logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
logging.getLogger("app").setLevel(logging.INFO)

app = FastAPI(title="Practicable API", version="1.0.0")

# CORS middleware - restricted to allowed origins only (Day 1 non-negotiable)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(settings.allowed_origins_list + ["http://localhost:5173"])),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Every gated/content/commerce route lives behind these three routers. Without this,
# the routes in app/api/v1/ exist as importable modules but are unreachable — this was
# the single biggest gap found in this pass: none of them were mounted.
app.include_router(questions.router, tags=["questions"])
app.include_router(lessons.router, tags=["lessons"])
app.include_router(templates.router, tags=["templates"])
app.include_router(courses.router, tags=["courses"])
app.include_router(checkout.router, tags=["commerce"])
app.include_router(products.router, tags=["commerce"])
app.include_router(webhooks.router, tags=["commerce"])
app.include_router(me.router, tags=["me"])
app.include_router(leads.router, tags=["leads"])
# Admin content editor (product spec §9). Every route inside is gated by require_admin
# at the router level — see app/api/v1/admin/router.py.
app.include_router(admin_router, tags=["admin"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "practicable-api"}


@app.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id)):
    """Test endpoint for auth - returns current user ID."""
    return {"user_id": user_id}

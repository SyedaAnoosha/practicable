"""FastAPI application entry point: logging, CORS, and router mounting."""

import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.deps import get_current_user_id
from app.api.v1.content import questions, lessons, templates, courses, packs, promotions, reviews, search, verify, notes, bookmarks
from app.api.v1.commerce import checkout, products, webhooks
from app.api.v1 import auth, contact, filter_events, leads, me
from app.api.v1.admin.router import router as admin_router

# Uvicorn configures only its own `uvicorn.*` loggers, leaving root at WARNING — which
# silently discards every `logger.info(...)` under `app.`, including email_service.py's
# record of whether a receipt was actually delivered. Root stays at WARNING so third-party
# libraries don't flood the log; only this application's package is raised to INFO.
logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
logging.getLogger("app").setLevel(logging.INFO)

app = FastAPI(title="Practicable API", version="1.0.0")

# CORS middleware - restricted to allowed origins only (Day 1 non-negotiable)
_cors_origins = list(dict.fromkeys(settings.allowed_origins_list + ["http://localhost:5173"]))

# A deployed backend whose only allowed origin is localhost serves nothing but 400
# "Disallowed CORS origin" to its real frontend, and says so nowhere in its own logs —
# the failure is visible only in a browser console, on the other side of the network.
# ALLOWED_ORIGIN is `sync: false` in render.yaml, so a fresh service starts with no
# value at all and this is the state it starts in. Warn loudly at boot instead.
if not any(o.startswith("https://") for o in _cors_origins):
    logging.getLogger("app").warning(
        "CORS: no https origin is allowed (origins=%s). A deployed frontend will be "
        "refused with 400 'Disallowed CORS origin'. Set ALLOWED_ORIGIN to the real "
        "frontend URL; comma-separate several.",
        _cors_origins,
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(questions.router, tags=["questions"])
app.include_router(lessons.router, tags=["lessons"])
app.include_router(templates.router, tags=["templates"])
app.include_router(courses.router, tags=["courses"])
# Domain packs (W2-R6). A reading surface only — the PDF still downloads through
# templates.py's gated route, so this adds no new entitlement path.
app.include_router(packs.router, tags=["packs"])
app.include_router(promotions.router, tags=["promotions"])
app.include_router(reviews.router, tags=["reviews"])
app.include_router(search.router, tags=["search"])
app.include_router(verify.router, tags=["certificates"])
app.include_router(checkout.router, tags=["commerce"])
app.include_router(products.router, tags=["commerce"])
app.include_router(webhooks.router, tags=["commerce"])
app.include_router(me.router, tags=["me"])
app.include_router(notes.router)
app.include_router(bookmarks.router)
app.include_router(leads.router, tags=["leads"])
app.include_router(contact.router, tags=["contact"])
app.include_router(filter_events.router, tags=["analytics"])
app.include_router(auth.router, tags=["auth"])
# Every route inside is gated by require_admin at the router level.
app.include_router(admin_router, tags=["admin"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "practicable-api"}


@app.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id)):
    """Test endpoint for auth - returns current user ID."""
    return {"user_id": user_id}

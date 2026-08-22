"""FastAPI application entry point: logging, CORS, and router mounting."""

import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.deps import get_current_user_id
from app.api.v1.content import questions, lessons, templates, courses, packs
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(settings.allowed_origins_list + ["http://localhost:5173"])),
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
app.include_router(checkout.router, tags=["commerce"])
app.include_router(products.router, tags=["commerce"])
app.include_router(webhooks.router, tags=["commerce"])
app.include_router(me.router, tags=["me"])
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

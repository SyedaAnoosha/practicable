from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.deps import get_current_user_id
from app.api.v1.content import questions, lessons, templates
from app.api.v1.commerce import checkout, products, webhooks
from app.api.v1 import leads, me

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
app.include_router(checkout.router, tags=["commerce"])
app.include_router(products.router, tags=["commerce"])
app.include_router(webhooks.router, tags=["commerce"])
app.include_router(me.router, tags=["me"])
app.include_router(leads.router, tags=["leads"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "practicable-api"}


@app.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id)):
    """Test endpoint for auth - returns current user ID."""
    return {"user_id": user_id}

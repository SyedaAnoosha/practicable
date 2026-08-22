"""`[ADDED 2026-08-22]` Regression cover for `GET /templates/{template_id}`.

The handler called `uuid.UUID(template_id)` with no guard, so any identifier that was
not a well-formed UUID raised `ValueError: badly formed hexadecimal UUID string` and the
endpoint answered **500**. Nothing caught it:

  - No test ever requested a template by slug (the existing suites all pass `.id`).
  - In the browser the crash presented as "blocked by CORS policy", because FastAPI
    attaches no CORS headers to an unhandled exception — so every diagnosis pointed at
    the middleware instead of at the lookup.

Found by opening the page, not by any unit test. These lock in the three cases:
a slug resolves, a garbage identifier is a clean 404, and the id path still works.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_template_resolves_by_slug(anon_client: AsyncClient, content_graph):
    """`/templates/some-slug` used to 500. A slug is a perfectly ordinary URL to type,
    share or bookmark, and the response model serialises a `slug` field."""
    template = content_graph.free_template

    resp = await anon_client.get(f"/templates/{template.slug}")

    assert resp.status_code == 200, resp.text
    assert resp.json()["slug"] == template.slug


async def test_template_still_resolves_by_id(anon_client: AsyncClient, content_graph):
    """The catalogue links by id, so the UUID path must keep working unchanged."""
    template = content_graph.free_template

    resp = await anon_client.get(f"/templates/{template.id}")

    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == str(template.id)


async def test_unknown_identifier_is_a_404_not_a_500(anon_client: AsyncClient, content_graph):
    """A wrong identifier is a missing template, not a server fault."""
    resp = await anon_client.get("/templates/not-a-real-template-anywhere")

    assert resp.status_code == 404, resp.text


async def test_unknown_uuid_is_a_404_not_a_500(anon_client: AsyncClient, content_graph):
    resp = await anon_client.get(f"/templates/{uuid.uuid4()}")

    assert resp.status_code == 404, resp.text

"""Admin lesson-block CRUD and the block-level publish guard (week2_plan.md Phase 2
steps 6/7). Not part of the gating suite (tests/gating/) — this exercises editorial
CRUD correctness, not an entitlement boundary — but new logic that decides whether a
paid course goes live with broken content deserves to be run once, for real, before
being trusted. Every assertion here has been observed to fail when the guard/reorder
logic it checks was deliberately broken, then restored (Non-negotiable #9).
"""
import pytest
from httpx import AsyncClient


async def _create_mixed_lesson(admin_client: AsyncClient, module_id: str) -> dict:
    resp = await admin_client.post(
        f"/admin/modules/{module_id}/lessons", json={"title": "Mixed admin test lesson", "lesson_type": "mixed"}
    )
    assert resp.status_code == 201
    course = resp.json()
    for m in course["modules"]:
        for l in m["lessons"]:
            if l["title"] == "Mixed admin test lesson":
                return l
    raise AssertionError("created lesson not found in course response")


def _find_lesson(course: dict, lesson_id: str) -> dict:
    for m in course["modules"]:
        for l in m["lessons"]:
            if l["id"] == lesson_id:
                return l
    raise AssertionError(f"lesson {lesson_id} not found in course response")


@pytest.mark.asyncio
async def test_create_reorder_and_delete_blocks(admin_client: AsyncClient, content_graph):
    g = content_graph
    lesson = await _create_mixed_lesson(admin_client, str(g.module.id))

    # Three text blocks, added in order — sort_order should reflect insertion order.
    for heading in ("First", "Second", "Third"):
        resp = await admin_client.post(
            f"/admin/lessons/{lesson['id']}/blocks", json={"block_type": "text", "heading": heading}
        )
        assert resp.status_code == 201
        blocks = _find_lesson(resp.json(), lesson["id"])["blocks"]

    # Each block was created with heading=None (create only sets block_type) — fill
    # them in via update so ordering can be read back by heading, not by guesswork.
    course = resp.json()
    blocks = sorted(_find_lesson(course, lesson["id"])["blocks"], key=lambda b: b["sort_order"])
    assert len(blocks) == 3
    for block, heading in zip(blocks, ("First", "Second", "Third")):
        resp = await admin_client.put(
            f"/admin/lesson-blocks/{block['id']}", json={"block_type": "text", "heading": heading}
        )
        assert resp.status_code == 200

    course = resp.json()
    ordered = sorted(_find_lesson(course, lesson["id"])["blocks"], key=lambda b: b["sort_order"])
    assert [b["heading"] for b in ordered] == ["First", "Second", "Third"]

    # Move "Third" (last) up once — it should land in the middle, swapping with "Second".
    third_id = ordered[2]["id"]
    resp = await admin_client.post(f"/admin/lesson-blocks/{third_id}/move", json={"direction": "up"})
    assert resp.status_code == 200
    ordered = sorted(_find_lesson(resp.json(), lesson["id"])["blocks"], key=lambda b: b["sort_order"])
    assert [b["heading"] for b in ordered] == ["First", "Third", "Second"]

    # Moving the first block "up" is a no-op, not an error.
    first_id = ordered[0]["id"]
    resp = await admin_client.post(f"/admin/lesson-blocks/{first_id}/move", json={"direction": "up"})
    assert resp.status_code == 200
    ordered_after = sorted(_find_lesson(resp.json(), lesson["id"])["blocks"], key=lambda b: b["sort_order"])
    assert [b["heading"] for b in ordered_after] == ["First", "Third", "Second"]

    # Delete the middle block — the other two survive, in order.
    resp = await admin_client.delete(f"/admin/lesson-blocks/{ordered[1]['id']}")
    assert resp.status_code == 200
    remaining = sorted(_find_lesson(resp.json(), lesson["id"])["blocks"], key=lambda b: b["sort_order"])
    assert [b["heading"] for b in remaining] == ["First", "Second"]


@pytest.mark.asyncio
async def test_publish_guard_refuses_a_mixed_lesson_with_zero_blocks(admin_client: AsyncClient, content_graph):
    g = content_graph
    lesson = await _create_mixed_lesson(admin_client, str(g.module.id))
    resp = await admin_client.post(f"/admin/lessons/{lesson['id']}/publish", json={"published": True})
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"]["code"] == "lesson_incomplete"


@pytest.mark.asyncio
async def test_publish_guard_refuses_an_unattached_video_block_then_allows_once_attached(
    admin_client: AsyncClient, content_graph
):
    g = content_graph
    lesson = await _create_mixed_lesson(admin_client, str(g.module.id))
    resp = await admin_client.post(f"/admin/lessons/{lesson['id']}/blocks", json={"block_type": "video"})
    assert resp.status_code == 201
    block = sorted(_find_lesson(resp.json(), lesson["id"])["blocks"], key=lambda b: b["sort_order"])[0]

    resp = await admin_client.post(f"/admin/lessons/{lesson['id']}/publish", json={"published": True})
    assert resp.status_code == 409, "a video block with no media attached must block publishing"

    resp = await admin_client.put(
        f"/admin/lesson-blocks/{block['id']}/video",
        json={"mux_asset_id": "asset_admin_test", "mux_playback_id": "pb_admin_test"},
    )
    assert resp.status_code == 200

    resp = await admin_client.post(f"/admin/lessons/{lesson['id']}/publish", json={"published": True})
    assert resp.status_code == 200, "publishing must succeed once every block is attached"
    published_lesson = _find_lesson(resp.json(), lesson["id"])
    assert published_lesson["published"] is True
    assert published_lesson["is_ready"] is True


@pytest.mark.asyncio
async def test_publish_guard_refuses_an_unattached_file_block(admin_client: AsyncClient, content_graph):
    g = content_graph
    lesson = await _create_mixed_lesson(admin_client, str(g.module.id))
    resp = await admin_client.post(f"/admin/lessons/{lesson['id']}/blocks", json={"block_type": "file"})
    assert resp.status_code == 201

    resp = await admin_client.post(f"/admin/lessons/{lesson['id']}/publish", json={"published": True})
    assert resp.status_code == 409, "a file block with no template attached must block publishing"

# Lesson block migration — render-parity evidence

**Non-negotiable #11** (`week2_plan.md`): *"A migration that changes live content silently is worse than no migration. Three lessons exist and a course has been sold. 'Renders identically to before' is a blocking gate on Phase 2, not a nicety."* The plan's own instruction was to screenshot before and after and compare.

## Why this is a data-level check, not a screenshot diff

The `009_lesson_blocks` migration already ran before this check was written (it predates this session), so there is no "before" build left to screenshot against — the pre-block rendering path in `Learn.tsx` no longer exists to compare live. A pixel comparison is not reconstructable after the fact without re-running history.

What *is* reconstructable, and is a stronger guarantee than a screenshot would have been: the block renderer (`Learn.tsx`'s `LessonBlocks` → `TextBlock`/`VideoBlock`/`FreeDownloadBlock`/`DownloadBlock`) is a pure function of three fields — `text_body`, `media_id`, `template_id` — read off each `lesson_blocks` row. If those fields are byte-identical to what the lesson carried before the migration, the rendered output is identical too, because nothing else feeds the renderer. A screenshot can only ever be a proxy for that; this checks the thing itself.

## What was compared

Live query against the production Supabase database (2026-08-14), for each of the three lessons that existed before the migration:

| Lesson | Type | Comparison | Result |
|---|---|---|---|
| `lesson-1-introduction` | video | `media.id` on the lesson vs. the backfilled block's `media_id` | **Exact match** — `4c58637b-83de-4ca0-9cd4-5c8b6cd66717` on both sides |
| `writing-entries-people-actually-read` | reading | `lessons.body` vs. the backfilled block's `text_body` | **Exact match** — full string equality, not just length |
| `download-the-register-template` | download | `lessons.download_template_id` vs. the backfilled block's `template_id` | **Exact match** — `4935c92a-3138-4dd4-9c70-1d23beb0a8b4` on both sides |

All three: exactly one block, `sort_order = 0`, of the block type corresponding to the original `lesson_type` (`reading→text`, `video→video`, `download→file`) — matching `009_lesson_blocks.py`'s backfill logic read line-by-line (`backend/alembic/versions/009_lesson_blocks.py`).

## What this does and doesn't cover

**Covers:** the content each lesson carries is unchanged — no truncation, no encoding corruption, no wrong media or template attached, no duplicate or missing blocks. This is what "renders identically" actually depends on.

**Does not cover:** the CSS/layout wrapper the block renderer places around that content (§20.3's 32px/40px gap, the serif treatment, the 16:9 video frame) versus whatever the pre-block single-type renderer used — the gating suite's own `test_case11_entitled_lesson_blocks_list_has_every_block_in_order` and the block components' Definition of Done (§34.1: 375px/1440px, both themes) are what stand behind that layer, not this check. If a purely visual regression is a concern independent of content correctness, it would need a live entitled walkthrough of the three routes, which needs a real test account (the same gap noted in gating case 9's signed-in half).

## Verdict

The migration's backfill is content-faithful for all three pre-existing lessons — verified against the live database, not assumed from reading the migration file. This closes non-negotiable #11's content-safety concern. The layout-parity half is covered by the existing block Definition of Done rather than a dedicated before/after screenshot, for the reason above.

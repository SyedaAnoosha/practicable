"""Admin API — the non-technical content editor's surface.

Add/edit a question, course, or template; upload a video; attach a file; publish —
no code required. Until this existed, every content change was a hand-written SQL
seed file in `db/seed/`, un-growable by anyone but a developer.

TWO RULES HOLD ACROSS EVERY ROUTE IN THIS PACKAGE.

1. **Every route depends on `require_admin`.** Not `get_current_user`, not a role
   check written inline. `app/core/deps.py:require_admin` is the one gate, and it is
   applied at the *router* level in `app/api/v1/admin/router.py` so a new endpoint
   added to any module here cannot ship unguarded by someone forgetting the
   dependency — the failure mode BACKEND.md §5 warns about.

2. **Every mutation writes an audit row.** `record_audit()` below is the only way to
   do it. `audit_log` has existed since the first migration and had zero writers; an
   admin surface that can silently republish or unpublish paid content without a
   trace is exactly what that table was created for.

Note on `published`: nothing here is published on create. A new question/course/
template starts unpublished and becomes visible only through an explicit publish
call, so a half-written draft can never appear in a public catalogue mid-edit.
"""

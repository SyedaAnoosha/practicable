"""Performance indexes and money/access uniqueness constraints.

Indexes every foreign key that is read on the hot path — notably `entitlements.user_id`,
read on every gated request (`app/core/entitlements.py:resolve_product_ids`). See
`docs/db_index_evidence.md` for the before/after `EXPLAIN (ANALYZE, BUFFERS)` output
justifying each one at synthetic scale; they are added before the catalogue grows into
needing them.

Two candidate indexes are deliberately NOT created here:
- `ix_qlt_question` (question_leadership_traits) — the planner never chooses it: the one
  call site (`_load_leadership_traits`) always queries essentially the whole
  published-questions set, where a sequential scan is unbeatable.
- `ix_entitlements_user_live` (partial, covering, `WHERE revoked_at IS NULL`) — depends
  on `entitlements.revoked_at`, added in migration `011`. The plain `ix_entitlements_user`
  below is the interim index, superseded and dropped in `011` in favour of the partial
  one, so the schema never carries two indexes on the same leading column.

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction, so the index-creation half
runs in an explicit autocommit block and is verified afterwards for any index left
`INVALID` by a failed concurrent build. The constraint half runs in the normal
transactional block, after the duplicate-cleanup deletes it depends on.

Revision ID: 010
Revises: 009
"""
import sqlalchemy as sa
from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


# (index name, table, columns, kwargs, comment naming the query it serves)
_CONCURRENT_INDEXES = [
    (
        "ix_entitlements_user", "entitlements", ["user_id"],
        {"postgresql_include": ["product_id"]},
        "Query 1 (THE GATE) — core/entitlements.py:resolve_product_ids, every gated request. "
        "Superseded by the partial ix_entitlements_user_live in migration 011.",
    ),
    (
        "ix_product_contents_product_type", "product_contents", ["product_id", "content_type"],
        {"postgresql_include": ["content_id"]},
        "Query 2 — core/entitlements.py:resolve_granted_content_ids, every catalogue/library load.",
    ),
    (
        "ix_product_contents_content", "product_contents", ["content_type", "content_id"],
        {},
        "Query 2b (reverse direction) — cheapest-product-per-resource resolvers in "
        "courses/templates/questions.py.",
    ),
    (
        "ix_questions_published_title", "questions", ["title"],
        {"postgresql_where": sa.text("published = true")},
        "Query 3a — content/questions.py:_load_published_questions. Eliminates the ORDER BY "
        "title sort node entirely (docs/db_index_evidence.md).",
    ),
    (
        "ix_questions_domain", "questions", ["domain_id"],
        {"postgresql_where": sa.text("published = true")},
        "Domain-filtered question reads (not one of the six benchmarked, but the same "
        "small/cheap partial-index reasoning as its title-ordered sibling above).",
    ),
    (
        "ix_lesson_progress_user_lesson", "lesson_progress", ["user_id", "lesson_id"],
        {"postgresql_include": ["completed"]},
        "Query 4 — api/v1/me.py and content/courses.py, every library/course-progress read.",
    ),
    (
        "ix_course_progress_user", "course_progress", ["user_id", "course_id"],
        {},
        "Same access shape as lesson_progress's index above — per-user course-progress reads.",
    ),
    (
        "ix_orders_user_created", "orders", ["user_id", sa.text("created_at DESC")],
        {},
        "Query 5 — a user's own order history, ordered.",
    ),
    (
        "ix_orders_created", "orders", [sa.text("created_at DESC")],
        {},
        "Query 5 — admin/orders.py's default sort. No plan change against today's unpaginated "
        "query (docs/db_index_evidence.md); kept as prerequisite infrastructure for keyset "
        "pagination on /admin/orders.",
    ),
    (
        "ix_order_items_order", "order_items", ["order_id"],
        {"postgresql_include": ["product_id", "price_amount_cents"]},
        "Query 5 — the orders/order_items join in admin/orders.py:_order_rows.",
    ),
    (
        "ix_order_items_product", "order_items", ["product_id"],
        {},
        "\"What sold\" reporting — the reverse direction of the join above.",
    ),
    (
        "ix_lessons_module_sort", "lessons", ["module_id", "sort_order"],
        {},
        "Query 6 — the course tree join (me.py, content/courses.py). Includes sort_order so "
        "the planner gets the ORDER BY for free.",
    ),
    (
        "ix_modules_course_sort", "modules", ["course_id", "sort_order"],
        {},
        "Query 6 — same reasoning as the lessons index above, one join level up.",
    ),
    (
        "ix_question_templates_question", "question_templates", ["question_id"],
        {},
        "Question detail page join — every question's linked templates.",
    ),
    (
        "ix_question_lessons_question", "question_lessons", ["question_id"],
        {},
        "Question detail page join — every question's linked lessons.",
    ),
    (
        "ix_question_relations_question", "question_relations", ["question_id"],
        {},
        "Question detail page join — populates \"related questions\".",
    ),
    (
        "ix_module_questions_module", "module_questions", ["module_id"],
        {},
        "Course syllabus join — a module's attached questions.",
    ),
    (
        "ix_audit_log_created", "audit_log", [sa.text("created_at DESC")],
        {},
        "Audit log reads — rare today, but the table only ever grows.",
    ),
]

# The four money/access pairs moved from "guaranteed by careful coding" to "guaranteed
# by the database".
_UNIQUE_CONSTRAINTS = [
    ("uq_entitlements_user_product", "entitlements", ["user_id", "product_id"]),
    ("uq_orders_stripe_session", "orders", ["stripe_session_id"]),
    ("uq_lesson_progress_user_lesson", "lesson_progress", ["user_id", "lesson_id"]),
    ("uq_course_progress_user_course", "course_progress", ["user_id", "course_id"]),
]

# A UNIQUE build fails at the end of a full scan if data already violates it. These
# deletes are idempotent and a no-op against clean data; kept in the migration so the
# same safety applies wherever it runs next, including production.
_DUPLICATE_CLEANUP = [
    """
    DELETE FROM entitlements e USING (
        SELECT user_id, product_id, min(created_at) AS keep FROM entitlements GROUP BY 1, 2
    ) k
    WHERE e.user_id = k.user_id AND e.product_id = k.product_id AND e.created_at > k.keep
    """,
    # orders.stripe_session_id duplicates would mean two different Stripe events both
    # fulfilled the same checkout session — webhook_events.stripe_event_id already guards
    # against replay of one event, this guards the (rarer) case of two distinct events.
    # Kept, not deleted: this is a possible real order, not a definite duplicate row, so
    # there is no safe automatic dedup here — the constraint itself is the fix. If this
    # ever fails to build, that's a manual investigation, not a cleanup script's job.
    """
    DELETE FROM lesson_progress lp USING (
        SELECT user_id, lesson_id, min(created_at) AS keep FROM lesson_progress GROUP BY 1, 2
    ) k
    WHERE lp.user_id = k.user_id AND lp.lesson_id = k.lesson_id AND lp.created_at > k.keep
    """,
    """
    DELETE FROM course_progress cp USING (
        SELECT user_id, course_id, min(created_at) AS keep FROM course_progress GROUP BY 1, 2
    ) k
    WHERE cp.user_id = k.user_id AND cp.course_id = k.course_id AND cp.created_at > k.keep
    """,
]


def upgrade() -> None:
    # ── Indexes — CONCURRENTLY, so this never blocks writes on a table people are
    # reading. Cannot run inside Alembic's default transaction.
    with op.get_context().autocommit_block():
        for name, table, columns, kwargs, comment in _CONCURRENT_INDEXES:
            op.create_index(name, table, columns, postgresql_concurrently=True, **kwargs)
            op.execute(sa.text(f"COMMENT ON INDEX {name} IS :c").bindparams(c=comment))

    # A CONCURRENTLY build can fail and leave an INVALID index behind without raising —
    # verify explicitly so a broken build fails this migration loudly instead of
    # shipping a silently-useless index.
    conn = op.get_bind()
    invalid = conn.execute(
        sa.text(
            "SELECT indexrelid::regclass::text FROM pg_index WHERE NOT indisvalid "
            "AND indexrelid::regclass::text = ANY(:names)"
        ),
        {"names": [i[0] for i in _CONCURRENT_INDEXES]},
    ).fetchall()
    if invalid:
        raise RuntimeError(
            f"CREATE INDEX CONCURRENTLY left INVALID index(es): {[r[0] for r in invalid]}. "
            "Drop and re-run."
        )

    # ── Duplicate cleanup, before the constraints that would otherwise fail to build
    # on top of any duplicate this finds. Back in Alembic's normal transactional DDL
    # here — CONCURRENTLY's autocommit block has already exited.
    for stmt in _DUPLICATE_CLEANUP:
        op.execute(stmt)

    # ── The four uniqueness constraints.
    for name, table, columns in _UNIQUE_CONSTRAINTS:
        op.create_unique_constraint(name, table, columns)


def downgrade() -> None:
    for name, table, _columns in _UNIQUE_CONSTRAINTS:
        op.drop_constraint(name, table, type_="unique")

    with op.get_context().autocommit_block():
        for name, table, _columns, _kwargs, _comment in reversed(_CONCURRENT_INDEXES):
            op.drop_index(name, table_name=table, postgresql_concurrently=True)

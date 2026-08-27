-- Q001 — the one real question. Foreign keys are resolved
-- by subquery against 001_seed_domains_and_tags.sql's rows rather than pasted-in UUIDs
-- looked up by hand in Supabase Studio — run 001 first, this is not idempotent-safe to
-- run before it (the subqueries would just resolve to NULL).

INSERT INTO questions (
  id, slug, title, subtitle, body, preview, domain_id,
  effort_tag_id, duration_tag_id, cost_tag_id, roi_horizon_tag_id, tier_tag_id,
  regulator_pressure_tag_id, published, created_at, updated_at
)
SELECT
  '550e8400-e29b-41d4-a716-446655440100',
  'we-have-a-risk-register-but-no-one-uses-it',
  'We Have a Risk Register, But No One Uses It',
  'How do you make a risk register that people actually use?',
  'Most risk registers fail because they live in a spreadsheet that is owned by the risk team and read by no-one. The fix is to make the register useful in decisions people are already making, not a parallel artefact for compliance. Five moves change the dynamic. First, link every risk to a live business objective so it ties to something the executive cares about. Second, assign business owners, not risk team members - risk facilitates, the business owns. Third, surface the top risks in monthly operating meetings with trend arrows, not in a quarterly risk-only forum. Fourth, embed the register where decisions happen - strategy reviews, project gates, investment committees. Fifth, archive stale risks ruthlessly; a register of 400 risks signals nothing, a register of 25 live risks demands attention. ISO 31000 frames this as integrating risk into governance and decision-making rather than treating it as a process. Practitioners who get this right keep the register short, current, and visibly used by the people whose names are on it.',
  -- questions.preview is capped at 160 chars (app/db/models/question.py) — a short
  -- summary for index/card views, distinct from the full body above.
  'Most risk registers fail because they live in a spreadsheet owned by the risk team and read by no-one — the fix is to make it useful in real decisions.',
  (SELECT id FROM domains WHERE slug = 'risk-enterprise-op'),
  (SELECT id FROM tag_values WHERE tag_dimension = 'effort' AND value = 'mod'),
  (SELECT id FROM tag_values WHERE tag_dimension = 'duration' AND value = 'm'),
  (SELECT id FROM tag_values WHERE tag_dimension = 'cost' AND value = 'low'),
  (SELECT id FROM tag_values WHERE tag_dimension = 'roi_horizon' AND value = 'quick'),
  (SELECT id FROM tag_values WHERE tag_dimension = 'tier' AND value = 'f'),
  (SELECT id FROM tag_values WHERE tag_dimension = 'regulator_pressure' AND value = 'l'),
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE slug = 'we-have-a-risk-register-but-no-one-uses-it');

-- Leadership traits (multi-select: 1 Accountability, 3 Collaboration, 2 Change)
INSERT INTO question_leadership_traits (id, question_id, trait_tag_id, created_at, updated_at)
SELECT gen_random_uuid(), q.id, t.id, NOW(), NOW()
FROM questions q
CROSS JOIN LATERAL (
  SELECT id FROM tag_values WHERE tag_dimension = 'leadership_traits' AND value IN ('1', '2', '3')
) t
WHERE q.slug = 'we-have-a-risk-register-but-no-one-uses-it'
  AND NOT EXISTS (
    SELECT 1 FROM question_leadership_traits qlt
    WHERE qlt.question_id = q.id AND qlt.trait_tag_id = t.id
  );

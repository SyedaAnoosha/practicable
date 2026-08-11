-- Attach Q001 to Module 2 as a syllabus item (module_questions, added in alembic
-- 006) — Module 2 is literally about the practice Q001 asks about, so a learner
-- reading the module can jump straight to the question's written guidance. Sort
-- order 2 places it after the module's two lessons (0, 1) in the outline.

INSERT INTO module_questions (id, module_id, question_id, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440303', q.id, 2, NOW(), NOW()
FROM questions q
WHERE q.slug = 'we-have-a-risk-register-but-no-one-uses-it'
  AND NOT EXISTS (
    SELECT 1 FROM module_questions mq
    WHERE mq.module_id = '550e8400-e29b-41d4-a716-446655440303' AND mq.question_id = q.id
  );

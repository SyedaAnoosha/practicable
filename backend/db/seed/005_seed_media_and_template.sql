-- The real Mux video and the real template file (week1_plan.md decision #7), pulled
-- from the Mux API (GET /video/v1/assets) and Supabase Storage's S3 API
-- (list_objects_v2) directly rather than typed in by hand — see the asset/bucket
-- listing this was generated from. Run after 004_seed_course_skeleton.sql.

-- The one real lesson video (Mux asset "Risk Management Planning", status ready,
-- signed playback policy, 184s).
INSERT INTO media (id, lesson_id, mux_asset_id, mux_playback_id, status, duration_seconds, created_at, updated_at)
SELECT
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440302',
  '00R00wZ6tVNFHvhJ3501YQD49007Mfwm00jHZTh025BbMaVnI',
  'zC8I2gaveDvtK3dppLW02uuNyzQn00kbthfFcZgp17XdQ',
  'ready',
  184,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM media WHERE lesson_id = '550e8400-e29b-41d4-a716-446655440302');

-- The one real template file, already uploaded to the practicable-videos-bucket
-- Supabase Storage bucket at key 'risk-register-file-excel.xlsx' (24,486 bytes).
INSERT INTO templates (id, slug, title, description, section_id, author_id, storage_key, file_name, file_size_bytes, mime_type, published, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'risk-register-template',
  'Risk Register Template',
  'A ready-to-use risk register spreadsheet — the practical companion to "We Have a Risk Register, But No One Uses It."',
  '550e8400-e29b-41d4-a716-446655440200',
  '550e8400-e29b-41d4-a716-446655440201',
  'risk-register-file-excel.xlsx',
  'Risk Register Template.xlsx',
  24486,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug = 'risk-register-template');

-- Now that the lesson has a ready video and the course has a real template linked to
-- it, flip both from the Day-3-pending false to published.
UPDATE lessons SET published = true WHERE slug = 'lesson-1-introduction';
UPDATE courses SET published = true WHERE slug = 'risk-register-fundamentals';

-- Link Q001 to both, so the question detail page's "related templates"/"related
-- lessons" (app/db/models/question.py's QuestionTemplate/QuestionLesson) resolve.
INSERT INTO question_templates (id, question_id, template_id, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440100', t.id, 0, NOW(), NOW()
FROM templates t
WHERE t.slug = 'risk-register-template'
  AND NOT EXISTS (
    SELECT 1 FROM question_templates qt
    WHERE qt.question_id = '550e8400-e29b-41d4-a716-446655440100' AND qt.template_id = t.id
  );

INSERT INTO question_lessons (id, question_id, lesson_id, sort_order, created_at, updated_at)
SELECT gen_random_uuid(), '550e8400-e29b-41d4-a716-446655440100', '550e8400-e29b-41d4-a716-446655440302', 0, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM question_lessons
  WHERE question_id = '550e8400-e29b-41d4-a716-446655440100' AND lesson_id = '550e8400-e29b-41d4-a716-446655440302'
);

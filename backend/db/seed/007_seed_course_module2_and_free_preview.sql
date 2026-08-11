-- Module 2 + two more lessons, demonstrating the reading and downloadable-artefact
-- lesson types that LessonType already declared but nothing populated before this
-- pass (only the video type had a real row). Run after 006_seed_product.sql.

INSERT INTO modules (id, title, description, sort_order, course_id, created_at, updated_at)
SELECT '550e8400-e29b-41d4-a716-446655440303', 'Module 2', 'Making the register something people actually use', 1,
  '550e8400-e29b-41d4-a716-446655440300', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE id = '550e8400-e29b-41d4-a716-446655440303');

-- Reading lesson: body is NULL and published=false until the real text is written —
-- this is the lesson the author is writing directly (docs/handover.md's content-entry
-- note); flip both once it lands.
INSERT INTO lessons (id, slug, title, description, lesson_type, module_id, sort_order, published, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440304',
  'writing-entries-people-actually-read',
  'Writing a register entry someone will actually read',
  'How to write the one field on a risk register that determines whether anyone opens it again.',
  'reading',
  '550e8400-e29b-41d4-a716-446655440303',
  0,
  false,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- Download lesson: reuses the existing risk-register-template file (the course's
-- practical companion) rather than duplicating it — gated by lesson/course
-- entitlement, not by a second, separate template purchase.
INSERT INTO lessons (id, slug, title, description, lesson_type, module_id, sort_order, download_template_id, published, created_at, updated_at)
SELECT
  '550e8400-e29b-41d4-a716-446655440305',
  'download-the-register-template',
  'Download: the Risk Register template',
  'The working spreadsheet this module walks through — download it and follow along.',
  'download',
  '550e8400-e29b-41d4-a716-446655440303',
  1,
  t.id,
  true,
  NOW(),
  NOW()
FROM templates t
WHERE t.slug = 'risk-register-template'
  AND NOT EXISTS (SELECT 1 FROM lessons WHERE slug = 'download-the-register-template');

-- The existing intro video becomes the course's required free-preview lesson
-- (DESIGN.md §23.3) — a visitor can watch it before buying anything.
UPDATE lessons SET is_free_preview = true WHERE slug = 'lesson-1-introduction';

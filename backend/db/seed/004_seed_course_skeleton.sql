-- Insert course → module → lesson skeleton for Week 1
-- This is a placeholder structure that will be populated with real content on Day 3

-- First, ensure we have a section and author (insert placeholders if needed)
INSERT INTO sections (id, name, slug, description, created_at, updated_at)
VALUES ('550e8400-e29b-41d4-a716-446655440200', 'Risk Management', 'risk-management', 'Risk management fundamentals', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO authors (id, name, slug, bio, created_at, updated_at)
VALUES ('550e8400-e29b-41d4-a716-446655440201', 'Practicable Author', 'practicable-author', 'Risk management practitioner', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Insert course skeleton
INSERT INTO courses (id, slug, title, subtitle, description, section_id, author_id, published, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440300',
  'risk-register-fundamentals',
  'Risk Register Fundamentals',
  'Making risk registers that actually work',
  'A practical guide to building and maintaining risk registers that drive decision-making rather than compliance.',
  '550e8400-e29b-41d4-a716-446655440200',
  '550e8400-e29b-41d4-a716-446655440201',
  false, -- Will be published on Day 3
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- Insert module skeleton (no natural unique key on modules — guard on id instead so
-- re-running this file doesn't duplicate it)
INSERT INTO modules (id, title, description, sort_order, course_id, created_at, updated_at)
SELECT '550e8400-e29b-41d4-a716-446655440301', 'Module 1', 'Introduction to risk registers', 0,
  '550e8400-e29b-41d4-a716-446655440300', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM modules WHERE id = '550e8400-e29b-41d4-a716-446655440301');

-- Insert lesson skeleton (video type)
INSERT INTO lessons (id, slug, title, description, lesson_type, module_id, sort_order, published, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440302',
  'lesson-1-introduction',
  'Introduction',
  'Introduction to the course',
  'video',
  '550e8400-e29b-41d4-a716-446655440301',
  0,
  false, -- Flip true once the real Mux asset + media row exist
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

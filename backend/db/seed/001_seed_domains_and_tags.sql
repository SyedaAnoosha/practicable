-- Seed domains (Decision #2 from week1_plan.md)
INSERT INTO domains (id, name, slug, description, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Risk (Enterprise & op.)', 'risk-enterprise-op', 'Enterprise and operational risk management', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440001', 'Cyber (Tech & security)', 'cyber-tech-security', 'Cybersecurity and technology risk', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'Compliance (Regulatory)', 'compliance-regulatory', 'Regulatory compliance and governance', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'Resilience (Continuity)', 'resilience-continuity', 'Business continuity and resilience', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440004', 'AI (Governance)', 'ai-governance', 'AI governance and emerging technology', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- Seed tag values (Decision #3 from week1_plan.md)
-- Effort
INSERT INTO tag_values (tag_dimension, value, display_label, sort_order, created_at, updated_at) VALUES
  ('effort', 'quick', 'Quick (Days to weeks)', 1, NOW(), NOW()),
  ('effort', 'mod', 'Mod. (Weeks to months)', 2, NOW(), NOW()),
  ('effort', 'project', 'Project (Multi-month)', 3, NOW(), NOW()),
  ('effort', 'trans', 'Trans. (Year+ change)', 4, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Duration
INSERT INTO tag_values (tag_dimension, value, display_label, sort_order, created_at, updated_at) VALUES
  ('duration', 'xs', 'XS (Under 2 weeks)', 1, NOW(), NOW()),
  ('duration', 's', 'S (2–6 weeks)', 2, NOW(), NOW()),
  ('duration', 'm', 'M (6–12 weeks)', 3, NOW(), NOW()),
  ('duration', 'l', 'L (3–6 months)', 4, NOW(), NOW()),
  ('duration', 'xl', 'XL (Over 6 months)', 5, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Cost
INSERT INTO tag_values (tag_dimension, value, display_label, sort_order, created_at, updated_at) VALUES
  ('cost', 'low', '$ (Low investment)', 1, NOW(), NOW()),
  ('cost', 'medium', '$$ (Medium investment)', 2, NOW(), NOW()),
  ('cost', 'high', '$$$ (High investment)', 3, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ROI Horizon (formerly payback; renamed and reconciled to match the real 100-question
-- content exactly per week1_plan.md decision #3. "Strategic" deliberately also exists as
-- a Tier value and a Leadership trait — an accepted overlap, kept dimension-scoped here.)
INSERT INTO tag_values (tag_dimension, value, display_label, sort_order, created_at, updated_at) VALUES
  ('roi_horizon', 'quick', 'Quick', 1, NOW(), NOW()),
  ('roi_horizon', 'mid', 'Mid', 2, NOW(), NOW()),
  ('roi_horizon', 'strategic', 'Strategic', 3, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Tier
INSERT INTO tag_values (tag_dimension, value, display_label, sort_order, created_at, updated_at) VALUES
  ('tier', 'f', 'F (Foundational basics)', 1, NOW(), NOW()),
  ('tier', 't', 'T (Tactical improvements)', 2, NOW(), NOW()),
  ('tier', 's', 'S (Strategic uplift)', 3, NOW(), NOW()),
  ('tier', 'x', 'X (Transformational)', 4, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Regulator pressure
INSERT INTO tag_values (tag_dimension, value, display_label, sort_order, created_at, updated_at) VALUES
  ('regulator_pressure', 'n', 'N (None)', 1, NOW(), NOW()),
  ('regulator_pressure', 'l', 'L (Low)', 2, NOW(), NOW()),
  ('regulator_pressure', 'm', 'M (Moderate)', 3, NOW(), NOW()),
  ('regulator_pressure', 'h', 'H (High pressure)', 4, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Leadership traits
INSERT INTO tag_values (tag_dimension, value, display_label, sort_order, created_at, updated_at) VALUES
  ('leadership_traits', '1', '1 (Accountability)', 1, NOW(), NOW()),
  ('leadership_traits', '2', '2 (Change)', 2, NOW(), NOW()),
  ('leadership_traits', '3', '3 (Collaboration)', 3, NOW(), NOW()),
  ('leadership_traits', '4', '4 (Technical)', 4, NOW(), NOW()),
  ('leadership_traits', '5', '5 (Strategic)', 5, NOW(), NOW())
ON CONFLICT DO NOTHING;

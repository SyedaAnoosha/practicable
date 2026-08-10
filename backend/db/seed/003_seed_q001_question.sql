-- Insert Q001 question with real content from Decision #6
-- First, get the domain ID for "Risk (Enterprise & op.)"
-- Then get the tag value IDs for each tag dimension

-- Note: Run this after domains and tag_values are seeded
-- You'll need to look up the actual UUIDs from your Supabase Studio after running the seed

-- Example (replace UUIDs with actual values from your database):
INSERT INTO questions (id, slug, title, subtitle, body, preview, domain_id, 
  effort_tag_id, duration_tag_id, cost_tag_id, roi_horizon_tag_id, tier_tag_id, 
  regulator_pressure_tag_id, published, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440100',
  'we-have-a-risk-register-but-no-one-uses-it',
  'We Have a Risk Register, But No One Uses It',
  'How do you make a risk register that people actually use?',
  'Most risk registers fail because they live in a spreadsheet that is owned by the risk team and read by no-one. The fix is to make the register useful in decisions people are already making, not a parallel artefact for compliance. Five moves change the dynamic. First, link every risk to a live business objective so it ties to something the executive cares about. Second, assign business owners, not risk team members - risk facilitates, the business owns. Third, surface the top risks in monthly operating meetings with trend arrows, not in a quarterly risk-only forum. Fourth, embed the register where decisions happen - strategy reviews, project gates, investment committees. Fifth, archive stale risks ruthlessly; a register of 400 risks signals nothing, a register of 25 live risks demands attention. ISO 31000 frames this as integrating risk into governance and decision-making rather than treating it as a process. Practitioners who get this right keep the register short, current, and visibly used by the people whose names are on it.',
  'Most risk registers fail because they live in a spreadsheet that is owned by the risk team and read by no-one. The fix is to make the register useful in decisions people are already making.',
  -- Replace with actual domain UUID from domains table
  '550e8400-e29b-41d4-a716-446655440000',
  -- Replace with actual tag value UUIDs from tag_values table
  -- effort: Mod. (Weeks to months)
  NULL,
  -- duration: M (6–12 weeks)
  NULL,
  -- cost: $ (Low investment)
  NULL,
  -- roi_horizon: Q (Under 6 months)
  NULL,
  -- tier: F (Foundational basics)
  NULL,
  -- regulator_pressure: L (Low)
  NULL,
  true,
  NOW(),
  NOW()
);

-- Insert leadership traits for Q001 (multi-select: 1, 3, 2)
INSERT INTO question_leadership_traits (question_id, trait_tag_id, created_at, updated_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440100', NULL, NOW(), NOW()), -- Replace with trait 1 UUID
  ('550e8400-e29b-41d4-a716-446655440100', NULL, NOW(), NOW()), -- Replace with trait 3 UUID
  ('550e8400-e29b-41d4-a716-446655440100', NULL, NOW(), NOW()); -- Replace with trait 2 UUID

-- IMPORTANT: After running the initial insert, update the tag_id columns with the actual UUIDs
-- from the tag_values table. You can do this in Supabase Studio by editing the question row.

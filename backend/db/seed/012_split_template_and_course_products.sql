-- Split the one bundled product into two separately-priced ones.
--
-- THE BUG: buying the template also unlocked the course. This was a data problem, not
-- an entitlements-engine problem — app/core/entitlements.py does exactly what it says (a
-- product grants whatever its product_contents rows point at). There was simply one
-- product, `risk-register-template` at A$29, carrying FIVE content rows: the template
-- file, all three course lessons, and Q001's question_set. So "the template" and "the
-- course" were never distinct purchasables at all; 006 and 010 had each added lesson
-- rows to the only product that existed.
--
-- THE SHAPE AFTER THIS MIGRATION:
--   Risk Register Template        A$29  -> the template file + Q001's guidance
--   Risk Register Fundamentals    A$49  -> all 3 lessons + the template + Q001
--
-- The course is a deliberate superset: its Module 2 lesson `download-the-register-
-- template` *is* the template file, so a course buyer who couldn't open the template
-- would hit a locked lesson inside the course they just bought. The rule the owner
-- stated is one-directional and is what this enforces — template does NOT unlock the
-- course; course DOES include the template.
--
-- PRICE. A$49 is the bottom of the short-course tier. At its real depth (~3 min video +
-- one ~650-word reading + one download) this course is at the low end of what earns a
-- separate price. Change the amount here AND the Stripe price if a different figure is
-- wanted.
--
-- Stripe (test mode) objects for this:
--   product prod_V3R56Vr4rUDks1 / price price_1U3KDULTNkwhOECvalmzoP0V (4900 AUD)

-- ── 1. The course product ────────────────────────────────────────────────────────
INSERT INTO products (id, slug, name, description, stripe_price_id, price_amount, currency, published, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'risk-register-fundamentals',
  'Risk Register Fundamentals',
  'The full course - every lesson across both modules, plus the register template used in it.',
  'price_1U3KDULTNkwhOECvalmzoP0V',
  4900,
  'AUD',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'risk-register-fundamentals');

-- ── 2. Move the lessons off the template product and onto the course ─────────────
-- Every published lesson belonging to the risk-register-fundamentals course, so this
-- stays correct if a lesson is added to the course later without editing this file.
INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'lesson', l.id, NOW(), NOW()
FROM products p
JOIN courses c ON c.slug = 'risk-register-fundamentals'
JOIN modules m ON m.course_id = c.id
JOIN lessons l ON l.module_id = m.id
WHERE p.slug = 'risk-register-fundamentals'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'lesson' AND pc.content_id = l.id
  );

-- The course includes the template file (its download lesson is that same file).
INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'template', t.id, NOW(), NOW()
FROM products p, templates t
WHERE p.slug = 'risk-register-fundamentals' AND t.slug = 'risk-register-template'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'template' AND pc.content_id = t.id
  );

-- ...and Q001's guidance entitlement, so a course buyer sees the owned state on the
-- question rather than an upsell for something they already hold (DESIGN.md §23.2).
INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'question_set', q.id, NOW(), NOW()
FROM products p, questions q
WHERE p.slug = 'risk-register-fundamentals'
  AND q.slug = 'we-have-a-risk-register-but-no-one-uses-it'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'question_set' AND pc.content_id = q.id
  );

-- ── 3. THE ACTUAL FIX: the template product stops granting the course ────────────
-- This is the one destructive statement in the file, and the one that closes the bug.
DELETE FROM product_contents pc
USING products p
WHERE pc.product_id = p.id
  AND p.slug = 'risk-register-template'
  AND pc.content_type = 'lesson';

-- ── 4. Grandfather anyone who already bought the bundle ──────────────────────────
-- Existing buyers paid A$29 when that price genuinely included the course. Silently
-- revoking course access from a completed order would be the wrong way to fix a
-- catalogue mistake, so every current holder of the template product also gets the
-- course product. New buyers get the split pricing; nobody loses what they paid for.
-- granted_via='manual': this grant is an administrative correction, not a second
-- purchase, and the enum is the only place that distinction is recorded.
INSERT INTO entitlements (id, user_id, product_id, granted_via, expires_at, created_at, updated_at)
SELECT gen_random_uuid(), e.user_id, course.id, 'manual', e.expires_at, NOW(), NOW()
FROM entitlements e
JOIN products tmpl ON tmpl.id = e.product_id AND tmpl.slug = 'risk-register-template'
JOIN products course ON course.slug = 'risk-register-fundamentals'
WHERE NOT EXISTS (
  SELECT 1 FROM entitlements e2
  WHERE e2.user_id = e.user_id AND e2.product_id = course.id
);

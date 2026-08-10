-- The one real Week 1 product (week1_plan.md decision #7 / Phase 4 step 1). Stripe
-- product/price created via the Stripe API directly (test mode) — see the price id
-- below. A$29 AUD, one-time, per the owner's pricing decision.
--
-- Three product_contents rows, not one: this single purchase unlocks the template
-- file, the video lesson, AND Q001's full guidance body (research spec 8.2 step 3).
-- Missing the question_set row is the one mistake that would make the question page's
-- paywall work in isolation and then silently never unlock after a real purchase.

INSERT INTO products (id, slug, name, description, stripe_price_id, price_amount, currency, published, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'risk-register-template',
  'Risk Register Template',
  'A ready-to-use risk register spreadsheet, the companion video lesson, and the full guidance on making a risk register people actually use.',
  'price_1U2veKLTNkwhOECvC60VAsdJ',
  2900,
  'AUD',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'risk-register-template');

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'template', t.id, NOW(), NOW()
FROM products p, templates t
WHERE p.slug = 'risk-register-template' AND t.slug = 'risk-register-template'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'template' AND pc.content_id = t.id
  );

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'lesson', l.id, NOW(), NOW()
FROM products p, lessons l
WHERE p.slug = 'risk-register-template' AND l.slug = 'lesson-1-introduction'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'lesson' AND pc.content_id = l.id
  );

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'question_set', q.id, NOW(), NOW()
FROM products p, questions q
WHERE p.slug = 'risk-register-template' AND q.slug = 'we-have-a-risk-register-but-no-one-uses-it'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'question_set' AND pc.content_id = q.id
  );

-- Week 3 Phase 3 step 4 — the bundle (decision #29, closed 2026-08-15,
-- docs/week3_plan.md §8.4 and §20.2).
--
-- Risk Register Fundamentals (A$49, the course) + the Risk domain pack (A$49,
-- db/seed/014) = A$98 separately, sold together at A$79 — a A$19 / 19.4% saving,
-- inside the 10-25% band that motivates a bundle purchase without collapsing either
-- standalone price (RS 4.1, §20.2's arithmetic).
--
-- NO NEW ENTITLEMENT MECHANISM (RS 5.6). The bundle is an ordinary `products` row.
-- Its `product_contents` rows are the UNION of what its two parts already grant,
-- resolved from the live table rather than hand-copied ids, so a future change to
-- either part's own content (a new lesson, a re-typeset pack) is reflected the next
-- time this script is (re-)run. `DISTINCT` on (content_type, content_id) matters
-- because the course's one question_set grant is itself one of the Risk pack's 60 —
-- without it the bundle would carry a duplicate grant for that single question.
--
-- Stripe (test mode) objects created for this, 2026-08-15:
--   Risk Register, start to finish   prod_V4siVvd8YRZNIp / price_1U4iwoLTNkwhOECvx2OPNluE  (7900 AUD)

INSERT INTO products (id, slug, name, description, stripe_price_id, price_amount, currency, published, is_bundle, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'risk-register-bundle',
  'Risk Register, start to finish',
  'The course, plus every Risk question in the domain, curated. Risk Register Fundamentals and the Risk domain pack together, at a saving against buying them separately.',
  'price_1U4iwoLTNkwhOECvx2OPNluE',
  7900, 'AUD', true, true,
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'risk-register-bundle');

-- `is_bundle` (migration 013) didn't exist when this script was first written, so this
-- row's flag defaulted to false and stayed false — invisible until week4_plan.md Phase
-- 1's verification pass (2026-08-20) ran `check_overlaps.sql` for real and it returned
-- 134 rows instead of the documented "zero," because `check_content_overlap` and
-- `check_bundle_pricing` both read this column directly and the escape hatch never
-- fired for the one product that needed it. Idempotent — a no-op once the flag is
-- already true, so this line stays even after the immediate live-DB fix.
UPDATE products SET is_bundle = true
WHERE slug = 'risk-register-bundle' AND is_bundle = false;

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), bundle.id, src.content_type, src.content_id, NOW(), NOW()
FROM products bundle
CROSS JOIN (
  SELECT DISTINCT pc.content_type, pc.content_id
  FROM product_contents pc
  JOIN products p ON p.id = pc.product_id
  WHERE p.slug IN ('risk-register-fundamentals', 'risk-enterprise-op-question-pack')
) src
WHERE bundle.slug = 'risk-register-bundle'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = bundle.id
      AND pc.content_type = src.content_type
      AND pc.content_id = src.content_id
  );

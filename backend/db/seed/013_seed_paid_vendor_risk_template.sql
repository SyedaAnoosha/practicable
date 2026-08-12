-- The paid template — closing the intern brief's Week 1 requirement.
--
-- THE GAP THIS FILLS. The brief (Week 1, "the slice") requires "one template behind a
-- paywall". That was true until 2026-08-12, when the Risk Register Template became the
-- free lead magnet on owner instruction. At that point the catalogue had a free
-- template and a paid *course*, but no paid template at all — so the rule "other
-- templates are paid" had zero instances and the paid-template gating path had nothing
-- real to exercise it. This restores that leg of the slice with a second real artefact
-- rather than by reversing the free-template decision.
--
-- WHY THIS FILE, AND WHY NOT A NEW UPLOAD. Six real vendor-risk artefacts were already
-- sitting unused in the Supabase Storage bucket (uploaded 2026-08-10). Using one is
-- consistent with the standing no-placeholder rule — this is a genuine 398 KB working
-- spreadsheet, not a stub — and it needs no new upload step. The remaining five are
-- available for the next templates (docs/pricing.md §3's target catalogue).
--
-- PRICE. A$39 — docs/pricing.md §1's "more useful professional template" tier
-- (A$39–49), and exactly the figure §3's target catalogue already assigns to the next
-- vendor-risk template. Not a number invented here.
--
-- WHAT IT GRANTS, DELIBERATELY: the template file and nothing else. It is not attached
-- to the course, and the course does not include it — unlike the risk register, whose
-- file *is* one of the course's lessons. A standalone paid template is precisely the
-- shape the brief asks for, and precisely what the entitlement suite needs in order to
-- test a paywalled download that no other purchase can unlock.
--
-- Stripe (test mode) objects created for this, 2026-08-12:
--   product prod_V3cOLz1yy5jcn6 / price price_1U3V9gLTNkwhOECvDROyQzem (3900 AUD)

-- ── 1. The template row, pointing at the already-uploaded object ─────────────────
-- section_id/author_id reuse the existing single section/author, same as 005 did.
INSERT INTO templates (
  id, slug, title, description, section_id, author_id,
  storage_key, file_name, file_size_bytes, mime_type, published, is_free,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'vendor-risk-assessment-scorecard',
  'Vendor Risk Assessment Scorecard',
  'A working scorecard for assessing and comparing third-party vendors: weighted risk criteria, side-by-side comparison, and a ranked output you can take into a supplier review.',
  (SELECT id FROM sections ORDER BY created_at LIMIT 1),
  (SELECT id FROM authors ORDER BY created_at LIMIT 1),
  'IC-Vendor-Risk-Comparison-with-Scorecard-10772.xlsx',
  'Vendor Risk Assessment Scorecard.xlsx',
  398286,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  true,
  false,  -- PAID. This is the whole point of the file.
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug = 'vendor-risk-assessment-scorecard');

-- ── 2. The product ───────────────────────────────────────────────────────────────
INSERT INTO products (
  id, slug, name, description, stripe_price_id, price_amount, currency, published,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'vendor-risk-assessment-scorecard',
  'Vendor Risk Assessment Scorecard',
  'A working vendor risk assessment and comparison scorecard - score, compare and rank third parties on one sheet.',
  'price_1U3V9gLTNkwhOECvDROyQzem',
  3900,
  'AUD',
  true,
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'vendor-risk-assessment-scorecard');

-- ── 3. One grant: the template, and only the template ────────────────────────────
INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'template', t.id, NOW(), NOW()
FROM products p, templates t
WHERE p.slug = 'vendor-risk-assessment-scorecard'
  AND t.slug = 'vendor-risk-assessment-scorecard'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'template' AND pc.content_id = t.id
  );

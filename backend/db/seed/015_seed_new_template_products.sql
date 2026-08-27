-- Four new paid template products.
--
-- WHERE EACH FILE CAME FROM.
--
-- (a) Two of the six vendor-risk files that sat unused, already vetted by the owner:
--     the fifth was used for the Vendor Risk Assessment Scorecard (db/seed/013); these
--     two close out the set (the sixth, the sample-due-diligence-plan PDF, is used only
--     to generate this checklist's preview images — the sold artefact is the .xlsx it's
--     a PDF export of):
--       · IC-Sample-Vendor-Risk-Due-Diligence-Plan-10772.xlsx  → TPRM Due Diligence
--         Checklist (standalone, A$49 — "professional checklist" tier)
--       · IC-Vendor-Risk-Assessment-10772_PDF.pdf +
--         IC-Vendor-Evaluation-with-Scorecard-10772.xlsx        → Complete TPRM
--         Template Pack (two files, one product, A$99 — "multi-file pack" tier)
--     The due diligence plan is a task tracker (collect/screen/assess, with
--     owner/dates), the risk assessment PDF is a 15-item rated risk checklist, the
--     evaluation scorecard is a per-vendor scoring form — genuinely distinct from each
--     other and from the already-sold Vendor Risk Comparison scorecard (013).
--
-- (b) Two templates uploaded and published via the admin panel, left with no product —
--     `risk-assessment-template` (an 18-page worked risk-assessment example; a NEBOSH
--     Unit IG2 assessment layout, a different provenance than the six vendor-risk files)
--     and `quality-risk-management-presentation-...` (a legacy .ppt, content
--     unverifiable — python-pptx cannot read the pre-OOXML format). Priced
--     conservatively: A$39 for the worked-example PDF ("professional template" tier),
--     A$29 for the presentation (unverified depth, "simple template" tier).
--
-- Stripe (test mode) objects for this:
--   TPRM Due Diligence Checklist          prod_V4sefyZCp31A3g / price_1U4itYLTNkwhOECvuFXVls9H  (4900 AUD)
--   Complete TPRM Template Pack           prod_V4seTzhjvcNbIc / price_1U4itZLTNkwhOECvbZXHPGp6  (9900 AUD)
--   Risk Assessment Template              prod_V4seBVxIADDjhp / price_1U4itaLTNkwhOECvAByCHGAB  (3900 AUD)
--   Quality Risk Management Presentation  prod_V4seHV6tmRB5fr / price_1U4itbLTNkwhOECvY6vYeCOU  (2900 AUD)

-- ── (a1) TPRM Due Diligence Checklist ──────────────────────────────────────────────
INSERT INTO templates (
  id, slug, title, description, section_id, author_id,
  storage_key, file_name, file_size_bytes, mime_type, published, is_free,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'tprm-due-diligence-checklist',
  'TPRM Due Diligence Checklist',
  'A working third-party due diligence task tracker: collect vendor information, screen the vendor, assess vendor risk — with status, owner and date columns to run the process end to end.',
  (SELECT id FROM sections ORDER BY created_at LIMIT 1),
  (SELECT id FROM authors ORDER BY created_at LIMIT 1),
  'IC-Sample-Vendor-Risk-Due-Diligence-Plan-10772.xlsx',
  'TPRM Due Diligence Checklist.xlsx',
  384837,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  true, false,
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug = 'tprm-due-diligence-checklist');

INSERT INTO products (id, slug, name, description, stripe_price_id, price_amount, currency, published, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'tprm-due-diligence-checklist',
  'TPRM Due Diligence Checklist',
  'Run third-party due diligence from one sheet: collect vendor information, screen the vendor, assess the risk, track status, owner and dates to close-out.',
  'price_1U4itYLTNkwhOECvuFXVls9H',
  4900, 'AUD', true,
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'tprm-due-diligence-checklist');

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'template', t.id, NOW(), NOW()
FROM products p, templates t
WHERE p.slug = 'tprm-due-diligence-checklist' AND t.slug = 'tprm-due-diligence-checklist'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'template' AND pc.content_id = t.id
  );

-- ── (a2) Complete TPRM Template Pack — two files, one product ─────────────────────
INSERT INTO templates (
  id, slug, title, description, section_id, author_id,
  storage_key, file_name, file_size_bytes, mime_type, published, is_free,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'vendor-risk-assessment-template',
  'Vendor Risk Assessment Template',
  'A 15-item rated vendor risk checklist covering risk-assessment process failure through to physical and systems access breaches, each with a risk rating and notes column.',
  (SELECT id FROM sections ORDER BY created_at LIMIT 1),
  (SELECT id FROM authors ORDER BY created_at LIMIT 1),
  'IC-Vendor-Risk-Assessment-10772_PDF.pdf',
  'Vendor Risk Assessment Template.pdf',
  391107,
  'application/pdf',
  true, false,
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug = 'vendor-risk-assessment-template');

INSERT INTO templates (
  id, slug, title, description, section_id, author_id,
  storage_key, file_name, file_size_bytes, mime_type, published, is_free,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'vendor-evaluation-with-scorecard',
  'Vendor Evaluation with Scorecard',
  'A per-vendor evaluation form — RFP-adherence criteria scored 1–5 with the basis for each score recorded, distinct from the multi-vendor comparison scorecard sold separately.',
  (SELECT id FROM sections ORDER BY created_at LIMIT 1),
  (SELECT id FROM authors ORDER BY created_at LIMIT 1),
  'IC-Vendor-Evaluation-with-Scorecard-10772.xlsx',
  'Vendor Evaluation with Scorecard.xlsx',
  371504,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  true, false,
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM templates WHERE slug = 'vendor-evaluation-with-scorecard');

INSERT INTO products (id, slug, name, description, stripe_price_id, price_amount, currency, published, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'complete-tprm-template-pack',
  'Complete TPRM Template Pack',
  'The full third-party risk toolkit: a vendor risk assessment checklist and a per-vendor evaluation scorecard, both ready to fill in.',
  'price_1U4itZLTNkwhOECvbZXHPGp6',
  9900, 'AUD', true,
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'complete-tprm-template-pack');

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'template', t.id, NOW(), NOW()
FROM products p, templates t
WHERE p.slug = 'complete-tprm-template-pack' AND t.slug = 'vendor-risk-assessment-template'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'template' AND pc.content_id = t.id
  );

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'template', t.id, NOW(), NOW()
FROM products p, templates t
WHERE p.slug = 'complete-tprm-template-pack' AND t.slug = 'vendor-evaluation-with-scorecard'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'template' AND pc.content_id = t.id
  );

-- ── (b1) Risk Assessment Template — existing row, no product ──
INSERT INTO products (id, slug, name, description, stripe_price_id, price_amount, currency, published, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'risk-assessment-template',
  'Risk Assessment Template',
  'An 18-page worked risk assessment example: hazard identification, who might be harmed, existing controls, further actions required and timescales, laid out ready to adapt for your own assessment.',
  'price_1U4itaLTNkwhOECvAByCHGAB',
  3900, 'AUD', true,
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'risk-assessment-template');

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'template', t.id, NOW(), NOW()
FROM products p, templates t
WHERE p.slug = 'risk-assessment-template' AND t.slug = 'risk-assessment-template'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'template' AND pc.content_id = t.id
  );

-- ── (b2) Quality Risk Management Presentation — existing row, no product ──────────
INSERT INTO products (id, slug, name, description, stripe_price_id, price_amount, currency, published, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'quality-risk-management-presentation',
  'Quality Risk Management Presentation',
  'A ready-to-use presentation deck covering quality risk management guidelines, reusable as a training or briefing resource.',
  'price_1U4itbLTNkwhOECvY6vYeCOU',
  2900, 'AUD', true,
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'quality-risk-management-presentation');

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'template', t.id, NOW(), NOW()
FROM products p, templates t
WHERE p.slug = 'quality-risk-management-presentation'
  AND t.slug = 'quality-risk-management-presentation-ready-to-use-template'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'template' AND pc.content_id = t.id
  );

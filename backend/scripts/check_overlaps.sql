-- Overlap audit script.
-- Run against production at any time without a deploy to find shared content between
-- published products.
--
-- Returns: rows where two published, non-bundle products grant the same content.
-- A result of zero rows (beyond expected bundles) is the correct steady state.
-- Any unexpected row is a real finding and must be resolved before the next publish.
--
-- The WHERE clause mirrors check_content_overlap() in app/core/publish_guard.py,
-- so this script and the application guard are always checking the same condition.

SELECT
    p1.name     AS product_1,
    p1.slug     AS slug_1,
    p2.name     AS product_2,
    p2.slug     AS slug_2,
    pc1.content_type,
    pc1.content_id
FROM product_contents pc1
JOIN product_contents pc2
    ON  pc2.content_type = pc1.content_type
    AND pc2.content_id   = pc1.content_id
    AND pc2.product_id  != pc1.product_id
JOIN products p1
    ON  p1.id        = pc1.product_id
    AND p1.published = true
    AND p1.is_bundle = false
JOIN products p2
    ON  p2.id        = pc2.product_id
    AND p2.published = true
    AND p2.is_bundle = false
ORDER BY p1.name, pc1.content_type, pc1.content_id;

-- Expected result for the current catalogue:
-- Zero rows. The bundle in db/seed/016_seed_bundle.sql is excluded by is_bundle=false
-- filter above, which is correct — a bundle is explicitly permitted to overlap.
--
-- If this returns rows, investigate before publishing anything new.

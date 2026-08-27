-- Module 2's two lessons (added in 007/008, both now published) were never linked to
-- any product_contents row, so nobody who bought risk-register-template could actually
-- reach them despite the course page listing them. Fixes that without inventing a
-- second, separately-priced course product for content that isn't deep enough yet to
-- justify its own price point (~3 min video + one reading lesson + a shared download).

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'lesson', l.id, NOW(), NOW()
FROM products p, lessons l
WHERE p.slug = 'risk-register-template' AND l.slug = 'writing-entries-people-actually-read'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'lesson' AND pc.content_id = l.id
  );

INSERT INTO product_contents (id, product_id, content_type, content_id, created_at, updated_at)
SELECT gen_random_uuid(), p.id, 'lesson', l.id, NOW(), NOW()
FROM products p, lessons l
WHERE p.slug = 'risk-register-template' AND l.slug = 'download-the-register-template'
  AND NOT EXISTS (
    SELECT 1 FROM product_contents pc
    WHERE pc.product_id = p.id AND pc.content_type = 'lesson' AND pc.content_id = l.id
  );

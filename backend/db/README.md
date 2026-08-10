# Database Migration Instructions

## Day 1 Migration Steps

### Option 1: Supabase Studio (Recommended for Day 1)

1. Open your Supabase project dashboard
2. Go to **SQL Editor** in the left sidebar
3. Run the migration file: Open and execute `alembic/versions/001_initial_schema.py` (copy the SQL from the `upgrade()` function)
4. Run the seed file: Open and execute `db/seed/001_seed_domains_and_tags.sql`
5. Run the RLS file: Open and execute `db/seed/002_enable_rls.sql`

### Option 2: Supabase CLI (For automated deployments)

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link to your project: `supabase link --project-ref YOUR_PROJECT_ID`
4. Run migrations:
   ```bash
   # Convert Alembic migration to SQL and apply
   supabase db push
   ```

### Verification

After migration, verify in Supabase Studio:

**Tables created (18 total):**
- users, sections, authors, domains, tag_values
- questions, question_leadership_traits, question_relations
- courses, modules, lessons, media, templates
- products, product_contents, orders, order_items
- entitlements, lesson_progress, course_progress
- leads, audit_log, webhook_events

**Domains seeded (5 rows):**
- Check `domains` table should have 5 rows

**Tag values seeded (26 rows):**
- Check `tag_values` table should have 26 rows across 7 dimensions

**RLS enabled:**
- Check that RLS is enabled on: users, orders, order_items, entitlements, lesson_progress, course_progress

## Migration Files

- `alembic/versions/001_initial_schema.py` - Creates all tables and enums
- `db/seed/001_seed_domains_and_tags.sql` - Seeds domains and tag reference values
- `db/seed/002_enable_rls.sql` - Enables Row-Level Security on user-data tables

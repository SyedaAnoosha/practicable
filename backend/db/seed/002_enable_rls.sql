-- Enable Row-Level Security on user-data tables (Day 1 non-negotiable)

-- Users: Users can only see their own profile (except admins)
-- users.id IS the Supabase auth user id directly (see app/db/models/user.py) — there
-- is no separate supabase_id mapping column, so this compares against id, exactly
-- like every other table's policy below compares its user_id column to auth.uid().
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Orders: Users can only see their own orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (user_id::text = auth.uid()::text);

-- Order items: Users can view items from their own orders
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items" ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE user_id::text = auth.uid()::text)
  );

-- Entitlements: Users can only view their own entitlements
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entitlements" ON entitlements
  FOR SELECT USING (user_id::text = auth.uid()::text);

-- Lesson progress: Users can only view/update their own progress
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lesson progress" ON lesson_progress
  FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update own lesson progress" ON lesson_progress
  FOR UPDATE USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own lesson progress" ON lesson_progress
  FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

-- Course progress: Users can only view/update their own progress
ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own course progress" ON course_progress
  FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can update own course progress" ON course_progress
  FOR UPDATE USING (user_id::text = auth.uid()::text);

CREATE POLICY "Users can insert own course progress" ON course_progress
  FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

-- Public tables (no RLS needed for read-only data):
-- sections, authors, domains, tag_values, questions (published), courses (published), 
-- modules, lessons (published), templates (published), products (published), media
-- These remain accessible to authenticated users via backend API, not direct Supabase access

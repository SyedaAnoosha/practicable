import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Copy .env.local.example to .env.local.',
  )
}

// The only Supabase client in the app, and the only place sign-up/sign-in/sign-out
// are called — FastAPI only ever verifies the JWT this produces, it never
// issues sessions itself.
export const supabase = createClient(url, anonKey)

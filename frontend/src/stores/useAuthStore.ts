import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => void
}

// DESIGN.md §80: holds session state read by MemberLayout's guard and by the Axios
// interceptor (lib/api/client.ts). Server data (questions, entitlements, ...) never
// lives here — that's TanStack Query's job (lib/query/queryClient.ts).
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setLoading: (loading) => set({ loading }),
  signOut: () => set({ user: null, session: null }),
}))

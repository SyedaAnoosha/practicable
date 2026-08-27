import axios from 'axios'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { queryClient } from '@/lib/query/queryClient'

const API_BASE = import.meta.env.VITE_API_BASE_URL

if (!API_BASE) {
  throw new Error('VITE_API_BASE_URL is not set. Copy .env.local.example to .env.local.')
}

// The only Axios instance in the app — no other file calls FastAPI
// with raw fetch. Two responsibilities live here and nowhere else: attaching the
// Supabase JWT, and reacting to a 401 by clearing session state.
export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().signOut()
      queryClient.clear()
      if (window.location.pathname !== '/sign-in') {
        window.location.href = '/sign-in'
      }
    }
    return Promise.reject(error)
  },
)

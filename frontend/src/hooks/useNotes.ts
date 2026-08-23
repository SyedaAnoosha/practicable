/**
 * W5-R5: Notes hook — upsert, list, and delete notes for lessons.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export interface Note {
  id: string
  lesson_id: string
  body: string
  created_at: string
  updated_at: string
}

export function useNotes() {
  return useQuery<Note[]>({
    queryKey: ['me', 'notes'],
    queryFn: () => api.get<Note[]>('/me/notes').then((r) => r.data),
  })
}

export function useUpsertNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lessonId, body }: { lessonId: string; body: string }) =>
      api.put<Note>(`/me/notes/${lessonId}`, { body }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'notes'] })
    },
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lessonId: string) =>
      api.delete(`/me/notes/${lessonId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me', 'notes'] })
    },
  })
}

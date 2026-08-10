// Centralised query keys (DESIGN.md §79) so cache keys can't drift between call sites.
export const queryKeys = {
  questions: {
    detail: (slug: string) => ['questions', 'detail', slug] as const,
  },
  lessons: {
    playbackToken: (lessonId: string) => ['lessons', 'playback', lessonId] as const,
  },
  templates: {
    downloadUrl: (templateId: string) => ['templates', 'download-url', templateId] as const,
  },
  products: {
    detail: (slug: string) => ['products', 'detail', slug] as const,
  },
  me: {
    entitlements: () => ['me', 'entitlements'] as const,
  },
} as const

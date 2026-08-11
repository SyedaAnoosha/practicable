// Centralised query keys (DESIGN.md §79) so cache keys can't drift between call sites.
export const queryKeys = {
  questions: {
    list: () => ['questions', 'list'] as const,
    detail: (slug: string) => ['questions', 'detail', slug] as const,
  },
  courses: {
    list: () => ['courses', 'list'] as const,
    detail: (slug: string) => ['courses', 'detail', slug] as const,
  },
  lessons: {
    playbackToken: (lessonId: string) => ['lessons', 'playback', lessonId] as const,
    downloadUrl: (lessonId: string) => ['lessons', 'download-url', lessonId] as const,
    inCourse: (courseSlug: string, lessonSlug: string) => ['lessons', 'in-course', courseSlug, lessonSlug] as const,
  },
  templates: {
    list: () => ['templates', 'list'] as const,
    downloadUrl: (templateId: string) => ['templates', 'download-url', templateId] as const,
  },
  products: {
    detail: (slug: string) => ['products', 'detail', slug] as const,
  },
  me: {
    entitlements: () => ['me', 'entitlements'] as const,
  },
} as const

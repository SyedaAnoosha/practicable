// Centralised query keys (DESIGN.md §79) so cache keys can't drift between call sites.
export const queryKeys = {
  questions: {
    list: () => ['questions', 'list'] as const,
    detail: (slug: string) => ['questions', 'detail', slug] as const,
    relatedProducts: (slug: string) => ['questions', 'detail', slug, 'related-products'] as const,
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
  // A mixed-content lesson can carry more than one video/file block (week2_plan.md
  // Phase 2), each minting its own token/URL from its own block id — same shape as
  // `lessons` above, keyed by block id instead of lesson id.
  lessonBlocks: {
    playbackToken: (blockId: string) => ['lesson-blocks', 'playback', blockId] as const,
  },
  // Domain packs (week2_plan.md W2-R6). Keyed by product slug, not template id — a
  // pack is addressed by the product that sells it; its PDF is an implementation
  // detail the detail response happens to carry.
  packs: {
    list: () => ['packs', 'list'] as const,
    detail: (slug: string) => ['packs', 'detail', slug] as const,
  },
  templates: {
    list: () => ['templates', 'list'] as const,
    detail: (id: string) => ['templates', 'detail', id] as const,
    downloadUrl: (templateId: string) => ['templates', 'download-url', templateId] as const,
  },
  products: {
    list: () => ['products', 'list'] as const,
    detail: (slug: string) => ['products', 'detail', slug] as const,
    forQuestions: (questionIds: string[]) => ['products', 'for-questions', questionIds] as const,
  },
  promotions: {
    active: () => ['promotions', 'active'] as const,
  },
  me: {
    entitlements: () => ['me', 'entitlements'] as const,
    library: () => ['me', 'library'] as const,
    profile: () => ['me', 'profile'] as const,
    orders: () => ['me', 'orders'] as const,
    certificates: () => ['me', 'certificates'] as const,
    notifications: () => ['me', 'notifications'] as const,
  },
  admin: {
    questions: (search: string, published: string) => ['admin', 'questions', search, published] as const,
    question: (id: string) => ['admin', 'question', id] as const,
    questionFormOptions: () => ['admin', 'questions', 'form-options'] as const,
    templates: () => ['admin', 'templates'] as const,
    products: () => ['admin', 'products'] as const,
    courses: () => ['admin', 'courses'] as const,
    course: (id: string) => ['admin', 'course', id] as const,
    orders: () => ['admin', 'orders'] as const,
    metrics: () => ['admin', 'metrics'] as const,
    revenueSeries: (days: number) => ['admin', 'metrics', 'revenue-series', days] as const,
    users: () => ['admin', 'users'] as const,
    user: (id: string) => ['admin', 'user', id] as const,
    audit: () => ['admin', 'audit'] as const,
    leads: () => ['admin', 'leads'] as const,
    promotions: () => ['admin', 'promotions'] as const,
    settings: () => ['admin', 'settings'] as const,
    media: () => ['admin', 'media'] as const,
  },
} as const

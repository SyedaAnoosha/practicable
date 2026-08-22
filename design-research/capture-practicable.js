// Capture Practicable's own pages from the running dev server, so the redesign is
// verified against rendered pixels rather than against the source that produced them.
// Public routes only — anything behind auth is captured separately with a session.
//
// [REVISED 2026-08-21] The first run of this script produced 18 files that were all
// loading skeletons and empty states: the dev server was up but the API was not, so
// every data-driven section collapsed. Two changes stop that being silent —
//   1. a preflight that fails loudly if the API is unreachable, rather than capturing
//      an empty app and calling it evidence;
//   2. per-route content assertions, so a page that renders its empty state is reported
//      as EMPTY rather than OK.
// Detail routes use slugs read from the live API, never guessed.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE = process.env.BASE ?? 'http://localhost:5173'
const API = process.env.API ?? 'http://localhost:8000'
const OUT = path.join(__dirname, 'screenshots', '_practicable')

const routes = [
  // `expectBelowFold` guards the §6 artifact specifically: a capture blank for a
  // mechanical reason still satisfies a hero-only assertion.
  { name: 'home', url: '/', expect: 'Start there', expectBelowFold: 'How it works' },
  { name: 'questions-catalogue', url: '/questions', expect: null },
  { name: 'courses-catalogue', url: '/courses', expect: 'Risk Register Fundamentals' },
  { name: 'course-detail', url: '/courses/risk-register-fundamentals', expect: 'Risk Register Fundamentals' },
  { name: 'templates-catalogue', url: '/templates', expect: 'Risk Register Template' },
  { name: 'packs-catalogue', url: '/packs', expect: null },
  { name: 'pack-detail', url: '/store/packs/risk-enterprise-op-question-pack', expect: null },
  { name: 'product-buy', url: '/buy/risk-register-bundle', expect: null },
  { name: 'store', url: '/store', expect: null },
  { name: 'sign-in', url: '/sign-in', expect: null },
]

async function preflight() {
  const res = await fetch(`${API}/courses`).catch(() => null)
  if (!res || !res.ok) {
    console.error(`\n  ABORT — the API at ${API} is not answering.`)
    console.error(`  Capturing now would produce empty skeletons, which is what the`)
    console.error(`  previous run of this script did. Start the backend first:\n`)
    console.error(`    cd backend && ./.venv/Scripts/python.exe -m uvicorn main:app --port 8000\n`)
    process.exit(1)
  }
  const courses = await res.json()
  console.log(`preflight OK — API serving ${courses.length} courses\n`)
}

;(async () => {
  await preflight()
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const empties = []

  for (const theme of ['light', 'dark']) {
    for (const vp of [
      { label: 'desktop', width: 1440, height: 900 },
      { label: 'mobile', width: 390, height: 844 },
    ]) {
      // Mobile only in light — the dark pass is about token correctness on the planes,
      // which desktop already exercises; doubling the matrix adds files, not findings.
      if (vp.label === 'mobile' && theme === 'dark') continue

      // `[ADDED 2026-08-21, USER_FLOW_AUDIT.md §6]` Capture with reduced motion on.
      // Home's sections use whileInView with initial="hidden"; in a headless fullPage
      // shot the viewport never scrolls, so they never intersect and stay at opacity 0.
      // The previous captures were a correct hero above ~4000px of blank ivory. The app
      // routes reduced motion through <MotionConfig reducedMotion="user">, so this
      // renders the settled end state — what a real reduced-motion visitor sees.
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: 'reduce',
      })
      const page = await ctx.newPage()

      for (const route of routes) {
        const suffix = vp.label === 'mobile' ? '-mobile' : theme === 'dark' ? '-dark' : ''
        const tag = `${route.name}${suffix}`
        try {
          await page.goto(`${BASE}${route.url}`, { waitUntil: 'networkidle', timeout: 45000 })
          // The app toggles .dark on <html> itself; set it directly rather than driving
          // the toggle button, which isn't present on every route.
          await page.evaluate((t) => {
            document.documentElement.classList.toggle('dark', t === 'dark')
          }, theme)
          await page.waitForTimeout(1600)

          // A skeleton still screenshots fine, which is exactly why the last run passed
          // 18/18 while capturing nothing. Assert on real content instead.
          const body = await page.evaluate(() => document.body.innerText)
          const skeleton = await page.locator('.animate-pulse').count()
          const missing = route.expect && !body.includes(route.expect)
          const missingBelow = route.expectBelowFold && !body.includes(route.expectBelowFold)
          if (missing || missingBelow || skeleton > 0) {
            empties.push(`${tag}${missing ? ` (no "${route.expect}")` : ''}${missingBelow ? ` (no below-fold "${route.expectBelowFold}")` : ''}${skeleton ? ` (${skeleton} skeletons)` : ''}`)
          }

          await page.screenshot({ path: path.join(OUT, `${tag}.png`), fullPage: true })
          console.log(`${missing || missingBelow || skeleton ? 'EMPTY' : 'OK   '} ${tag}`)
        } catch (err) {
          console.log(`FAIL ${tag} — ${String(err.message).split('\n')[0]}`)
        }
      }
      await ctx.close()
    }
  }

  await browser.close()
  if (empties.length) {
    console.log(`\n${empties.length} capture(s) rendered empty or still loading:`)
    empties.forEach((e) => console.log(`  - ${e}`))
  }
  console.log('\ndone')
})()

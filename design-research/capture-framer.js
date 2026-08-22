// Capture the ten Framer templates the owner nominated (2026-08-21) as the motion and
// graphics reference for the redesign. These render entirely through JS, so WebFetch
// returns copy and nothing else — pixels are the only way to read them.
//
// Two shots per template: the hero at rest, and the page mid-scroll so scroll-triggered
// reveals have fired. A single fullPage shot would show unfired reveals as blank space,
// which is exactly the artifact USER_FLOW_AUDIT.md §6 records on our own captures.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const SITES = [
  ['parley', 'https://parley.framer.ai/'],
  ['saazai', 'https://saazai.framer.website/'],
  ['galilee', 'https://galilee.framer.ai/'],
  ['fintechx', 'https://fintechx-wbs.framer.website/'],
  ['verity', 'https://verity-template.framer.website/'],
  ['utomic', 'https://utomic.framer.website/'],
  ['verseo', 'https://verseo.framer.website/'],
  ['dreammotion', 'https://dreammotion.framer.website/'],
  ['grovia', 'https://grovia.framer.ai/'],
]
const OUT = path.join(__dirname, 'screenshots', '_framer-refs')

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  for (const [name, url] of SITES) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
      await page.waitForTimeout(3500)            // entrance animations settle
      await page.screenshot({ path: path.join(OUT, `${name}-hero.png`) })

      // Drive the scroll so IntersectionObserver reveals actually fire, pausing to let
      // each viewport's animations play before the next step.
      for (let i = 1; i <= 4; i++) {
        await page.evaluate((n) => window.scrollTo({ top: window.innerHeight * n, behavior: 'instant' }), i)
        await page.waitForTimeout(1200)
      }
      await page.screenshot({ path: path.join(OUT, `${name}-scrolled.png`) })
      console.log(`OK   ${name}`)
    } catch (err) {
      console.log(`FAIL ${name} — ${String(err.message).split('\n')[0]}`)
    }
  }
  await browser.close()
  console.log('\ndone')
})()

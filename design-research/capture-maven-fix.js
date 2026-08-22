// The two Maven course URLs guessed in capture-wave2.js were 404s (verified from the
// captured PNGs). Rather than guess again, scrape Maven's own homepage for the links it
// actually publishes, then capture the first real course page it points at.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

;(async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: UA,
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  })
  const page = await ctx.newPage()

  await page.goto('https://maven.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)

  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href'))
      .filter(Boolean)
  )

  const abs = hrefs
    .map((h) => (h.startsWith('http') ? h : `https://maven.com${h}`))
    .filter((h) => h.includes('maven.com'))

  // A course lives at /{instructor-or-org}/{course-slug} — two path segments, and not
  // one of the known non-course sections.
  const SKIP = new Set([
    'browse', 'about', 'blog', 'pricing', 'login', 'signup', 'teach', 'for-business',
    'privacy', 'terms', 'help', 'careers', 'guides', 'courses', 'search', 'p',
  ])
  const courseLinks = [...new Set(abs)].filter((h) => {
    try {
      const segs = new URL(h).pathname.split('/').filter(Boolean)
      return segs.length === 2 && !SKIP.has(segs[0]) && !segs[0].startsWith('_')
    } catch {
      return false
    }
  })

  // Browse pages Maven actually links to.
  const browseLinks = [...new Set(abs)].filter((h) => /\/(browse|classes|courses)(\?|$|\/)/.test(h))

  console.log('candidate course links:', courseLinks.slice(0, 8))
  console.log('candidate browse links:', browseLinks.slice(0, 5))

  const dir = path.join(__dirname, 'screenshots', 'maven')
  fs.mkdirSync(dir, { recursive: true })

  const shoot = async (url, name) => {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(6000)
      const title = await page.title()
      const body = await page.evaluate(() => document.body.innerText.slice(0, 300))
      if (/we probably shouldn't be here|can't seem to find/i.test(body)) {
        console.log(`SKIP ${name} — 404: ${url}`)
        return false
      }
      await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true })
      console.log(`OK   ${name} — ${title} (${url})`)
      return true
    } catch (err) {
      console.log(`FAIL ${name} — ${String(err.message).split('\n')[0]}`)
      return false
    }
  }

  const browseUrl = browseLinks[0] ?? 'https://maven.com/browse'
  await shoot(browseUrl, 'course-browse')

  for (const link of courseLinks.slice(0, 6)) {
    if (await shoot(link, 'course-detail')) break
  }

  await browser.close()
})()

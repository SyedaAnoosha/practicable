// Capture public marketing / catalogue / detail pages for the second wave of
// reference platforms. Same hardened context as the wave-1 retry script: a real
// desktop Chrome UA + Accept-Language + a generous settle wait, which is what got
// past Cloudflare's "checking your browser" interstitial on Udemy/Skillshare.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const targets = [
  // LinkedIn Learning
  { platform: 'linkedin-learning', name: 'homepage', url: 'https://www.linkedin.com/learning/' },
  { platform: 'linkedin-learning', name: 'topics-browse', url: 'https://www.linkedin.com/learning/topics/business' },
  { platform: 'linkedin-learning', name: 'course-detail', url: 'https://www.linkedin.com/learning/project-management-foundations-4' },

  // MasterClass
  { platform: 'masterclass', name: 'homepage', url: 'https://www.masterclass.com/' },
  { platform: 'masterclass', name: 'category-business', url: 'https://www.masterclass.com/categories/business' },
  { platform: 'masterclass', name: 'class-detail', url: 'https://www.masterclass.com/classes/bob-iger-teaches-business-strategy-and-leadership' },
  { platform: 'masterclass', name: 'pricing', url: 'https://www.masterclass.com/subscribe' },

  // Maven
  { platform: 'maven', name: 'homepage', url: 'https://maven.com/' },
  { platform: 'maven', name: 'course-browse', url: 'https://maven.com/browse' },
  { platform: 'maven', name: 'course-detail', url: 'https://maven.com/lennys-newsletter/product-management' },

  // Teachable
  { platform: 'teachable', name: 'homepage', url: 'https://teachable.com/' },
  { platform: 'teachable', name: 'pricing', url: 'https://teachable.com/pricing' },
  { platform: 'teachable', name: 'features', url: 'https://teachable.com/features' },

  // Thinkific
  { platform: 'thinkific', name: 'homepage', url: 'https://www.thinkific.com/' },
  { platform: 'thinkific', name: 'pricing', url: 'https://www.thinkific.com/pricing/' },

  // Brilliant
  { platform: 'brilliant', name: 'homepage', url: 'https://brilliant.org/' },
  { platform: 'brilliant', name: 'courses-catalog', url: 'https://brilliant.org/courses/' },
  { platform: 'brilliant', name: 'pricing', url: 'https://brilliant.org/premium/' },

  // O'Reilly
  { platform: 'oreilly', name: 'homepage', url: 'https://www.oreilly.com/' },
  { platform: 'oreilly', name: 'online-learning', url: 'https://www.oreilly.com/online-learning/' },
  { platform: 'oreilly', name: 'pricing', url: 'https://www.oreilly.com/online-learning/pricing.html' },

  // DataCamp
  { platform: 'datacamp', name: 'homepage', url: 'https://www.datacamp.com/' },
  { platform: 'datacamp', name: 'course-catalog', url: 'https://www.datacamp.com/courses-all' },
  { platform: 'datacamp', name: 'course-detail', url: 'https://www.datacamp.com/courses/introduction-to-python' },
  { platform: 'datacamp', name: 'pricing', url: 'https://www.datacamp.com/pricing' },

  // Pluralsight
  { platform: 'pluralsight', name: 'homepage', url: 'https://www.pluralsight.com/' },
  { platform: 'pluralsight', name: 'browse-library', url: 'https://www.pluralsight.com/browse' },
  { platform: 'pluralsight', name: 'pricing', url: 'https://www.pluralsight.com/pricing' },
]

const COOKIE_SELECTORS = [
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept cookies")',
  'button:has-text("Allow all")',
  'button:has-text("I agree")',
  'button:has-text("Got it")',
  '#onetrust-accept-btn-handler',
  '[data-testid="cookie-accept"]',
  'button[aria-label*="Accept"]',
]

async function dismissCookies(page) {
  for (const sel of COOKIE_SELECTORS) {
    try {
      const el = page.locator(sel).first()
      if (await el.isVisible({ timeout: 700 })) {
        await el.click({ timeout: 2000 })
        await page.waitForTimeout(700)
        return
      }
    } catch {
      /* selector not present — try the next one */
    }
  }
}

;(async () => {
  const browser = await chromium.launch()
  const results = []

  for (const t of targets) {
    const dir = path.join(__dirname, 'screenshots', t.platform)
    fs.mkdirSync(dir, { recursive: true })
    const out = path.join(dir, `${t.name}.png`)
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: UA,
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    })
    const page = await ctx.newPage()
    try {
      await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(6000)
      let title = await page.title()
      // Cloudflare / bot interstitials keep their own title — wait them out once.
      if (/security verification|just a moment|checking your browser/i.test(title)) {
        await page.waitForTimeout(9000)
        title = await page.title()
      }
      await dismissCookies(page)
      await page.waitForTimeout(1500)
      await page.screenshot({ path: out, fullPage: true })
      results.push({ ...t, status: 'ok', title })
      console.log(`OK   ${t.platform}/${t.name} — ${title}`)
    } catch (err) {
      results.push({ ...t, status: 'fail', error: String(err.message).split('\n')[0] })
      console.log(`FAIL ${t.platform}/${t.name} — ${String(err.message).split('\n')[0]}`)
      try {
        await page.screenshot({ path: out, fullPage: false })
      } catch {
        /* nothing renderable */
      }
    }
    await ctx.close()
  }

  await browser.close()
  fs.writeFileSync(
    path.join(__dirname, 'screenshots', 'wave2-manifest.json'),
    JSON.stringify(results, null, 2)
  )
  const ok = results.filter((r) => r.status === 'ok').length
  console.log(`\nDone: ${ok}/${results.length} captured`)
})()

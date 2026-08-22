// Captures public (non-authenticated) marketing/catalogue/course pages for each platform.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'screenshots');

const targets = [
  // Coursera
  { platform: 'coursera', name: '01-home', url: 'https://www.coursera.org/' },
  { platform: 'coursera', name: '02-browse', url: 'https://www.coursera.org/browse' },
  { platform: 'coursera', name: '03-course-detail', url: 'https://www.coursera.org/learn/machine-learning' },
  { platform: 'coursera', name: '04-plus-pricing', url: 'https://www.coursera.org/coursera-plus' },
  { platform: 'coursera', name: '05-search-results', url: 'https://www.coursera.org/search?query=data%20analysis' },

  // edX
  { platform: 'edx', name: '01-home', url: 'https://www.edx.org/' },
  { platform: 'edx', name: '02-search', url: 'https://www.edx.org/search' },
  { platform: 'edx', name: '03-course-detail', url: 'https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science' },
  { platform: 'edx', name: '04-programs', url: 'https://www.edx.org/executive-education' },

  // Udemy
  { platform: 'udemy', name: '01-home', url: 'https://www.udemy.com/' },
  { platform: 'udemy', name: '02-category', url: 'https://www.udemy.com/courses/development/' },
  { platform: 'udemy', name: '03-course-detail', url: 'https://www.udemy.com/course/the-complete-web-development-bootcamp/' },

  // Skillshare
  { platform: 'skillshare', name: '01-home', url: 'https://www.skillshare.com/en/' },
  { platform: 'skillshare', name: '02-browse', url: 'https://www.skillshare.com/en/browse' },
  { platform: 'skillshare', name: '03-class-detail', url: 'https://www.skillshare.com/en/browse/design' },

  // Kajabi
  { platform: 'kajabi', name: '01-home', url: 'https://kajabi.com/' },
  { platform: 'kajabi', name: '02-pricing', url: 'https://kajabi.com/pricing' },
  { platform: 'kajabi', name: '03-features', url: 'https://kajabi.com/features' },
  { platform: 'kajabi', name: '04-templates', url: 'https://kajabi.com/website-templates' },
];

async function dismissCookieBanners(page) {
  const selectors = [
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    'button:has-text("Allow all")',
    'button:has-text("Got it")',
    '#onetrust-accept-btn-handler',
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1500 })) {
        await el.click({ timeout: 1500 });
        await page.waitForTimeout(500);
        break;
      }
    } catch (e) { /* ignore */ }
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const t of targets) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const outDir = path.join(OUT, t.platform);
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${t.name}.png`);
    try {
      await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2000);
      await dismissCookieBanners(page);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: outFile, fullPage: true, timeout: 30000 });
      console.log(`OK   ${t.platform}/${t.name} -> ${t.url}`);
      results.push({ ...t, status: 'ok' });
    } catch (err) {
      console.log(`FAIL ${t.platform}/${t.name} -> ${t.url} :: ${err.message.split('\n')[0]}`);
      results.push({ ...t, status: 'fail', error: err.message.split('\n')[0] });
    } finally {
      await context.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'public-manifest.json'), JSON.stringify(results, null, 2));
  await browser.close();
})();

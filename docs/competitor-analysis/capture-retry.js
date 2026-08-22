const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'screenshots');

const targets = [
  { platform: 'udemy', name: '01-home', url: 'https://www.udemy.com/' },
  { platform: 'udemy', name: '02-category', url: 'https://www.udemy.com/courses/development/' },
  { platform: 'udemy', name: '03-course-detail', url: 'https://www.udemy.com/course/the-complete-web-development-bootcamp/' },
  { platform: 'skillshare', name: '02-browse', url: 'https://www.skillshare.com/en/browse' },
  { platform: 'skillshare', name: '03-class-detail', url: 'https://www.skillshare.com/en/browse/design' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const t of targets) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const page = await context.newPage();
    const outDir = path.join(OUT, t.platform);
    const outFile = path.join(outDir, `${t.name}.png`);
    try {
      await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // give Cloudflare's managed challenge time to auto-resolve
      await page.waitForTimeout(9000);
      const title = await page.title().catch(() => '');
      if (/security verification|just a moment/i.test(title)) {
        await page.waitForTimeout(8000);
      }
      await page.screenshot({ path: outFile, fullPage: true, timeout: 30000 });
      console.log(`OK   ${t.platform}/${t.name} title="${await page.title()}"`);
    } catch (err) {
      console.log(`FAIL ${t.platform}/${t.name} :: ${err.message.split('\n')[0]}`);
    } finally {
      await context.close();
    }
  }
  await browser.close();
})();

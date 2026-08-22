const { chromium } = require('playwright');
const path = require('path');

const OUT = path.join(__dirname, 'screenshots', 'edx');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('https://www.edx.org/learn/computer-science/harvard-university-cs50-s-introduction-to-computer-science', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, '03-course-detail.png'), fullPage: true });
  console.log('done');
  await browser.close();
})();

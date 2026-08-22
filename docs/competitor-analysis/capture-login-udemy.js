const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'screenshots', 'udemy');
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = process.env.CRED_EMAIL;
const PASS = process.env.CRED_PASS;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const page = await context.newPage();
  try {
    await page.goto('https://www.udemy.com/join/login-popup/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(9000);
    if (/security verification|just a moment/i.test(await page.title())) {
      await page.waitForTimeout(8000);
    }
    await page.screenshot({ path: path.join(OUT, '10-login-page.png'), fullPage: true });

    const emailBox = page.getByLabel('Email', { exact: false }).first();
    await emailBox.waitFor({ timeout: 20000 });
    await emailBox.fill(EMAIL);

    const continueBtn = page.locator('button:has-text("Continue")').first();
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    const passBox = page.getByLabel('Password', { exact: false }).first();
    await passBox.waitFor({ timeout: 15000 });
    await passBox.fill(PASS);
    await page.screenshot({ path: path.join(OUT, '11-login-filled.png'), fullPage: true });

    const submitBtn = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Continue")').first();
    await submitBtn.click().catch(() => {});
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(OUT, '12-after-login.png'), fullPage: true });

    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/captcha|verify you are human|unusual traffic|access denied/i.test(bodyText)) {
      console.log('CAPTCHA/block detected on Udemy login.');
    }

    await page.goto('https://www.udemy.com/home/my-courses/learning/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, '13-my-courses.png'), fullPage: true });

    console.log('Udemy login flow complete. Current URL:', page.url());
  } catch (err) {
    console.log('Udemy flow error:', err.message.split('\n')[0]);
    await page.screenshot({ path: path.join(OUT, '99-error.png'), fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
})();

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'screenshots', 'coursera');
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = process.env.CRED_EMAIL;
const PASS = process.env.CRED_PASS;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('https://www.coursera.org/?authMode=login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, '10-login-page.png'), fullPage: true });

    // Fill email
    const emailSel = 'input[type="email"], input#email, input[name="email"]';
    await page.waitForSelector(emailSel, { timeout: 15000 });
    await page.fill(emailSel, EMAIL);

    const passSel = 'input[type="password"], input#password, input[name="password"]';
    // Some flows require clicking continue first
    if (!(await page.locator(passSel).first().isVisible().catch(() => false))) {
      const continueBtn = page.locator('button:has-text("Continue"), button[type="submit"]').first();
      if (await continueBtn.isVisible().catch(() => false)) {
        await continueBtn.click().catch(() => {});
        await page.waitForTimeout(1500);
      }
    }
    await page.waitForSelector(passSel, { timeout: 15000 });
    await page.fill(passSel, PASS);
    await page.screenshot({ path: path.join(OUT, '11-login-filled.png'), fullPage: true });

    const submitBtn = page.locator('button[type="submit"], button:has-text("Log In"), button:has-text("Login")').first();
    await submitBtn.click().catch(() => {});
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(OUT, '12-after-login.png'), fullPage: true });

    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/captcha|verify you are human|unusual traffic|access denied/i.test(bodyText)) {
      console.log('CAPTCHA/block detected on Coursera login.');
    }

    // Try dashboard / my learning
    await page.goto('https://www.coursera.org/user-preferences', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.goto('https://www.coursera.org/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, '13-home-loggedin.png'), fullPage: true });

    await page.goto('https://www.coursera.org/my-learning', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, '14-my-learning.png'), fullPage: true });

    console.log('Coursera login flow complete. Current URL:', page.url());
  } catch (err) {
    console.log('Coursera flow error:', err.message.split('\n')[0]);
    await page.screenshot({ path: path.join(OUT, '99-error.png'), fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
})();

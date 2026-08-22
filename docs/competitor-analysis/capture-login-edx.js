const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'screenshots', 'edx');
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = process.env.CRED_EMAIL;
const PASS = process.env.CRED_PASS;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('https://authn.edx.org/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, '10-login-page.png'), fullPage: true });

    const emailSel = 'input#emailOrUsername, input[name="emailOrUsername"], input[type="email"]';
    await page.waitForSelector(emailSel, { timeout: 15000 });
    await page.fill(emailSel, EMAIL);

    const passSel = 'input#password, input[name="password"], input[type="password"]';
    await page.fill(passSel, PASS);
    await page.screenshot({ path: path.join(OUT, '11-login-filled.png'), fullPage: true });

    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in")').first();
    await submitBtn.click().catch(() => {});
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(OUT, '12-after-login.png'), fullPage: true });

    const bodyText = await page.locator('body').innerText().catch(() => '');
    if (/captcha|verify you are human|unusual traffic|access denied/i.test(bodyText)) {
      console.log('CAPTCHA/block detected on edX login.');
    }

    await page.goto('https://learning.edx.org/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, '13-dashboard.png'), fullPage: true });

    console.log('edX login flow complete. Current URL:', page.url());
  } catch (err) {
    console.log('edX flow error:', err.message.split('\n')[0]);
    await page.screenshot({ path: path.join(OUT, '99-error.png'), fullPage: true }).catch(() => {});
  } finally {
    await context.close();
    await browser.close();
  }
})();

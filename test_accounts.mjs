import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

// Login as admin
await page.goto('https://hh-vibecode.github.io/mkt-sale-app/?cb=' + Date.now(), { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('dashRole', 'admin'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

await page.click('#nav-settings');
await page.waitForTimeout(1000);
const settingsTitle = await page.$eval('#page-settings .page-title', el => el.textContent).catch(() => 'MISSING');
console.log('Settings page title:', settingsTitle);

// Create account
await page.click('button:has-text("Tạo tài khoản")');
await page.waitForTimeout(500);
await page.fill('input[name="name"]', 'Nguyễn Test Sale');
await page.fill('input[name="username"]', 'test.sale.e2e');
await page.fill('input[name="password"]', 'test1234');
await page.selectOption('select[name="position"]', 'sales');
await page.waitForTimeout(300);
const checkedPerms = await page.$$eval('#crmAcctPerms input:checked', els => els.map(e => e.value));
console.log('Auto-checked perms for sales position:', checkedPerms);
await page.click('#crmAddAcctForm button[type=submit]');
await page.waitForTimeout(1500);
const alertHandled = await page.evaluate(() => true); // dialog auto-dismissed below

console.log('ERRORS so far:', errors.length ? errors.join('\n') : 'none');
await browser.close();

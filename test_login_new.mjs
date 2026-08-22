import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('dialog', d => d.accept());

await page.goto('https://hh-vibecode.github.io/mkt-sale-app/?cb=' + Date.now(), { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const gateVisible = await page.$eval('#loginGate', el => getComputedStyle(el).display);
console.log('Login gate visible (should be flex, no session yet):', gateVisible);

await page.fill('#loginUser', 'test.sale.e2e');
await page.fill('#loginPass', 'test1234');
await page.click('button:has-text("Đăng nhập")');
await page.waitForTimeout(2500);

const state = await page.evaluate(() => ({
  role: localStorage.getItem('dashRole'),
  user: localStorage.getItem('dashUser'),
  perms: localStorage.getItem('dashPermissions'),
  gateHidden: document.getElementById('loginGate').style.display === 'none',
}));
console.log('Post-login state:', state);

const visibleNavs = await page.$$eval('.nav-item[id^="nav-"]', els => els.filter(e => getComputedStyle(e).display !== 'none').map(e => e.id));
console.log('Visible nav items for this sales account:', visibleNavs);

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

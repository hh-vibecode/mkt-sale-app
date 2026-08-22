import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto('https://hh-vibecode.github.io/mkt-sale-app/?cb=' + Date.now(), { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('dashRole', 'admin'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

await page.click('#nav-crm');
await page.waitForTimeout(800);
await page.click('#page-crm button:has-text("Advanced filters")');
await page.waitForTimeout(300);
const advVisible = await page.$eval('#crmAdvancedFilters', el => el.style.display !== 'none');
console.log('Advanced filters visible:', advVisible);

await page.click('#nav-datahub');
await page.waitForTimeout(1200);
const dhKpis = await page.$$eval('#page-datahub .kpi', els => els.map(e => e.textContent.replace(/\s+/g,' ')));
console.log('Data Hub KPIs:', dhKpis);

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

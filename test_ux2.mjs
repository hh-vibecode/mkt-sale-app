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
const chips = await page.$$eval('#page-crm span[onclick^="setCrmQuick"]', els => els.map(e => e.textContent));
console.log('Quick filter chips:', chips);
await page.click('text=Quá hạn follow-up');
await page.waitForTimeout(500);
const overdueCount = await page.$eval('#page-crm .tbl-count', el => el.textContent);
console.log('Overdue count:', overdueCount);
await page.click('text=Tất cả');
await page.waitForTimeout(500);

// advanced filters toggle
await page.click('button:has-text("Advanced filters")');
await page.waitForTimeout(300);
const advVisible = await page.$eval('#crmAdvancedFilters', el => el.style.display !== 'none');
console.log('Advanced filters visible:', advVisible);

// Data Hub
await page.click('#nav-datahub');
await page.waitForTimeout(1200);
const dhKpis = await page.$$eval('#page-datahub .kpi', els => els.map(e => e.textContent.replace(/\s+/g,' ')));
console.log('Data Hub KPIs:', dhKpis);

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('https://hh-vibecode.github.io/mkt-sale-app/?cb=' + Date.now(), { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('dashRole', 'admin'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

const navLabels = await page.$$eval('#sec-sale .nav-label', els => els.map(e => e.textContent));
console.log('Sale nav labels:', navLabels);

// Sales Workspace
await page.click('#nav-workspace');
await page.waitForTimeout(1000);
const wsTitle = await page.$eval('#page-workspace .page-title', el => el.textContent).catch(() => 'MISSING');
const wsKpiCount = await page.$$eval('#page-workspace .kpi', els => els.length);
console.log('Workspace title:', wsTitle, '| KPI cards:', wsKpiCount);

// Orders
await page.click('#nav-orders');
await page.waitForTimeout(1000);
const ordTitle = await page.$eval('#page-orders .page-title', el => el.textContent).catch(() => 'MISSING');
const ordRows = await page.$$eval('#page-orders tbody tr', els => els.length);
console.log('Orders title:', ordTitle, '| rows:', ordRows);

// Customers list + quick filter chips
await page.click('#nav-crm');
await page.waitForTimeout(1000);
const crmTitle = await page.$eval('#page-crm .page-title', el => el.textContent).catch(() => 'MISSING');
console.log('Customers page title:', crmTitle);

// Customer record tabs
await page.click('#page-crm tbody tr:first-child .name');
await page.waitForTimeout(700);
const tabBtns = await page.$$eval('#crmDetailModal .crm-tab-btn', els => els.map(e => e.textContent));
console.log('Record tabs:', tabBtns);
await page.click('#crmDetailModal .crm-tab-btn[data-tab="activities"]');
await page.waitForTimeout(300);
const activitiesVisible = await page.$eval('#crmDetailModal .crm-tab-panel[data-tab="activities"]', el => el.style.display !== 'none');
console.log('Activities tab visible after click:', activitiesVisible);

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

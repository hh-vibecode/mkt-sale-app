import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto('https://hh-vibecode.github.io/mkt-sale-app/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('dashRole', 'admin'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(4000);

// Check nav has Data Hub
const navLabels = await page.$$eval('#onl-subnav .nav-label', els => els.map(e => e.textContent));
console.log('Sub-nav labels:', navLabels);

// Data Hub page
await page.click('#nav-datahub');
await page.waitForTimeout(1500);
const dhContent = await page.$eval('#page-datahub', el => el.textContent.slice(0, 400));
console.log('Data Hub content snippet:', dhContent.replace(/\s+/g, ' '));

// CRM detail: verify name/phone NOT editable, customer_group IS editable
await page.click('#nav-crm');
await page.waitForTimeout(1000);
await page.click('#page-crm tbody tr:first-child');
await page.waitForTimeout(600);
const nameEditable = await page.$('#crmDetailModal span[data-field="name"]');
const groupEditable = await page.$('#crmDetailModal span[data-field="customer_group"]');
console.log('Name field editable (should be null now):', !!nameEditable);
console.log('customer_group editable (should be true):', !!groupEditable);

const auditSection = await page.$eval('#crmDetailModal', el => el.textContent.includes('Audit Log'));
console.log('Has Audit Log section:', auditSection);

console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();

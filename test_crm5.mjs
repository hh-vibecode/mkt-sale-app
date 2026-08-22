import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.goto('https://hh-vibecode.github.io/mkt-sale-app/?cb=' + Date.now(), { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('dashRole', 'admin'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.click('#nav-crm');
await page.waitForTimeout(800);
await page.click('#page-crm tbody tr:first-child');
await page.waitForTimeout(600);
const customerId = await page.$eval('#crmDetailModal code', el => el.textContent);
console.log('Testing on customer:', customerId);

const groupSpan = await page.$('#crmDetailModal span[data-field="customer_group"]');
await groupSpan.click();
await page.keyboard.press('Control+A');
await page.keyboard.type('KH VIP TEST');
await page.keyboard.press('Tab');
await page.waitForTimeout(1200);

// verify persisted
const res = await page.evaluate(async (cid) => {
  const r = await fetch(`https://bcrpxfvvjsjpvbksqzls.supabase.co/rest/v1/customers?customer_id=eq.${cid}&select=customer_group`, {
    headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnB4ZnZ2anNqcHZia3NxemxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzE0OTgsImV4cCI6MjEwMjg0NzQ5OH0.XGEUvHP1YBhxYKD9Xq1yH2gl95-V9VgaY5HfsAnFb2c' }
  });
  return r.json();
}, customerId);
console.log('customer_group after edit:', JSON.stringify(res));

// check audit_log
const audit = await page.evaluate(async (cid) => {
  const r = await fetch(`https://bcrpxfvvjsjpvbksqzls.supabase.co/rest/v1/audit_log?object_id=eq.${cid}&order=created_at.desc&limit=3`, {
    headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnB4ZnZ2anNqcHZia3NxemxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNzE0OTgsImV4cCI6MjEwMjg0NzQ5OH0.XGEUvHP1YBhxYKD9Xq1yH2gl95-V9VgaY5HfsAnFb2c' }
  });
  return r.json();
}, customerId);
console.log('audit_log entries:', JSON.stringify(audit, null, 1));

await browser.close();

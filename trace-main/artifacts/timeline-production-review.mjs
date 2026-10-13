import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(let i=1;i<=10;i++){
 await page.goto('http://127.0.0.1:4173/?variant=T'+i,{waitUntil:'networkidle'});
 await page.locator('.timeline-canvas button,.timeline-canvas .svg-hit').first().waitFor();
 console.log('Production T'+i,'loaded; switcher count',await page.locator('.timeline-switcher').count());
}
await page.goto('http://127.0.0.1:5173/?variant=T5',{waitUntil:'networkidle'});
await page.locator('.state-span.derived').click();
console.log('Inactivity interval records',await page.locator('.record-row').count(),'endpoint links',await page.locator('.drill-context button').count());
await page.locator('.drill-context button').first().click();
console.log('Endpoint evidence',await page.locator('.evidence-panel .eyebrow').textContent());
await page.getByRole('button',{name:'T7 Time lens',exact:true}).click();
await page.locator('.context-bars button').first().click();
await page.getByRole('button',{name:'בדיקה עם הסוכן ↗'}).click();
await page.locator('.message.assistant button').first().click();
console.log('Lens follows citation',await page.locator('.lens-detail .section-caption>b').textContent());
await page.getByRole('button',{name:'T2 Density matrix',exact:true}).click();
await page.locator('.search-label input').fill('not-a-real-id');
console.log('Empty filter total',await page.locator('.range-title small').textContent());
await page.getByRole('button',{name:'איפוס התצוגה ↺'}).click();
await page.getByRole('button',{name:'חלון האירוע',exact:true}).click();
const before=await page.locator('.range-title>b').textContent();
await page.getByRole('button',{name:'הזזה קדימה',exact:true}).click();
console.log('Pan',before,'->',await page.locator('.range-title>b').textContent());
console.log('Errors',JSON.stringify(errors));await browser.close();
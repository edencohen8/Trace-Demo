import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const targets={T1:'.lane-bin.alert',T2:'.heat-cells button.alert',T3:'.svg-hit',T4:'.entity-stack.alert',T5:'.state-span.critical',T6:'.chronicle-row button.alert',T7:'.event-tick.alert',T8:'.path-cell button.alert',T9:'.multiple-bars button.alert',T10:'.compare-bars button.alert'};
for(let i=1;i<=10;i++){
 const v='T'+i;
 await page.goto('http://127.0.0.1:5173/?variant='+v,{waitUntil:'networkidle'});
 await page.locator('.timeline-canvas').waitFor();
 await page.locator(targets[v]).first().waitFor();
 await page.screenshot({path:'artifacts/timeline-'+v+'.png',fullPage:true});
 const click=page.locator(targets[v]).first();
 await click.click();
 const detail=await page.locator('.drill-panel,.evidence-panel').count();
 console.log(v,JSON.stringify(await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth,chatRight:document.querySelector('.timeline-chat').getBoundingClientRect().right}))), 'detail panels:',detail);
 if(await page.locator('.record-row').count()){await page.locator('.record-row').first().click();await page.locator('.evidence-panel').waitFor();}
}
await page.goto('http://127.0.0.1:5173/?variant=T1',{waitUntil:'networkidle'});
await page.getByRole('button',{name:'חלון האירוע',exact:true}).click();
await page.locator('.event-tick.alert').first().click();
await page.locator('.evidence-panel').waitFor();
await page.screenshot({path:'artifacts/timeline-drill.png',fullPage:true});
await page.getByRole('button',{name:'בדיקה עם הסוכן ↗'}).click();
await page.locator('.message.assistant').waitFor();
await page.locator('.message.assistant button').first().click();
await page.locator('#observation').fill('תצפית בדיקה זמנית');
await page.getByRole('button',{name:'שמירה למפגש +'}).click();
console.log('Saved observations',await page.locator('.saved-note').count());
await page.getByRole('button',{name:'T10 Window comparison',exact:true}).click();
await page.getByRole('button',{name:'Next timeline',exact:true}).click();
console.log('Wrapped URL',page.url());
await page.setViewportSize({width:1100,height:800});
await page.screenshot({path:'artifacts/timeline-laptop.png',fullPage:true});
console.log('Laptop',await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth})));
console.log('Browser errors',JSON.stringify(errors));
await browser.close();

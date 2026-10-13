import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1512,height:1050}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/?variant=L1',{waitUntil:'networkidle'});
await page.locator('.system-time-rail').first().waitFor();
const audit=await page.evaluate(async()=>{
 const d=await import('/src/prototypes/timelines/data.js');
 const all=d.recordsAll;const stats=d.sources.map(s=>{const list=all.filter(e=>e.source===s.id&&!e.anchor&&e.id.startsWith('SIM'));const gaps=list.slice(1).map((e,i)=>e.t-list[i].t);const mean=gaps.reduce((a,b)=>a+b,0)/gaps.length;return {source:s.id,count:list.length,distinctGaps:new Set(gaps).size,minGap:Math.min(...gaps),maxGap:Math.max(...gaps),cv:Math.sqrt(gaps.reduce((a,b)=>a+(b-mean)**2,0)/gaps.length)/mean}});
 return {count:all.length,stats,uniqueIds:new Set(all.map(e=>e.id)).size,
 noOperatorAction:!all.some(e=>e.source==='operator'&&e.target==='T-041'&&e.t>=d.INCIDENT&&e.t<d.INCIDENT+102),
 missingSensor:!all.some(e=>e.source==='sensor'&&e.t>=d.coverageGap.start&&e.t<d.coverageGap.end),
 incident:all.filter(e=>['EV-106','EV-107','EV-111'].includes(e.id)).map(e=>({id:e.id,t:e.t,end:e.end}))};
});
console.log('Fixture audit',JSON.stringify(audit));
await page.screenshot({path:'artifacts/lens-irregular-L1.png',fullPage:true});
await page.locator('.data-point[data-id="EV-107"]').click({modifiers:['Shift']});
console.log('Selected evidence',await page.locator('.evidence-inspector h2').textContent(),'tags',await page.locator('.draft-tags').textContent());
await page.locator('.overview-interval').first().click();
console.log('Interval',await page.locator('.detail-heading h2').textContent(),'points',await page.locator('.data-point').count());
await page.getByRole('button',{name:'האירוע',exact:true}).click();
for(let i=2;i<=8;i++){
 await page.goto('http://127.0.0.1:5173/?variant=L'+i,{waitUntil:'networkidle'});
 await page.locator('.ruler-tick.major').first().waitFor();
 await page.screenshot({path:'artifacts/lens-irregular-L'+i+'.png',fullPage:true});
 console.log('L'+i,'rails',await page.locator('.system-time-rail').count(),'width',await page.evaluate(()=>document.documentElement.scrollWidth));
}
await page.setViewportSize({width:1100,height:800});
await page.screenshot({path:'artifacts/lens-irregular-laptop.png',fullPage:true});
console.log('Laptop overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
console.log('Browser errors',JSON.stringify(errors));await browser.close();
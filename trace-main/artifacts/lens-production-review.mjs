import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(let i=1;i<=8;i++){
 await page.goto('http://127.0.0.1:4174/?variant=L'+i,{waitUntil:'networkidle'});
 await page.locator('.data-point[data-id="EV-107"]').waitFor();
 await page.locator('.data-point[data-id="EV-107"]').click({modifiers:['Shift']});
 console.log('L'+i,'loaded, draft attachments',await page.locator('.draft-tags>span').count(),'dev switcher',await page.locator('.lens-switcher').count());
}
console.log('Production errors',JSON.stringify(errors));await browser.close();
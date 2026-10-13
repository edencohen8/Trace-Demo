import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1512,height:1050}});
for(let i=1;i<=8;i++){await page.goto('http://127.0.0.1:5173/?variant=L'+i,{waitUntil:'networkidle'});await page.locator('.system-time-rail').first().waitFor();await page.screenshot({path:'artifacts/lens-L'+i+'.png',fullPage:true});}
await browser.close();console.log('Eight final screenshots refreshed');
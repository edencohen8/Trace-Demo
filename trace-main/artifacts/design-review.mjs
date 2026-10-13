import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const variant of ['A','B','C','D','E','F']){
await page.goto('http://127.0.0.1:5173/?variant='+variant,{waitUntil:'networkidle'});
await page.locator('.design-'+variant+' h1,.design-'+variant+' .quiet-heading').first().waitFor();
await page.screenshot({path:'artifacts/design-'+variant+'.png',fullPage:true});
console.log(variant,await page.evaluate(()=>({width:innerWidth,contentWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})));
const selector={A:'.quiet-event',B:'.playback-index button',C:'.map-node',D:'.footnote',E:'.studio-mark',F:'.conversation-sidebar>button'}[variant];
await page.locator(selector).first().click();
console.log(variant,'primary interaction completed');
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'artifacts/design-'+variant+'-mobile.png',fullPage:true});
console.log(variant,'mobile',await page.evaluate(()=>({width:innerWidth,contentWidth:document.documentElement.scrollWidth})));
await page.setViewportSize({width:1440,height:1000});
}
await page.getByRole('button',{name:'Next design',exact:true}).click();
console.log('Switcher URL:',page.url());
console.log('Browser errors:',errors);
await browser.close();
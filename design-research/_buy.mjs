import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:900} });
await p.goto('http://localhost:5173/templates', {waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(1200);
const href = await p.evaluate(()=>document.querySelector('a[href^="/templates/"]')?.getAttribute('href'));
console.log('template:', href);
for (const url of [href]) {
  if (!url) continue;
  await p.goto('http://localhost:5173'+url, {waitUntil:'networkidle',timeout:30000});
  await p.waitForTimeout(1500);
  const r = await p.evaluate(()=>({
    pageHeight: document.documentElement.scrollHeight,
    viewports: +(document.documentElement.scrollHeight/900).toFixed(1),
    h2s: [...document.querySelectorAll('h2,h3')].map(h=>h.textContent.trim().slice(0,34)),
  }));
  console.log(JSON.stringify(r,null,1));
}
await b.close();

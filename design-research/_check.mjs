import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,120)); });
p.on('pageerror', e => errs.push('PAGEERROR '+e.message.slice(0,120)));
for (const route of ['/courses','/templates','/packs','/questions','/']) {
  errs.length = 0;
  await p.goto('http://localhost:5173'+route, { waitUntil:'networkidle', timeout:30000 }).catch(e=>console.log('NAV',route,e.message.slice(0,50)));
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const h1 = document.querySelector('h1');
    const grid = document.querySelector('div[class*="grid-cols"][class*="bg-border"]');
    let slab = null;
    if (grid) {
      const cs = getComputedStyle(grid);
      const gb = grid.getBoundingClientRect();
      const kids = [...grid.children];
      const filled = kids.reduce((a,k)=>a+k.getBoundingClientRect().height*k.getBoundingClientRect().width,0);
      slab = { cells: kids.length, gap: cs.gap, gridArea: Math.round(gb.width*gb.height), filledArea: Math.round(filled) };
    }
    return { h1: h1?.textContent?.trim().slice(0,32), h1px: h1?getComputedStyle(h1).fontSize:null, slab };
  });
  console.log(route.padEnd(12), JSON.stringify(r), errs.length?(' ERR:'+errs[0]):'');
}
await b.close();

import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:900} });
await p.goto('http://localhost:5173/templates',{waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(1000);
const href = await p.evaluate(()=>document.querySelector('a[href^="/templates/"]')?.getAttribute('href'));
await p.goto('http://localhost:5173'+href,{waitUntil:'networkidle',timeout:30000});
await p.waitForTimeout(1500);
const r = await p.evaluate(()=>{
  const main = document.querySelector('#main') || document.body;
  const out=[];
  const walk=(el,d)=>{ for(const c of el.children){
    const b=c.getBoundingClientRect();
    if(b.height>180 && d<4) out.push({d,tag:c.tagName.toLowerCase(),h:Math.round(b.height),cls:(c.className+'').slice(0,60)});
    if(d<3) walk(c,d+1);
  }};
  walk(main,0);
  return { total: document.documentElement.scrollHeight, blocks: out.slice(0,22) };
});
console.log('TOTAL', r.total);
for(const x of r.blocks) console.log(' '.repeat(x.d*2), x.h+'px', x.tag, x.cls);
await b.close();

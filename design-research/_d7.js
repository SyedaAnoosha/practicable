const { chromium } = require('playwright')
;(async()=>{const b=await chromium.launch();const p=await(await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})).newPage()
await p.goto('http://localhost:5173/courses/risk-register-fundamentals',{waitUntil:'networkidle'});await p.waitForTimeout(1500)
const r=await p.evaluate(()=>{
  const secs=[...document.querySelectorAll('section')].map(s=>s.querySelector('h2,h3')?.textContent?.trim()).filter(Boolean)
  const buyLinks=[...document.querySelectorAll('a[href^="/buy/"]')].map(a=>a.getAttribute('href'))
  return {sections:secs, buyLinks:[...new Set(buyLinks)], txt:document.body.innerText.includes('Also available')}
})
console.log(JSON.stringify(r,null,1)); await b.close()})()

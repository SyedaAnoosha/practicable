const { chromium } = require('playwright')
const B='http://localhost:5173'
;(async()=>{
  const br=await chromium.launch()
  const ctx=await br.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
  const p=await ctx.newPage()
  const errs=[]
  p.on('pageerror',e=>errs.push(e.message))
  const qs=await (await fetch('http://localhost:8000/questions/index')).json()
  const go=async u=>{errs.length=0;await p.goto(B+u,{waitUntil:'networkidle'});await p.waitForTimeout(1200)}
  const R=[]
  const chk=(id,label,pass,detail='')=>R.push({id,label,pass,detail})

  // ---- J5 skip link (claimed P0) ----
  await go('/')
  const skip=await p.evaluate(()=>{
    const a=document.querySelector('a[href^="#"]')
    if(!a) return null
    return {txt:a.textContent.trim(), first: document.body.querySelectorAll('a,button,input')[0]===a}
  })
  chk('J5','Skip link is first focusable', !!skip && skip.first, skip?JSON.stringify(skip):'ABSENT')

  // ---- J4 one h1 per page ----
  for(const [n,u] of [['home','/'],['questions','/questions'],['question','/questions/'+qs[0].slug],['courses','/courses']]){
    await go(u)
    const h=await p.evaluate(()=>({n:document.querySelectorAll('h1').length,
      order:[...document.querySelectorAll('h1,h2,h3,h4')].map(e=>+e.tagName[1])}))
    let skips=0; for(let i=1;i<h.order.length;i++) if(h.order[i]-h.order[i-1]>1) skips++
    chk('J4/'+n, `one h1 (${h.n}), no heading skips (${skips})`, h.n===1&&skips===0, `h1=${h.n} skips=${skips}`)
  }

  // ---- A2 live result count + two zones ----
  await go('/questions')
  const a2=await p.evaluate(()=>{
    const t=document.body.innerText
    const live=[...document.querySelectorAll('[aria-live]')].map(e=>e.textContent.trim()).filter(Boolean)
    return {live, hasExact:/exact/i.test(t), hasClose:/close/i.test(t)}
  })
  chk('A2','Live result count present', a2.live.length>0, JSON.stringify(a2.live).slice(0,120))

  // ---- A4 zero-result recovery ----
  await go('/questions?duration=XS&cost=%24%24%24&regulator_pressure=H&tier=A')
  const a4=await p.evaluate(()=>{
    const t=document.body.innerText
    return {zero:/no questions|nothing (fits|match)/i.test(t), relax:/relax|clear all|remove a filter|widen/i.test(t), sample:t.slice(0,10)}
  })
  chk('A4','Zero-result offers recovery', a4.zero? a4.relax : true, a4.zero?('zeroState relax='+a4.relax):'no zero state hit')

  // ---- B1 serif editorial headline ----
  await go('/questions/'+qs[0].slug)
  const b1=await p.evaluate(()=>{const h=document.querySelector('h1');const c=getComputedStyle(h);
    return {size:parseFloat(c.fontSize),fam:c.fontFamily.split(',')[0].replace(/"/g,'')}})
  chk('B1','Serif editorial headline >=40px', b1.size>=40 && /Newsreader/.test(b1.fam), `${b1.size}px ${b1.fam}`)

  // ---- D3 VersionStamp / evidence on a product page ----
  await go('/courses/risk-register-fundamentals')
  const d=await p.evaluate(()=>{const t=document.body.innerText;return{
    fact:/modules/i.test(t)&&/lesson/i.test(t), sticky:!!document.querySelector('.sticky,[class*="sticky"]'),
    related:/related|you might also/i.test(t)}})
  chk('D1','FactStrip on course detail', d.fact, '')
  chk('D6','Sticky buy card', d.sticky, '')
  chk('D7','Related products rail', d.related, '')

  // ---- E2 cmdK visible affordance ----
  await go('/')
  const e2=await p.evaluate(()=>{const t=document.body.innerText;return /⌘K|Ctrl\+K|Search/i.test(t)})
  chk('E2','Command palette affordance visible', e2, '')

  // ---- console errors across routes ----
  let allErrs=[]
  for(const u of ['/','/questions','/courses','/templates','/packs','/store','/questions/'+qs[0].slug,'/legal/privacy']){
    await go(u); if(errs.length) allErrs.push(u+': '+errs[0].slice(0,60))
  }
  chk('ERR','No console errors on 8 routes', allErrs.length===0, allErrs.join(' | '))

  console.log('\n  ID          RESULT  CHECK')
  for(const r of R) console.log(`  ${r.id.padEnd(11)} ${(r.pass?'PASS':'**FAIL')} ${r.label}${r.detail?'  ['+r.detail+']':''}`)
  console.log(`\n  ${R.filter(r=>r.pass).length}/${R.length} passing`)
  await br.close()
})()

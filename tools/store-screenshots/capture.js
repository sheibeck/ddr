const { chromium } = require('playwright-core');
const fs = require('fs');
const { startRun, snapshot, stepToward } = require('./bot.js');
const SIZES = { phone: [432, 768, 2.5], tab7: [675, 1200, 2], tab10: [810, 1440, 2] }; // all exact 9:16
const PRIORITY = ['FIGHT IT OUT','1 · STRIKE','TAKE ALL','TAKE','EQUIP NOW','STOW','GO DOWN','DESCEND','TAKE THEM ALONG','WELCOME','ACCEPT','YES','MOVE ON','CONTINUE','OK','DONE','CLOSE','LEAVE','CONFIRM','BURY THEM'];
const NAV = /^mw-chip|^btn-camp|^mw-gear-btn|^mw-hud-menu|^mw-tab|^mw-cond/;
const bodyText = (page, n=500) => page.evaluate((n)=>document.body.innerText.replace(/\s*\n\s*/g,' / ').slice(0,n), n);
const clickTab = (page, t) => page.evaluate((t)=>[...document.querySelectorAll('button.mw-tab')].find(b=>b.innerText.trim()===t).click(), t);
const clickLabel = (page, lab) => page.evaluate((lab)=>{const norm=b=>b.innerText.trim().replace(/\s+/g,' ').slice(0,28); const b=[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&!b.disabled).find(b=>norm(b)===lab); if(!b) return false; b.click(); return true;}, lab);
const stateJSON = (page) => page.evaluate(()=>JSON.stringify(window.__mzState.get()));
const waitRoller = (page) => page.waitForFunction(() => { const b=document.getElementById('mw-roller-cta'); return b && !b.disabled && !/STILL FALLING/i.test(b.innerText); }, null, { timeout: 30000 });
const scenes = {}; // name -> { state, tab }
const want = (name) => !scenes[name];

async function backToTitle(page) {
  for (let k=0;k<6;k++){ const t=await bodyText(page,300); if (/ENTER/.test(t) && !/BURY/.test(t)) break; await clickLabel(page,'BURY THEM') || await clickLabel(page,'REVIEW THE ORACLE'); await page.waitForTimeout(400); }
}

async function playUntilDeath(page, maxIters=1500, stopAtSteps=Infinity) {
  let visited=[], lastFloor=null, lastSteps=-1, stepStall=0, lastSig=null, sigCount=0, prev=null;
  for (let i=0;i<maxIters;i++){
    const s = await snapshot(page);
    if (s.floor!==lastFloor){ visited=[]; lastFloor=s.floor; }
    const nonNav = s.btns.filter(b=>!NAV.test(b));
    const labels = nonNav.map(b=>b.split(':').slice(1).join(':').toUpperCase());
    if (s.dead) { if (want('death')) scenes.death = { state: await stateJSON(page) }; console.log('DEAD floor', s.floor, 'steps', s.steps); return s; }
    if (s.steps>=stopAtSteps && !s.blocked && !nonNav.length && !s.joiner && !s.find) return s;
    if (s.joiner && !nonNav.length) {
      if (want('joiner')) scenes.joiner = { state: await stateJSON(page), tab: 'HERO' };
      await clickTab(page,'HERO'); await page.waitForTimeout(350);
      (await clickLabel(page,'TAKE THEM ALONG')) || (await clickLabel(page,'LEAVE THEM'));
      await page.waitForTimeout(300); await clickTab(page,'MAP'); await page.waitForTimeout(320); continue;
    }
    if (s.blocked || nonNav.length || s.find || s.railPending) {
      const sig = nonNav.join('|'); if (sig===lastSig) { if (++sigCount>40) { console.log('STALL', sig); return s; } } else { lastSig=sig; sigCount=0; }
      if (!nonNav.length) { console.log('STUCK no buttons', JSON.stringify(s)); return s; }
      if (s.combat && labels.some(l=>l.startsWith('FIGHT IT OUT'))) { const st = await stateJSON(page); if (want('encounter')) scenes.encounter = { state: st }; const S=JSON.parse(st); if (want('encounterPre') && prev && S.combat && S.combat.foes && S.combat.foes.length>=2) { scenes.encounterPre = { state: prev.state, dir: prev.dir }; console.log('encounterPre captured, foes', S.combat.foes.length); } }
      if (s.combat && labels.some(l=>l.startsWith('1 · STRIKE')) && want('combat')) { const S = JSON.parse(await stateJSON(page)); if (S.combat && S.combat.foes && S.combat.foes.length>=2 && S.combat.round>=2) scenes.combat = { state: JSON.stringify(S) }; }
      if (s.loot && want('loot')) scenes.loot = { state: await stateJSON(page) };
      if (s.find && want('find')) scenes.find = { state: await stateJSON(page) };
      if (s.store) { if (want('store')) scenes.store = { state: await stateJSON(page) }; await page.waitForTimeout(500); await clickLabel(page,'LEAVE'); await page.waitForTimeout(400); continue; }
      let idx=-1; for (const p of PRIORITY){ idx = labels.findIndex(l=>l===p || l.startsWith(p)); if(idx>=0) break; }
      if (idx<0) idx = nonNav.findIndex(b=>b.startsWith('mw-major-primary')); if (idx<0) idx=0;
      const lab = nonNav[idx].split(':').slice(1).join(':');
      if (!(await clickLabel(page, lab))) { console.log('CLICK FAIL', nonNav[idx]); return s; }
      await page.waitForTimeout(250); continue;
    }
    if (s.steps===lastSteps) { if (++stepStall>40) { console.log('MOVE STALL'); return s; } } else { lastSteps=s.steps; stepStall=0; }
    visited.push(s.pos.join(','));
    const pre = await stateJSON(page); const r = await stepToward(page, visited); if (!r) { console.log('no target'); return s; } prev = { state: pre, dir: r.dir };
    await page.waitForTimeout(50);
  }
  return await snapshot(page);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let graveyard, best;
  if (process.argv[2]==='--replay') { const j=JSON.parse(fs.readFileSync('scenes.json','utf8')); Object.assign(scenes, j.scenes); graveyard=j.graveyard; best=j.best; } else {
  const [w,h,dpr] = SIZES.phone;
  let ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
  let page = await ctx.newPage();
  await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  // Phase A: real runs until we have the scenes + at least 3 graves
  let graves=0;
  for (let run=1; run<=9 && (graves<5 || !scenes.combat || !scenes.loot || !scenes.find); run++) {
    await startRun(page);
    const s = await playUntilDeath(page);
    if (s.dead) graves++;
    await backToTitle(page);
    if (!s.dead) { await page.evaluate(()=>localStorage.removeItem('ddr.delve.v1')); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1000); }
    console.log('run', run, 'scenes so far:', Object.keys(scenes).join(','), 'graves', graves);
  }
  graveyard = await page.evaluate(()=>localStorage.getItem('ddr.graveyard.v1'));
  best = await page.evaluate(()=>localStorage.getItem('ddr.best.v1'));
  // deep floor map: dev start at depth 4, explore ~45 squares, keep alive
  for (let tries=0; tries<6 && !scenes.deep; tries++) {
    await startRun(page); await page.evaluate(()=>window.mzDevStartAtDepth(2)); await page.waitForTimeout(600);
    const s = await playUntilDeath(page, 900, 90);
    if (!s.dead) { const S = JSON.parse(await stateJSON(page)); const seen=[]; S.floor.g.forEach((row,y)=>row.forEach((c,x)=>{ if(c.seen && !c.wall) seen.push([x,y]); })); const cx=seen.reduce((a,p)=>a+p[0],0)/seen.length, cy=seen.reduce((a,p)=>a+p[1],0)/seen.length; let best=null,bd=1e9; for(const [x,y] of seen){ const d=(x-cx)**2+(y-cy)**2; if(d<bd){bd=d;best=[x,y];} } S.floor.px=best[0]; S.floor.py=best[1]; console.log('deep: seen',seen.length,'party moved to',best); scenes.deep = { state: JSON.stringify(S) }; }
    else { await backToTitle(page); await page.evaluate(()=>localStorage.removeItem('ddr.delve.v1')); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1000); }
  }
  fs.writeFileSync('scenes.json', JSON.stringify({ scenes, graveyard, best }));
  console.log('SCENES', Object.keys(scenes).join(','));
  await ctx.close();
  }

  // Phase B: replay every scene at every size
  const ORDER = [['title',null],['deep','MAP'],['encounter',null],['combat',null],['loot',null],['find',null],['joiner','HERO'],['hero','HERO'],['gear','GEAR'],['oracle','ORACLE'],['store',null],['death',null],['dead','DEAD']];
  for (const [size,[w,h,dpr]] of Object.entries(SIZES)) {
    fs.mkdirSync(`out/${size}`, { recursive: true });
    let n=0;
    for (const [name, tab] of ORDER) {
      const sc = (name==='combat' ? scenes.encounterPre : scenes[name]) || (['hero','gear','oracle','dead'].includes(name) ? (scenes.deep || scenes.loot || scenes.find) : null);
      if (name!=='title' && !sc) { console.log('skip', name); continue; }
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
      const seed = (name==='combat' && sc) ? sc.state : null;
      await ctx.addInitScript(({g,b,st})=>{ try { if(g) localStorage.setItem('ddr.graveyard.v1', g); if(b) localStorage.setItem('ddr.best.v1', b); if(st) localStorage.setItem('ddr.delve.v1', st); else localStorage.removeItem('ddr.delve.v1'); } catch(e){} }, { g: graveyard, b: best, st: seed });
      const page = await ctx.newPage();
      await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
      if (name!=='title') {
        await page.click('text=ENTER'); await page.waitForTimeout(700);
        if (name!=='combat') { // roll a victim, then inject the scene state directly (resume strips in-flight encounters)
          await waitRoller(page); await page.click('#mw-roller-cta'); await page.waitForTimeout(500);
          await page.evaluate((st)=>{ window.__mzState.set(JSON.parse(st)); window.paint(); window.draw(); window.renderEncounter(); window.renderRail?.(); }, sc.state); await page.waitForTimeout(400);
        }
        if (name==='combat') { await page.waitForTimeout(600); await page.evaluate((d)=>window.move(d), sc.dir); await page.waitForTimeout(600); const clickPrefix=(p)=>page.evaluate((p)=>{const b=[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&!b.disabled).find(b=>b.innerText.trim().replace(/s+/g,' ').toUpperCase().startsWith(p)); if(!b) return false; b.click(); return true;}, p); await page.waitForTimeout(500); await clickPrefix('FIGHT IT OUT'); await page.waitForTimeout(600); for (let r=0;r<2;r++){ const inCombat = await page.evaluate(()=>!!window.__mzState.get().combat); if(!inCombat) break; await clickPrefix('1 · STRIKE'); await page.waitForTimeout(700); } await page.waitForTimeout(300); }
        if (tab && tab!=='MAP') { await clickTab(page, tab); await page.waitForTimeout(500); }
        if (tab==='MAP') { await page.evaluate(()=>window.mzCenterMap?.()); await page.waitForTimeout(300); }
      }
      n++; const f=`out/${size}/${String(n).padStart(2,'0')}-${name}.png`;
      await page.screenshot({ path: f }); console.log(size, f, (await bodyText(page,140)));
      await ctx.close();
    }
  }
  await browser.close();
})();

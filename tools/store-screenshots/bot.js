// shared helpers: start a run, walk toward interesting tiles, report overlays
const startRun = async (page) => {
  await page.click('text=ENTER');
  await page.waitForFunction(() => { const b=document.getElementById('mw-roller-cta'); return b && !b.disabled && !/STILL FALLING/i.test(b.innerText); }, null, { timeout: 30000 });
  await page.click('#mw-roller-cta'); await page.waitForTimeout(800);
};
const snapshot = (page) => page.evaluate(() => {
  const S = window.__mzState.get();
  const btns=[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null && !b.disabled).map(b=>(b.id||b.className.split(' ')[0])+':'+b.innerText.trim().replace(/\s+/g,' ').slice(0,28));
  const blocked = !!(S.dead||S.combat||S.store||(S.pendingLoot&&S.pendingLoot.length)||(S.beats&&S.beats.groups&&S.beats.groups.length)||window.__mzStair);
  const rail = !!(window.__mzRail && window.__mzRail.card);
  return { floor:S.floor.depth, pos:[S.floor.px,S.floor.py], steps:S.steps, hp:S.c.wp+'/'+S.c.maxWP, dead:S.dead, combat:!!S.combat, store:!!S.store, loot:!!(S.pendingLoot&&S.pendingLoot.length), beats:!!(S.beats&&S.beats.groups&&S.beats.groups.length), stair:!!window.__mzStair, find:!!S.pendingFind, joiner:!!S.pendingJoiner, railPending:!!(window.__mzRail&&window.__mzRail.pending), rail, blocked, btns };
});
// one step toward nearest unvisited feature tile (or unseen cell)
const stepToward = (page, visited) => page.evaluate((visited) => {
  const S = window.__mzState.get(); const g=S.floor.g; const H=g.length, W=g[0].length;
  const sx=S.floor.px, sy=S.floor.py;
  const prev = g.map(r=>r.map(()=>null)); const d=g.map(r=>r.map(()=>-1)); d[sy][sx]=0;
  const q=[[sx,sy]]; let target=null; let fallback=null; let exitCell=null;
  const D={N:[0,-1],S:[0,1],W:[-1,0],E:[1,0]};
  while(q.length){ const [x,y]=q.shift();
    const key=x+','+y;
    if(!(x===sx&&y===sy)){ if(g[y][x].feat && g[y][x].feat!=='one' && g[y][x].feat!=='exit' && !visited.includes(key)){ target=[x,y]; break; } if(g[y][x].feat==='exit' && !exitCell) exitCell=[x,y]; if(!fallback && !visited.includes(key)) fallback=[x,y]; }
    for(const k of Object.keys(D)){ const nx=x+D[k][0], ny=y+D[k][1]; if(nx<0||ny<0||nx>=W||ny>=H) continue; if(g[ny][nx].wall||d[ny][nx]!==-1) continue; const here=g[y][x], there=g[ny][nx]; if(there.feat==='one' && there.dir!==k) continue; if(here.feat==='one' && here.dir!==k) continue; d[ny][nx]=d[y][x]+1; prev[ny][nx]=[x,y,k]; q.push([nx,ny]); }
  }
  const t = target||fallback||exitCell; if(!t) return null;
  let [x,y]=t; let dir=null; while(prev[y][x]){ const [px,py,k]=prev[y][x]; dir=k; if(px===sx&&py===sy) break; x=px; y=py; }
  window.move(dir); return { dir, target:t, feat: g[t[1]][t[0]].feat };
}, visited);
module.exports = { startRun, snapshot, stepToward };

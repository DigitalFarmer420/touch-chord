// v112.10 Kids gold always wins: Kids, Full mode, Octave layout, Twinkle (Play along on). A hand-pressed pad whose chord
// reaches past the 13 keys (C: G A B pads; G: D E F# pads) must not slide the gold melody key off the keys: the gold key
// stays visible at every probe up to 2.6 s after the tap, the window never moves, every sounding note on the keys lights
// and nothing else lights (notes past the window sound dark), and a tap on the gold key right after a pad plays the
// melody note only (Noff v112.9 M1 / k111 stale probe). 360x780 + 780x360 (phone emulation via -r emulate.cjs).
// node -r ./emulate.cjs kidsgold.cjs [WxH]   env BASE, OUT, SHOTS, EXPECT_FIX=0 to record without failing.
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || process.env.BASE || 'http://localhost:8080/index.html';
const OUT = process.env.OUT || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const SHOTS = process.env.KG_SHOTS || ''; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const EXPECT = process.env.EXPECT_FIX !== '0';
const SIZES = process.argv[2] ? [process.argv[2].split('x').map(Number)] : [[360, 780], [780, 360]];
const NN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']; const w12 = n => ((n % 12) + 12) % 12;
const CASES = [[0, [7, 9, 11]], [7, [2, 4, 6]]];   // key pc, pad roots (pc) whose chord runs past the window
const PROBES = [40, 300, 800, 1300, 1800, 2300, 2600];
const R = { fails: [], data: {} }; const F = (c, m) => { if (!c) R.fails.push(m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function open(b, w, h) {
  const s = { style: 'kids', simple: false, layout: 'octave', playAlong: true, lockKey: { pc: 0, mode: 'major' } };
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:${JSON.stringify(s)}}));}}catch(e){}`);
  const p = await ctx.newPage(); p.__errs = [];
  p.on('pageerror', e => p.__errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') p.__errs.push(m.text()); });
  await p.goto(URL + '?test=1'); await p.waitForTimeout(1200);
  await p.evaluate(() => { const A = window.ChordAudio; window.__L = []; const pc = A.playChord.bind(A);
    A.playChord = function (g, m, o) { window.__L.push({ g, m: (m || []).slice().sort((a, b) => a - b) }); return pc(g, m, o); }; });
  return p;
}
const take = p => p.evaluate(() => { const l = window.__L; window.__L = []; return l; });
const st = p => p.evaluate(() => { const ps = [...document.querySelectorAll('#pads .pad')].filter(e => e.getClientRects().length); const ms = ps.map(e => +e.dataset.midi);
  const pads = [...document.querySelectorAll('#suggest .ss-kidpad')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(), it = e._tc && e._tc.item; return { t: e.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2, rootPc: it ? it.rootPc : null, gold: e.classList.contains('nx-root') }; });
  const gk = ps.find(e => e.classList.contains('nx-root')); let g = null; if (gk) { const q = gk.getBoundingClientRect(); g = { m: +gk.dataset.midi, x: q.x + q.width / 2, y: q.y + q.height * 0.88 }; }
  return { lo: ms.length ? Math.min(...ms) : null, hi: ms.length ? Math.max(...ms) : null, lit: ps.filter(e => e.classList.contains('selected')).map(e => +e.dataset.midi).sort((a, b) => a - b), gold: g, pads, cur: window.__prog ? __prog.cur : null }; });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of SIZES) { const tag = `${w}x${h}`;
    const p = await open(b, w, h); const cdp = await p.context().newCDPSession(p);
    const press = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await p.waitForTimeout(120); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    for (const [kpc, roots] of CASES) {
      await p.evaluate(pc => window.__setKey(pc, 'major'), kpc); await p.waitForTimeout(3200);
      const s0 = await st(p); F(s0.gold, `${tag} ${NN[kpc]}: no gold key at rest`); if (!s0.gold) continue;
      for (const rpc of roots) { const k = `${tag} ${NN[kpc]} pad ${NN[rpc]}`;
        const a = await st(p); const pad = a.pads.find(x => x.rootPc === rpc); F(pad, `${k}: pad not found`); if (!pad) continue;
        F(!pad.gold, `${k}: the pad is the gold pad (case invalid)`);
        await take(p); await press(pad.x, pad.y); const t0 = Date.now(); const rows = []; let shot = false;
        for (const ms of PROBES) { const wt = ms - (Date.now() - t0); if (wt > 0) await p.waitForTimeout(wt); const s = await st(p); rows.push({ t: Date.now() - t0, win: [s.lo, s.hi], gold: s.gold && s.gold.m, lit: s.lit });
          F(s.gold && s.gold.m === a.gold.m, `${k} @${ms}ms: gold key ${a.gold.m} not on the keys (window ${s.lo}..${s.hi}, gold ${s.gold && s.gold.m})`);
          F(s.lo === a.lo, `${k} @${ms}ms: window moved ${a.lo} -> ${s.lo}`);
          if (!shot && SHOTS && ms >= 300) { await p.screenshot({ path: path.join(SHOTS, `${w}x${h}-octave-${NN[kpc].replace('#', 's')}-pad${NN[rpc].replace('#', 's')}.png`) }); shot = true; } }
        const L = await take(p); const e = L.find(x => !/^live-/.test(x.g)) || L[0] || {}; const m = e.m || [];
        const lit0 = rows[1].lit, vis = m.filter(x => x >= a.lo && x <= a.hi);
        F(m.length && w12(m[0]) === rpc && m.every((x, i) => !i || x > m[i - 1]), `${k}: pad chord not root position ${m}`);
        F(same(lit0, vis), `${k}: lit ${lit0} != sounded on the keys ${vis} (sounded ${m})`);
        R.data[k] = { sounded: m, win0: [a.lo, a.hi], gold0: a.gold.m, rows };
      }
      // stale probe: a pad, then straight away the gold key: plays the melody note only (not a chord) and advances
      const a = await st(p); const pad = a.pads.find(x => x.rootPc === roots[roots.length - 1]);
      if (pad && a.gold) { await press(pad.x, pad.y); await p.waitForTimeout(250); const s = await st(p); await take(p);
        const g = s.gold || a.gold; await press(g.x, g.y); await p.waitForTimeout(300); const L = await take(p); const s2 = await st(p);
        const e = L.find(x => !/^live-/.test(x.g)) || L[0] || {}; R.data[`${tag} ${NN[kpc]} stale`] = { goldBefore: a.gold.m, goldAfterPad: s.gold && s.gold.m, played: e.m, cur0: s.cur, cur: s2.cur };
        F(s.gold && s.gold.m === a.gold.m, `${tag} ${NN[kpc]} stale: gold gone after pad`);
        F(same(e.m || [], [a.gold.m]), `${tag} ${NN[kpc]} stale: tap on the gold key played ${e.m} not ${a.gold.m}`);
        F(s2.cur !== s.cur, `${tag} ${NN[kpc]} stale: gold key tap did not advance`); }
    }
    F(!p.__errs.length, `${tag} errors ${p.__errs}`); await p.context().close(); }
  await b.close();
  const name = 'kidsgold' + (process.argv[2] ? '-' + process.argv[2] : '') + '.json';
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(R, null, 1));
  console.log(`kidsgold: ${Object.keys(R.data).length} states, fails ${R.fails.length}`); R.fails.slice(0, 40).forEach(f => console.log('  FAIL ' + f));
  process.exit(EXPECT && R.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

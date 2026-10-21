// v112.9 Kids ascend: every Kids pad in root position (root lowest), the pads' lowest notes rising strictly in reading
// order (row by row, left to right), lit = sounded on the keys, in all 12 major keys x Kids Octave / Full / Simple x
// 360x780 + 780x360 (phone emulation via -r emulate.cjs); the Octave window back at its rest position after the last pad;
// Twinkle gold pad / gold key taps still advance the melody. Pop/Jazz untouched (kbaccept / kbfix cover them).
// node -r ./emulate.cjs kidsascend.cjs [WxH]   env BASE, OUT, EXPECT_FIX=0 to record without failing, ONLY_TW=1 Twinkle only.
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || process.env.BASE || 'http://localhost:8080/index.html';
const OUT = process.env.OUT || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const EXPECT = process.env.EXPECT_FIX !== '0';
const SIZES = process.argv[2] ? [process.argv[2].split('x').map(Number)] : [[360, 780], [780, 360]];
const NN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']; const w12 = n => ((n % 12) + 12) % 12;
const CFG = [['octave', { simple: false, layout: 'octave' }], ['full', { simple: false, layout: 'full' }], ['simple', { simple: true, layout: 'octave' }]];
const R = { fails: [], data: {} }; const F = (c, m) => { if (!c) R.fails.push(m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function open(b, w, h, s) {
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
const pads = p => p.evaluate(() => { const bs = [...document.querySelectorAll('#suggest .ss-kidpad')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(), it = e._tc && e._tc.item; return { t: e.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2, top: Math.round(r.top), rootPc: it && it.rootPc }; });
  return bs.sort((a, b) => Math.abs(a.top - b.top) > 4 ? a.top - b.top : a.x - b.x); });
const keys = p => p.evaluate(() => { const ps = [...document.querySelectorAll('#pads .pad')].filter(e => e.getClientRects().length); const ms = ps.map(e => +e.dataset.midi);
  return { n: ps.length, lo: ms.length ? Math.min(...ms) : null, hi: ms.length ? Math.max(...ms) : null, lit: ps.filter(e => e.classList.contains('selected')).map(e => +e.dataset.midi).sort((a, b) => a - b) }; });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of SIZES) for (const [cn, cs] of (process.env.ONLY_TW ? [] : CFG)) {
    const tag = `${w}x${h} kids-${cn}`;
    const p = await open(b, w, h, Object.assign({ style: 'kids', playAlong: false, lockKey: { pc: 0, mode: 'major' } }, cs));
    for (let pc = 0; pc < 12; pc++) {
      await p.evaluate(pc => window.__setKey(pc, 'major'), pc); await p.waitForTimeout(350);
      const rest = (await keys(p)).lo; const P = await pads(p); const rows = [];
      F(P.length === 7, `${tag} ${NN[pc]}: ${P.length} pads`);
      for (const c of P) {
        await take(p); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(260);
        const L = await take(p); const e = L.find(x => !/^live-/.test(x.g)) || L[0] || {}; const m = e.m || []; const k = await keys(p);
        rows.push({ pad: c.t, rootPc: c.rootPc, m, lit: k.lit, win: [k.lo, k.hi] });
        F(m.length && w12(m[0]) === w12(c.rootPc), `${tag} ${NN[pc]} pad ${c.t}: root ${NN[w12(c.rootPc)]} not lowest ${m}`);
        F(m.every((x, i) => !i || x > m[i - 1]), `${tag} ${NN[pc]} pad ${c.t}: not ascending ${m}`);
        F(!m.length || m[m.length - 1] - m[0] < 12, `${tag} ${NN[pc]} pad ${c.t}: not close position ${m}`);
        if (k.n) F(same(k.lit, m), `${tag} ${NN[pc]} pad ${c.t}: lit ${k.lit} != sounded ${m} (keys ${k.lo}..${k.hi})`);
        await p.waitForTimeout(120);
      }
      const lows = rows.map(r => r.m[0]); F(lows.every((x, i) => !i || x > lows[i - 1]), `${tag} ${NN[pc]}: pad lows not rising in reading order ${rows.map(r => r.pad + '=' + r.m[0]).join(' ')}`);
      R.data[`${tag} ${NN[pc]}`] = rows;
      if (rest != null && cn === 'octave') {   // the window goes back to the Kids rest position after the last pad's preview + KB_RESET_MS
        const t0 = Date.now(); let back = null; while (Date.now() - t0 < 4000) { if ((await keys(p)).lo === rest) { back = Date.now() - t0; break; } await p.waitForTimeout(100); }
        F(back != null, `${tag} ${NN[pc]}: window not back at ${rest} within 4 s of the last pad`); R.data[`${tag} ${NN[pc]} back`] = back; }
    }
    F(!p.__errs.length, `${tag} errors ${p.__errs}`); await p.context().close();
  }
  // Twinkle (Kids default song, C, Octave, Play along on): gold pad taps and gold key taps still advance the melody; the gold key comes back on the keys
  for (const [w, h] of SIZES) { const tag = `${w}x${h} twinkle`; const p = await open(b, w, h, { style: 'kids', simple: false, layout: 'octave', playAlong: true, lockKey: { pc: 0, mode: 'major' } });
    const cdp = await p.context().newCDPSession(p); const press = async (x, y) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await p.waitForTimeout(200); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    const st = () => p.evaluate(() => ({ cur: window.__prog ? __prog.cur : null, goldKey: [...document.querySelectorAll('#pads .pad.nx-root')].filter(e => e.getClientRects().length).map(e => +e.dataset.midi), goldPad: [...document.querySelectorAll('#suggest .ss-kidpad.nx-root')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 }; })[0] || null }));
    const T = R.data[tag] = []; let s0 = await st();
    for (let i = 0; i < 6; i++) { const gp = s0.goldPad; if (!gp) { F(false, `${tag} no gold pad at step ${i}`); break; }
      await press(gp.x, gp.y); await p.waitForTimeout(400); const s1 = await st(); T.push({ via: 'pad', pad: gp.t, cur0: s0.cur, cur: s1.cur });
      F(s1.cur !== s0.cur, `${tag} gold pad ${gp.t} did not advance (cur ${s0.cur})`);
      const t0 = Date.now(); let s2 = s1; while (Date.now() - t0 < 4000 && !s2.goldKey.length) { await p.waitForTimeout(100); s2 = await st(); } F(s2.goldKey.length, `${tag} gold key not on the keys 4 s after pad ${gp.t}`); s0 = await st(); }
    for (let i = 0; i < 4; i++) { const g = await p.evaluate(() => { const k = [...document.querySelectorAll('#pads .pad.nx-root')].find(e => e.getClientRects().length); if (!k) return null; const q = k.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height * 0.88, m: +k.dataset.midi }; });
      if (!g) { F(false, `${tag} no gold key at key step ${i}`); break; } const c0 = (await st()).cur; await press(g.x, g.y); await p.waitForTimeout(400); const c1 = (await st()).cur;
      T.push({ via: 'key', key: g.m, cur0: c0, cur: c1 }); F(c1 !== c0, `${tag} gold key ${g.m} did not advance (cur ${c0})`); }
    F(!p.__errs.length, `${tag} errors ${p.__errs}`); await p.context().close(); }
  await b.close();
  const name = 'kidsascend' + (process.argv[2] ? '-' + process.argv[2] : '') + '.json';
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(R, null, 1));
  console.log(`kidsascend: ${Object.keys(R.data).length} key states, fails ${R.fails.length}`); R.fails.slice(0, 40).forEach(f => console.log('  FAIL ' + f));
  process.exit(EXPECT && R.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

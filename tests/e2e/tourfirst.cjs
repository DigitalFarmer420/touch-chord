// v3.2 test.5: the first-launch tour on a real fresh install. A first visit opens the Kids view (expert false), and the
// boot used to start the tour only when expert !== false, so it never ran. Checks, at each size:
//  A fresh install (?test=1&kv=1 = a real first visit; tour=1 lets the auto-start run under ?test=1): the Kids tour opens
//    by itself once, on Twinkle's play screen, in Kids; Done saves touchChord.tour.v1 = "done"; a reload opens no tour.
//  B Skip on step 1 also saves it; a reload opens no tour.
//  C closed mid-tour (no Done/Skip): the settings were saved, so the next launch is not a first visit and opens no tour.
//  D an existing user (saved settings, tour seen) and E saved settings without the tour key (older installs): no tour.
//  F tour seen but no settings (a Factory reset keeps the tour key): no tour.
//  G a fresh ?test=1 (opens Expert): the Expert tour still auto-starts.
const { chromium } = require('playwright-core');
const U = (process.env.BASE || 'http://localhost:8080/index.html'); const R = { fails: [], ok: 0 };
const F = (c, m) => { if (c) R.ok++; else R.fails.push(m); };
const SIZES = (process.env.SIZES || '390x844,844x390,360x780').split(',').map(s => s.split('x').map(Number));
const KIDS = U + '?test=1&kv=1&tour=1&hour=12', EXP = U + '?test=1&tour=1&hour=12';
const ST = () => ({ open: !document.getElementById('tour').hidden, runs: window.__tour.log.runs, mode: window.__tour.log.mode, i: window.__tour.step(), done: window.__tour.done(),
  xm: window.__xmode && window.__xmode.mode(), scr: (document.getElementById('kv') || {}).dataset && document.getElementById('kv').dataset.screen,
  song: ((document.querySelector('#kv .kv-chip') || {}).textContent || '') + ((document.querySelector('#kv .kv-lyr') || {}).textContent || ''),
  keys: Object.keys(localStorage) });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  const fresh = async (W, H, pre) => { const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    if (pre) await ctx.addInitScript(p => { if (!sessionStorage.getItem('pre')) { sessionStorage.setItem('pre', '1'); for (const k in p) localStorage.setItem(k, p[k]); } }, pre);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push('' + e)); return { ctx, p, errs }; };
  const load = async (p, url) => { await p.goto(url); await p.waitForFunction(() => window.__tour && window.__xmode); await p.waitForTimeout(1600); return p.evaluate(ST); };
  let saved = null;
  for (const [W, H] of SIZES) {
    const tag = `${W}x${H}`;
    { const { ctx, p, errs } = await fresh(W, H); const s = await load(p, KIDS);   // A
      F(s.open && s.runs === 1 && s.mode === 'kids' && s.i === 0, `${tag} A fresh install: Kids tour did not auto-start ${JSON.stringify(s)}`);
      F(s.xm === 'kids', `${tag} A mode changed to ${s.xm}`); F(s.scr === 'play' && /Twinkle/.test(s.song), `${tag} A not on Twinkle play (${s.scr})`); F(!s.done, `${tag} A saved as done before Done`);
      const n = await p.evaluate(() => window.__tour.steps().length); F(n >= 6, `${tag} A only ${n} steps`);
      for (let k = 0; k < n; k++) { await p.click('#tour .tour-next'); await p.waitForTimeout(200); }
      const e = await p.evaluate(ST); F(!e.open && e.done && e.runs === 1, `${tag} A Done did not close/save ${JSON.stringify(e)}`);
      saved = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
      const r = await load(p, KIDS); F(!r.open && r.runs === 0, `${tag} A reload after Done reopened the tour ${JSON.stringify(r)}`);
      F(errs.length === 0, `${tag} A page errors ${errs}`); await ctx.close(); }
    { const { ctx, p } = await fresh(W, H); const s = await load(p, KIDS);   // B
      F(s.open && s.runs === 1, `${tag} B no auto tour`); if (s.open) await p.click('#tour .tour-skip'); await p.waitForTimeout(200);
      const e = await p.evaluate(ST); F(!e.open && e.done, `${tag} B Skip did not close/save`);
      const r = await load(p, KIDS); F(!r.open && r.runs === 0, `${tag} B reload after Skip reopened the tour`); await ctx.close(); }
    { const { ctx, p } = await fresh(W, H); const s = await load(p, KIDS);   // C
      F(s.open && s.runs === 1, `${tag} C no auto tour`); F(s.keys.some(k => k !== 'touchChord.tour.v1'), `${tag} C settings not saved during the first visit ${s.keys}`);
      const r = await load(p, KIDS); F(!r.open && r.runs === 0, `${tag} C relaunch mid-tour reopened the tour ${JSON.stringify(r)}`); await ctx.close(); }
    { const { ctx, p } = await fresh(W, H, saved); const r = await load(p, KIDS);   // D
      F(!r.open && r.runs === 0, `${tag} D existing user (seen) got the tour`); await ctx.close(); }
    { const pre = Object.assign({}, saved); delete pre['touchChord.tour.v1'];   // E
      const { ctx, p } = await fresh(W, H, pre); const r = await load(p, KIDS); F(!r.open && r.runs === 0, `${tag} E existing user without the tour key got the tour`); await ctx.close(); }
    { const { ctx, p } = await fresh(W, H, { 'touchChord.tour.v1': 'done' }); const r = await load(p, KIDS);   // F
      F(!r.open && r.runs === 0, `${tag} F tour key seen, no settings: got the tour`); F(r.xm === 'kids', `${tag} F not in Kids`); await ctx.close(); }
    { const { ctx, p } = await fresh(W, H); const s = await load(p, EXP);   // G
      F(s.open && s.runs === 1 && s.mode === 'expert' && s.xm === 'expert', `${tag} G fresh Expert: no Expert tour ${JSON.stringify(s)}`); await ctx.close(); }
  }
  await b.close();
  console.log(JSON.stringify({ ok: R.ok, fails: R.fails.length }, null, 0)); R.fails.forEach(f => console.log('FAIL ' + f));
  process.exit(R.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

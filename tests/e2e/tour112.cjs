// Tour (v3.2 guide/tour refresh; was the v112 Kids-style tour, whose targets the Kids view, Simple and Expert no longer show).
// For Kids, Simple and Expert at 360x780, 780x360, 390x844 and 844x390: open the tour the way a person does (Kids:
// Settings > Tour; Simple / Expert: "?" > Tour), walk every step and check: the text and order are TOURS[mode] (tour.js)
// with the steps whose target is not on screen left out (the "land" step only sideways); every spotlight step's target is
// on screen, painted on top, not clipped by the screen or a scrolling/clipping parent, and inside the spotlight; the card
// is on screen and clear of the spotlight; the marker number and "k / n" counter; Next / Done; saved as done; Skip and
// Escape close it; Kids opens on Twinkle. Screenshots of every step: SHOTS/tour-<mode>-<WxH>-stepN.png.
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const U = (process.env.BASE || 'http://localhost:8080/index.html'); const SH = process.env.SHOTS || '/tmp/tc-shots'; fs.mkdirSync(SH, { recursive: true });
const J = JSON.stringify; const R = { fails: [], count: {}, runs: {} }; const F = (c, m) => { R.count[c ? 'ok' : 'FAIL'] = (R.count[c ? 'ok' : 'FAIL'] || 0) + 1; if (!c) R.fails.push(m); };
const SIZES = (process.env.SIZES || '360x780,780x360,390x844,844x390').split(',').map(s => s.split('x').map(Number));
const SRC = fs.readFileSync(path.resolve(__dirname, '../../js/ui/tour.js'), 'utf8');
F(!/sel: "[^"]*(ss-kidpad|#kidsLyr|pg-song|pg-sel)/.test(SRC), 'tour.js still points at the classic Kids-style targets');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  for (const [W, H] of SIZES) for (const mode of ['kids', 'simple', 'expert']) {
    const tag = `${mode}-${W}x${H}`;
    const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { try { localStorage.setItem('touchChord.tour.v1', 'done'); } catch (e) {} });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(U + '?test=1&expert=1&hour=12'); await p.waitForFunction(() => window.__xmode && window.__ms && window.__tour); await p.waitForTimeout(900);
    if (mode !== 'expert') { await p.evaluate(() => window.__ms.open(true)); await p.waitForTimeout(400); await p.evaluate(m => document.querySelector(`#msMode button[data-mode="${m}"]`).click(), mode); await p.waitForTimeout(1100); }
    F(await p.evaluate(() => window.__xmode.mode()) === mode, `${tag} not in ${mode}`);
    if (mode === 'kids') { await p.evaluate(() => window.__ms.open(true)); await p.waitForTimeout(400); await p.evaluate(() => document.getElementById('msTour').click()); }
    else { const hb = await p.evaluate(() => { const v = e => e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'; return v(document.getElementById('xHelp')) ? '#xHelp' : v(document.getElementById('howtoBtn')) ? '#howtoBtn' : null; });
      F(!!hb, `${tag} no visible ?`); if (hb) { await p.click(hb); await p.waitForTimeout(300); await p.click('#helpMenu button[data-help="tour"]'); } }
    await p.waitForTimeout(700);
    const want = await p.evaluate(m => { const land = document.documentElement.classList.contains('lay-phone-land'); return { land, n: window.__tour.steps().length, texts: window.__tour.steps().map(s => s.text), log: window.__tour.log.mode }; }, mode);
    const run = R.runs[tag] = { want, steps: [] };
    F(want.log === mode, `${tag} tour ran the ${want.log} steps`); F(want.n >= 6, `${tag} only ${want.n} steps`);
    if (mode === 'kids') F(await p.evaluate(() => document.getElementById('kv').dataset.screen === 'play' && /Twinkle/.test(document.querySelector('#kv .kv-chip').textContent + document.querySelector('#kv .kv-lyr').textContent)), `${tag} Kids tour not on Twinkle's play screen`);
    for (let k = 0; k < want.n; k++) {
      const s = await p.evaluate(() => {
        const box = document.getElementById('tour'), i = window.__tour.step(), st = window.__tour.steps()[i] || {};
        const r = e => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom].map(v => Math.round(v * 10) / 10); };
        const open = !box.hidden && getComputedStyle(box).display !== 'none' && getComputedStyle(box).visibility !== 'hidden';
        const hole = box.querySelector('.tour-hole'), card = box.querySelector('.tour-card'), num = box.querySelector('.tour-num');
        let tgt = null, onTop = null, clipped = null;
        const e = st.sel ? [...document.querySelectorAll(st.sel)].find(x => { const q = x.getBoundingClientRect(); return q.width > 0 && q.height > 0 && !x.closest('[hidden]') && getComputedStyle(x).visibility !== 'hidden'; }) : null;
        if (e) { tgt = r(e); const q = e.getBoundingClientRect();
          clipped = !(q.left >= -0.5 && q.top >= -0.5 && q.right <= innerWidth + 0.5 && q.bottom <= innerHeight + 0.5);
          for (let a = e.parentElement; a && a !== document.body && !clipped; a = a.parentElement) { const c = getComputedStyle(a); if (/(hidden|clip|auto|scroll)/.test(c.overflowX + c.overflowY)) { const A = a.getBoundingClientRect(); if (q.left < A.left - 1 || q.right > A.right + 1 || q.top < A.top - 1 || q.bottom > A.bottom + 1) clipped = true; } }
          box.style.visibility = 'hidden'; const pts = [[0.5, 0.5], [0.2, 0.3], [0.8, 0.7]].map(([fx, fy]) => document.elementFromPoint(Math.min(innerWidth - 1, q.left + q.width * fx), Math.min(innerHeight - 1, q.top + q.height * fy))); box.style.visibility = '';
          onTop = pts.every(h => !!h && (h === e || e.contains(h) || h.contains(e))); }
        return { open, i, sel: st.sel || null, land: !!st.land, text: document.getElementById('tourText').textContent, counter: box.querySelector('.tour-step').textContent, next: box.querySelector('.tour-next').textContent, skip: !box.querySelector('.tour-skip').hidden,
          hole: hole.hidden ? null : r(hole), num: num.hidden ? null : num.textContent, card: r(card), tight: card.classList.contains('tight'), tgt, onTop, clipped, found: !!e, W: innerWidth, H: innerHeight };
      });
      run.steps.push(s); const t = `${tag} step ${k + 1}`;
      await p.screenshot({ path: `${SH}/tour-${tag}-step${k + 1}.png` });
      F(s.open && s.i === k, `${t} open ${s.open} i ${s.i}`); F(s.text === want.texts[k], `${t} text "${s.text}"`); F(s.counter === `${k + 1} / ${want.n}`, `${t} counter ${s.counter}`);
      F(s.next === (k === want.n - 1 ? 'Done' : 'Next'), `${t} button ${s.next}`); F(k === want.n - 1 || s.skip, `${t} no Skip`);
      if (s.land) F(want.land, `${t} landscape-only step shown upright`);
      const c = s.card; F(c[0] >= 0 && c[1] >= 0 && c[2] <= s.W && c[3] <= s.H, `${t} card off screen ${J(c)}`);
      if (s.sel) { F(s.found, `${t} target ${s.sel} not on screen`); F(s.onTop === true, `${t} target ${s.sel} covered`); F(s.clipped === false, `${t} target ${s.sel} clipped ${J(s.tgt)}`); F(!!s.hole, `${t} no spotlight`); F(s.num === String(k + 1), `${t} marker ${s.num}`);
        if (s.hole && s.tgt) { const h = s.hole, g = s.tgt; F(h[0] <= g[0] + 1 && h[1] <= Math.max(g[1], 2) + 1 && h[2] >= Math.min(g[2], s.W - 2) - 1 && h[3] >= Math.min(g[3], s.H - 2) - 1, `${t} spotlight ${J(h)} misses target ${J(g)}`);
          F(c[2] <= h[0] || c[0] >= h[2] || c[3] <= h[1] || c[1] >= h[3], `${t} card ${J(c)} over the spotlight ${J(h)}`); } }
      else F(!s.hole, `${t} whole-screen step has a spotlight`);
      await p.click('#tour .tour-next'); await p.waitForTimeout(250);
    }
    F(await p.evaluate(() => document.getElementById('tour').hidden && window.__tour.done() && window.__tour.step() === -1), `${tag} Done did not close / save`);
    // Skip on step 2, then Escape on a replay
    await p.evaluate(() => window.__tour.start(true)); await p.waitForTimeout(400); await p.click('#tour .tour-next'); await p.waitForTimeout(200); await p.click('#tour .tour-skip'); await p.waitForTimeout(200);
    F(await p.evaluate(() => document.getElementById('tour').hidden && window.__tour.log.skipped === 1), `${tag} Skip`);
    await p.evaluate(() => window.__tour.start(true)); await p.waitForTimeout(400); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    F(await p.evaluate(() => document.getElementById('tour').hidden && window.__tour.log.skipped === 2), `${tag} Escape`);
    F(await p.evaluate(m => window.__xmode.mode() === m, mode), `${tag} the tour changed the mode`);
    F(!errs.length, `${tag} errors ${J(errs)}`);
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync((process.env.OUT || __dirname) + '/tour112.json', J(R, null, 1)); console.log(J({ count: R.count, fails: R.fails.slice(0, 30) }));
})().catch(e => { console.error(e); process.exit(1); });

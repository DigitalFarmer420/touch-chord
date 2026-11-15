// v3.2 test.5: the next-chord cue on the lyrics (Expert song card, Kids view, and Simple's song bar, which shows the words like
// Expert since test.5: 3 lines upright, 2 sideways and on short phones; the name inline, right of its word).
// At 390x844 and 844x390: the cue word and chord follow the next chord change while tapping Next / the gold pad; it is
// bright when the change is the next tap; it moves on once the change plays; a change on a hidden line gets no cue;
// the tag stays inside its card, on screen, clear of the gold word, and the lyric rows do not move or resize (rects
// with the cue = rects with the cue stripped). While Play runs: the cue brightens <= ~1 beat (+ paint slack) before the
// change and is gone from the played step soon after. No page errors.
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const U = (process.env.BASE || 'http://localhost:8080/index.html'); const R = { fails: [], ok: 0, info: {} };
const F = (c, m) => { if (c) R.ok++; else R.fails.push(m); };
const SONG = fs.readFileSync(path.resolve(__dirname, '../fixtures/upload/diag-v12-clean.json'), 'utf8');
const SIZES = (process.env.SIZES || '390x844,844x390').split(',').map(s => s.split('x').map(Number));
const geo = ([host, rowSel, tagSel, nowSel]) => {   // rows + tag geometry, then the same rows with the cue stripped
  const h = document.querySelector(host), r = e => { const q = e.getBoundingClientRect(); return [q.left, q.top, q.width, q.height].map(v => Math.round(v * 10) / 10); };
  const rows = () => [...h.querySelectorAll(rowSel)].map(r), tag = h.querySelector(tagSel), now = h.querySelector(nowSel);
  const out = { host: r(h), rows: rows(), tag: tag && !tag.hidden ? r(tag) : null, now: now ? r(now) : null, W: innerWidth, H: innerHeight };
  const save = h.innerHTML; h.querySelectorAll('.x-cue, .cue, .sl-cue').forEach(e => e.classList.remove('x-cue', 'cue', 'sl-cue', 'soon')); if (tag) tag.remove();
  out.rows0 = rows(); out.host0 = r(h); h.innerHTML = save; return out; };
const chk = (tag, g) => {
  F(JSON.stringify(g.rows) === JSON.stringify(g.rows0) && JSON.stringify(g.host) === JSON.stringify(g.host0), `${tag} the cue moved the lyric rows ${JSON.stringify(g.rows)} vs ${JSON.stringify(g.rows0)}`);
  if (g.tag) { const [x, y, w, h] = g.tag, [hx, hy, hw, hh] = g.host;
    F(x >= hx - 0.5 && y >= hy - 0.5 && x + w <= hx + hw + 0.5 && y + h <= hy + hh + 0.5, `${tag} tag ${JSON.stringify(g.tag)} outside its card ${JSON.stringify(g.host)}`);
    F(x >= 0 && y >= 0 && x + w <= g.W && y + h <= g.H, `${tag} tag off screen`); F(w >= 10 && h >= 10, `${tag} tag too small ${w}x${h}`);
    if (g.now) { const [nx, ny, nw, nh] = g.now; F(!(x < nx + nw - 0.5 && x + w > nx + 0.5 && y < ny + nh - 0.5 && y + h > ny + 0.5), `${tag} tag covers the gold word`); } } };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  for (const [W, H] of SIZES) {
    const sz = `${W}x${H}`;
    const mk = async q => { const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
      await ctx.addInitScript(() => { try { localStorage.setItem('touchChord.tour.v1', 'done'); } catch (e) {} });
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push('' + e)); await p.goto(U + q); await p.waitForTimeout(1000); return { ctx, p, errs }; };
    // ---- Expert song card
    { const { ctx, p, errs } = await mk('?test=1&expert=1&hour=12'); await p.waitForFunction(() => window.__upload && window.__xmode);
      await p.evaluate(t => window.__upload.load(t), SONG); await p.waitForTimeout(500);
      await p.evaluate(() => { const b = document.querySelector('#xTog button[data-v="song"]'); if (b && !b.classList.contains('on')) b.click(); }); await p.waitForTimeout(400);
      const seen = [];
      for (let n = 1; n <= 8; n++) {
        await p.evaluate(() => document.getElementById('xNext').click()); await p.waitForTimeout(300);
        const c = await p.evaluate(() => Object.assign(window.__xmode.cue(), { cur: window.__prog.cur, steps: window.__upload.steps().map(s => s.sym) }));
        const t = `${sz} expert next${n}`; seen.push({ cur: c.cur, j: c.j, word: c.word, chord: c.chord, row: c.row, soon: c.soon });
        if (c.j >= 0) { F(c.j > c.cur, `${t} cue on a played step`); F(!!c.word && c.tagShown, `${t} no word/tag`); F(c.soon === (c.j === c.cur + 1), `${t} brightness ${c.soon} for j ${c.j} cur ${c.cur}`); }
        chk(t, await p.evaluate(geo, ['#xSrc', '.x-lrow', '.x-cuetag', '.x-lrow.cur .x-now']));
      }
      F(seen.some(s => s.row === 0) && seen.some(s => s.row === 1), `${sz} expert: expected cues on both lines ${JSON.stringify(seen)}`);
      R.info[`expert-${sz}`] = seen;
      // Play: soon <= ~1 beat before the change; gone soon after it plays
      const tempo = await p.evaluate(() => window.__upload.tempo()); const beat = tempo.loopBar / (tempo.song && tempo.song.ts ? +String(tempo.song.ts).split('/')[0] : 4);
      await p.evaluate(() => document.getElementById('xPlay').click());
      const smp = await p.evaluate(async () => { const out = [], t0 = performance.now(); while (performance.now() - t0 < 9000) { const c = window.__xmode.cue(); out.push({ t: performance.now() - t0, cur: window.__prog.cur, j: c.j, soon: c.soon, tag: c.tagShown }); await new Promise(r => setTimeout(r, 25)); } return out; });
      await p.evaluate(() => document.getElementById('xPlay').click());
      const lead = [], stale = [];
      for (let i = 0; i < smp.length; i++) { const s = smp[i]; if (s.soon && (i === 0 || !smp[i - 1].soon || smp[i - 1].j !== s.j)) { const hit = smp.slice(i).find(x => x.cur >= s.j && x.cur < s.j + 4); if (hit) lead.push(+(hit.t - s.t).toFixed(0)); } }
      let run = 0; smp.forEach(s => { if (s.j >= 0 && s.cur >= s.j && s.cur < s.j + 4) run += 25; else { if (run) stale.push(run); run = 0; } });
      R.info[`expert-${sz}-play`] = { beatMs: Math.round(beat * 1000), leadMs: lead, staleMs: stale };
      F(lead.length >= 2, `${sz} expert Play: the cue never brightened before a change`);
      F(lead.every(l => l <= beat * 1000 + 180), `${sz} expert Play: brightened too early ${lead} (beat ${beat})`);
      F(stale.every(s => s <= 200), `${sz} expert Play: the cue stayed on a played step ${stale} ms`);
      F(errs.length === 0, `${sz} expert page errors ${errs}`); await ctx.close(); }
    // ---- Kids view (Twinkle)
    { const { ctx, p, errs } = await mk('?test=1&kv=1&hour=12'); await p.waitForFunction(() => window.__kv);
      await p.evaluate(() => { const kv = document.getElementById('kv'); if (kv.dataset.screen === 'hello') kv.querySelector('.kv-go').click(); if (kv.dataset.screen === 'songs') kv.querySelector('.kv-card[data-song*="Twinkle"]').click(); }); await p.waitForTimeout(700);
      const land = W > H; const want = { '-1': ['Twinkle', 'C', true], 0: ['twinkle', 'G', false], 1: ['twinkle', 'G', true], 2: ['little', 'A', false], 3: ['little', 'A', true], 4: ['star', 'G', false], 5: ['star', 'G', true], 6: land ? [null, null, false] : ['How', 'F', true] };
      for (let n = 0; n <= 7; n++) {
        if (n) { await p.evaluate(() => { const g = document.querySelector('#kv .kv-pad.gold'); g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })); g.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); }); await p.waitForTimeout(300); }
        const c = await p.evaluate(() => Object.assign(window.__kv.cue(), { cur: window.__prog.cur }));
        const t = `${sz} kids tap${n}`, w = want[c.cur];
        if (w) { F(c.word === w[0] && c.chord === w[1] && c.soon === w[2], `${t} cur ${c.cur}: cue ${c.word}/${c.chord}/${c.soon}, want ${w}`); if (w[0]) F(c.tagShown && c.row === (c.cur === 6 ? 1 : 0), `${t} tag/row ${c.tagShown}/${c.row}`); }
        else F(false, `${t} unexpected step ${c.cur}`);
        chk(t, await p.evaluate(geo, ['#kv .kv-lyr', '.kv-l1, .kv-l2', '.kv-cuetag', '.kv-l1 .now']));
      }
      await p.evaluate(() => document.querySelector('#kv .kv-playbtn').click());
      const smp = await p.evaluate(async () => { const out = [], t0 = performance.now(); while (performance.now() - t0 < 5000) { const c = window.__kv.cue(); out.push({ t: performance.now() - t0, cur: window.__prog.cur, j: c.j, soon: c.soon }); await new Promise(r => setTimeout(r, 25)); } return out; });
      await p.evaluate(() => document.querySelector('#kv .kv-playbtn').click());
      let run = 0; const stale = []; smp.forEach(s => { if (s.j >= 0 && s.cur >= s.j && s.cur < s.j + 4) run += 25; else { if (run) stale.push(run); run = 0; } });
      F(smp.some(s => s.soon) && smp.some(s => s.cur >= 2), `${sz} kids Play: no bright cue / no steps`); F(stale.every(s => s <= 150), `${sz} kids Play: cue stayed on a played step ${stale}`);
      R.info[`kids-${sz}-play`] = { soonShare: +(smp.filter(s => s.soon).length / smp.length).toFixed(2), staleMs: stale };
      F(errs.length === 0, `${sz} kids page errors ${errs}`); await ctx.close(); }
    // ---- Simple (test.5): the words like Expert, with Expert's cue (gold underline + the name above / inline sideways)
    { const { ctx, p, errs } = await mk('?test=1&expert=1&hour=12'); await p.waitForFunction(() => window.__upload && window.__ms && window.__magic);
      await p.evaluate(t => window.__upload.load(t), SONG); await p.waitForTimeout(400);
      await p.evaluate(() => window.__ms.open(true)); await p.waitForTimeout(400); await p.evaluate(() => document.querySelector('#msMode button[data-mode="simple"]').click()); await p.waitForTimeout(1000);
      const seen = [];
      for (let n = 1; n <= 8; n++) {
        await p.evaluate(() => window.__magic.tap()); await p.waitForTimeout(400);
        const c = await p.evaluate(() => Object.assign(window.__simpleLyr(), { cur: window.__prog.cur }));
        const t = `${sz} simple tap${n}`; seen.push({ cur: c.cur, j: c.j, word: c.word, chord: c.chord, row: c.row, soon: c.soon, now: c.now });
        const want = await p.evaluate(() => { const c = document.documentElement.classList; return c.contains('lay-phone-land') || (c.contains('lay-phone-port') && innerHeight < 820) ? 2 : 3; });
        F(c.on && c.rows === want, `${t} Simple lyric rows ${c.on}/${c.rows}, want ${want}`);
        F(c.inline || !c.tagShown, `${t} name not inline at ${sz}`);
        if (c.j >= 0) { F(c.j > c.cur, `${t} cue on a played step`); F(!!c.word && c.tagShown, `${t} no word/tag`); F(c.soon === (c.j === c.cur + 1), `${t} brightness ${c.soon} for j ${c.j} cur ${c.cur}`); }
        chk(t, await p.evaluate(geo, ['#songBar .sl-lyr', '.sl-row', '.sl-cuetag', '.sl-row.cur .sl-now']));
      }
      F(seen.some(s => s.row === 0) && seen.some(s => s.row === 1), `${sz} simple: expected cues on two lines ${JSON.stringify(seen)}`);
      R.info[`simple-${sz}`] = seen;
      const tempo = await p.evaluate(() => window.__upload.tempo()); const beat = tempo.loopBar / (tempo.song && tempo.song.ts ? +String(tempo.song.ts).split('/')[0] : 4);
      await p.evaluate(() => window.__progApi.play());
      const smp = await p.evaluate(async () => { const out = [], t0 = performance.now(); while (performance.now() - t0 < 9000) { const c = window.__simpleLyr(); out.push({ t: performance.now() - t0, cur: window.__prog.cur, j: c.j, soon: c.soon }); await new Promise(r => setTimeout(r, 25)); } return out; });
      await p.evaluate(() => window.__progApi.stop && window.__progApi.stop());
      const lead = [], stale = [];
      for (let i = 0; i < smp.length; i++) { const s = smp[i]; if (s.soon && (i === 0 || !smp[i - 1].soon || smp[i - 1].j !== s.j)) { const hit = smp.slice(i).find(x => x.cur >= s.j && x.cur < s.j + 4); if (hit) lead.push(+(hit.t - s.t).toFixed(0)); } }
      let run = 0; smp.forEach(s => { if (s.j >= 0 && s.cur >= s.j && s.cur < s.j + 4) run += 25; else { if (run) stale.push(run); run = 0; } });
      R.info[`simple-${sz}-play`] = { beatMs: Math.round(beat * 1000), leadMs: lead, staleMs: stale };
      F(lead.length >= 2, `${sz} simple Play: the cue never brightened before a change`);
      F(lead.every(l => l <= beat * 1000 + 180), `${sz} simple Play: brightened too early ${lead} (beat ${beat})`);
      F(stale.every(s => s <= 200), `${sz} simple Play: the cue stayed on a played step ${stale} ms`);
      F(errs.length === 0, `${sz} simple page errors ${errs}`); await ctx.close(); }
  }
  await b.close();
  console.log(JSON.stringify({ ok: R.ok, fails: R.fails.length, info: R.info })); R.fails.forEach(f => console.log('FAIL ' + f));
  process.exit(R.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

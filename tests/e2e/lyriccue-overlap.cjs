// v3.2 test.5 (Vinh, Nov 14): the next-chord name never crowds the lyrics. At 390x844, 844x390 and 360x780:
//  - Expert song card: the chord name (.x-cuetag) never overlaps the song title or the text of any lyric line other
//    than its own word's (portrait: it sits in a fixed band above its line; phone landscape: inline, right of its
//    word), stays inside the card and clear of Lock, and the lyric rows sit at the same place on every step (the
//    reserved space is always there, so nothing shifts while the song plays).
//  - Kids lyrics: the pad letter never overlaps the other line's text.
//  - Simple song bar: at least two lyric rows (three in portrait), the line being sung on top with its sung word on
//    gold, the same cue as Expert (gold underline + the name above, or inline in landscape), the name clear of the
//    other lines, the rows steady, and nothing in the bar over a control (grid chips, buttons).
// Text boxes are Range client rects (the font's content area, a little taller than the ink), clipped to the line's
// own box. BASE=http://host/index.html CHROME=/path SIZES=390x844,... node tests/e2e/lyriccue-overlap.cjs
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const U = (process.env.BASE || 'http://localhost:8080/index.html'); const R = { fails: [], ok: 0, info: {} };
const F = (c, m) => { if (c) R.ok++; else R.fails.push(m); };
const SONG = fs.readFileSync(path.resolve(__dirname, '../fixtures/upload/diag-v12-clean.json'), 'utf8');
const SIZES = (process.env.SIZES || '390x844,844x390,360x780').split(',').map(s => s.split('x').map(Number));
// In the page: geometry of one state. sel = { host, title, rows, tag, word, now, controls }
const probe = sel => {
  const q = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const cut = (a, c) => ({ l: Math.max(a.l, c.l), t: Math.max(a.t, c.t), r: Math.min(a.r, c.r), b: Math.min(a.b, c.b) });
  const textBox = (el, skip) => {   // the union of the text's content boxes, clipped to the element (skip = tag nodes)
    const rg = document.createRange(), out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { if (!n.textContent.trim() || (skip && skip.contains(n))) continue; rg.selectNodeContents(n);
      [...rg.getClientRects()].forEach(r => { const c = cut({ l: r.left, t: r.top, r: r.right, b: r.bottom }, q(el)); if (c.r - c.l > 0.5 && c.b - c.t > 0.5) out.push(c); }); }
    if (!out.length) return null;
    return out.reduce((a, c) => ({ l: Math.min(a.l, c.l), t: Math.min(a.t, c.t), r: Math.max(a.r, c.r), b: Math.max(a.b, c.b) }));
  };
  const host = document.querySelector(sel.host); if (!host) return { none: true };
  const tag = host.querySelector(sel.tag), shown = !!(tag && !tag.hidden && tag.getClientRects().length);
  const rows = [...host.querySelectorAll(sel.rows)].filter(e => e.getClientRects().length && getComputedStyle(e).display !== 'none');
  const word = host.querySelector(sel.word), wrow = word ? rows.findIndex(r => r.contains(word)) : -1;
  const title = sel.title ? document.querySelector(sel.title) : null;
  const ctr = (sel.controls ? [...document.querySelectorAll(sel.controls)] : []).filter(e => e.getClientRects().length && !host.contains(e) && !e.contains(host) && getComputedStyle(e).visibility !== 'hidden');
  return { host: q(host), tag: shown ? q(tag) : null, tagIn: shown && rows.some(r => r.contains(tag)), tagText: shown ? tag.textContent : null,
    rows: rows.map(r => ({ box: q(r), text: textBox(r, tag), cls: r.className })), wrow, word: word ? q(word) : null, wordText: word ? word.textContent : null,
    now: (() => { const n = host.querySelector(sel.now); return n ? { box: q(n), bg: getComputedStyle(n).backgroundColor, text: n.textContent } : null; })(),
    title: title ? textBox(title) : null, lock: sel.lock && document.querySelector(sel.lock) ? q(document.querySelector(sel.lock)) : null,
    controls: ctr.map(e => ({ id: (e.id || e.className || e.tagName).toString().slice(0, 40), box: q(e) })), W: innerWidth, H: innerHeight };
};
const hit = (a, b, tol = 0.25) => a && b && Math.min(a.r, b.r) - Math.max(a.l, b.l) > tol && Math.min(a.b, b.b) - Math.max(a.t, b.t) > tol;
const J = o => JSON.stringify(o, (k, v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v);
function check(t, g, info, opt = {}) {
  if (g.none) { F(false, `${t} no host`); return; }
  const rowsTop = g.rows.map(r => Math.round(r.box.t * 10) / 10); info.rowsTop.add(rowsTop.join(','));
  if (!g.tag) return;
  info.tags++; if (g.tagIn) info.inline++; if (g.wrow >= 0) info.rows.add(g.wrow);
  const T = g.tag;
  F(T.l >= g.host.l - 0.5 && T.r <= g.host.r + 0.5 && T.t >= g.host.t - 0.5 && T.b <= g.host.b + 0.5, `${t} name ${J(T)} outside its card ${J(g.host)}`);
  F(T.l >= 0 && T.t >= 0 && T.r <= g.W && T.b <= g.H, `${t} name off screen`);
  if (g.title) F(!hit(T, g.title), `${t} name ${J(T)} covers the song title ${J(g.title)}`);
  if (g.lock) F(!hit(T, g.lock), `${t} name covers Lock`);
  F(g.wrow >= 0, `${t} name shown without its word`);
  g.rows.forEach((r, k) => { if (k === g.wrow && g.tagIn) return;   // inline: its own line holds it
    F(!hit(T, r.text), `${t} name ${J(T)} touches line ${k} text ${J(r.text)} (cue on line ${g.wrow}, inline ${g.tagIn})`); });
  if (g.now && g.wrow === 0) F(!hit(T, g.now.box), `${t} name covers the sung word`);
  if (g.word && !g.tagIn) F(T.b <= g.word.t + 4 && T.r > g.word.l && T.l < g.word.r, `${t} name ${J(T)} not above its word ${J(g.word)}`);
  if (g.word && g.tagIn) F(T.l >= g.word.r - 0.5 && T.l <= g.word.r + 8, `${t} inline name ${J(T)} not right of its word ${J(g.word)}`);
  if (opt.inline != null) F(g.tagIn === opt.inline, `${t} name inline ${g.tagIn}, want ${opt.inline}`);
}
const tapGold = () => { const g = document.querySelector('#kv .kv-pad.gold'); g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })); g.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox'] });
  for (const [W, H] of SIZES) {
    const sz = `${W}x${H}`, land = W > H;
    const mk = async q => { const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
      await ctx.addInitScript(() => { try { localStorage.setItem('touchChord.tour.v1', 'done'); } catch (e) {} });
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push('' + e)); await p.goto(U + q); await p.waitForTimeout(1000); return { ctx, p, errs }; };
    // ---- Expert song card
    { const { ctx, p, errs } = await mk('?test=1&expert=1&hour=12'); await p.waitForFunction(() => window.__upload && window.__xmode);
      await p.evaluate(t => window.__upload.load(t), SONG); await p.waitForTimeout(500);
      await p.evaluate(() => { const b = document.querySelector('#xTog button[data-v="song"]'); if (b && !b.classList.contains('on')) b.click(); }); await p.waitForTimeout(400);
      const info = { tags: 0, inline: 0, rows: new Set(), rowsTop: new Set() };
      const sel = { host: '#xSrc', title: '#xSrc .x-stitle', rows: '.x-lrow', tag: '.x-cuetag', word: '.x-cue', now: '.x-lrow.cur .x-now', lock: '#xSrc .x-lock' };
      for (let n = 0; n <= 18; n++) {
        if (n) { await p.evaluate(() => document.getElementById('xNext').click()); await p.waitForTimeout(420); }
        check(`${sz} expert step${n}`, await p.evaluate(probe, sel), info, { inline: land });
      }
      F(info.tags >= 8 && info.rows.has(0) && info.rows.has(1), `${sz} expert: want names on both lines, got ${info.tags} on ${[...info.rows]}`);
      F(info.rowsTop.size === 1, `${sz} expert: the lyric rows moved between steps ${[...info.rowsTop]}`);
      R.info[`expert-${sz}`] = { tags: info.tags, inline: info.inline, rows: [...info.rows], rowsTop: [...info.rowsTop] };
      F(errs.length === 0, `${sz} expert page errors ${errs}`); await ctx.close(); }
    // ---- Kids lyrics (Twinkle)
    { const { ctx, p, errs } = await mk('?test=1&kv=1&hour=12'); await p.waitForFunction(() => window.__kv);
      await p.evaluate(() => { const kv = document.getElementById('kv'); if (kv.dataset.screen === 'hello') kv.querySelector('.kv-go').click(); if (kv.dataset.screen === 'songs') kv.querySelector('.kv-card[data-song*="Twinkle"]').click(); }); await p.waitForTimeout(700);
      const info = { tags: 0, inline: 0, rows: new Set(), rowsTop: new Set() };
      const sel = { host: '#kv .kv-lyr', rows: '.kv-l1, .kv-l2', tag: '.kv-cuetag', word: '.cue', now: '.kv-l1 .now' };
      for (let n = 0; n <= 14; n++) { if (n) { await p.evaluate(tapGold); await p.waitForTimeout(380); } check(`${sz} kids tap${n}`, await p.evaluate(probe, sel), info); }
      F(info.tags >= 6, `${sz} kids: too few names ${info.tags}`); if (!land) F(info.rows.has(1), `${sz} kids: never a name on line 2`);
      F(info.rowsTop.size === 1, `${sz} kids: the lyric lines moved ${[...info.rowsTop]}`);
      R.info[`kids-${sz}`] = { tags: info.tags, rows: [...info.rows], rowsTop: [...info.rowsTop] };
      F(errs.length === 0, `${sz} kids page errors ${errs}`); await ctx.close(); }
    // ---- Simple song bar
    { const { ctx, p, errs } = await mk('?test=1&expert=1&hour=12'); await p.waitForFunction(() => window.__upload && window.__ms && window.__magic);
      await p.evaluate(t => window.__upload.load(t), SONG); await p.waitForTimeout(400);
      await p.evaluate(() => window.__ms.open(true)); await p.waitForTimeout(400); await p.evaluate(() => document.querySelector('#msMode button[data-mode="simple"]').click()); await p.waitForTimeout(1000);
      const info = { tags: 0, inline: 0, rows: new Set(), rowsTop: new Set() }; let nRows = new Set(), gold = 0, words = 0;
      const sel = { host: '#songBar', rows: '.sl-row', tag: '.sl-cuetag', word: '.sl-cue', now: '.sl-row.cur .sl-now',
        controls: '#suggest .ss-chip, #suggest .ss-note, #app button:not(#songBar), #app input, #app select, .prog, .kid-key, .now-card' };
      for (let n = 0; n <= 18; n++) {
        if (n) { await p.evaluate(() => window.__magic.tap()); await p.waitForTimeout(420); }
        const g = await p.evaluate(probe, sel), t = `${sz} simple tap${n}`;
        check(t, g, info, { inline: land });
        if (g.none) continue;
        nRows.add(g.rows.length);
        F(g.rows.length >= 2, `${t} only ${g.rows.length} lyric rows`);
        if (!land) F(g.rows.length === 3, `${t} portrait: want 3 rows, got ${g.rows.length}`);
        F(g.rows.length && /\bcur\b/.test(g.rows[0].cls), `${t} the first row is not the line being sung`);
        if (g.now) { words++; if (/255, 194, 26/.test(g.now.bg)) gold++; }
        const all = [g.host].concat(g.tag ? [g.tag] : []);
        g.controls.forEach(c => all.forEach(a => F(!hit(a, c.box), `${t} song bar / name ${J(a)} over control ${c.id} ${J(c.box)}`)));
        g.rows.forEach(r => F(r.box.b <= g.host.b + 0.5 && r.box.t >= g.host.t - 0.5, `${t} a row spills out of the bar`));
      }
      F(words >= 6 && gold === words, `${sz} simple: the sung word should be on gold every step (${gold}/${words})`);
      F(info.tags >= 6 && info.rows.size >= 2, `${sz} simple: want names on more than one line, got ${info.tags} on ${[...info.rows]}`);
      F(info.rowsTop.size === 1, `${sz} simple: the rows moved ${[...info.rowsTop]}`);
      R.info[`simple-${sz}`] = { tags: info.tags, inline: info.inline, rows: [...info.rows], nRows: [...nRows], rowsTop: [...info.rowsTop], gold: `${gold}/${words}` };
      F(errs.length === 0, `${sz} simple page errors ${errs}`); await ctx.close(); }
  }
  await b.close();
  console.log(JSON.stringify({ ok: R.ok, fails: R.fails.length, info: R.info })); R.fails.slice(0, 60).forEach(f => console.log('FAIL ' + f));
  process.exit(R.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

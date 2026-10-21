// v112.7: every chord label on the suggestion grid (#suggest: chips in every row, dashed borrowed chips, the middle
// degree row, Kids pads) sits inside its button's border box, centred within 2.5 px, with no text overflow
// (scrollWidth <= clientWidth). Styles Pop, Kids, Jazz (Jazz with an uploaded song of long names: F#m7b5/C, Am7/G,
// Bm7b5/F ...), Full and Simple, at 360x780, 780x360, 820x1180, 1180x820. Run with the emulate.cjs preload.
const { chromium } = require('playwright-core'); const fs = require('fs');
const URL = process.env.URL || (process.env.BASE || 'http://localhost:8080/index.html');
const SH = (process.env.SHOTS || '/tmp/tc-shots') + '/labelfit/'; fs.mkdirSync(SH, { recursive: true });
const R = { fails: [], info: {} };
const CH = ['Gmaj7', 'Em7', 'Em7/D', 'Cmaj7', 'Bm7', 'Am7/G', 'D11', 'Gmaj7', 'Cm7', 'Dmaj7', 'D7b9', 'F#m7', 'F#m7b5/C', 'Bm/F#', 'E7', 'C#m7b5/G', 'A', 'Amaj7', 'Bm7b5/F', 'E11', 'D7', 'F#7', 'Em7', 'D11'];
const SONG = JSON.stringify({ contractVersion: '1.2', songs: [{ song: { title: 'Label Fit Test', artist: 'QA', key: { tonic: 'G', mode: 'major', display: 'G major', confidence: 0.95 } }, timing: { bpm: 96, timeSignature: '4/4' },
  sections: [{ id: 'verse1', type: 'verse', chords: CH.map((c, k) => ({ index: k, chord: c, position: { bar: k + 1, beat: 1 }, durationBeats: 4, confidence: 0.95 })) }] }] });
const SIZES = (process.argv[2] || '360x780,780x360,820x1180,1180x820').split(',');
function check() {   // runs in the page
  const vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none';
  const els = [...new Set(document.querySelectorAll('#suggest .ss-chip, #suggest .ss-note, #suggest .ss-kidpad, #suggest button'))].filter(vis);
  const bad = []; let n = 0;
  for (const e of els) { const B = e.getBoundingClientRect(), cs = getComputedStyle(e), px = k => parseFloat(cs[k]) || 0;
    const I = { l: B.left + px('borderLeftWidth'), t: B.top + px('borderTopWidth'), r: B.right - px('borderRightWidth'), b: B.bottom - px('borderBottomWidth') };
    const rg = document.createRange(), tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let L = 1e9, T = 1e9, Rr = -1e9, Bb = -1e9, t;
    while ((t = tw.nextNode())) { if (!t.textContent.trim() || !vis(t.parentElement)) continue; rg.selectNodeContents(t);
      for (const q of rg.getClientRects()) { L = Math.min(L, q.left); T = Math.min(T, q.top); Rr = Math.max(Rr, q.right); Bb = Math.max(Bb, q.bottom); } }
    if (L > 1e8) continue; n++;
    const lab = e.textContent.trim().replace(/\s+/g, ' '), tol = 0.75, is = [];
    if (L < I.l - tol) is.push('left ' + (I.l - L).toFixed(1)); if (Rr > I.r + tol) is.push('right ' + (Rr - I.r).toFixed(1));
    if (T < I.t - tol) is.push('top ' + (I.t - T).toFixed(1)); if (Bb > I.b + tol) is.push('bottom ' + (Bb - I.b).toFixed(1));
    if (e.scrollWidth > e.clientWidth) is.push(`scrollWidth ${e.scrollWidth}>${e.clientWidth}`);
    const dx = (L + Rr) / 2 - (I.l + I.r) / 2, dy = (T + Bb) / 2 - (I.t + I.b) / 2;
    if (Math.abs(dy) > 2.5) is.push('vcentre ' + dy.toFixed(1)); if (Math.abs(dx) > 2.5) is.push('hcentre ' + dx.toFixed(1));
    if (is.length) bad.push(`"${lab}" [${e.className}] ${is.join(', ')}`); }
  return { n, bad };
}
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  for (const sz of SIZES) { const [w, h] = sz.split('x').map(Number);
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:{simple:false,tourDone:true}}));}}catch(e){}`);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push('' + e));
    await p.goto(URL); await p.waitForTimeout(1200);
    const tap = async s => { const l = p.locator(s).first(); if (await l.count() && await l.isVisible()) { await l.tap({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(350); return true; } return false; };
    const simple = () => p.evaluate(() => document.documentElement.classList.contains('simple'));
    const set = async (st, m) => { await tap(`#styles button[data-style="${st}"]`); if ((await simple()) !== (m === 'simple')) await tap('#simpleBtn'); await p.waitForTimeout(300); };
    for (const st of ['pop', 'kids', 'jazz']) for (const m of ['full', 'simple']) {
      await set(st, m);
      if (st === 'jazz' && !(await p.evaluate(() => document.documentElement.classList.contains('up-on') && /Label Fit|F♯m7♭5\/C/.test((document.getElementById('songBar') || {}).textContent || '') ))) {
        await tap('#uploadBtn'); await p.evaluate(t => { const e = document.getElementById('upPaste'); e.value = t; e.dispatchEvent(new Event('input', { bubbles: true })); }, SONG);
        await tap('#upLoad'); await p.waitForTimeout(600); await tap('#upValSave'); await p.waitForTimeout(600);
        await p.evaluate(() => { const d = document.getElementById('uploadPick'); if (d && !d.hidden) { const c = d.querySelector('.up-x'); if (c) c.click(); } }); await p.waitForTimeout(400);
        await set(st, m);
        if (!(await p.evaluate(() => document.documentElement.classList.contains('up-on') && /Label Fit|F♯m7♭5\/C/.test((document.getElementById('songBar') || {}).textContent || '') ))) R.fails.push(`${sz} jazz ${m}: song did not load`); }
      const r = await p.evaluate(check); const k = `${sz} ${st} ${m}`; R.info[k] = { labels: r.n, bad: r.bad.length };
      if (!r.n) R.fails.push(`${k}: no labels found`); r.bad.forEach(x => R.fails.push(`${k} ${x}`));
      await p.screenshot({ path: SH + `${st}-${m}-${sz}.png` }); }
    if (errs.length) R.fails.push(`${sz} page errors ${errs}`); await ctx.close(); }
  await b.close(); fs.writeFileSync((process.env.OUT || __dirname) + '/labelfit.json', JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R.info), '\n', JSON.stringify(R.fails, null, 1), R.fails.length); })();

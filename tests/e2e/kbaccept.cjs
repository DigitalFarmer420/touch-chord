// kb-fix acceptance: every key (12 tonics x major/minor) x every style x Layout Octave (1-octave window) and Full
// (2-octave keys), 360x780 + 780x360 (emulate.cjs: DPR 3, isMobile, hasTouch), Play along off, All keys on.
// Keyboard: tap every key left to right, fresh and again after chip taps + the 1 s snap-back. Asserts (a) the root
// is the lowest chord note (bass excluded), (b) tones strictly ascend from the root, (c) roots strictly increase left
// to right, (d) nothing folded below the root, (e) diatonic quality (out of key: major), (f) same MIDI before / after.
// Grid: every row's chips left to right, in 3 history orders (L->R, R->L, shuffled): identical MIDI each time, root
// lowest (a slash bass under the chord excluded), tones ascending, roots strictly increasing by column; a chip = its
// root key. Kids: keys asserted; its kid pads are recorded only (Kids pad placement is unchanged by design).
//   node -r ./emulate.cjs kbaccept.cjs [WxH] [octave|full]      env: BASE, OUT, STYLES=pop,jazz...
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || process.env.BASE || 'http://localhost:8080/index.html';
const OUT = process.env.OUT || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const SIZES = process.argv[2] ? [process.argv[2].split('x').map(Number)] : [[360, 780], [780, 360]];
const LAYOUTS = process.argv[3] ? [process.argv[3]] : ['octave', 'full'];
const STYLES = (process.env.STYLES || 'pop,kids,jazz,rnb,ballad,reggae,funk,yogaDeep,country').split(',');
const KEYS = []; for (let pc = 0; pc < 12; pc++) for (const mode of ['major', 'minor']) KEYS.push([pc, mode]);
const w12 = n => ((n % 12) + 12) % 12;
const DEG = { major: [[0, 'major'], [2, 'minor'], [4, 'minor'], [5, 'major'], [7, 'major'], [9, 'minor'], [11, 'dim']], minor: [[0, 'minor'], [2, 'dim'], [3, 'major'], [5, 'minor'], [7, 'minor'], [8, 'major'], [10, 'major']] };
const IV = { major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6] };
const want = (m, pc, mode) => { const d = DEG[mode].find(x => w12(pc + x[0]) === w12(m)); return IV[d ? d[1] : 'major'].map(i => m + i); };
const R = { fails: [], summary: [] }; let tag = '';
const F = (c, m) => { if (!c) { R.fails.push(tag + ' ' + m); return false; } return true; };
const asc = a => a.every((x, i) => !i || x > a[i - 1]);

// in-page helpers (synthetic pointer events on the real elements, so the app's own handlers run)
const PAGE = () => {
  let pid = 100;
  const A = window.ChordAudio; window.__L = []; const pc = A.playChord.bind(A);
  A.playChord = function (g, m, o) { window.__L.push({ g, m: (m || []).slice().sort((a, b) => a - b), bass: o && o.bass }); return pc(g, m, o); };
  const vis = e => e.getClientRects().length > 0;
  const press = (el, up) => { const id = ++pid; const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height * 0.8;
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, button: 0, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
    (up || el).dispatchEvent(new PointerEvent('pointerup', { pointerId: id, button: 0, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y })); };
  window.__acc = {
    win: () => { const ms = [...document.querySelectorAll('#pads .pad')].filter(vis).map(e => +e.dataset.midi); return [Math.min(...ms), Math.max(...ms)]; },
    keys: () => [...document.querySelectorAll('#pads .pad')].filter(vis).map(e => ({ m: +e.dataset.midi, x: e.getBoundingClientRect().x + e.getBoundingClientRect().width / 2 })).sort((a, b) => a.x - b.x).map(k => k.m),
    tapKey: m => { const e = [...document.querySelectorAll('#pads .pad')].find(e => vis(e) && +e.dataset.midi === m); if (!e) return { m, missing: true };
      window.__L = []; press(e, window); const c = window.__L.find(x => /^live-/.test(x.g)) || window.__L[0]; return { m, s: c ? c.m : null, g: c ? c.g : null }; },
    chips: () => [...document.querySelectorAll('#suggest .ss-note, #suggest .ss-chip, #suggest .ss-kidpad')].filter(e => vis(e) && e._tc && e._tc.item).map((e, i) => { e.dataset.accId = i; const r = e.getBoundingClientRect();
      return { id: i, t: e.textContent.trim(), row: e.classList.contains('ss-note') ? 'scale' : e.classList.contains('ss-kidpad') ? 'kids' : (e.className.match(/\br-(\w+)/) || [, 'other'])[1], x: Math.round(r.x + r.width / 2), y: Math.round(r.y), rootPc: e._tc.item.rootPc, over: (e._tc.item.extensions || {}).over || 0 }; }),
    tapChip: id => { const e = document.querySelector(`#suggest [data-acc-id="${id}"]`); if (!e) return null; window.__L = []; press(e); const c = window.__L.find(x => /^(hold-|suggest)/.test(x.g)) || window.__L[0]; return c ? c.m : null; },
    stay: () => window.__kbWin ? window.__kbWin() : null,
  };
};

function checkChord(s, root, over) {   // returns problems for one chord (s sorted), root MIDI expected = the root key / chip root
  const p = []; if (!s || !s.length) return ['no chord'];
  let body = s; if (over) { const bpc = w12(root + over); if (s[0] < root && w12(s[0]) === bpc) body = s.slice(1); else p.push('slash bass not under the chord'); }
  if (body[0] !== root) p.push(`root ${root} not lowest (${s})`);
  if (!asc(body)) p.push('tones not ascending');
  if (body.some(x => x < root)) p.push('folded below the root');
  return p;
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of SIZES) for (const layout of LAYOUTS) for (const style of STYLES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:${JSON.stringify({ style, simple: false, layout, playAlong: false, paHints: false, allKeys: true })}}));}}catch(e){}`);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push('' + e));
    await p.goto(URL + '?test=1'); await p.waitForTimeout(1000); await p.evaluate(PAGE);
    for (const [pc, mode] of KEYS) {
      tag = `${w}x${h} ${layout} ${style} ${pc}${mode === 'minor' ? 'm' : ''}`;
      const row = { size: `${w}x${h}`, layout, style, key: pc, mode, keyFails: 0, gridFails: 0, snapMs: null, win: null, keysA: null, grid: null };
      const before = R.fails.length;
      await p.evaluate(([pc, mode]) => window.__setKey(pc, mode), [pc, mode]); await p.waitForTimeout(80);
      row.win = await p.evaluate(() => __acc.win());
      const kids = style === 'kids';
      if (!kids) F(layout === 'full' ? row.win[0] === 60 && row.win[1] === 84 : row.win[0] === 60 + pc, `at-rest window ${row.win} (want ${layout === 'full' ? '60-84' : 60 + pc})`);
      const tapAll = async () => { const ks = await p.evaluate(() => __acc.keys()); const out = []; for (const m of ks) out.push(await p.evaluate(m => __acc.tapKey(m), m)); return out; };
      const checkKeys = (rows, lbl) => { const roots = [];
        for (const r of rows) { if (r.missing) { F(false, `${lbl} key ${r.m} missing`); continue; } if (!r.s) { if (!kids) F(false, `${lbl} key ${r.m} silent`); continue; }
          if (kids && !/^live-/.test(r.g)) continue;   // a Kids gold key / solo note
          const pr = checkChord(r.s, r.m, 0); F(!pr.length, `${lbl} key ${r.m}: ${pr.join('; ')}`); roots.push(r.s[0]);
          if (!kids) F(JSON.stringify(r.s) === JSON.stringify(want(r.m, pc, mode)), `${lbl} key ${r.m} quality ${r.s} want ${want(r.m, pc, mode)}`); }
        F(asc(roots), `${lbl} roots not rising left to right ${roots}`); };
      const A1 = await tapAll(); checkKeys(A1, 'keys'); row.keysA = A1.map(r => [r.m, r.s]);
      row.keyFails = R.fails.length - before; const b2 = R.fails.length;
      // grid: rows by type; 3 history orders
      const chips = await p.evaluate(() => __acc.chips());
      const rows = {}; for (const c of chips) (rows[c.row] = rows[c.row] || []).push(c);
      for (const k in rows) rows[k].sort((a, b) => a.x - b.x);
      const all = chips.slice(); const seq = [all.slice().sort((a, b) => a.x - b.x || a.y - b.y), all.slice().sort((a, b) => b.x - a.x || b.y - a.y), all.slice().sort(() => Math.random() - 0.5)];
      const got = {};
      for (let o = 0; o < seq.length; o++) for (const c of seq[o]) { const m = await p.evaluate(id => __acc.tapChip(id), c.id); (got[c.id] = got[c.id] || []).push(m); }
      row.grid = {};
      for (const k in rows) { const roots = []; row.grid[k] = rows[k].map(c => ({ t: c.t, m: got[c.id][0] }));
        for (const c of rows[k]) { const g = got[c.id]; const lbl = `grid ${k} ${c.t}`;
          F(g.every(x => JSON.stringify(x) === JSON.stringify(g[0])), `${lbl}: MIDI differs by history ${JSON.stringify(g)}`);
          if (!g[0]) { F(false, `${lbl}: silent`); continue; }
          const root = g[0].find(x => w12(x) === w12(c.rootPc) && (!c.over || x > g[0][0]));
          const pr = checkChord(g[0], root, c.over);
          if (kids) { if (pr.length) row.kidsGridInfo = (row.kidsGridInfo || 0) + 1; continue; }   // Kids: recorded only (v111 I placement inside the Kids keys, unchanged)
          F(!pr.length, `${lbl}: ${pr.join('; ')}`); roots.push(root); }
        if (!kids) F(asc(roots), `grid ${k}: roots not rising left to right ${roots} (${rows[k].map(c => c.t)})`); }
      // a chip = its root key (middle row): chip, then its root key in the shifted window
      if (!kids) for (const c of (rows.scale || [])) { const m = await p.evaluate(id => __acc.tapChip(id), c.id); const r = await p.evaluate(m => __acc.tapKey(m), m && m[0]);
        F(!r.missing && JSON.stringify(r.s) === JSON.stringify(m), `chip ${c.t} ${m} != its root key ${r.m}: ${r.s}`); }
      row.gridFails = R.fails.length - b2;
      // snap-back, then the keyboard again (identical)
      if (!kids) { const t0 = Date.now(); let back = null; while (Date.now() - t0 < 1300) { await p.waitForTimeout(40); const wv = await p.evaluate(() => __acc.win()); if (wv[0] === row.win[0] && wv[1] === row.win[1]) { const st = await p.evaluate(() => __acc.stay()); if (!st || !st.chord) { back = Date.now() - t0; break; } } }
        row.snapMs = back; F(back != null && back <= 1200, `no snap-back to the tonic within 1.2 s (${back})`); }
      const A2 = await tapAll(); checkKeys(A2, 'keys after chips+snap');
      if (!kids) F(JSON.stringify(A2.map(r => r.s)) === JSON.stringify(A1.map(r => r.s)), 'keys after chips+snap differ from fresh');   // Kids: its window follows the gold note (no snap-back by design)
      row.fails = R.fails.length - before; R.summary.push(row);
    }
    F(!errs.length, `page errors ${errs.slice(0, 3)}`);
    await ctx.close();
    fs.writeFileSync(path.join(OUT, `kbaccept-${SIZES.map(s => s.join('x')).join('_')}-${LAYOUTS.join('_')}.json`), JSON.stringify(R));
  }
  console.log(JSON.stringify({ rows: R.summary.length, fails: R.fails.length, first: R.fails.slice(0, 20) }, null, 1));
  await b.close();
})();

// kb-fix smoke (Playwright device emulation via emulate.cjs: DPR 3, isMobile, hasTouch), 360x780 + 780x360.
// Key taps play the touched key's diatonic chord in root position upward from the key (no fold), lit = sounded
// inside the keys, no lit key left of the root; chips / Next move the window and it snaps back to the selected
// key's tonic within 1.2 s of release; quality never comes from the last chip / Next / a reload.
// Also the user's state: Jazz, Full, 2-octave keyboard, C major, an uploaded 'Rainy Days and Mondays'-like song (Am7 marked).
// EXPECT_FIX=0 only records (for the before table on an unfixed build). Raw data: $OUT/kbfix-<size>.json (+ KBRAW dir).
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || process.env.BASE || 'http://localhost:8080/index.html';
const OUT = process.env.OUT || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const EXPECT = process.env.EXPECT_FIX !== '0';
const SIZES = process.argv[2] ? [process.argv[2].split('x').map(Number)] : [[360, 780], [780, 360]];
const NN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']; const w12 = n => ((n % 12) + 12) % 12;
const nm = m => NN[w12(m)] + (Math.floor(m / 12) - 1);
const DEG = { major: [[0, 'major'], [2, 'minor'], [4, 'minor'], [5, 'major'], [7, 'major'], [9, 'minor'], [11, 'dim']], minor: [[0, 'minor'], [2, 'dim'], [3, 'major'], [5, 'minor'], [7, 'minor'], [8, 'major'], [10, 'major']] };
const IV = { major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6] };
function expectKey(m, keyPc, mode) { const d = DEG[mode].find(x => w12(keyPc + x[0]) === w12(m)); return IV[d ? d[1] : 'major'].map(i => m + i); }
const ch = (c, i) => ({ index: i, chord: c, position: { bar: i + 1, beat: 1 }, durationBeats: 4, confidence: 0.95 });
const SONG = JSON.stringify({ contractVersion: '1.2', songs: [{ song: { title: 'Rainy Days and Mondays', artist: 'kb-fix test', key: { tonic: 'C', mode: 'major', display: 'C major', confidence: 0.95 } }, timing: { bpm: 96, timeSignature: '4/4' },
  sections: [{ id: 'intro', type: 'intro', chords: ['Am7', 'Dm7', 'G7', 'Cmaj7'].map(ch) }, { id: 'verse1', type: 'verse', chords: ['Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Em7', 'Dm7', 'G7'].map(ch) }],
  sectionsFull: [{ id: 'intro', type: 'intro', chords: ['Am7', 'Dm7', 'G7', 'Cmaj7'].map(ch) }, { id: 'verse1', type: 'verse', chords: ['Am7', 'Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Em7', 'Dm7', 'G7'].map(ch) }] }] });
const R = { fails: [], info: {} }; const F = (c, m) => { if (EXPECT && !c) R.fails.push(m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function open(b, w, h, settings) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:${JSON.stringify(settings)}}));}}catch(e){}`);
  const p = await ctx.newPage(); p.__errs = [];
  p.on('pageerror', e => p.__errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') p.__errs.push(m.text()); });
  await p.goto(URL + '?test=1'); await p.waitForTimeout(1200);
  await p.evaluate(() => { const t = document.getElementById('tour'); if (t && !t.hidden) { const x = t.querySelector('button[class*=x], .tr-skip'); if (x) x.click(); }
    const A = window.ChordAudio; window.__L = []; const pc = A.playChord.bind(A);
    A.playChord = function (g, m, o) { window.__L.push({ g, m: (m || []).slice().sort((a, b) => a - b), key: !!(o && o.key) }); return pc(g, m, o); }; });
  const t = await p.evaluate(() => { const e = document.querySelector('.brand,h1,#title') || document.body; const q = e.getBoundingClientRect(); return { x: q.x + 5, y: q.y + 5 }; });
  await p.touchscreen.tap(t.x, t.y); await p.waitForTimeout(250);   // audio unlock
  return p;
}
const take = p => p.evaluate(() => { const l = window.__L; window.__L = []; return l; });
const kbState = p => p.evaluate(() => { const v = e => e.getClientRects().length > 0; const pads = [...document.querySelectorAll('#pads .pad')].filter(v);
  const ms = pads.map(e => +e.dataset.midi); return { lo: Math.min(...ms), hi: Math.max(...ms), lit: pads.filter(e => e.classList.contains('selected')).map(e => +e.dataset.midi).sort((a, b) => a - b), win: window.__kbWin ? window.__kbWin() : null, sym: (document.getElementById('symbol') || {}).textContent }; });
const keyPt = (p, m) => p.evaluate(m => { const e = [...document.querySelectorAll('#pads .pad')].find(e => +e.dataset.midi === m && e.getClientRects().length); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * (e.classList.contains('black') ? 0.6 : 0.85), nokey: e.classList.contains('nokey') || e.classList.contains('out') }; }, m);
// a key held with the mouse (lit read while down), then let go
async function holdKey(p, m) {
  const pt = await keyPt(p, m); if (!pt) return { midi: m, missing: true };
  await take(p); await p.mouse.move(pt.x, pt.y); await p.mouse.down(); await p.waitForTimeout(120);
  const s = await kbState(p); await p.mouse.up(); await p.waitForTimeout(140);
  const L = await take(p); const c = L.find(x => x.g && /^live-/.test(x.g)) || L.find(x => x.g === 'suggest') || L[0];
  return { midi: m, sounded: c ? c.m : [], pa: !!(c && !/^live-/.test(c.g)), lit: s.lit, sym: s.sym, nokey: pt.nokey };
}
async function tapKey(p, m) { const pt = await keyPt(p, m); if (!pt) return { midi: m, missing: true }; await take(p); await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(220);
  const L = await take(p); const c = L.find(x => /^live-/.test(x.g)) || L.find(x => x.g === 'suggest') || L[0]; return { midi: m, sounded: c ? c.m : [], pa: !!(c && !/^live-/.test(c.g)), g: c && c.g, nokey: pt.nokey }; }
const chipPts = p => p.evaluate(() => [...document.querySelectorAll('#suggest .ss-note')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));

function checkKeys(tag, rows, keyPc, mode, lo, hi) {
  for (const r of rows) { if (r.missing) { F(false, `${tag} key ${r.midi} missing`); continue; } if (r.pa) continue;
    if (r.nokey) { F(!r.sounded.length, `${tag} out-of-key key ${nm(r.midi)} (All keys off) sounded ${r.sounded}`); continue; }   // v111 (K): silent by design
    F(same(r.sounded, expectKey(r.midi, keyPc, mode)), `${tag} key ${nm(r.midi)} sounded ${r.sounded} want ${expectKey(r.midi, keyPc, mode)}`);
    if (r.lit) { const want = r.sounded.filter(x => x >= lo && x <= hi); F(same(r.lit, want), `${tag} key ${nm(r.midi)} lit ${r.lit} != sounded-in-window ${want}`); F(!r.lit.length || r.lit[0] >= r.midi, `${tag} key ${nm(r.midi)} lit left of the root ${r.lit}`); } }
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of SIZES) { const tag = `${w}x${h}`, D = R.info[tag] = {};
    // 1) C, G, F, Am, Ebm on the one-octave window (Pop, Play along off): every key held, lit vs sounded; window at the tonic
    for (const [kn, pc, mode] of [['C', 0, 'major'], ['G', 7, 'major'], ['F', 5, 'major'], ['Am', 9, 'minor'], ['Ebm', 3, 'minor']]) {
      const p = await open(b, w, h, { style: 'pop', simple: false, layout: 'octave', playAlong: false, lockKey: { pc, mode }, keyRoot: pc, keyScale: mode, rootPc: pc });
      const s0 = await kbState(p); D['win0-' + kn] = [s0.lo, s0.hi]; F(s0.lo === 60 + pc, `${tag} ${kn}: at-rest window starts ${nm(s0.lo)}, want ${nm(60 + pc)}`);
      const rows = []; for (let m = s0.lo; m <= s0.hi; m++) rows.push(await holdKey(p, m)); D['keys-' + kn] = rows; checkKeys(`${tag} ${kn}`, rows, pc, mode, s0.lo, s0.hi);
      // every chip, then the window: shifted while shown, back at the tonic within 1.2 s of release; key qualities unchanged
      const chips = await chipPts(p); D['snap-' + kn] = [];
      for (const c of chips) { await take(p); await p.touchscreen.tap(c.x, c.y); const t0 = Date.now(); await p.waitForTimeout(60); const sh = await kbState(p); const L = await take(p);
        let back = null; while (Date.now() - t0 < 1200) { await p.waitForTimeout(50); const s = await kbState(p); if (s.lo === 60 + pc) { back = Date.now() - t0; break; } }
        const cm = (L.find(x => x.g === 'suggest' || /^hold-/.test(x.g)) || {}).m;
        D['snap-' + kn].push({ chip: c.t, chipMidi: cm, shiftedTo: sh.lo, backMs: back }); F(back != null, `${tag} ${kn}: after chip ${c.t} (window ${nm(sh.lo)}) not back at the tonic within 1.2 s`);
        if (cm && cm[0] >= 60 + pc && cm[0] <= 72 + pc) { const kr = await holdKey(p, cm[0]); F(same(kr.sounded, cm) || kr.pa, `${tag} ${kn}: chip ${c.t} ${cm} vs its key ${kr.sounded}`); } }   // chip = its root key when that key is in the at-rest window (kbaccept checks every chip in the shifted window)
      await p.waitForTimeout(1300); const rows2 = []; for (let m = 60 + pc; m <= 72 + pc; m++) rows2.push(await holdKey(p, m)); checkKeys(`${tag} ${kn} after chips`, rows2, pc, mode, 60 + pc, 72 + pc);
      F(!p.__errs.length, `${tag} ${kn} errors ${p.__errs}`); await p.context().close(); }
    // 1b) All keys on: out-of-key (black) keys play a plain major triad, in-key keys stay diatonic
    { const p = await open(b, w, h, { style: 'pop', simple: false, layout: 'octave', playAlong: false, allKeys: true, lockKey: { pc: 0, mode: 'major' }, rootPc: 0 });
      const rows = []; for (let m = 60; m <= 72; m++) rows.push(await holdKey(p, m)); D.allKeys = rows; checkKeys(`${tag} allKeys C`, rows, 0, 'major', 60, 72);
      F(rows.filter(r => !r.nokey && [61, 63, 66, 68, 70].includes(r.midi)).length === 5, `${tag} allKeys: black keys still not playable`); await p.context().close(); }
    // 2) Next (Pop preset song, Play along on): the window comes back after the preview; keys diatonic after it
    { const p = await open(b, w, h, { style: 'pop', simple: false, layout: 'octave', lockKey: { pc: 0, mode: 'major' }, rootPc: 0 }); D.next = [];
      for (let i = 0; i < 4; i++) { const nb = await p.evaluate(() => { const b = document.querySelector('#prog .pg-step'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        if (!nb) { F(false, `${tag} Next button missing`); break; } await take(p); await p.touchscreen.tap(nb.x, nb.y); await p.waitForTimeout(80); const s = await kbState(p); const L = await take(p);
        for (let k = 0; k < 80 && (await kbState(p)).lit.length; k++) await p.waitForTimeout(50);   // the Next preview (1 bar) ends: lit keys clear
        const t0 = Date.now(); let back = null; while (Date.now() - t0 < 1200) { const q = await kbState(p); if (q.lo === 60) { back = Date.now() - t0; break; } await p.waitForTimeout(50); }
        F(back != null, `${tag} Next ${i}: window not back at C4 within 1.2 s of the preview end`);
        await p.evaluate(() => { const b = document.getElementById('playAlongBtn'); if (b && b.getAttribute('aria-checked') === 'true') b.click(); });
        const kr = []; for (const m of [62, 64, 67, 69, 71]) kr.push(await holdKey(p, m)); checkKeys(`${tag} after Next ${i}`, kr, 0, 'major', 60, 72);
        await p.evaluate(() => { const b = document.getElementById('playAlongBtn'); if (b && b.getAttribute('aria-checked') !== 'true') b.click(); });
        D.next.push({ chord: (L.find(x => x.g === 'suggest') || {}).m, shiftedTo: s.lo, backMsAfterPreview: back, keys: kr.map(r => [r.midi, r.sounded]) }); }
      F(!p.__errs.length, `${tag} next errors ${p.__errs}`); await p.context().close(); }
    // 3) reload with a saved root A in C major: Now shows Am, key taps stay diatonic
    { const p = await open(b, w, h, { style: 'pop', simple: false, layout: 'octave', playAlong: false, lockKey: { pc: 0, mode: 'major' }, rootPc: 9 }); const s = await kbState(p); D.reloadSym = s.sym;
      const rows = []; for (let m = 60; m <= 72; m++) rows.push(await holdKey(p, m)); D.reload = rows; checkKeys(`${tag} reload rootPc A`, rows, 0, 'major', 60, 72); await p.context().close(); }
    // 4) the user's state: Jazz, Full (not Simple), 2-octave keyboard, C major, the uploaded song with Am7 marked (Play along on, then off)
    for (const pa of [true, false]) { const p = await open(b, w, h, { style: 'jazz', simple: false, layout: 'full', playAlong: pa, lockKey: { pc: 0, mode: 'major' }, rootPc: 0 });
      await p.evaluate(() => document.getElementById('uploadBtn').click()); await p.waitForTimeout(300);
      await p.evaluate(t => { const e = document.getElementById('upPaste'); e.value = t; e.dispatchEvent(new Event('input', { bubbles: true })); }, SONG);
      await p.evaluate(() => document.getElementById('upLoad').click()); await p.waitForTimeout(800);
      await p.evaluate(() => { const sa = [...document.querySelectorAll('button')].find(x => /Save anyway/i.test(x.textContent) && x.getClientRects().length); if (sa) sa.click(); }); await p.waitForTimeout(400);
      await p.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); const c = [...document.querySelectorAll('.kp-close,[aria-label="Close"]')].find(e => e.getClientRects().length); if (c) c.click(); }); await p.waitForTimeout(400);
      const s0 = await kbState(p); const info = await p.evaluate(() => ({ nx: window.__nx ? window.__nx() : null, title: window.__upload && window.__upload.song ? (window.__upload.song() || {}).title || null : null }));
      const K = 'user-' + (pa ? 'pa' : 'paoff'); D[K + '-info'] = { win: [s0.lo, s0.hi], sym: s0.sym, nx: info.nx && (info.nx.label || info.nx.sym || info.nx), title: info.title };
      F(s0.lo === 60 && s0.hi === 84, `${tag} ${K}: 2-octave keys ${s0.lo}-${s0.hi}`);
      if (tag === '780x360' && pa) await p.screenshot({ path: path.join(OUT, `kbfix-user-${tag}.png`) });
      const rows = []; for (let m = 60; m <= 84; m++) rows.push(await tapKey(p, m)); D[K] = rows;
      checkKeys(`${tag} ${K}`, rows, 0, 'major', 60, 84);
      const held = []; for (const m of [67, 69, 71, 72, 79, 81, 83, 84]) held.push(await holdKey(p, m)); D[K + '-held'] = held; checkKeys(`${tag} ${K} held`, held, 0, 'major', 60, 84);
      F(!p.__errs.length, `${tag} ${K} errors ${p.__errs}`); await p.context().close(); }
    // 5) Kids (Full keys) and Simple (chips): recorded for the before/after comparison (Kids quality is unchanged by design)
    { const p = await open(b, w, h, { style: 'kids', simple: false, layout: 'octave', playAlong: false, lockKey: { pc: 0, mode: 'major' } }); const s = await kbState(p); D.kids = { win: [s.lo, s.hi], keys: [] };
      for (let m = s.lo; m <= s.hi; m++) D.kids.keys.push(await tapKey(p, m)); for (const r of D.kids.keys) if (!r.missing && !r.pa && !r.nokey) F(r.sounded[0] === r.midi, `${tag} kids key ${nm(r.midi)} root not lowest ${r.sounded}`);
      F(!p.__errs.length, `${tag} kids errors ${p.__errs}`); await p.context().close(); }
    { const p = await open(b, w, h, { style: 'pop', simple: true, playAlong: false, lockKey: { pc: 0, mode: 'major' } }); D.simple = [];
      for (const c of await chipPts(p)) { await take(p); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(250); const L = await take(p); D.simple.push({ chip: c.t, m: (L[0] || {}).m }); }
      F(D.simple.length === 7, `${tag} simple chips ${D.simple.length}`); F(!p.__errs.length, `${tag} simple errors ${p.__errs}`); await p.context().close(); }
    fs.writeFileSync(path.join(OUT, `kbfix-${tag}.json`), JSON.stringify(D, null, 1));
  }
  fs.writeFileSync(path.join(OUT, 'kbfix.json'), JSON.stringify(R, null, 1)); console.log(JSON.stringify({ fails: R.fails.length, first: R.fails.slice(0, 15) }, null, 1));
  await b.close();
})();

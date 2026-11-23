// rd17: keyboard bar (Type + Keys), three equal buttons, All notes, one home per control, Kids scrolling grid.
// Sizes: 360x780, 384x832, 412x915, 780x360, 844x390, 915x412, 800x330, 820x1180, 1180x820.
// node -r ./emulate.cjs rd17.cjs [WxH]   env BASE, OUT, SHOTS
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || process.env.BASE || 'http://localhost:8080/index.html';
const OUT = process.env.OUT || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const SHOTS = process.env.SHOTS || '/tmp/tc-shots/rd17'; fs.mkdirSync(SHOTS, { recursive: true });
const SIZES = process.argv[2] ? [process.argv[2].split('x').map(Number)] : [[360, 780], [384, 832], [412, 915], [780, 360], [844, 390], [915, 412], [800, 330], [820, 1180], [1180, 820]];
const R = { fails: [], data: {} }; const F = (c, m) => { if (!c) R.fails.push(m); };
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/upload/expert-song.json'), 'utf8'));
const SET = { s: { expert: true, simple: false, style: 'pop', layout: 'octave' }, x: { on: true, look: 'day' } };
async function open(b, w, h, setup, q) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const s = setup || SET;
  const ls = `localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:${JSON.stringify(s.s)}}));` + (s.x ? `localStorage.setItem('touchChord.expert.v1',${JSON.stringify(JSON.stringify(s.x))});` : '');
  await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');${ls}}}catch(e){}`);
  const p = await ctx.newPage(); p.__errs = [];
  p.on('pageerror', e => p.__errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') p.__errs.push(m.text()); });
  await p.goto(URL + (q || '?test=1&hour=12')); await p.waitForTimeout(1200);
  p.__cdp = await ctx.newCDPSession(p);
  return p;
}
const done = async (p, tag) => { for (const e of p.__errs) F(false, `${tag}: page error ${e}`); await p.context().close(); };
const box = p => p.evaluate(() => {
  const b = s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, tx: (e.innerText || '').replace(/\s+/g, ' ').trim() }; };
  const fit = s => { const e = document.querySelector(s); if (!e) return null; return { sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight }; };
  const de = document.documentElement;
  return { lay: ['phone-port', 'phone-land', 'pad-port', 'pad-land'].find(l => de.classList.contains('lay-' + l)),
    sus: b('#sustainBtn'), full: b('#xFull'), snd: b('#xSound'), type: b('#xType'), keys: b('#xKeysChip'),
    kb: b('.kb-wrap'), pads: b('#pads'), ctl: b('#xCtl'),
    fullFit: fit('#xFull'), sndFit: fit('#xSound span'), susFit: fit('#sustainBtn'),
    sub: (document.querySelector('#xFull .x-fsub') || {}).textContent, cap: (document.querySelector('#xSound small') || {}).textContent,
    typeIn: (e => e && e.parentElement ? (e.parentElement.id || e.parentElement.className) : null)(document.getElementById('xType')),
    keysIn: (e => e && e.parentElement ? (e.parentElement.id || e.parentElement.className) : null)(document.getElementById('xKeysChip')) };
});
async function extent(p, sel) {
  return p.evaluate(sel => {
    const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null;
    const r = e.getBoundingClientRect(), cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const hit = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const t = document.elementFromPoint(x, y); return !!(t && (t === e || e.contains(t))); };
    let up = 0, dn = 0; while (hit(cx, cy - up - 1) && up < 30) up++; while (hit(cx, cy + dn + 1) && dn < 30) dn++;
    const pads = [...document.querySelectorAll('#pads .pad')];
    const keysTop = pads.length ? Math.min(...pads.map(k => k.getBoundingClientRect().top)) : 0;
    const steal = pads.some(k => { const q = k.getBoundingClientRect(); const x = q.left + q.width / 2, y = q.top + Math.min(6, q.height / 2); const t = document.elementFromPoint(x, y); return t && (t === e || e.contains(t)); });
    return { h: up + dn + 1, up, dn, drawn: r.height, onKey: steal, keysTop, cy };
  }, sel);
}
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of SIZES) {
    const T = `${w}x${h}`, upright = h > w, phoneLand = w > h && h < 500, padLand = w > h && !phoneLand;
    const p = await open(b, w, h); const g = await box(p); R.data[T] = { lay: g.lay };
    F(!!g.sus && !!g.full && !!g.snd && !!g.type && !!g.keys, `${T}: a keyboard control is missing`);
    if (g.full) F(/All notes/.test(g.full.tx) && /in key only/.test(g.sub || ''), `${T}: All notes label "${g.full.tx}" / "${g.sub}"`);
    if (g.snd) F(/^Sound/.test(g.snd.tx) && g.cap === 'FX · Loop', `${T}: Sound caption "${g.cap}"`);
    if (upright) {
      F(g.typeIn !== 'xCtl' && /kb-wrap/.test(g.typeIn || '') && /kb-wrap/.test(g.keysIn || ''), `${T}: Type/Keys not in the keyboard bar (${g.typeIn}/${g.keysIn})`);
      if (g.sus && g.full && g.snd) {
        F(Math.abs(g.sus.w - g.full.w) <= 2 && Math.abs(g.full.w - g.snd.w) <= 2, `${T}: widths ${Math.round(g.sus.w)}/${Math.round(g.full.w)}/${Math.round(g.snd.w)}`);
        F(Math.abs(g.sus.h - g.full.h) <= 1 && Math.abs(g.full.h - g.snd.h) <= 1, `${T}: heights ${g.sus.h}/${g.full.h}/${g.snd.h}`);
        F(g.sus.l < g.full.l && g.full.l < g.snd.l, `${T}: order SUSTAIN, All notes, Sound`);
      }
      for (const id of ['#xFull', '#xSound', '#sustainBtn']) {
        const f = id === '#xFull' ? g.fullFit : id === '#xSound' ? g.sndFit : g.susFit;
        if (f) F(f.sw <= f.cw + 2, `${T}: ${id} wraps or clips (${f.sw}>${f.cw})`);
      }
      for (const sel of ['#xType', '#xKeysChip']) { const ex = await extent(p, sel);
        F(ex && ex.h >= 44 && !ex.onKey, `${T}: ${sel} hit ${ex && ex.h}px (drawn ${ex && ex.drawn}) steals keys ${ex && ex.onKey}`); }
      if (g.type && g.keys) F(g.type.r < g.keys.l - 4, `${T}: Type and Keys overlap ${g.type.r} ${g.keys.l}`);
    } else if (phoneLand) {
      F(g.typeIn === 'xCtl' && g.keysIn === 'xCtl', `${T}: Type/Keys left the column`);
      if (g.full && g.snd && g.type && g.keys && g.ctl) {
        F(Math.abs(g.full.w - g.snd.w) <= 3 && Math.abs(g.type.w - g.keys.w) <= 3, `${T}: half widths ${Math.round(g.full.w)}/${Math.round(g.snd.w)} ${Math.round(g.type.w)}/${Math.round(g.keys.w)}`);
        F(Math.abs(g.full.h - g.snd.h) <= 1 && Math.abs(g.type.h - g.keys.h) <= 1, `${T}: row heights ${g.full.h}/${g.type.h}`);
        F(g.full.h >= 32 && g.type.h >= 32 && g.type.t >= g.full.b - 2 && g.keys.l > g.type.r - 1, `${T}: crushed or overlapping column ${JSON.stringify([g.full, g.type, g.keys])}`);
        F(g.ctl.b <= (g.kb ? g.kb.t : h) + 1, `${T}: column overlaps the keys`);
        for (const [sel, f] of [['#xFull', g.fullFit], ['#xSound', g.sndFit]]) if (f) F(f.sw <= f.cw + 2, `${T}: ${sel} text overflow ${f.sw}>${f.cw}`);
      }
    } else if (padLand) {
      F(/kb-wrap/.test(g.typeIn || '') && /kb-wrap/.test(g.keysIn || ''), `${T}: Type/Keys not in the keyboard bar (${g.typeIn}/${g.keysIn})`);
      if (g.sus && g.full && g.snd) {
        F(g.sus.b <= g.full.t + 2 && g.full.l < g.snd.l && Math.abs(g.full.w - g.snd.w) <= 3 && Math.abs(g.full.h - g.snd.h) <= 1, `${T}: iPad column SUSTAIN then All notes | Sound ${JSON.stringify([g.sus, g.full, g.snd])}`);
        F(g.full.h >= 44 && g.snd.h >= 44, `${T}: All notes / Sound shorter than 44 (${g.full.h}/${g.snd.h})`);
      }
      for (const sel of ['#xType', '#xKeysChip']) { const ex = await extent(p, sel);
        F(ex && ex.h >= 44 && !ex.onKey, `${T}: ${sel} hit ${ex && ex.h}px (drawn ${ex && ex.drawn}) steals keys ${ex && ex.onKey}`); }
    }
    if (T === '360x780' || T === '780x360' || T === '800x330' || T === '820x1180' || T === '1180x820') await p.screenshot({ path: path.join(SHOTS, `keys-${T}.png`) });
    await done(p, T + ' layout');
  }
  // Type open / fold / modifier, All notes, Keys cycle + reset, duplicates, Sound, help. One phone and one short landscape.
  const BEH = { s: { expert: true, simple: false, style: 'pop', layout: 'octave', playAlong: false, paHints: false }, x: { on: true, look: 'day' } };
  for (const [w, h] of [[360, 780], [800, 330], [820, 1180]]) {
    const T = `${w}x${h}`; const p = await open(b, w, h, BEH);
    const folded = await p.evaluate(() => !document.documentElement.classList.contains('x-types-open') && getComputedStyle(document.getElementById('chords')).display === 'none');
    F(folded, `${T}: type table not folded at rest`);
    await p.click('#xType'); await p.waitForTimeout(250);
    let openT = await p.evaluate(() => document.documentElement.classList.contains('x-types-open') && getComputedStyle(document.getElementById('chords')).display !== 'none');
    F(openT, `${T}: tap did not open the type table`);
    const still = await p.evaluate(() => { const vis = e => e && e.getClientRects().length && getComputedStyle(e).display !== 'none';
      return { type: vis(document.getElementById('xType')), keys: vis(document.getElementById('xKeysChip')) }; });
    F(still.type && still.keys, `${T}: Type or Keys hidden while the table is open ${JSON.stringify(still)}`);
    await p.click('#xType'); await p.waitForTimeout(200);
    F(await p.evaluate(() => !document.documentElement.classList.contains('x-types-open')), `${T}: second tap did not fold the table`);
    // hold to peek
    const r = await p.evaluate(() => { const e = document.getElementById('xType'), q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    await p.__cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y }] });
    await p.waitForTimeout(400);
    F(await p.evaluate(() => document.documentElement.classList.contains('x-types-open')), `${T}: hold did not peek the table`);
    await p.__cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(200);
    F(await p.evaluate(() => !document.documentElement.classList.contains('x-types-open')), `${T}: releasing the hold did not fold the table`);
    // modifier label, then the same in-key chord
    await p.click('#xType'); await p.waitForTimeout(200);
    const mod = await p.evaluate(async () => {
      const el = document.querySelector('#palette [data-ext="maj7"]'), q = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: q.left + 8, clientY: q.top + 8, pointerType: 'touch' }));
      await new Promise(r => setTimeout(r, 40));
      const label = document.querySelector('#xType .x-tv').textContent;
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: q.left + 8, clientY: q.top + 8, pointerType: 'touch' }));
      await new Promise(r => setTimeout(r, 40));
      return { label, after: document.querySelector('#xType .x-tv').textContent };
    });
    F(mod.label === 'maj7' && mod.after === 'Auto', `${T}: type label ${JSON.stringify(mod)}`);
    await p.click('#xType'); await p.waitForTimeout(150);
    // All notes: subtitle, off-scale key, in-key chord unchanged
    const notes = await p.evaluate(async () => {
      const A = window.ChordAudio, played = []; const pc = A.playChord.bind(A);
      A.playChord = function (g, m, o) { played.push((m || []).slice().sort((a, b) => a - b)); return pc(g, m, o); };
      const key = pcN => [...document.querySelectorAll('#pads .pad')].find(k => +k.dataset.pc === pcN && k.getClientRects().length);
      const press = k => { const q = k.getBoundingClientRect(); k.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, clientX: q.left + q.width / 2, clientY: q.top + q.height * 0.7, pointerType: 'touch' }));
        k.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, clientX: q.left + q.width / 2, clientY: q.top + q.height * 0.7, pointerType: 'touch' })); };
      const black = key(1), white = key(5); const nokey = black && black.classList.contains('nokey');
      press(white); const inOff = played.splice(0).slice();
      if (black) press(black); const outOff = played.splice(0).slice();
      document.getElementById('xFull').click(); await new Promise(r => setTimeout(r, 200));
      const sub = document.querySelector('#xFull .x-fsub').textContent, on = document.getElementById('xFull').classList.contains('on');
      const nokeyOn = black && black.classList.contains('nokey');
      press(white); const inOn = played.splice(0).slice();
      if (black) press(black); const outOn = played.splice(0).slice();
      document.getElementById('xFull').click();
      return { nokey, sub, on, nokeyOn, inOff: inOff[0], inOn: inOn[0], outOff: outOff.length, outOn: outOn.length };
    });
    F(notes.nokey && notes.sub === 'all 12' && notes.on && notes.nokeyOn === false, `${T}: All notes state ${JSON.stringify(notes)}`);
    F(notes.inOff && notes.inOn && JSON.stringify(notes.inOff) === JSON.stringify(notes.inOn), `${T}: All notes changed an in-key chord ${JSON.stringify(notes.inOff)} vs ${JSON.stringify(notes.inOn)}`);
    F(notes.outOff === 0 && notes.outOn > 0, `${T}: off-scale key played while locked (${notes.outOff}) or stayed silent when unlocked (${notes.outOn})`);
    // Keys cycle + names
    const cyc = [];
    for (let i = 0; i < 4; i++) { cyc.push(await p.evaluate(() => ({ pick: __xmode.keys(), t: document.getElementById('xKeysChip').innerText.replace(/\s+/g, ' ').trim() }))); await p.click('#xKeysChip'); await p.waitForTimeout(250); }
    F(cyc.map(c => c.pick).join() === 'octave,full,buttons,octave', `${T}: cycle ${cyc.map(c => c.pick)}`);
    F(cyc[0].t.includes('Octave') && cyc[1].t.includes('Keyboard') && cyc[2].t.includes('Buttons') && !/Full|Fourths|Piano/.test(cyc.map(c => c.t).join(' ')), `${T}: names ${cyc.map(c => c.t)}`);
    await done(p, T + ' behavior');
  }
  // persistence, Start over -> Octave, duplicates, Sound, help, My songs. 360 only (plus a landscape help check).
  { const p = await open(b, 360, 780); const T = '360 persist';
    await p.click('#xKeysChip'); await p.waitForTimeout(200); await p.click('#xKeysChip'); await p.waitForTimeout(300);
    F(await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('touchChord.settings.v1')).settings.layout === 'fourths'; } catch (e) { return false; } }), `${T}: layout not saved`);
    await p.reload(); await p.waitForTimeout(1200);
    F(await p.evaluate(() => __xmode.keys() === 'buttons' && document.getElementById('xKeysChip').innerText.includes('Buttons')), `${T}: not restored`);
    await p.evaluate(() => { __ms.open(true); const r = document.getElementById('msReset'); if (r) r.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(300);
    const rows = await p.evaluate(() => [...document.querySelectorAll('#modeSheet [data-row]')].filter(e => !e.hidden && e.getClientRects().length).map(e => e.dataset.row));
    F(!rows.includes('keys') && !rows.includes('upload') && !rows.includes('help'), `${T}: duplicate rows ${rows}`);
    await p.screenshot({ path: path.join(SHOTS, 'settings-expert-360.png') });
    await p.click('#msReset'); await p.waitForTimeout(200);
    const er = await p.evaluate(() => { const e = document.querySelector('#msConfirm .ms-erase'); const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    await p.__cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: er.x, y: er.y }] });
    await p.waitForTimeout(2300);
    await p.__cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(500);
    F(await p.evaluate(() => __xmode.keys() === 'octave'), `${T}: Start over did not reset Keys to Octave`);
    // Sound
    await p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.remove('show'); });
    await p.click('#xSound'); await p.waitForTimeout(400);
    const snd = await p.evaluate(() => {
      const tab = s => { const e = document.querySelector(`#ctl .ctl-tabs button[data-tab="${s}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { vis: r.width > 0 && getComputedStyle(e).display !== 'none', t: e.textContent.trim() }; };
      const v = document.querySelector('#ctl .vhead'), sl = document.querySelector('#ctl #voicing'), band = document.querySelector('#ctl .band-row span');
      const inside = (a, b) => { const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return A.top >= B.top - 1 && A.bottom <= B.bottom + 1 && A.left >= B.left - 1 && A.right <= B.right + 1 && A.height > 8; };
      const sheet = document.getElementById('ctl');
      return { tabs: ['sound', 'fx', 'key', 'loop'].map(s => ({ s, ...tab(s) })), vClip: v.scrollWidth > v.clientWidth + 1, vIn: inside(v, sheet),
        sliderBelow: sl.getBoundingClientRect().top >= v.getBoundingClientRect().bottom - 1, bandIn: inside(band, sheet), bandClip: band.scrollWidth > band.clientWidth + 1,
        bandColor: getComputedStyle(band).color, ink: getComputedStyle(document.querySelector('#ctl .vhead b')).color };
    });
    F(snd.tabs.find(t => t.s === 'key').vis === false && snd.tabs.filter(t => t.s !== 'key').every(t => t.vis), `${T}: Layout tab ${JSON.stringify(snd.tabs)}`);
    F(!snd.vClip && snd.vIn && snd.sliderBelow && !snd.bandClip && snd.bandIn && snd.bandColor === snd.ink, `${T}: Voicing/Band clipped ${JSON.stringify(snd)}`);
    await p.screenshot({ path: path.join(SHOTS, 'sound-360.png') });
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    // Help menu
    await p.click('#xHelp'); await p.waitForTimeout(200);
    const menu = await p.evaluate(() => { const m = document.getElementById('helpMenu'); if (!m || m.hidden) return null; return [...m.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), h: r.height }; }); });
    F(menu && menu.map(x => x.t).join() === 'How to,Tour' && menu.every(x => x.h >= 44), `${T}: help menu ${JSON.stringify(menu)}`);
    await p.click('#helpMenu button[data-help="howto"]'); await p.waitForTimeout(300);
    F(await p.evaluate(() => !document.getElementById('howto').hidden && document.getElementById('helpMenu').hidden), `${T}: How to did not open`);
    await p.click('#howto .ht-x'); await p.waitForTimeout(200);
    await p.click('#xHelp'); await p.waitForTimeout(150); await p.click('#helpMenu button[data-help="tour"]'); await p.waitForTimeout(400);
    F(await p.evaluate(() => !document.getElementById('tour').hidden), `${T}: Tour did not open`);
    await p.click('#tour .tour-skip'); await p.waitForTimeout(200);
    // My songs: chart line is read-only, Lock is read-only, the song-strip Lock still toggles
    const TWO = JSON.parse(JSON.stringify(FX)); TWO.song.title = 'Rd17 Two';
    TWO.sectionsFull = JSON.parse(JSON.stringify(FX.sections)).map(s => { s.chords = s.chords.map(c => Object.assign({}, c, { chord: c.chord === 'C' ? 'Cmaj7' : c.chord })); return s; });
    F((await p.evaluate(t => __upload.load(JSON.stringify(t)), TWO)).ok, `${T}: song did not load`);
    await p.waitForTimeout(400);
    // Tapping Song while the song is already showing opens My songs (the upload dialog).
    await p.evaluate(() => document.querySelector('#xTog [data-v="song"]').click()); await p.waitForTimeout(400);
    if (await p.evaluate(() => document.getElementById('uploadPick').hidden)) { await p.evaluate(() => { const e = document.querySelector('#xSrc .x-songc'); if (e) e.click(); }); await p.waitForTimeout(400); }
    await p.evaluate(() => { const e = document.querySelector('#upLibList .ul-edit'); if (e) e.click(); }); await p.waitForTimeout(300);
    const lib = await p.evaluate(() => { const vis = e => e && !e.hidden && e.getClientRects().length; return {
      chart: (document.getElementById('upDChart') || {}).textContent, chartVis: vis(document.getElementById('upDChart')),
      radios: document.querySelectorAll('#upDHead [data-ver]').length, lockBtn: !!document.getElementById('upLock'),
      state: (document.getElementById('upLockState') || {}).textContent, locked: (document.getElementById('upLockState') || {}).dataset && document.getElementById('upLockState').dataset.locked }; });
    F(lib.chartVis && /easy chart in Simple/.test(lib.chart) && /full one in Expert/.test(lib.chart) && lib.radios === 0 && !lib.lockBtn && /Locked/.test(lib.state || ''), `${T}: My songs controls ${JSON.stringify(lib)}`);
    await p.click('#uploadPick .up-x'); await p.waitForTimeout(200);
    const before = await p.evaluate(() => document.querySelector('#xSrc .x-lock').getAttribute('aria-pressed'));
    await p.click('#xSrc .x-lock'); await p.waitForTimeout(300);
    const after = await p.evaluate(() => document.querySelector('#xSrc .x-lock').getAttribute('aria-pressed'));
    F(before && after && before !== after, `${T}: song-strip Lock did not toggle (${before} -> ${after})`);
    await done(p, T);
  }
  // Simple ? menu, no Settings help row. Kids keeps How to & tour and has no ? menu of its own on the play screen.
  { const p = await open(b, 360, 780, { s: { expert: true, simple: true, style: 'pop' } });
    await p.click('#howtoBtn'); await p.waitForTimeout(200);
    F(await p.evaluate(() => { const m = document.getElementById('helpMenu'); return !!(m && !m.hidden && m.innerText.includes('How to') && m.innerText.includes('Tour')); }), 'simple: ? did not open How to / Tour');
    await p.keyboard.press('Escape');
    await p.evaluate(() => __ms.open(true)); await p.waitForTimeout(250);
    const rows = await p.evaluate(() => [...document.querySelectorAll('#modeSheet [data-row]')].filter(e => !e.hidden && e.getClientRects().length).map(e => e.dataset.row));
    F(!rows.includes('help') && !rows.includes('upload') && !rows.includes('keys'), `simple settings rows ${rows}`);
    await p.screenshot({ path: path.join(SHOTS, 'settings-simple-360.png') });
    await done(p, 'simple help');
  }
  { const p = await open(b, 360, 780, { s: { expert: false, playAlong: true } });
    await p.click('#kv .kv-go'); await p.waitForTimeout(400);
    await p.evaluate(() => __ms.open(true)); await p.waitForTimeout(300);
    const rows = await p.evaluate(() => [...document.querySelectorAll('#modeSheet [data-row]')].filter(e => !e.hidden && e.getClientRects().length).map(e => e.dataset.row));
    F(rows.includes('help') && !rows.includes('upload') && !rows.includes('keys'), `kids settings rows ${rows}`);
    await p.screenshot({ path: path.join(SHOTS, 'settings-kids-360.png') });
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    await done(p, 'kids settings');
  }
  // Kids song grid: the current catalog, then a 20-card fixture (clones of the real cards, not new songs).
  const KIDS = [[360, 780], [384, 832], [412, 915], [780, 360], [820, 1180], [1180, 820]];
  for (const [w, h] of KIDS) {
    const T = `kids ${w}x${h}`; const p = await open(b, w, h, { s: { expert: false, playAlong: true } });
    await p.addScriptTag({ content: 'window.gridProbe = ' + gridProbe.toString() });
    await p.click('#kv .kv-go'); await p.waitForTimeout(500);
    const six = await p.evaluate(() => window.__kv.fitCards());
    const g6 = await p.evaluate(() => gridProbe());
    F(g6.n === 10 && g6.real === 10 && g6.picIn && g6.hit, `${T}: catalog ${JSON.stringify(g6)} plan ${JSON.stringify(six)}`);
    if (g6.peek === 0) F(g6.full === 10, `${T}: all-fit should show 10 rows-worth, got full ${g6.full}`);
    else F(g6.peek > 0 && g6.scroll, `${T}: catalog should peek/scroll when it does not all fit ${JSON.stringify(g6)}`);
    F(g6.cols === (g6.lay === 'phone-port' ? 2 : 3), `${T}: columns ${g6.cols} (${g6.lay})`);
    F(g6.fill >= 0.9 || (g6.sideL > 8 && Math.abs(g6.sideL - g6.sideR) < 12), `${T}: grid neither fills nor centers (fill ${g6.fill} gaps ${g6.sideL}/${g6.sideR})`);
    const pic0 = g6.pic, title0 = g6.title;
    await p.screenshot({ path: path.join(SHOTS, `kids6-${w}x${h}.png`) });
    const g20 = await p.evaluate(() => {
      const cards = document.querySelector('#kv .kv-cards'), src = [...cards.children];
      while (cards.children.length < 20) { const c = src[cards.children.length % src.length].cloneNode(true); c.classList.remove('last'); const b = c.querySelector('.kv-last'); if (b) b.remove(); c.addEventListener('click', () => {}); cards.appendChild(c); }
      const plan = window.__kv.fitCards(); const g = gridProbe(); return { plan, g };
    });
    F(g20.g.n === 20 && g20.g.pic === pic0 && g20.g.title === title0 && g20.g.picIn && g20.plan.peek > 0, `${T}: 20 ${JSON.stringify(g20.g)} plan ${JSON.stringify(g20.plan)}`);
    F(g20.g.peek >= 0.2 && g20.g.peek <= 0.55 && g20.g.partial >= 1 && g20.g.scroll, `${T}: peek ${g20.g.peek} partial ${g20.g.partial}`);
    F(g20.g.hit && g20.g.peekHit, `${T}: a card or its peek does not take the tap`);
    await p.evaluate(() => { const sc = document.querySelector('#kv .kv-songs'); sc.scrollTop = sc.scrollHeight; });
    await p.waitForTimeout(200);
    const end = await p.evaluate(() => { const sc = document.querySelector('#kv .kv-songs'), last = document.querySelector('#kv .kv-card:last-child').getBoundingClientRect(), v = sc.getBoundingClientRect();
      return { in: last.bottom <= v.bottom + 2 && last.top < v.bottom }; });
    F(end.in, `${T}: last row does not scroll into view`);
    await p.screenshot({ path: path.join(SHOTS, `kids20-${w}x${h}.png`) });
    await done(p, T);
  }
  // classic hatch still has the Layout tab (audioeq / grownup depend on it)
  { const p = await open(b, 360, 780, { s: { expert: true, simple: false, style: 'pop' } }, '?test=1&classic=1&hour=12');
    const vis = await p.evaluate(() => { const e = document.querySelector('#ctl .ctl-tabs button[data-tab="key"]'); return !!(e && getComputedStyle(e).display !== 'none'); });
    F(vis, 'classic hatch hid the Layout tab');
    await done(p, 'classic layout');
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'rd17.json'), JSON.stringify(R, null, 1));
  console.log(R.fails.length ? 'FAIL ' + R.fails.length + '\n' + R.fails.join('\n') : 'PASS', JSON.stringify(R.data).slice(0, 2000));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

function gridProbe() {
  const sc = document.querySelector('#kv .kv-songs'), cards = [...document.querySelectorAll('#kv .kv-card')];
  const view = sc.getBoundingClientRect(), rects = cards.map(c => c.getBoundingClientRect());
  const cols = getComputedStyle(document.querySelector('#kv .kv-cards')).gridTemplateColumns.split(' ').filter(Boolean).length;
  const full = rects.filter(r => r.top >= view.top - 1 && r.bottom <= view.bottom + 1);
  const partial = rects.filter(r => r.top < view.bottom - 4 && r.bottom > view.bottom + 4);
  const peek = partial[0] ? Math.round(((view.bottom - partial[0].top) / partial[0].height) * 100) / 100 : 0;
  const picIn = cards.every(c => { const p = c.querySelector('.kv-pic').getBoundingClientRect(), t = c.querySelector('.kv-ct').getBoundingClientRect(), r = c.getBoundingClientRect();
    return p.height > 20 && t.height > 10 && p.top >= r.top - 1 && p.bottom <= r.bottom + 1 && t.bottom <= r.bottom + 1; });
  const hitAt = (x, y) => { const t = document.elementFromPoint(x, y); return t && t.closest('.kv-card'); };
  const c0 = rects[0];
  const row0 = rects.filter(r => Math.abs(r.top - c0.top) < 4);
  const sideL = c0.left - view.left, sideR = view.right - row0[row0.length - 1].right;
  const peekCard = partial[0], peekHit = !peekCard || !!hitAt(peekCard.left + peekCard.width / 2, Math.min(peekCard.bottom - 8, view.bottom - 8));
  return { n: cards.length, real: cards.filter(c => c.dataset.song).length, cols, lay: ['phone-port', 'phone-land', 'pad-port', 'pad-land'].find(l => document.documentElement.classList.contains('lay-' + l)),
    pic: parseFloat(getComputedStyle(cards[0].querySelector('.kv-pic')).fontSize), title: parseFloat(getComputedStyle(cards[0].querySelector('.kv-ct')).fontSize),
    picIn, hit: hitAt(c0.left + c0.width / 2, c0.top + c0.height / 2) === cards[0], peekHit, peek, full: full.length, partial: partial.length,
    scroll: sc.scrollHeight > sc.clientHeight + 2, fill: (row0[row0.length - 1].right - c0.left) / view.width, sideL: Math.round(sideL), sideR: Math.round(sideR) };
}

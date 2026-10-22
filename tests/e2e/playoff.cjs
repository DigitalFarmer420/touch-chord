// v112.11 Play along OFF = no guide. For Pop Full (Octave keys), Jazz Full (2-octave keys), Pop Simple and Kids Full (Octave, Twinkle),
// in C major, at 360x780 and 780x360 (phone emulation via -r emulate.cjs: DPR 3, isMobile, hasTouch):
//  - ON: the next-chord marks show (yellow dot on the root key / Kids gold key, the marked chip's dot + outline, Kids gold pad);
//  - OFF: none of them is visible, but the mark classes are still there (same walk state);
//  - the switch toggles them live (ON -> OFF -> ON) without a reload;
//  - the same taps (every key and chip except the next-chord target, which advances when ON) sound the same MIDI ON and OFF,
//    a held key lights exactly its sounded notes on the keys (lit = sounded), and two Next taps sound the same;
//  - every key / chip / button rect is identical ON and OFF (same layout).
// Writes OUT/playoff.json (MIDI per case, for parity vs another build). env BASE, OUT, SHOTS, EXPECT_FIX=0 to record without failing.
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || process.env.BASE || 'http://localhost:8080/index.html';
const OUT = process.env.OUT || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const SHOTS = process.env.PO_SHOTS || ''; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const EXPECT = process.env.EXPECT_FIX !== '0';
const SIZES = process.argv[2] ? [process.argv[2].split('x').map(Number)] : [[360, 780], [780, 360]];
const ONLYC = process.env.PO_CASES ? process.env.PO_CASES.split(',') : null;
const CASES0 = [
  ['pop-full-octave', { style: 'pop', simple: false, layout: 'octave' }],
  ['jazz-full-2oct', { style: 'jazz', simple: false, layout: 'full' }],
  ['pop-simple', { style: 'pop', simple: true, layout: 'octave' }],
  ['kids-full-octave', { style: 'kids', simple: false, layout: 'octave' }],
];
const CASES = CASES0.filter(c => !ONLYC || ONLYC.includes(c[0]));
const w12 = n => ((n % 12) + 12) % 12;
const R = { fails: [], data: {} }; const F = (c, m) => { if (!c) R.fails.push(m); }; const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function open(b, w, h, cs, pa) {
  const s = Object.assign({ playAlong: pa, paHints: false, lockKey: { pc: 0, mode: 'major' }, keyRoot: 0, keyScale: 'major', rootPc: 0 }, cs);
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:${JSON.stringify(s)}}));}}catch(e){}`);
  const p = await ctx.newPage(); p.__errs = [];
  p.on('pageerror', e => p.__errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') p.__errs.push(m.text()); });
  await p.goto(URL + '?test=1'); await p.waitForTimeout(1500);
  await p.evaluate(() => { const A = window.ChordAudio; window.__L = []; const pc = A.playChord.bind(A);
    A.playChord = function (g, m, o) { window.__L.push({ g: String(g), m: (m || []).slice().sort((a, b) => a - b), bass: o && o.bass != null ? o.bass : null }); return pc(g, m, o); }; });
  p.__cdp = await ctx.newCDPSession(p);
  return p;
}
const take = p => p.evaluate(() => { const l = window.__L; window.__L = []; return l; });
// What the guide shows right now (computed paint), and whether the mark classes exist.
const marks = p => p.evaluate(() => {
  const vis = e => !!e && e.getClientRects().length > 0;
  const pseudo = (e, w) => { if (!vis(e)) return false; const c = getComputedStyle(e, w); return c.display !== 'none' && c.content !== 'none' && c.content !== 'normal' && c.visibility !== 'hidden'; };
  const outl = e => { if (!vis(e)) return false; const c = getComputedStyle(e); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0; };
  const keyRoot = [...document.querySelectorAll('#pads .pad.nx-root')].filter(vis);
  const keyNx = [...document.querySelectorAll('#pads .pad.nx')].filter(vis);
  const nxd = [...document.querySelectorAll('.nxd')].filter(e => vis(e) && getComputedStyle(e).display !== 'none');
  const nxdot = [...document.querySelectorAll('#suggest .nxdot, #palette .nxdot')].filter(vis);
  const kidPad = [...document.querySelectorAll('#suggest .ss-kidpad.nx')].filter(vis);
  const la = [...document.querySelectorAll('#suggest .la-play')].filter(vis);
  const arrow = document.getElementById('nxArrow');
  return {
    cls: { keyRoot: keyRoot.length, keyNx: keyNx.length, nxdot: nxdot.length, kidPad: kidPad.length },
    shown: { keyDot: keyRoot.filter(e => pseudo(e, '::before')).length, keyOutline: keyNx.filter(e => pseudo(e, '::after')).length,
      chipDot: nxd.length, chipOutline: nxdot.filter(outl).length, kidPadOutline: kidPad.filter(outl).length,
      kidPadDot: [...document.querySelectorAll('#suggest .ss-kidpad.nx-root')].filter(e => pseudo(e, '::before')).length,
      lookahead: la.filter(outl).length, arrow: !!arrow && vis(arrow) && getComputedStyle(arrow).display !== 'none' },
    paOff: document.documentElement.classList.contains('pa-off') };
});
const layout = p => p.evaluate(() => [...document.querySelectorAll('#pads .pad, #suggest button, #palette button, #prog button, #kidsLyr, #songBar')]
  .filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [e.id || e.className.split(' ')[0], Math.round(r.x * 10), Math.round(r.y * 10), Math.round(r.width * 10), Math.round(r.height * 10)]; }));
const kbState = p => p.evaluate(() => { const ps = [...document.querySelectorAll('#pads .pad')].filter(e => e.getClientRects().length && e.dataset.midi); const ms = ps.map(e => +e.dataset.midi);
  return { lo: ms.length ? Math.min(...ms) : null, hi: ms.length ? Math.max(...ms) : null, lit: ps.filter(e => e.classList.contains('selected')).map(e => +e.dataset.midi).sort((a, b) => a - b) }; });
// The taps: every visible key and every chip / Kids pad except the next-chord target (it advances when ON, by design).
const targets = p => p.evaluate(() => {
  const vis = e => !!e && e.getClientRects().length > 0; const kids = document.querySelector('#suggest.kids1') !== null;
  const tgtPc = new Set([...document.querySelectorAll('#pads .pad.nx-root')].map(e => ((+e.dataset.midi % 12) + 12) % 12));
  const nx = window.__nx ? __nx() : null; if (nx && nx.item && !kids) tgtPc.add(((nx.item.rootPc % 12) + 12) % 12);
  const keys = [...document.querySelectorAll('#pads .pad')].filter(e => vis(e) && e.dataset.midi && !e.classList.contains('nokey') && !tgtPc.has(((+e.dataset.midi % 12) + 12) % 12)).map(e => {
    const r = e.getBoundingClientRect(), black = e.classList.contains('black'); const x = r.x + r.width / 2, y = r.y + r.height * (black ? 0.45 : 0.86);
    return { kind: 'key', id: +e.dataset.midi, x, y, ok: e.contains(document.elementFromPoint(x, y)) }; }).filter(k => k.ok);
  const chipSel = kids ? '#suggest .ss-kidpad' : '#suggest .ss-chip, #suggest .ss-note';
  const tgtTxt = new Set([...document.querySelectorAll(chipSel)].filter(e => e.classList.contains('nxdot') || e.classList.contains('nx-root') || e.classList.contains('nx')).map(e => e.textContent.trim()));
  const chips = [...document.querySelectorAll(chipSel)].filter(e => vis(e) && !tgtTxt.has(e.textContent.trim())).slice(0, 10).map(e => { const r = e.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    return { kind: 'chip', id: e.textContent.trim(), x, y, ok: !!e.contains(document.elementFromPoint(x, y)) }; }).filter(k => k.ok);
  return keys.concat(chips); });
async function tapAll(p, list, tag, simple) {
  const rows = [];
  for (const t of list) {
    await take(p); await p.__cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t.x, y: t.y }] }); await p.waitForTimeout(160);
    const s = await kbState(p); await p.__cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(80);
    const L = await take(p); const snd = [...new Set(L.flatMap(x => x.m))].sort((a, b) => a - b);
    if (t.kind === 'key' && !simple) { const on = snd.filter(m => m >= s.lo && m <= s.hi); F(same(s.lit, on), `${tag} key ${t.id}: lit ${s.lit} != sounded on the keys ${on} (sounded ${snd})`); }
    rows.push({ kind: t.kind, id: t.id, calls: L.map(x => ({ g: x.g.replace(/\d+$/, ''), m: x.m, bass: x.bass })), win: [s.lo, s.hi], lit: s.lit });
    await p.waitForTimeout(1150);   // the window snap-back (KB_RESET_MS) settles before the next tap
  }
  return rows;
}
async function nextTwice(p) { const out = []; for (let i = 0; i < 2; i++) { await take(p); await p.evaluate(() => document.querySelector('#prog .pg-step').click()); await p.waitForTimeout(250); out.push((await take(p)).map(x => ({ m: x.m, bass: x.bass }))); await p.waitForTimeout(2600); } return out; }
const anyShown = m => m.shown.keyDot + m.shown.keyOutline + m.shown.chipDot + m.shown.chipOutline + m.shown.kidPadOutline + m.shown.kidPadDot + m.shown.lookahead + (m.shown.arrow ? 1 : 0);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of SIZES) for (const [name, cs] of CASES) {
    const tag = `${w}x${h} ${name}`; const D = R.data[tag] = {}; const f0 = R.fails.length;
    const pON = await open(b, w, h, cs, true); const mOn = await marks(pON); D.marksOn = mOn;
    if (SHOTS) await pON.screenshot({ path: path.join(SHOTS, `${w}x${h}-${name}-on.png`) });
    // ON: the guide shows
    if (cs.style === 'kids') { F(mOn.shown.kidPadOutline > 0 && mOn.shown.kidPadDot > 0, `${tag} ON: gold pad mark not shown`); if (!cs.simple) F(mOn.shown.keyDot > 0, `${tag} ON: gold key dot not shown`); }
    else { F(mOn.shown.chipDot > 0 && mOn.shown.chipOutline > 0, `${tag} ON: marked chip dot/outline not shown`); if (!cs.simple) F(mOn.shown.keyDot > 0, `${tag} ON: yellow dot on the keyboard not shown`); }
    F(!mOn.paOff, `${tag} ON: html.pa-off set`);
    const list = await targets(pON); D.taps = list.map(t => t.kind + ':' + t.id); F(list.length >= (cs.simple ? 3 : 10), `${tag}: only ${list.length} taps`);
    const layOn = await layout(pON);
    const tapsOn = await tapAll(pON, list, tag + ' ON', cs.simple);
    // the switch: OFF hides live, ON shows again
    await pON.evaluate(() => document.getElementById('playAlongBtn').click()); await pON.waitForTimeout(300); const mT = await marks(pON);
    if (EXPECT) { F(anyShown(mT) === 0, `${tag} switch OFF: guide still shown ${JSON.stringify(mT.shown)}`); F(mT.paOff, `${tag} switch OFF: no html.pa-off`); }
    F(same(mT.cls, mOn.cls), `${tag} switch OFF: mark classes changed ${JSON.stringify(mOn.cls)} -> ${JSON.stringify(mT.cls)}`);
    await pON.evaluate(() => document.getElementById('playAlongBtn').click()); await pON.waitForTimeout(300); const mB = await marks(pON);
    F(same(mB.shown, mOn.shown) || anyShown(mB) > 0, `${tag} switch back ON: guide not shown ${JSON.stringify(mB.shown)}`);
    const nextOn = await nextTwice(pON);
    F(!pON.__errs.length, `${tag} ON errors ${pON.__errs}`); await pON.context().close();
    // OFF (saved off, fresh load)
    const pOFF = await open(b, w, h, cs, false); const mOff = await marks(pOFF); D.marksOff = mOff;
    if (SHOTS) await pOFF.screenshot({ path: path.join(SHOTS, `${w}x${h}-${name}-off.png`) });
    if (EXPECT) { F(anyShown(mOff) === 0, `${tag} OFF: guide shown ${JSON.stringify(mOff.shown)}`); F(mOff.paOff, `${tag} OFF: no html.pa-off`); }
    F(same(mOff.cls, mOn.cls), `${tag} OFF: mark classes differ from ON ${JSON.stringify(mOn.cls)} vs ${JSON.stringify(mOff.cls)}`);
    F(same(await layout(pOFF), layOn), `${tag}: layout differs ON vs OFF`);
    const listOff = await targets(pOFF); F(same(listOff.map(t => t.kind + ':' + t.id), D.taps), `${tag}: tap list differs ON vs OFF`);
    const tapsOff = await tapAll(pOFF, list, tag + ' OFF', cs.simple);
    const nextOff = await nextTwice(pOFF);
    F(!pOFF.__errs.length, `${tag} OFF errors ${pOFF.__errs}`); await pOFF.context().close();
    tapsOn.forEach((r, i) => { const o = tapsOff[i]; F(o && same(r.calls, o.calls), `${tag} ${r.kind} ${r.id}: MIDI ON ${JSON.stringify(r.calls)} != OFF ${JSON.stringify(o && o.calls)}`); F(o && same(r.lit, o.lit) && same(r.win, o.win), `${tag} ${r.kind} ${r.id}: lit/window ON ${r.lit}/${r.win} != OFF ${o && o.lit}/${o && o.win}`); });
    F(same(nextOn, nextOff), `${tag}: Next MIDI ON ${JSON.stringify(nextOn)} != OFF ${JSON.stringify(nextOff)}`);
    D.midiOn = tapsOn; D.midiOff = tapsOff; D.nextOn = nextOn; D.nextOff = nextOff;
    console.log(`${tag}: ${list.length} taps, ${R.fails.length - f0} fails`); R.fails.slice(f0, f0 + 12).forEach(f => console.log('  ' + f.slice(0, 400)));
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'playoff.json'), JSON.stringify(R, null, 1));
  console.log(`playoff: ${R.fails.length} fails`); R.fails.slice(0, 40).forEach(f => console.log('  ' + f));
})().catch(e => { console.error('Error', e); process.exit(1); });

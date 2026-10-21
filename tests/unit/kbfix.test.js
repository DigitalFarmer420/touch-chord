// kb-fix: keyboard key taps vs chips (pitch parity, diatonic quality, determinism, lit = sounded,
// snap-back to the selected key's tonic). Runs the real app modules in node (dom-stub).
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './dom-stub.js';
const V = readFileSync(new URL('../../js/version.js', import.meta.url), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const S = await import(`../../js/state.js?v=${V}`); S.boot();
const P = await import(`../../js/ui/pads.js?v=${V}`);
const PB = await import(`../../js/songs/playback.js?v=${V}`);
const KB = await import(`../../js/ui/keyboard.js?v=${V}`);
const M = await import(`../../js/ui/kbmath.js?v=${V}`);
if (typeof globalThis.addEventListener !== "function") globalThis.addEventListener = () => {};
if (typeof globalThis.getComputedStyle !== "function") globalThis.getComputedStyle = () => new Proxy({}, { get: () => "0" });   // the window rebuild repaints the key row
(await import(`../../js/ui/strip.js?v=${V}`)).boot1();   // chip icons (the key chip repaint on a window rebuild uses them)
const { Theory: T } = await import(`../../js/theory/index.js?v=${V}`);
const { state, shared, fingers } = S;
const w12 = n => ((n % 12) + 12) % 12;
const KEYS = [['C', 0, 'major'], ['G', 7, 'major'], ['F', 5, 'major'], ['Am', 9, 'minor'], ['Ebm', 3, 'minor']];
const IV = { major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6] };

function setup(pc, mode, layout = 'octave') {
  for (const k in fingers) delete fingers[k];
  shared.paletteHolds = {};
  state.layout = layout; state.style = 'pop'; state.simple = false; state.keyMode = false; state.voicing = 'close';
  state.keyRoot = pc; state.keyScale = mode; shared.lockKey = { pc, mode };
  state.extensions = { six: false, min7: false, maj7: false, nine: false };
  state.type = 'major'; state.forceChord = null; state.rootMidi = null; state.stripSpell = null; state.bass = false;
  shared.kbWinLow = layout === 'full' ? null : M.tonicLow(pc); shared.kbKeyStay = false; shared.paKeyMidi = null;
}
const degs = (pc, mode) => T.scaleDegrees(pc, mode);
function chip(item) {   // what a chip / Next / Play step does to state, then its voicing (no key held)
  for (const k in fingers) delete fingers[k];
  PB.setItemState(item); state.rootMidi = null;
  const s = P.computeSpec(); return s.midis.slice();
}
function key(pc, midi) {   // a plain key tap (soundFinger: quality from the key, voiced from the key)
  state.forceChord = null;   // soundFinger clears a chip's forced chord first
  const f = { keyId: 'k', pc, midi, degree: null, force: null, kq: P.keyTapQuality(pc) };
  fingers[1] = f; const s = P.specFromFinger(f); delete fingers[1]; return { midis: s.midis.slice(), type: s.type, symbol: s.symbol };
}
const itemOf = (d, ext) => ({ rootPc: d.pc, type: d.type, degree: d.degree, extensions: ext || {}, rootSpell: d.rootSpell });

for (const [nm, pc, mode] of KEYS) {
  test(`${nm}: chips: root on its home-octave key (60 + pc), rising C..B, = the key tap on that key`, () => {
    setup(pc, mode); const lo = M.tonicLow(pc), roots = [];
    const D = degs(pc, mode).slice().sort((a, b) => a.pc - b.pc);   // grid columns: keyboard order by pitch class from C (strip.js stripModel)
    for (const d of D) {
      shared.kbWinLow = lo + 5;   // any history
      const c = chip(Object.assign(itemOf(d), { rootSpell: d.rootSpell }));
      shared.kbWinLow = c[0];   // the window moved to show the chip (kbWantLow = its lowest note)
      const k = key(d.pc, c[0]);
      assert.deepEqual(k.midis, c, `${nm} degree ${d.degree}: chip = its root key`);
      assert.deepEqual(c, IV[d.type].map(i => c[0] + i), `${nm} degree ${d.degree}: root position`);
      assert.equal(c[0], 60 + d.pc, `${nm} ${d.name}: home-octave key C4..B4`);
      roots.push(c[0]);
    }
    assert.ok(roots.every((r, i) => !i || r > roots[i - 1]), `${nm}: roots rise left to right ${roots}`);
    assert.equal(roots[D.findIndex(d => d.degree === 1)], lo, `${nm}: the tonic chip is the at-rest window's left key`);
  });
  test(`${nm}: snap-back target is the selected key's tonic`, () => {
    setup(pc, mode); assert.equal(KB.kbTonicLow(), { C: 60, G: 67, F: 65, Am: 69, Ebm: 63 }[nm]);
  });
  test(`${nm}: Full keyboard (C4..C6): a key plays the chip's notes on the chip's root key`, () => {
    setup(pc, mode, 'full');
    for (const d of degs(pc, mode)) { const c = chip(Object.assign(itemOf(d), { rootSpell: d.rootSpell })); const k = key(d.pc, c[0]); assert.deepEqual(k.midis, c, `${nm} ${d.degree}`); }
  });
}

test('C major at window 60: before/after table (G key = 67 71 74, root position, diatonic)', () => {
  setup(0, 'major');
  const want = { 60: [60, 64, 67], 62: [62, 65, 69], 64: [64, 67, 71], 65: [65, 69, 72], 67: [67, 71, 74], 69: [69, 72, 76], 71: [71, 74, 77], 72: [72, 76, 79] };
  for (const m in want) assert.deepEqual(key(w12(+m), +m).midis, want[m], 'key ' + m);
  assert.equal(key(7, 67).symbol, 'G'); assert.equal(key(2, 62).symbol, 'Dm'); assert.equal(key(11, 71).symbol, 'B\u00b0');
});

test('slash chips: chord in root position from the root, the slash bass under it (Am7/G, Em/B, C/E, Cmaj7/E)', () => {
  setup(0, 'major');
  const sl = (rootPc, type, ext, li) => chip({ rootPc, type, extensions: ext, rootSpell: { li, acc: 0 } });
  assert.deepEqual(sl(9, 'minor', { min7: true, over: 10 }, 5), [67, 69, 72, 76, 79], 'Am7/G = G4 under A4 C5 E5 G5');
  assert.deepEqual(sl(4, 'minor', { over: 7 }, 2), [59, 64, 67, 71], 'Em/B = B3 under E4 G4 B4');
  assert.deepEqual(sl(0, 'major', { over: 4 }, 0), [52, 60, 64, 67], 'C/E = E3 under C4 E4 G4');
  assert.deepEqual(sl(0, 'major', { maj7: true, over: 4 }, 0), [52, 60, 64, 67, 71], 'Cmaj7/E: no tone folded under the root');
});

test('out-of-key keys play a plain major triad; a held palette type still applies', () => {
  setup(0, 'major');
  assert.deepEqual(key(1, 61).midis, [61, 65, 68]);   // C#: major
  assert.deepEqual(key(10, 70).midis, [70, 74, 77]);   // Bb: major
  shared.paletteHolds = { 9: { kind: 'type', value: 'sus4' } }; state.type = 'sus4';
  assert.deepEqual(key(2, 62).midis, [62, 67, 69], 'held Sus4 on D');
  shared.paletteHolds = { 9: { kind: 'ext', value: 'min7' } }; state.type = 'major'; state.extensions.min7 = true;
  assert.deepEqual(key(7, 67).midis, [67, 71, 74, 77], 'held min7 on G = G7 (existing palette behavior)');
  shared.paletteHolds = {}; state.extensions.min7 = false;
});

test('quality after every chip, after Next (m7 step) and with stale chip extensions', () => {
  setup(0, 'major'); const D = degs(0, 'major');
  const want = D.map(d => d.type);
  const chips = [...D.map(d => itemOf(d)), { rootPc: 10, type: 'major', extensions: {} }, { rootPc: 2, type: 'major', extensions: { min7: true } },
    itemOf(D[5], { min7: true }), itemOf(D[0], { maj7: true }), itemOf(D[6], { min7: true }), { rootPc: 7, type: 'major', extensions: { min7: true, flat9: true }, rootSpell: null }];
  for (const c of chips) {
    chip(c); shared.kbWinLow = 60;
    D.forEach((d, i) => { const km = 60 + d.pc, k = key(d.pc, km); assert.deepEqual(k.midis, IV[want[i]].map(x => km + x), `after chip ${c.rootPc}/${c.type}/${JSON.stringify(c.extensions)}: key ${d.name}`); });
  }
});

test('reload with a saved root A: key taps unchanged (Now still shows Am)', async () => {
  const { applySettings } = await import(`../../js/settings.js?v=${V}`);
  const s = Object.assign(S.factoryDefaults(), { style: 'pop', rootPc: 9, keyRoot: 0, keyScale: 'major', lockKey: { pc: 0, mode: 'major' }, layout: 'octave', simple: false });
  try { applySettings(s); } catch (e) { /* DOM-only parts of applySettings under the stub */ }
  assert.equal(state.type, 'minor', 'v112.6 Now display: saved A in C major shows Am');
  for (const k in fingers) delete fingers[k]; shared.kbWinLow = 60; state.layout = 'octave'; state.simple = false; state.style = 'pop';
  assert.deepEqual(key(0, 60).midis, [60, 64, 67]); assert.deepEqual(key(11, 71).midis, [71, 74, 77]); assert.deepEqual(key(7, 67).midis, [67, 71, 74]);
});

test('determinism: 5 runs, random chip orders, same key-tap MIDI', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (const [nm, pc, mode] of KEYS) {
    setup(pc, mode); const lo = M.tonicLow(pc), D = degs(pc, mode);
    const ref = JSON.stringify(D.map(d => key(d.pc, lo + w12(d.pc - lo)).midis));
    const refChip = JSON.stringify(D.map(d => { shared.kbWinLow = lo + 7; return chip(itemOf(d)); }));
    for (let run = 0; run < 5; run++) {
      const order = D.slice().sort(() => rnd() - 0.5);
      order.forEach(d => { chip(itemOf(d, rnd() < 0.5 ? { min7: true } : {})); shared.kbWinLow = 48 + Math.floor(rnd() * 24); });
      shared.kbWinLow = lo;
      assert.equal(JSON.stringify(D.map(d => key(d.pc, lo + w12(d.pc - lo)).midis)), ref, `${nm} run ${run} keys`);
      assert.equal(JSON.stringify(D.map(d => chip(itemOf(d)))), refChip, `${nm} run ${run} chips do not depend on the window / order`);
    }
  }
});

test('lit = sounded inside the window; nothing lit or sounded left of the root', () => {
  for (const [nm, pc, mode] of KEYS) for (const layout of ['octave', 'full']) {
    setup(pc, mode, layout); const lo = layout === 'full' ? 60 : M.tonicLow(pc), hi = layout === 'full' ? 84 : lo + 12;
    for (let m = lo; m <= hi; m++) {
      const k = key(w12(m), m).midis, lit = k.filter(x => x >= lo && x <= hi);
      assert.equal(k[0], m, `${nm} ${layout} key ${m}: root lowest`);
      assert.ok(lit.every((x, i) => x === k[i]), `${nm} ${layout} key ${m}: lit is the in-window prefix of sounded`);
    }
  }
});

test('the window returns to the tonic within 1.2 s after release (KB_RESET_MS = 1000)', async () => {
  assert.equal(M.KB_RESET_MS, 1000);
  for (const [nm, pc, mode] of KEYS) {
    setup(pc, mode); shared.kbWinLow = M.tonicLow(pc) + 7; shared.kbKeyStay = true;   // shifted by a chip (or frozen by a Play along key)
    const t0 = Date.now(); KB.kbScheduleReset();
    await new Promise(r => setTimeout(r, 1200));
    assert.equal(shared.kbWinLow, M.tonicLow(pc), `${nm}: back at the tonic`); assert.equal(shared.kbKeyStay, false);
    assert.ok(Date.now() - t0 <= 1250);
  }
});
test('no snap-back under a held key or in Kids', async () => {
  setup(0, 'major'); shared.kbWinLow = 67; fingers[1] = { keyId: 'k', pc: 7, midi: 67 };
  assert.equal(KB.kbResetNow(), false); assert.equal(shared.kbWinLow, 67); delete fingers[1];
  state.style = 'kids'; shared.kbWinLow = 62; assert.equal(KB.kbResetNow(), false); assert.equal(shared.kbWinLow, 62);
});

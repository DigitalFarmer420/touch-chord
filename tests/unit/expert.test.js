// Expert redesign: the pure Expert logic (js/expert/model.js) and decision 9 (hold a chord type, tap a key)
// through the real app modules in node (dom-stub), like kbfix.test.js.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './dom-stub.js';
const V = readFileSync(new URL('../../js/version.js', import.meta.url), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const M = await import(`../../js/expert/model.js?v=${V}`);
const S = await import(`../../js/state.js?v=${V}`); S.boot();
const P = await import(`../../js/ui/pads.js?v=${V}`);
const PAL = await import(`../../js/ui/palette.js?v=${V}`);
const KM = await import(`../../js/ui/kbmath.js?v=${V}`);
if (typeof globalThis.addEventListener !== 'function') globalThis.addEventListener = () => {};
if (typeof globalThis.getComputedStyle !== 'function') globalThis.getComputedStyle = () => new Proxy({}, { get: () => '0' });
(await import(`../../js/ui/strip.js?v=${V}`)).boot1();
const { state, shared, fingers } = S;
const pcs = m => [...new Set(m.map(x => ((x % 12) + 12) % 12))].sort((a, b) => a - b);

// ---------- decision 9: hold a chord type, then tap a key ----------
function setup(pc = 0, mode = 'major') {
  for (const k in fingers) delete fingers[k];
  shared.paletteHolds = {};
  state.layout = 'octave'; state.style = 'pop'; state.simple = false; state.keyMode = false; state.voicing = 'close';
  state.keyRoot = pc; state.keyScale = mode; shared.lockKey = { pc, mode };
  state.extensions = { six: false, min7: false, maj7: false, nine: false };
  state.type = 'major'; state.forceChord = null; state.rootMidi = null; state.stripSpell = null; state.bass = false;
  shared.kbWinLow = KM.tonicLow(pc); shared.kbKeyStay = false; shared.paKeyMidi = null;
}
const sync = () => { PAL.syncPalette(); clearTimeout(shared.paletteTimer); shared.paletteTimer = 0; };   // the real palette sync (its 20 ms DOM repaint is dropped in node)
function hold(id, kind, value) { shared.paletteHolds[id] = { kind, value }; sync(); }
function letGo(id) { delete shared.paletteHolds[id]; sync(); }
function key(pc, midi) {   // a key tap as soundFinger does it (pads.js): quality from the held type, else the key's own chord
  state.forceChord = null;
  const f = { keyId: 'k', pc, midi, degree: null, force: null, kq: P.keyTapQuality(pc) };
  fingers[1] = f; const s = P.specFromFinger(f); delete fingers[1]; return { midis: s.midis.slice(), symbol: s.symbol };
}

test('decision 9: hold maj7, tap F -> Fmaj7 (F A C E), root lowest, rising', () => {
  setup();
  hold(21, 'ext', 'maj7');
  const k = key(5, 65);
  assert.deepEqual(k.midis, [65, 69, 72, 76]);
  assert.equal(k.symbol, 'Fmaj7');
  assert.deepEqual(M.typeBarLabel(shared.paletteHolds), { text: 'maj7', held: true });
  letGo(21);
});
test('decision 9: releasing the type returns the keys to normal (F = F major in C, D = Dm)', () => {
  setup();
  hold(21, 'ext', 'maj7'); letGo(21);
  assert.deepEqual(key(5, 65).midis, [65, 69, 72]);
  assert.deepEqual(key(2, 62).midis, [62, 65, 69]);
  assert.deepEqual(M.typeBarLabel(shared.paletteHolds), { text: 'Auto', held: false });
});
test('decision 9: every type on every white key plays that type on that note (pitch classes, root lowest)', () => {
  const T = [['type', 'major', [0, 4, 7]], ['type', 'minor', [0, 3, 7]], ['type', 'sus4', [0, 5, 7]], ['type', 'dim', [0, 3, 6]],
    ['ext', 'six', [0, 4, 7, 9]], ['ext', 'min7', [0, 4, 7, 10]], ['ext', 'maj7', [0, 4, 7, 11]], ['ext', 'nine', [0, 2, 4, 7]]];
  for (const [kind, value, iv] of T) for (const root of [0, 2, 4, 5, 7, 9, 11]) {
    setup(); hold(30, kind, value);
    const k = key(root, 60 + root);
    assert.deepEqual(pcs(k.midis), pcs(iv.map(i => root + i)), `${value} on ${root}`);
    assert.equal(Math.min(...k.midis), 60 + root, `${value} on ${root}: root is the lowest note`);
    assert.ok(k.midis.every((m, i) => !i || m > k.midis[i - 1]), 'rising');
    letGo(30);
  }
});
test('decision 9: two held buttons stack (Minor + min7 on A = Am7), label shows both', () => {
  setup(); hold(1, 'type', 'minor'); hold(2, 'ext', 'min7');
  const k = key(9, 69);
  assert.deepEqual(pcs(k.midis), pcs([9, 12, 16, 19]));
  assert.equal(k.symbol, 'Am7');
  assert.deepEqual(M.typeBarLabel(shared.paletteHolds), { text: 'Minor + min7', held: true });
  letGo(1); letGo(2);
});

// ---------- Type bar toggle (decision 2) ----------
test('Type bar: one tap opens the table, the next tap folds it (no Fold button)', () => {
  let s = M.typeBarInit(false);
  s = M.typeBarReduce(s, 'tap'); assert.equal(s.open, true);
  s = M.typeBarReduce(s, 'tap'); assert.equal(s.open, false);
  s = M.typeBarReduce(M.typeBarReduce(s, 'tap'), 'close'); assert.equal(s.open, false);
});
test('Type bar: hold peeks the table open; letting go folds it; a table opened by a tap stays docked', () => {
  let s = M.typeBarReduce(M.typeBarInit(false), 'hold'); assert.deepEqual([s.open, s.peek], [true, true]);
  s = M.typeBarReduce(s, 'release'); assert.equal(s.open, false);
  s = M.typeBarReduce(M.typeBarInit(false), 'tap'); s = M.typeBarReduce(s, 'hold'); s = M.typeBarReduce(s, 'release');
  assert.equal(s.open, true, 'tap-opened table ignores hold / release');
});
test('Type bar: peek + a chord type still held -> stays open until the type is let go', () => {
  let s = M.typeBarReduce(M.typeBarInit(false), 'hold');
  s = M.typeBarReduce(s, 'release', { paletteHeld: true }); assert.equal(s.open, true);
  s = M.typeBarReduce(s, 'paletteFree'); assert.equal(s.open, false);
  assert.equal(M.typeBarReduce(M.typeBarInit(true), 'paletteFree').open, true, 'paletteFree never folds a tap-opened table');
});
test('Type bar label: nothing held = Auto; last held type wins; extensions in table order', () => {
  assert.deepEqual(M.typeBarLabel({}), { text: 'Auto', held: false });
  assert.equal(M.typeBarLabel({ 1: { kind: 'type', value: 'sus4' } }).text, 'Sus4');
  assert.equal(M.typeBarLabel({ 1: { kind: 'ext', value: 'nine' }, 2: { kind: 'ext', value: 'six' } }).text, '6 + 9');
  assert.equal(M.typeBarLabel({ 1: { kind: 'type', value: 'minor' }, 2: { kind: 'type', value: 'dim' } }).text, 'Dim');
});

// ---------- Song | Progressions (decision 8) ----------
const R = (s, a, ctx) => M.sourceReduce(s, a, ctx);
test('Source: starts on Song when a song is selected, else Progressions; only one view at a time', () => {
  assert.deepEqual(M.sourceInit({ hasSong: true, songSelected: true }), { view: 'song', listOpen: false });
  assert.deepEqual(M.sourceInit({ hasSong: false, songSelected: false }), { view: 'prog', listOpen: false });
});
test('Source: tap Progressions opens the list (song keeps playing), a pick selects it and folds the list', () => {
  const ctx = { hasSong: true, songSelected: true };
  let r = R({ view: 'song', listOpen: false }, 'tapProg', ctx);
  assert.deepEqual(r, { s: { view: 'prog', listOpen: true }, fx: null });
  r = R(r.s, { type: 'pick', i: 2 }, ctx);
  assert.deepEqual(r, { s: { view: 'prog', listOpen: false }, fx: { pick: 2 } });
  r = R(r.s, 'tapBar', { hasSong: true, songSelected: false }); assert.equal(r.s.listOpen, true, 'the slim bar reopens the list');
  r = R(r.s, 'tapBar', {}); assert.equal(r.s.listOpen, false);
  r = R({ view: 'prog', listOpen: true }, 'tapProg', {}); assert.equal(r.s.listOpen, false, 'tapping the active tab folds the list');
});
test('Source: tap Song selects the loaded song; the active Song tab or no song opens the library', () => {
  assert.deepEqual(R({ view: 'prog', listOpen: true }, 'tapSong', { hasSong: true, songSelected: false }), { s: { view: 'song', listOpen: false }, fx: 'selectSong' });
  assert.deepEqual(R({ view: 'song', listOpen: false }, 'tapSong', { hasSong: true, songSelected: true }).fx, 'openLibrary');
  const r = R({ view: 'prog', listOpen: false }, 'tapSong', { hasSong: false, songSelected: false });
  assert.deepEqual(r, { s: { view: 'prog', listOpen: false }, fx: 'openLibrary' });
});
test('Source: sync follows a song loaded / unloaded elsewhere', () => {
  assert.equal(R({ view: 'prog', listOpen: true }, 'sync', { hasSong: true, songSelected: true }).s.view, 'song');
  assert.equal(R({ view: 'song', listOpen: false }, 'sync', { hasSong: true, songSelected: false }).s.view, 'prog');
  assert.equal(R({ view: 'song', listOpen: false }, 'sync', { hasSong: false, songSelected: false }).s.view, 'song', 'empty Song view stays until a tab is tapped');
});
test('Source helpers: step dots (gold now, dashed next) and the lyric word on gold', () => {
  assert.deepEqual(M.progDots(4, -1), ['next', '', '', '']);
  assert.deepEqual(M.progDots(4, 1), ['', 'now', 'next', '']);
  assert.deepEqual(M.progDots(4, 3), ['next', '', '', 'now']);
  const sec = { lyrics: [{ text: 'La la la la', markers: [{ charIndex: 0, chordIndex: 0 }, { charIndex: 6, chordIndex: 1 }] }, { text: 'Lo lo', markers: [{ charIndex: 3, chordIndex: 2 }] }] };
  assert.deepEqual(M.lyricNow(sec, 1), { before: 'La la ', word: 'la', after: ' la' });
  assert.deepEqual(M.lyricNow(sec, 2), { before: 'Lo ', word: 'lo', after: '' });
  assert.deepEqual(M.lyricNow(sec, -1), { before: '', word: 'La', after: ' la la la' });
  assert.equal(M.lyricNow({ lyrics: [] }, 0), null);
});

// ---------- mode switch (decision 11) and prefs ----------
test('Mode: Kids view = Kids, Simple switch = Simple, else Expert when on (not the Kids style), else classic Full', () => {
  assert.equal(M.modeOf({ kv: true, style: 'kids', simple: true, on: true }), 'kids');
  assert.equal(M.modeOf({ kv: false, style: 'kids', simple: false, on: true }), 'expert');   // rd4: a saved Expert setup with Kids = Expert (falls back to Pop)
  assert.equal(M.modeOf({ kv: false, style: 'kids', simple: false, on: false }), 'full');   // classic Kids style in the full app
  assert.equal(M.expertStyleFix({ kv: false, style: 'kids', simple: false, on: true }), 'pop');
  assert.equal(M.expertStyleFix({ kv: true, style: 'kids', simple: false, on: false }), null);
  assert.equal(M.expertStyleFix({ kv: false, style: 'kids', simple: false, on: false }), null);
  assert.equal(M.expertStyleFix({ kv: false, style: 'kids', simple: true, on: true }), 'pop');   // rd6: no Kids style in Simple either
  assert.equal(M.expertStyleFix({ kv: false, style: 'jazz', simple: false, on: true }), null);
  assert.equal(M.modeOf({ kv: false, style: 'jazz', simple: true, on: true }), 'simple');
  assert.equal(M.modeOf({ kv: false, style: 'jazz', simple: false, on: true }), 'expert');
  assert.equal(M.modeOf({ kv: false, style: 'jazz', simple: false, on: false }), 'full');
});
test('Mode switch targets: Kids opens the Kids view; leaving Kids goes back to the last style; Expert turns Simple off', () => {
  assert.deepEqual(M.modeTarget({ style: 'kids', simple: false }, 'expert', 'jazz'), { kv: false, style: 'jazz', simple: false, on: true });
  assert.deepEqual(M.modeTarget({ style: 'pop', simple: true }, 'expert', 'pop'), { kv: false, style: null, simple: false, on: true });
  assert.deepEqual(M.modeTarget({ style: 'rnb', simple: false }, 'kids', 'rnb'), { kv: true, style: null, simple: null, on: false });
  assert.deepEqual(M.modeTarget({ style: 'kids', simple: false }, 'simple', null), { kv: false, style: 'pop', simple: true, on: false });
});
test('Expert pref: Auto default (rd6; was Lamplight), own store key, ?expert=1/0', () => {
  assert.equal(M.EXPERT_STORE, 'touchChord.expert.v1');
  assert.deepEqual(M.parsePref('{}'), { v: 1, on: false, look: 'auto' });
  assert.deepEqual(M.parsePref('nope'), { v: 1, on: false, look: 'auto' });
  assert.deepEqual(M.parsePref('{"on":true,"look":"lamp"}'), { v: 1, on: true, look: 'lamp' });   // a saved Lamp is kept
  assert.deepEqual(M.parsePref('{"on":true,"look":"day"}'), { v: 1, on: true, look: 'day' });
  assert.equal(M.prefFromUrl('?test=1&expert=1', M.expertDefaults()).on, true);
  assert.equal(M.prefFromUrl('?expert=0', { v: 1, on: true, look: 'lamp' }).on, false);
  assert.equal(M.expertWindowKeys('octave'), 12); assert.equal(M.expertWindowKeys('full'), 0);
});
test('Style drop-down lists the grown-up styles, Lofi last', () => {
  assert.deepEqual(M.STYLE_MENU.map(s => s[0]), ['pop', 'jazz', 'rnb', 'ballad', 'reggae', 'funk', 'yogaDeep', 'country', 'lofi']);
  assert.deepEqual(M.STYLE_MENU.find(s => s[0] === 'lofi').slice(1), ['Lofi', 'dusty 9ths']);
});

test('fitPopover keeps a menu in the band, clear of the opener and the piano', () => {
  const anchor = { left: 128, top: 4, right: 228, bottom: 44 };
  const piano = { left: 8, top: 266, right: 772, bottom: 358 };
  const toggle = { left: 16, top: 90, right: 540, bottom: 154 };
  const nine = 9 * 46 + 12;
  const land = M.fitPopover({
    anchor, bandTop: 44, bandBottom: piano.top, viewW: 780, width: 172, height: nine,
    align: 'start', keepClear: [anchor, piano]
  });
  assert.ok(land.top >= 44, 'below the top bar');
  assert.ok(land.top + land.maxHeight <= piano.top, 'stops at the piano');
  assert.ok(land.maxHeight < nine, 'nine styles scroll inside the short band');
  assert.ok(land.maxHeight > 46, 'at least one style row stays visible');
  const port = M.fitPopover({
    anchor: { left: 214, top: 16, right: 384, bottom: 80 },
    bandTop: 80, bandBottom: 778, viewW: 820, width: 172, height: nine,
    align: 'start', keepClear: [toggle, { left: 16, top: 778, right: 804, bottom: 1168 }]
  });
  assert.ok(port.top >= toggle.bottom - 0.5, 'starts below Song | Progressions');
  assert.ok(port.top + port.maxHeight <= 778, 'stops above the iPad piano');
  assert.ok(port.maxHeight >= nine, 'the portrait band fits every style');
  const help = M.fitPopover({
    anchor: { left: 732, top: 4, right: 772, bottom: 44 },
    bandTop: 44, bandBottom: 266, viewW: 780, width: 148, height: 106,
    align: 'end', keepClear: [
      { left: 107, top: 47, right: 642, bottom: 93 },
      { left: 645, top: 47, right: 772, bottom: 93 }
    ]
  });
  assert.equal(help.left + 148 <= 780, true);
  assert.ok(help.top >= 93, 'clears the song row under the ? button');
  assert.ok(help.top + Math.min(106, help.maxHeight) <= 266);
  assert.ok(help.maxHeight >= 106);
});

test('Expert Play face is a stop square only while playing, and Play again when it ends', () => {
  assert.deepEqual(M.expertPlayFace('idle'), { glyph: '\u25b6', stop: false });
  assert.deepEqual(M.expertPlayFace('paused'), { glyph: '\u25b6', stop: false });
  assert.deepEqual(M.expertPlayFace('playing'), { glyph: '\u25a0', stop: true });
  assert.deepEqual(M.expertPlayFace('idle'), { glyph: '\u25b6', stop: false });
  const ui = readFileSync(new URL('../../js/expert/ui.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../css/expert.css', import.meta.url), 'utf8');
  const kids = readFileSync(new URL('../../js/kids/view.js', import.meta.url), 'utf8');
  assert.match(ui, /expertPlayFace\(transportLabel\(\)\)/);
  assert.match(ui, /classList\.toggle\("is-stop", face\.stop\)/);
  assert.match(ui, /setAttribute\("aria-label", xl\.aria\)/);
  assert.match(ui, /\$\("xPlay"\)\.addEventListener\("click", function \(\) \{ click\("#prog \.pg-song"\); paintPlayFace\(\); schedule\(\); \}\)/);
  assert.match(css, /#xGo \.x-play\.is-stop \{/);
  assert.match(css, /fill='%232B2118'/);
  assert.doesNotMatch(css, /#xGo \.x-play\.is-stop[^}]*background-color:\s*var\(--x-next\)|#xGo \.x-play\.is-stop[^}]*background:\s*var\(--copper\)/);
  assert.doesNotMatch(kids, /is-stop|expertPlayFace/);
  assert.match(kids, /Play stays ▶ while a song plays/);
});

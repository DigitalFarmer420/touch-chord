import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { store } from './dom-stub.js';
const root = new URL('../../', import.meta.url).pathname;
const V = readFileSync(root + 'js/version.js', 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const S = await import(`../../js/state.js?v=${V}`);
S.boot();   // the state module's boot step (sets VOICINGS from Theory), as main.js does
const saved = JSON.parse(readFileSync(new URL('./v112.3-localStorage.json', import.meta.url), 'utf8'));   // real v112.3 storage

test('storage keys are unchanged from v112.3', () => {
  const src = f => readFileSync(root + f, 'utf8');
  assert.match(src('js/state.js'), /STORE_KEY = "touchChord\.settings\.v1"/);
  assert.match(src('js/state.js'), /STORE_VERSION = 1;/);
  assert.match(src('js/songs/library.js'), /LIB_STORE = "touchChord\.library\.v1"/);
  assert.match(src('js/ui/tour.js'), /TOUR_KEY = "touchChord\.tour\.v1"/);
  assert.match(src('js/songs/upload.js'), /UP_STORE = "touchChord\.upload\.v1"/);
  assert.deepEqual(Object.keys(saved).sort(), ['touchChord.library.v1', 'touchChord.settings.v1', 'touchChord.tour.v1']);
});
test('first visit (no storage): factory defaults in Kids', () => {
  for (const k in store) delete store[k];
  const s = S.loadSettings(); assert.equal(s.style, 'kids'); assert.equal(s.simple, false);
});
test('v112.3 saved settings load unchanged', () => {
  for (const k in store) delete store[k]; store['touchChord.settings.v1'] = saved['touchChord.settings.v1'];
  const s = S.loadSettings(), want = JSON.parse(saved['touchChord.settings.v1']).settings;
  for (const k of ['style', 'sound', 'bass', 'keyRoot', 'keyScale', 'voicing', 'cutoff', 'reverb', 'delay', 'bpm', 'warmth', 'simple', 'playAlong', 'paHints', 'volume'])
    assert.deepEqual(s[k], want[k], k);
});
test('wrong envelope version or junk falls back to defaults', () => {
  const d = S.factoryDefaults();
  store['touchChord.settings.v1'] = JSON.stringify({ v: 2, settings: { style: 'jazz' } }); assert.deepEqual(S.loadSettings(), d);
  store['touchChord.settings.v1'] = '{not json'; assert.deepEqual(S.loadSettings(), d);
});
test('invalid values are sanitized', () => {
  store['touchChord.settings.v1'] = JSON.stringify({ v: 1, settings: { style: 'bogus', sound: 42, bpm: 'fast', simple: true } });
  const s = S.loadSettings(), d = S.factoryDefaults();
  assert.equal(s.style, d.style); assert.equal(s.sound, d.sound); assert.equal(s.simple, true);
});
// Kids redesign: Simple/Expert, the theme and the last Kids song persist; old saves stay in Expert (the full app).
test('Kids redesign: first visit = Simple (Kids view), Auto look (rd6); old v112.3 saves open Expert', () => {
  for (const k in store) delete store[k];
  let s = S.loadSettings(); assert.equal(s.expert, false); assert.equal(s.theme, 'auto'); assert.equal(s.kidsSong, null);
  store['touchChord.settings.v1'] = saved['touchChord.settings.v1'];
  s = S.loadSettings(); assert.equal(s.expert, true); assert.equal(s.theme, 'auto');   // never picked = Auto
  assert.equal(S.factoryDefaults().expert, true); assert.equal(S.factoryDefaults().theme, 'auto');
});
test('Kids redesign: expert / theme / kidsSong saved values load back; junk is sanitized', () => {
  const put = o => { for (const k in store) delete store[k]; store['touchChord.settings.v1'] = JSON.stringify({ v: 1, settings: Object.assign(JSON.parse(saved['touchChord.settings.v1']).settings, o) }); return S.loadSettings(); };
  let s = put({ expert: false, theme: 'lamp', kidsSong: 'Kids Row Your Boat' });
  assert.equal(s.expert, false); assert.equal(s.theme, 'lamp'); assert.equal(s.kidsSong, 'Kids Row Your Boat');
  s = put({ expert: 'yes', theme: 'neon', kidsSong: 42 }); assert.equal(s.expert, true); assert.equal(s.theme, 'auto'); assert.equal(s.kidsSong, null);
  s = put({ theme: 'day' }); assert.equal(s.theme, 'day');   // rd6: a saved Day pick is kept
  s = put({ theme: 'auto' }); assert.equal(s.theme, 'auto');
  s = put({ kidsWalk: { name: 'Kids Twinkle', t: 3 } }); assert.deepEqual(s.kidsWalk, { name: 'Kids Twinkle', t: 3 });   // rd6: the Kids step
  s = put({ kidsWalk: { name: 'Kids Twinkle', end: true } }); assert.deepEqual(s.kidsWalk, { name: 'Kids Twinkle', end: true });
  s = put({ kidsWalk: { name: 5, t: 'x' } }); assert.equal(s.kidsWalk, null);
  s = put({}); assert.equal(s.jam, false);   // Jam defaults off; a missing value stays off
  s = put({ jam: true }); assert.equal(s.jam, true);
  s = put({ jam: 'yes' }); assert.equal(s.jam, false);
  const src = readFileSync(root + 'js/state.js', 'utf8');
  assert.match(src, /expert: state\.expert !== false/); assert.match(src, /theme: state\.theme === "lamp" \|\| state\.theme === "day" \? state\.theme : "auto"/); assert.match(src, /kidsWalk: state\.kidsWalk \|\| null/); assert.match(src, /kidsSong: state\.kidsSong \|\| null/);
});

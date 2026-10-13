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

import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kidsSongProblems, KIDS_LYRICS } from '../../js/songs/kids-songs.js';
import { lookFor, autoLook, sanitizeLook, lookQuiet, LOOK_CHOICES, LOOK_LABELS, LOOK_PAUSE_MS } from '../../js/ui/lookmath.js';
import { sanitizePref, expertDefaults, modeOf, fullToExpert, chartFor, expertStyleFix } from '../../js/expert/model.js';
const SRC = readFileSync(new URL('../../js/songs/presets.js', import.meta.url), 'utf8');
const KIDS = [...SRC.matchAll(/P\("(Kids [^"]+)", "([^"]+)"\)/g)].map(m => m[1]);
const at = h => new Date(2026, 9, 31, h, 30);
test('rd6: every Kids song has lyrics (no empty lyrics box possible)', () => {
  assert.equal(KIDS.length, 10);
  assert.deepEqual(kidsSongProblems(KIDS), []);
  for (const n of KIDS) assert.ok(KIDS_LYRICS[n].map(l => l.text).join('').trim().length > 10, n);
});
test('rd6: the Kids song check catches empty lyrics', () => {
  assert.deepEqual(kidsSongProblems(['Kids X'], { 'Kids X': [] }), ['Kids X: no lyrics']);
  assert.deepEqual(kidsSongProblems(['Kids X'], {}), ['Kids X: no lyrics']);
  assert.deepEqual(kidsSongProblems(['Kids X'], { 'Kids X': [{ text: '  ', markers: [{ charIndex: 0, chordIndex: 0 }] }] }), ['Kids X: line 1 is empty']);
  assert.deepEqual(kidsSongProblems(['Kids X'], { 'Kids X': [{ text: 'la', markers: [] }] }), ['Kids X: line 1 has no markers']);
});
test('rd6 Look: Auto · Day · Lamp, Auto = Day 7:00-19:00 by the device clock', () => {
  assert.deepEqual(LOOK_CHOICES, ['auto', 'day', 'lamp']); assert.deepEqual(Object.values(LOOK_LABELS), ['Auto', 'Day', 'Lamp']);
  assert.equal(autoLook(new Date(2026, 9, 31, 6, 59)), 'lamp'); assert.equal(autoLook(new Date(2026, 9, 31, 7, 0)), 'day');
  assert.equal(autoLook(new Date(2026, 9, 31, 18, 59)), 'day'); assert.equal(autoLook(new Date(2026, 9, 31, 19, 0)), 'lamp');
  assert.equal(lookFor('auto', at(12)), 'day'); assert.equal(lookFor('auto', at(22)), 'lamp');
  assert.equal(lookFor('day', at(22)), 'day'); assert.equal(lookFor('lamp', at(12)), 'lamp');
  assert.equal(sanitizeLook('x', 'auto'), 'auto'); assert.equal(sanitizeLook('lamp', 'auto'), 'lamp');
});
test('rd6 Look: the switch waits for a pause in playing', () => {
  assert.equal(lookQuiet({ busy: true, now: 1e6, lastNote: 0 }), false);
  assert.equal(lookQuiet({ busy: false, now: 1000, lastNote: 0 }), false);
  assert.equal(lookQuiet({ busy: false, now: LOOK_PAUSE_MS, lastNote: 0 }), true);
  assert.ok(LOOK_PAUSE_MS >= 2000 && LOOK_PAUSE_MS <= 6000);
});
test('rd6 Expert pref: Auto for new / unset, saved Day / Lamp kept', () => {
  assert.equal(expertDefaults().look, 'auto'); assert.equal(sanitizePref({}).look, 'auto'); assert.equal(sanitizePref({ on: true }).look, 'auto');
  assert.equal(sanitizePref({ look: 'lamp' }).look, 'lamp'); assert.equal(sanitizePref({ look: 'day' }).look, 'day'); assert.equal(sanitizePref({ look: 'auto' }).look, 'auto');
});
test('rd6: the classic Full layout opens in Expert (not with the test-only classic screens); Simple stays Simple', () => {
  assert.equal(modeOf({ kv: false, simple: false, on: false }), 'full');
  assert.equal(fullToExpert({ kv: false, simple: false, on: false }), true);
  assert.equal(fullToExpert({ kv: false, simple: false, on: false, classic: true }), false);
  assert.equal(fullToExpert({ kv: false, simple: true, on: false }), false);
  assert.equal(fullToExpert({ kv: true, simple: false, on: false }), false);
  assert.equal(fullToExpert({ kv: false, simple: false, on: true }), false);
});
test('rd6: no Kids style in Simple (saved Simple + Kids loads as Pop) or Expert', () => {
  assert.equal(expertStyleFix({ kv: false, simple: true, on: false, style: 'kids' }), 'pop');
  assert.equal(expertStyleFix({ kv: false, simple: true, on: false, style: 'kids', classic: true }), null);
  assert.equal(expertStyleFix({ kv: false, simple: false, on: true, style: 'kids' }), 'pop');
  assert.equal(expertStyleFix({ kv: true, simple: false, on: false, style: 'kids' }), null);
  assert.equal(expertStyleFix({ kv: false, simple: true, on: false, style: 'jazz' }), null);
});
test('rd6: uploaded song chart by mode', () => {
  assert.equal(chartFor('simple', true), 'simple'); assert.equal(chartFor('expert', true), 'full');
  assert.equal(chartFor('kids', true), null); assert.equal(chartFor('expert', false), null); assert.equal(chartFor('simple', false), null);
});

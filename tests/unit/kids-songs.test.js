import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Kids song data check, read from the app's own preset source (no DOM needed).
const SRC = readFileSync(new URL('../../js/songs/presets.js', import.meta.url), 'utf8');
const KIDS = {}; for (const m of SRC.matchAll(/P\("(Kids [^"]+)", "([^"]+)"\)/g)) KIDS[m[1]] = m[2].split('|');
const STEP = /^[1-7] (maj|min|dim|aug|sus2|sus4|7|maj7|m7)[^ ]* x(\d*\.?\d+) @(-?\d+)$/;
test('eleven Kids songs, every step well formed', () => {
  assert.equal(Object.keys(KIDS).length, 11, Object.keys(KIDS).join(', '));
  for (const [n, steps] of Object.entries(KIDS)) for (const s of steps) assert.match(s, STEP, `${n}: "${s}"`);
});
test('Row Your Boat: "merrily" first three notes an octave lower (v112.4)', () => {
  const s = KIDS['Kids Row Your Boat']; assert.ok(s);
  assert.deepEqual(s.map(x => +x.match(STEP)[3]), [0,0,0,2,4,4,2,4,5,7,0,0,0,7,7,7,4,4,4,0,0,0,7,5,4,2,0]);
  assert.deepEqual(s.map(x => x.replace(/ @-?\d+$/, '')).slice(10, 13), ['1 maj x0.125', '1 maj x0.125', '1 maj x0.125']);
});
test('Hot Cross Buns (v112.4): 17 notes, chords, lengths, lyrics', async () => {
  const s = KIDS['Kids Hot Cross Buns']; assert.ok(s); assert.equal(s.length, 17);
  assert.deepEqual(s.map(x => +x.match(STEP)[3]), [4,2,0,4,2,0,0,0,0,0,2,2,2,2,4,2,0]);
  assert.deepEqual(s.map(x => x.split(' ')[0]).join(''), '11111111115555111');
  assert.deepEqual(s.map(x => +x.match(STEP)[2]), [.25,.25,.5,.25,.25,.5,.125,.125,.125,.125,.125,.125,.125,.125,.25,.25,.5]);
  const K = readFileSync(new URL('../../js/songs/kids-songs.js', import.meta.url), 'utf8');
  const line = K.split('\n').find(l => l.startsWith('  "Kids Hot Cross Buns":['));
  const ly = JSON.parse(line.slice(line.indexOf('['), line.lastIndexOf(']') + 1));
  assert.deepEqual(ly.map(l => l.text), ['Hot cross buns,', 'Hot cross buns,', 'One a penny, two a penny,', 'Hot cross buns.']);
  assert.deepEqual(ly.flatMap(l => l.markers.map(m => m.chordIndex)), [...Array(17).keys()]);
  assert.match(K, /"Kids Hot Cross Buns": \["C", "major"\]/);
});

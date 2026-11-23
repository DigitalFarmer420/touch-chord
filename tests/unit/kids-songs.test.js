import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Kids song data check, read from the app's own preset source (no DOM needed).
const SRC = readFileSync(new URL('../../js/songs/presets.js', import.meta.url), 'utf8');
const KIDS = {}; for (const m of SRC.matchAll(/P\("(Kids [^"]+)", "([^"]+)"\)/g)) KIDS[m[1]] = m[2].split('|');
const STEP = /^[1-7] (maj|min|dim|aug|sus2|sus4|7|maj7|m7)[^ ]* x(\d*\.?\d+) @(-?\d+)$/;
// Kids redesign: exactly ten songs, in this order (Twinkle first = the default).
const TEN = ['Kids Twinkle', 'Kids Old MacDonald', 'Kids Itsy Bitsy Spider', 'Kids Row Your Boat', 'Kids Head Shoulders Knees and Toes', "Kids Mary's Lamb", 'Kids Happy Birthday', 'Kids Jingle Bells', 'Kids London Bridge', 'Kids This Old Man'];
test('ten Kids songs, in order, every step well formed', () => {
  assert.deepEqual(Object.keys(KIDS), TEN);
  for (const [n, steps] of Object.entries(KIDS)) for (const s of steps) assert.match(s, STEP, `${n}: "${s}"`);
});
test('Kids melodies stay in the C..B octave except Head Shoulders (high C/D), Itsy Bitsy (low G) and Happy Birthday (G3–B3)', () => {
  const out = {}; for (const [n, steps] of Object.entries(KIDS)) { const o = steps.map(x => +x.match(STEP)[3]).filter(m => m < 0 || m > 11); if (o.length) out[n] = [...new Set(o)].sort((a, b) => a - b); }
  assert.deepEqual(out, { 'Kids Itsy Bitsy Spider': [-5], 'Kids Head Shoulders Knees and Toes': [12, 14], 'Kids Happy Birthday': [-5, -3, -1] });
});
test('every Kids song has lyrics with one marker per step, and a C major song key; removed songs are gone', async () => {
  const { KIDS_LYRICS, KIDS_SONG_KEY } = await import('../../js/songs/kids-songs.js');
  assert.deepEqual(Object.keys(KIDS_LYRICS).sort(), [...TEN].sort()); assert.deepEqual(Object.keys(KIDS_SONG_KEY).sort(), [...TEN].sort());
  for (const n of TEN) { assert.deepEqual(KIDS_LYRICS[n].flatMap(l => l.markers.map(m => m.chordIndex)), [...Array(KIDS[n].length).keys()], n); assert.deepEqual(KIDS_SONG_KEY[n], ['C', 'major']); }
});
test('Row Your Boat: "merrily" first three notes an octave lower (v112.4)', () => {
  const s = KIDS['Kids Row Your Boat']; assert.ok(s);
  assert.deepEqual(s.map(x => +x.match(STEP)[3]), [0,0,0,2,4,4,2,4,5,7,0,0,0,7,7,7,4,4,4,0,0,0,7,5,4,2,0]);
  assert.deepEqual(s.map(x => x.replace(/ @-?\d+$/, '')).slice(10, 13), ['1 maj x0.125', '1 maj x0.125', '1 maj x0.125']);
});

test('four new Kids songs: step counts match one note per syllable, and written chords land where the charts say', () => {
  const want = {
    'Kids Happy Birthday': 25,
    'Kids Jingle Bells': 51,
    'Kids London Bridge': 24,
    'Kids This Old Man': 32
  };
  for (const [n, count] of Object.entries(want)) {
    assert.equal(KIDS[n].length, count, n);
  }
  const q = s => s.replace(/ x.*$/, '');
  const off = s => +s.match(STEP)[3];
  const HB = KIDS['Kids Happy Birthday'], JB = KIDS['Kids Jingle Bells'];
  const LB = KIDS['Kids London Bridge'], OM = KIDS['Kids This Old Man'];
  assert.deepEqual(HB.map(off), [-5,-5,-3,-5,0,-1, -5,-5,-3,-5,2,0, -5,-5,7,4,0,-1,-3, 5,5,4,0,2,0]);
  assert.equal(q(HB[5]), '5 7'); assert.equal(q(HB[11]), '1 maj');
  assert.equal(q(HB[17]), '4 maj'); assert.equal(q(HB[18]), '4 maj');
  assert.equal(q(HB[23]), '5 7'); assert.equal(q(HB[24]), '1 maj');
  assert.deepEqual(JB.map(off).slice(0, 11), [4,4,4,4,4,4,4,7,0,2,4]);
  assert.deepEqual(JB.map(off).slice(11, 26), [5,5,5,5,5,4,4,4,4,4,2,2,4,2,7]);
  assert.deepEqual(JB.map(off).slice(37), [5,5,5,5,5,4,4,4,4,7,7,5,2,0]);
  assert.equal(q(JB[11]), '4 maj'); assert.equal(q(JB[15]), '1 maj');
  assert.equal(q(JB[20]), '2 7'); assert.equal(q(JB[24]), '5 7'); assert.equal(q(JB[25]), '5 7');
  assert.equal(q(JB[48]), '5 7'); assert.equal(q(JB[49]), '5 7'); assert.equal(q(JB[50]), '1 maj');
  assert.deepEqual(LB.map(off), [7,9,7,5,4,5,7, 2,4,5, 4,5,7, 7,9,7,5,4,5,7, 2,7,4,0]);
  assert.equal(q(LB[7]), '5 7'); assert.equal(q(LB[20]), '5 7'); assert.equal(q(LB[22]), '1 maj');
  assert.deepEqual(OM.map(off), [7,4,7,7,4,7, 9,7,5,4,2,4,5, 4,5,7,0,0,0,0,0,2,4,5,7, 7,2,2,5,4,2,0]);
  assert.equal(q(OM[6]), '4 maj'); assert.equal(q(OM[12]), '5 7');
  assert.equal(q(OM[24]), '5 7'); assert.equal(q(OM[25]), '5 7'); assert.equal(q(OM[31]), '1 maj');
});
test('four new Kids songs: Happy Birthday keeps G3–G4; the others still get C4–B4', async () => {
  const { kidsNeededMidis, kidsPianoRange } = await import('../../js/kids/range.js');
  const toSteps = name => KIDS[name].map(s => {
    const off = +s.match(STEP)[3];
    const deg = parseInt(s, 10);
    return { item: { mel: off, rootPc: [0, 2, 4, 5, 7, 9, 11][deg - 1] } };
  });
  const rangeOf = name => kidsPianoRange(kidsNeededMidis(toSteps(name), 60));
  // Happy Birthday already spans an octave (G3–G4), so it is not padded to B4.
  const hb = rangeOf('Kids Happy Birthday');
  assert.equal(hb.lo, 55); assert.equal(hb.hi, 67); assert.equal(hb.whites, 8);
  for (const n of ['Kids Jingle Bells', 'Kids London Bridge', 'Kids This Old Man']) {
    const R = rangeOf(n);
    assert.equal(R.lo, 60, n); assert.equal(R.hi, 71, n); assert.equal(R.whites, 7, n);
  }
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const V = readFileSync(new URL('../../js/version.js', import.meta.url), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const { validateSong } = await import(`../../js/songs/validate.js?v=${V}`);

// chords: [[symbol, bar, beat, beats], ...] -> one section
function song(o) {
  const { tonic = 'C', mode = 'major', ts = '4/4', chords } = o, bpm = 'bpm' in o ? o.bpm : 100;
  const timing = { timeSignature: ts }; if (bpm !== undefined) timing.bpm = bpm;
  return { song: { title: 'T', artist: 'A', key: { tonic, mode } }, timing,
    sections: [{ id: 'verse1', type: 'verse', chords: chords.map(([chord, bar, beat, d], i) => ({ index: i, chord, position: { bar, beat }, durationBeats: d, confidence: 0.9 })) }] };
}
const of = (r, l) => r.flags.filter(f => f.layer === l);
const I_IV_V = [['C', 1, 1, 4], ['F', 2, 1, 2], ['G7', 2, 3, 2], ['Am', 3, 1, 4]];

test('in-key song in C major passes every layer (G is V, in key)', () => {
  assert.deepEqual(validateSong(song({ chords: I_IV_V })).flags, []);
});
test('out-of-key roots are flagged with chord name and position', () => {
  const r = validateSong(song({ chords: [['C', 1, 1, 4], ['Bb', 2, 1, 4], ['F#m', 3, 1, 4], ['G', 4, 1, 4]] }));
  const k = of(r, 'key');
  assert.equal(k.length, 2);
  assert.match(k[0].message, /Bb is not in C major/); assert.equal(k[0].where.chord, 1); assert.equal(k[0].where.bar, 2); assert.equal(k[0].where.section, 0);
  assert.match(k[1].message, /F#m/); assert.equal(k[1].where.chord, 2);
  assert.equal(of(r, 'timing').length, 0);
});
test('minor key: natural minor roots pass, harmonic-minor V (E, E7) passes, out-of-key flagged', () => {
  const ok = validateSong(song({ tonic: 'A', mode: 'minor', chords: [['Am', 1, 1, 4], ['Dm', 2, 1, 4], ['E7', 3, 1, 4], ['F', 4, 1, 2], ['G', 4, 3, 2], ['C', 5, 1, 4]] }));
  assert.deepEqual(of(ok, 'key'), []);
  const bad = validateSong(song({ tonic: 'A', mode: 'minor', chords: [['Am', 1, 1, 4], ['F#', 2, 1, 4]] }));
  assert.equal(of(bad, 'key').length, 1); assert.match(of(bad, 'key')[0].message, /A minor/);
});
test('short bar: missing beats are flagged with the amount', () => {
  const r = validateSong(song({ chords: [['C', 1, 1, 4], ['F', 2, 1, 3]] }));
  const t = of(r, 'timing'); assert.equal(t.length, 1); assert.match(t[0].message, /bar 2: 1 beat missing/);
});
test('long bar: extra beats are flagged with the amount', () => {
  const r = validateSong(song({ chords: [['C', 1, 1, 4], ['F', 2, 1, 5]] }));
  const t = of(r, 'timing'); assert.equal(t.length, 1); assert.match(t[0].message, /bar 3: 1 beat too many/);
});
test('overlap and gap between chords are flagged', () => {
  const over = of(validateSong(song({ chords: [['C', 1, 1, 6], ['F', 2, 1, 4]] })), 'timing');
  assert.ok(over.some(f => /2 beats too many/.test(f.message)));
  const gap = of(validateSong(song({ chords: [['C', 1, 1, 2], ['F', 2, 1, 4]] })), 'timing');
  assert.ok(gap.some(f => /2 beats missing before chord 2/.test(f.message)));
});
test('quarter-beat durations and 3/4 add up', () => {
  assert.deepEqual(of(validateSong(song({ chords: [['C', 1, 1, 1.75], ['G', 1, 2.75, 2.25]] })), 'timing'), []);
  assert.deepEqual(of(validateSong(song({ ts: '3/4', chords: [['C', 1, 1, 3], ['G', 2, 1, 3]] })), 'timing'), []);
  assert.equal(of(validateSong(song({ ts: '3/4', chords: [['C', 1, 1, 4]] })), 'timing').length, 1);
});
test('missing time signature defaults to 4/4', () => {
  const s = song({ chords: I_IV_V }); delete s.timing.timeSignature;
  assert.deepEqual(validateSong(s).flags, []);
});
test('BPM 40 and 200 are flagged, 50 and 180 pass, missing and non-numeric are errors', () => {
  assert.match(of(validateSong(song({ bpm: 40, chords: I_IV_V })), 'bpm')[0].message, /40 BPM is very slow/);
  assert.match(of(validateSong(song({ bpm: 200, chords: I_IV_V })), 'bpm')[0].message, /200 BPM is very fast/);
  assert.equal(of(validateSong(song({ bpm: 50, chords: I_IV_V })), 'bpm').length, 0);
  assert.equal(of(validateSong(song({ bpm: 180, chords: I_IV_V })), 'bpm').length, 0);
  const miss = of(validateSong(song({ bpm: undefined, chords: I_IV_V })), 'bpm'); assert.equal(miss[0].severity, 'error'); assert.match(miss[0].message, /missing/);
  assert.equal(of(validateSong(song({ bpm: 'fast', chords: I_IV_V })), 'bpm')[0].severity, 'error');
});

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
  const one = validateSong(song({ chords: [['C', 1, 1, 4], ['F#m', 2, 1, 4], ['G', 3, 1, 4]] }));
  const k1 = of(one, 'key');
  assert.equal(k1.length, 1);
  assert.match(k1[0].message, /F#m is not in C major/); assert.equal(k1[0].where.chord, 1); assert.equal(k1[0].where.bar, 2); assert.equal(k1[0].where.section, 0);
  const r = validateSong(song({ chords: [['C', 1, 1, 4], ['F#m', 2, 1, 4], ['C#m', 3, 1, 4], ['G', 4, 1, 4]] }));
  const k = of(r, 'key');
  assert.equal(k.length, 1); // several out-of-key chords in one section are one grouped warning
  assert.match(k[0].message, /Verse 1: 2 chords not in C major \(F#m, C#m\)\./);
  assert.equal(k[0].where.chord, 1); assert.equal(k[0].where.bar, 2);
  assert.equal(of(r, 'timing').length, 0);
});
test('minor key: natural minor roots pass, harmonic-minor V (E, E7) passes, out-of-key flagged', () => {
  const ok = validateSong(song({ tonic: 'A', mode: 'minor', chords: [['Am', 1, 1, 4], ['Dm', 2, 1, 4], ['E7', 3, 1, 4], ['F', 4, 1, 2], ['G', 4, 3, 2], ['C', 5, 1, 4]] }));
  assert.deepEqual(of(ok, 'key'), []);
  const bad = validateSong(song({ tonic: 'A', mode: 'minor', chords: [['Am', 1, 1, 4], ['F#m', 2, 1, 4]] }));
  assert.equal(of(bad, 'key').length, 1); assert.match(of(bad, 'key')[0].message, /F#m is not in A minor/);
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
test('v112.6: key flags name the version (Simple)/(Full) when both exist, so lines are not repeated', () => {
  const s = song({ chords: [['C', 1, 1, 4], ['F#m', 2, 1, 4]] });
  s.sectionsFull = JSON.parse(JSON.stringify(s.sections));
  const k = of(validateSong(s), 'key');
  assert.equal(k.length, 2);
  assert.match(k[0].message, /^Verse 1 \(Simple\), chord 2 \(bar 2\): F#m is not in C major\.$/);
  assert.match(k[1].message, /^Verse 1 \(Full\), chord 2 \(bar 2\): F#m is not in C major\.$/);
  assert.notEqual(k[0].message, k[1].message);
  // a Simple-only song keeps the plain section name
  assert.match(of(validateSong(song({ chords: [['C', 1, 1, 4], ['F#m', 2, 1, 4]] })), 'key')[0].message, /^Verse 1, chord 2/);
});

test('section.key is used instead of the song key (a modulation)', () => {
  const s = song({ tonic: 'E', mode: 'major', chords: [['F', 1, 1, 4], ['D7', 2, 1, 4], ['Gm', 3, 1, 4], ['C', 4, 1, 4]] });
  s.sections[0].key = { tonic: 'F', mode: 'major' };
  s.sections[0].type = 'chorus'; s.sections[0].id = 'chorus3';
  assert.deepEqual(of(validateSong(s), 'key'), []);
});
test('a key named in section notes is honored when section.key is missing', () => {
  const s = song({ tonic: 'E', mode: 'major', chords: [['F', 1, 1, 4], ['D7', 2, 1, 4], ['Gm', 3, 1, 4], ['Bb/C', 4, 1, 4]] });
  s.sections[0].notes = 'Key change up a half step to F major';
  s.sections[0].type = 'chorus'; s.sections[0].id = 'chorus3';
  assert.deepEqual(of(validateSong(s), 'key'), []);
});
test('a later section keeps the modulated key (carry forward)', () => {
  const s = song({ tonic: 'E', mode: 'major', chords: [['F', 1, 1, 4], ['C', 2, 1, 4], ['Bb', 3, 1, 4], ['Gm', 4, 1, 4]] });
  s.sections[0].notes = 'modulates to F major';
  s.sections[0].type = 'chorus'; s.sections[0].id = 'chorus3';
  s.sections.push({ id: 'outro', type: 'outro', chords: ['F', 'F'].map((chord, i) => ({ index: i, chord, position: { bar: 5 + i, beat: 1 }, durationBeats: 4, confidence: 0.9 })) });
  assert.deepEqual(of(validateSong(s), 'key'), []);
});
test('3+ out-of-scale chords that fit another key get one "looks like" suggestion, not a line per chord', () => {
  const s = song({ tonic: 'E', mode: 'major', chords: [['F', 65, 1, 4], ['D7', 66, 1, 4], ['Gm', 67, 1, 4], ['C', 68, 1, 4], ['F', 69, 1, 4], ['Bb', 70, 1, 4]] });
  const k = of(validateSong(s), 'key');
  assert.equal(k.length, 1, k.map(f => f.message).join('\n'));
  assert.match(k[0].message, /looks like F from bar 65/);
});
test('borrowed: true is not flagged; an unmarked chromatic chord still is', () => {
  const s = song({ chords: [['C', 1, 1, 4], ['F#m', 2, 1, 4], ['G', 3, 1, 4]] });
  s.sections[0].chords[1].borrowed = true;
  assert.deepEqual(of(validateSong(s), 'key'), []);
  const unmarked = song({ chords: [['C', 1, 1, 4], ['F#m', 2, 1, 4], ['G', 3, 1, 4]] });
  assert.equal(of(validateSong(unmarked), 'key').length, 1);
  assert.match(of(validateSong(unmarked), 'key')[0].message, /F#m is not in C major/);
});
test('secondary dominants C#7 and G#7 in E major are not flagged', () => {
  const s = song({ tonic: 'E', mode: 'major', chords: [['E', 1, 1, 4], ['C#7', 2, 1, 4], ['F#m', 3, 1, 4], ['A', 4, 1, 4], ['B', 5, 1, 4], ['G#7', 6, 1, 4], ['C#m', 7, 1, 4], ['G#', 8, 1, 4]] });
  assert.deepEqual(of(validateSong(s), 'key'), []);
});

test('secondary dominants (major/7th and dim/dim7 on those roots) are not flagged', () => {
  const e = song({ tonic: 'E', mode: 'major', chords: [
    ['E', 1, 1, 4], ['E7', 2, 1, 4], ['F#7', 3, 1, 4], ['G#7', 4, 1, 4], ['C#7', 5, 1, 4], ['D#7', 6, 1, 4],
    ['C#dim', 7, 1, 4], ['F#dim7', 8, 1, 4], ['A', 9, 1, 4], ['B', 10, 1, 4]
  ] });
  assert.deepEqual(of(validateSong(e), 'key'), []);
  // F#7 in A minor is V/ii (root a 5th above a diatonic chord) and is out of the natural-minor scale
  const am = song({ tonic: 'A', mode: 'minor', chords: [['Am', 1, 1, 4], ['F#7', 2, 1, 4], ['Bm', 3, 1, 4], ['E7', 4, 1, 4]] });
  assert.deepEqual(of(validateSong(am), 'key'), []);
});
test('borrowed chords from the parallel minor are not flagged', () => {
  const s = song({ tonic: 'E', mode: 'major', chords: [
    ['E', 1, 1, 4], ['Am', 2, 1, 4], ['C', 3, 1, 4], ['D', 4, 1, 4], ['G', 5, 1, 4], ['Bm', 6, 1, 4], ['B', 7, 1, 4]
  ] });
  assert.deepEqual(of(validateSong(s), 'key'), []);
});
test('in a minor key, major V/V7 and major IV are not flagged', () => {
  const s = song({ tonic: 'A', mode: 'minor', chords: [['Am', 1, 1, 4], ['E', 2, 1, 4], ['E7', 3, 1, 4], ['D', 4, 1, 4], ['Dm', 5, 1, 4]] });
  assert.deepEqual(of(validateSong(s), 'key'), []);
});
test('blues I7, IV7, V7 and bVII are not flagged', () => {
  const s = song({ chords: [['C7', 1, 1, 4], ['F7', 2, 1, 4], ['G7', 3, 1, 4], ['Bb', 4, 1, 4], ['Bb7', 5, 1, 4], ['C', 6, 1, 4]] });
  assert.deepEqual(of(validateSong(s), 'key'), []);
});
test('sus/add9/6/maj7 and slash/pedal-bass are judged by the triad; enharmonics are equal', () => {
  // F is Neapolitan bII in E; decorations and F/C still pass. Eb7 = D#7 (V/vii in E).
  const s = song({ tonic: 'E', mode: 'major', chords: [
    ['E', 1, 1, 4], ['Fmaj7', 2, 1, 4], ['Fsus4', 3, 1, 4], ['Fadd9', 4, 1, 4], ['F6', 5, 1, 4], ['F/C', 6, 1, 4], ['Eb7', 7, 1, 4], ['B', 8, 1, 4]
  ] });
  assert.deepEqual(of(validateSong(s), 'key'), []);
  const eq = song({ tonic: 'E', mode: 'major', chords: [['E', 1, 1, 4], ['D#7', 2, 1, 4], ['B', 3, 1, 4]] });
  assert.deepEqual(of(validateSong(eq), 'key'), []);
});
test('Neapolitan bII and a chromatic passing dim between diatonic chords are not flagged', () => {
  const n = song({ chords: [['C', 1, 1, 4], ['Db', 2, 1, 4], ['C', 3, 1, 4]] });
  assert.deepEqual(of(validateSong(n), 'key'), []);
  const pass = song({ chords: [['C', 1, 1, 4], ['C#dim', 2, 1, 4], ['Dm', 3, 1, 4], ['G', 4, 1, 4]] });
  assert.deepEqual(of(validateSong(pass), 'key'), []);
});
test('a relative-minor or relative-major section shares the key signature, so it does not warn', () => {
  const toRel = song({ tonic: 'C', mode: 'major', chords: [['Am', 1, 1, 4], ['Dm', 2, 1, 4], ['E7', 3, 1, 4], ['Am', 4, 1, 4]] });
  toRel.sections[0].key = { tonic: 'A', mode: 'minor' };
  assert.deepEqual(of(validateSong(toRel), 'key'), []);
  const fromMin = song({ tonic: 'A', mode: 'minor', chords: [['C', 1, 1, 4], ['F', 2, 1, 4], ['G', 3, 1, 4], ['C', 4, 1, 4]] });
  fromMin.sections[0].key = { tonic: 'C', mode: 'major' };
  assert.deepEqual(of(validateSong(fromMin), 'key'), []);
});
test('a "looks like" run at the end of a section is carried into the next section', () => {
  const s = song({ tonic: 'E', mode: 'major', chords: [['F', 65, 1, 4], ['Gm', 66, 1, 4], ['Bb', 67, 1, 4], ['C', 68, 1, 4]] });
  s.sections.push({ id: 'outro', type: 'outro', chords: ['F', 'C', 'Bb'].map((chord, i) => ({ index: i, chord, position: { bar: 69 + i, beat: 1 }, durationBeats: 4, confidence: 0.9 })) });
  const k = of(validateSong(s), 'key');
  assert.equal(k.length, 1, k.map(f => f.message).join('\n'));
  assert.match(k[0].message, /looks like F from bar 65/);
  assert.ok(!k.some(f => /outro/i.test(f.message)));
});
test('two out-of-scale chords are not a "looks like" suggestion; an isolated true chromatic is still flagged', () => {
  // F#m and C#m in C major do not make a 3-chord run, so this stays a grouped warning
  const twoBad = song({ tonic: 'C', mode: 'major', chords: [['C', 1, 1, 4], ['F#m', 2, 1, 4], ['C#m', 3, 1, 4], ['G', 4, 1, 4]] });
  const k = of(validateSong(twoBad), 'key');
  assert.equal(k.length, 1);
  assert.match(k[0].message, /2 chords not in C major/);
  assert.ok(!/looks like/.test(k[0].message));
});

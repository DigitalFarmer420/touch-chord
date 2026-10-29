// v112.13: chord read-as fixes (Noff test11212 Med-1..3, Low-1..5). Runs the real upload module in node.
// Every chord: the stored symbol after the tidy and the pitch classes it plays (root first).
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './dom-stub.js';
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const html = readFileSync(new URL('index.html', R), 'utf8');
const schemaOf = id => html.match(new RegExp('<script type="application/json" id="' + id + '">([\\s\\S]*?)</script>'))[1];
const realDoc = globalThis.document;
globalThis.document = new Proxy(realDoc, { get: (t, k) => k === 'getElementById' ? (id => /^songSchema(13)?Json$/.test(id) ? { textContent: schemaOf(id) } : t.getElementById(id)) : t[k] });
const S = await import(`../../js/state.js?v=${V}`); S.boot();
const U = await import(`../../js/songs/upload.js?v=${V}`); U.boot();
const N = await import(`../../js/songs/normalize.js?v=${V}`);
const T = (await import(`../../js/theory/index.js?v=${V}`)).Theory;
const NM = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const pcs = sym => { const p = U.upParseChord(sym); assert.ok(!p.error, sym + ' ' + p.error); return T.chordIntervals(p.type, p.ext).map(i => NM[(p.pc + i) % 12]).join(' '); };
function load(text) {
  const b = U.upLoadBegin(text, { defer: true });
  if (b.pending) return { ok: true, song: b.pending.song, warnings: b.pending.warnings || [] };
  if (b.done) return b.done;
  b.list.items.forEach((_, i) => U.upLoadCheck(b.list, i));
  const row = b.list.rows[0];
  return row.song ? { ok: true, song: row.song, warnings: b.list.warnings.concat(row.warnings) } : { ok: false, errors: row.errors };
}
const sp = (cs, extra) => JSON.stringify(Object.assign({ contractVersion: '1.2', song: { title: 'Spell', artist: 'T', key: { tonic: 'C', mode: 'major' } }, timing: { bpm: 100, timeSignature: '4/4' },
  sections: [{ id: 'v', type: 'verse', chords: cs.map((c, i) => ({ index: i, chord: c, position: { bar: i + 1, beat: 1 }, durationBeats: 4, confidence: 0.8 })) }] }, extra || {}));
// [input, stored symbol, pitch classes played]
const CASES = [
  // Med-1: augmented = raised 5th
  ['Caug', 'Caug', 'C E Ab'], ['C+', 'Caug', 'C E Ab'], ['C+5', 'Caug', 'C E Ab'], ['Gaug7', 'Gaug7', 'G B Eb F'], ['C+7', 'Caug7', 'C E Ab Bb'],
  ['C7#5', 'C7#5', 'C E Ab Bb'], ['C7+5', 'C7#5', 'C E Ab Bb'], ['C7+', 'C7#5', 'C E Ab Bb'], ['CAug', 'Caug', 'C E Ab'], ['C+maj7', 'Cmaj7#5', 'C E Ab B'],
  // Med-2: minor-major 7th
  ['AmMaj7', 'AmM7', 'A C E Ab'], ['CmMaj7', 'CmM7', 'C Eb G B'], ['Cm(Maj7)', 'CmM7', 'C Eb G B'], ['CminMaj7', 'CmM7', 'C Eb G B'], ['CmM7', 'CmM7', 'C Eb G B'],
  ['Cm(maj7)', 'CmM7', 'C Eb G B'], ['C-maj7', 'CmM7', 'C Eb G B'], ['C-Δ', 'CmM7', 'C Eb G B'], ['CmΔ7', 'CmM7', 'C Eb G B'], ['Bbm(maj7)', 'BbmM7', 'Bb C# F A'],
  ['CmMaj9', 'CmM9', 'C Eb G B D'],
  // Med-3: quality words in any case (M vs m kept)
  ['CMaj7', 'Cmaj7', 'C E G B'], ['CMAJ7', 'Cmaj7', 'C E G B'], ['CMa7', 'Cmaj7', 'C E G B'], ['CΔ7', 'Cmaj7', 'C E G B'], ['CMaj9', 'Cmaj9', 'C E G B D'],
  ['Cø9', 'Cm9b5', 'C Eb F# Bb D'], ['Cø7', 'Cm7b5', 'C Eb F# Bb'], ['CMI7', 'Cm7', 'C Eb G Bb'], ['CMin7', 'Cm7', 'C Eb G Bb'], ['CDIM7', 'Cdim7', 'C Eb F# A'],
  ['CSus4', 'Csus4', 'C F G'], ['CM7', 'CM7', 'C E G B'], ['Cm7', 'Cm7', 'C Eb G Bb'],
  // Low-1: C-5 = C(b5), never a C-flat root
  ['C-5', 'C(b5)', 'C E F#'], ['C(b5)', 'C(b5)', 'C E F#'], ['C7-5', 'C7b5', 'C E F# Bb'], ['Dm7-5', 'Dm7b5', 'D F Ab C'],
];
test('Med-1/2/3, Low-1: every spelling is stored as the right chord and plays the right notes', () => {
  const r = load(sp(CASES.map(c => c[0])));
  assert.ok(r.ok, JSON.stringify(r.errors));
  const got = r.song.sections[0].chords.map(c => c.chord);
  CASES.forEach((c, i) => {
    assert.equal(got[i], c[1], c[0]);
    assert.equal(pcs(got[i]), c[2], c[0] + ' plays');
  });
  // the notes say what plays (no "played as a major chord" for aug, no "minor chord" for a chord that plays a major 7th)
  assert.ok(!r.warnings.some(w => /augmented is played as a major/.test(w)));
  assert.ok(r.warnings.includes('Chord "CmMaj7" read as CmM7 (minor-major 7th: minor with a major 7th)'));
  assert.ok(r.warnings.includes('Chord "C-5" read as C(b5) (a major chord with a flat 5th)'));
  assert.ok(!r.warnings.some(w => /Cb5|C\u266d5/.test(w)));
  // labels: Caug, Cm(maj7), C(b5)
  assert.equal(U.upParseChord('CmM7').label, 'm(maj7)');
  assert.equal(U.upParseChord('Caug').label, 'aug');
  assert.equal(U.upParseChord('C(b5)').label, '(\u266d5)');
  assert.equal(U.upParseChord('Dm7(b5)').error ? 'err' : 'ok', 'err');   // (b5) only right after the root; Dm7(b5) is tidied to Dm7b5
});
test('altered 5ths: chord names, tone spelling and the steps', () => {
  const sym = s => { const p = U.upParseChord(s); return T.buildChord({ rootPc: p.pc, rootSpell: p.rs, type: p.type, extensions: p.ext }); };
  assert.equal(sym('Caug').symbol, 'Caug'); assert.deepEqual(sym('Caug').names, ['C', 'E', 'G#']);
  assert.equal(sym('Gaug7').symbol, 'Gaug7'); assert.deepEqual(sym('Gaug7').names, ['G', 'B', 'D#', 'F']);
  assert.equal(sym('CmM7').symbol, 'Cm(maj7)'); assert.deepEqual(sym('CmM7').names, ['C', 'Eb', 'G', 'B']);
  assert.equal(sym('C(b5)').symbol, 'C(b5)'); assert.deepEqual(sym('C(b5)').names, ['C', 'E', 'Gb']);
  assert.equal(sym('C7b5').symbol, 'C7b5');
  assert.deepEqual(sym('Caug').midis, [60, 64, 68]);   // root lowest, rising
  const st = U.upStep({ pc: 0, mode: 'major' }, 'Caug', 1, 0, null).item;
  assert.deepEqual([st.rootPc, st.type, st.extensions.sharp5, st.chipLabel], [0, 'major', true, 'aug']);
});
test('existing chords sound exactly as before (no altered-5th side effects)', () => {
  const OLD = { C: 'C E G', Cm: 'C Eb G', C7: 'C E G Bb', Cmaj7: 'C E G B', Cm7: 'C Eb G Bb', Cm7b5: 'C Eb F# Bb', Cdim: 'C Eb F#', Cdim7: 'C Eb F# A',
    Csus4: 'C F G', Csus2: 'C D G', C9: 'C E G Bb D', C13: 'C E Bb D A', Cm13: 'C Eb Bb D A', C7b9: 'C E G Bb C#', C7sharp9: 'C E G Bb Eb', C6: 'C E G A', Cadd9: 'C E G D', C5: 'C E G', Cm13b5: 'C Eb F# Bb D' };
  for (const [k, v] of Object.entries(OLD)) assert.equal(pcs(k.replace('sharp', '#')), v, k);
  assert.deepEqual(T.chordIntervals('major', {}), [0, 4, 7]);
  assert.deepEqual(T.chordIntervals('dim', { min7: true, thirteen: true }), [0, 3, 6, 10, 14]);   // the old quirk is kept
});
test('Low-3: v1.2 null roman, beforeLine and alternates[].reason count as left out', () => {
  const o = JSON.parse(sp(['C', 'F', 'G']));
  const ch = o.sections[0].chords;
  ch[0].roman = null; ch[1].alternates = [{ chord: 'Fmaj7', reason: null, confidence: 0.5 }]; ch[2].roman = 'V';
  o.sections[0].lyrics = [{ text: 'la la la', markers: [{ charIndex: 0, chordIndex: 0, beforeLine: null }, { charIndex: 3, chordIndex: 1, beforeLine: true }] }];
  const r = load(JSON.stringify(o));
  assert.ok(r.ok, JSON.stringify(r.errors));
  const c = r.song.sections[0].chords;
  assert.ok(!('roman' in c[0])); assert.equal(c[2].roman, 'V');
  assert.deepEqual(c[1].alternates, [{ chord: 'Fmaj7', confidence: 0.5 }]);
  assert.ok(!('beforeLine' in r.song.sections[0].lyrics[0].markers[0])); assert.equal(r.song.sections[0].lyrics[0].markers[1].beforeLine, true);
});
test('Low-4: an unknown first chord plays the key\'s home chord, and the note says so', () => {
  const s13 = t => JSON.stringify({ contractVersion: '1.3', songs: [{ song: { title: 'First', artist: 'T', key: { tonic: 'Eb', mode: 'major' } },
    timing: { bpm: 120, timeSignature: '4/4', durationSeconds: 8 }, form: ['intro'],
    sections: [{ id: 'intro', type: 'intro', bars: [{ bar: 1, chords: [{ beat: 1, chord: t, confidence: 0 }] }, { bar: 2, chords: [{ beat: 1, chord: 'G7', confidence: 0.9 }] }, { bar: 3, chords: [{ beat: 1, chord: 'unknown', confidence: 0 }] }, { bar: 4, chords: [{ beat: 1, chord: 'Ab', confidence: 0.9 }] }] }] }] });
  const r = load(s13('unknown'));
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.song.sections[0].chords.map(c => [c.chord, c.confidence]), [['Eb', 0], ['G7', 0.9], ['G7', 0], ['Ab', 0.9]]);
  assert.ok(r.warnings.includes("The song starts on an unknown chord with no chord before it, so it plays the key's home chord, Eb (listed for review)"), r.warnings.join(' | '));
  assert.ok(r.warnings.includes('1 unknown chord holds the chord before it (listed for review)'));
  const m = JSON.parse(sp(['N.C.', 'Am', 'F'], {})); m.song.key = { tonic: 'A', mode: 'minor' };
  const rm = load(JSON.stringify(m));
  assert.equal(rm.song.sections[0].chords[0].chord, 'Am');
  assert.ok(rm.warnings.includes("The song starts on N.C. with no chord before it, so it plays the key's home chord, Am"));
});
test('Low-5: E\u266d tonic, Major, 4:4, 1.2.0 / 1.3.0, rap / hook / pre-chorus, repaired JSON note', () => {
  const o = JSON.parse(sp(['Eb', 'Ab', 'Bb']));
  o.contractVersion = '1.2.0'; o.song.key = { tonic: 'E\u266d', mode: 'Major' }; o.timing.timeSignature = '4:4';
  o.sections[0].type = 'rap';
  o.sections.push({ id: 'h', type: 'hook', chords: [{ index: 0, chord: 'Eb', position: { bar: 1, beat: 1 }, durationBeats: 4, confidence: 0.9 }] });
  o.sections.push({ id: 'p', type: 'pre-chorus', label: 'Lift', chords: [{ index: 0, chord: 'Cm', position: { bar: 1, beat: 1 }, durationBeats: 4, confidence: 0.9 }] });
  const r = load(JSON.stringify(o));
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.song.song.key, { tonic: 'Eb', mode: 'major' });
  assert.equal(r.song.timing.timeSignature, '4/4');
  assert.deepEqual(r.song.sections.map(s => [s.type, s.label]), [['verse', 'Rap'], ['chorus', 'Hook'], ['prechorus', 'Lift']]);
  for (const w of ['song.key read as Eb major', 'timing.timeSignature "4:4" read as 4/4', 'Section type "rap" read as verse', 'Section type "hook" read as chorus', 'Section type "pre-chorus" read as prechorus'])
    assert.ok(r.warnings.includes(w), w + ' in ' + r.warnings.join(' | '));
  const k2 = JSON.parse(sp(['C'])); k2.song.key.mode = 'MAJOR'; assert.equal(load(JSON.stringify(k2)).song.song.key.mode, 'major');
  const t4 = JSON.parse(sp(['C'])); t4.timing.timeSignature = 4; assert.equal(load(JSON.stringify(t4)).song.timing.timeSignature, '4/4');
  // 1.3.0 envelope
  const e = JSON.parse(readFileSync(new URL('tests/fixtures/upload/noff-v13.min.json', R), 'utf8')); e.contractVersion = '1.3.0';
  assert.ok(load(JSON.stringify(e)).ok);
  const e2 = JSON.parse(readFileSync(new URL('tests/fixtures/upload/noff-v12.min.json', R), 'utf8')); e2.contractVersion = '1.2.0';
  assert.ok(load(JSON.stringify(e2)).ok);
  // repaired JSON says so; strict JSON does not
  const rep = load(sp(['C', 'F']).replace(/\}\]/, '},]'));
  assert.ok(rep.ok && rep.warnings.includes(U.UP_REPAIRED), JSON.stringify(rep.warnings));
  assert.ok(!load(sp(['C', 'F'])).warnings.includes(U.UP_REPAIRED));
  const repL = load(JSON.stringify(e).replace('"songs"', '\u201csongs\u201d'));
  assert.ok(repL.ok && repL.warnings.includes(U.UP_REPAIRED));
});

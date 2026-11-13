// v3.2-ai-paste: AI answers pasted from ChatGPT / Grok. One slip in an otherwise good answer (a lyric mark past
// the end of its line, a beat counted from 0, confidence 85, a form id "chorus" for section "chorus1", a chord
// spelled "C Major", ...) used to reject the whole song. The corpus (tests/fixtures/aipaste/corpus.mjs) is run
// through the real upload module like the dialog does; every upload that loaded on code9 must give exactly the
// same result (tests/fixtures/aipaste/code9-results.json holds hashes of the code9 results).
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
const CASES = (await import('../fixtures/aipaste/corpus.mjs')).default;
const FX = new URL('tests/fixtures/upload/', R);
const BASE = JSON.parse(readFileSync(new URL('tests/fixtures/aipaste/code9-results.json', R), 'utf8'));

// the same shape the code9 results were recorded in
function snap(text) {
  const b = U.upLoadBegin(text, { defer: true });
  if (b.pending) return { kind: 'single', song: b.pending.song, warnings: b.pending.warnings };
  if (b.done) return { kind: 'done', ok: b.done.ok, errors: b.done.errors, warnings: b.done.warnings };
  b.list.items.forEach((_, i) => U.upLoadCheck(b.list, i));
  return { kind: 'list', warnings: b.list.warnings, truncated: b.list.truncated, rows: b.list.rows.map(r => ({ status: r.status, reason: r.reason, errors: r.errors, song: r.song, warnings: r.warnings, note: r.note, flags: r.flags })) };
}
const loaded = r => r.kind === 'single' || (r.kind === 'done' ? r.ok : r.rows.some(x => x.song));
const songs = r => r.kind === 'single' ? [r.song] : r.kind === 'list' ? r.rows.filter(x => x.song).map(x => x.song) : [];
const hash = r => createHash('sha256').update(JSON.stringify(r)).digest('hex').slice(0, 24);
const allW = r => (r.warnings || []).concat(r.rows ? r.rows.flatMap(x => x.warnings || []) : []);
const errs = r => r.kind === 'done' ? r.errors : r.rows ? r.rows.flatMap(x => x.errors || []) : [];
const cs = id => CASES.find(c => c.id === id).text;

test('the upload fixtures parse exactly as on code9', () => {
  const files = readdirSync(FX).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 13);
  for (const f of files) assert.equal(hash(snap(readFileSync(new URL(f, FX), 'utf8'))), BASE['fixture:' + f], f);
});

test('every corpus answer that loaded on code9 gives the same result', () => {
  let n = 0;
  for (const c of CASES) { const k = 'case:' + c.id; if (!BASE[k]) continue; n++; assert.equal(hash(snap(c.text)), BASE[k], c.id); }
  assert.ok(n >= 190, 'compared ' + n);
});

test('AI paste corpus: every answer loads, or fails with a plain message where it should', () => {
  assert.ok(CASES.length >= 260);
  const bad = [];
  for (const c of CASES) {
    const r = snap(c.text), ok = loaded(r);
    if (c.expect === 'load' ? !ok : ok) bad.push(c.id + ' ' + JSON.stringify(errs(r)).slice(0, 160));
    for (const s of songs(r)) for (const L of [s.sections, s.sectionsFull || []]) for (const sec of L) for (const ch of sec.chords) {
      assert.ok(!U.upParseChord(ch.chord).error, c.id + ': ' + ch.chord);   // never an unplayable chord, never an invented C
      assert.ok(ch.confidence >= 0 && ch.confidence <= 1, c.id);
      for (const ln of sec.lyrics || []) for (const mk of ln.markers) assert.ok(mk.charIndex <= ln.text.length && mk.chordIndex < sec.chords.length, c.id);
    }
  }
  assert.deepEqual(bad, []);
});

test('JSON slips: Python style, unquoted keys, inner quotes, invisible characters, citation marks', () => {
  const p = t => JSON.parse(N.repairJson(t));
  assert.deepEqual(p("{'a': 'Don't stop', 'b': None, 'c': True, 'd': NaN}"), { a: "Don't stop", b: null, c: true, d: null });
  assert.deepEqual(p('{a: 1, bpm: Infinity}'), { a: 1, bpm: null });
  assert.deepEqual(p('{"text": "She said "let it be"", "n": 1}'), { text: 'She said "let it be"', n: 1 });
  assert.deepEqual(p('{"text": "He said "hi", then left", "n": 1}'), { text: 'He said "hi", then left', n: 1 });
  assert.deepEqual(p('{\u2060"a":\u200d1,\u0085"b":\u200c2}'), { a: 1, b: 2 });
  assert.deepEqual(p('{"a": 1,\u3010turn0search3\u3011 "b": 2\ue200}'), { a: 1, b: 2 });
  // prose with quotes before the JSON is left alone (the quote rule only works inside JSON strings)
  const t = 'Here is "Let It Be" by "The Beatles":\n{\u201ctitle\u201d: \u201cLet It Be\u201d,}';
  const s = N.repairJson(t); assert.deepEqual(JSON.parse(s.slice(s.indexOf('{'))), { title: 'Let It Be' });
  // valid JSON text is not changed by the repair
  for (const f of ['noff-v13.min.json', 'anh-v13.json', 'noff-v12.json']) { const x = readFileSync(new URL(f, FX), 'utf8'); assert.deepEqual(JSON.parse(N.repairJson(x)), JSON.parse(x), f); }
});

test('chord spellings from chord charts are read; anything else held for review (at most 1 in 4)', () => {
  const T = [['C Major', 'C'], ['A minor', 'Am'], ['C7(13)', 'C13'], ['Am7(add11)', 'Am11'], ['(C)', 'C'], ['[G]', 'G'], ['C*', 'C'], ['C\u2019', 'C'],
    ['C7 (x2)', 'C7'], ['| C |', 'C'], ['A\u2212', 'Am'], ['D\u20137', 'Dm7'], ['E\ud834\udd2b', 'D'], ['F\ud834\udd2a', 'G'], ['G\u200b', 'G']];
  for (const [a, b] of T) assert.equal(N.tidyChord(a).sym, b, a);
  assert.ok(N.tidyChord('%').repeat);
  const mk = (cs) => JSON.stringify({ contractVersion: '1.2', song: { title: 'T', artist: 'A', key: { tonic: 'C', mode: 'major' } }, timing: { bpm: 90, timeSignature: '4/4' },
    sections: [{ id: 'v', type: 'verse', chords: cs.map((c, i) => ({ index: i, chord: c, position: { bar: i + 1, beat: 1 }, durationBeats: 4, confidence: 0.9 })) }] });
  const r = snap(mk(['C', 'Hm7', 'Am', 'F']));
  assert.ok(loaded(r));
  assert.deepEqual(r.song.sections[0].chords.map(c => [c.chord, c.confidence]), [['C', 0.9], ['C', 0], ['Am', 0.9], ['F', 0.9]]);
  assert.ok(allW(r).some(w => /can't read chord "Hm7"; it holds the chord before \(listed for review\)/.test(w)));
  const two = snap(mk(['C', 'Hm7', 'Xb', 'F']));   // 2 of 4: rejected as before
  assert.ok(!loaded(two) && errs(two).some(e => /chords\[1\]\.chord/.test(e.path)));
  const nash = snap(cs('nashville-numbers'));
  assert.ok(!loaded(nash) && /is not a chord symbol the app can read/.test(errs(nash)[0].msg));
  const alt = snap(cs('alt-61-(C)')); assert.ok(loaded(alt));
});

test('beats, form ids, lyric marks, confidence, key and fields an AI gets wrong are read with a note', () => {
  const chk = (id, re) => { const r = snap(cs(id)); assert.ok(loaded(r), id + ' ' + JSON.stringify(errs(r))); assert.ok(allW(r).some(w => re.test(w)), id + ': ' + JSON.stringify(allW(r))); return songs(r)[0]; };
  let s = chk('c-beat-0', /beats counted from 0; read as from 1/);
  s = chk('c-beat-5-in-4-4', /beat is 5, not a beat from 1 to 4 \(4\/4\); that chord is left out/);
  s = chk('c-beats-not-ascending', /out of order; played in beat order/);
  s = chk('c-beat-duplicate', /used twice in the bar/);
  s = chk('c-form-id-mismatch', /form id "chorus" read as section "chorus1"/);
  s = chk('c-form-id-case', /form id "Verse1" read as section "verse1"/);
  s = chk('c-form-missing-use-order', /form is missing/);
  s = chk('c-charindex-past-end', /moved to the end/);
  const ln = s.sections[0].lyrics[0]; assert.equal(ln.markers[ln.markers.length - 1].charIndex, ln.text.length);
  s = chk('c-charindex-string', /was text; read as a number/);
  s = chk('c-confidence-85', /read on the 0-1 scale/);
  assert.ok(s.sections.flatMap(x => x.chords).some(c => c.confidence === 0.85));
  s = chk('c-confidence-missing', /no confidence; read as 0\.5 \(listed for review\)/);
  s = chk('c-timesig-prose', /"4\/4 \(common time\)" read as 4\/4/); assert.equal(s.timing.timeSignature, '4/4');
  s = chk('c-tonic-with-mode', /read as Eb major/); assert.deepEqual([s.song.key.tonic, s.song.key.mode], ['Eb', 'major']);
  s = chk('c-tonic-minor-suffix', /read as A minor/);
  s = chk('c-tonic-Cb-or-E#', /read as B major/);
  s = chk('c-key-string', /song\.key "C major" read as C major/);
  s = chk('c-mode-dorian', /the app plays major or minor keys/);
  s = chk('c-year-string', /song\.year "1970" read as 1970/); assert.equal(s.song.year, 1970);
  s = chk('c-section-type-null', /has no type; read as other/);
  s = chk('c-bars-empty-section', /has no bars, so it is left out/);
  s = chk('c-lyric-text-null', /lyric line with no text left out/);
  s = chk('c-artist-missing', /Unknown artist/);
  const v = snap(cs('c-cv-1.3.1')); assert.ok(loaded(v));
  const v4 = snap(cs('c-cv-1.4')); assert.ok(!loaded(v4) && /can't read/.test(errs(v4)[0].msg));
  const nt = snap(cs('c-title-missing')); assert.ok(!loaded(nt));
});

test('two answers in one paste give all their songs; a repeated answer is read once; "> " quoted answers load', () => {
  for (const id of ['two-envelopes-two-fences', 'two-envelopes-bare']) {
    const r = snap(cs(id));
    assert.equal(r.kind, 'list', id);
    assert.ok(r.rows.filter(x => x.song).length >= 2, id);
    assert.ok(r.warnings.some(w => /answers in it; the songs from all of them were checked/.test(w)), id);
  }
  const one = cs('clean-small'), twice = '```json\n' + one + '\n```\nHere it is again:\n```json\n' + one + '\n```';
  assert.equal(hash(snap(twice)), hash(snap('```json\n' + one + '\n```')));
  const bq = snap(cs('blockquote')); assert.ok(loaded(bq));
  const sheet = snap(cs('chord-over-lyric')); assert.ok(!loaded(sheet) && /chord sheet/.test(errs(sheet)[0].msg));
});

test('zero-width characters in field names and chords', () => {
  for (const id of ['zwsp-inside-key', 'zwsp-inside-chord', 'zwj-wordjoiner', 'nel-u0085']) assert.ok(loaded(snap(cs(id))), id);
});

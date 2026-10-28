// v112.12: Song Contract v1.3 upload (normalize to the v1.2 shape), chord-spelling tidy, JSON repair,
// the bar-sum length warning and honest version / cut-off messages. Runs the real upload module in node.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './dom-stub.js';
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const html = readFileSync(new URL('index.html', R), 'utf8');
const schemaOf = id => html.match(new RegExp('<script type="application/json" id="' + id + '">([\\s\\S]*?)</script>'))[1];
const realDoc = globalThis.document;   // the schemas live in index.html <script> tags
globalThis.document = new Proxy(realDoc, { get: (t, k) => k === 'getElementById' ? (id => /^songSchema(13)?Json$/.test(id) ? { textContent: schemaOf(id) } : t.getElementById(id)) : t[k] });
const S = await import(`../../js/state.js?v=${V}`); S.boot();
const U = await import(`../../js/songs/upload.js?v=${V}`); U.boot();
const N = await import(`../../js/songs/normalize.js?v=${V}`);
const fx = f => readFileSync(new URL('tests/fixtures/upload/' + f, R), 'utf8');

// Load like the dialog does (no library write): single -> the checked song; list -> one row per song.
function load(text) {
  const b = U.upLoadBegin(text, { defer: true });
  if (b.pending) return { ok: true, single: true, song: b.pending.song, warnings: b.pending.warnings || [] };
  if (b.done) return b.done;
  b.list.items.forEach((_, i) => U.upLoadCheck(b.list, i));
  return { ok: true, list: true, rows: b.list.rows, warnings: b.list.warnings };
}
const one = text => { const r = load(text); if (r.list) { assert.equal(r.rows[0].status, undefined, JSON.stringify(r.rows[0].errors)); return { song: r.rows[0].song, warnings: r.rows[0].warnings, note: r.rows[0].note }; } assert.ok(r.ok, JSON.stringify(r.errors)); return r; };
const beats = secs => secs.reduce((a, s) => a + (s.repeat || 1) * s.chords.reduce((b, c) => b + c.durationBeats, 0), 0);

test('Noff v1.2 samples load unchanged, no length warning', () => {
  for (const f of ['noff-v12.json', 'noff-v12.min.json']) {
    const src = JSON.parse(fx(f)), r = one(fx(f));
    assert.ok(!r.warnings.some(w => /Length check/.test(w)), f);
    assert.deepEqual(r.song.sections.map(s => s.chords.map(c => c.chord)), src.songs[0].sections.map(s => s.chords.map(c => c.chord)), f);
  }
});

test('Noff v1.3 samples load in form order with the +8% length warning', () => {
  const v12 = one(fx('noff-v12.json')).song;
  for (const f of ['noff-v13.json', 'noff-v13.min.json']) {
    const src = JSON.parse(fx(f)).songs[0], r = one(fx(f));
    const w = r.warnings.find(x => /^Length check/.test(x));
    assert.ok(w && /\+8\.0%/.test(w) && /still plays/.test(w), f + ': ' + w);
    assert.equal(r.note, w);
    assert.equal(r.song.contractVersion, '1.2');
    assert.equal(r.song.sections.length, src.form.length);                    // one section per form entry
    assert.equal(r.song.sectionsFull.length, src.form.length);
    const bpb = 4, bars = src.form.reduce((a, id) => a + src.sections.find(s => s.id === id).bars.length, 0);
    assert.equal(beats(r.song.sections), bars * bpb);                         // Simple covers every bar of the form
    assert.equal(beats(r.song.sectionsFull), bars * bpb);                     // Full covers the same bars
    r.song.sections.forEach((s, i) => assert.equal(beats([s]), beats([r.song.sectionsFull[i]]), 'section ' + i));
    for (const s of r.song.sections) for (const l of s.lyrics || []) for (const m of l.markers || []) assert.ok(m.chordIndex >= 0 && m.chordIndex < s.chords.length);
    const u = U.upBuild(r.song, {}, {}, 'simple');
    assert.equal(u.events.length, r.song.sections.reduce((a, s) => a + s.chords.length, 0));
    assert.equal(U.upBuild(r.song, {}, {}, 'full').secs.length, src.form.length);
    assert.equal(r.song.timing.bpm, v12.timing.bpm);
  }
});

test('form order and repeated ids play in listed order; beat-placed chords get their lengths', () => {
  const s13 = { contractVersion: '1.3', songs: [{ song: { title: 'Form', artist: 'T', key: { tonic: 'G', mode: 'major' } },
    timing: { bpm: 120, timeSignature: '4/4', durationSeconds: 12 }, form: ['a', 'b', 'a'],
    sections: [{ id: 'a', type: 'verse', bars: [{ bar: 1, chords: [{ beat: 1, chord: 'G', confidence: 1 }, { beat: 3, chord: 'C', bass: 'E', confidence: 1 }] }, { bar: 2, chords: [] }] },
      { id: 'b', type: 'chorus', bars: [{ bar: 1, chords: [{ beat: 1, chord: 'D', confidence: 1 }] }, { bar: 2, chords: [{ beat: 2, chord: 'unknown', confidence: 0 }] }] }] }] };
  const r = one(JSON.stringify(s13));
  assert.deepEqual(r.song.sections.map(s => s.type), ['verse', 'chorus', 'verse']);
  assert.deepEqual(r.song.sections[0].chords.map(c => [c.chord, c.durationBeats]), [['G', 2], ['C/E', 6]]);
  assert.deepEqual(r.song.sections[1].chords.map(c => [c.chord, c.durationBeats, c.confidence]), [['D', 5, 1], ['D', 3, 0]]);   // unknown holds D, flagged
  assert.ok(!r.warnings.some(w => /Length check/.test(w)));   // 6 bars x 2 s = 12 s exactly
  assert.equal(beats(r.song.sections), 24);
});

test('diag samples', () => {
  for (const f of ['diag-v12-clean.json', 'diag-v12-single.json', 'diag-bare-array.json']) {
    const r = load(fx(f)); assert.ok(r.ok, f);
    if (r.list) r.rows.forEach(x => assert.equal(x.status, undefined, f + ' ' + JSON.stringify(x.errors)));
  }
  const ex = one(fx('diag-v12-grok-extras.json'));
  assert.ok(ex.warnings.some(w => /^Left out \d+ fields the app doesn't read/.test(w)));
  const nu = one(fx('diag-v12-nulls.json'));
  assert.ok(nu.warnings.some(w => /^Tempo unknown: playing at \d+ BPM\./.test(w)));
  const e13 = load(fx('diag-v13-envelope.json'));   // says 1.3 but has the v1.2 shape: an honest error, not "not valid JSON"
  assert.ok(e13.rows[0].errors.some(e => e.path === 'form' && /^is required/.test(e.msg)));
});

const sp = cs => JSON.stringify({ contractVersion: '1.2', song: { title: 'Spell', artist: 'T', key: { tonic: 'C', mode: 'major' } }, timing: { bpm: 100, timeSignature: '4/4' },
  sections: [{ id: 'v', type: 'verse', chords: ['C', ...cs].map((c, i) => ({ index: i, chord: c, position: { bar: i + 1, beat: 1 }, durationBeats: 4, confidence: 0.8 })) }] });
test('chord spellings are tidied on load (never silently C)', () => {
  const T = [['C6/9', 'C6add9'], ['Cm(maj7)', 'Cm'], ['CmM7', 'Cm'], ['Cø7', 'Cm7b5'], ['Cø', 'Cm7b5'], ['C°7', 'Cdim7'], ['C°', 'Cdim'], ['Co7', 'Cdim7'],
    ['C+', 'Caug'], ['C7+5', 'C7#5'], ['C7alt', 'C7#9'], ['B♭', 'Bb'], ['F♯m', 'F#m'], ['Csus', 'Csus4'], ['C7sus2', 'C7sus2'], ['C-7', 'Cm7'], ['C-', 'Cm'],
    ['CΔ', 'Cmaj7'], ['CΔ7', 'Cmaj7'], ['Cmi7', 'Cm7'], ['Cma7', 'Cmaj7'], ['C7(b9)', 'C7b9'], ['C7(#9,b13)', 'C7#9b13'], ['C9sus', 'C9sus4'], ['Dm7(b5)', 'Dm7b5'], ['B♭/D', 'Bb/D'], ['Eb', 'Eb']];
  const r = one(sp(T.map(t => t[0])));
  assert.deepEqual(r.song.sections[0].chords.slice(1).map(c => c.chord), T.map(t => t[1]));
  for (const c of r.song.sections[0].chords) assert.ok(U.upParseChord(c.chord), c.chord);
  assert.ok(r.warnings.some(w => w === 'Chord "C7alt" read as C7#9 (altered dominant: the app plays it as 7#9)'));
  const nc = one(sp(['F', 'N.C.', 'unknown', 'G']));
  assert.deepEqual(nc.song.sections[0].chords.map(c => [c.chord, c.confidence]), [['C', 0.8], ['F', 0.8], ['F', 0.8], ['F', 0], ['G', 0.8]]);
  const bad = load(sp(['Hm7']));
  assert.ok(!bad.ok && bad.errors.some(e => /chords\[1\]\.chord/.test(e.path)), 'an unreadable chord is an error, not C');
  const st = U.upStep({ pc: 9, mode: 'minor' }, 'Hm7', 1, 0, 'E7').item;   // play-time fallback: the previous chord, not C
  assert.deepEqual([st.rootPc, st.type], [4, 'major']);   // E7
  assert.equal(U.upStep({ pc: 9, mode: 'minor' }, 'Hm7', 1, 0, null).item.rootPc, 9);   // nothing before: the key's home chord (Am)
  assert.equal(U.upStep({ pc: 9, mode: 'minor' }, 'Hm7', 1, 0, null).item.type, 'minor');
});

test('JSON repair: smart quotes, trailing commas, comments, NBSP, BOM, several fences', () => {
  const base = fx('diag-v12-single.json');
  const cases = {
    smart: base.replace(/"/g, (m, i) => (i % 2 ? '\u201c' : '\u201d')),
    trailing: base.replace(/\}(\s*)\]/g, '},$1]').replace(/"(\s*)\}/g, '",$1}'),
    comments: '// the song\n' + base.replace('{', '{ /* start */'),
    nbsp: base.replace(/\n {2}/g, '\n\u00a0\u00a0'),
    bom: '\ufeff' + base,
    fences: 'Example:\n```json\n{"example": true}\n```\nHere it is:\n```json\n' + base + '\n```\nDone.',
    prose: 'Sure! Here is the song { as asked }:\n' + base + '\nEnjoy.',
  };
  for (const [k, t] of Object.entries(cases)) { const r = load(t); assert.ok(r.ok, k + ' ' + JSON.stringify(r.errors)); }
  assert.equal(N.repairJson('{"a": 1, // c\n "b": [1,2,],}'), N.repairJson('{"a": 1, // c\n "b": [1,2,],}'));
  assert.deepEqual(JSON.parse(N.repairJson('{\u201ca\u201d: \u201cx // y\u201d, /* z */ "b": [1,2,],}')), { a: 'x // y', b: [1, 2] });
});

test('versions: number, missing, unknown; empty list and cut-off messages', () => {
  const env = JSON.parse(fx('diag-v12-clean.json'));
  assert.ok(load(JSON.stringify({ ...env, contractVersion: 1.2 })).ok);
  const miss = { ...env }; delete miss.contractVersion;
  const m = load(JSON.stringify(miss)); assert.ok(m.ok && m.warnings.some(w => /contractVersion is missing; read as 1\.2/.test(w)));
  const bad = load(JSON.stringify({ ...env, contractVersion: '2.0' }));
  assert.ok(!bad.ok && /can't read \(it reads 1\.2 and 1\.3\)/.test(bad.errors[0].msg));
  const empty = load(JSON.stringify({ contractVersion: '1.3', songs: [], notes: 'No reliable chords found.' }));
  assert.ok(!empty.ok && /has no songs in it\. The AI's notes: No reliable chords found\./.test(empty.errors[0].msg));
  const t = fx('diag-v12-clean.json'), cut = load(t.slice(0, Math.floor(t.length * 0.6)));
  assert.ok(!cut.ok && /cut off/.test(cut.errors[0].msg));
  const notjson = load('{"contractVersion": "1.2", "songs": [ {"song": } ] }');
  assert.ok(!notjson.ok && !/cut off/.test(notjson.errors[0].msg), 'a malformed but complete answer is not called cut off');
});

test('prompt and schemas: v1.3 prompt in app, schema parses, chord pattern agrees with the parser', () => {
  assert.match(U.UP_PROMPT, /Touch Chord Song List Contract v1\.3/);
  const s13 = JSON.parse(U.upListSchema13Text);
  assert.ok(!/album/i.test(U.UP_PROMPT + U.upListSchema13Text), 'the copied prompt never mentions album (v110)');
  assert.equal(s13.properties.contractVersion.const ?? s13.properties.contractVersion.enum?.[0], '1.3');
  const pat = new RegExp(JSON.parse(schemaOf('songSchemaJson')).$defs.chordSymbol.pattern);
  for (const c of ['C', 'F#m7', 'Bbmaj7', 'Csus2', 'C7sus2', 'C7sus4', 'Cm7b5', 'Cdim7', 'Caug', 'Cadd9', 'C6add9', 'C7#9b13', 'Bb/D']) {
    assert.ok(pat.test(c), 'schema rejects ' + c); assert.ok(U.upParseChord(c), 'parser rejects ' + c);
  }
  assert.ok(N.BARSUM_TOL > 0 && N.BARSUM_TOL < 0.05);
});

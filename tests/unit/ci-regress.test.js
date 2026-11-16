// CI regression checks for pull requests into develop. Each case calls the real modules in js/.
// Simple's Song | Progressions placement (placeSimpleTog in js/ui/simplesrc.js) is not in this
// revision: that file arrives with the open toggle work (PR #5). The state machine both modes
// use is sourceReduce, tested here. Where the toggle sits after a mode switch is a DOM question,
// so tests/ci/smoke.mjs covers it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import './dom-stub.js';

const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const html = readFileSync(new URL('index.html', R), 'utf8');
const schemaOf = id => html.match(new RegExp('<script type="application/json" id="' + id + '">([\\s\\S]*?)</script>'))[1];
const realDoc = globalThis.document;
globalThis.document = new Proxy(realDoc, {
  get: (t, k) => k === 'getElementById'
    ? (id => /^songSchema(13)?Json$/.test(id) ? { textContent: schemaOf(id) } : t.getElementById(id))
    : t[k]
});
if (typeof globalThis.addEventListener !== 'function') globalThis.addEventListener = () => {};
if (typeof globalThis.getComputedStyle !== 'function') globalThis.getComputedStyle = () => new Proxy({}, { get: () => '0' });

const CUE = await import(`../../js/ui/chordcue.js?v=${V}`);
const MODEL = await import(`../../js/expert/model.js?v=${V}`);
const S = await import(`../../js/state.js?v=${V}`);
S.boot();
const U = await import(`../../js/songs/upload.js?v=${V}`);
U.boot();
const SG = await import(`../../js/songs/song.js?v=${V}`);
const PRE = await import(`../../js/songs/presets.js?v=${V}`);
PRE.boot();
const KB = await import(`../../js/ui/keyboard.js?v=${V}`);
const KM = await import(`../../js/ui/kbmath.js?v=${V}`);
const PADS = await import(`../../js/ui/pads.js?v=${V}`);
const KEYS = await import(`../../js/keys.js?v=${V}`);
(await import(`../../js/ui/strip.js?v=${V}`)).boot1();
const { state, shared } = S;
const w12 = n => ((n % 12) + 12) % 12;

// ---------- next-chord lyric cue ----------
test('next-chord lyric cue: the word of the next different chord, not the chord already sounding', () => {
  const lines = {
    '0:0': [{
      text: 'Walking down the empty street',
      markers: [
        { charIndex: 0, chordIndex: 0 },
        { charIndex: 8, chordIndex: 2 },
        { charIndex: 17, chordIndex: 3 }
      ]
    }]
  };
  const events = [0, 1, 2, 3].map(ci => ({ si: 0, ci, rep: 0 }));
  const map = { seq: [{ si: 0, rep: 0, li: 0 }], at: [0, 0, 0, 0] };
  const names = ['C', 'C', 'G', 'Am'];
  const line = (si, rep) => lines[si + ':' + rep];
  assert.equal(CUE.nextChange(names, 0), 2, 'C held across two steps: the cue waits for G');
  assert.equal(CUE.nextChange(names, 1), 2);
  const cue = CUE.songCue(map, 0, 1, events, names, 0, line);
  assert.deepEqual(cue, { j: 2, k: 0, a: 8, b: 12, chord: 'G' });
  assert.equal('Walking down the empty street'.slice(cue.a, cue.b), 'down');
  const pieces = CUE.cuePieces('Walking down the empty street', [{ a: cue.a, b: cue.b, cls: 'x-cue' }]);
  assert.equal(pieces.map(p => p.t).join(''), 'Walking down the empty street', 'the cue never drops lyric text');
  assert.equal(pieces.find(p => p.cls === 'x-cue').t, 'down');
  const bars = [1, 1, 1, 1], barSec = 2, bpb = 4;
  assert.equal(CUE.cueSoon({ j: 2, cur: 0, playing: true, bars, barSec, bpb, since: 0.2 }), false, 'more than a beat left');
  assert.equal(CUE.cueSoon({ j: 2, cur: 1, playing: true, bars, barSec, bpb, since: 1.6 }), true, 'one beat before G');
  assert.equal(CUE.songCue(map, 0, 1, events, ['Am', 'Am', 'Am', 'Am'], 0, line), null, 'one chord all the way: no cue');
});

// ---------- Song | Progressions toggle state (Expert, and the machine Simple reuses) ----------
const reduce = (s, a, ctx) => MODEL.sourceReduce(s, a, ctx);
test('Song | Progressions: one view at a time, Song and Progressions taps', () => {
  assert.deepEqual(MODEL.sourceInit({ hasSong: true, songSelected: true }), { view: 'song', listOpen: false });
  assert.deepEqual(MODEL.sourceInit({ hasSong: false, songSelected: false }), { view: 'prog', listOpen: false });
  const ctx = { hasSong: true, songSelected: true };
  let r = reduce({ view: 'song', listOpen: false }, 'tapProg', ctx);
  assert.deepEqual(r, { s: { view: 'prog', listOpen: true }, fx: null }, 'Progressions opens the list; the song keeps playing');
  r = reduce(r.s, 'tapProg', ctx);
  assert.equal(r.s.listOpen, false, 'tapping the active Progressions tab folds the list');
  assert.equal(r.s.view, 'prog');
  r = reduce({ view: 'prog', listOpen: true }, 'tapSong', { hasSong: true, songSelected: false });
  assert.deepEqual(r, { s: { view: 'song', listOpen: false }, fx: 'selectSong' });
  assert.equal(reduce({ view: 'song', listOpen: false }, 'tapSong', ctx).fx, 'openLibrary', 'the active Song tab opens the library');
  const none = reduce({ view: 'prog', listOpen: true }, 'tapSong', { hasSong: false, songSelected: false });
  assert.deepEqual(none, { s: { view: 'prog', listOpen: false }, fx: 'openLibrary' }, 'no song yet: stay on Progressions and open the library');
});
test('Song | Progressions: a pick folds the list, and sync follows a song loaded elsewhere', () => {
  const r = reduce({ view: 'prog', listOpen: true }, { type: 'pick', i: 3 }, { hasSong: true, songSelected: false });
  assert.deepEqual(r, { s: { view: 'prog', listOpen: false }, fx: { pick: 3 } });
  assert.equal(reduce({ view: 'prog', listOpen: true }, 'sync', { hasSong: true, songSelected: true }).s.view, 'song');
  assert.equal(reduce({ view: 'song', listOpen: false }, 'sync', { hasSong: true, songSelected: false }).s.view, 'prog');
  assert.equal(reduce({ view: 'song', listOpen: false }, 'close', {}).s.listOpen, false);
});
test('Expert #xTog is wired to that reducer; Simple has no placement module on this revision', () => {
  const ui = readFileSync(new URL('js/expert/ui.js', R), 'utf8');
  assert.match(ui, /\$\("xTog"\)\.addEventListener\("click"/);
  assert.match(ui, /srcDo\(b\.dataset\.v === "song" \? "tapSong" : "tapProg"\)/);
  assert.match(ui, /function srcDo\(a\) \{\n  var r = sourceReduce\(src, a, srcCtx\(\)\);/);
  assert.equal(existsSync(new URL('js/ui/simplesrc.js', R)), false, 'placeSimpleTog is not on develop; the smoke step checks the toggle box');
});

// ---------- locked transpose of anh-v13 ----------
function loadAnh() {
  const text = readFileSync(new URL('tests/fixtures/upload/anh-v13.json', R), 'utf8');
  const b = U.upLoadBegin(text, { defer: true });
  const song = b.pending ? b.pending.song : (U.upLoadCheck(b.list, 0), b.list.rows[0].song);
  assert.ok(song && song.song.key.tonic === 'Eb' && song.song.key.mode === 'major', 'anh-v13 loads in Eb major');
  shared.U = U.upBuild(song, {}, {});
  shared.U.locked = true;
  shared.U.liveKey = null;
  return shared.U;
}
function keyOf(pc, mode = 'major') { return { pc, mode }; }
function rootsOf(key) { return PRE.progSteps(key, { up: true }).map(s => ({ pc: s.item.rootPc, type: s.item.type, over: s.item.extensions.over || 0, hc: s.hc })); }

test('anh-v13 locked transpose: order stays, roots ascend left to right, Expert window snaps to the tonic', () => {
  const song = loadAnh();
  const home = keyOf(KEYS.namePc(song.key.tonic), song.key.mode);
  assert.equal(home.pc, 3, 'Eb');
  const order = song.events.map(e => e.si + ':' + e.ci);
  const atHome = rootsOf(home);
  assert.ok(atHome.length > 20, 'the song has a real progression (' + atHome.length + ' steps)');
  assert.equal(SG.upTr(home), 0, 'locked, but the live key is still the song key');

  // Unlocked: a different key does not move the chords.
  shared.U.locked = false;
  assert.equal(SG.upTr(keyOf(0)), 0);
  assert.deepEqual(rootsOf(keyOf(0)).map(s => s.pc), atHome.map(s => s.pc), 'unlocked progression ignores the new key');
  shared.U.locked = true;

  for (const target of [keyOf(0), keyOf(7)]) {   // C major, G major
    const delta = w12(target.pc - home.pc);
    shared.U.liveKey = { tonic: KEYS.keyRootName(target), mode: target.mode };
    const moved = rootsOf(target);
    assert.equal(moved.length, atHome.length, 'transpose does not add or drop steps');
    assert.deepEqual(song.events.map(e => e.si + ':' + e.ci), order, 'the locked progression keeps its step order');
    moved.forEach((s, i) => {
      assert.equal(s.pc, w12(atHome[i].pc + delta), `step ${i} root + ${delta}`);
      assert.equal(s.type, atHome[i].type, `step ${i} quality stays`);
      assert.equal(s.over, atHome[i].over, `step ${i} slash bass stays under the root`);
      assert.equal(KM.chipRootMidi(s.pc), 60 + s.pc, 'the grid root is that pitch class, C4..B4');
    });
    // The song order is not pitch order: some later chord sits to the left of an earlier one.
    const dips = atHome.some((s, i) => i && s.pc < atHome[i - 1].pc);
    assert.equal(dips, true, 'the saved order is not sorted by root');
    // On the grid, a lower pitch class is always further left (hc), in every key.
    for (let a = 0; a < moved.length; a++) for (let b = a + 1; b < moved.length; b++) {
      if (moved[a].pc < moved[b].pc) assert.ok(moved[a].hc < moved[b].hc, `pc ${moved[a].pc} left of ${moved[b].pc}`);
      else if (moved[a].pc > moved[b].pc) assert.ok(moved[a].hc > moved[b].hc);
      else assert.equal(moved[a].hc, moved[b].hc);
    }
    // Display names follow the same lock (upT), not a second transpose.
    const shown = SG.upT(U.upSym(song.events[0].si, song.events[0].ci));
    assert.equal(U.upParseChord(shown).pc, moved[0].pc);
  }

  // Expert piano window: a chord may slide the keys; letting go snaps back to the new tonic.
  // That snap is the rule (kbResetNow -> tonicLow), not a bug.
  const target = keyOf(7);   // G, tonic midi 67
  state.layout = 'octave';
  state.simple = false;
  state.style = 'pop';
  state.keyMode = false;
  shared.kidsView = false;
  shared.lockKey = target;
  PADS.setWinKeys(12);   // Expert draws C..B, 12 keys
  assert.equal(PADS.winKeysNow(), 12);
  assert.equal(KB.kbTonicLow(), KM.tonicLow(7));
  assert.equal(KM.tonicLow(7), 67);
  const offTonic = rootsOf(target).find(s => KM.chipRootMidi(s.pc) !== 67);
  assert.ok(offTonic, 'a transposed chord sits off the tonic');
  shared.kbWinLow = KM.chipRootMidi(offTonic.pc);
  assert.notEqual(shared.kbWinLow, 67, 'the window had moved to show that chord');
  const snapped = KB.kbResetNow();
  assert.equal(snapped, true);
  assert.equal(shared.kbWinLow, 67, 'Expert window snaps back to the tonic');
  assert.equal(KB.kbResetNow(), false, 'a second snap stays on the tonic');
});

// ---------- AI paste: chords and lyrics out of a messy answer ----------
function loadPaste(text) {
  const b = U.upLoadBegin(text, { defer: true });
  if (b.pending) return b.pending.song;
  if (b.list) { U.upLoadCheck(b.list, 0); return b.list.rows[0] && b.list.rows[0].song; }
  return null;
}
test('AI paste: messy answer still yields the chords and the lyric', () => {
  const lyric = 'Walking down the empty street';
  const body = {
    contractVersion: '1.3',
    songs: [{
      song: {
        title: 'Messy Night', artist: 'C.I.',
        key: { tonic: 'C', mode: 'major' },
        sources: [{ id: 'c1', url: 'https://example.com/chart', title: 'chart', kind: 'chord-chart' }]
      },
      timing: {
        bpm: 72, bpmConfidence: 0.8, tempoFeel: 'as-counted', timeSignature: '4/4',
        firstDownbeatSeconds: null, durationSeconds: null, unknown: ['firstDownbeatSeconds', 'durationSeconds']
      },
      form: ['verse1'],
      sections: [{
        id: 'verse1', type: 'verse', label: 'Verse 1',
        startSeconds: null, endSeconds: null, timingSource: 'unknown',
        bars: ['C Major', 'A minor', 'G/B', 'F\u200b'].map((c, i) => ({
          bar: i + 1,
          chords: [{ beat: 1, chord: c, confidence: i === 0 ? 85 : 0.9, source: 'c1' }]
        })),
        lyrics: [{ text: lyric, markers: [{ charIndex: 0, bar: 1, beat: 1 }, { charIndex: 400, bar: 2, beat: 1 }] }]
      }]
    }],
    notes: 'pasted from a chat'
  };
  let raw = JSON.stringify(body, null, 2).replace(/(\n\s*[}\]])/g, ',$1');
  raw = raw.replace(/"([^"\n]*)"/g, (m, inner) => '\u201c' + inner + '\u201d');
  const paste = [
    'Sure, here is the song {as requested}.',
    '',
    '```json',
    raw,
    '```',
    '',
    'The chorus is the same four chords. Let me know if you want it written out.'
  ].join('\n');
  const song = loadPaste(paste);
  assert.ok(song, 'the messy paste loads');
  const sec = song.sections[0];
  assert.deepEqual(sec.chords.map(c => c.chord), ['C', 'Am', 'G/B', 'F']);
  assert.equal(sec.chords[0].confidence, 0.85, 'confidence 85 is read on the 0-1 scale');
  assert.equal(sec.lyrics.length, 1);
  assert.equal(sec.lyrics[0].text, lyric);
  const marks = sec.lyrics[0].markers;
  assert.equal(marks[0].charIndex, 0);
  assert.equal(marks[0].chordIndex, 0);
  assert.equal(marks[1].charIndex, lyric.length, 'a mark past the end of the line moves to the end');
  assert.ok(marks.every(m => m.charIndex <= lyric.length && m.chordIndex < sec.chords.length));
  sec.chords.forEach(c => assert.equal(U.upParseChord(c.chord).error, undefined, c.chord));
});

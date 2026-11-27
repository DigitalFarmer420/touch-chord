// Fretted-instrument voicing resolver. Every catalog chord (PROGRESSIONS,
// PROG_MENU, and the Kids songs) in all 12 keys must resolve on guitar.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const V = readFileSync(new URL("../../js/version.js", import.meta.url), "utf8").match(/APP_VERSION = "([^"]+)"/)[1];
const { Theory: T } = await import(`../../js/theory/index.js?v=${V}`);
const { guitar, ukulele, resolveVoicings, handSpan, fingerCount } = await import("../../js/instruments/index.js?v=" + V);

const QUAL = {
  maj: { type: "major", extensions: {} },
  min: { type: "minor", extensions: {} },
  "7": { type: "major", extensions: { min7: true } },
  maj7: { type: "major", extensions: { maj7: true } },
  m7: { type: "minor", extensions: { min7: true } },
  m7b5: { type: "dim", extensions: { min7: true } },
  sus4: { type: "sus4", extensions: {} },
  sus2: { type: "major", extensions: { sus2: true } },
  add9: { type: "major", extensions: { nine: true } },
  madd9: { type: "minor", extensions: { nine: true } },
  "9": { type: "major", extensions: { min7: true, nine: true } },
  maj9: { type: "major", extensions: { maj7: true, nine: true } },
  m9: { type: "minor", extensions: { min7: true, nine: true } },
  "9sus": { type: "sus4", extensions: { min7: true, nine: true } },
  "13": { type: "major", extensions: { min7: true, thirteen: true } },
  "7b9": { type: "major", extensions: { min7: true, flat9: true } },
  "7#9": { type: "major", extensions: { min7: true, sharp9: true } },
  "7sus4": { type: "sus4", extensions: { min7: true } },
  overV: { type: "major", extensions: { over: 2 } },
  moverV: { type: "minor", extensions: { over: 2 } },
  over3: { type: "major", extensions: { over: 4 } },
  mover3: { type: "minor", extensions: { over: 3 } },
  "6": { type: "major", extensions: { six: true } },
  dim: { type: "dim", extensions: {} }
};

function catalogQualities() {
  const src = readFileSync(new URL("../../js/songs/presets.js", import.meta.url), "utf8");
  const found = new Set();
  for (const m of src.matchAll(/"([^"\n]+)"/g)) {
    const s = m[1];
    if (!/^(?:b?[1-7]\s+\S+)/.test(s)) continue;
    if (/[{}]/.test(s)) continue;
    for (const step of s.split("|")) {
      const parts = step.trim().split(/\s+/);
      if (!/^b?[1-7]$/.test(parts[0]) || !parts[1]) continue;
      found.add(parts[1]);
    }
  }
  return [...found].sort();
}

function chordOf(root, qual) {
  const q = QUAL[qual];
  return { rootPc: root, type: q.type, extensions: Object.assign({}, q.extensions) };
}

function code(frets) {
  return frets.map(f => (f == null ? "x" : String(f))).join("");
}

function pcsOf(midi) {
  return new Set(midi.map(m => ((m % 12) + 12) % 12));
}

function allowedPcs(root, type, ext) {
  return new Set(T.buildChord({ rootPc: root, type: type, extensions: ext }).pcs);
}

function findCode(list, pattern) {
  return list.find(v => code(v.frets) === pattern);
}

test("profiles carry tuning, frets, and hand span", () => {
  assert.equal(guitar.id, "guitar");
  assert.deepEqual(guitar.tuning, [40, 45, 50, 55, 59, 64]);
  assert.equal(guitar.frets, 12);
  assert.equal(guitar.maxSpan, 4);
  assert.equal(guitar.maxFingers, 4);
  assert.equal(guitar.curated, true);
  assert.equal(ukulele.curated, false);
  assert.deepEqual(ukulele.tuning, [67, 60, 64, 69]);
  assert.equal(ukulele.name, "Ukulele");
});

test("hand span ignores open strings and a barre is one finger", () => {
  assert.equal(handSpan([3, 2, 0, 0, 0, 3]), 2);
  assert.equal(handSpan([null, 3, 2, 0, 1, 0]), 3);
  assert.equal(handSpan([0, 0, 0, 0, 0, 0]), 0);
  assert.equal(fingerCount([1, 3, 4, 2, 1, 1]), 4);
  assert.equal(fingerCount([0, 1, 3, 3, 3, 1]), 2);
});

test("seeded open grips are returned exactly", () => {
  const C = resolveVoicings(guitar, chordOf(0, "maj"));
  assert.equal(C[0].shapeName, "Open");
  assert.equal(code(C[0].frets), "x32010");
  assert.deepEqual(C[0].fingers, [0, 3, 2, 0, 1, 0]);
  assert.deepEqual(C[0].midi, [48, 52, 55, 60, 64]);
  assert.deepEqual(C[0].rootStrings, [1, 4]);

  const Am = resolveVoicings(guitar, chordOf(9, "min"));
  const am = findCode(Am, "x02210");
  assert.ok(am);
  assert.deepEqual(am.fingers, [0, 0, 2, 3, 1, 0]);
  assert.equal(am.shapeName, "Open");

  const G = resolveVoicings(guitar, chordOf(7, "maj"));
  const g = findCode(G, "320003");
  assert.ok(g);
  assert.deepEqual(g.fingers, [2, 1, 0, 0, 0, 3]);

  const Cmaj7 = resolveVoicings(guitar, chordOf(0, "maj7"));
  assert.equal(code(Cmaj7[0].frets), "x32000");
  assert.deepEqual(Cmaj7[0].fingers, [0, 3, 2, 0, 0, 0]);

  const Am7 = resolveVoicings(guitar, chordOf(9, "m7"));
  assert.deepEqual(findCode(Am7, "x02010").fingers, [0, 0, 2, 0, 1, 0]);

  const Dm7 = resolveVoicings(guitar, chordOf(2, "m7"));
  const dm7 = findCode(Dm7, "xx0211");
  assert.ok(dm7);
  assert.deepEqual(dm7.fingers, [0, 0, 0, 2, 1, 1]);
  assert.deepEqual(dm7.barres, [{ finger: 1, fret: 1, fromString: 4, toString: 5 }]);

  const G7 = resolveVoicings(guitar, chordOf(7, "7"));
  const g7 = findCode(G7, "320001");
  assert.deepEqual(g7.fingers, [3, 2, 0, 0, 0, 1]);

  const Fmaj7 = resolveVoicings(guitar, chordOf(5, "maj7"));
  assert.ok(findCode(Fmaj7, "xx3210"));

  const F = resolveVoicings(guitar, chordOf(5, "maj"));
  const f = findCode(F, "133211");
  assert.ok(f);
  assert.equal(f.shapeName, "E-shape");
  assert.equal(f.baseFret, 1);
  assert.deepEqual(f.fingers, [1, 3, 4, 2, 1, 1]);
  assert.deepEqual(f.barres, [{ finger: 1, fret: 1, fromString: 0, toString: 5 }]);

  for (const [root, qual, pattern] of [
    [2, "maj", "xx0232"], [4, "maj", "022100"], [4, "min", "022000"], [9, "maj", "x02220"],
    [2, "min", "xx0231"], [4, "7", "020100"], [9, "7", "x02020"], [2, "7", "xx0212"], [11, "7", "x21202"]
  ]) {
    const list = resolveVoicings(guitar, chordOf(root, qual));
    assert.ok(findCode(list, pattern), pattern + " for " + qual);
  }
});

test("movable shapes transpose by fret", () => {
  const Gm = resolveVoicings(guitar, chordOf(7, "min"));
  const e = Gm.find(v => v.shapeName === "E-shape" && v.baseFret === 3);
  assert.ok(e);
  assert.deepEqual(e.frets, [3, 5, 5, 3, 3, 3]);

  const C = resolveVoicings(guitar, chordOf(0, "maj"));
  const a = C.find(v => v.shapeName === "A-shape" && v.baseFret === 3);
  assert.deepEqual(a.frets, [null, 3, 5, 5, 5, 3]);
  assert.deepEqual(a.fingers, [0, 1, 3, 3, 3, 1]);
  assert.equal(C[0].shapeName, "Open");
  assert.equal(C[1].shapeName, "A-shape");
  assert.equal(C.filter(v => v.shapeName !== "Generated").length, C.length);

  const Cmaj7 = resolveVoicings(guitar, chordOf(0, "maj7"));
  const am = Cmaj7.find(v => v.shapeName === "A-shape" && v.baseFret === 3);
  assert.deepEqual(am.frets, [null, 3, 5, 4, 5, 3]);

  for (let root = 0; root < 12; root++) {
    const pos = (root - 4 + 12) % 12;
    if (pos + 2 > guitar.frets) continue;
    const want = [0, 2, 2, 0, 0, 0].map(f => f + pos);
    const list = resolveVoicings(guitar, chordOf(root, "min"));
    assert.ok(list.some(v => code(v.frets) === code(want)), "E-shape minor root " + root);
  }
  for (let root = 0; root < 12; root++) {
    const pos = (root - 9 + 12) % 12;
    if (pos + 2 > guitar.frets) continue;
    const want = [null, 0, 2, 2, 2, 0].map(f => (f == null ? null : f + pos));
    const list = resolveVoicings(guitar, chordOf(root, "maj"));
    assert.ok(list.some(v => code(v.frets) === code(want)), "A-shape major root " + root);
  }
});

test("ukulele open grips", () => {
  const expect = [
    [0, "maj", "0003", [60, 64, 67, 72]],
    [9, "min", "2000", [60, 64, 69, 69]],
    [5, "maj", "2010", [60, 65, 69, 69]],
    [7, "maj", "0232", [62, 67, 67, 71]]
  ];
  for (const [root, qual, pattern, midi] of expect) {
    const list = resolveVoicings(ukulele, chordOf(root, qual));
    assert.ok(list.length >= 1, pattern);
    assert.equal(code(list[0].frets), pattern);
    assert.deepEqual(list[0].midi, midi);
    assert.equal(list[0].simplified, false);
  }
});

test("a chord that cannot keep its 7th is simplified and names the dropped tones", () => {
  const two = { id: "two", name: "Two", tuning: [40, 45], frets: 12, maxSpan: 4, maxFingers: 2, curated: false };
  const list = resolveVoicings(two, chordOf(0, "7"));
  assert.equal(list.length, 1);
  assert.equal(list[0].simplified, true);
  const pcs = pcsOf(list[0].midi);
  assert.ok(pcs.has(0) && pcs.has(4));
  assert.equal(pcs.has(10), false);
  assert.ok(list[0].dropped.includes("Bb"));
  assert.equal(list[0].midi[0] % 12, 0);
});

test("a bass profile with no shape library still resolves", () => {
  const bass = {
    id: "bass", name: "Bass", tuning: [28, 33, 38, 43],
    frets: 12, maxSpan: 4, maxFingers: 4, curated: false
  };
  const list = resolveVoicings(bass, chordOf(0, "maj"));
  assert.ok(list.length >= 1);
  assert.equal(list[0].instrumentId, "bass");
  assert.equal(list[0].shapeName, "Generated");
  assert.equal(list[0].simplified, false);
});

test("every catalog chord in all 12 keys resolves on guitar", () => {
  const quals = catalogQualities();
  const unknown = quals.filter(q => !QUAL[q]);
  assert.deepEqual(unknown, [], "quality tokens the map does not know");
  for (const q of ["maj", "min", "7", "maj7", "m7", "m7b5", "dim", "sus2", "sus4", "add9", "9", "maj9", "m9", "13", "7b9", "7#9", "9sus", "6", "overV", "moverV", "over3", "mover3"]) {
    assert.ok(quals.includes(q), q + " is used by the catalog");
  }
  const simplified = [];
  for (const qual of quals) {
    for (let root = 0; root < 12; root++) {
      const chord = chordOf(root, qual);
      const list = resolveVoicings(guitar, chord);
      const built = T.buildChord({ rootPc: root, type: chord.type, extensions: chord.extensions });
      assert.ok(list.length >= 1, built.symbol);
      const allow = allowedPcs(root, chord.type, chord.extensions);
      const ivs = T.chordIntervals(chord.type, chord.extensions);
      const has3 = ivs.some(i => i === 3 || i === 4);
      const has7 = ivs.some(i => i === 10 || i === 11);
      const third = has3 ? (root + ivs.find(i => i === 3 || i === 4)) % 12 : null;
      const seventh = has7 ? (root + ivs.find(i => i === 10 || i === 11)) % 12 : null;
      const bass = (root + (chord.extensions.over || 0)) % 12;
      for (const v of list) {
        assert.equal(v.instrumentId, "guitar");
        assert.ok(handSpan(v.frets) <= guitar.maxSpan, built.symbol + " span " + code(v.frets));
        assert.ok(fingerCount(v.fingers) <= guitar.maxFingers, built.symbol + " fingers " + v.fingers);
        assert.deepEqual(v.midi.slice().sort((a, b) => a - b), v.midi, "midi low to high");
        const pcs = pcsOf(v.midi);
        for (const pc of pcs) assert.ok(allow.has(pc), built.symbol + " extra " + pc + " in " + code(v.frets));
        assert.ok(pcs.has(root), built.symbol + " missing root");
        if (has3) assert.ok(pcs.has(third), built.symbol + (v.simplified ? " simplified" : "") + " missing 3rd");
        if (has7 && !v.simplified) assert.ok(pcs.has(seventh), built.symbol + " missing 7th");
        if (!v.simplified) {
          for (const iv of ivs) {
            if (iv === 7) continue;
            assert.ok(pcs.has((root + iv) % 12), built.symbol + " dropped interval " + iv);
          }
          if (chord.extensions.over) assert.ok(pcs.has(bass), built.symbol + " missing slash bass");
        }
        if (v.shapeName === "Generated") assert.equal(v.midi[0] % 12, bass, built.symbol + " bass string");
        if (v.simplified) assert.ok(v.dropped.length > 0, built.symbol + " simplified with no dropped tones");
      }
      if (list[0].simplified) simplified.push(built.symbol);
    }
  }
  assert.deepEqual(simplified, []);
});

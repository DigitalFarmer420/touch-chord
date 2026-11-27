// Musician's guitar-shape checks (N26 bass, N27 no mute in the middle).
// 40 qualities x 12 roots, the 315 shown symbols, and the 49 slash chords.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const V = readFileSync(new URL("../../js/version.js", import.meta.url), "utf8").match(/APP_VERSION = "([^"]+)"/)[1];
const { resolveVoicings } = await import(`../../js/instruments/resolve.js?v=${V}`);
const { Theory: T } = await import(`../../js/theory/index.js?v=${V}`);
const cases = JSON.parse(readFileSync(new URL("../fixtures/guitar-inventory.json", import.meta.url), "utf8"));

const NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function code(frets) {
  return frets.map(f => (f == null ? "x" : String(f))).join("");
}

function innerMute(frets) {
  let first = -1, last = -1;
  for (let i = 0; i < frets.length; i++) {
    if (frets[i] != null) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return false;
  for (let i = first; i <= last; i++) if (frets[i] == null) return true;
  return false;
}

function problems(chord, v) {
  const out = [];
  if (!v) return ["no shape"];
  if (v.simplified) out.push("simplified");
  // A middle mute is legal on a library grip. Only the fallback search is refused one.
  if (v.shapeName === "Generated" && innerMute(v.frets)) out.push("search inner mute " + code(v.frets));
  const root = ((chord.rootPc % 12) + 12) % 12;
  const over = chord.extensions && chord.extensions.over || 0;
  const bass = (root + over) % 12;
  if (!v.midi.length || v.midi[0] % 12 !== bass) out.push("bass " + (v.midi[0] % 12));
  const pcs = new Set(v.midi.map(m => ((m % 12) + 12) % 12));
  const allow = new Set(T.buildChord(chord).pcs);
  for (const pc of pcs) if (!allow.has(pc)) out.push("foreign " + pc);
  for (const iv of T.chordIntervals(chord.type, chord.extensions)) {
    if (iv === 7) continue;
    if (!pcs.has((root + iv) % 12)) out.push("missing " + iv);
  }
  return out;
}

function first(rootPc, type, extensions) {
  return resolveVoicings("guitar", { rootPc, type, extensions })[0];
}

test("open shapes keep the root in the bass (N26)", () => {
  const wrong = {
    C6: "x02210", G6: "022000", F6: "xx0211",
    Csus2: "3x0013", Dsus2: "x02230", Asus2: "022200",
    D7sus4: "3x0013", E7sus4: "x02230", B7sus4: "022200",
    D9sus: "x32030", A9sus: "320203"
  };
  const specs = [
    ["C6", 0, "major", { six: true }],
    ["G6", 7, "major", { six: true }],
    ["F6", 5, "major", { six: true }],
    ["Csus2", 0, "major", { sus2: true }],
    ["Dsus2", 2, "major", { sus2: true }],
    ["Asus2", 9, "major", { sus2: true }],
    ["D7sus4", 2, "sus4", { min7: true }],
    ["E7sus4", 4, "sus4", { min7: true }],
    ["B7sus4", 11, "sus4", { min7: true }],
    ["D9sus", 2, "sus4", { min7: true, nine: true }],
    ["A9sus", 9, "sus4", { min7: true, nine: true }]
  ];
  for (const [name, root, type, ext] of specs) {
    const v = first(root, type, ext);
    assert.deepEqual(problems({ rootPc: root, type, extensions: ext }, v), [], name + " " + code(v.frets));
    assert.notEqual(code(v.frets), wrong[name], name);
  }
  assert.equal(code(first(0, "major", { six: true }).frets), "x32210");
});

test("dim7 and m(maj7) come from the library, with the root in the bass (N27)", () => {
  const specs = [
    [0, "dim", { six: true }, "x3x242"],
    [1, "dim", { six: true }, "9x8x80"],
    [8, "minor", { maj7: true }, "4xx00x"]
  ];
  for (const [root, type, ext, bad] of specs) {
    const v = first(root, type, ext);
    assert.notEqual(v.shapeName, "Generated", code(v.frets));
    assert.deepEqual(problems({ rootPc: root, type, extensions: ext }, v), [], code(v.frets));
    assert.notEqual(code(v.frets), bad);
  }
});

test("the E-shape maj7 keeps its deliberate middle mute, and every grip keeps the bass", () => {
  const list = resolveVoicings("guitar", { rootPc: 0, type: "major", extensions: { maj7: true } });
  const e = list.find(v => code(v.frets) === "8x998x");
  assert.ok(e, list.map(v => v.shapeName + " " + code(v.frets)).join("; "));
  assert.equal(e.shapeName, "E-shape");
  assert.equal(innerMute(e.frets), true);
  for (const v of list) assert.equal(v.midi[0] % 12, 0, code(v.frets));
});

test("every quality in all 12 keys has a first grip with the right notes and bass", () => {
  assert.equal(cases.qualities.length, 40);
  const failed = [];
  for (const q of cases.qualities) {
    for (let root = 0; root < 12; root++) {
      const chord = { rootPc: root, type: q.type, extensions: q.ext };
      const list = resolveVoicings("guitar", chord);
      for (const v of list) {
        const why = problems(chord, v);
        if (why.length) failed.push(NAMES[root] + q.key + " " + why.join(", ") + " " + code(v.frets));
      }
    }
  }
  assert.equal(failed.length, 0, failed.slice(0, 12).join("\n"));
});

test("the 315 shown symbols and the 49 slash chords resolve", () => {
  const failed = [];
  let slash = 0;
  for (const row of cases.inventory) {
    const chord = { rootPc: row.r, type: row.t, extensions: row.e };
    if (row.e.over) slash++;
    const list = resolveVoicings("guitar", chord);
    for (const v of list) {
      const why = problems(chord, v);
      if (why.length) failed.push(row.s + " " + why.join(", ") + " " + code(v.frets));
    }
  }
  assert.equal(cases.inventory.length, 315);
  assert.equal(slash, 49);
  assert.equal(failed.length, 0, failed.slice(0, 12).join("\n"));
});

function startFret(frets) {
  let m = null;
  for (const f of frets) if (f > 0 && (m == null || f < m)) m = f;
  return m == null ? 0 : m;
}

test("a searched grip sits at the lowest fret that works (N28)", () => {
  const quals = [
    ["7sus2", "major", { sus2: true, min7: true }],
    ["m9b5", "dim", { min7: true, nine: true }]
  ];
  const high = [];
  let searched = 0;
  for (const [key, type, ext] of quals) {
    for (let r = 0; r < 12; r++) {
      const v = resolveVoicings("guitar", { rootPc: r, type, extensions: ext })[0];
      const start = startFret(v.frets);
      if (v.shapeName === "Generated") searched++;
      if (start > 7) high.push(NAMES[r] + key + " " + code(v.frets) + " " + v.shapeName);
    }
  }
  assert.ok(searched > 0);
  assert.deepEqual(high, []);
});

test("a searched grip keeps the bass and does not mute a middle string", () => {
  const bass = {
    id: "bass", name: "Bass", tuning: [28, 33, 38, 43],
    frets: 12, maxSpan: 5, maxFingers: 4, curated: false
  };
  const list = resolveVoicings(bass, { rootPc: 0, type: "major", extensions: {} });
  assert.ok(list.length >= 1);
  for (const v of list) {
    assert.equal(v.shapeName, "Generated");
    assert.equal(innerMute(v.frets), false, code(v.frets));
    assert.equal(v.midi[0] % 12, 0);
  }
});

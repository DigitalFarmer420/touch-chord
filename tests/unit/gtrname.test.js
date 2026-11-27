// Guitar cards show the chord the song or pad wrote, not a renamed grip.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chordDisplayName } from "../../js/ui/gtrmath.js";
import { accSym } from "../../js/theory/spelling.js?v=2026.11.27.6";

const V = readFileSync(new URL("../../js/version.js", import.meta.url), "utf8").match(/APP_VERSION = "([^"]+)"/)[1];
const { Theory: T } = await import(`../../js/theory/index.js?v=${V}`);

// Written suffix, the app type, and the extensions that suffix plays as.
const KINDS = [
  ["", "major", {}],
  ["m", "minor", {}],
  ["7", "major", { min7: true }],
  ["maj7", "major", { maj7: true }],
  ["m7", "minor", { min7: true }],
  ["m7b5", "dim", { min7: true }],
  ["dim", "dim", {}],
  ["dim7", "dim", { six: true }],
  ["sus2", "major", { sus2: true }],
  ["sus4", "sus4", {}],
  ["6", "major", { six: true }],
  ["m6", "minor", { six: true }],
  ["add9", "major", { nine: true }],
  ["9", "major", { min7: true, nine: true }],
  ["maj9", "major", { maj7: true, nine: true }],
  ["m9", "minor", { min7: true, nine: true }],
  ["7sus4", "sus4", { min7: true }],
  ["7sus2", "major", { sus2: true, min7: true }],
  ["9sus", "sus4", { min7: true, nine: true }],
  ["aug", "major", { sharp5: true }],
  ["13", "major", { min7: true, thirteen: true }],
  ["m9b5", "dim", { min7: true, nine: true }],
  ["maj7#11", "major", { maj7: true }],
  ["m7\u266d5", "dim", { min7: true }]
];

test("every chord type keeps the spelling the song or pad used", () => {
  const roots = ["C", "C#", "Db", "F#"];
  for (const root of roots) {
    for (const [label, type, ext] of KINDS) {
      const chord = { rootName: root, rootPc: 0, type, extensions: ext, chipLabel: label };
      assert.equal(chordDisplayName(chord), accSym(root + label), root + label);
    }
  }
});

test("Cdim7 is not renamed to the dim6 grip", () => {
  const theory = T.buildChord({ rootPc: 0, type: "dim", extensions: { six: true }, rootName: "C" }).symbol;
  assert.equal(theory, "Cdim6");
  const chord = { rootName: "C", rootPc: 0, type: "dim", extensions: { six: true }, chipLabel: "dim7" };
  assert.equal(chordDisplayName(chord), "Cdim7");
  assert.equal(chordDisplayName({ symbol: theory }), "Cdim6");
});

test("a pad quality label is shown when the chip has no separate spelling", () => {
  assert.equal(chordDisplayName({ rootName: "G", type: "dim", qualityLabel: "dim" }), "G\u00b0");
  assert.equal(chordDisplayName({ rootName: "C", type: "sus4", qualityLabel: "sus4" }), "Csus");
  assert.equal(chordDisplayName({ rootName: "C#", type: "dim", qualityLabel: "m7b5" }), accSym("C#m7b5"));
});

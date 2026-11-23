import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("../../js/songs/presets.js", import.meta.url), "utf8");
const REV = JSON.parse(readFileSync(new URL("../fixtures/six-choice-review.json", import.meta.url), "utf8"));
const V2 = JSON.parse(readFileSync(new URL("../fixtures/held-17-v2.json", import.meta.url), "utf8"));
const ADULT = ["pop", "jazz", "rnb", "ballad", "reggae", "funk", "yogaDeep", "country"];

function catalog() {
  const at = SRC.indexOf("PROGRESSIONS = {");
  let i = SRC.indexOf("{", at), depth = 0, end = -1;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === "{") depth++;
    else if (SRC[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
  }
  const P = (name, steps) => ({ name, steps });
  return eval("(" + SRC.slice(i, end + 1) + ")");
}
function grab(mark) {
  const at = SRC.indexOf(mark);
  let i = SRC.indexOf("{", at), depth = 0, end = -1;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === "{") depth++;
    else if (SRC[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
  }
  return eval("(" + SRC.slice(i, end + 1) + ")");
}
const data = catalog();
const byItem = {};
REV.items.forEach((it) => { byItem[it.style + "\0" + it.name] = it; });

test("the old review remains a catalog record, not the menu", () => {
  assert.equal(REV.items.length, 74);
  assert.equal(REV.items.filter((it) => it.decision === "Keep").length, 48);
});

test("full catalog stays underneath the menu", () => {
  let n = 0;
  for (const s of ADULT) for (const m of ["major", "minor"]) n += data[s][m].length;
  assert.equal(n, 137);
  assert.deepEqual(data.kids.major.map((p) => p.name), [
    "Kids Twinkle", "Kids Old MacDonald", "Kids Itsy Bitsy Spider", "Kids Row Your Boat",
    "Kids Head Shoulders Knees and Toes", "Kids Mary's Lamb",
    "Kids Happy Birthday", "Kids Jingle Bells", "Kids London Bridge", "Kids This Old Man"
  ]);
  assert.equal(data.kids.minor.length, 0);
  for (const it of REV.items) {
    for (const [mode, steps] of Object.entries(it.modes)) {
      const hit = data[it.style][mode].filter((p) => p.name === it.name);
      assert.equal(hit.length, 1, it.name + " " + mode);
      assert.equal(hit[0].steps, steps);
    }
  }
});

test("held-17 v2 charts stay in the source catalog with their original steps", () => {
  for (const style of ADULT) {
    for (const mode of ["major", "minor"]) {
      for (const it of V2.progressions[style][mode]) {
        const hit = data[style][mode].find((p) => p.name === it.name);
        assert.ok(hit, it.name);
        assert.equal(hit.steps, it.originalSteps, it.name + " source");
      }
    }
  }
});

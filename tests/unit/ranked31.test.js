import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Noff v3.1 ranked menus: each style and mode lists exactly these charts, in menuOrder.
const SRC = readFileSync(new URL("../../js/songs/presets.js", import.meta.url), "utf8");
const PLAY = readFileSync(new URL("../../js/songs/playback.js", import.meta.url), "utf8");
const V31 = JSON.parse(readFileSync(new URL("../fixtures/ranked-v3.1.json", import.meta.url), "utf8")).menus;
const ADULT = ["pop", "jazz", "rnb", "ballad", "reggae", "funk", "yogaDeep", "country"];

function block(mark, open) {
  const at = SRC.indexOf(mark);
  assert.ok(at >= 0, mark);
  let i = SRC.indexOf(open || "{", at), depth = 0;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === "{") depth++;
    else if (SRC[j] === "}") { depth--; if (depth === 0) return SRC.slice(at, j + 1); }
  }
  throw new Error("unclosed " + mark);
}
function obj(mark) { const b = block(mark); return eval("(" + b.slice(b.indexOf("{")) + ")"); }
const P = (name, s) => ({ name: name, steps: s.split("|") });
const PROG_MENU = obj("var PROG_MENU = {");
const progMenu = eval("(" + block("function progMenu(") + ")");
const progIndexFor = eval("(" + block("export function progIndexFor(").replace(/^export /, "") + ")");
const CATALOG = (function () { const b = block("PROGRESSIONS = {"); return eval("(" + b.slice(b.indexOf("{")) + ")"); })();
const QUALS = new Set(["maj", "min", "7", "maj7", "m7", "m7b5", "sus4", "sus2", "add9", "madd9", "9", "maj9", "m9", "9sus", "13", "7b9", "7#9", "7sus4", "overV", "moverV", "6", "dim", "over3", "mover3"]);

test("v3.1 counts: 154 mode entries, families per style as handed off", () => {
  const want = { pop: [12, 11, 9], jazz: [14, 11, 10], rnb: [12, 9, 10], ballad: [11, 10, 11], reggae: [12, 8, 10], funk: [10, 8, 8], yogaDeep: [10, 8, 10], country: [14, 9, 12] };
  let total = 0;
  for (const s of ADULT) {
    const fam = new Set([...PROG_MENU[s].major, ...PROG_MENU[s].minor].map((e) => e[0]));
    assert.deepEqual([fam.size, PROG_MENU[s].major.length, PROG_MENU[s].minor.length], want[s], s);
    total += PROG_MENU[s].major.length + PROG_MENU[s].minor.length;
  }
  assert.equal(total, 154);
  assert.deepEqual(Object.keys(PROG_MENU), ADULT);
  assert.equal(PROG_MENU.kids, undefined);
});

test("every style/mode menu matches the v3.1 menuOrder exactly, 3-8 steps each, nothing appended", () => {
  for (const s of ADULT) for (const m of ["major", "minor"]) {
    const rows = progMenu(s, CATALOG[s][m], m);
    assert.deepEqual(rows.map((p) => p.name), V31[s][m].map((e) => e.name), s + " " + m);
    rows.forEach((p, i) => {
      assert.equal(p.steps.join("|"), V31[s][m][i].steps, p.name + " " + m);
      assert.ok(p.steps.length >= 3 && p.steps.length <= 8, p.name + " " + p.steps.length);
      p.steps.forEach((t) => {
        assert.match(t, /^b?[1-7] \S+( x[0-9.]+)?$/, p.name + " " + t);
        assert.ok(QUALS.has(t.split(" ")[1]), p.name + " " + t);
      });
      for (let k = 1; k < p.steps.length; k++) assert.notEqual(p.steps[k].split(" x")[0], p.steps[k - 1].split(" x")[0], p.name + " adjacent repeat");
    });
    assert.equal(new Set(rows.map((p) => p.name)).size, rows.length, s + " " + m + " unique names");
  }
});

test("Kids keeps its songs; the menu never writes the source catalog", () => {
  const kids = CATALOG.kids.major;
  assert.equal(progMenu("kids", kids, "major"), kids);
  const before = JSON.stringify(CATALOG);
  for (const s of ADULT) for (const m of ["major", "minor"]) progMenu(s, CATALOG[s][m], m);
  assert.equal(JSON.stringify(CATALOG), before);
  let n = 0;
  for (const s of ADULT) for (const m of ["major", "minor"]) n += CATALOG[s][m].length;
  assert.equal(n, 137);
});

test("Jazz Modal Vamp keeps the same m9 chart in both modes; mode-only charts stay in their mode", () => {
  const vamp = (m) => PROG_MENU.jazz[m].find((e) => e[0] === "Jazz Modal Vamp")[1];
  assert.equal(vamp("major"), vamp("minor"));
  assert.equal(PROG_MENU.pop.major.some((e) => e[0] === "Pop Axis"), false);
  assert.equal(PROG_MENU.jazz.major.some((e) => e[0] === "Jazz Minor ii\u2013V\u2013i"), false);
  assert.equal(PROG_MENU.jazz.minor.some((e) => e[0] === "Jazz Chain"), false);
  assert.equal(PROG_MENU.reggae.major.some((e) => e[0] === "Reggae Minor Riddim"), false);
});

test("a progression no longer on the menu falls back to the first row", () => {
  const list = progMenu("country", CATALOG.country.major, "major");
  assert.equal(progIndexFor(list, "Country Porch"), 0);          // old 17-family pick, gone in v3.1
  assert.equal(progIndexFor(list, "Country Swing"), 0);          // old catalog chart
  assert.equal(progIndexFor(list, "Country Rag"), list.findIndex((p) => p.name === "Country Rag"));
  assert.equal(progIndexFor(list, null), 0);
  assert.equal(progIndexFor(list, ""), 0);
  assert.equal(progIndexFor([], "Pop Bounce"), 0);
  const withSong = list.concat([{ name: "Country Rag", up: true }]);
  assert.equal(progIndexFor(withSong, "Country Rag"), list.findIndex((p) => p.name === "Country Rag"));
  assert.match(PLAY, /prog\.idx = progIndexFor\(prog\.list, oldName\);/);
  assert.match(PLAY, /if \(prog\.idx >= prog\.list\.length\) prog\.idx = 0;/);
});

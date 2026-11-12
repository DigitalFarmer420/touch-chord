import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Expert progression lock (Vinh, Nov 7: a Jazz pick was replaced by the R&B first row on a style change).
const V = readFileSync(new URL("../../js/version.js", import.meta.url), "utf8").match(/APP_VERSION = "([^"]+)"/)[1];
const H = await import(`../../js/songs/proghold.js?v=${V}`);
const MENUS = JSON.parse(readFileSync(new URL("../fixtures/ranked-v3.2.json", import.meta.url), "utf8")).menus;
const PLAY = readFileSync(new URL("../../js/songs/playback.js", import.meta.url), "utf8");
const UI = readFileSync(new URL("../../js/expert/ui.js", import.meta.url), "utf8");
const HOLD = readFileSync(new URL("../../js/songs/proghold.js", import.meta.url), "utf8");
const ADULT = ["pop", "jazz", "rnb", "ballad", "reggae", "funk", "yogaDeep", "country"];
const rows = (s, m) => MENUS[s][m].map((e) => ({ name: e.name, steps: e.steps.split("|") }));
const SONG = { name: "My song", up: true, steps: [] };

test("progHold keeps the same name when the row is on the menu", () => {
  const l = rows("jazz", "major");
  const r = H.progHold(l, { name: "Jazz Blues", steps: ["1 7", "4 7", "5 7", "1 7"] });
  assert.equal(r.list, l);
  assert.equal(l[r.idx].name, "Jazz Blues");
});

test("progHold uses a row with the same steps before adding a held row", () => {
  const l = rows("rnb", "major");
  const r = H.progHold(l, { name: "Pop Turnaround", steps: ["1 maj", "6 min", "4 maj", "5 maj"], from: "pop" });
  assert.equal(r.list, l);
  assert.equal(l[r.idx].name, "R&B DooWop");
});

test("progHold adds the pick as a held row, before a loaded song, without sharing the steps array", () => {
  const pick = { name: "Jazz ii–V–I", steps: ["2 m7", "5 7", "1 maj7"], from: "jazz" };
  const l = rows("rnb", "major").concat([SONG]);
  const r = H.progHold(l, pick);
  assert.notEqual(r.list, l);
  assert.equal(r.list.length, l.length + 1);
  assert.equal(r.idx, l.length - 1);
  assert.deepEqual(r.list[r.idx], { name: "Jazz ii–V–I", steps: ["2 m7", "5 7", "1 maj7"], held: true, from: "jazz" });
  assert.equal(r.list[r.list.length - 1], SONG, "the song stays last");
  assert.notEqual(r.list[r.idx].steps, pick.steps);
  assert.equal(l.length, rows("rnb", "major").length + 1, "the menu passed in is not changed");
});

test("progHold with no pick changes nothing", () => {
  const l = rows("pop", "major");
  assert.deepEqual(H.progHold(l, null), { list: l, idx: -1 });
  assert.deepEqual(H.progHold(l, { name: "x", steps: [] }), { list: l, idx: -1 });
});

test("progLockPick: factory rows only; a held row keeps its first style", () => {
  assert.equal(H.progLockPick(SONG, "pop"), null);
  assert.equal(H.progLockPick(null, "pop"), null);
  assert.deepEqual(H.progLockPick({ name: "Jazz Blues", steps: ["1 7"] }, "jazz"), { name: "Jazz Blues", steps: ["1 7"], from: "jazz" });
  assert.deepEqual(H.progLockPick({ name: "Jazz Blues", steps: ["1 7"], held: true, from: "jazz" }, "rnb"), { name: "Jazz Blues", steps: ["1 7"], from: "jazz" });
});

test("every v3.2 pick keeps its steps in every other style, and comes back to the same row", () => {
  let n = 0;
  for (const m of ["major", "minor"]) for (const a of ADULT) for (const b of ADULT) {
    if (a === b) continue;
    rows(a, m).forEach((row, i) => {
      const there = H.progHold(rows(b, m), H.progLockPick(row, a));
      assert.equal(there.list[there.idx].steps.join("|"), row.steps.join("|"), `${a} ${row.name} -> ${b} ${m}`);
      const back = H.progHold(rows(a, m), H.progLockPick(there.list[there.idx], b));
      assert.equal(back.idx, i, `${row.name} back from ${b} ${m}`);
      n++;
    });
  }
  assert.ok(n > 1000, "pairs checked " + n);
});

test("progSync: unlocked keeps today's rules; the lock is Expert-only, not Kids, not a loaded song", () => {
  const at = PLAY.indexOf("export function progSync");
  const body = PLAY.slice(at, PLAY.indexOf("var kidsKeyFixT", at));
  assert.match(body, /var held = prog\.lock && document\.documentElement\.classList\.contains\("expert"\) && state\.style !== "kids";/);
  const order = ["if (wasUp)", "} else if (held && prog.lockPick)", "} else if (oldRow && oldRow.held && !styleChanged && !keyChanged)", "} else if (styleChanged) {\n    prog.idx = 0;", "} else if (oldName) {\n    prog.idx = progIndexFor(prog.list, oldName);"];
  let last = -1;
  for (const o of order) { const i = body.indexOf(o); assert.ok(i > last, "order: " + o); last = i; }
});

test("the progression lock is its own control and saves nothing", () => {
  assert.match(UI, /class=\\"x-b x-plock\\" aria-pressed=\\"" \+ plk \+ "\\" aria-label=\\"Keep this progression when the style changes\\"/);
  assert.match(UI, /if \(e\.target\.closest\("\.x-plock"\)\) \{ progLockTap\(\); return; \}/);
  const tap = UI.slice(UI.indexOf("function progLockTap"), UI.indexOf("function firstProg"));
  assert.doesNotMatch(tap, /localStorage|scheduleSave|savePref|upSave|sbLock|shared\.U/);
  assert.doesNotMatch(HOLD, /localStorage|import /);
  assert.match(PLAY, /lock: false, lockPick: null \}/);
});

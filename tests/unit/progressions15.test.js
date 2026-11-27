// 15 progressions per style, from the musician's proposal (sha256 in the fixture).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { store } from "./dom-stub.js";

if (!globalThis.addEventListener) globalThis.addEventListener = () => {};

const APPV = readFileSync(new URL("../../js/version.js", import.meta.url), "utf8").match(/APP_VERSION = "([^"]+)"/)[1];
const FIX = JSON.parse(readFileSync(new URL("../fixtures/progressions-15.json", import.meta.url), "utf8"));
const HTML = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const ST = await import(`../../js/state.js?v=${APPV}`);
const PR = await import(`../../js/songs/presets.js?v=${APPV}`);
const STRIP = await import(`../../js/ui/strip.js?v=${APPV}`);
const STY = await import(`../../js/styles.js?v=${APPV}`);
const { Theory: T } = await import(`../../js/theory/index.js?v=${APPV}`);
const { resolveVoicings } = await import(`../../js/instruments/resolve.js?v=${APPV}`);
const { chordDisplayName } = await import(`../../js/ui/gtrmath.js?v=${APPV}`);
const { Band } = await import(`../../js/audio/band.js?v=${APPV}`);
const ChordAudio = (await import(`../../js/audio/index.js?v=${APPV}`)).api;
STRIP.boot1();
ST.boot();
PR.boot();

const STYLES = ["pop", "jazz", "rnb", "ballad", "reggae", "funk", "yogaDeep", "country", "lofi"];
const TYPES = new Set(["major", "minor", "sus4", "dim"]);

function menu(style) {
  const src = readFileSync(new URL("../../js/songs/presets.js", import.meta.url), "utf8");
  const at = src.indexOf("var PROG_MENU = {");
  let i = src.indexOf("{", at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return eval("(" + src.slice(i, j + 1) + ")")[style]; }
  }
  throw new Error("PROG_MENU");
}

test("every style has exactly 15 progressions in proposal order and steps", () => {
  assert.equal(FIX.source.includes("7a9e13d34347c0dc8e5889054a133dd6759f7c1f5f71328c4a8e4227d51b27a2"), true);
  for (const s of STYLES) {
    const live = menu(s);
    const want = FIX.styles[s];
    assert.equal(want.order.length, 15, s);
    assert.equal(new Set(want.order).size, 15, s + " unique");
    for (const mode of ["major", "minor"]) {
      const names = want.order.filter((n) => want[mode][n]);
      assert.deepEqual(live[mode].map((e) => e[0]), names, s + " " + mode + " order");
      for (const e of live[mode]) assert.equal(e[1], want[mode][e[0]], s + " " + e[0]);
      const shown = PR.progList(s, mode).filter((p) => !p.up).map((p) => p.name);
      assert.deepEqual(shown, names, s + " " + mode + " picker");
    }
    const fam = new Set([...live.major, ...live.minor].map((e) => e[0]));
    assert.equal(fam.size, 15, s + " families");
    assert.deepEqual([...fam].sort(), [...want.order].sort(), s + " families");
  }
  assert.equal(menu("kids"), undefined);
  assert.equal(PR.progFeel("Lofi Rainy Day"), "Rainy Day");
  assert.equal(PR.progFeel("Pop Wishing Well"), "Wishing Well");
});

test("each progression step resolves to a valid chord in its key", () => {
  for (const s of STYLES) for (const mode of ["major", "minor"]) {
    const rows = PR.progList(s, mode).filter((p) => !p.up);
    for (let pc = 0; pc < 12; pc++) {
      const key = { pc, mode };
      for (const row of rows) {
        const steps = PR.progSteps(key, row);
        assert.equal(steps.length, row.steps.length, row.name);
        steps.forEach((st, i) => {
          const item = st.item;
          assert.ok(TYPES.has(item.type), row.name + " " + row.steps[i] + " type " + item.type);
          assert.equal(item.rootPc, ((item.rootPc % 12) + 12) % 12);
          assert.equal(typeof item.rootName, "string");
          assert.ok(item.rootName.length > 0, row.name);
          const iv = T.chordIntervals(item.type, item.extensions);
          assert.ok(iv.length >= 3 && iv[0] === 0, row.name + " " + iv.join(","));
          const built = T.buildChord({ rootPc: item.rootPc, rootName: item.rootName, type: item.type, extensions: item.extensions, voicing: "close" });
          assert.ok(built.symbol.length > 0, row.name);
          const pcs = new Set(T.pitchClasses(built.midis));
          for (const n of iv) assert.ok(pcs.has((item.rootPc + n) % 12), row.name + " missing " + n);
        });
      }
    }
  }
});

test("Lofi preset loads: Rhodes, 80 BPM, 7th/9th palette, and the band plays", () => {
  store["touchChord.settings.v1"] = JSON.stringify({ v: 1, settings: { style: "lofi", expert: true } });
  assert.equal(ST.loadSettings().style, "lofi");
  assert.equal(STY.applyStylePreset("lofi"), true);
  assert.equal(ST.state.sound, "epiano");
  assert.equal(ST.state.bass, true);
  assert.equal(ST.state.voicing, "close");
  assert.equal(ST.state.bpm, 80);
  assert.equal(ST.state.warmth, 60);
  assert.equal(ChordAudio.sound, "epiano");
  assert.equal(ChordAudio.cutoffNorm, 0.4);
  assert.equal(ChordAudio.reverbMix, 0.34);
  assert.equal(ChordAudio.delayMix, 0.2);
  assert.equal(ChordAudio.bpm, 80);
  assert.equal(ChordAudio.warmth, 0.6);
  assert.equal(ChordAudio.trim, 0.9);
  assert.equal(ChordAudio.flavor, null);
  assert.equal(STY.styleTrim("lofi"), 0.9);
  assert.equal(STRIP.styleDegreeQual("lofi", "major", 1, false), "maj9");
  assert.equal(STRIP.styleDegreeQual("lofi", "major", 4, false), "maj9");
  assert.equal(STRIP.styleDegreeQual("lofi", "minor", 1, false), "m9");
  assert.equal(STRIP.styleDegreeQual("kids", "major", 1, false), "maj");
  assert.match(HTML, /data-style="lofi">Lofi</);
  const band = new Band({ bpm: 80 });
  band.level = 1;
  band.setStyle("lofi");
  assert.equal(band.active(), true);
  band.setStyle("funk");
  assert.equal(band.active(), false);
  band.style = "lofi";
  const hit = [];
  band.kick = (t, v) => hit.push(["kick", t, v]);
  band.rim = (t, v) => hit.push(["rim", t, v]);
  band.hat = (t, v) => hit.push(["hat", t, v]);
  band.sub = (t, midi) => hit.push(["sub", t, midi]);
  band.crossStick = () => hit.push(["stick"]);
  band.harm = [{ t: 0, rootPc: 0, pcs: { 0: true, 4: true, 7: true } }];
  band.playBeat(1, 0, 4, 0.75, 0);
  band.playBeat(2, 1, 4, 0.75, 0);
  assert.ok(hit.some((h) => h[0] === "kick" && h[1] === 1), "soft kick on 1");
  assert.ok(hit.some((h) => h[0] === "sub"), "root bass");
  assert.ok(hit.some((h) => h[0] === "hat"), "hats");
  assert.ok(hit.some((h) => h[0] === "rim" && h[1] > 2 && h[1] < 2.1), "rim just behind 2");
  assert.equal(hit.filter((h) => h[0] === "kick").every((h) => h[1] < 1.01 || h[1] > 2.2), true);
});

test("Pop Wishing Well sus4 and 7sus4 label, light, and sound", () => {
  const row = PR.progList("pop", "major").find((p) => p.name === "Pop Wishing Well");
  assert.ok(row);
  assert.equal(row.steps.join("|"), "6 m7|1 maj|5 sus4|2 7sus4");
  assert.equal(PR.progList("pop", "minor").some((p) => p.name === "Pop Wishing Well"), false);
  const st = PR.progSteps({ pc: 0, mode: "major" }, row);
  assert.deepEqual(st.map((s) => s.item.rootName + s.item.chipLabel), ["Am7", "C", "Gsus4", "D7sus4"]);
  assert.equal(chordDisplayName(st[2].item), "Gsus4");
  assert.equal(chordDisplayName(st[3].item), "D7sus4");
  assert.match(st[2].roman, /sus4/);
  assert.match(st[3].roman, /7sus4/);

  const g = st[2].item, d = st[3].item;
  assert.equal(g.type, "sus4");
  assert.deepEqual(T.chordIntervals(g.type, g.extensions), [0, 5, 7]);
  assert.equal(d.type, "sus4");
  assert.equal(d.extensions.min7, true);
  assert.deepEqual(T.chordIntervals(d.type, d.extensions), [0, 5, 7, 10]);
  assert.equal(T.chordSymbol("G", "sus4", {}), "Gsus4");
  assert.equal(T.chordSymbol("D", "sus4", { min7: true }), "D7sus4");

  const gPcs = T.pitchClasses(T.voicedMidis(g.rootPc, g.type, g.extensions, "close")).sort((a, b) => a - b);
  const dPcs = T.pitchClasses(T.voicedMidis(d.rootPc, d.type, d.extensions, "close")).sort((a, b) => a - b);
  assert.deepEqual(gPcs, [0, 2, 7]);          // C D G, no 3rd (B)
  assert.deepEqual(dPcs, [0, 2, 7, 9]);       // C D G A, the b7, no 3rd (F#)
  assert.equal(gPcs.includes(11), false);
  assert.equal(dPcs.includes(6), false);

  for (const item of [g, d]) {
    const grip = resolveVoicings("guitar", { rootPc: item.rootPc, type: item.type, extensions: item.extensions })[0];
    assert.ok(grip, item.rootName);
    assert.equal(grip.simplified, false);
    const pcs = new Set(grip.midi.map((m) => ((m % 12) + 12) % 12));
    assert.ok(pcs.has(item.rootPc), "root");
    assert.ok(pcs.has((item.rootPc + 5) % 12), "4th");
    assert.equal(pcs.has((item.rootPc + 4) % 12), false, "no major 3rd");
    if (item.extensions.min7) assert.ok(pcs.has((item.rootPc + 10) % 12), "b7");
    assert.equal(grip.midi[0] % 12, item.rootPc, "bass is the root");
  }
  const frets = (root, ext) => resolveVoicings("guitar", { rootPc: root, type: "sus4", extensions: ext })[0].frets
    .map((f) => (f == null ? "x" : String(f))).join("");
  assert.equal(frets(7, {}), "355533");                 // Gsus4, E-shape
  assert.equal(frets(2, { min7: true }), "xx0213");    // D7sus4, open D-shape
  assert.equal(frets(4, {}), "022200");                // Esus4
  assert.equal(frets(9, {}), "x02230");                // Asus4
  assert.equal(frets(2, {}), "xx0233");                // Dsus4
  assert.equal(frets(4, { min7: true }), "020200");    // E7sus4
  assert.equal(frets(9, { min7: true }), "x02030");    // A7sus4
});

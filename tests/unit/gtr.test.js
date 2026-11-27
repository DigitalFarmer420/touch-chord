// Guitar tab state and the fretboard diagram model. No DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  readGtrTab, gtrTabReduce, showOctave, tabAxis, cardSlots, layoutOf,
  voicingLabel, nextVoicingSize, diagramFrame, cycleIndex, fretSlide, diagramModel, chordSig, ROOT_COLOR, SLIDE_MS,
  fretRows, barreFinger, barreBox
} from "../../js/ui/gtrmath.js";
import { guitar, resolveVoicings } from "../../js/instruments/index.js";
import { GUITAR_OPEN } from "../../js/instruments/guitar-data.js";

const css = readFileSync(new URL("../../css/guitar.css", import.meta.url), "utf8");

test("the tab remembers piano or guitar and nothing else", () => {
  assert.equal(readGtrTab(null), "piano");
  assert.equal(readGtrTab(""), "piano");
  assert.equal(readGtrTab("ukulele"), "piano");
  assert.equal(readGtrTab("guitar"), "guitar");
  assert.equal(gtrTabReduce("piano", "guitar"), "guitar");
  assert.equal(gtrTabReduce("guitar", "piano"), "piano");
  assert.equal(gtrTabReduce("guitar", "toggle"), "piano");
  assert.equal(gtrTabReduce("piano", "toggle"), "guitar");
  assert.equal(gtrTabReduce("guitar", "nope"), "guitar");
  assert.equal(showOctave("piano"), true);
  assert.equal(showOctave("guitar"), false);
});

test("tabs sit on top, and on the left when the phone or iPad is sideways", () => {
  assert.equal(tabAxis("phone-port"), "top");
  assert.equal(tabAxis("pad-port"), "top");
  assert.equal(tabAxis("phone-land"), "side");
  assert.equal(tabAxis("pad-land"), "side");
  assert.equal(layoutOf("expert lay-phone-land"), "phone-land");
  assert.deepEqual(cardSlots("phone-port"), ["now", "next"]);
  assert.deepEqual(cardSlots("phone-land"), ["now", "next", "third", "fourth"]);
  assert.deepEqual(cardSlots("pad-port"), ["now", "next", "third", "fourth"]);
  assert.deepEqual(cardSlots("pad-land"), ["now", "next", "third", "fourth"]);
});

test("C cycles Open, A-shape at 3fr, then E-shape at 8fr", () => {
  const list = resolveVoicings(guitar, { rootPc: 0, type: "major", extensions: {} });
  assert.deepEqual(list.map(voicingLabel), ["Open", "A-shape \u00b7 3fr", "E-shape \u00b7 8fr", "D-shape \u00b7 10fr"]);
  assert.equal(cycleIndex(0, list.length, 1), 1);
  assert.equal(cycleIndex(list.length - 1, list.length, 1), 0);
  assert.equal(cycleIndex(0, list.length, -1), list.length - 1);
  const open = diagramModel(list[0], guitar.tuning, 0);
  assert.equal(open.nut, true);
  assert.equal(open.frLabel, "");
  assert.equal(open.marks[0].kind, "mute");
  assert.equal(open.marks[1].kind, "root");
  assert.equal(open.marks[1].finger, 3);
  assert.equal(open.marks[3].kind, "open");
  assert.equal(open.marks[4].kind, "root");
  assert.equal(open.rootColor, ROOT_COLOR);
  const a = diagramModel(list[1], guitar.tuning, 0);
  assert.equal(a.nut, false);
  assert.equal(a.frLabel, "3fr");
  assert.equal(a.barres.length, 1);
  assert.equal(a.barres[0].fret, 3);
  assert.equal(a.marks[1].kind, "barre-root");
  assert.equal(a.marks[3].kind, "root");
  assert.equal(a.marks[3].finger, 3);
});

test("a key change that keeps the shape is a fret slide", () => {
  const c = resolveVoicings(guitar, { rootPc: 0, type: "major", extensions: {} });
  const d = resolveVoicings(guitar, { rootPc: 2, type: "major", extensions: {} });
  const cA = c.find(v => v.shapeName === "A-shape");
  const dA = d.find(v => v.shapeName === "A-shape");
  assert.equal(fretSlide(cA, dA), 2);
  assert.equal(fretSlide(c[0], d[0]), null);
  assert.equal(SLIDE_MS, 250);
  assert.match(css, /animation:\s*gtr-slide\s+250ms/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /html\.expert:not\(\.kv\)/);
  assert.equal(chordSig({ type: "major", extensions: {} }), chordSig({ type: "major", extensions: { six: false } }));
});

test("the guitar Next card is not the hint class that Next strips", () => {
  const js = readFileSync(new URL("../../js/ui/guitar.js", import.meta.url), "utf8");
  const hint = readFileSync(new URL("../../js/ui/next.js", import.meta.url), "utf8");
  assert.match(js, /slot === "next" \? " next"/);
  assert.doesNotMatch(js, /slot === "next" \? " nx"/);
  assert.match(css, /\.gtr-card\.next \{/);
  assert.match(css, /lay-phone-port \.gtr-card\.next \{ align-self: flex-start/);
  assert.doesNotMatch(css, /\.gtr-card\.nx\b/);
  assert.match(hint, /gtr-card/);
  assert.match(hint, /clearNextHintDom[\s\S]*gtr-card[\s\S]*classList\.remove\("nx", "nx-root"\)/);
});

test("a phone-portrait diagram reserves the dot and the O/X, and a wide side stays", () => {
  const phone = diagramFrame({ w: 96, fh: 18, mk: 11, base: 3, side: 4, top: 9, bot: 10, gutter: 10, fing: true, strings: true, stringsCount: 6, square: true });
  assert.ok(phone.side + 0.01 >= phone.r, "side " + phone.side + " covers r " + phone.r);
  const right = phone.left + 5 * phone.sg;
  assert.ok(right + phone.r <= 96 + 0.01, "high-e dot stays inside");
  assert.ok(phone.left - phone.r >= -0.01, "low-E dot stays inside");
  assert.ok(phone.openCy - phone.openR - phone.stroke >= -0.01, "open marker stays inside the top");
  assert.ok(phone.muteY - phone.mk * 1.05 >= -0.01, "mute em box stays inside the top");
  assert.ok(phone.H <= 96 + 0.6, "the phone square still fills its box");
  const pad = diagramFrame({ w: 190, fh: 49, mk: 13, base: 1, side: 14, top: 22, bot: 16, gutter: 10, fing: true, strings: true, stringsCount: 6 });
  assert.equal(pad.side, 14);
  assert.ok(pad.top >= 22);
});

test("a phone diagram is wider than tall and the frets stay at least 0.9 of the string spacing", () => {
  const frame = diagramFrame({
    w: 126, fh: (126 - 9 - 10) / 4, mk: 11, base: 1, rows: 4, side: 4, top: 9, bot: 10,
    gutter: 10, fing: true, strings: true, stringsCount: 6, square: true, wide: true
  });
  assert.ok(frame.H <= 126 / 1.12 + 0.6, "viewBox " + frame.H);
  assert.ok(126 / frame.H >= 1.05);
  assert.ok(frame.fh / frame.sg >= 0.9 - 1e-9);
});

test("the fret token is what shrinks last", () => {
  assert.equal(nextVoicingSize(87, 85, 12, 10), 11.7);
  assert.equal(nextVoicingSize(80, 100, 12, 10), 12);
  assert.equal(nextVoicingSize(200, 40, 12, 10), 10);
});

test("every first shape draws its dots inside the fret grid", () => {
  const cases = JSON.parse(readFileSync(new URL("../fixtures/guitar-inventory.json", import.meta.url), "utf8"));
  const names = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const outside = [];
  let five = 0;
  let n = 0;
  for (const q of cases.qualities) {
    for (let root = 0; root < 12; root++) {
      const chord = { rootPc: root, type: q.type, extensions: q.ext };
      const v = resolveVoicings(guitar, chord)[0];
      n++;
      const label = names[root] + q.key;
      if (!v) { outside.push(label + " missing"); continue; }
      const rows = fretRows(v.frets);
      const base = v.baseFret > 1 ? v.baseFret : 1;
      let high = 0;
      for (const fret of v.frets) if (fret > high) high = fret;
      const span = high > 0 ? high - base + 1 : 0;
      if (rows < span || rows < 4) outside.push(label + " rows " + rows + " span " + span);
      if (span > 4) five++;
      for (const fret of v.frets) {
        if (!(fret > 0)) continue;
        if (fret - base >= rows) outside.push(label + " fret " + fret + " outside " + rows + " rows from " + base);
      }
      const frame = diagramFrame({
        w: 121, fh: 24, mk: 11, base: base, rows: rows, side: 4, top: 9, bot: 10,
        gutter: 10, fing: true, strings: true, stringsCount: 6, square: true
      });
      if (high > 0) {
        const dotBottom = frame.top + (high - base + 0.5) * frame.fh + frame.r;
        const gridBottom = frame.top + frame.rows * frame.fh;
        if (!(dotBottom < gridBottom)) outside.push(label + " dot crosses the grid");
      }
      if (rows > 4) {
        const ratio = frame.fh / frame.sg;
        if (ratio < 0.9 - 1e-9 || ratio > 1.3 + 1e-9) outside.push(label + " fret ratio " + ratio.toFixed(3));
      }
    }
  }
  assert.equal(n, 480);
  assert.equal(five, 0);
  let altFive = 0;
  for (const q of cases.qualities) {
    for (let root = 0; root < 12; root++) {
      const list = resolveVoicings(guitar, { rootPc: root, type: q.type, extensions: q.ext });
      for (let i = 1; i < list.length; i++) {
        const v = list[i];
        const rows = fretRows(v.frets);
        const base = v.baseFret > 1 ? v.baseFret : 1;
        let high = 0;
        for (const fret of v.frets) if (fret > high) high = fret;
        const span = high > 0 ? high - base + 1 : 0;
        if (span > 4) altFive++;
        if (rows < span || rows < 4) outside.push(names[root] + q.key + " alt rows " + rows + " span " + span);
        for (const fret of v.frets) {
          if (fret > 0 && fret - base >= rows) outside.push(names[root] + q.key + " alt fret " + fret);
        }
      }
    }
  }
  assert.ok(altFive > 0, "an alternate still spans 5 frets");
  assert.deepEqual(outside, []);
  const dm9s = resolveVoicings(guitar, { rootPc: 2, type: "minor", extensions: { min7: true, nine: true } });
  const c9 = resolveVoicings(guitar, { rootPc: 0, type: "major", extensions: { min7: true, nine: true } })[0];
  const frets = v => v.frets.map(f => (f == null ? "x" : String(f))).join("");
  assert.equal(frets(dm9s[0]), "x5355x");
  assert.equal(frets(c9), "x32333");
  assert.equal(frets(dm9s[1]), "x5x968");
  assert.equal(fretRows(dm9s[1].frets), 5);
  assert.equal(fretRows(c9.frets), 4);
});

test("the smaller-stretch table is the first grip, and a 5-fret alternate still fits", () => {
  const cases = JSON.parse(readFileSync(new URL("../fixtures/guitar-inventory.json", import.meta.url), "utf8"));
  const names = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const fretsOf = v => v.frets.map(f => (f == null ? "x" : String(f))).join("");
  function spanOf(frets) {
    let low = null, high = 0;
    for (const f of frets) if (f > 0) { if (low == null || f < low) low = f; if (f > high) high = f; }
    return low == null ? { span: 0, low: 0 } : { span: high - low + 1, low };
  }
  let wide = 0, above = 0, searched = 0;
  const aboveNames = [], searchNames = [];
  for (const q of cases.qualities) {
    for (let root = 0; root < 12; root++) {
      const v = resolveVoicings(guitar, { rootPc: root, type: q.type, extensions: q.ext })[0];
      const s = spanOf(v.frets);
      if (s.span > 4) wide++;
      if (s.low > 7) { above++; aboveNames.push(names[root] + q.key + " " + fretsOf(v)); }
      if (v.shapeName === "Generated") {
        searched++;
        if (q.key !== "7sus2" && q.key !== "m9b5") searchNames.push(names[root] + q.key);
      }
    }
  }
  assert.equal(wide, 0);
  assert.equal(above, 1);
  assert.deepEqual(aboveNames, ["Ebm13 11x11111313"]);
  assert.deepEqual(searchNames, []);
  assert.equal(GUITAR_OPEN.length, 157);
  const first = (root, type, ext) => resolveVoicings(guitar, { rootPc: root, type, extensions: ext })[0];
  const samples = [
    ["C9", 0, "major", { min7: true, nine: true }, "x32333"],
    ["Dm9", 2, "minor", { min7: true, nine: true }, "x5355x"],
    ["Cm9", 0, "minor", { min7: true, nine: true }, "x3133x"],
    ["C13", 0, "major", { min7: true, thirteen: true }, "x32335"],
    ["Cm13", 0, "minor", { min7: true, thirteen: true }, "x30345"],
    ["C7#9", 0, "major", { min7: true, sharp9: true }, "x3234x"],
    ["Fmaj7sus2", 5, "major", { sus2: true, maj7: true }, "xx3010"],
    ["Bbm9b5", 10, "dim", { min7: true, nine: true }, "63665x"]
  ];
  for (const [name, root, type, ext, want] of samples) {
    assert.equal(fretsOf(first(root, type, ext)), want, name);
  }
  // The open Cmaj9 stays. The "Cmaj9 x3243x" family in the table is the A-shape from Db.
  assert.equal(fretsOf(first(0, "major", { maj7: true, nine: true })), "x32430");
  assert.equal(fretsOf(first(1, "major", { maj7: true, nine: true })), "x4354x");
  const swapped = [
    { quality: "add9", rootPc: 10, bassPc: null, name: "D-shape", frets: [null, null, 8, 7, 6, 8], fingers: [0, 0, 3, 2, 1, 4], barres: [] },
    { quality: "add9", rootPc: 11, bassPc: null, name: "D-shape", frets: [null, null, 9, 8, 7, 9], fingers: [0, 0, 3, 2, 1, 4], barres: [] },
    { quality: "madd9", rootPc: 10, bassPc: null, name: "D-shape", frets: [null, null, 8, 6, 6, 8], fingers: [0, 0, 3, 1, 1, 4], barres: [{ finger: 1, fret: 6, fromString: 3, toString: 4 }] },
    { quality: "madd9", rootPc: 11, bassPc: null, name: "Open", frets: [null, 2, 0, 4, 2, 2], fingers: [0, 1, 0, 4, 2, 3], barres: [] },
    { quality: "9", rootPc: 10, bassPc: null, name: "E-shape", frets: [6, null, 6, 7, 6, 8], fingers: [1, 0, 1, 2, 1, 4], barres: [{ finger: 1, fret: 6, fromString: 0, toString: 4 }] },
    { quality: "maj9", rootPc: 10, bassPc: null, name: "Open", frets: [null, 1, 0, 2, 1, null], fingers: [0, 1, 0, 3, 2, 0], barres: [] },
    { quality: "maj9", rootPc: 11, bassPc: null, name: "A-shape", frets: [null, 2, 1, 3, 2, null], fingers: [0, 2, 1, 4, 3, 0], barres: [] },
    { quality: "m9", rootPc: 10, bassPc: null, name: "E-shape", frets: [6, null, 6, 6, 6, 8], fingers: [1, 0, 1, 1, 1, 3], barres: [{ finger: 1, fret: 6, fromString: 0, toString: 4 }] },
    { quality: "mmaj9", rootPc: 10, bassPc: null, name: "E-shape", frets: [6, null, 7, 6, 6, 8], fingers: [1, 0, 2, 1, 1, 4], barres: [{ finger: 1, fret: 6, fromString: 0, toString: 4 }] },
    { quality: "m69", rootPc: 10, bassPc: null, name: "D-shape", frets: [null, null, 8, 6, 8, 8], fingers: [0, 0, 2, 1, 3, 4], barres: [] }
  ];
  for (const grip of swapped) {
    const hit = GUITAR_OPEN.find(g => g.quality === grip.quality && g.rootPc === grip.rootPc && fretsOf(g) === fretsOf(grip));
    assert.deepEqual(hit, grip);
  }
  assert.equal(searched, 19);
});

test("a barre is a bar between the strings and its finger number sits on the bar", () => {
  const full = barreFinger(5, 6, 12, 88, 6);
  assert.equal(full.anchor, "middle");
  assert.equal(full.x, 50);
  const partial = barreFinger(4, 6, 40, 70, 6);
  assert.equal(partial.anchor, "middle");
  assert.equal(partial.x, 55);
  const box = barreBox(40, 70, 30, 6);
  assert.equal(box.x, 40);
  assert.equal(box.width, 30);
  assert.equal(box.height, 12);
  assert.equal(box.y, 24);
  const eb = resolveVoicings(guitar, { rootPc: 3, type: "major", extensions: { maj7: true } })[0];
  const model = diagramModel(eb, guitar.tuning, 3);
  const fretted = model.marks.filter(m => m.fret > 0);
  assert.equal(fretted.length, 4, eb.frets.join(","));
  const drawn = readFileSync(new URL("../../js/ui/guitar.js", import.meta.url), "utf8");
  assert.match(drawn, /m\.kind === "barre" \|\| m\.kind === "barre-root"/);
  assert.match(drawn, /var lite = now \|\| de\(\)\.classList\.contains\("x-day"\)/);
  assert.match(drawn, /ink: "#F3EAD8", line: "#8a7d69", dot: "#F3EAD8", dotT: "#2a231c", mute: "#9d917e"/);
});

test("moved D-shapes keep their frets and number every finger, including the Ebmaj7 root", () => {
  const fretsOf = v => v.frets.map(f => (f == null ? "x" : String(f))).join("");
  const eb = resolveVoicings(guitar, { rootPc: 3, type: "major", extensions: { maj7: true } })[0];
  assert.equal(fretsOf(eb), "xx1333");
  assert.deepEqual(eb.fingers, [0, 0, 1, 3, 3, 3]);
  assert.equal(eb.barres[0].finger, 3);
  const model = diagramModel(eb, guitar.tuning, 3);
  const root = model.marks.find(m => m.string === 2);
  assert.equal(root.kind, "root");
  assert.equal(root.finger, 1, "the D-string root of Ebmaj7 xx1333 has a finger number");
  const dim = resolveVoicings(guitar, { rootPc: 2, type: "dim", extensions: { six: true } })[0];
  assert.equal(fretsOf(dim), "xx0101");
  assert.equal(dim.fingers[3], 1, "open Ddim7 G string");
  assert.equal(dim.fingers[5], 2, "open Ddim7 e string");
  const cases = JSON.parse(readFileSync(new URL("../fixtures/guitar-inventory.json", import.meta.url), "utf8"));
  let missing = 0;
  let voiced = 0;
  for (const q of cases.qualities) {
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      const list = resolveVoicings(guitar, { rootPc, type: q.type, extensions: q.ext });
      for (const v of list) {
        voiced++;
        for (let s = 0; s < v.frets.length; s++) {
          if (!(v.frets[s] > 0)) continue;
          const covered = (v.barres || []).some(b => b.finger > 0 && b.fret === v.frets[s] && s >= b.fromString && s <= b.toString);
          if (!(v.fingers[s] > 0) && !covered) missing++;
        }
      }
    }
  }
  assert.equal(missing, 0);
  assert.ok(voiced > 480);
  const drawn = readFileSync(new URL("../../js/ui/guitar.js", import.meta.url), "utf8");
  assert.match(drawn, /fing: true/);
  assert.doesNotMatch(drawn, /fing: now/);
});

test("open G marks the open G string as a root", () => {
  const g = resolveVoicings(guitar, { rootPc: 7, type: "major", extensions: {} })[0];
  const model = diagramModel(g, guitar.tuning, 7);
  assert.equal(model.marks[0].kind, "root");
  assert.equal(model.marks[2].kind, "open");
  assert.equal(model.marks[3].kind, "open-root");
  assert.equal(model.marks[4].kind, "open");
  assert.equal(model.marks[5].kind, "root");
});

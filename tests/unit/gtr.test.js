// Guitar tab state and the fretboard diagram model. No DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  readGtrTab, gtrTabReduce, showOctave, tabAxis, cardSlots, layoutOf,
  voicingLabel, nextVoicingSize, diagramFrame, cycleIndex, fretSlide, diagramModel, chordSig, ROOT_COLOR, SLIDE_MS
} from "../../js/ui/gtrmath.js";
import { guitar, resolveVoicings } from "../../js/instruments/index.js";

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

test("the fret token is what shrinks last", () => {
  assert.equal(nextVoicingSize(87, 85, 12, 10), 11.7);
  assert.equal(nextVoicingSize(80, 100, 12, 10), 12);
  assert.equal(nextVoicingSize(200, 40, 12, 10), 10);
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

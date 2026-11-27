// Guitar instrument profile, curated open shapes, movable templates, slash rules.
// Arrays are low E → high E. rootString/fromString/toString use 6 = low E, 1 = high E.
// relFrets in templates are measured from the barre (or nut) fret.

const TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4

function S(symbol, quality, rootPc, frets, fingers, extra = {}) {
  const barre = extra.barre || null;
  return {
    symbol,
    quality,
    rootPc,
    frets,
    fingers,
    barre,
    rootString: extra.rootString,
    name: extra.name || "Open",
    movable: !!extra.movable,
    bassPc: extra.bassPc != null ? extra.bassPc : null,
    bassName: extra.bassName || null,
    notes: extra.notes || ""
  };
}

function T(quality, name, rootString, relFrets, fingers, extra = {}) {
  return {
    quality,
    name,
    rootString,
    movable: true,
    relFrets,
    fingers,
    barre: extra.barre || null,
    notes: extra.notes || "",
    simplified: !!extra.simplified
  };
}

// Open / first-position curated shapes (and a few common named open-position 7/m7/maj7s).
export const OPEN_SHAPES = [
  // ---- majors (required C, F, G plus D E A) ----
  S("C", "maj", 0, [-1, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0], { rootString: 5, notes: "x32010" }),
  S("D", "maj", 2, [-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2], { rootString: 4 }),
  S("E", "maj", 4, [0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0], { rootString: 6 }),
  S("F", "maj", 5, [1, 3, 3, 2, 1, 1], [1, 3, 4, 2, 1, 1], { rootString: 6, barre: { fret: 1, fromString: 6, toString: 1 }, notes: "E-shape at 1, 134211" }),
  S("G", "maj", 7, [3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3], { rootString: 6, notes: "320003 / 210003" }),
  S("A", "maj", 9, [-1, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0], { rootString: 5 }),
  S("B", "maj", 11, [-1, 2, 4, 4, 4, 2], [0, 1, 3, 3, 3, 1], { rootString: 5, name: "A-shape", movable: true, barre: { fret: 2, fromString: 5, toString: 1 }, notes: "A-shape at 2; also available as a movable template" }),

  // ---- minors (required Am plus Dm Em) ----
  S("Am", "min", 9, [-1, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0], { rootString: 5, notes: "x02210 / x02310" }),
  S("Dm", "min", 2, [-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1], { rootString: 4 }),
  S("Em", "min", 4, [0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0], { rootString: 6 }),
  S("Fm", "min", 5, [1, 3, 3, 1, 1, 1], [1, 3, 4, 1, 1, 1], { rootString: 6, barre: { fret: 1, fromString: 6, toString: 1 } }),
  S("Bm", "min", 11, [-1, 2, 4, 4, 3, 2], [0, 1, 3, 4, 2, 1], { rootString: 5, name: "A-shape", movable: true, barre: { fret: 2, fromString: 5, toString: 1 } }),

  // ---- dominant 7 (required G7 plus C7 D7 E7 A7 B7 F7) ----
  S("C7", "7", 0, [-1, 3, 2, 3, 1, 0], [0, 3, 2, 4, 1, 0], { rootString: 5 }),
  S("D7", "7", 2, [-1, -1, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3], { rootString: 4 }),
  S("E7", "7", 4, [0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0], { rootString: 6 }),
  S("F7", "7", 5, [1, 3, 1, 2, 1, 1], [1, 3, 1, 2, 1, 1], { rootString: 6, barre: { fret: 1, fromString: 6, toString: 1 } }),
  S("G7", "7", 7, [3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1], { rootString: 6, notes: "320001" }),
  S("A7", "7", 9, [-1, 0, 2, 0, 2, 0], [0, 0, 1, 0, 3, 0], { rootString: 5 }),
  S("B7", "7", 11, [-1, 2, 1, 2, 0, 2], [0, 2, 1, 3, 0, 4], { rootString: 5 }),

  // ---- m7 (required Am7 Dm7) ----
  S("Am7", "m7", 9, [-1, 0, 2, 0, 1, 0], [0, 0, 2, 0, 1, 0], { rootString: 5, notes: "x02010" }),
  S("Dm7", "m7", 2, [-1, -1, 0, 2, 1, 1], [0, 0, 0, 2, 1, 1], { rootString: 4, notes: "xx0211, finger 1 covers the top two strings" }),
  S("Em7", "m7", 4, [0, 2, 0, 0, 0, 0], [0, 2, 0, 0, 0, 0], { rootString: 6 }),
  S("Fm7", "m7", 5, [1, 3, 1, 1, 1, 1], [1, 3, 1, 1, 1, 1], { rootString: 6, barre: { fret: 1, fromString: 6, toString: 1 } }),

  // ---- maj7 (required Cmaj7 Fmaj7) ----
  S("Cmaj7", "maj7", 0, [-1, 3, 2, 0, 0, 0], [0, 3, 2, 0, 0, 0], { rootString: 5, notes: "x32000" }),
  S("Dmaj7", "maj7", 2, [-1, -1, 0, 2, 2, 2], [0, 0, 0, 1, 1, 1], { rootString: 4, barre: { fret: 2, fromString: 3, toString: 1 } }),
  S("Emaj7", "maj7", 4, [0, 2, 1, 1, 0, 0], [0, 3, 1, 2, 0, 0], { rootString: 6, notes: "open 021100; template 0x110x is the movable form" }),
  S("Fmaj7", "maj7", 5, [-1, -1, 3, 2, 1, 0], [0, 0, 3, 2, 1, 0], { rootString: 4, notes: "xx3210" }),
  S("Gmaj7", "maj7", 7, [3, 2, 0, 0, 0, 2], [2, 1, 0, 0, 0, 3], { rootString: 6 }),
  S("Amaj7", "maj7", 9, [-1, 0, 2, 1, 2, 0], [0, 0, 2, 1, 3, 0], { rootString: 5 }),

  // ---- add9 / sus ----
  S("Cadd9", "add9", 0, [-1, 3, 2, 0, 3, 0], [0, 2, 1, 0, 3, 0], { rootString: 5 }),
  S("Dadd9", "add9", 2, [-1, 5, 4, 2, 3, 0], [0, 4, 3, 1, 2, 0], { rootString: 4, notes: "x54230: root and 3rd on A/D, 9th on the open E" }),
  S("Dsus4", "sus4", 2, [-1, -1, 0, 2, 3, 3], [0, 0, 0, 1, 3, 4], { rootString: 4 }),
  S("Dsus2", "sus2", 2, [-1, -1, 0, 2, 3, 0], [0, 0, 0, 1, 3, 0], { rootString: 4 }),
  S("Asus2", "sus2", 9, [-1, 0, 2, 2, 0, 0], [0, 0, 1, 2, 0, 0], { rootString: 5 }),
  S("Asus4", "sus4", 9, [-1, 0, 2, 2, 3, 0], [0, 0, 1, 2, 4, 0], { rootString: 5 }),
  S("Esus4", "sus4", 4, [0, 2, 2, 2, 0, 0], [0, 2, 3, 4, 0, 0], { rootString: 6 }),
  S("Esus2", "sus2", 4, [0, 2, 4, 4, 0, 0], [0, 1, 3, 4, 0, 0], { rootString: 6 }),

  // ---- other useful first-position ----
  S("Cmaj9", "maj9", 0, [-1, 3, 2, 4, 3, 0], [0, 2, 1, 4, 3, 0], { rootString: 5, notes: "root, 3, 7, 9; 5th omitted" }),
  S("Am9", "m9", 9, [-1, 0, 2, 4, 1, 3], [0, 0, 2, 4, 1, 3], { rootString: 5 }),
  S("A9", "9", 9, [-1, 0, -1, 4, 2, 3], [0, 0, 0, 4, 2, 3], { rootString: 5, notes: "x0x423, 5th omitted so the 9, 3 and b7 all fit" }),
  S("Em9", "m9", 4, [0, 2, 0, 0, 0, 2], [0, 2, 0, 0, 0, 3], { rootString: 6 }),
  S("E9", "9", 4, [0, 2, 0, 1, 0, 2], [0, 2, 0, 1, 0, 4], { rootString: 6 }),
  S("A13", "13", 9, [-1, 0, -1, 4, 2, 2], [0, 0, 0, 4, 1, 1], { rootString: 5, notes: "x0x422: 3, 9, 13; 5th omitted" }),
  S("C6", "6", 0, [-1, 3, 2, 2, 1, 0], [0, 3, 2, 4, 1, 0], { rootString: 5 }),
  S("Am6", "m6", 9, [-1, 0, 2, 2, 1, 2], [0, 0, 2, 3, 1, 4], { rootString: 5 }),
  S("Eaug", "aug", 4, [0, 3, 2, 1, 1, 0], [0, 4, 3, 1, 2, 0], { rootString: 6 }),
  S("Edim", "dim", 4, [0, 1, 2, 0, -1, -1], [0, 1, 2, 0, 0, 0], { rootString: 6 }),
  S("Adim", "dim", 9, [-1, 0, 1, 2, 1, -1], [0, 0, 1, 3, 2, 0], { rootString: 5 }),
  S("Edim7", "dim7", 4, [0, 1, 2, 0, 2, 0], [0, 1, 2, 0, 3, 0], { rootString: 6 }),
  S("Bdim", "dim", 11, [-1, 2, 3, 4, 3, -1], [0, 1, 2, 4, 3, 0], { rootString: 5, name: "A-shape", movable: true }),

  // ---- slashes (required G/B, C/E, D/F#) ----
  S("G/B", "maj", 7, [-1, 2, 0, 0, 0, 3], [0, 1, 0, 0, 0, 3], { rootString: 6, bassPc: 11, bassName: "B", notes: "x20003" }),
  S("C/E", "maj", 0, [0, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0], { rootString: 5, bassPc: 4, bassName: "E", notes: "032010" }),
  S("D/F#", "maj", 2, [2, -1, 0, 2, 3, 2], [1, 0, 0, 1, 3, 2], { rootString: 4, bassPc: 6, bassName: "F#", notes: "2x0232" }),
  S("A/C#", "maj", 9, [-1, 4, 2, 2, 2, 0], [0, 3, 1, 1, 1, 0], { rootString: 5, bassPc: 1, bassName: "C#", barre: { fret: 2, fromString: 4, toString: 2 } }),
  S("E/G#", "maj", 4, [4, 2, 2, 1, 0, 0], [4, 2, 3, 1, 0, 0], { rootString: 6, bassPc: 8, bassName: "G#" }),
  S("F/A", "maj", 5, [-1, 0, 3, 2, 1, 1], [0, 0, 4, 3, 1, 2], { rootString: 6, bassPc: 9, bassName: "A", barre: { fret: 1, fromString: 2, toString: 1 } }),
  S("Am/C", "min", 9, [-1, 3, 2, 2, 1, 0], [0, 3, 2, 4, 1, 0], { rootString: 5, bassPc: 0, bassName: "C" }),
  S("Dm/F", "min", 2, [1, -1, 0, 2, 3, 1], [1, 0, 0, 2, 3, 1], { rootString: 4, bassPc: 5, bassName: "F" }),
  S("Em/G", "min", 4, [3, 2, 2, 0, 0, 0], [3, 1, 2, 0, 0, 0], { rootString: 6, bassPc: 7, bassName: "G" }),
  S("C/G", "maj", 0, [3, 3, 2, 0, 1, 0], [3, 4, 2, 0, 1, 0], { rootString: 5, bassPc: 7, bassName: "G" }),
  S("G/D", "maj", 7, [-1, -1, 0, 0, 0, 3], [0, 0, 0, 0, 0, 3], { rootString: 6, bassPc: 2, bassName: "D" }),
  S("F/C", "maj", 5, [-1, 3, 3, 2, 1, 1], [0, 3, 4, 2, 1, 1], { rootString: 6, bassPc: 0, bassName: "C", barre: { fret: 1, fromString: 2, toString: 1 } }),
  S("A/E", "maj", 9, [0, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0], { rootString: 5, bassPc: 4, bassName: "E" }),
  S("D/A", "maj", 2, [-1, 0, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2], { rootString: 4, bassPc: 9, bassName: "A" })
];

// Fix Dadd9: xx0230 is Dsus2 (D A D E) — missing F# (3rd)! I must not use that.
// Dadd9 must include F#. Open: xx0570 missing 3rd too. x54030:
// A+5=D, D+4=F#, G+2=A, B+3=D, E+0=E. Yes x 5 4 2 3 0. I'll replace Dadd9.

// Wait I already wrote Dadd9 as xx0230 which is WRONG. I'll patch after... better fix in this file now.
// I'll rewrite OPEN_SHAPES Dadd9 and A13 and D9 below after export by patching? No, fix the array - I need to edit.

// Movable templates, relative to the barre/root fret.
const Ebarre = { fret: 0, fromString: 6, toString: 1 };
const Abarre = { fret: 0, fromString: 5, toString: 1 };

export const MOVABLE = [
  // ===== E-shape (root on string 6) — required base set =====
  T("maj", "E-shape", 6, [0, 2, 2, 1, 0, 0], [1, 3, 4, 2, 1, 1], { barre: Ebarre, notes: "022100" }),
  T("min", "E-shape", 6, [0, 2, 2, 0, 0, 0], [1, 3, 4, 1, 1, 1], { barre: Ebarre, notes: "022000" }),
  T("7", "E-shape", 6, [0, 2, 0, 1, 0, 0], [1, 3, 1, 2, 1, 1], { barre: Ebarre, notes: "020100" }),
  T("m7", "E-shape", 6, [0, 2, 0, 0, 0, 0], [1, 3, 1, 1, 1, 1], { barre: Ebarre, notes: "020000" }),
  T("maj7", "E-shape", 6, [0, -1, 1, 1, 0, -1], [1, 0, 2, 3, 1, 0], { barre: { fret: 0, fromString: 6, toString: 2 }, notes: "0x110x" }),
  T("9", "E-shape", 6, [0, 2, 0, 1, 0, 2], [1, 3, 1, 2, 1, 4], { barre: { fret: 0, fromString: 6, toString: 2 }, notes: "020102" }),
  T("m9", "E-shape", 6, [0, 2, 0, 0, 0, 2], [1, 3, 1, 1, 1, 4], { barre: Ebarre, notes: "020002" }),
  T("maj9", "E-shape", 6, [0, -1, 1, 1, 0, 2], [1, 0, 2, 3, 1, 4], { barre: { fret: 0, fromString: 6, toString: 2 }, notes: "0x1102" }),
  T("add9", "E-shape", 6, [0, -1, 2, 1, 0, 2], [1, 0, 3, 2, 1, 4], { barre: { fret: 0, fromString: 6, toString: 2 }, notes: "0x2102" }),
  T("madd9", "E-shape", 6, [0, 2, 2, 0, 0, 2], [1, 3, 4, 1, 1, 2], { barre: Ebarre, notes: "022002; finger 2 on the 9, or 1-3-4-1-1-2" }),
  T("sus2", "E-shape", 6, [0, 2, 4, 4, 0, 0], [1, 2, 3, 4, 1, 1], { barre: Ebarre, notes: "024400" }),
  T("sus4", "E-shape", 6, [0, 2, 2, 2, 0, 0], [1, 2, 3, 4, 1, 1], { barre: Ebarre, notes: "022200" }),
  T("7sus4", "E-shape", 6, [0, 2, 0, 2, 0, 0], [1, 2, 1, 3, 1, 1], { barre: Ebarre, notes: "020200" }),
  T("9sus", "E-shape", 6, [0, 2, 0, 2, 0, 2], [1, 2, 1, 3, 1, 4], { barre: { fret: 0, fromString: 6, toString: 2 }, notes: "020202" }),
  T("dim", "E-shape", 6, [0, 1, 2, 0, -1, -1], [1, 2, 3, 1, 0, 0], { barre: { fret: 0, fromString: 6, toString: 3 }, notes: "0120xx" }),
  T("dim7", "E-shape", 6, [0, 1, 2, 0, 2, 0], [1, 2, 3, 1, 4, 1], { barre: Ebarre, notes: "012020" }),
  T("m7b5", "E-shape", 6, [0, 1, 0, 0, 3, 0], [1, 2, 1, 1, 4, 1], { barre: Ebarre, notes: "010030" }),
  T("aug", "E-shape", 6, [0, 3, 2, 1, 1, 0], [1, 4, 3, 2, 2, 1], { barre: { fret: 0, fromString: 6, toString: 1 }, notes: "032110; finger 2 covers G and B at +1" }),
  T("6", "E-shape", 6, [0, -1, 2, 1, 2, 0], [1, 0, 3, 2, 4, 1], { barre: { fret: 0, fromString: 6, toString: 1 }, notes: "0x2120; 5th on the D string is omitted so the grip stays at 4 fingers when moved" }),
  T("m6", "E-shape", 6, [0, -1, 2, 0, 2, 0], [1, 0, 3, 1, 4, 1], { barre: { fret: 0, fromString: 6, toString: 1 }, notes: "0x2020" }),
  T("7b9", "E-shape", 6, [0, 2, 0, 1, 0, 1], [1, 3, 1, 2, 1, 4], { barre: { fret: 0, fromString: 6, toString: 2 }, notes: "020101" }),
  T("7#9", "E-shape", 6, [0, 2, 0, 1, 0, 3], [1, 3, 1, 2, 1, 4], { barre: { fret: 0, fromString: 6, toString: 2 }, notes: "020103 Hendrix" }),
  T("13", "E-shape", 6, [0, -1, 0, 1, 2, 2], [1, 0, 1, 2, 3, 4], { barre: { fret: 0, fromString: 6, toString: 4 }, notes: "0x0122, 5th omitted, has 9 and 13" }),
  T("m13", "E-shape", 6, [0, -1, 0, 0, 2, 2], [1, 0, 1, 1, 3, 4], { barre: Ebarre, notes: "0x0022" }),
  T("aug7", "E-shape", 6, [0, 3, 0, 1, 1, 0], [1, 4, 1, 2, 3, 1], { barre: { fret: 0, fromString: 6, toString: 1 }, notes: "030110" }),
  T("7b5", "E-shape", 6, [0, 1, 0, 1, 3, 0], [1, 2, 1, 3, 4, 1], { barre: Ebarre, notes: "010130" }),
  T("maj7#5", "E-shape", 6, [0, -1, 1, 1, 1, 0], [1, 0, 2, 2, 2, 1], { barre: { fret: 0, fromString: 6, toString: 1 }, notes: "0x1110" }),
  T("majb5", "E-shape", 6, [0, 1, 2, 1, -1, -1], [1, 2, 4, 3, 0, 0], { barre: { fret: 0, fromString: 6, toString: 3 }, notes: "0121xx" }),
  T("mmaj7", "E-shape", 6, [0, 2, 1, 0, 0, 0], [1, 3, 2, 1, 1, 1], { barre: Ebarre, notes: "021000" }),
  T("mmaj9", "E-shape", 6, [0, 2, 1, 0, 0, 2], [1, 3, 2, 1, 1, 4], { barre: Ebarre, notes: "021002" }),
  T("69", "E-shape", 6, [0, -1, 2, 1, 2, 2], [1, 0, 3, 2, 4, 4], { barre: { fret: 0, fromString: 6, toString: 1 }, notes: "0x2122, 5th omitted; finger 4 covers 13 and 9" }),
  T("m69", "E-shape", 6, [0, -1, 2, 0, 2, 2], [1, 0, 3, 1, 4, 4], { barre: { fret: 0, fromString: 6, toString: 1 }, notes: "0x2022" }),
  T("7sus2", "E-shape", 6, [0, 2, 0, 4, 0, 0], [1, 2, 1, 4, 1, 1], { barre: Ebarre, notes: "020400; 4 is a stretch of 4 frets" }),
  T("maj7sus2", "E-shape", 6, [0, -1, 1, 4, 0, 0], [1, 0, 2, 4, 1, 1], { barre: Ebarre, notes: "0x1400" }),
  T("m9b5", "E-shape", 6, [0, 1, 0, 0, 0, 2], [1, 2, 1, 1, 1, 4], { barre: Ebarre, notes: "010002" }),
  T("dimAdd9", "E-shape", 6, [0, 1, 2, 0, -1, 2], [1, 2, 3, 1, 0, 4], { barre: { fret: 0, fromString: 6, toString: 3 }, notes: "0120x2" }),
  T("dimMaj7", "E-shape", 6, [0, 1, 1, 0, -1, -1], [1, 3, 2, 1, 0, 0], { barre: { fret: 0, fromString: 6, toString: 3 }, notes: "0110xx (maj7 + dim triad)" }),
  T("6sus4", "E-shape", 6, [0, 2, 2, 2, 2, 0], [1, 3, 3, 3, 4, 1], { barre: Ebarre, notes: "022220; finger 3 bars A-G-B? B is +2, yes 3 bars A,D,G and 4 on B... A D G at +2, B at +2 too. Finger 3 can bar A–B at +2 (4 strings). 2 fingers." }),
  T("sus4add9", "E-shape", 6, [0, 2, 4, 2, 0, 0], [1, 2, 4, 3, 1, 1], { barre: Ebarre, notes: "024200; has 2 and 4, no 3rd" }),
  T("maj7sus4", "E-shape", 6, [0, -1, 1, 2, 0, 0], [1, 0, 2, 3, 1, 1], { barre: Ebarre, notes: "0x1200" }),

  // ===== A-shape (root on string 5) — required base set =====
  T("maj", "A-shape", 5, [-1, 0, 2, 2, 2, 0], [0, 1, 3, 3, 3, 1], { barre: Abarre, notes: "x02220; one finger bars D-G-B" }),
  T("min", "A-shape", 5, [-1, 0, 2, 2, 1, 0], [0, 1, 3, 4, 2, 1], { barre: Abarre, notes: "x02210" }),
  T("7", "A-shape", 5, [-1, 0, 2, 0, 2, 0], [0, 1, 2, 1, 3, 1], { barre: Abarre, notes: "x02020" }),
  T("m7", "A-shape", 5, [-1, 0, 2, 0, 1, 0], [0, 1, 3, 1, 2, 1], { barre: Abarre, notes: "x02010" }),
  T("maj7", "A-shape", 5, [-1, 0, 2, 1, 2, 0], [0, 1, 3, 2, 4, 1], { barre: Abarre, notes: "x02120" }),
  T("9", "A-shape", 5, [-1, 0, -1, 4, 2, 3], [0, 1, 0, 4, 2, 3], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0x423, 5th omitted" }),
  T("m9", "A-shape", 5, [-1, 0, -1, 4, 1, 3], [0, 1, 0, 4, 2, 3], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0x413" }),
  T("maj9", "A-shape", 5, [-1, 0, -1, 4, 2, 4], [0, 1, 0, 3, 2, 4], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0x424" }),
  T("add9", "A-shape", 5, [-1, 0, 2, 4, 2, 0], [0, 1, 2, 4, 3, 1], { barre: Abarre, notes: "x02420" }),
  T("madd9", "A-shape", 5, [-1, 0, 2, 4, 1, 0], [0, 1, 3, 4, 2, 1], { barre: Abarre, notes: "x02410" }),
  T("sus2", "A-shape", 5, [-1, 0, 2, 2, 0, 0], [0, 1, 3, 4, 1, 1], { barre: Abarre, notes: "x02200" }),
  T("sus4", "A-shape", 5, [-1, 0, 2, 2, 3, 0], [0, 1, 2, 3, 4, 1], { barre: Abarre, notes: "x02230" }),
  T("7sus4", "A-shape", 5, [-1, 0, 2, 0, 3, 0], [0, 1, 2, 1, 4, 1], { barre: Abarre, notes: "x02030" }),
  T("9sus", "A-shape", 5, [-1, 0, 2, 4, 3, 3], [0, 1, 2, 4, 3, 3], { barre: Abarre, notes: "x02433; finger 3 bars B+E" }),
  T("dim", "A-shape", 5, [-1, 0, 1, 2, 1, -1], [0, 1, 2, 4, 3, 0], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0121x" }),
  T("dim7", "A-shape", 5, [-1, 0, 1, 2, 1, 2], [0, 1, 2, 3, 2, 4], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x01212; finger 2 covers D+B? no D is +1, B is +1. Yes finger 2 bars D and B? G is between at +2. Not adjacent. Use 1 0 2 3 2 4 and 2 only on one — 4 fingers: 1,2,3,4." }),
  T("m7b5", "A-shape", 5, [-1, 0, 1, 0, 1, -1], [0, 1, 2, 1, 3, 0], { barre: { fret: 0, fromString: 5, toString: 3 }, notes: "x0101x" }),
  T("aug", "A-shape", 5, [-1, 0, 3, 2, 2, 1], [0, 1, 4, 3, 3, 2], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x03221; finger 3 covers G+B" }),
  T("6", "A-shape", 5, [-1, 0, 2, 2, 2, 2], [0, 1, 3, 3, 3, 4], { barre: Abarre, notes: "x02222; finger 3 bars D-G-B, 4 on high E" }),
  T("m6", "A-shape", 5, [-1, 0, 2, 2, 1, 2], [0, 1, 3, 4, 2, 4], { barre: Abarre, notes: "x02212; pinky covers 6, or 1 3 3 2 4 with 3 on D+G" }),
  T("7b9", "A-shape", 5, [-1, 0, -1, 3, 2, 3], [0, 1, 0, 3, 2, 4], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0x323" }),
  /* A-shape 7#9 omitted: the major 3rd and #9 cannot both fit in a 4-fret A-shape; use E-shape */
  T("13", "A-shape", 5, [-1, 0, -1, 4, 2, 2], [0, 1, 0, 4, 2, 2], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0x422, has 9 and 13, 5th omitted; finger 2 bars B+E" }),
  T("m13", "A-shape", 5, [-1, 0, -1, 4, 1, 2], [0, 1, 0, 4, 2, 3], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0x412" }),
  T("aug7", "A-shape", 5, [-1, 0, 3, 0, 2, 1], [0, 1, 4, 1, 3, 2], { barre: { fret: 0, fromString: 5, toString: 3 }, notes: "x03021" }),
  T("7b5", "A-shape", 5, [-1, 0, 1, 0, 2, 3], [0, 1, 2, 1, 3, 4], { barre: { fret: 0, fromString: 5, toString: 3 }, notes: "x01023" }),
  T("maj7#5", "A-shape", 5, [-1, 0, 3, 1, 2, 1], [0, 1, 4, 2, 3, 2], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x03121" }),
  T("majb5", "A-shape", 5, [-1, 0, 1, 2, 2, -1], [0, 1, 2, 3, 4, 0], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0122x" }),
  T("mmaj7", "A-shape", 5, [-1, 0, 2, 1, 1, 0], [0, 1, 4, 2, 3, 1], { barre: Abarre, notes: "x02110" }),
  T("mmaj9", "A-shape", 5, [-1, 0, -1, 4, 1, 4], [0, 1, 0, 3, 2, 4], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0x414" }),
  T("69", "A-shape", 5, [-1, 0, -1, 4, 2, 2], [0, 1, 0, 4, 2, 2], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0x422 = 9th+6th+3rd (A6/9 without 5th)" }),
  T("m69", "A-shape", 5, [-1, 0, -1, 4, 1, 2], [0, 1, 0, 4, 2, 3], { barre: { fret: 0, fromString: 5, toString: 5 }, notes: "x0x412" }),
  T("7sus2", "A-shape", 5, [-1, 0, 2, 4, 0, 0], [0, 1, 2, 4, 1, 1], { barre: Abarre, notes: "x02400; has 9/2, b7? G at 0 is b7 of A. Yes." }),
  T("maj7sus2", "A-shape", 5, [-1, 0, 2, 1, 0, 0], [0, 1, 3, 2, 1, 1], { barre: Abarre, notes: "x02100 = root, 5, maj7, 9 (sus2)" }),
  T("m9b5", "A-shape", 5, [-1, 0, 1, 0, 0, 3], [0, 1, 2, 1, 1, 4], { barre: { fret: 0, fromString: 5, toString: 2 }, notes: "x01003" }),
  T("6sus4", "A-shape", 5, [-1, 0, 2, 2, 3, 2], [0, 1, 2, 3, 4, 2], { barre: Abarre, notes: "x02232; finger 2 cannot cover D and E easily. Use 1 2 3 4 2 — 4 fingers if 2 only on one string. D+2 and E+2 can use finger 2 as a jump? No. Finger 3 bars D+G, 4 on B, 2 on E? 4 fingers." }),
  T("sus4add9", "A-shape", 5, [-1, 0, 2, 4, 3, 0], [0, 1, 2, 4, 3, 1], { barre: Abarre, notes: "x02430" }),
  T("maj7sus4", "A-shape", 5, [-1, 0, 2, 1, 3, 0], [0, 1, 3, 2, 4, 1], { barre: Abarre, notes: "x02130" }),

  T("9", "A-shape", 5, [-1, 0, "b1", 0, 0, 0], [0, 1, 2, 1, 1, 1], { barre: Abarre, notes: "C9-grip: D string one fret below the barre. Valid when barre >= 1 (C9 = x32333).", minBarre: 1 }),

  // ===== D-shape (root on string 4) =====
  T("maj", "D-shape", 4, [-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2], { notes: "xx0232" }),
  T("min", "D-shape", 4, [-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1], { notes: "xx0231" }),
  T("7", "D-shape", 4, [-1, -1, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3], { notes: "xx0212" }),
  T("m7", "D-shape", 4, [-1, -1, 0, 2, 1, 1], [0, 0, 0, 2, 1, 1], { notes: "xx0211", barre: { fret: 1, fromString: 2, toString: 1 } }),
  T("maj7", "D-shape", 4, [-1, -1, 0, 2, 2, 2], [0, 0, 0, 1, 1, 1], { notes: "xx0222", barre: { fret: 2, fromString: 3, toString: 1 } }),
  T("sus4", "D-shape", 4, [-1, -1, 0, 2, 3, 3], [0, 0, 0, 1, 3, 4], { notes: "xx0233" }),
  T("sus2", "D-shape", 4, [-1, -1, 0, 2, 3, 0], [0, 0, 0, 1, 3, 0], { notes: "xx0230" }),
  T("add9", "D-shape", 4, [-1, -1, 0, 4, 3, 2], [0, 0, 0, 4, 3, 2], { notes: "xx0432, has 3rd and 9, 5th as the high D" }),
  T("6", "D-shape", 4, [-1, -1, 0, 2, 0, 2], [0, 0, 0, 1, 0, 2], { notes: "xx0202 = D A B F#" }),
  T("m6", "D-shape", 4, [-1, -1, 0, 2, 0, 1], [0, 0, 0, 2, 0, 1], { notes: "xx0201" }),
  /* D-shape 9 omitted; use E-shape or A-shape (including the C9-grip x(n)(n-1)nnn for n>=1) */
  T("maj9", "D-shape", 4, [-1, -1, 0, 4, 2, 2], [0, 0, 0, 4, 2, 2], { notes: "xx0422 = D, B, C#, F#" }),
  T("m9", "D-shape", 4, [-1, -1, 0, 4, 1, 1], [0, 0, 0, 4, 1, 1], { notes: "xx0411 = D, B, C, F; finger 1 bars B+E" }),
  T("dim", "D-shape", 4, [-1, -1, 0, 1, 3, 1], [0, 0, 0, 1, 4, 2], { notes: "xx0131 = D, Ab, D, F" }),
  T("dim7", "D-shape", 4, [-1, -1, 0, 1, 0, 1], [0, 0, 0, 2, 0, 1], { notes: "xx0101" }),
  T("m7b5", "D-shape", 4, [-1, -1, 0, 1, 1, 1], [0, 0, 0, 1, 1, 1], { notes: "xx0111 = D, Ab, C, F", barre: { fret: 1, fromString: 3, toString: 1 } }),
  T("7sus4", "D-shape", 4, [-1, -1, 0, 2, 1, 3], [0, 0, 0, 2, 1, 4], { notes: "xx0213" }),
  T("13", "D-shape", 4, [-1, -1, 0, 4, 1, 2], [0, 0, 0, 4, 1, 2], { notes: "xx0412 = root, 13, b7, 3; 5th and 9th omitted — marked simplified if no fuller shape exists" })
];

export const SELECTION_RULES = {
  preferOpenWhenExists: true,
  otherwise: "Choose a movable E-shape, A-shape or D-shape whose root string (6 / 5 / 4) can play the chord root (or whose lowest note is the slash bass). Prefer the candidate with the lowest barre fret; when a previous chord is known, prefer the shape whose fret is closest to that chord's fret (ties go to the lower fret, then E-shape, A-shape, D-shape).",
  slashRule: "If a slash chord is not in the curated list, use a voicing of the upper chord whose lowest sounding note is the named bass. Prefer a familiar open inversion when one exists (3rd in the bass: C/E, G/B, D/F#, A/C#, E/G#, F/A, Am/C, Dm/F, Em/G; 5th in the bass: C/G, G/D, D/A, F/C, A/E). For other keys, start from the E-shape of the upper chord at fret R (the fret where the low E string plays the root): major /3 is x (R-1) (R+2) (R+1) R R; minor /3 is (R+3) x (R+2) R R R; major /2 (IV/V) is (R+2) x (R+2) (R+1) R R (F/G = 3x3211 or 333211); minor /2 is (R+2) x (R+2) R R R; /5 is x (R+2) plus the rest of the E-shape (F/C = x33211). Otherwise place the named bass under an existing open or movable shape, muting skipped strings. Keep span <= 4 and fingers <= 4 (a barre counts as one). If the bass cannot sit under a full voicing, keep the bass, the 3rd or sus tone, and the 7th/extension, and mark the grip simplified.",
  simplifiedRule: "A grip is marked simplified when the full set of chord tones (except an omitted perfect 5th) cannot be played under the span/finger/fret limits. The 3rd (or sus tone) and the 7th, when the symbol has one, are never dropped. Altered 5ths (b5, #5) and the dim 5th stay in the grip.",
  leftHanded: "A left-handed flip (strings reversed) is a later Settings option and is not in this table.",
  ukulele: "Ukulele (G4 C4 E4 A4, reentrant high G) uses the same instrument-profile + shape model; it is out of scope here.",
  checks: [
    "Sounding pitch classes are a subset of the chord's tones (plus the slash bass) and include the root, the 3rd or sus tone, and the 7th/extension when the symbol has one.",
    "The lowest sounding note is the root, or the named slash bass.",
    "Fret span is 4 or less, excluding open strings.",
    "At most 4 fingers, counting a barre as one.",
    "No fret is above 15."
  ]
};

export const INSTRUMENT = {
  name: "guitar",
  tuningMidi: TUNING,
  tuningNames: ["E2", "A2", "D3", "G3", "B3", "E4"],
  strings: 6,
  fretCount: 21,
  stringOrder: "low-to-high",
  rootStringNumbers: "6 = low E, 1 = high E",
  notes: "Ukulele (G4 C4 E4 A4, reentrant) uses the same model but is out of scope."
};

export { TUNING };

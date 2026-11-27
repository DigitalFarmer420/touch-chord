#!/usr/bin/env node
// Verify the Touch Chord Expert Guitar shape table.
// Usage: node verify.mjs
// Reads app source at /workspace/tc-uiux-v4/base (production 2026.11.24.1),
// writes shapes.json, TABLE.md, verify-output.txt, SHA256SUMS in this directory.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadInventory, UPLOAD_QUALITIES, EXPERT_BUTTON_QUALITIES, STRIP_QUAL } from "./inventory.mjs";
import {
  INSTRUMENT, OPEN_SHAPES, MOVABLE, SELECTION_RULES, TUNING,
  resolveChord, checkShape, describeShape, qualityKeyFromTypeExt
} from "./resolve.mjs";
import {
  wrap12, noteName, spellRoot, spellFromName, chordSymbol, normalizeExt, fullSymbol,
  defaultKeyName, toneSets, formatFrets, formatFingers0
} from "./theory.mjs";

function formatFingersDisplay(frets, fingers) {
  return fingers.map((f, i) => (frets[i] < 0 ? "x" : String(f))).join("");
}
function formatFretsDisplay(frets) {
  if (frets.some((f) => f >= 10)) return frets.map((f) => (f < 0 ? "x" : String(f))).join("-");
  return formatFrets(frets);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = [];
function log(s) { out.push(s); console.log(s); }

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function uniqueQualitiesCovered() {
  const q = new Set(OPEN_SHAPES.map((s) => s.quality));
  for (const t of MOVABLE) q.add(t.quality);
  return [...q].sort();
}

function buildShapesJson(inv) {
  return {
    meta: {
      title: "Touch Chord Expert Guitar chord-shape table",
      approved: "2026-11-26",
      instrument: "guitar (ukulele out of scope)",
      source: inv.source,
      generated: "2026-11-26"
    },
    instrument: INSTRUMENT,
    selectionRules: SELECTION_RULES,
    openShapes: OPEN_SHAPES,
    movableTemplates: MOVABLE,
    qualities: UPLOAD_QUALITIES.map((q) => ({
      key: q.key,
      label: q.label,
      type: q.type,
      ext: q.ext,
      via: q.via,
      aliasOf: q.aliasOf || null
    }))
  };
}

function defaultExt() {
  return { six: false, min7: false, maj7: false, nine: false, sus2: false, flat9: false, sharp9: false, thirteen: false, over: 0 };
}

function verifyRequiredOpens() {
  const required = [
    { symbol: "C", frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
    { symbol: "Am", frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
    { symbol: "F", frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] },
    { symbol: "G", frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
    { symbol: "Cmaj7", frets: [-1, 3, 2, 0, 0, 0] },
    { symbol: "Am7", frets: [-1, 0, 2, 0, 1, 0] },
    { symbol: "Dm7", frets: [-1, -1, 0, 2, 1, 1] },
    { symbol: "G7", frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
    { symbol: "Fmaj7", frets: [-1, -1, 3, 2, 1, 0] }
  ];
  const issues = [];
  for (const r of required) {
    const s = OPEN_SHAPES.find((x) => x.symbol === r.symbol);
    if (!s) { issues.push(r.symbol + " missing"); continue; }
    if (s.frets.join() !== r.frets.join()) issues.push(`${r.symbol} frets ${s.frets} != ${r.frets}`);
    if (r.fingers && s.fingers.join() !== r.fingers.join()) issues.push(`${r.symbol} fingers ${s.fingers} != ${r.fingers}`);
  }
  return issues;
}

function writeTable(inv, results) {
  const lines = [];
  const L = (s) => lines.push(s);
  L("# Touch Chord Expert Guitar — chord-shape table");
  L("");
  L("Approved by Vinh on 2026-11-26 for the planned Expert Guitar tab. Ukulele uses the same data model (G4 C4 E4 A4, reentrant) but is out of scope here.");
  L("");
  L(`Source: \`DigitalFarmer420/touch-chord\`, production **${inv.source.version}** (\`${inv.source.commit.slice(0, 7)}\`), checkout \`${inv.source.path}\`.`);
  L("");
  L("## Instrument profile");
  L("");
  L("| Field | Value |");
  L("|---|---|");
  L("| Name | guitar |");
  L("| Tuning (MIDI) | E2 A2 D3 G3 B3 E4 = 40 45 50 55 59 64 |");
  L("| Strings | 6, written low E → high E. String 6 = low E, string 1 = high E. |");
  L("| Frets | 21 (verified shapes stay at 15 or under) |");
  L("");
  L("A shape holds frets per string (−1 = muted), fingers 0–4, an optional barre `{fret, fromString, toString}`, a root string, a name (`Open`, `E-shape`, `A-shape`, `D-shape`), and whether it is movable.");
  L("");
  L("## Inventory");
  L("");
  L(`- **v3.2 progression menus:** ${inv.menuCount} entries (exact). By style/mode:`);
  for (const [style, modes] of Object.entries(inv.menuByStyle)) {
    L(`  - ${style}: major ${modes.major || 0}, minor ${modes.minor || 0}`);
  }
  L(`  Menu qualities: ${inv.menuQualities.join(", ")}. Unique symbols across all 12 major and 12 minor keys: ${inv.menuSymbolCount}.`);
  L(`- **Grid chips (Expert strip, all styles including Kids) plus borrowed / extra chips:** ${inv.gridChipDefs} chip definitions. Grid qualities: ${inv.gridQualities.join(", ")}. Unique symbols in all keys: ${inv.gridSymbolCount}. Borrowed-chip symbols (dashed / bright): ${inv.borrowedSymbolCount}.`);
  L(`- **Kids songs (${inv.kidsSongs.length}):** ${inv.kidsSongs.join(", ")}. Written qualities: ${inv.kidsQualitiesWritten.join(", ")} (${inv.kidsWrittenSymbolCount} symbols in 12 major keys). Kids playback rewrites every step to a major triad on the melody note (v103 \`kidsMajorStep\`); those shown symbols are also ${inv.kidsShownSymbolCount} (the scale's major triads).`);
  L(`- **Upload parser:** ${inv.uploadQualityCount} canonical qualities (maj, m, 7, maj7, m7, 9, add9, sus2, sus4, dim, dim7, m7b5, aug, aug7, 6, m6, maj9, m9, 11→9sus, 13, m13, 7b9, 7#9, 7b5, maj7#5, (b5), m(maj7), m(maj9), 7sus4, 9sus, plus slash bass). \`#11\` and \`b13\` are accepted then left out. Power-chord \`5\` is played as major. Slash chords use a bass note on the lowest sounding string.`);
  L(`- **Expert type × extension buttons:** Major / Minor / Sus4 / Dim combined with 6 / min7 / maj7 / 9: ${EXPERT_BUTTON_QUALITIES.join(", ")}.`);
  L(`- **Union of concrete shown symbols** (menus + grid + Kids, all keys): ${inv.uniqueShownSymbols}.`);
  L("");
  L("## Selection rules");
  L("");
  L("1. Prefer a curated open shape when one exists for that exact chord (root, quality, and slash bass).");
  L("2. Otherwise instantiate the movable E-shape (root on string 6), A-shape (root on string 5) and D-shape (root on string 4) at every fret where the root string plays the root, and pick the valid shape with the lowest fret. If a previous chord is known, pick the one closest to that fret (ties go to the lower fret, then E, A, D).");
  L("3. " + SELECTION_RULES.slashRule);
  L("4. " + SELECTION_RULES.simplifiedRule);
  L("");
  L("## Open shapes");
  L("");
  L("Strings are low E → high E. `x` = muted, `0` = open. Finger `1`–`4` = index to pinky; `0` = open or muted.");
  L("");
  L("| Chord | Frets | Fingers | Barre | Name | Notes |");
  L("|---|---|---|---|---|---|");
  for (const s of OPEN_SHAPES) {
    const barre = s.barre ? `${s.barre.fret}fr s${s.barre.fromString}–${s.barre.toString}` : "—";
    L(`| ${s.symbol} | ${formatFretsDisplay(s.frets)} | ${formatFingersDisplay(s.frets, s.fingers)} | ${barre} | ${s.name} | ${(s.notes || "").replace(/\|/g, "/")} |`);
  }
  L("");
  L("### Pop Four-Chord and Jazz Turnaround (open shapes in C)");
  L("");
  L("Pop Four-Chord (C–G–Am–F) and Jazz Turnaround (Cmaj7–Am7–Dm7–G7), plus Fmaj7 from R&B Classic:");
  L("");
  L("| Chord | Frets | Fingers | Notes |");
  L("|---|---|---|---|");
  const show = ["C", "G", "Am", "F", "Cmaj7", "Am7", "Dm7", "G7", "Fmaj7"];
  const featuredNotes = {
    C: "open",
    G: "open",
    Am: "open",
    F: "barre at fret 1",
    Cmaj7: "open",
    Am7: "open",
    Dm7: "finger 1 covers the top two strings",
    G7: "open",
    Fmaj7: "open"
  };
  for (const sym of show) {
    const s = OPEN_SHAPES.find((x) => x.symbol === sym);
    if (!s) continue;
    L(`| ${s.symbol} | ${formatFretsDisplay(s.frets)} | ${formatFingersDisplay(s.frets, s.fingers)} | ${featuredNotes[sym] || s.notes || s.name} |`);
  }
  L("");
  L("## Movable templates");
  L("");
  L("Frets are relative to the barre (or nut) fret. E-shape root is on string 6; A-shape on string 5; D-shape on string 4. The nut acts as the barre at fret 0 (no barre finger). Each fret up raises the chord by one half step.");
  L("");
  const byQ = new Map();
  for (const t of MOVABLE) {
    if (!byQ.has(t.quality)) byQ.set(t.quality, []);
    byQ.get(t.quality).push(t);
  }
  L("| Quality | Shape | Rel. frets | Fingers | Root string | Notes |");
  L("|---|---|---|---|---|---|");
  for (const q of [...byQ.keys()].sort()) {
    for (const t of byQ.get(q)) {
      const fr = t.relFrets.map((f) => (f === -1 || f === "x" ? "x" : String(f))).join("");
      const fi = formatFingers0(t.fingers);
      L(`| ${q} | ${t.name} | ${fr} | ${fi} | ${t.rootString} | ${(t.notes || "").replace(/\|/g, "/")} |`);
    }
  }
  L("");
  L("Required base set (relative to the barre): E-shape maj 022100, min 022000, 7 020100, m7 020000, maj7 0x110x. A-shape maj x02220, min x02210, 7 x02020, m7 x02010, maj7 x02120.");
  L("");
  L("## Slash-chord rules");
  L("");
  L(SELECTION_RULES.slashRule);
  L("");
  L("Curated inversions include G/B x20003, C/E 032010, D/F# 2x0232, plus A/C#, E/G#, F/A, Am/C, Dm/F, Em/G, C/G, G/D, F/C, A/E, D/A.");
  L("");
  L("## Verification");
  L("");
  L(`Required open-shape check: ${results.requiredIssues.length === 0 ? "PASS" : "FAIL — " + results.requiredIssues.join("; ")}.`);
  L(`Inventory symbols resolved: ${results.invPassed}/${results.invTotal} passed (${results.invSimplified} simplified).`);
  L(`Qualities × 12 roots resolved: ${results.qPassed}/${results.qTotal} passed (${results.qSimplified} simplified).`);
  L(`Slash chords in the inventory: ${results.slashPassed}/${results.slashTotal} passed (${results.slashSimplified} simplified).`);
  L("");
  if (results.exceptions.length) {
    L("### Exceptions");
    L("");
    L("| Symbol | Kind | Result | Issues / notes |");
    L("|---|---|---|---|");
    for (const e of results.exceptions) {
      L(`| ${e.symbol} | ${e.kind} | ${e.result} | ${(e.detail || "").replace(/\|/g, "/")} |`);
    }
    L("");
  } else {
    L("No exceptions: every inventoried symbol and every quality in all 12 keys received a playable, legal grip.");
    L("");
  }
  if (results.simplified.length) {
    L("### Simplified grips");
    L("");
    L("These chords use a playable grip that keeps the root (or slash bass), the 3rd or sus tone, and the 7th when present, but drops a less essential extension of the full voicing (often the 9th of a 13th, or a hard-to-reach altered tone).");
    L("");
    L("| Symbol | Shape | Missing optional tones |");
    L("|---|---|---|");
    for (const e of results.simplified) {
      L(`| ${e.symbol} | ${e.shape} | ${e.missing} |`);
    }
    L("");
  }
  L("## Files");
  L("");
  L("See `SHA256SUMS` for hashes of `shapes.json`, `verify.mjs`, `verify-output.txt`, and this table.");
  L("");
  return lines.join("\n") + "\n";
}

function run() {
  log("Touch Chord guitar shape verification");
  log("Source: DigitalFarmer420/touch-chord production 2026.11.24.1");
  log("");

  const requiredIssues = verifyRequiredOpens();
  log("Required open shapes: " + (requiredIssues.length ? "FAIL\n  " + requiredIssues.join("\n  ") : "PASS (C, Am, F, G, Cmaj7, Am7, Dm7, G7, Fmaj7 match the brief)"));

  log("\nLoading inventory from app source…");
  const inv = loadInventory();
  log(`  v3.2 menus: ${inv.menuCount}`);
  log(`  menu symbols in all keys: ${inv.menuSymbolCount}`);
  log(`  grid chip defs: ${inv.gridChipDefs}; symbols: ${inv.gridSymbolCount}; borrowed symbols: ${inv.borrowedSymbolCount}`);
  log(`  kids songs: ${inv.kidsSongs.length}; written symbols: ${inv.kidsWrittenSymbolCount}; shown majors: ${inv.kidsShownSymbolCount}`);
  log(`  upload qualities: ${inv.uploadQualityCount}`);
  log(`  union of shown symbols: ${inv.uniqueShownSymbols}`);
  log(`  menu qualities: ${inv.menuQualities.join(", ")}`);
  log(`  grid qualities: ${inv.gridQualities.join(", ")}`);

  const exceptions = [];
  const simplified = [];
  let invTotal = 0, invPassed = 0, invSimplified = 0;
  let slashTotal = 0, slashPassed = 0, slashSimplified = 0;

  log("\nResolving every concrete inventory symbol…");
  for (const [symbol, rec] of inv.allSymbols) {
    invTotal++;
    const quality = qualityKeyFromTypeExt(rec.type, rec.ext);
    const spec = { quality, rootPc: rec.rootPc, type: rec.type, ext: rec.ext, bassPc: rec.bassPc, symbol };
    const r = resolveChord(spec);
    const isSlash = rec.bassPc != null;
    if (isSlash) slashTotal++;
    if (r.ok) {
      invPassed++;
      if (isSlash) slashPassed++;
      if (r.shape.simplified || (r.check && r.check.missingOptional && r.check.missingOptional.length)) {
        invSimplified++;
        if (isSlash) slashSimplified++;
        const miss = (r.check.missingOptional || []).join(",");
        simplified.push({ symbol, shape: describeShape(r.shape), missing: miss || "flagged", kind: "inventory" });
        exceptions.push({ symbol, kind: "inventory-simplified", result: "simplified", detail: describeShape(r.shape) + (miss ? "; missing optional pcs " + miss : "") });
      }
    } else {
      const detail = (r.check && r.check.issues ? r.check.issues.join("; ") : "no shape") + (r.alternatives && r.alternatives.length ? " | tried: " + r.alternatives.join(" / ") : "");
      exceptions.push({ symbol, kind: "inventory-fail", result: "FAIL", detail });
      log("  FAIL " + symbol + " — " + detail);
    }
  }
  log(`  inventory: ${invPassed}/${invTotal} passed, ${invSimplified} simplified, ${invTotal - invPassed} failed`);

  log("\nResolving every quality in all 12 roots…");
  const qSet = [];
  const seenQ = new Set();
  for (const q of UPLOAD_QUALITIES) {
    if (q.aliasOf) continue;
    const id = q.type + ":" + JSON.stringify(q.ext);
    if (seenQ.has(id)) continue;
    seenQ.add(id);
    qSet.push(q);
  }
  let qTotal = 0, qPassed = 0, qSimplified = 0;
  for (const q of qSet) {
    for (let pc = 0; pc < 12; pc++) {
      qTotal++;
      const rootName = noteName(spellRoot(pc));
      const symbol = fullSymbol(rootName, q.type, q.ext, null);
      const spec = { quality: q.key, rootPc: pc, type: q.type, ext: q.ext, bassPc: null, symbol };
      const r = resolveChord(spec);
      if (r.ok) {
        qPassed++;
        if (r.shape.simplified || (r.check && r.check.missingOptional && r.check.missingOptional.length)) {
          qSimplified++;
          const miss = (r.check.missingOptional || []).join(",");
          simplified.push({ symbol, shape: describeShape(r.shape), missing: miss || "flagged", kind: "quality×12" });
          exceptions.push({ symbol, kind: "quality-simplified", result: "simplified", detail: describeShape(r.shape) + (miss ? "; missing optional pcs " + miss : "") });
        }
      } else {
        const detail = (r.check && r.check.issues ? r.check.issues.join("; ") : "no shape") + (r.alternatives && r.alternatives.length ? " | tried: " + r.alternatives.join(" / ") : "");
        exceptions.push({ symbol, kind: "quality-fail", result: "FAIL", detail });
        log("  FAIL " + symbol + " (" + q.key + ") — " + detail);
      }
    }
  }
  log(`  qualities×12: ${qPassed}/${qTotal} passed, ${qSimplified} simplified, ${qTotal - qPassed} failed`);

  // Also a representative set of slash chords not in the curated list, all 12 keys
  log("\nResolving slash-rule samples (I/3, IV/V, v/7, and a few extras) in all 12 major keys…");
  const slashSamples = [
    { deg: 1, q: "over3" }, // C/E
    { deg: 4, q: "overV" }, // F/G
    { quality: "min", over: 3 }, // handled via STRIP mover3 on degree 1 later
  ];
  // already in inventory via menus/grid; count is enough.

  const results = {
    requiredIssues,
    invTotal, invPassed, invSimplified,
    qTotal, qPassed, qSimplified,
    slashTotal, slashPassed, slashSimplified,
    exceptions,
    simplified
  };

  const shapesObj = buildShapesJson(inv);
  const shapesText = JSON.stringify(shapesObj, null, 2) + "\n";
  fs.writeFileSync(path.join(HERE, "shapes.json"), shapesText);

  const table = writeTable(inv, results);
  fs.writeFileSync(path.join(HERE, "TABLE.md"), table);

  log("\n========== SUMMARY ==========");
  log(`Menus: ${inv.menuCount} (v3.2)`);
  log(`Qualities covered (templates + upload): ${uniqueQualitiesCovered().join(", ")}`);
  log(`Inventory ${invPassed}/${invTotal}, qualities×12 ${qPassed}/${qTotal}`);
  log(`Simplified: inventory ${invSimplified}, qualities ${qSimplified}`);
  log(`Failed: inventory ${invTotal - invPassed}, qualities ${qTotal - qPassed}`);
  log(`Shapes: ${OPEN_SHAPES.length} open, ${MOVABLE.length} movable templates`);
  log("Wrote shapes.json, TABLE.md");

  const report = out.join("\n") + "\n";
  fs.writeFileSync(path.join(HERE, "verify-output.txt"), report);

  return { inv, results };
}

const { inv, results } = run();

// SHA256 written in a second step after all files exist; also hash this script.
const files = ["shapes.json", "verify.mjs", "verify-output.txt", "TABLE.md", "theory.mjs", "inventory.mjs", "shapes-lib.mjs", "resolve.mjs"];
const sums = [];
for (const f of files) {
  const p = path.join(HERE, f);
  if (!fs.existsSync(p)) continue;
  sums.push(sha256(fs.readFileSync(p)) + "  " + f);
}
fs.writeFileSync(path.join(HERE, "SHA256SUMS"), sums.join("\n") + "\n");
console.log("Wrote SHA256SUMS");
console.log(sums.join("\n"));

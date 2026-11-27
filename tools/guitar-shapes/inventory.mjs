// Inventory of every quality and concrete chord symbol Touch Chord can show.
// Source: DigitalFarmer420/touch-chord, production 2026.11.24.1 (5d51e9da9273cd3e2797d78adb10db63b0679eb1)
// checkout used: /workspace/tc-uiux-v4/base
import fs from "node:fs";
import {
  wrap12, spellFromName, namePc, noteName, spellInterval, plainRootSpell,
  scaleDegrees, defaultKeyName, chordSymbol, normalizeExt, fullSymbol
} from "./theory.mjs";

export const SRC = "/workspace/tc-uiux-v4/base";
export const SRC_COMMIT = "5d51e9da9273cd3e2797d78adb10db63b0679eb1";
export const SRC_VERSION = "2026.11.24.1";

export const STRIP_QUAL = {
  maj:    { type: "major", ext: {}, label: "" },
  min:    { type: "minor", ext: {}, label: "m" },
  "7":    { type: "major", ext: { min7: true }, label: "7" },
  maj7:   { type: "major", ext: { maj7: true }, label: "maj7" },
  m7:     { type: "minor", ext: { min7: true }, label: "m7" },
  m7b5:   { type: "dim",   ext: { min7: true }, label: "m7b5" },
  sus4:   { type: "sus4",  ext: {}, label: "sus4" },
  sus2:   { type: "major", ext: { sus2: true }, label: "sus2" },
  add9:   { type: "major", ext: { nine: true }, label: "add9" },
  madd9:  { type: "minor", ext: { nine: true }, label: "madd9" },
  "9":    { type: "major", ext: { min7: true, nine: true }, label: "9" },
  maj9:   { type: "major", ext: { maj7: true, nine: true }, label: "maj9" },
  m9:     { type: "minor", ext: { min7: true, nine: true }, label: "m9" },
  "9sus": { type: "sus4",  ext: { min7: true, nine: true }, label: "9sus" },
  "13":   { type: "major", ext: { min7: true, thirteen: true }, label: "13" },
  "7b9":  { type: "major", ext: { min7: true, flat9: true }, label: "7b9" },
  "7#9":  { type: "major", ext: { min7: true, sharp9: true }, label: "7#9" },
  "7sus4": { type: "sus4", ext: { min7: true }, label: "7sus4" },
  "6":    { type: "major", ext: { six: true }, label: "6" },
  dim:    { type: "dim",   ext: {}, label: "°" },
  overV:  { type: "major", ext: { over: 2 }, label: "/" },
  moverV: { type: "minor", ext: { over: 2 }, label: "m/" },
  over3:  { type: "major", ext: { over: 4 }, label: "/" },
  mover3: { type: "minor", ext: { over: 3 }, label: "m/" }
};

function parseProgMenu(text) {
  const start = text.indexOf("var PROG_MENU");
  const end = text.indexOf("function progMenu");
  const block = text.slice(start, end);
  const styles = {};
  let style, mode;
  for (const line of block.split("\n")) {
    let m = line.match(/^\s*(pop|jazz|rnb|ballad|reggae|funk|yogaDeep|country):\s*\{/);
    if (m) { style = m[1]; styles[style] = styles[style] || {}; continue; }
    m = line.match(/^\s*(major|minor):\s*\[/);
    if (m) { mode = m[1]; styles[style][mode] = []; continue; }
    for (const mm of line.matchAll(/\["([^"]+)", "([^"]+)"\]/g)) {
      styles[style][mode].push({ name: mm[1], steps: mm[2].split("|").map((s) => s.trim()) });
    }
  }
  return styles;
}

function parseKidsSongs(text) {
  const idx = text.indexOf("PROGRESSIONS =");
  const songs = [];
  const re = /P\("(Kids [^"]+)", "([^"]+)"\)/g;
  let m;
  const slice = text.slice(idx);
  while ((m = re.exec(slice))) {
    songs.push({ name: m[1], steps: m[2].split("|").map((s) => s.trim()) });
  }
  return songs;
}

function parseStripSets(text) {
  function grab(name) {
    const start = text.indexOf("const " + name + " = {");
    let i = text.indexOf("{", start);
    let depth = 0, end = i;
    for (; end < text.length; end++) {
      if (text[end] === "{") depth++;
      else if (text[end] === "}") { depth--; if (depth === 0) { end++; break; } }
    }
    const block = text.slice(i, end);
    const sets = {};
    let style;
    for (const line of block.split("\n")) {
      const sm = line.match(/^\s*(pop|kids|jazz|rnb|ballad|reggae|funk|yogaDeep|country):\s*\[/);
      if (sm) style = sm[1];
      if (!style) continue;
      if (!sets[style]) sets[style] = [];
      // entries like [1, "maj", "happy"] or [7, "maj", "bright", true, true]
      for (const mm of line.matchAll(/\[(\d+),\s*"([^"]+)",\s*"([^"]+)"(?:,\s*(true|false))?(?:,\s*(true|false))?\]/g)) {
        sets[style].push({
          degree: +mm[1],
          quality: mm[2],
          row: mm[3],
          lowered: mm[4] === "true",
          borrowed: mm[5] === "true"
        });
      }
    }
    return sets;
  }
  return { major: grab("STRIP_SETS"), minor: grab("STRIP_SETS_MINOR") };
}

function parseStep(str) {
  const t = str.trim().split(/\s+/);
  const low = t[0].charAt(0) === "b";
  return { deg: parseInt(low ? t[0].slice(1) : t[0], 10), q: t[1], low };
}

function realize(key, deg, qKey, low) {
  const q = STRIP_QUAL[qKey];
  if (!q) throw new Error("unknown quality " + qKey);
  const kdegs = scaleDegrees(key.pc, key.mode, key.spell);
  const d = kdegs[deg - 1];
  const pc = wrap12(d.pc - (low ? 1 : 0));
  const rowPcs = kdegs.map((x) => x.pc).sort((a, b) => a - b);
  const dorder = kdegs.slice().sort((a, b) => a.pc - b.pc).map((x) => x.degree);
  let rs, ni = rowPcs.indexOf(pc);
  if (ni >= 0) rs = kdegs[dorder[ni] - 1].rootSpell;
  else rs = plainRootSpell(pc, low ? { li: d.rootSpell.li, acc: d.rootSpell.acc - 1 } : d.rootSpell);
  const ext = normalizeExt(q.ext);
  const rootName = noteName(rs);
  const bassName = ext.over ? spellInterval(rs, ext.over).name : null;
  const symbol = fullSymbol(rootName, q.type, ext, bassName);
  return {
    symbol,
    rootName,
    rootPc: pc,
    type: q.type,
    ext,
    qualityKey: qKey,
    bassName,
    bassPc: ext.over ? wrap12(pc + ext.over) : null
  };
}

export function allKeys() {
  const keys = [];
  for (const mode of ["major", "minor"]) {
    for (let pc = 0; pc < 12; pc++) {
      const name = defaultKeyName(pc, mode);
      keys.push({ pc, mode, name, spell: spellFromName(name) });
    }
  }
  return keys;
}

// Upload-parser qualities the app accepts (canonical type+ext results).
export const UPLOAD_QUALITIES = [
  { key: "maj", label: "maj", type: "major", ext: {}, via: "C, CM, Cmaj (no number)" },
  { key: "min", label: "m", type: "minor", ext: {}, via: "Cm, Cmin" },
  { key: "5", label: "5→maj", type: "major", ext: {}, via: "C5 (played as major)", aliasOf: "maj" },
  { key: "sus2", label: "sus2", type: "major", ext: { sus2: true }, via: "Csus2, C2" },
  { key: "sus4", label: "sus4", type: "sus4", ext: {}, via: "Csus4, C4" },
  { key: "add9", label: "add9", type: "major", ext: { nine: true }, via: "Cadd9, Cadd2" },
  { key: "madd9", label: "m(add9)", type: "minor", ext: { nine: true }, via: "Cmadd9" },
  { key: "6", label: "6", type: "major", ext: { six: true }, via: "C6" },
  { key: "m6", label: "m6", type: "minor", ext: { six: true }, via: "Cm6" },
  { key: "dim", label: "°", type: "dim", ext: {}, via: "Cdim" },
  { key: "dim7", label: "dim7", type: "dim", ext: { six: true }, via: "Cdim7 (7 on dim = bb7)" },
  { key: "aug", label: "aug", type: "major", ext: { sharp5: true }, via: "Caug" },
  { key: "7", label: "7", type: "major", ext: { min7: true }, via: "C7" },
  { key: "maj7", label: "maj7", type: "major", ext: { maj7: true }, via: "Cmaj7, CM7" },
  { key: "m7", label: "m7", type: "minor", ext: { min7: true }, via: "Cm7" },
  { key: "m7b5", label: "m7b5", type: "dim", ext: { min7: true }, via: "Cm7b5" },
  { key: "9", label: "9", type: "major", ext: { min7: true, nine: true }, via: "C9" },
  { key: "maj9", label: "maj9", type: "major", ext: { maj7: true, nine: true }, via: "Cmaj9" },
  { key: "m9", label: "m9", type: "minor", ext: { min7: true, nine: true }, via: "Cm9" },
  { key: "11", label: "11→9sus", type: "sus4", ext: { min7: true, nine: true }, via: "C11 (major 11 played as 9sus)", aliasOf: "9sus" },
  { key: "m11", label: "m11→m9", type: "minor", ext: { min7: true, nine: true }, via: "Cm11 (11th left out, played as m9)", aliasOf: "m9" },
  { key: "13", label: "13", type: "major", ext: { min7: true, thirteen: true }, via: "C13" },
  { key: "m13", label: "m13", type: "minor", ext: { min7: true, thirteen: true }, via: "Cm13" },
  { key: "9sus", label: "9sus", type: "sus4", ext: { min7: true, nine: true }, via: "C9sus4, C9sus" },
  { key: "7sus4", label: "7sus4", type: "sus4", ext: { min7: true }, via: "C7sus4" },
  { key: "7sus2", label: "7sus2", type: "major", ext: { sus2: true, min7: true }, via: "C7sus2" },
  { key: "maj7sus2", label: "maj7sus2", type: "major", ext: { sus2: true, maj7: true }, via: "Cmaj7sus2" },
  { key: "maj7sus4", label: "maj7sus4", type: "sus4", ext: { maj7: true }, via: "Cmaj7sus4" },
  { key: "7b9", label: "7b9", type: "major", ext: { min7: true, flat9: true }, via: "C7b9" },
  { key: "7#9", label: "7#9", type: "major", ext: { min7: true, sharp9: true }, via: "C7#9" },
  { key: "7b5", label: "7b5", type: "major", ext: { min7: true, flat5: true }, via: "C7b5" },
  { key: "aug7", label: "aug7", type: "major", ext: { min7: true, sharp5: true }, via: "Caug7, C7#5" },
  { key: "maj7#5", label: "maj7#5", type: "major", ext: { maj7: true, sharp5: true }, via: "Cmaj7#5" },
  { key: "majb5", label: "(b5)", type: "major", ext: { flat5: true }, via: "C(b5)" },
  { key: "mmaj7", label: "m(maj7)", type: "minor", ext: { maj7: true }, via: "CmM7, CmM" },
  { key: "mmaj9", label: "m(maj9)", type: "minor", ext: { maj7: true, nine: true }, via: "CmM9, Cmmaj9" },
  { key: "69", label: "6(add9)", type: "major", ext: { six: true, nine: true }, via: "C6add9 (6/9 not accepted as a token; 6+add9 is)" },
  { key: "m69", label: "m6(add9)", type: "minor", ext: { six: true, nine: true }, via: "Cm6add9" },
  { key: "m9b5", label: "m9b5", type: "dim", ext: { min7: true, nine: true }, via: "Cm9b5" },
  { key: "dimAdd9", label: "dim(add9)", type: "dim", ext: { nine: true }, via: "Cdimadd9" },
  { key: "dimMaj7", label: "dim(maj7)", type: "dim", ext: { maj7: true }, via: "Cdimmaj7" },
  { key: "6sus4", label: "6sus4", type: "sus4", ext: { six: true }, via: "C6sus4" },
  { key: "sus4add9", label: "sus4(add9)", type: "sus4", ext: { nine: true }, via: "Csus4add9" }
];

// Expert type × extension buttons (Major/Minor/Sus4/Dim × 6/min7/maj7/9).
export const EXPERT_BUTTON_QUALITIES = [
  "maj", "min", "sus4", "dim",
  "6", "m6", "6sus4", "dim7",
  "7", "m7", "7sus4", "m7b5",
  "maj7", "mmaj7", "maj7sus4", "dimMaj7",
  "add9", "madd9", "sus4add9", "dimAdd9",
  "9", "m9", "9sus", "m9b5",
  "maj9", "mmaj9",
  "69", "m69"
];

export function loadInventory() {
  const presets = fs.readFileSync(SRC + "/js/songs/presets.js", "utf8");
  const strip = fs.readFileSync(SRC + "/js/ui/strip.js", "utf8");
  const menu = parseProgMenu(presets);
  const kids = parseKidsSongs(presets);
  const grids = parseStripSets(strip);
  const keys = allKeys();

  let menuCount = 0;
  const menuByStyle = {};
  const menuQualities = new Set();
  const menuSymbols = new Map(); // symbol -> sources
  const menuDegQuals = new Set();

  for (const [style, modes] of Object.entries(menu)) {
    menuByStyle[style] = {};
    for (const [mode, charts] of Object.entries(modes)) {
      menuByStyle[style][mode] = charts.length;
      menuCount += charts.length;
      for (const ch of charts) {
        for (const step of ch.steps) {
          const st = parseStep(step);
          menuQualities.add(st.q);
          menuDegQuals.add((st.low ? "b" : "") + st.deg + " " + st.q);
          for (const key of keys.filter((k) => k.mode === mode)) {
            const r = realize(key, st.deg, st.q, st.low);
            const rec = menuSymbols.get(r.symbol) || { ...r, sources: new Set() };
            rec.sources.add("menu:" + style + "/" + mode + "/" + ch.name + "@" + key.name + " " + key.mode);
            menuSymbols.set(r.symbol, rec);
          }
        }
      }
    }
  }

  const gridQualities = new Set();
  const gridSymbols = new Map();
  const borrowedSymbols = new Map();
  let gridChipDefs = 0;
  for (const mode of ["major", "minor"]) {
    for (const [style, chips] of Object.entries(grids[mode])) {
      for (const chip of chips) {
        gridChipDefs++;
        gridQualities.add(chip.quality);
        for (const key of keys.filter((k) => k.mode === mode)) {
          const r = realize(key, chip.degree, chip.quality, chip.lowered);
          const rec = gridSymbols.get(r.symbol) || { ...r, sources: new Set(), borrowed: false, extra: false };
          rec.sources.add("grid:" + style + "/" + mode + "@" + key.name + " " + key.mode);
          rec.borrowed = rec.borrowed || chip.borrowed;
          rec.row = chip.row;
          gridSymbols.set(r.symbol, rec);
          if (chip.borrowed) {
            const b = borrowedSymbols.get(r.symbol) || { ...r, sources: new Set() };
            b.sources.add(style + "/" + mode);
            borrowedSymbols.set(r.symbol, b);
          }
        }
      }
    }
  }

  const kidsQualitiesWritten = new Set();
  const kidsSymbolsWritten = new Map();
  const kidsSymbolsShown = new Map(); // after kidsMajorStep
  for (const song of kids) {
    for (const step of song.steps) {
      const st = parseStep(step);
      kidsQualitiesWritten.add(st.q);
      for (const key of keys.filter((k) => k.mode === "major")) {
        const written = realize(key, st.deg, st.q, st.low);
        const rec = kidsSymbolsWritten.get(written.symbol) || { ...written, sources: new Set() };
        rec.sources.add("kids-written:" + song.name + "@" + key.name);
        kidsSymbolsWritten.set(written.symbol, rec);
        // Displayed in Kids: major triad on the melody note (kidsMajorStep).
        const t = step.split(/\s+/);
        let mel = null;
        for (const tok of t) if (tok.charAt(0) === "@") mel = parseInt(tok.slice(1), 10);
        const kdegs = scaleDegrees(key.pc, key.mode, key.spell);
        const d = kdegs[st.deg - 1];
        const mpc = mel != null ? wrap12(key.pc + mel) : wrap12(d.pc - (st.low ? 1 : 0));
        let deg2 = null;
        for (let i = 0; i < kdegs.length; i++) if (kdegs[i].pc === mpc) deg2 = i + 1;
        const shown = deg2 ? realize(key, deg2, "maj", false) : realize(key, st.deg, "maj", false);
        const rec2 = kidsSymbolsShown.get(shown.symbol) || { ...shown, sources: new Set() };
        rec2.sources.add("kids-shown:" + song.name + "@" + key.name);
        kidsSymbolsShown.set(shown.symbol, rec2);
      }
    }
  }

  // Union of concrete symbols the guitar tab should cover.
  const allSymbols = new Map();
  function addAll(map, tag) {
    for (const [sym, rec] of map) {
      const cur = allSymbols.get(sym) || { ...rec, sources: new Set() };
      for (const s of rec.sources) cur.sources.add(s);
      cur.from = (cur.from || new Set());
      cur.from.add(tag);
      allSymbols.set(sym, cur);
    }
  }
  addAll(menuSymbols, "menu");
  addAll(gridSymbols, "grid");
  addAll(kidsSymbolsWritten, "kids-written");
  addAll(kidsSymbolsShown, "kids-shown");

  const qualityKeys = new Set([
    ...menuQualities,
    ...gridQualities,
    ...kidsQualitiesWritten,
    ...UPLOAD_QUALITIES.map((q) => q.aliasOf || q.key)
  ]);

  return {
    source: { repo: "DigitalFarmer420/touch-chord", version: SRC_VERSION, commit: SRC_COMMIT, path: SRC },
    menuCount,
    menuByStyle,
    menuQualities: [...menuQualities].sort(),
    menuDegQuals: [...menuDegQuals].sort(),
    menuSymbolCount: menuSymbols.size,
    gridChipDefs,
    gridQualities: [...gridQualities].sort(),
    gridSymbolCount: gridSymbols.size,
    borrowedSymbolCount: borrowedSymbols.size,
    kidsSongs: kids.map((k) => k.name),
    kidsQualitiesWritten: [...kidsQualitiesWritten].sort(),
    kidsWrittenSymbolCount: kidsSymbolsWritten.size,
    kidsShownSymbolCount: kidsSymbolsShown.size,
    uploadQualityCount: UPLOAD_QUALITIES.length,
    uploadQualities: UPLOAD_QUALITIES,
    expertButtonQualities: EXPERT_BUTTON_QUALITIES,
    uniqueShownSymbols: allSymbols.size,
    qualityKeys: [...qualityKeys].sort(),
    menuSymbols,
    gridSymbols,
    kidsSymbolsWritten,
    kidsSymbolsShown,
    allSymbols,
    keys,
    menu,
    kids,
    grids
  };
}

export { realize, parseStep };

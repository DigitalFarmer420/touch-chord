// Shared helpers: read the live PROG_MENU from presets.js (text only, no app code runs) and convert steps.
import fs from "node:fs";
export const SITE = "/workspace/chord-touch/jam-2026.11.27.2/site";
export function liveMenu() {
  const src = fs.readFileSync(SITE + "/js/songs/presets.js", "utf8");
  const a = src.indexOf("var PROG_MENU = {"), b = src.indexOf("\n};", a);
  return Function("return " + src.slice(a + "var PROG_MENU = ".length, b + 2))();
}
// Qualities the app's progression parser accepts (STRIP_QUAL keys in js/ui/strip.js, incl. the 4 added at line ~678).
export function supportedQualities() {
  const s = fs.readFileSync(SITE + "/js/ui/strip.js", "utf8");
  const a = s.indexOf("export const STRIP_QUAL = {"), b = s.indexOf("\n};", a);
  const keys = [...s.slice(a, b).matchAll(/^\s*("?[\w#]+"?)\s*:\s*\{/gm)].map(m => m[1].replace(/"/g, ""));
  for (const m of s.matchAll(/STRIP_QUAL(?:\["([^"]+)"\]|\.(\w+))\s*=/g)) keys.push(m[1] || m[2]);
  return new Set(keys);
}
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
const RN = ["I", "bII", "II", "bIII", "III", "IV", "bV", "V", "bVI", "VI", "bVII", "VII"];
const LOWER = new Set(["min", "m7", "m7b5", "madd9", "m9", "dim", "moverV", "mover3"]);
const SUF = { maj: "", min: "", "7": "7", maj7: "maj7", m7: "7", m7b5: "\u00f87", sus4: "sus4", sus2: "sus2", add9: "add9",
  madd9: "add9", "9": "9", maj9: "maj9", m9: "9", "9sus": "9sus", "13": "13", "7b9": "7b9", "7#9": "7#9", "7sus4": "7sus4",
  "6": "6", dim: "\u00b0", overV: "/V", moverV: "/V", over3: "/3", mover3: "/3" };
export function parse(step, mode) {
  const t = step.trim().split(/\s+/);
  const low = t[0][0] === "b", deg = parseInt(low ? t[0].slice(1) : t[0], 10), q = t[1];
  let bars = 1; t.slice(2).forEach(x => { if (x[0] === "x") bars = parseFloat(x.slice(1)); });
  const semi = (((mode === "minor" ? MIN : MAJ)[deg - 1] - (low ? 1 : 0)) + 12) % 12;
  const fam = /^(min|m7|madd9|m9|mover)/.test(q) ? "m" : (q === "dim" || q === "m7b5") ? "d" : "M";
  return { deg, low, q, bars, semi, fam };
}
export function roman(step, mode) {
  const p = parse(step, mode);
  let r = RN[p.semi]; if (LOWER.has(p.q)) r = r.replace(/[IV]+/, x => x.toLowerCase());
  return r + SUF[p.q] + (p.bars !== 1 ? " x" + p.bars : "");
}
export function inC(step, mode) {   // example chord name with tonic C (major) or A (minor)
  const p = parse(step, mode), tonic = mode === "minor" ? 9 : 0;
  const N = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const pc = (tonic + p.semi) % 12, name = N[pc];
  const lab = { maj: "", min: "m", "7": "7", maj7: "maj7", m7: "m7", m7b5: "m7b5", sus4: "sus4", sus2: "sus2", add9: "add9",
    madd9: "madd9", "9": "9", maj9: "maj9", m9: "m9", "9sus": "9sus4", "13": "13", "7b9": "7b9", "7#9": "7#9", "7sus4": "7sus4",
    "6": "6", dim: "dim" }[p.q];
  if (lab !== undefined) return name + lab;
  const bassOff = { overV: 2, moverV: 2, over3: 4, mover3: 3 }[p.q];
  return name + (p.q.startsWith("m") ? "m" : "") + "/" + N[(pc + bassOff) % 12];
}

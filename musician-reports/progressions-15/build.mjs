import fs from "node:fs";
import { liveMenu, roman, inC } from "./lib.mjs";
import { NEW, LOFI_NOTE } from "./new-progressions.mjs";
const menu = liveMenu();
const STYLES = ["pop", "jazz", "rnb", "ballad", "reggae", "funk", "yogaDeep", "country", "lofi"];
const LABEL = { pop: "Pop", jazz: "Jazz", rnb: "R&B", ballad: "Ballad", reggae: "Reggae", funk: "Funk", yogaDeep: "Yoga", country: "Country", lofi: "Lofi" };
function chart(mode, s) { const a = s.split("|"); return { mode, steps: a.map(x => roman(x, mode)), appSteps: a, exampleInCAm: a.map(x => inC(x, mode)) }; }
// Existing families ranked by best position across the live major/minor menus (ties: major first).
function existing(style) {
  const m = menu[style] || {}, fam = new Map();
  ["major", "minor"].forEach((mode, mi) => (m[mode] || []).forEach(([name, s], i) => {
    if (!fam.has(name)) fam.set(name, { name, key: i + mi * 0.5, charts: {} });
    const f = fam.get(name); f.key = Math.min(f.key, i + mi * 0.5); f.charts[mode] = s;
  }));
  return [...fam.values()].sort((a, b) => a.key - b.key);
}
function entry(name, status, charts, use) {
  const modes = Object.keys(charts), prim = modes.includes("major") ? "major" : modes[0];
  const e = { name, status, mode: prim, ...(({ mode, ...r }) => r)(chart(prim, charts[prim])) };
  const other = modes.find(x => x !== prim);
  if (other) e.otherMode = chart(other, charts[other]);
  if (use) e.usage = use;
  return e;
}
const out = { schema: "touch-chord progressions-15 v1", generated: "2026-11-27",
  source: { deployClone: "/workspace/chord-touch/jam-2026.11.27.2/site", version: "2026.11.27.9", commit: "0eb1f4d54fc129093fd9134b5fa7a1483587e363", file: "js/songs/presets.js PROG_MENU" },
  notation: {
    steps: "Roman numerals relative to the tonic of the entry's mode; b = flat relative to the MAJOR scale (minor bVI = degree 6 of natural minor). Lower case = minor-family chord (min, m7, m9, madd9, m7b5 'ø7', dim '°'). 'x2' / 'x0.5' = bars (default 1). 'V/3' = 3rd in the bass (app over3), 'IV/V' = bass a whole step above the root (app overV).",
    appSteps: "Exactly the app's PROG_MENU step strings for that mode (degree quality [xBars]); import these to avoid re-parsing.",
    mode: "Primary mode of the entry (major when the family has a major chart). Existing families that also have the other mode carry it in otherMode; new entries are single-mode (the app leaves a family out of a mode it has no chart for).",
    rank: "1 = most popular. Existing order kept from the live menu; new entries inserted by judgment (famous song-cited loops higher)."
  }, styles: {} };
for (const st of STYLES) {
  let list = existing(st).map(f => entry(f.name, "existing", f.charts));
  for (const n of (NEW[st] || [])) {
    const e = entry(n.name, "new", { [n.mode]: n.steps }, n.use);
    const i = n.after ? list.findIndex(x => x.name === n.after) : -1;
    if (n.after && i < 0) throw new Error("after not found: " + n.after);
    if (i >= 0) list.splice(i + 1, 0, e); else list.push(e);
  }
  list = list.map((e, i) => ({ rank: i + 1, ...e }));
  out.styles[st] = { label: LABEL[st], ...(st === "lofi" ? { newStyle: true, styleNote: LOFI_NOTE } : {}),
    counts: { existing: list.filter(e => e.status === "existing").length, new: list.filter(e => e.status === "new").length, total: list.length },
    progressions: list };
}
fs.writeFileSync("proposal.json", JSON.stringify(out, null, 2) + "\n");
console.log(STYLES.map(s => s + " " + JSON.stringify(out.styles[s].counts)).join("\n"));

// Builds proposal.json and lofi-presets-block.js from the live PROG_MENU.lofi + new-lofi.mjs.
import fs from "node:fs";
import { liveMenu, roman, inC, SITE } from "./lib.mjs";
import { NEW } from "./new-lofi.mjs";
import { execSync } from "node:child_process";
const live = liveMenu().lofi;
const commit = execSync(`git -C ${SITE} log -1 --format="%H %s"`).toString().trim();
const ch = (mode, s) => { const a = s.split("|"); return { mode, steps: a.map(x => roman(x, mode)), appSteps: a, exampleInCAm: a.map(x => inC(x, mode)) }; };
const out = { schema: "touch-chord lofi-15 v1", generated: "2026-11-27",
  source: { deployClone: SITE, deployCommit: commit, version: "2026.11.27.20-6e8a151", file: "js/songs/presets.js PROG_MENU.lofi" },
  notation: { steps: "Roman numerals relative to the mode's tonic (minor: bIII/bVI/bVII are natural-minor degrees 3/6/7).", appSteps: "Exact PROG_MENU step strings (degree quality); minor degrees already count from the natural minor scale.", exampleInCAm: "Chord names with tonic C (major) or A (minor)." },
  counts: {}, existing: {}, new: [] };
for (const mode of ["major", "minor"]) {
  out.existing[mode] = live[mode].map(([name, s], i) => ({ position: i + 1, name, ...ch(mode, s) }));
  NEW[mode].forEach((n, i) => out.new.push({ rank: i + 1, name: n.name, status: "new", ...ch(mode, n.steps), usage: n.use }));
  out.counts[mode] = { existing: live[mode].length, new: NEW[mode].length, total: live[mode].length + NEW[mode].length };
}
fs.writeFileSync("proposal.json", JSON.stringify(out, null, 2) + "\n");
const row = (n, s) => `      [${JSON.stringify(n)}, ${JSON.stringify(s)}],`;
const B = ["  lofi: {"];
for (const mode of ["major", "minor"]) {
  B.push(`    ${mode}: [`);
  live[mode].forEach(([n, s]) => B.push(row(n, s)));
  NEW[mode].forEach(n => B.push(row(n.name, n.steps)));
  B.push("    ],");
}
B.push("  },");
fs.writeFileSync("lofi-presets-block.js", "// Drop-in replacement for the `lofi: { ... },` entry of PROG_MENU in js/songs/presets.js (existing rows first, unchanged; new rows appended in rank order).\n" + B.join("\n") + "\n");
console.log(JSON.stringify(out.counts));

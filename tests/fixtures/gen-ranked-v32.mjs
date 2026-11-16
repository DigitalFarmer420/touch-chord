#!/usr/bin/env node
// Rebuild tests/fixtures/ranked-v3.2.json from Noff's final-menus-export-v3.2.json.
// The source file is not in this repo. Pass its path. The script checks the SHA256
// before writing, and records that hash in the fixture.
//
//   node tests/fixtures/gen-ranked-v32.mjs /path/to/final-menus-export-v3.2.json
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED = "51fd558585544d6021d48c41742cc87cd8798b4e526aa84db63ca8ed9cbee3b8";
const ADULT = ["pop", "jazz", "rnb", "ballad", "reggae", "funk", "yogaDeep", "country"];
const OUT = join(dirname(fileURLToPath(import.meta.url)), "ranked-v3.2.json");

const srcPath = process.argv[2];
if (!srcPath) {
  console.error("usage: node tests/fixtures/gen-ranked-v32.mjs <final-menus-export-v3.2.json>");
  process.exit(2);
}
const raw = readFileSync(srcPath);
const sha = createHash("sha256").update(raw).digest("hex");
if (sha !== EXPECTED) {
  console.error("sha256 " + sha + " != " + EXPECTED);
  process.exit(1);
}
const exp = JSON.parse(raw.toString("utf8"));
if (exp.version !== "3.2") {
  console.error("version " + exp.version);
  process.exit(1);
}
const menus = {};
let entries = 0;
for (const style of ADULT) {
  menus[style] = {};
  for (const mode of ["major", "minor"]) {
    const rows = (exp.progressions[style][mode] || []).slice().sort((a, b) => a.menuOrder - b.menuOrder);
    rows.forEach((row, i) => {
      if (row.menuOrder !== i + 1) throw new Error(style + " " + mode + " menuOrder " + row.menuOrder + " at " + i);
      if (row.popularityRank !== row.menuOrder) throw new Error(style + " " + mode + " " + row.name + " popularityRank");
      if (!row.name || !row.steps || !row.origin) throw new Error(style + " " + mode + " incomplete row");
    });
    const names = rows.map((row) => row.name);
    if (new Set(names).size !== names.length) throw new Error(style + " " + mode + " duplicate name");
    menus[style][mode] = rows.map((row) => ({ name: row.name, steps: row.steps, origin: row.origin }));
    entries += rows.length;
  }
}
if (entries !== 152) throw new Error("entries " + entries + " != 152");
const fixture = {
  source: "final-menus-export-v3.2.json",
  sourceSha256: sha,
  version: "3.2",
  entries,
  menus
};
// Escape non-ASCII so the fixture stays plain ASCII (en dash in ii–V–I).
const text = JSON.stringify(fixture, null, 1).replace(/[\u007f-\uffff]/g, (ch) => {
  return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
}) + "\n";
writeFileSync(OUT, text);
console.log("wrote " + OUT + " entries=" + entries + " sha256=" + sha);

// Validates proposal.json against the live PROG_MENU (read as text from the deploy clone) and the owner's rules.
import fs from "node:fs";
import { liveMenu, supportedQualities, parse } from "./lib.mjs";
const P = JSON.parse(fs.readFileSync(new URL("./proposal.json", import.meta.url)));
const menu = liveMenu(), QUAL = supportedQualities();
let fails = 0, warns = 0; const log = [];
const fail = m => { fails++; log.push("FAIL " + m); }, warn = m => { warns++; log.push("WARN " + m); };
// Key-agnostic cyclic signatures. exact: semitone+quality; simple: semitone+family (M/m/d; sus/7/9/slash count as M).
function sig(steps, mode, kind) {
  let t = steps.map(s => { const p = parse(s, mode); return p.semi + (kind === "exact" ? p.q.replace(/^over.*|^mover.*/, x => x) : p.fam); });
  t = t.filter((x, i) => x !== t[(i - 1 + t.length) % t.length] || t.length === 1);   // collapse repeats incl. wrap
  return t;
}
const rots = t => t.map((_, i) => t.slice(i).concat(t.slice(0, i)).join(","));
const charts = [];   // every chart: {style,name,status,mode,steps}
for (const [st, m] of Object.entries(menu)) for (const mode of ["major", "minor"]) for (const [name, s] of (m[mode] || [])) charts.push({ style: st, name, status: "existing", mode, steps: s.split("|") });
const newCharts = [];
for (const [st, S] of Object.entries(P.styles)) for (const e of S.progressions) if (e.status === "new") newCharts.push({ style: st, name: e.name, status: "new", mode: e.mode, steps: e.appSteps, e });
// 1. counts + ranks + existing entries unchanged
for (const [st, S] of Object.entries(P.styles)) {
  const names = S.progressions.map(e => e.name);
  if (S.progressions.length !== 15) fail(`${st}: ${S.progressions.length} entries, want 15`);
  if (new Set(names).size !== names.length) fail(`${st}: repeated name`);
  S.progressions.forEach((e, i) => { if (e.rank !== i + 1) fail(`${st} ${e.name}: rank ${e.rank} at position ${i + 1}`); });
  const live = menu[st] || {};
  for (const e of S.progressions.filter(e => e.status === "existing")) for (const c of [e, e.otherMode].filter(Boolean)) {
    const row = (live[c.mode] || []).find(r => r[0] === e.name);
    if (!row || row[1] !== c.appSteps.join("|")) fail(`${st} ${e.name} ${c.mode}: existing chart differs from live PROG_MENU`);
  }
  const liveNames = new Set(["major", "minor"].flatMap(md => (live[md] || []).map(r => r[0])));
  for (const n of liveNames) if (!names.includes(n)) fail(`${st}: live family ${n} missing`);
}
// 2. per new chart rules
const feel = n => n.replace(/^(Pop|Jazz|R&B|Ballad|Reggae|Funk|Yoga|Country|Lofi)\s+/, "");
const allExistingNames = new Set(charts.map(c => c.name)), allExistingFeels = new Set(charts.map(c => feel(c.name)));
const seenFeel = new Map();
for (const c of newCharts) {
  const id = `${c.style}/${c.name}`;
  if (c.steps.length < 4 || c.steps.length > 8) fail(`${id}: ${c.steps.length} steps (want 4-8)`);
  if (!["major", "minor"].includes(c.mode)) fail(`${id}: bad mode`);
  if (c.e.otherMode) fail(`${id}: new entry has two modes`);
  if (!c.e.usage) fail(`${id}: no usage note`);
  if (c.e.steps.length !== c.steps.length) fail(`${id}: steps/appSteps length mismatch`);
  const P2 = c.steps.map(s => parse(s, c.mode));
  P2.forEach((p, i) => {
    if (!QUAL.has(p.q)) fail(`${id}: unsupported quality ${p.q}`);
    if (!(p.deg >= 1 && p.deg <= 7)) fail(`${id}: bad degree in ${c.steps[i]}`);
    const n = P2[(i + 1) % P2.length], wrap = i === P2.length - 1 ? " (loop wrap)" : "";
    if (n.semi === p.semi && n.q === p.q) fail(`${id}: same chord twice in a row at step ${i + 1}${wrap}`);
    else if (n.semi === p.semi && n.fam === p.fam) warn(`${id}: same root+family back to back at step ${i + 1}${wrap}`);
  });
  const ex = new Map(); P2.forEach(p => { const k = p.semi + p.q; ex.set(k, (ex.get(k) || 0) + 1); });
  for (const [k, v] of ex) if (v > 1) fail(`${id}: chord ${k} used ${v} times`);
  const roots = new Map(); P2.forEach(p => roots.set(p.semi, (roots.get(p.semi) || 0) + 1));
  for (const [k, v] of roots) if (v > 1) warn(`${id}: root +${k} semitones appears ${v} times (different chord quality/bass)`);
  if (allExistingNames.has(c.name)) fail(`${id}: name already used`);
  if (allExistingFeels.has(feel(c.name))) fail(`${id}: phone label "${feel(c.name)}" already used by an existing family`);
  if (seenFeel.has(feel(c.name))) fail(`${id}: phone label "${feel(c.name)}" also used by new ${seenFeel.get(feel(c.name))}`);
  seenFeel.set(feel(c.name), id);
}
// 3. duplicates, key-agnostic and rotation-aware, vs every live chart (all styles, both modes) and each other
const all = charts.concat(newCharts);
const index = all.map(c => ({ c, exact: new Set(rots(sig(c.steps, c.mode, "exact"))), simple: new Set(rots(sig(c.steps, c.mode, "simple"))), s0: sig(c.steps, c.mode, "simple").join(",") }));
for (const a of index.filter(x => x.c.status === "new")) for (const b of index) {
  if (a === b || (b.c.status === "new" && index.indexOf(b) < index.indexOf(a))) continue;
  const tag = `${a.c.style}/${a.c.name} vs ${b.c.status} ${b.c.style}/${b.c.name} (${b.c.mode})`;
  const e0 = [...a.exact][0];
  if ([...b.exact].includes(sig(a.c.steps, a.c.mode, "exact").join(","))) fail(`exact duplicate (rotation-aware): ${tag}`);
  else if (b.simple.has(a.s0)) fail(`near-duplicate (same roots + major/minor families, rotation-aware): ${tag}`);
  else { const A = a.s0.split(","), B = b.s0.split(","); if (A.length !== B.length && Math.min(A.length, B.length) >= 4 && (B.length > A.length ? rots(B).some(r => r.startsWith(A.join(","))) : rots(A).some(r => r.startsWith(B.join(","))))) warn(`subsequence overlap (one loop is a contiguous part of the other): ${tag}`); }
}
log.push(`\nRESULT: ${fails} fail, ${warns} warn; new charts checked: ${newCharts.length}; live charts compared: ${charts.length}; supported qualities: ${[...QUAL].join(" ")}`);
console.log(log.join("\n")); process.exit(fails ? 1 : 0);

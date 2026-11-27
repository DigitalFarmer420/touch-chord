// Validates the Lofi additions: rules, duplicates vs every live PROG_MENU chart, the app's own parser (progSteps)
// in C/Am and Eb/Cm and all 12 keys, guitar shapes (app resolveVoicings) with root lowest, and the patched menu count.
import fs from "node:fs";
import { execSync } from "node:child_process";
import { liveMenu, supportedQualities, parse, SITE } from "./lib.mjs";
import { NEW } from "./new-lofi.mjs";
const V = "?v=" + (fs.readFileSync(SITE + "/js/songs/presets.js", "utf8").match(/\?v=([\w.\-]+)/)[1]);
let fails = 0, warns = 0; const log = [];
const fail = m => { fails++; log.push("FAIL " + m); }, warn = m => { warns++; log.push("WARN " + m); }, info = m => log.push(m);
const menu = liveMenu(), QUAL = supportedQualities(), src = fs.readFileSync(SITE + "/js/songs/presets.js", "utf8");
const allNames = new Set([...src.matchAll(/\[\s*"([^"]+)",\s*"[^"]*"\s*\]|P\("([^"]+)"/g)].map(m => m[1] || m[2]));
const feel = n => n.replace(/^(Pop|Kids|Jazz|R&B|Ballad|Reggae|Funk|Yoga|Country|Lofi)\s+/, "");
const allFeels = new Set([...allNames].map(feel));
const charts = [];
for (const [st, m] of Object.entries(menu)) for (const mode of ["major", "minor"]) for (const [name, s] of (m[mode] || [])) charts.push({ style: st, name, status: "existing", mode, steps: s.split("|") });
const newCharts = []; for (const mode of ["major", "minor"]) NEW[mode].forEach(n => newCharts.push({ style: "lofi", name: n.name, status: "new", mode, steps: n.steps.split("|") }));
info(`live lofi: major ${menu.lofi.major.length}, minor ${menu.lofi.minor.length}; new: major ${NEW.major.length}, minor ${NEW.minor.length}`);
if (menu.lofi.major.length + NEW.major.length !== 15) fail("lofi major total != 15");
if (menu.lofi.minor.length + NEW.minor.length !== 15) fail("lofi minor total != 15");
// 1. rules
const seen = new Set();
for (const c of newCharts) {
  const id = `${c.mode}/${c.name}`;
  if (!/^Lofi [A-Z][a-z]+ [A-Z][a-z]+$/.test(c.name)) fail(`${id}: name not 'Lofi <Two Words>'`);
  if (c.steps.length < 3 || c.steps.length > 8) fail(`${id}: ${c.steps.length} steps (want 3-8)`);
  const P2 = c.steps.map(s => parse(s, c.mode));
  P2.forEach((p, i) => {
    if (!QUAL.has(p.q)) fail(`${id}: unsupported quality ${p.q}`);
    if (!(p.deg >= 1 && p.deg <= 7)) fail(`${id}: bad degree in ${c.steps[i]}`);
    if (!/^b?[1-7] [\w#]+$/.test(c.steps[i])) fail(`${id}: bad token "${c.steps[i]}"`);
    const n = P2[(i + 1) % P2.length], wrap = i === P2.length - 1 ? " (loop wrap)" : "";
    if (n.semi === p.semi && n.q === p.q) fail(`${id}: same chord twice in a row at step ${i + 1}${wrap}`);
    else if (n.semi === p.semi && n.fam === p.fam) warn(`${id}: same root+family back to back at step ${i + 1}${wrap}`);
  });
  const ex = new Map(); P2.forEach(p => ex.set(p.semi + p.q, (ex.get(p.semi + p.q) || 0) + 1));
  for (const [k, v] of ex) if (v > 1) fail(`${id}: chord ${k} used ${v} times`);
  const roots = new Map(); P2.forEach(p => roots.set(p.semi, (roots.get(p.semi) || 0) + 1));
  for (const [k, v] of roots) if (v > 1) warn(`${id}: root +${k} appears ${v} times`);
  if (allNames.has(c.name)) fail(`${id}: name already used in presets.js`);
  if (allFeels.has(feel(c.name))) fail(`${id}: phone label "${feel(c.name)}" already used in presets.js`);
  if (seen.has(feel(c.name))) fail(`${id}: phone label repeated among new`); seen.add(feel(c.name));
}
// 2. duplicates (key-agnostic, rotation-aware) vs all live PROG_MENU charts and each other
function sig(steps, mode, kind) { let t = steps.map(s => { const p = parse(s, mode); return p.semi + (kind === "exact" ? p.q : p.fam); });
  return t.filter((x, i) => x !== t[(i - 1 + t.length) % t.length] || t.length === 1); }
const rots = t => t.map((_, i) => t.slice(i).concat(t.slice(0, i)).join(","));
const all = charts.concat(newCharts);
for (const a of newCharts) for (const b of all) {
  if (a === b || (b.status === "new" && newCharts.indexOf(b) < newCharts.indexOf(a))) continue;
  const tag = `${a.name} vs ${b.status} ${b.style}/${b.name} (${b.mode})`;
  const aE = sig(a.steps, a.mode, "exact").join(","), aS = sig(a.steps, a.mode, "simple"), bS = sig(b.steps, b.mode, "simple");
  if (rots(sig(b.steps, b.mode, "exact")).includes(aE)) fail("exact duplicate: " + tag);
  else if (rots(bS).includes(aS.join(","))) (b.style === "lofi" ? fail : warn)("near-duplicate (same roots + major/minor families" + (b.style === "lofi" ? "" : "; other style, different chord colours") + "): " + tag);
  else if (aS.length !== bS.length && Math.min(aS.length, bS.length) >= 4) { const [L, S] = aS.length > bS.length ? [aS, bS] : [bS, aS]; if (rots(L).some(r => r.startsWith(S.join(",")))) warn("subsequence overlap: " + tag); }
}
// 3. the app's own parser + guitar resolver (deploy clone modules, dom stub)
await import(SITE + "/tests/unit/dom-stub.js");
const { progSteps } = await import(SITE + "/js/songs/presets.js" + V);
const { Theory } = await import(SITE + "/js/theory/index.js" + V);
const { resolveVoicings } = await import(SITE + "/js/instruments/resolve.js" + V);
const { guitar: G } = await import(SITE + "/js/instruments/profiles.js" + V);
const tun = G.tuning.map(t => typeof t === "number" ? t : t.midi);
info(`guitar tuning midi ${JSON.stringify(tun)}`);
// expected intervals per quality (independent table)
const IV = { maj: [0,4,7], min: [0,3,7], "7": [0,4,7,10], maj7: [0,4,7,11], m7: [0,3,7,10], m7b5: [0,3,6,10], "9": [0,4,7,10,2], maj9: [0,4,7,11,2], m9: [0,3,7,10,2], "13": [0,4,10,2,9] /* app 13 = 1 3 b7 9 13, no 5th */, "7b9": [0,4,7,10,1], "7#9": [0,4,7,10,3] };
const MAJ = [0,2,4,5,7,9,11], MIN = [0,2,3,5,7,8,10], NN = ["C","Db","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
const pcsOf = (it) => Theory.chordIntervals(it.type, it.extensions).map(i => (it.rootPc + i) % 12).sort((a, b) => a - b).join(",");
let spelled = 0, gtrOk = 0, gtrCases = 0; const spellLines = [];
for (const c of newCharts) {
  const exp = c.steps.map(s => parse(s, c.mode));
  for (let tonic = 0; tonic < 12; tonic++) {
    const st = progSteps({ pc: tonic, mode: c.mode }, { name: c.name, steps: c.steps });
    st.forEach((s, i) => {
      const it = s.item, e = exp[i], wantRoot = (tonic + e.semi) % 12;
      if (it.rootPc !== wantRoot) fail(`${c.name} key ${NN[tonic]} ${c.mode} step ${i + 1}: root pc ${it.rootPc} want ${wantRoot}`);
      const want = (IV[e.q] || []).map(x => (wantRoot + x) % 12).sort((a, b) => a - b).join(",");
      if (pcsOf(it) !== want) fail(`${c.name} key ${NN[tonic]} step ${i + 1} ${c.steps[i]}: tones ${pcsOf(it)} want ${want}`);
      spelled++;
      const vs = resolveVoicings("guitar", { rootPc: it.rootPc, type: it.type, extensions: it.extensions }); gtrCases++;
      if (!vs || !vs.length) { fail(`${c.name} ${NN[tonic]}: no guitar shape for ${it.rootName}${it.qualityLabel}`); return; }
      const v = vs[0]; let low = null; v.frets.forEach((f, k) => { if (f != null && f >= 0 && low == null) low = tun[k] + f; });
      if (low == null || low % 12 !== it.rootPc) fail(`${c.name} ${NN[tonic]}: guitar first shape ${it.rootName}${it.qualityLabel} lowest note pc ${low % 12} not root (${JSON.stringify(v.frets)})`);
      else gtrOk++;
    });
  }
  for (const tonic of c.mode === "major" ? [0, 3] : [9, 0]) {
    const st = progSteps({ pc: tonic, mode: c.mode }, { name: c.name, steps: c.steps });
    spellLines.push(`${c.name.padEnd(20)} ${(NN[tonic] + (c.mode === "minor" ? "m" : "")).padEnd(4)} ` + st.map(s => `${s.roman}=${Theory.chordSymbol(s.item.rootName, s.item.type, s.item.extensions)}[${Theory.chordToneNames(s.item.rootSpell, s.item.type, s.item.extensions).join(" ")}]`).join("  "));
  }
}
info(`app parser: ${spelled} step spellings checked (15 charts x 12 keys), tones match expected interval table unless FAIL above`);
info(`guitar: ${gtrOk}/${gtrCases} first shapes resolve with the root as lowest sounding note`);
// 4. patched-menu check: temp copy of the site with the block pasted, progList counts
const T = "/tmp/lofi15-site"; execSync(`rm -rf ${T} && cp -r ${SITE} ${T}`);
const ps = fs.readFileSync(T + "/js/songs/presets.js", "utf8"), a = ps.indexOf("  lofi: {"), b = ps.indexOf("\n  },\n", a) + "\n  },\n".length;
const block = fs.readFileSync(new URL("./lofi-presets-block.js", import.meta.url), "utf8").split("\n").slice(1).join("\n");
fs.writeFileSync(T + "/js/songs/presets.js", ps.slice(0, a) + block + ps.slice(b));
const diff = execSync(`cd ${T} && git diff --stat`).toString().trim(); info("patched copy: " + diff);
const P2 = await import(T + "/js/songs/presets.js" + V); const { state } = await import(T + "/js/state.js" + V);
try { P2.boot && P2.boot(); } catch (e) { info("boot(): " + e.message); }
state.style = "lofi";
for (const mode of ["major", "minor"]) { const l = P2.progList("lofi", mode); info(`patched progList("lofi","${mode}"): ${l.length} rows: ${l.map(x => x.name).join(", ")}`); if (l.filter(x => !x.up).length !== 15) fail(`patched ${mode} menu has ${l.length}`); }
log.push("", "Spellings (app progSteps -> Theory.chordSymbol [chordToneNames]), C / Eb major, A / C minor:", ...spellLines);
log.push(`\nRESULT: ${fails} fail, ${warns} warn; new charts ${newCharts.length}; live charts compared ${charts.length}; names checked vs ${allNames.size} in presets.js`);
console.log(log.join("\n")); process.exit(fails ? 1 : 0);

// Upload: AI prompt text, schema, answer parsing and validation, load flow.
import { keyDegrees, SPELL_LI } from "../keys.js?v=112.12";
import { upSave, LIB_MAX, libKey, libFind, libId, libWrite, paintLib } from "./library.js?v=112.12";
import { progStop, progSet } from "./playback.js?v=112.12";
import { upSelected, upKeyApply, upSelect, upStoreCopy, upLoadOne } from "./song.js?v=112.12";
import { state, shared } from "../state.js?v=112.12";
import { Theory } from "../theory/index.js?v=112.12";
import { wrap12 } from "../theory/quality.js?v=112.12";
import { repairJson, tidyChord, is13, from13 } from "./normalize.js?v=112.12";
import { computeSpec } from "../ui/pads.js?v=112.12";
import { paintSuggestions } from "../ui/strip.js?v=112.12";

// ===== Song Upload (full mode only) =====
// Contract: contract/song-contract.schema.json (embedded below as #songSchemaJson, copied to the
// clipboard verbatim). A validated song becomes the "Uploaded" progression at the END of the
// picker list (never in Simple or Kids), so the factory progressions keep their indexes.
// TEMPO: while the uploaded song is the selected progression, its timing.bpm drives Next (ring
// length) and the Play autoplay (bar length); a style change swaps the sound (and the style's
// phrase-loop BPM) but never this song tempo. songTempo() is the single source.
// BAND HOOK: when Band (bass + drums) is built it must take its tempo from songTempo() when it
// returns a song (else the style / loop BPM), exactly like progLoopBar() / progRingSec() below.
export const UP_STORE = "touchChord.upload.v1";
const UP_FLAG = 0.6;   // confidence below this is flagged for review
// v112.12: the Contract v1.3 prompt (Noff's prompt-v1.3.txt), sent as: UP_PROMPT + "\n\n" + the ask line
// ("What I want: ...", upload-dialog.js upAskLine / upSkipLine) + "\n\nThe contract (JSON Schema):\n" + the v1.3
// list schema (#songSchema13Json). v1.0-1.2 answers still load; v1.3 answers are turned into the v1.2 shape
// (normalize.js from13) before the checks, so upCheckObj, upBuild and storage are unchanged.
export const UP_PROMPT = "Fill in the song form in the JSON contract below (Touch Chord Song List Contract v1.3) once for each song I ask for.\n\nOUTPUT: STRICT JSON ONLY\n- Reply with one JSON object and nothing else: {\"contractVersion\": \"1.3\", \"songs\": [ ... ], \"notes\": \"...\"}. No code fences, no headings, no prose, no citations or render tags before, inside or after it. Exactly one JSON block.\n- Strict JSON: straight double quotes only (never single or curly quotes), no trailing commas, no comments, no non-breaking spaces, no NaN.\n- contractVersion is the string \"1.3\" (with quotes, not the number 1.3). Leave contractVersion out of each song.\n- Use only the fields in the contract; add no others (no genre, no extra timing fields). Leave optional fields out rather than set them to null; null is allowed only where the contract says so (chord, bass, bpm, firstDownbeatSeconds, durationSeconds, startSeconds, endSeconds, year, capo).\n- Every required number is a real number (confidence 0 to 1, never 85 or \"0.8\").\n- Closed lists: key.mode is \"major\" or \"minor\"; key.tonic is one of C C# Db D D# Eb E F F# Gb G G# Ab A A# Bb B (ASCII); section type is one of intro, verse, prechorus, chorus, bridge, solo, instrumental, interlude, outro, other (write \"prechorus\", not \"pre-chorus\"; use \"other\" with a label for a hook, refrain, post-chorus, rap, breakdown or tag); timeSignature is a string like \"4/4\".\n\nPITCH AND CHORD SPELLING\n- Concert pitch always. If a chart uses a capo, transpose its chords to what sounds and set capo to 0.\n- Spell chords in ASCII in this grammar only: root A-G, then # or b (never ♯ or ♭); then optionally one of m, min, maj, M, dim, aug, sus2, sus4; then optionally one number from 2, 4, 5, 6, 7, 9, 11, 13 (or add plus a number: add9); then optionally b5, #5, b9, #9, #11, b13, add9, sus4.\n- So: half-diminished = m7b5 (Fm7b5, not Fø7 or Fm7(b5)); diminished seventh = dim7 (Cdim7, not C°7); augmented = aug (Caug, not C+; the app plays it as major); sus means sus4 or sus2 (Dsus4, never a bare Dsus); 7sus4 or 9sus4 are fine but 7sus2 is not; no parentheses, no 6/9 (write 6 or add9), no m(maj7)/mM7 (write m7 and say so in notes), no -7 or Δ, no alt.\n- Slash chords: chord plus \"bass\" (\"chord\": \"Ab\", \"bass\": \"C\" for Ab/C).\n- Prefer unknown over guessing: a chord you cannot tell, and N.C. (no chord), is \"chord\": \"unknown\" with \"confidence\": 0. Give every chord an honest 0-1 confidence and, in \"source\", the id of the song.sources entry it came from. roman is optional.\n- If you cannot find a song's chords, leave the song out and name it in the top-level notes. If none can be found, return \"songs\": [] with the reason in notes.\n\nTIMING: MEASURE, DO NOT INVENT\n- Measure tempo and times against the official recording. bpm is the beat you count in bars[]: one bar = beatsPerBar x 60 / bpm seconds. tempoFeel is \"as-counted\" if bpm equals the tempo that tempo sites list, \"half-time\" if you count at half of it, \"double-time\" if at twice it; explain in tempoNote (e.g. \"SongBPM lists 142; counted in half-time at 71\") and give bpmConfidence 0-1.\n- firstDownbeatSeconds is the time of bar 1 beat 1 of the form in the recording. Each section gets startSeconds and endSeconds read off the recording, with timingSource \"measured-from-recording\" (or \"from-source\" if a cited page states it, or \"estimated\").\n- If you have not measured a time, do not make one up: set it to null, set that timingSource to \"unknown\", and list it in timing.unknown (\"firstDownbeatSeconds\", \"durationSeconds\", \"bpm\" or \"sectionTimes\").\n\nFORM AND BARS\n- \"form\" lists section ids in exact play order from the first bar to the last, every repeat written out (intro, verse1, chorus1, verse2, chorus2, bridge, chorus3, outro). The app plays exactly this list and nothing else, so cover the whole song. Section ids are unique; give each appearance its own id (chorus1, chorus2) unless it is played identically, in which case repeat the id in form.\n- Each section is bars[]: {\"bar\": 1, \"chords\": [{\"beat\": 1, \"chord\": \"Eb\", \"confidence\": 0.8, \"source\": \"chart1\"}, {\"beat\": 3, ...}]}. Number bars 1, 2, 3 inside each section; there is no bar 0. Beats start at 1 and must fit the time signature (1-4 in 4/4, 1-3 in 3/4; halves like 2.5 are fine). An empty chords list means the previous chord keeps sounding. The song's first bar starts with a chord (or \"unknown\") on beat 1; a pickup goes at its beat inside bar 1 of the first section.\n- Lyric markers point at a bar and beat of their section: {\"charIndex\": 10, \"bar\": 1, \"beat\": 1}; charIndex is 0-based within the line.\n- \"sections\" is the Simple version for kids learning chords: plain major, minor, 7, sus2 or sus4 chords, 4 to 8 changes per section, the fancier chord in alternates. \"sectionsFull\" (optional) is the Full version as on the record. Both use the SAME section ids, the SAME bar count per id and the same form, so both cover the whole song. Write the lyrics in both. Give lyrics for 3 songs or fewer; leave them out for longer lists.\n\nCHECK BEFORE ANSWERING\n- Bar-sum check: add up the bars of every id in form (count repeated ids every time), multiply by beatsPerBar x 60 / bpm, add firstDownbeatSeconds (0 if unknown). The result must be within 3% of durationSeconds. Report it in timing.barSumCheck {totalBars, expectedSeconds, durationSeconds, errorPercent, pass}.\n- If it fails, recount the bars and the tempo first. If it still fails, do not stretch the numbers: set pass to false, bpmConfidence to 0.3 or less, and say what is off in the song's notes.\n- Also check: every form id exists in sections (and in sectionsFull), every source id exists in song.sources, every null timing is listed in timing.unknown, every chord matches the spelling rules above, and the JSON parses.";
export const UP_ARTIST_MAX = 20;
export const UP_SKIP_MAX = 40;
export const UP_LIST_MAX = 25;   // v110: no album mode (the album cap is gone)
var upSchemaText;
var upSchema;
export var upListSchemaText;
export var upListSchema13Text;   // v112.12: the Contract v1.3 list schema copied with the prompt (#songSchema13Json)
export var upProgObj;

// --- chord symbols (the contract's chordSymbol pattern) -> app chord items ---
const UP_CHORD_RE = /^([A-G])(#|b)?(maj|min|dim|aug|sus2|sus4|add|m|M)?([0-9]*)((?:b5|#5|b9|#9|#11|b13|add9|sus4|sus2)*)(?:\/([A-G])(#|b)?)?$/;
export function upParseChord(sym) {
  var m = UP_CHORD_RE.exec(String(sym));
  if (!m) return { error: "is not a chord symbol the app can read (e.g. Bm, F#7, G/B)" };
  var rs = { li: SPELL_LI.indexOf(m[1]), acc: m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0 };
  var pc = wrap12([0, 2, 4, 5, 7, 9, 11][rs.li] + rs.acc);
  var q = m[3] || "", n = m[4] || "", alts = m[5] ? m[5].match(/b5|#5|b9|#9|#11|b13|add9|sus4|sus2/g) : [];
  var type = "major", ext = { six: false, min7: false, maj7: false, nine: false, sus2: false, flat9: false, sharp9: false, thirteen: false, over: 0 };
  var warn = [], maj = q === "maj" || q === "M", add = q === "add";
  if (q === "m" || q === "min") type = "minor";
  else if (q === "dim") type = "dim";
  else if (q === "aug") warn.push("augmented is played as a major chord");
  else if (q === "sus2") ext.sus2 = true;
  else if (q === "sus4") type = "sus4";
  function seven() { if (maj) ext.maj7 = true; else if (type === "dim" && q === "dim") ext.six = true; else ext.min7 = true; }
  if (n === "") { if (add) return { error: "\"add\" needs a number (e.g. Cadd9)" }; }
  else if (n === "2") { if (add) ext.nine = true; else ext.sus2 = true; }
  else if (n === "4") { if (add) warn.push("add4 is played without the 4th"); else type = "sus4"; }
  else if (n === "5") { warn.push("a power chord (5) is played as a full major chord"); }
  else if (n === "6") { ext.six = true; }
  else if (n === "7") { seven(); }
  else if (n === "9") { if (add) ext.nine = true; else { seven(); ext.nine = true; } }
  else if (n === "11") { seven(); ext.nine = true; if (type === "major") type = "sus4"; else warn.push("the 11th is left out"); }
  else if (n === "13") { seven(); ext.thirteen = true; }
  else return { error: "has a chord number (" + n + ") the app does not play" };
  for (var i = 0; i < alts.length; i++) {
    var a = alts[i];
    if (a === "b5") { if (type === "minor") type = "dim"; else if (type !== "dim") warn.push("\u266d5 is left out"); }
    else if (a === "#5") warn.push("\u266f5 is left out");
    else if (a === "b9") { if (!ext.min7 && !ext.maj7) ext.min7 = true; ext.flat9 = true; ext.nine = false; }
    else if (a === "#9") { if (!ext.min7 && !ext.maj7) ext.min7 = true; ext.sharp9 = true; }
    else if (a === "#11" || a === "b13") warn.push(a.replace("b", "\u266d").replace("#", "\u266f") + " is left out");
    else if (a === "add9") ext.nine = true;
    else if (a === "sus4") { if (type === "minor") warn.push("minor sus4 is played as sus4"); type = "sus4"; }
    else if (a === "sus2") { if (type === "minor") warn.push("minor sus2 is played as sus2"); if (type !== "sus4") type = "major"; ext.sus2 = true; }   // v112.12: 7sus2
  }
  if (m[6]) {
    var bs = { li: SPELL_LI.indexOf(m[6]), acc: m[7] === "#" ? 1 : m[7] === "b" ? -1 : 0 };
    ext.over = wrap12([0, 2, 4, 5, 7, 9, 11][bs.li] + bs.acc - pc);
  }
  var label = String(sym).slice(m[1].length + (m[2] ? 1 : 0)).replace(/b/g, "\u266d").replace(/#/g, "\u266f");
  return { pc: pc, rs: rs, type: type, ext: ext, label: label, warn: warn };
}
// One uploaded chord as a progression step (same shape as progStep's, so badges, the strip's
// dashed chips, magic Next and the next-chord hint work unchanged).
export function upStep(key, sym, bars, ei, fb) {
  var c = upParseChord(sym);
  if (c.error && fb) c = upParseChord(fb);   // v112.12: an unreadable chord holds the chord before it (never a silent C)
  if (c.error) { var kd0 = keyDegrees(key)[0]; c = upParseChord(SPELL_LI.charAt(kd0.rootSpell.li) + (kd0.rootSpell.acc > 0 ? "#" : kd0.rootSpell.acc < 0 ? "b" : "") + (kd0.type === "minor" ? "m" : "")); }
  if (c.error) c = upParseChord("C");
  var kdegs = keyDegrees(key);
  var rowPcs = kdegs.map(function (d) { return d.pc; }).sort(function (a, b) { return a - b; });
  var inKey = {};
  kdegs.forEach(function (d) { inKey[d.pc] = true; });
  var tonePcs = Theory.chordIntervals(c.type, c.ext).map(function (iv) { return wrap12(c.pc + iv); });
  if (c.ext.over) tonePcs.push(wrap12(c.pc + c.ext.over));
  var diatonic = tonePcs.every(function (x) { return inKey[x]; });
  var ni = rowPcs.indexOf(c.pc);
  var hc = ni >= 0 ? 1 + 2 * ni : 2 * rowPcs.filter(function (x) { return x < c.pc; }).length;
  var d = null, acc = "";
  kdegs.forEach(function (k) { if (!d && k.pc === c.pc) d = k; });
  if (!d) kdegs.forEach(function (k) { if (!d && k.pc === wrap12(c.pc + 1)) { d = k; acc = "\u266d"; } });
  if (!d) kdegs.forEach(function (k) { if (!d && k.pc === wrap12(c.pc - 1)) { d = k; acc = "\u266f"; } });
  var base = String(d.roman).replace(/[^ivIV]/g, "").toUpperCase();
  var lower = c.type === "minor" || c.type === "dim";
  var num = lower ? base.toLowerCase() : base;
  var suffix = c.label.replace(/^(m(?!aj)|min)/, "");
  var roman = acc + num + suffix;
  var rn = acc + num + (c.type === "dim" ? (c.ext.min7 ? "\u00f8" : "\u00b0") : "");
  var row = (c.type === "minor" && !c.ext.over) ? "sad"
    : (c.type === "dim" || c.type === "sus4" || c.ext.flat9 || c.ext.sharp9 || c.ext.over) ? "tension"
    : (diatonic && ni >= 0) ? "happy" : "bright";
  return {
    bars: bars, roman: roman, rn: rn, hc: hc, row: row, ei: ei,
    item: { rootPc: c.pc, rootName: Theory.noteName(c.rs), rootSpell: c.rs,
      degree: (!acc && diatonic && c.type === d.type && !c.ext.over) ? d.degree : null,
      type: c.type, extensions: c.ext, qualityLabel: c.label, chipLabel: c.label, keepSpell: true }
  };
}

// --- validator: the subset of JSON Schema the contract uses (types, required, enum, const,
// min/max, exclusiveMinimum, minLength, minItems, pattern, items, additionalProperties, $ref) ---
function upType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return isFinite(v) ? (Math.floor(v) === v ? "integer" : "number") : "nan";
  return typeof v;
}
var upStripW = null;   // v112.12: while set (upCheckObj), unknown fields are dropped with a warning instead of an error
function upValidate(node, sch, path, errs, refName) {
  if (!sch) return;
  if (sch.$ref) {
    var nm = sch.$ref.split("/").pop();
    return upValidate(node, upSchema.$defs[nm], path, errs, nm);
  }
  var at = path || "(top level)";
  if (Object.prototype.hasOwnProperty.call(sch, "const") && node !== sch["const"]) { errs.push({ path: at, msg: "must be " + JSON.stringify(sch["const"]) }); return; }
  if (sch["enum"] && sch["enum"].indexOf(node) < 0) {
    errs.push({ path: at, msg: (node === undefined ? "is missing" : JSON.stringify(node) + " is not allowed") + "; use one of " + sch["enum"].join(", ") });
    return;
  }
  var t = upType(node), want = sch.type;
  if (want) {
    var ok = want === t || (want === "number" && t === "integer");
    if (!ok) { errs.push({ path: at, msg: "must be " + (want === "integer" ? "a whole number" : want === "object" ? "an object { }" : want === "array" ? "a list [ ]" : "a " + want) + " (got " + (t === "nan" ? "an invalid number" : t) + ")" }); return; }
  }
  if (t === "string") {
    if (sch.minLength && node.length < sch.minLength) errs.push({ path: at, msg: "must not be empty" });
    if (sch.pattern && !(new RegExp(sch.pattern)).test(node)) {
      errs.push({ path: at, msg: refName === "chordSymbol" ? JSON.stringify(node) + " is not a chord symbol the app can read (e.g. Bm, F#7, G/B)"
        : /timeSignature$/.test(at) ? JSON.stringify(node) + " must look like \"4/4\", \"3/4\" or \"6/8\"" : JSON.stringify(node) + " does not match " + sch.pattern });
    }
  }
  if (t === "number" || t === "integer") {
    var lo = sch.minimum, hi = sch.maximum;
    if (lo != null && hi != null && (node < lo || node > hi)) errs.push({ path: at, msg: "must be between " + lo + " and " + hi + " (got " + node + ")" });
    else if (lo != null && node < lo) errs.push({ path: at, msg: "must be at least " + lo + " (got " + node + ")" });
    else if (hi != null && node > hi) errs.push({ path: at, msg: "must be at most " + hi + " (got " + node + ")" });
    if (sch.exclusiveMinimum != null && !(node > sch.exclusiveMinimum)) errs.push({ path: at, msg: "must be more than " + sch.exclusiveMinimum + " (got " + node + ")" });
  }
  if (t === "array") {
    if (sch.minItems && node.length < sch.minItems) errs.push({ path: at, msg: "must have at least " + sch.minItems + " item" + (sch.minItems > 1 ? "s" : "") });
    if (sch.items) for (var i = 0; i < node.length; i++) upValidate(node[i], sch.items, path + "[" + i + "]", errs);
  }
  if (t === "object") {
    var props = sch.properties || {};
    (sch.required || []).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(node, k)) errs.push({ path: path ? path + "." + k : k, msg: "is required" });
    });
    Object.keys(node).forEach(function (k) {
      var p = path ? path + "." + k : k;
      if (props[k]) upValidate(node[k], props[k], p, errs);
      else if (sch.additionalProperties === false) {
        if (upStripW) { upStripW.push(p + " is not a field of the song form (ignored)"); delete node[k]; }   // v112.12 (P2)
        else errs.push({ path: p, msg: "is not a field of the song form" });
      }
    });
  }
}
// v89: answer parsing (port of v89-multi-song/ref.js): fences, string-aware brace matching,
// single / envelope / bare list, and salvage of the complete songs from a cut-off list.
// v112.12 (P3): every ``` block is tried (a song answer wins over an example), then the whole text; when
// strict JSON fails, the same text repaired (normalize.js repairJson: smart quotes, trailing commas,
// comments, odd spaces). "unbalanced" = the brackets never close (the answer really was cut off).
function upFences(s) {
  var re = /```[a-zA-Z0-9_-]*[^\S\n]*\n?([\s\S]*?)(```|$)/g, out = [], m;
  while ((m = re.exec(s))) { out.push(m[1]); if (!m[2] || m.index === re.lastIndex) break; }
  return out;
}
function upMatchEnd(s, i) {
  var depth = 0, str = false, esc = false;
  for (var j = i; j < s.length; j++) {
    var c = s[j];
    if (str) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === "\"") str = false; continue; }
    if (c === "\"") str = true; else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") { depth--; if (depth === 0) return j + 1; }
  }
  return -1;
}
function upSalvageList(s, i) {
  var out = [], j = i + 1;
  for (;;) {
    while (j < s.length && /[\s,]/.test(s[j])) j++;
    if (j >= s.length || s[j] !== "{") break;
    var e = upMatchEnd(s, j);
    if (e < 0) break;
    try { out.push(JSON.parse(s.slice(j, e))); } catch (err) { break; }
    j = e;
  }
  return out;
}
function upObjList(v) { return Array.isArray(v) && v.length > 0 && v.every(function (x) { return x && typeof x === "object" && !Array.isArray(x); }); }
// -> { kind, items, envelope } for a value that looks like a song answer, else null
function upKind(v) {
  if (upObjList(v)) return { kind: "list", items: v, envelope: null, truncated: false };
  if (v && typeof v === "object" && !Array.isArray(v)) {
    if (Array.isArray(v.songs)) return { kind: "list", items: v.songs, envelope: v, truncated: false };
    if (v.song || v.sections || v.form || v.timing) return { kind: "single", items: [v], envelope: null, truncated: false };
  }
  return null;
}
// -> { kind: "single"|"list", items, envelope, truncated, repaired } or { error: "empty"|"nojson"|"badjson", listy, unbalanced }
export function upParseAnswer(text) {
  var raw = String(text || "");
  if (!raw.trim()) return { error: "empty" };
  var fences = upFences(raw), cands = fences.concat([raw]), main = fences.length ? fences[0] : raw;
  if (main.indexOf("{") < 0 && main.indexOf("[") < 0 && raw.indexOf("{") < 0 && raw.indexOf("[") < 0) return { error: "nojson" };
  var fbList = null, fbAny = null;
  function at(s, st) { var end = upMatchEnd(s, st); if (end < 0) return null; try { return { v: JSON.parse(s.slice(st, end)), end: end }; } catch (err) { return { end: end }; } }
  function done(k, rep) { k.repaired = rep; return k; }
  for (var pass = 0; pass < 2; pass++) {
    for (var c = 0; c < cands.length; c++) {   // 1) the first { and the first [ of each block (the v89 rule)
      var s = pass ? repairJson(cands[c]) : cands[c], a = s.indexOf("{"), b = s.indexOf("[");
      var starts = [a, b].filter(function (n) { return n >= 0; }).sort(function (x, y) { return x - y; });
      for (var k = 0; k < starts.length; k++) {
        var r = at(s, starts[k]);
        if (!r || !("v" in r)) continue;
        var kd = upKind(r.v);
        if (kd && (kd.kind === "single" || kd.envelope || starts[k] === starts[0])) return done(kd, !!pass);
        if (kd && !fbList) fbList = done(kd, !!pass);
        if (!kd && !fbAny && r.v && typeof r.v === "object" && !Array.isArray(r.v)) fbAny = r.v;
      }
    }
  }
  for (pass = 0; pass < 2; pass++) {   // 2) any later { (prose with a { in it before the answer): an envelope or a song form only
    for (c = 0; c < cands.length; c++) {
      s = pass ? repairJson(cands[c]) : cands[c];
      for (var j = 0, tries = 0; j < s.length && tries < 80; j++) {
        if (s[j] !== "{") continue;
        tries++;
        r = at(s, j);
        if (!r) continue;
        if (!("v" in r)) continue;
        kd = upKind(r.v);
        if (kd && (kd.envelope || (kd.kind === "single" && r.v.song))) return done(kd, !!pass);
        j = r.end - 1;
      }
    }
  }
  if (fbList) return fbList;
  if (fbAny) return { kind: "single", items: [fbAny], envelope: null, truncated: false };
  var rs = repairJson(main), ra = rs.indexOf("{"), rb = rs.indexOf("[");
  var m = /"songs"\s*:\s*\[/.exec(rs), li = m ? m.index + m[0].length - 1 : (rb >= 0 && (ra < 0 || rb < ra) ? rb : -1);
  var first = [ra, rb].filter(function (n) { return n >= 0; }).sort(function (x, y) { return x - y; })[0];
  var unbalanced = first === undefined || upMatchEnd(rs, first) < 0;
  if (li >= 0 && unbalanced) {
    var items = upSalvageList(rs, li);
    if (items.length) return { kind: "list", items: items, envelope: null, truncated: true };
  }
  return { error: "badjson", listy: li >= 0, unbalanced: unbalanced };
}
// Text -> { ok, song, errors: [{path, msg}], warnings: [] }. Strips ``` fences and any prose
// around the JSON (first "{" to last "}").
export function upCheck(text) {
  var out = { ok: false, song: null, errors: [], warnings: [] };
  var s = String(text || "");
  var a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (!s.replace(/\s+/g, "")) { out.errors.push({ path: "(paste)", msg: "is empty: paste the AI's answer first" }); return out; }
  if (a < 0 || b <= a) { out.errors.push({ path: "(paste)", msg: "has no JSON object in it (nothing between { and })" }); return out; }
  var body = s.slice(a, b + 1), obj;
  try { obj = JSON.parse(body); }
  catch (err0) { try { obj = JSON.parse(repairJson(body)); } catch (err1) { obj = undefined; } }   // v112.12 (P3)
  if (obj === undefined) try { JSON.parse(body); }
  catch (err) {
    var msg = String(err && err.message || err), pos = /position (\d+)/.exec(msg), where = "";
    var lc = /line (\d+) column (\d+)/.exec(msg);
    if (lc) where = " (line " + lc[1] + ", column " + lc[2] + ")";
    else if (pos) { var pre = body.slice(0, +pos[1]).split("\n"); where = " (line " + pre.length + ", column " + (pre[pre.length - 1].length + 1) + ")"; }
    out.errors.push({ path: "(JSON)", msg: "is not valid JSON" + where + ": " + msg.replace(/^JSON\.parse: /, "") });
    return out;
  }
  return upCheckObj(obj);
}
// v112.12: contract versions. A number (1.2) counts as the string; 1.0-1.3 are read (1.3 is turned into the
// v1.2 shape by normalize.js from13 first); any other version gets a plain message.
export const UP_VERSIONS = ["1.0", "1.1", "1.2", "1.3"];
function upCv(v) { return typeof v === "number" && isFinite(v) ? (Math.floor(v) === v ? v + ".0" : String(v)) : v; }
function upCvMsg(v) { return JSON.stringify(v) + " is a contract version this app can't read (it reads 1.2 and 1.3). Copy the prompt again and ask the AI for contract 1.3."; }
// v112.12: gentle fixes before the checks (a song form that already passes is not changed):
// nulls where a value can be left out are dropped; a null confidence is 0 (listed for review); a null /
// "unknown" bpm plays at a tempo worked out from durationSeconds (else 90); chord spellings the parser can't
// read are tidied (P1); a chord's bass field joins its symbol as a slash bass and its source is accepted;
// an "unknown" / null chord holds the chord before it with confidence 0 (listed for review) and N.C. holds it
// too (the app has no rest), never a silent C.
function upPrep(obj, W) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  var sg = obj.song;
  if (sg && typeof sg === "object" && !Array.isArray(sg)) {
    ["year", "capo", "album"].forEach(function (k) { if (sg[k] === null) delete sg[k]; });
    if (sg.key && typeof sg.key === "object" && sg.key.confidence === null) delete sg.key.confidence;
  }
  var tm = obj.timing, nUnk = 0, nRest = 0, tidied = {};
  if (tm && typeof tm === "object" && !Array.isArray(tm)) {
    if (tm.durationSeconds === null) delete tm.durationSeconds;
    if (typeof tm.bpm === "string" && /^\s*\d+(\.\d+)?\s*$/.test(tm.bpm)) { tm.bpm = +tm.bpm; W.push("timing.bpm was text; read as " + tm.bpm); }
  }
  function tidy(c, P, holdOk) {
    if (!c || typeof c !== "object") return;
    if (typeof c.bass === "string" && c.bass && typeof c.chord === "string") {
      var b = c.bass.replace(/\u266d/g, "b").replace(/\u266f/g, "#");
      c.chord = c.chord.replace(/\/[A-Ga-g](#|b|\u266d|\u266f)?$/, "") + "/" + b;
    }
    if (c.bass === null || typeof c.bass === "string") delete c.bass;
    if (Object.prototype.hasOwnProperty.call(c, "source")) delete c.source;
    if (c.confidence === null) { c.confidence = 0; }
    if (c.position && typeof c.position === "object" && c.position.startSeconds === null) delete c.position.startSeconds;
    var t = c.chord;
    if (typeof t === "string" && !upParseChord(t).error) return;
    var td = tidyChord(t);
    if (td.unknown || td.rest) { if (holdOk) { c._hold = td.rest ? "rest" : "unknown"; } return; }
    if (td.sym && !upParseChord(td.sym).error) {
      if (!tidied[t]) { tidied[t] = true; W.push("Chord \"" + t + "\" read as " + td.sym + (td.note ? " (" + td.note + ")" : "")); }
      c.chord = td.sym;
    }
  }
  [["sections", obj.sections], ["sectionsFull", obj.sectionsFull]].forEach(function (L) {
    if (!Array.isArray(L[1])) return;
    var all = [];
    L[1].forEach(function (sec, si) {
      if (!sec || typeof sec !== "object" || !Array.isArray(sec.chords)) return;
      if (sec.repeat === null) delete sec.repeat;
      sec.chords.forEach(function (c, ci) {
        var P = L[0] + "[" + si + "].chords[" + ci + "]";
        tidy(c, P, true);
        if (c && Array.isArray(c.alternates)) {
          c.alternates = c.alternates.filter(function (a) { if (!a || typeof a !== "object") return true; tidy(a, P, false); var td = tidyChord(a.chord); return !(td.unknown || td.rest) || typeof a.chord === "string" && !upParseChord(a.chord).error; });
          c.alternates.forEach(function (a) { if (a && a.confidence === null) delete a.confidence; });
        }
        if (c && typeof c === "object") all.push(c);
      });
    });
    // holds: the chord before (in play order), else the next known one, else the key's home chord
    var prev = null;
    all.forEach(function (c, k) {
      if (!c._hold) { if (typeof c.chord === "string") prev = c.chord; return; }
      var sym = prev;
      for (var j = k + 1; !sym && j < all.length; j++) if (!all[j]._hold && typeof all[j].chord === "string") sym = all[j].chord;
      if (!sym) { var ky = sg && sg.key; sym = (ky && typeof ky.tonic === "string" ? ky.tonic : "C") + (ky && ky.mode === "minor" ? "m" : ""); }
      if (c._hold === "unknown") { nUnk++; c.confidence = 0; } else nRest++;
      c.chord = sym;
      delete c._hold;
    });
  });
  if (nUnk) W.push(nUnk + " unknown chord" + (nUnk > 1 ? "s hold the chord" : " holds the chord") + " before " + (nUnk > 1 ? "them" : "it") + " (listed for review)");
  if (nRest) W.push(nRest + " N.C. (no chord) spot" + (nRest > 1 ? "s hold" : " holds") + " the chord before (the app has no rest)");
  if (tm && typeof tm === "object" && !Array.isArray(tm) && (tm.bpm === null || tm.bpm === "unknown" || tm.bpm === "")) {
    var beats = 0;
    (Array.isArray(obj.sections) ? obj.sections : []).forEach(function (sec) { if (sec && Array.isArray(sec.chords)) sec.chords.forEach(function (c) { if (c && c.durationBeats > 0) beats += c.durationBeats * (sec.repeat > 0 ? sec.repeat : 1); }); });
    var est = typeof tm.durationSeconds === "number" && tm.durationSeconds > 0 && beats > 0 ? Math.round(beats * 600 / tm.durationSeconds) / 10 : 0;
    if (est >= 50 && est <= 200) { tm.bpm = est; W.unshift("Tempo unknown: playing at " + tm.bpm + " BPM, worked out from the song length."); }
    else { tm.bpm = 90; W.unshift("Tempo unknown: playing at 90 BPM."); }
  }
}
// v89: check one parsed song form. Empty song.album is dropped (with a warning) so 1.0 / 1.1 answers
// with "album": "" still load; album is trimmed.
function upCheckObj(obj, pre) {
  var out = { ok: false, song: null, errors: [], warnings: (pre || []).slice() };
  if (!upSchema) { out.errors.push({ path: "(app)", msg: "song schema missing from this build" }); return out; }
  if (obj && typeof obj === "object" && !Array.isArray(obj) && Object.prototype.hasOwnProperty.call(obj, "contractVersion")) {
    obj.contractVersion = upCv(obj.contractVersion);
    if (UP_VERSIONS.indexOf(obj.contractVersion) < 0) { out.errors.push({ path: "contractVersion", msg: upCvMsg(obj.contractVersion) }); return out; }
    if (obj.contractVersion === "1.3") obj.contractVersion = "1.2";   // already in the v1.2 shape (from13)
  }
  upPrep(obj, out.warnings);
  if (obj && typeof obj === "object" && obj.song && typeof obj.song === "object" && typeof obj.song.album === "string") {
    var al = obj.song.album.trim();
    if (!al) delete obj.song.album;   // v110: silently (no album wording on screen)
    else obj.song.album = al;
  }
  upStripW = out.warnings;
  try { upValidate(obj, upSchema, "", out.errors); } finally { upStripW = null; }
  if (!out.errors.length) {
    var lists = [["sections", obj.sections]];
    if (obj.sectionsFull) lists.push(["sectionsFull", obj.sectionsFull]);   // v80: the Full version, same checks
    lists.forEach(function (L) {
    var ids = {};
    L[1].forEach(function (sec, si) {
      var P = L[0] + "[" + si + "]";
      if (ids[sec.id]) out.errors.push({ path: P + ".id", msg: "\"" + sec.id + "\" is used twice; each section id must be unique" });
      ids[sec.id] = true;
      sec.chords.forEach(function (c, ci) {
        var pc = upParseChord(c.chord);
        if (pc.error) out.errors.push({ path: P + ".chords[" + ci + "].chord", msg: JSON.stringify(c.chord) + " " + pc.error });
        else pc.warn.forEach(function (w) { out.warnings.push(P + ".chords[" + ci + "].chord " + c.chord + ": " + w); });
        if (c.index !== ci) out.warnings.push(P + ".chords[" + ci + "].index is " + c.index + "; played in list order");
        (c.alternates || []).forEach(function (al, ai) {
          var pa = upParseChord(al.chord);
          if (pa.error) out.errors.push({ path: P + ".chords[" + ci + "].alternates[" + ai + "].chord", msg: JSON.stringify(al.chord) + " " + pa.error });
        });
      });
      (sec.lyrics || []).forEach(function (ln, li) {
        ln.markers.forEach(function (mk, mi) {
          var MP = P + ".lyrics[" + li + "].markers[" + mi + "]";
          if (mk.chordIndex >= sec.chords.length) out.errors.push({ path: MP + ".chordIndex", msg: "points to chord " + mk.chordIndex + " but this section has " + sec.chords.length + " chords (0-" + (sec.chords.length - 1) + ")" });
          if (mk.charIndex > ln.text.length) out.errors.push({ path: MP + ".charIndex", msg: "is " + mk.charIndex + " but the line has only " + ln.text.length + " characters" });
        });
      });
    });
    });
    var tsn = parseInt(obj.timing.timeSignature, 10);
    if (!(tsn > 0)) out.errors.push({ path: "timing.timeSignature", msg: "needs at least 1 beat per bar" });
  }
  var ign = [];   // v112.12: one line for every field left out
  out.warnings = out.warnings.filter(function (w) { var m = / is not a field of the song form \(ignored\)$/.exec(w); if (m) ign.push(w.slice(0, m.index)); return !m; });
  if (ign.length) out.warnings.push("Left out " + ign.length + " field" + (ign.length > 1 ? "s" : "") + " the app doesn't read: " + ign.slice(0, 4).join(", ") + (ign.length > 4 ? ", \u2026" : ""));
  if (!out.errors.length) { out.ok = true; out.song = obj; }
  return out;
}

// --- the loaded song ---
// U = { raw, title, artist, key, bpm, bpb, ts, events: [{ si, ci, rep, dur }], choice: {"si:ci": sym}, reviewed: {"si:ci": true} }
// v80: U.secs = the version being played (raw.sections, or raw.sectionsFull when U.ver is "full");
// U.two = the answer has both. U.choice / U.reviewed are the current version's (U.choiceAll[ver]).
// v103 fix: a Full section with no lyrics borrows the Simple section's lyric text (same id, else same
// place); each marker moves to the Full chord sounding at that Simple chord's bar / beat. Shallow copies
// only (chords shared), so the saved answer is unchanged.
function upFullLyrics(full, simple, bpb) {
  function at(c) { var p = c.position || {}; return ((p.bar || 1) - 1) * (bpb || 4) + ((p.beat || 1) - 1); }
  return full.map(function (fs, i) {
    if (fs.lyrics && fs.lyrics.length) return fs;
    var ss = simple.filter(function (x) { return fs.id && x.id === fs.id; })[0] || simple[i];
    if (!ss || !ss.lyrics || !ss.lyrics.length) return fs;
    var lyr = ss.lyrics.map(function (ln) {
      var seen = {}, mk = [];
      (ln.markers || []).forEach(function (m) {
        var sc = ss.chords[m.chordIndex], t = sc ? at(sc) : 0, best = 0;
        fs.chords.forEach(function (fc, k) { if (at(fc) <= t) best = k; });
        if (!seen[best]) { seen[best] = true; mk.push({ charIndex: m.charIndex, chordIndex: best }); }
      });
      return { text: ln.text, markers: mk };
    });
    var o = {}; for (var k in fs) o[k] = fs[k];
    o.lyrics = lyr;
    return o;
  });
}
export function upBuild(raw, choice, reviewed, ver) {
  var two = !!(raw.sectionsFull && raw.sectionsFull.length);
  var u = { raw: raw, title: raw.song.title, artist: raw.song.artist, key: raw.song.key,
    bpm: raw.timing.bpm, ts: raw.timing.timeSignature, bpb: parseInt(raw.timing.timeSignature, 10) || 4,
    events: [], choice: choice || {}, reviewed: reviewed || {}, two: two, ver: two && ver === "full" ? "full" : "simple" };
  u.secs = u.ver === "full" ? upFullLyrics(raw.sectionsFull, raw.sections, u.bpb) : raw.sections;
  u.choiceAll = { simple: {}, full: {} }; u.reviewedAll = { simple: {}, full: {} };
  u.choiceAll[u.ver] = u.choice; u.reviewedAll[u.ver] = u.reviewed;
  u.secs.forEach(function (sec, si) {
    var reps = sec.repeat || 1;
    for (var r = 0; r < reps; r++) sec.chords.forEach(function (c, ci) { u.events.push({ si: si, ci: ci, rep: r, dur: c.durationBeats }); });
  });
  upProgObj = { name: u.title + " \u2014 " + u.artist, steps: u.events.map(function () { return "up"; }), up: true };
  return u;
}
export function upEv(si, ci) { return shared.U.secs[si].chords[ci]; }
export function upSym(si, ci) { return shared.U.choice[si + ":" + ci] || upEv(si, ci).chord; }
function upConf(si, ci) {
  var c = upEv(si, ci), s = shared.U.choice[si + ":" + ci];
  if (!s || s === c.chord) return c.confidence;
  var al = (c.alternates || []).filter(function (a) { return a.chord === s; })[0];
  return al && al.confidence != null ? al.confidence : 1;
}
export function upFlagged(si, ci) {
  if (shared.U.reviewed[si + ":" + ci]) return false;
  if (shared.U.choice[si + ":" + ci] && shared.U.choice[si + ":" + ci] !== upEv(si, ci).chord) return false;   // the player picked it
  return upConf(si, ci) < UP_FLAG;
}
export function upFlagList() {
  var out = [];
  if (!shared.U) return out;
  shared.U.secs.forEach(function (sec, si) { sec.chords.forEach(function (c, ci) { if (upFlagged(si, ci)) out.push({ si: si, ci: ci }); }); });
  return out;
}
export function upSecName(si) {
  var sec = shared.U.secs[si];
  if (sec.label) return sec.label;
  var m = /(\d+)$/.exec(sec.id || "");
  return sec.type + (m ? " " + m[1] : "");
}
// v89: Load for every answer shape. Single objects (and a list giving exactly one song with no skips)
// keep the old path and message. Lists: each song is checked on its own, then committed in one write.
function upFlagCount(song) {
  var n = 0, L = [song.sections].concat(song.sectionsFull && song.sectionsFull.length ? [song.sectionsFull] : []);
  L.forEach(function (secs) { secs.forEach(function (sec) { sec.chords.forEach(function (c) { if (c.confidence < UP_FLAG) n++; }); }); });
  return n;
}
function upEmptyErr(pa) {
  return pa.error === "empty" ? { path: "(paste)", msg: "is empty: paste the AI's answer first" } : { path: "(paste)", msg: "has no JSON object in it (nothing between { and })" };
}
// v112.12: one song form of any version -> upCheckObj's result. cv = the answer's version (the envelope's), if any.
// v1.3 (said, or the form / bars shape when no version is given) goes through normalize.js from13 first.
function upCheckSong(o, cv, single) {
  var has = o && typeof o === "object" && !Array.isArray(o) && Object.prototype.hasOwnProperty.call(o, "contractVersion");
  var v = has ? upCv(o.contractVersion) : cv;
  if (v === "1.3" || (v === undefined && is13(o))) {
    var c = from13(o);
    if (c.errors.length) return { ok: false, song: null, errors: c.errors, warnings: c.warnings };
    c.song.contractVersion = "1.2";
    var r = upCheckObj(c.song, c.warnings); r.barSum = c.barSum;
    return r;
  }
  var pre = [];
  if (!has && o && typeof o === "object" && !Array.isArray(o)) { o.contractVersion = v || "1.2"; if (single) pre.push("contractVersion is missing; read as " + o.contractVersion); }
  return upCheckObj(o, pre);
}
// Phase 1: parse. -> { done: result } (an error or the single path) or { list: {...} } to check song by song.
// opts.defer: a checked single song is returned as { pending: r } (not saved) so the dialog can run the
// pre-save validation (validate.js) first; save it with upLoadOne(r).
export function upLoadBegin(text, opts) {
  var defer = !!(opts && opts.defer);
  var pa = upParseAnswer(text);
  if (pa.error === "empty" || pa.error === "nojson") return { done: { ok: false, single: true, errors: [upEmptyErr(pa)], warnings: [] } };
  if (pa.error) {
    var r0 = upCheck(text);   // the old JSON error text (line, column)
    if (r0.ok) return defer ? { pending: r0 } : { done: upLoadOne(r0) };
    if (pa.listy && pa.unbalanced) {   // a cut-off song list with no complete song in it (v112.12: only when the brackets never close)
      var je = r0.errors.filter(function (e) { return e.path === "(JSON)"; })[0], lc = je && /\(line \d+, column \d+\)/.exec(je.msg);
      if (!lc) { var ls = String(text).replace(/\s+$/, "").split("\n"); lc = ["(line " + ls.length + ", column " + (ls[ls.length - 1].length + 1) + ")"]; }
      r0.errors = [{ path: "(JSON)", msg: "is not valid JSON " + lc[0] + ": the answer was cut off. Ask the AI for fewer songs, or ask it to continue." }];
    }
    r0.single = !pa.listy;
    return { done: r0 };
  }
  if (pa.kind === "single") {
    var r1 = upCheckSong(pa.items[0], undefined, true); r1.single = true;
    if (r1.ok && defer) return { pending: r1 };
    return { done: r1.ok ? upLoadOne(r1) : r1 };
  }
  var L = { items: pa.items, envelope: pa.envelope, truncated: pa.truncated, warnings: [], errors: [], rows: [] };
  if (pa.envelope) {
    var cv = upCv(pa.envelope.contractVersion);   // v112.12: 1.0-1.3 (a number counts), missing = read from the shape
    if (cv === undefined) { cv = pa.items.some(is13) ? "1.3" : "1.2"; L.warnings.push("contractVersion is missing; read as " + cv); }
    else if (UP_VERSIONS.indexOf(cv) < 0) L.errors.push({ path: "contractVersion", msg: upCvMsg(pa.envelope.contractVersion) });
    L.cv = cv;
    Object.keys(pa.envelope).forEach(function (k) { if (k !== "contractVersion" && k !== "songs" && k !== "notes") L.warnings.push(k + " is not a field of the song list"); });
  }
  var nts = pa.envelope && typeof pa.envelope.notes === "string" ? pa.envelope.notes.trim() : "";
  if (!pa.items.length) L.errors.push({ path: "songs", msg: "has no songs in it" + (nts ? ". The AI's notes: " + (nts.length > 200 ? nts.slice(0, 199) + "\u2026" : nts) : "") });
  if (L.errors.length) return { done: { ok: false, list: true, errors: L.errors, warnings: L.warnings, rows: [] } };
  return { list: L };
}
// Phase 2: check song i (answer order).
export function upLoadCheck(L, i) {
  var it = L.items[i], row = { i: i, title: it && it.song && typeof it.song.title === "string" && it.song.title.trim() ? it.song.title.trim() : "" };
  L.rows.push(row);
  if (i >= UP_LIST_MAX) { row.status = "skipped"; row.reason = "more than " + UP_LIST_MAX + " in one answer"; return; }
  if (!it || typeof it !== "object" || Array.isArray(it)) { row.status = "skipped"; row.reason = "is not a song form"; row.errors = [{ path: "songs[" + i + "]", msg: "must be an object { }" }]; return; }
  var o = JSON.parse(JSON.stringify(it));
  var r = upCheckSong(o, L.cv, false);
  if (!r.ok) { row.status = "skipped"; row.reason = "has problems"; row.errors = r.errors; return; }
  var k = libKey(r.song.song.title, r.song.song.artist);
  for (var j = 0; j < L.rows.length - 1; j++) if (L.rows[j].key === k && L.rows[j].song) { row.status = "skipped"; row.reason = "listed twice in this answer"; return; }
  row.key = k; row.song = r.song; row.warnings = r.warnings; row.flags = upFlagCount(r.song);
  row.note = (r.warnings || []).filter(function (w) { return /^(Length check|Tempo unknown)/.test(w); })[0] || "";
}
// Phase 3: commit in answer order on the library (one write; rolled back if storage is full).
export function upLoadCommit(L) {
  var R = { ok: false, list: true, rows: L.rows, loaded: 0, updated: 0, skipped: 0, capSkipped: 0, truncated: L.truncated, warnings: L.warnings, errors: [],
    notes: L.envelope && typeof L.envelope.notes === "string" ? L.envelope.notes : "" };
  var snap = JSON.stringify(shared.LIB), room = LIB_MAX - shared.LIB.songs.length, now = Date.now(), first = null, firstUp = null;
  L.rows.forEach(function (row) {
    if (!row.song) return;
    var song = row.song, ent = libFind(song.song.title, song.song.artist);
    if (ent) {
      var oldAl = ent.album || (ent.song && ent.song.song && ent.song.song.album) || "";
      ent.title = String(song.song.title).trim(); ent.artist = String(song.song.artist).trim(); ent.song = upStoreCopy(song);
      ent.choice = {}; ent.reviewed = {}; ent.locked = true; ent.liveKey = null; delete ent.ver;
      if (song.song.album) { ent.album = song.song.album; if (song.song.album !== oldAl) row.albumNow = song.song.album; }
      else if (oldAl) ent.album = oldAl;
      row.status = "updated"; row.ent = ent; if (!firstUp) firstUp = row;
    } else if (room > 0) {
      ent = { id: libId(), title: String(song.song.title).trim(), artist: String(song.song.artist).trim(), added: now - row.i, song: upStoreCopy(song), choice: {}, reviewed: {}, locked: true, liveKey: null };
      if (song.song.album) ent.album = song.song.album;
      shared.LIB.songs.push(ent); room--;
      row.status = "new"; row.ent = ent; if (!first) first = row;
    } else { row.status = "skipped"; row.reason = "My songs is full"; R.capSkipped++; }
  });
  L.rows.forEach(function (row) { if (row.status === "new") R.loaded++; else if (row.status === "updated") R.updated++; else R.skipped++; });
  var act = first || firstUp;
  if (!act) {
    R.errors = upListErrors(L.rows);
    return R;
  }
  if (!libWrite()) { shared.LIB = JSON.parse(snap); R.loaded = R.updated = 0; R.saveFail = true; R.errors = [{ path: "My songs", msg: "Couldn't save, storage is full" }]; paintLib(); return R; }
  progStop();
  if (state.style === "kids") { var pb = document.querySelector("#styles button[data-style=\"pop\"]"); if (pb) pb.click(); }
  shared.U = upBuild(act.song, {}, {});
  shared.U.id = act.ent.id;
  shared.U.locked = true; shared.U.liveKey = null; shared.U.keep = true;
  R.key = upKeyApply(act.song.song.key.tonic, act.song.song.key.mode);
  R.active = act.ent.title;
  upSelect();
  R.ok = true;
  // exactly one song and nothing skipped: the old single-song result
  if (L.rows.length === 1 && !R.skipped) { R.list = false; R.single = true; R.warnings = R.warnings.concat(act.warnings || []); R.updated1 = act.status === "updated"; }
  return R;
}
function upListErrors(rows) {
  var out = [];
  rows.forEach(function (row) {
    if (row.status !== "skipped") return;
    var who = "Song " + (row.i + 1) + (row.title ? " (" + row.title + ")" : "");
    if (row.errors && row.errors.length) row.errors.forEach(function (e) { out.push({ path: who + ": " + e.path, msg: e.msg }); });
    else out.push({ path: who, msg: row.reason === "My songs is full" ? "My songs: is full" : row.reason });
  });
  return out;
}
// Synchronous Load (the test hook; the button runs the same phases with a progress line).
export function upLoadAll(text) {
  var b = upLoadBegin(text);
  if (b.done) return b.done;
  for (var i = 0; i < b.list.items.length; i++) upLoadCheck(b.list, i);
  return upLoadCommit(b.list);
}
export function upRemove() {
  var was = upSelected();
  shared.U = null; upProgObj = null;
  upSave();
  shared.suggestSig = "";
  paintSuggestions(computeSpec());
  if (was) progSet(0);
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
upSchemaText = "";
  upSchema = null;
  upListSchemaText = "";
  (function () {
    var s = document.getElementById("songSchemaJson");
    upSchemaText = s ? s.textContent.replace(/^\s+|\s+$/g, "") : "";
    try { upSchema = JSON.parse(upSchemaText); } catch (err) { upSchema = null; }
    // v89: the song-list schema (song-list-contract.schema.json) is built from the one-song schema
    if (upSchema) {
      var item = { description: "One song: the same form as song-contract.schema.json v1.2, without contractVersion (the list carries it).",
        type: "object", required: ["song", "timing", "sections"], additionalProperties: false, properties: {} };
      Object.keys(upSchema.properties).forEach(function (k) {
        item.properties[k] = k === "contractVersion" ? { "enum": upSchema.properties.contractVersion["enum"], description: "Optional here; leave it out." } : upSchema.properties[k];
      });
      // v110: the prompt copy never mentions album: song.album is left out of the shown song form (the
      // checking schema upSchema still accepts it, so old answers / saved songs with an album still load).
      item = JSON.parse(JSON.stringify(item));
      if (item.properties.song && item.properties.song.properties) delete item.properties.song.properties.album;
      var defs = { songItem: item };
      Object.keys(upSchema.$defs || {}).forEach(function (k) { defs[k] = upSchema.$defs[k]; });
      upListSchemaText = JSON.stringify({
        "$schema": upSchema.$schema,
        "$id": "https://digitalfarmer420.github.io/touch-chord/schema/song-list-contract-v1.json",
        title: "Touch Chord Song List Contract v1.2",
        description: "Several songs in one answer (several songs by one artist). Each item in songs is one song form. A bare JSON list of song forms also loads.",
        type: "object", required: ["contractVersion", "songs"], additionalProperties: false,
        properties: {
          contractVersion: { "const": "1.2" },
          songs: { type: "array", minItems: 1, maxItems: UP_LIST_MAX, description: "One entry per song. Artist: at most " + UP_ARTIST_MAX + ".", items: { "$ref": "#/$defs/songItem" } },
          notes: { type: "string", description: "Anything about the whole list, e.g. songs left out because their chords could not be found." }
        },
        "$defs": defs
      }, null, 2);
    }
  })();
  (function () {
    var s13 = document.getElementById("songSchema13Json");
    upListSchema13Text = "";
    try {   // v110 rule kept: the copied form never mentions album (an answer with an album still loads)
      var j13 = s13 ? JSON.parse(s13.textContent) : null, sp13 = j13 && j13.$defs && j13.$defs.song && j13.$defs.song.properties.song;
      if (sp13 && sp13.properties) delete sp13.properties.album;
      upListSchema13Text = j13 ? JSON.stringify(j13) : "";
    } catch (err) { upListSchema13Text = ""; }
  })();
upProgObj = null;
}

// Upload: AI prompt text, schema, answer parsing and validation, load flow.
import { keyDegrees, SPELL_LI } from "../keys.js?v=112.3";
import { upSave, LIB_MAX, libKey, libFind, libId, libWrite, paintLib } from "./library.js?v=112.3";
import { progStop, progSet } from "./playback.js?v=112.3";
import { upSelected, upKeyApply, upSelect, upStoreCopy, upLoadOne } from "./song.js?v=112.3";
import { state, shared } from "../state.js?v=112.3";
import { Theory } from "../theory/index.js?v=112.3";
import { wrap12 } from "../theory/quality.js?v=112.3";
import { computeSpec } from "../ui/pads.js?v=112.3";
import { paintSuggestions } from "../ui/strip.js?v=112.3";

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
// v80: two prompts. "Simple" (default) asks for sections only; "Simple and Full" asks for both
// versions in one answer (sections + sectionsFull). Neither asks for a key: the AI returns song.key.
// v89: one prompt template for every mode (contract 1.2 song list): HEAD + RULES(variant) + TAIL + ASK(mode) + SKIP(mode).
// UP_PASTE_LINE / UP_PASTE_LINE_2 are now the Simple and Simple-and-Full RULES.
export const UP_HEAD = "Fill in the song form in the JSON contract below once for each song I ask for. Return ONLY valid JSON: one object with \"contractVersion\": \"1.2\" and a \"songs\" list holding one filled-in song form per song (song, timing, sections; leave contractVersion out of each song). For 3 songs or fewer, give every section its lyrics with chord markers; if the list has more than 3 songs, leave out lyrics to keep the answer short.";
export const UP_PASTE_LINE = "Keep it simple, for kids learning chords. List each section in play order, but use repeat for back-to-back repeats instead of writing them out. In each section give only the chord changes, and merge the same chord played twice in a row into one longer chord. Use plain beginner chords: major, minor, 7 or sus. Leave out passing chords, slash chords and extensions unless the song really needs them, and put the fancier version in alternates. Aim for 4 to 8 chords per section.";
export const UP_PASTE_LINE_2 = "Study each song once and give TWO versions of its chords in its song form. 1) \"sections\" is the Simple version, for kids learning chords: list each section in play order, but use repeat for back-to-back repeats instead of writing them out; give only the chord changes and merge the same chord played twice in a row into one longer chord; use plain beginner chords (major, minor, 7 or sus), leave out passing chords, slash chords and extensions unless the song really needs them, put the fancier version in alternates, and aim for 4 to 8 chords per section. 2) \"sectionsFull\" is the Full version, faithful to the record: keep the passing chords, slash chords and richer voicings as played; list each section once and mark repeats with repeat; about 15 to 25 chord entries across the whole song. Both versions share one song block, one timing block and the same lyric text: write the lyrics out in both, in each section of sections and of sectionsFull, with each version's lyric markers pointing into that version's own chords array.";
export const UP_TAIL = "Use concert pitch, count bars from the start of each song, give each chord an honest 0-1 confidence, and put anything unsure in that song's notes. If you can't find a song's chords, leave that song out rather than guess, and name it in the top-level notes.";
export const UP_ARTIST_MAX = 20;
export const UP_SKIP_MAX = 40;
export const UP_LIST_MAX = 25;   // v110: no album mode (the album cap is gone)
var upSchemaText;
var upSchema;
export var upListSchemaText;
export var upProgObj;

// --- chord symbols (the contract's chordSymbol pattern) -> app chord items ---
const UP_CHORD_RE = /^([A-G])(#|b)?(maj|min|dim|aug|sus2|sus4|add|m|M)?([0-9]*)((?:b5|#5|b9|#9|#11|b13|add9|sus4)*)(?:\/([A-G])(#|b)?)?$/;
export function upParseChord(sym) {
  var m = UP_CHORD_RE.exec(String(sym));
  if (!m) return { error: "is not a chord symbol the app can read (e.g. Bm, F#7, G/B)" };
  var rs = { li: SPELL_LI.indexOf(m[1]), acc: m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0 };
  var pc = wrap12([0, 2, 4, 5, 7, 9, 11][rs.li] + rs.acc);
  var q = m[3] || "", n = m[4] || "", alts = m[5] ? m[5].match(/b5|#5|b9|#9|#11|b13|add9|sus4/g) : [];
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
export function upStep(key, sym, bars, ei) {
  var c = upParseChord(sym);
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
      else if (sch.additionalProperties === false) errs.push({ path: p, msg: "is not a field of the song form" });
    });
  }
}
// v89: answer parsing (port of v89-multi-song/ref.js): fences, string-aware brace matching,
// single / envelope / bare list, and salvage of the complete songs from a cut-off list.
function upStripFences(s) { var m = /```[a-zA-Z]*\s*\n?([\s\S]*?)(```|$)/.exec(s); return m ? m[1] : s; }
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
// -> { kind: "single"|"list", items, envelope, truncated } or { error: "empty"|"nojson"|"badjson", listy }
export function upParseAnswer(text) {
  var s = upStripFences(String(text || "")), a = s.indexOf("{"), b = s.indexOf("[");
  if (!s.trim()) return { error: "empty" };
  var starts = [a, b].filter(function (n) { return n >= 0; }).sort(function (x, y) { return x - y; });
  if (!starts.length) return { error: "nojson" };
  for (var k = 0; k < starts.length; k++) {
    var st = starts[k], end = upMatchEnd(s, st);
    if (end < 0) continue;
    var v; try { v = JSON.parse(s.slice(st, end)); } catch (err) { continue; }
    if (Array.isArray(v) && !(v.length && v.every(function (x) { return x && typeof x === "object" && !Array.isArray(x); }))) continue;
    if (Array.isArray(v)) return { kind: "list", items: v, envelope: null, truncated: false };
    if (v && Array.isArray(v.songs)) return { kind: "list", items: v.songs, envelope: v, truncated: false };
    if (v && typeof v === "object") return { kind: "single", items: [v], envelope: null, truncated: false };
  }
  var m = /"songs"\s*:\s*\[/.exec(s), li = m ? m.index + m[0].length - 1 : (b >= 0 && (a < 0 || b < a) ? b : -1);
  if (li >= 0) {
    var items = upSalvageList(s, li);
    if (items.length) return { kind: "list", items: items, envelope: null, truncated: true };
  }
  return { error: "badjson", listy: li >= 0 };
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
// v89: check one parsed song form. Empty song.album is dropped (with a warning) so 1.0 / 1.1 answers
// with "album": "" still load; album is trimmed.
function upCheckObj(obj) {
  var out = { ok: false, song: null, errors: [], warnings: [] };
  if (!upSchema) { out.errors.push({ path: "(app)", msg: "song schema missing from this build" }); return out; }
  if (obj && typeof obj === "object" && obj.song && typeof obj.song === "object" && typeof obj.song.album === "string") {
    var al = obj.song.album.trim();
    if (!al) delete obj.song.album;   // v110: silently (no album wording on screen)
    else obj.song.album = al;
  }
  upValidate(obj, upSchema, "", out.errors);
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
// Phase 1: parse. -> { done: result } (an error or the single path) or { list: {...} } to check song by song.
export function upLoadBegin(text) {
  var pa = upParseAnswer(text);
  if (pa.error === "empty" || pa.error === "nojson") return { done: { ok: false, single: true, errors: [upEmptyErr(pa)], warnings: [] } };
  if (pa.error) {
    var r0 = upCheck(text);   // the old JSON error text (line, column)
    if (r0.ok) return { done: upLoadOne(r0) };
    if (pa.listy) {   // a cut-off song list with no complete song in it
      var je = r0.errors.filter(function (e) { return e.path === "(JSON)"; })[0], lc = je && /\(line \d+, column \d+\)/.exec(je.msg);
      if (!lc) { var ls = String(text).replace(/\s+$/, "").split("\n"); lc = ["(line " + ls.length + ", column " + (ls[ls.length - 1].length + 1) + ")"]; }
      r0.errors = [{ path: "(JSON)", msg: "is not valid JSON " + lc[0] + ": the answer was cut off. Ask the AI for fewer songs, or ask it to continue." }];
    }
    r0.single = !pa.listy;
    return { done: r0 };
  }
  if (pa.kind === "single") {
    var r1 = upCheckObj(pa.items[0]); r1.single = true;
    return { done: r1.ok ? upLoadOne(r1) : r1 };
  }
  var L = { items: pa.items, envelope: pa.envelope, truncated: pa.truncated, warnings: [], errors: [], rows: [] };
  if (pa.envelope) {
    upValidate(pa.envelope.contractVersion, { "enum": ["1.2"] }, "contractVersion", L.errors);
    Object.keys(pa.envelope).forEach(function (k) { if (k !== "contractVersion" && k !== "songs" && k !== "notes") L.warnings.push(k + " is not a field of the song list"); });
  }
  if (!pa.items.length) L.errors.push({ path: "songs", msg: "has no songs in it" });
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
  if (!Object.prototype.hasOwnProperty.call(o, "contractVersion")) o.contractVersion = "1.2";
  var r = upCheckObj(o);
  if (!r.ok) { row.status = "skipped"; row.reason = "has problems"; row.errors = r.errors; return; }
  var k = libKey(r.song.song.title, r.song.song.artist);
  for (var j = 0; j < L.rows.length - 1; j++) if (L.rows[j].key === k && L.rows[j].song) { row.status = "skipped"; row.reason = "listed twice in this answer"; return; }
  row.key = k; row.song = r.song; row.warnings = r.warnings; row.flags = upFlagCount(r.song);
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
upProgObj = null;
}

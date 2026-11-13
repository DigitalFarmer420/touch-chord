// v112.12: AI answer repair and song-form normalizing (pure: no DOM, no app state, no imports).
//   repairJson(text)  -> text with the usual non-JSON slips fixed (smart quotes, trailing commas, comments,
//                        non-breaking / unicode spaces, BOM, raw line breaks inside strings). Only used when
//                        JSON.parse fails, so valid JSON is never changed.
//   tidyChord(sym)    -> { sym, note } a spelling the chord parser reads (B♭7 -> Bb7, Cø7 -> Cm7b5, ...), or
//                        { unknown: true } ("unknown", null, "?") or { rest: true } (N.C.). The caller checks
//                        the result with upParseChord; a symbol that already parses is never touched.
//   is13(song)        -> true when a song form has the Contract v1.3 shape (form / bars).
//   from13(song)      -> { song, warnings, errors, barSum }: a v1.3 song form turned into the v1.2 shape the
//                        loader, upBuild and storage use (form -> sections in play order, bars / beats ->
//                        back-to-back durationBeats, bass -> slash chord, lyric bar/beat -> chordIndex).
//                        Unknown / null chords come out as chord null with confidence 0 (the loader holds
//                        the chord before them and lists them for review).
export const BARSUM_TOL = 0.02;   // the length check warns past +-2% (a warning only, never a rejection)

// ----- JSON repair -----
var SMART_Q = "\u201c\u201d\u201e\u201f\u2033\u00ab\u00bb";
// v3.2-ai-paste: also U+200C/U+200D/U+2060 (joiners, word joiner), U+0085 (NEL), U+180E between tokens
function isUniSpace(c) { return /[\u00a0\u1680\u2000-\u200d\u2028\u2029\u202f\u205f\u3000\ufeff\u2060\u0085\u180e]/.test(c); }
var PY_LIT = { None: "null", True: "true", False: "false", NaN: "null", Infinity: "null", undefined: "null" };
export function repairJson(text) {
  var s = String(text == null ? "" : text), out = "", n = s.length, i = 0, str = 0;   // str: 0 none, 1 ASCII ", 2 smart, 3 single '
  var guard = false;   // v3.2-ai-paste: the open string is a JSON one (opened after { [ , :), so a stray " inside it can be told apart
  function lastOut() { for (var q = out.length - 1; q >= 0; q--) if (!/\s/.test(out[q])) return out[q]; return ""; }
  // a quote ends its string when what follows can come after a JSON string: , (then a value or a key) } ] : or the end
  function ends(j) {
    var k = skip(j);
    if (k >= n) return true;
    var d = s[k];
    if (d === "}" || d === "]" || d === ":") return true;
    if (d !== ",") return false;
    var k2 = skip(k + 1);
    if (k2 >= n || /["'{}\[\]0-9-]/.test(s[k2]) || SMART_Q.indexOf(s[k2]) >= 0) return true;
    var w = s.slice(k2, k2 + 40);   // a word after the comma: a JSON / Python literal, or an unquoted key
    return /^(true|false|null|None|True|False|NaN|Infinity)\s*[,}\]]/.test(w) || /^[A-Za-z_$][A-Za-z0-9_$]*\s*:/.test(w);
  }
  function skip(j) {   // past whitespace and comments
    for (;;) {
      while (j < n && (/\s/.test(s[j]) || isUniSpace(s[j]))) j++;
      if (s[j] === "/" && s[j + 1] === "/") { while (j < n && s[j] !== "\n") j++; continue; }
      if (s[j] === "/" && s[j + 1] === "*") { var e = s.indexOf("*/", j + 2); j = e < 0 ? n : e + 2; continue; }
      return j;
    }
  }
  while (i < n) {
    var c = s[i];
    if (str) {
      if (str === 3) {   // v3.2-ai-paste: a Python-style 'single-quoted' string
        if (c === "\\" && s[i + 1] === "'") { out += "'"; i += 2; continue; }
        if (c === "\"") { out += "\\\""; i++; continue; }
        if (c === "'" && ends(i + 1)) { out += "\""; str = 0; i++; continue; }
      }
      if (c === "\\") { out += c + (i + 1 < n ? s[i + 1] : ""); i += 2; continue; }
      if (str === 1 && c === "\"" && guard && !ends(i + 1)) { out += "\\\""; i++; continue; }   // v3.2-ai-paste: He said "hi"
      if ((c === "\"" && str !== 3) || (str === 2 && SMART_Q.indexOf(c) >= 0)) { out += "\""; str = 0; i++; continue; }
      if (c === "\n") { out += "\\n"; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\t") { out += "\\t"; i++; continue; }
      if (c === "\ufeff") { i++; continue; }
      out += c; i++; continue;
    }
    if (c === "\"") { guard = /[{\[,:]/.test(lastOut()); str = 1; out += c; i++; continue; }
    if (SMART_Q.indexOf(c) >= 0) { str = 2; out += "\""; i++; continue; }
    if (c === "'" && /[{\[,:]/.test(lastOut())) { str = 3; out += "\""; i++; continue; }   // v3.2-ai-paste: {'title': 'x'}
    if (c === "\u3010") { var ce = s.indexOf("\u3011", i); if (ce > i && ce - i < 120) { i = ce + 1; continue; } }   // v3.2-ai-paste: ChatGPT citation marks
    if (/[\ue000-\uf8ff]/.test(c)) { i++; continue; }   // private-use citation markers
    if (/[A-Za-z_$]/.test(c) && !/[A-Za-z0-9_$.]/.test(out.slice(-1))) {   // v3.2-ai-paste: None / True / NaN, unquoted keys
      var w = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(s.slice(i, i + 64))[0], pv = lastOut();
      if (/[{,]/.test(pv) && s[skip(i + w.length)] === ":") { out += "\"" + w + "\""; i += w.length; continue; }
      if (PY_LIT[w] && /[:\[,]/.test(pv)) { out += PY_LIT[w]; i += w.length; continue; }
      out += w; i += w.length; continue;
    }
    if (c === "/" && (s[i + 1] === "/" || s[i + 1] === "*")) { i = skip(i); out += " "; continue; }
    if (isUniSpace(c)) { out += c === "\ufeff" ? "" : " "; i++; continue; }
    if (c === ",") { var k = skip(i + 1); if (s[k] === "}" || s[k] === "]") { i++; continue; } }
    out += c; i++;
  }
  return out;
}

// ----- chord spelling -----
export function tidyChord(raw) {
  if (raw === null || raw === undefined) return { unknown: true };
  var s = String(raw).replace(/[\u200b-\u200d\u2060\ufeff]/g, "");   // v3.2-ai-paste: zero-width characters
  if (/^\s*(unknown|\?+|x)\s*$/i.test(s)) return { unknown: true };
  if (/^\s*(n\.?\s*c\.?|no\s*chord|tacet)\s*$/i.test(s)) return { rest: true };
  if (/^\s*(%|\/|\u2215|simile|sim\.?)\s*$/i.test(s)) return { repeat: true };   // v3.2-ai-paste: a repeat sign holds the chord before
  var t = s.normalize ? s.normalize("NFKC") : s, note = null;
  t = t.replace(/\s+/g, "").replace(/\u266d/g, "b").replace(/\u266f/g, "#").replace(/\u266e/g, "").replace(/^([a-g])/, function (m) { return m.toUpperCase(); });
  // v3.2-ai-paste: chart decoration around one chord: (C) [C] | C | C* C' C7(x2) C7 x2, and the dashes / minus signs
  t = t.replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\ufe63\uff0d]/g, "-");
  t = t.replace(/^\|+|\|+$/g, "").replace(/\(?[x\u00d7]\d+\)?$|\(?\d+[x\u00d7]\)?$/i, "").replace(/[*'\u2019`\u00b4]+$/, "");
  var wr = /^[(\[{](.*)[)\]}]$/.exec(t);
  if (wr && /^[A-Ga-g]/.test(wr[1])) t = wr[1].replace(/^([a-g])/, function (m) { return m.toUpperCase(); });
  var dbl = /^([A-G])(\ud834\udd2b|bb|\ud834\udd2a|##)(.*)$/.exec(t);   // E\ud834\udd2b / F\ud834\udd2a (double flat / sharp): the same pitch spelled simply
  if (dbl) {
    var NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }, SH = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], FL = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    var up = dbl[2] === "##" || dbl[2] === "\ud834\udd2a", pc = (NAT[dbl[1]] + (up ? 2 : 10)) % 12;
    t = (up ? SH : FL)[pc] + dbl[3]; note = "a double " + (up ? "sharp" : "flat") + ", spelled as " + (up ? SH : FL)[pc];
  }
  var m = /^([A-G](?:#|b)?)(.*)$/.exec(t);
  if (!m) return { sym: s };
  var root = m[1], q = m[2], bass = "";
  q = q.replace(/^major$/i, "").replace(/^major(?=\d)/i, "maj").replace(/^minor/i, "m");   // v3.2-ai-paste: "C Major", "A minor"
  q = q.replace(/^(m?)7\((9|11|13)\)/, "$1$2").replace(/^(m|maj)?7\(?add(9|11|13)\)?/, function (x, a, d) { return (a || "") + d; });   // C7(13) = C13, Am7(add11) = Am11
  var sl = /\/([A-Ga-g](?:#|b)?)$/.exec(q);
  if (sl) { bass = "/" + sl[1].charAt(0).toUpperCase() + sl[1].slice(1); q = q.slice(0, sl.index); }
  q = q.replace(/^dom(?=\d)/i, "");
  // v112.13: quality words are read in any case (CMaj7, CMAJ7, CMa7, CMI7, CDim, CAug, CSus4); only a lone
  // M / m keeps its meaning (CM7 = Cmaj7, Cm7 = C minor 7).
  q = q.replace(/(dim|aug|sus|add|alt)/gi, function (x) { return x.toLowerCase(); });
  var mm = /^(min|mi|m|-)\(?(maj|ma|M|\u0394|\u2206)(7|9|11|13)?\)?/i.exec(q);
  if (mm && (mm[1] === "-" || mm[1] === "m" || /^mi/i.test(mm[1])) && (/^ma/i.test(mm[2]) || mm[2] === "M" || /[\u0394\u2206]/.test(mm[2]))) {
    q = "mM" + (mm[3] || "7") + q.slice(mm[0].length);
    note = "minor-major " + (mm[3] && mm[3] !== "7" ? mm[3] + "th" : "7th") + ": minor with a major 7th";
  }
  q = q.replace(/^[\u0394\u2206](?![0-9])/, "maj7").replace(/[\u0394\u2206]/, "maj");
  q = q.replace(/^(maj|ma)(?=[0-9]|$|[(#b+-]|sus|add)/i, "maj").replace(/^(min|mi)(?=[0-9]|$|[(#b+-]|sus|add)/i, "m");
  q = q.replace(/^[\u00f8\u00d8](7|9|11)?/, function (x, d) { return "m" + (d || "7") + "b5"; });   // v112.13: Cø9 = Cm9b5
  q = q.replace(/^(\u00b0|o|\u00ba)7/, "dim7").replace(/^(\u00b0|o|\u00ba)(?![a-z])/, "dim");
  q = q.replace(/^(\+|aug)\(?(maj|M)7\)?/, "maj7#5");   // v112.13: C+maj7 / Caug(maj7) = Cmaj7#5
  q = q.replace(/^\+5?/, "aug").replace(/\+(5|9|11)/g, "#$1").replace(/^(\d+)\+$/, "$1#5");
  q = q.replace(/^-(?!5)/, "m").replace(/-(5|9|13)/g, "b$1");
  if (/alt/.test(q)) { q = q.replace(/7?alt/, "7#9"); note = "altered dominant: the app plays it as 7#9"; }
  q = q.replace(/6\/9/, "6add9").replace(/^(m?)69/, "$16add9");
  q = q.replace(/sus(?![24])/g, "sus4");
  q = q.replace(/[()[\],]/g, "");
  // v112.13: a 5th alteration right after the root (C-5, C(b5), C+5 written as C#5) is C(b5) / Caug, never a
  // b / # on the root (Cb5 would be a C-flat chord)
  var a5 = /^(b5|#5)(.*)$/.exec(q);
  if (a5) {
    if (a5[1] === "#5") q = "aug" + a5[2];
    else { q = "(b5)" + a5[2]; if (!note) note = "a major chord with a flat 5th"; }
  }
  return { sym: root + q + bass, note: note };
}

// ----- Contract v1.3 -----
var SONG13 = ["song", "timing", "form", "sections", "sectionsFull", "notes", "contractVersion"];
var TIM13 = ["bpm", "bpmConfidence", "tempoFeel", "tempoNote", "bpmSource", "timeSignature", "firstDownbeatSeconds", "firstDownbeatSource", "durationSeconds", "durationSource", "timingSource", "unknown", "barSumCheck"];
var SEC13 = ["id", "type", "label", "startSeconds", "endSeconds", "timingSource", "occurrences", "bars", "lyrics", "notes"];
var BAR13 = ["bar", "chords"], CH13 = ["beat", "chord", "bass", "roman", "confidence", "source", "alternates"];
var ALT13 = ["chord", "bass", "reason", "confidence", "source"], LYR13 = ["text", "markers"], MK13 = ["charIndex", "bar", "beat", "beforeLine"];
function extra(o, keys, path, W) {
  if (o && typeof o === "object" && !Array.isArray(o)) Object.keys(o).forEach(function (k) { if (keys.indexOf(k) < 0) W.push(path + k + " is not a field of the song form (ignored)"); });
}
function bassOf(b) { return typeof b === "string" && b ? b.replace(/\u266d/g, "b").replace(/\u266f/g, "#").replace(/^([a-g])/, function (x) { return x.toUpperCase(); }) : ""; }
function withBass(sym, b, W, P) {
  b = bassOf(b);
  if (!b || typeof sym !== "string") return sym;
  var sl = sym.lastIndexOf("/");
  if (sl > 0 && /^[A-G](#|b)?$/.test(sym.slice(sl + 1))) {
    if (sym.slice(sl + 1) !== b) W.push(P + ": " + sym + " has bass " + b + "; played over " + b);
    sym = sym.slice(0, sl);
  }
  return sym + "/" + b;
}
export function is13(o) {
  return !!(o && typeof o === "object" && (Array.isArray(o.form) || (Array.isArray(o.sections) && o.sections.some(function (s) { return s && Array.isArray(s.bars); }))));
}
function r1(x) { return Math.round(x * 10) / 10; }
export function from13(S) {
  var W = [], E = [];
  function err(p, m) { E.push({ path: p, msg: m }); }
  function done() { return { song: null, warnings: W, errors: E }; }
  if (!S || typeof S !== "object" || Array.isArray(S)) { err("(song)", "must be an object { }"); return done(); }
  extra(S, SONG13, "", W);
  var T = S.timing && typeof S.timing === "object" && !Array.isArray(S.timing) ? S.timing : null;
  if (!T && S.timing == null && Array.isArray(S.sections) && S.sections.length) {   // v3.2-ai-paste: no timing at all -> 4/4, tempo worked out
    T = { bpm: null, timeSignature: "4/4" }; W.push("timing is missing; read as 4/4 with the tempo unknown");
  }
  if (!T) err("timing", "is required");
  else extra(T, TIM13, "timing.", W);
  var ts = T ? T.timeSignature : undefined, bpb = parseInt(ts, 10);
  if (T && ts == null) { ts = "4/4"; W.push("timing.timeSignature is missing; read as 4/4"); }
  if (!(bpb > 0)) bpb = 4;
  var form = S.form;
  if ((form == null || (Array.isArray(form) && !form.length)) && Array.isArray(S.sections) && S.sections.length && S.sections.every(function (s) { return s && typeof s.id === "string" && s.id; }) && S.sections.some(function (s) { return Array.isArray(s.bars) && s.bars.length; })) {
    form = S.sections.map(function (s) { return s.id; });   // v3.2-ai-paste: no form -> the sections in the order listed
    W.push("form is missing; the sections play in the order listed");
  }
  if (!Array.isArray(form) || !form.length) err("form", "is required: the section ids in play order, e.g. [\"intro\", \"verse1\", \"chorus\"]");
  else form.forEach(function (id, i) { if (typeof id !== "string" || !id) err("form[" + i + "]", "must be a section id (a string)"); });
  if (!Array.isArray(S.sections) || !S.sections.length) err("sections", "must be a list [ ] with at least 1 section");
  if (E.length) return done();
  form = form.slice();
  function index(list, name) {
    var by = {};
    list.forEach(function (s, i) {
      var P = name + "[" + i + "]";
      if (!s || typeof s !== "object" || Array.isArray(s)) { err(P, "must be an object { }"); return; }
      if (typeof s.id !== "string" || !s.id) { err(P + ".id", "is required"); return; }
      if (by[s.id]) err(P + ".id", "\"" + s.id + "\" is used twice; each section id must be unique (repeats go in form)");
      by[s.id] = { s: s, i: i };
      extra(s, SEC13, P + ".", W);
      if ((s.bars == null && !Array.isArray(s.chords)) || (Array.isArray(s.bars) && !s.bars.length)) by[s.id].empty = true;   // v3.2-ai-paste: left out below, not a rejection
      else if (!Array.isArray(s.bars)) err(P + ".bars", "must be a list [ ] with at least 1 bar");
    });
    return by;
  }
  var bySimple = index(S.sections, "sections");
  var full = Array.isArray(S.sectionsFull) && S.sectionsFull.length ? S.sectionsFull : null;
  var byFull = full ? index(full, "sectionsFull") : null;
  // v3.2-ai-paste: a form id that is only a near miss of one section id ("Verse1" / "verse1", "chorus" / "chorus1")
  var ids = Object.keys(bySimple), nid = function (x) { return String(x).toLowerCase().replace(/[\s_-]+/g, ""); }, mapped = {};
  form = form.map(function (id) {
    if (typeof id !== "string" || bySimple[id]) return id;
    var k = nid(id), hit = ids.filter(function (x) { return nid(x) === k; });
    if (hit.length !== 1) hit = ids.filter(function (x) { var a = nid(x); return (a.indexOf(k) === 0 && /^\d+$/.test(a.slice(k.length))) || (k.indexOf(a) === 0 && /^\d+$/.test(k.slice(a.length))); });
    if (hit.length !== 1) return id;
    if (!mapped[id]) { mapped[id] = true; W.push("form id " + JSON.stringify(id) + " read as section " + JSON.stringify(hit[0])); }
    return hit[0];
  });
  form.forEach(function (id, fi) { if (!bySimple[id]) err("form[" + fi + "]", JSON.stringify(id) + " is not the id of a section in sections"); });
  if (E.length) return done();
  var emp = form.filter(function (id, k) { return bySimple[id].empty && form.indexOf(id) === k; });
  if (emp.length) {
    form = form.filter(function (id) { return !bySimple[id].empty; });
    if (!form.length) { err("sections", "has no bars in any section in form"); return done(); }
    W.push("Section" + (emp.length > 1 ? "s " : " ") + emp.map(function (x) { return JSON.stringify(x); }).join(", ") + (emp.length > 1 ? " have" : " has") + " no bars, so " + (emp.length > 1 ? "they are" : "it is") + " left out");
  }
  Object.keys(bySimple).forEach(function (id) { if (bySimple[id].empty) delete bySimple[id]; });
  if (byFull && form.some(function (id) { return byFull[id] && byFull[id].empty; })) { W.push("The Full version was left out: a section in sectionsFull has no bars"); byFull = null; }
  Object.keys(bySimple).forEach(function (id) { if (form.indexOf(id) < 0) W.push("Section \"" + id + "\" is not in form, so it is not played"); });
  if (byFull) {
    var miss = form.filter(function (id, k) { return !byFull[id] && form.indexOf(id) === k; });
    if (miss.length) { W.push("The Full version was left out: sectionsFull has no section " + miss.map(function (x) { return JSON.stringify(x); }).join(", ") + " from form"); byFull = null; }
    else form.forEach(function (id, k) {
      if (form.indexOf(id) !== k) return;
      var a = bySimple[id].s.bars.length, b = byFull[id].s.bars.length;
      if (a !== b) W.push("Section \"" + id + "\" has " + a + " bars in Simple but " + b + " in Full");
    });
  }
  function grid(by, name) {
    var seen = {}, gbar = 1, prev = null, out = [];
    form.forEach(function (id) {
      var e = by[id], s = e.s, P = name + "[" + e.i + "]", first = !seen[id];
      seen[id] = (seen[id] || 0) + 1;
      var ev = [];
      s.bars.forEach(function (b, bi) {
        var BP = P + ".bars[" + bi + "]";
        if (!b || typeof b !== "object" || Array.isArray(b)) { if (first) err(BP, "must be an object { }"); return; }
        if (first) extra(b, BAR13, BP + ".", W);
        if (first && b.bar != null && b.bar !== bi + 1) W.push(BP + ".bar is " + b.bar + "; bars play in list order");
        var last = 0, bev = [], cl = Array.isArray(b.chords) ? b.chords : [];
        // v3.2-ai-paste: beats are read leniently (a slip in one bar no longer rejects the song): beats counted
        // from 0, beats out of order, a beat twice, a beat past the bar, chords with no beats (spread over the bar)
        var nob = cl.length > 1 && cl.every(function (c) { return c && typeof c === "object" && c.beat == null; });
        var nums = cl.map(function (c, ci) { if (!c || typeof c !== "object") return NaN; if (nob) return 1 + ci * bpb / cl.length; var v = typeof c.beat === "string" && /^\s*\d+(\.\d+)?\s*$/.test(c.beat) ? +c.beat : c.beat; return v == null ? (ci === 0 ? 1 : NaN) : typeof v === "number" ? v : NaN; });
        var zero = nums.some(function (v) { return v === 0; }) && nums.every(function (v) { return v >= 0 && v < bpb; });
        if (nob && first) W.push(BP + ": chords with no beat are spread over the bar");
        if (zero) { nums = nums.map(function (v) { return v + 1; }); if (first) W.push(BP + ": beats counted from 0; read as from 1"); }
        cl.forEach(function (c, ci) {
          var CP = BP + ".chords[" + ci + "]";
          if (!c || typeof c !== "object" || Array.isArray(c)) { if (first) err(CP, "must be an object { }"); return; }
          if (first) extra(c, CH13, CP + ".", W);
          var bt = nums[ci];
          if (!(bt >= 1 && bt < bpb + 1)) { if (first) W.push(CP + ".beat is " + JSON.stringify(c.beat) + ", not a beat from 1 to " + bpb + " (" + (ts || "4/4") + "); that chord is left out"); return; }
          bev.push({ bar: bi + 1, beat: bt, c: c, P: CP, o: ci });
        });
        var sorted = bev.slice().sort(function (x, y) { return x.beat - y.beat || x.o - y.o; });
        if (first && sorted.some(function (x, k) { return x !== bev[k]; })) W.push(BP + ": beats were out of order; played in beat order");
        sorted.forEach(function (x) {
          if (x.beat <= last) { if (first) W.push(x.P + ".beat " + x.beat + " is used twice in the bar; the later chord is left out"); return; }
          last = x.beat;
          ev.push(x);
        });
      });
      var t0 = function (x) { return (x.bar - 1) * bpb + (x.beat - 1); }, end = s.bars.length * bpb, ch = [];
      if (!ev.length || t0(ev[0]) > 0) ev.unshift({ bar: 1, beat: 1, c: { chord: prev, confidence: prev ? 1 : 0, hold: true }, P: P });
      ev.forEach(function (x, i) {
        var st = t0(x), en = i + 1 < ev.length ? t0(ev[i + 1]) : end, c = x.c;
        var unk = c.chord === null || c.chord === undefined || (typeof c.chord === "string" && /^\s*unknown\s*$/i.test(c.chord));
        var sym = unk ? null : (c.bass ? withBass(String(c.chord), c.bass, first ? W : [], x.P) : c.chord);
        var o = { index: ch.length, chord: sym, position: { bar: gbar + x.bar - 1, beat: x.beat }, durationBeats: en - st,
          confidence: unk ? 0 : (c.confidence === null || c.confidence === undefined ? (c.hold ? 1 : null) : c.confidence) };
        if (o.confidence === null) delete o.confidence;
        if (typeof c.roman === "string") o.roman = c.roman;
        if (Array.isArray(c.alternates)) o.alternates = c.alternates.filter(function (a) { return a && typeof a === "object" && typeof a.chord === "string"; }).map(function (a, ai) {
          if (first) extra(a, ALT13, x.P + ".alternates[" + ai + "].", W);
          var r = { chord: a.bass ? withBass(a.chord, a.bass, [], "") : a.chord };
          if (typeof a.reason === "string") r.reason = a.reason;
          if (typeof a.confidence === "number") r.confidence = a.confidence;
          return r;
        });
        if (!unk && typeof sym === "string") prev = sym;
        ch.push(o);
      });
      var pos = ch.map(function (o) { return [o.position.bar - gbar + 1, o.position.beat]; });
      var r = { id: seen[id] > 1 ? id + "-" + seen[id] : id, type: s.type, chords: ch };
      if (typeof s.label === "string" && s.label) r.label = s.label;
      if (Array.isArray(s.lyrics)) r.lyrics = s.lyrics.filter(function (L) { return L && typeof L === "object"; }).map(function (L, li) {
        if (first) extra(L, LYR13, P + ".lyrics[" + li + "].", W);
        var mk = (Array.isArray(L.markers) ? L.markers : []).filter(function (q) { return q && typeof q === "object"; }).map(function (q, qi) {
          if (first) extra(q, MK13, P + ".lyrics[" + li + "].markers[" + qi + "].", W);
          var k = 0, bar = +q.bar || 1, beat = +q.beat || 1;
          pos.forEach(function (p, j) { if (p[0] < bar || (p[0] === bar && p[1] <= beat)) k = j; });
          var o = { charIndex: q.charIndex, chordIndex: k };
          if (typeof q.beforeLine === "boolean") o.beforeLine = q.beforeLine;
          return o;
        });
        return { text: L.text, markers: mk };
      });
      gbar += s.bars.length;
      out.push(r);
    });
    return out;
  }
  var secs = grid(bySimple, "sections"), secsFull = byFull ? grid(byFull, "sectionsFull") : null;
  if (E.length) return done();
  // timing: bpm (null -> worked out from the length, else 90), the length check
  var totalBars = 0;
  form.forEach(function (id) { totalBars += bySimple[id].s.bars.length; });
  var D = typeof T.durationSeconds === "number" && T.durationSeconds > 0 ? T.durationSeconds : null;
  var fdb = typeof T.firstDownbeatSeconds === "number" && T.firstDownbeatSeconds >= 0 ? T.firstDownbeatSeconds : 0;
  var bpm = T.bpm, barSum = null;
  if (!(typeof bpm === "number" && isFinite(bpm) && bpm > 0)) {
    var est = D && D - fdb > 0 ? r1(totalBars * bpb * 60 / (D - fdb)) : 0;
    if (est >= 50 && est <= 200) { bpm = est; W.unshift("Tempo unknown: playing at " + bpm + " BPM, worked out from the song length."); }
    else { bpm = 90; W.unshift("Tempo unknown: playing at 90 BPM."); }
  } else if (D) {
    var Ex = totalBars * bpb * 60 / bpm + fdb, pct = (Ex - D) / D * 100;
    barSum = { totalBars: totalBars, expectedSeconds: Math.round(Ex * 100) / 100, durationSeconds: D, errorPercent: Math.round(pct * 100) / 100, pass: Math.abs(pct) <= BARSUM_TOL * 100 };
    if (!barSum.pass) W.unshift("Length check: " + totalBars + " bars at " + bpm + " BPM last " + r1(Ex) + " s" + (fdb ? " (from " + fdb + " s)" : "") + ", but the song is " + D + " s long (" + (pct > 0 ? "+" : "") + pct.toFixed(1) + "%). The tempo or a bar count may be off; the song still plays.");
  }
  var song = {};
  if (S.song && typeof S.song === "object" && !Array.isArray(S.song)) {
    Object.keys(S.song).forEach(function (k) { song[k] = S.song[k]; });
    if (song.key && typeof song.key === "object") { song.key = Object.assign({}, song.key); delete song.key.source; }
    if (Array.isArray(song.sources)) song.sources = song.sources.map(function (x) { return typeof x === "string" ? x : x && typeof x === "object" ? String(x.url || x.title || x.id || "") : ""; }).filter(Boolean);
    ["year", "capo"].forEach(function (k) { if (song[k] === null) delete song[k]; });
  } else song = S.song;
  var timing = { bpm: bpm, timeSignature: ts };
  if (D) timing.durationSeconds = D;
  var o = { song: song, timing: timing, sections: secs };
  if (secsFull) o.sectionsFull = secsFull;
  var notes = typeof S.notes === "string" ? S.notes : "";
  if (T.tempoNote && typeof T.tempoNote === "string") notes = (notes ? notes + " " : "") + "Tempo: " + T.tempoNote;
  if (notes) o.notes = notes;
  return { song: o, warnings: W, errors: E, barSum: barSum };
}

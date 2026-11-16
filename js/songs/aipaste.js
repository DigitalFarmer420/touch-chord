// Pure pre-validator for an AI song paste (song format v1.3 JSON import).
// No DOM, no app state, no imports. Runs before the existing upload checker.
// Handles: ```json / ``` fences; prose around the JSON; curly quotes used as
// delimiters (apostrophes and quotes inside strings survive); trailing commas;
// BOM and non-breaking spaces; version / contractVersion aliases.
// Validation stays strict after this step.

export const CURRENT_CONTRACT = "1.3";
export const KNOWN_VERSIONS = ["1.0", "1.1", "1.2", "1.3"];

var DBL_Q = "\u201c\u201d\u201e\u201f\u2033\u00ab\u00bb";
var SGL_Q = "\u2018\u2019\u201a\u201b";

function isSpace(c) {
  return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\u00a0" || c === "\u202f" || c === "\u2007";
}

function matchEnd(s, i) {
  var depth = 0, str = false, esc = false;
  for (var j = i; j < s.length; j++) {
    var c = s[j];
    if (str) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === "\"") str = false;
      continue;
    }
    if (c === "\"") str = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") { depth--; if (depth === 0) return j + 1; }
  }
  return -1;
}

function unwrapFences(s) {
  return s.replace(/```[a-zA-Z0-9_-]*[^\S\n]*\n?([\s\S]*?)(```|$)/g, function (_m, inner) { return inner; });
}

function lastNonSpace(out) {
  for (var q = out.length - 1; q >= 0; q--) if (!isSpace(out[q]) && out[q] !== "\ufeff") return out[q];
  return "";
}

function canStartString(prev) { return prev === "" || /[{[:,]/.test(prev); }

function extractJson(s) {
  var found = [], i = 0, first = -1, last = -1;
  while (i < s.length) {
    if (s[i] !== "{" && s[i] !== "[") { i++; continue; }
    var end = matchEnd(s, i);
    if (end < 0) {
      if (!found.length) return { text: s, extracted: false, error: "the JSON was cut off (brackets never close)" };
      break;
    }
    var slice = s.slice(i, end), ok = false;
    try { JSON.parse(slice); ok = true; } catch (err) { ok = false; }
    if (ok) {
      if (first < 0) first = i;
      last = end;
      found.push(slice);
      i = end;
    } else {
      i = end; // balanced but not JSON (prose like "{ the song }"): skip it
    }
  }
  if (!found.length) {
    if (s.indexOf("{") < 0 && s.indexOf("[") < 0) return { text: s, extracted: false, error: "has no JSON object in it (nothing between { and })" };
    return { text: s, extracted: false, error: "has no JSON object in it (nothing between { and })" };
  }
  var mid = found.length === 1 ? found[0] : found.join("\n");
  var extracted = first > 0 || last < s.length ? !/^\s*$/.test(s.slice(0, first) + s.slice(last)) : false;
  return { text: mid, extracted: extracted };
}

// Curly quotes used as JSON delimiters become ASCII "; trailing commas before } or ]
// are dropped; NBSP / BOM outside strings are cleaned. Quotes and apostrophes inside
// strings (including ’ in it's / don't) are left alone.
function normalizeLex(s) {
  var out = "", n = s.length, i = 0, str = 0, changed = false;
  function skipWs(j) { while (j < n && isSpace(s[j])) j++; return j; }
  while (i < n) {
    var c = s[i];
    if (str) {
      if (c === "\\") { out += c + (i + 1 < n ? s[i + 1] : ""); i += 2; continue; }
      if (str === 1 && c === "\"") { out += "\""; str = 0; i++; continue; }
      if (str === 2 && DBL_Q.indexOf(c) >= 0) { out += "\""; str = 0; i++; changed = true; continue; }
      if (str === 3 && SGL_Q.indexOf(c) >= 0) { out += "\""; str = 0; i++; changed = true; continue; }
      out += c; i++; continue;
    }
    if (c === "\"") { str = 1; out += c; i++; continue; }
    if (DBL_Q.indexOf(c) >= 0) { str = 2; out += "\""; i++; changed = true; continue; }
    if (SGL_Q.indexOf(c) >= 0 && canStartString(lastNonSpace(out))) { str = 3; out += "\""; i++; changed = true; continue; }
    if (c === "\ufeff") { i++; changed = true; continue; }
    if (c === "\u00a0" || c === "\u202f" || c === "\u2007") { out += " "; i++; changed = true; continue; }
    if (c === ",") { var k = skipWs(i + 1); if (s[k] === "}" || s[k] === "]") { i++; changed = true; continue; } }
    out += c; i++;
  }
  return { text: out, changed: changed };
}

// text -> { text, warnings, error, repaired, fenced, extracted }
// repaired is true only for lexical slips (quotes, commas, BOM, NBSP), not for
// stripping fences or prose, so a fenced but otherwise valid paste is not flagged.
export function normalizeAiPaste(text) {
  var raw = String(text == null ? "" : text);
  var warnings = [];
  if (!raw.replace(/\s+/g, "").replace(/\ufeff/g, "")) {
    return { text: "", warnings: warnings, error: "is empty: paste the AI's answer first", repaired: false, fenced: false, extracted: false };
  }
  var hadBom = raw.indexOf("\ufeff") >= 0;
  var s = raw.replace(/\ufeff/g, "");
  var fenced = /```/.test(s);
  if (fenced) s = unwrapFences(s);
  var lex = normalizeLex(s);
  s = lex.text;
  var ex = extractJson(s);
  if (ex.error && ex.text.indexOf("{") < 0 && ex.text.indexOf("[") < 0) {
    return { text: ex.text, warnings: warnings, error: ex.error, repaired: !!lex.changed, fenced: fenced, extracted: false };
  }
  s = ex.text;
  // repaired = lexical slips only (quotes, trailing commas, NBSP). A leading BOM or
  // fenced / prose wrapper is not flagged: the old parser already ignored those.
  return { text: s, warnings: warnings, error: null, repaired: !!lex.changed, fenced: fenced, extracted: !!ex.extracted };
}

export function aliasVersion(v) {
  if (typeof v === "number" && isFinite(v)) return { ok: true, value: (Math.floor(v) === v ? v + ".0" : String(v)) };
  if (typeof v === "string") {
    var m = /^\s*v?(\d+\.\d+)(?:\.\d+)?\s*$/i.exec(v);
    if (m) return { ok: true, value: m[1] };
  }
  return { ok: false, value: v };
}

function versionError(raw) {
  return JSON.stringify(raw) + " is a contract version this app can't read (it reads 1.2 and 1.3). Copy the prompt again and ask the AI for contract 1.3.";
}

function looks13(o) {
  return !!(o && typeof o === "object" && (Array.isArray(o.form) || (Array.isArray(o.sections) && o.sections.some(function (s) { return s && Array.isArray(s.bars); }))));
}

function applyOneVersion(o, path, warnings) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  if (o.contractVersion == null && o.version != null) {
    warnings.push((path ? path + ": " : "") + "version " + JSON.stringify(o.version) + " read as contractVersion");
    o.contractVersion = o.version;
    delete o.version;
  }
  if (!Object.prototype.hasOwnProperty.call(o, "contractVersion") || o.contractVersion == null) {
    return null;
  }
  var raw = o.contractVersion;
  var a = aliasVersion(raw);
  if (!a.ok || KNOWN_VERSIONS.indexOf(a.value) < 0) return versionError(raw);
  if (a.value !== raw) {
    warnings.push((path ? path + ": " : "") + "contractVersion " + JSON.stringify(raw) + " read as " + a.value);
    o.contractVersion = a.value;
  }
  return null;
}

// Mutates obj in place. Maps version -> contractVersion, accepts "1.3" / 1.3 / "v1.3"
// (and a patch number like "1.3.1"), and leaves a missing field for the loader to
// default (1.3 when the form looks like v1.3, else 1.2). Unknown versions return a
// user-readable error and do not invent a version.
export function normalizeAiVersion(obj) {
  var warnings = [];
  if (!obj || typeof obj !== "object") return { value: obj, warnings: warnings, error: null };
  var err = applyOneVersion(obj, "", warnings);
  if (err) return { value: obj, warnings: warnings, error: err };
  if (Array.isArray(obj.songs)) {
    for (var i = 0; i < obj.songs.length; i++) {
      err = applyOneVersion(obj.songs[i], "songs[" + i + "]", warnings);
      if (err) return { value: obj, warnings: warnings, error: err };
    }
  }
  return { value: obj, warnings: warnings, error: null };
}

// Default a missing contractVersion after alias mapping. Used by unit tests and
// the loader. A v1.3-shaped form (form / bars) defaults to 1.3; anything else to 1.2.
export function defaultAiVersion(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  if (obj.contractVersion == null) obj.contractVersion = looks13(obj) ? CURRENT_CONTRACT : "1.2";
  if (Array.isArray(obj.songs)) obj.songs.forEach(function (it) {
    if (it && typeof it === "object" && !Array.isArray(it) && it.contractVersion == null && looks13(it)) it.contractVersion = CURRENT_CONTRACT;
  });
  return obj;
}

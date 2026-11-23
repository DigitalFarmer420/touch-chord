// Pre-save check of AI song data (pure: no DOM, no app state). Runs on a song form that already passed
// the contract schema, before anything is saved; the Upload dialog shows the flags and lets the player
// choose Save anyway or Go back and fix.
//   validateSong(song) -> { flags: [{ layer: "key"|"timing"|"bpm", severity: "warn"|"error", message, where }] }
//   where = { version: "sections"|"sectionsFull", section: index, sectionName, bar, chord: index } (fields as known)
// Layers:
//   key    every chord ROOT is checked against that section's key (section.key if present, else a key
//          named in the section notes, else a key inferred when most roots fit another key, else the
//          song key, carried forward after a modulation). Quality and slash bass are not judged, except
//          that a marked borrowed / secondary-dominant chord (borrowed: true) is not flagged. A section
//          with several out-of-key chords is reported as one grouped warning.
//          In minor, the harmonic-minor V shares the natural v root, so V and V7 pass.
//   timing per section, chords are laid end to end from their position (bar/beat count from the song start);
//          gaps and overlaps between chords, and a last bar that is not full, are flagged in beats.
//          Beats per bar = the time-signature top number (default 4/4), same as the app's bpb.
//   bpm    timing.bpm must be a number from 50 to 180.
export const BPM_MIN = 50, BPM_MAX = 180;
const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const TONICS = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
function pcOf(name) {
  var m = /^([A-G])(#|b)?/.exec(String(name || ""));
  if (!m) return null;
  return (LETTER[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
}
function rootName(sym) { var m = /^([A-G](?:#|b)?)/.exec(String(sym || "")); return m ? m[1].replace("b", "\u266d").replace("#", "\u266f") : String(sym); }
function nice(n) { return Math.round(n * 1000) / 1000; }
function beats(n) { n = nice(n); return n + " beat" + (n === 1 ? "" : "s"); }
function secName(sec, si) {
  if (sec && sec.label) return sec.label;
  var t = sec && sec.type ? sec.type : "section", m = /(\d+)$/.exec((sec && sec.id) || "");
  return t.charAt(0).toUpperCase() + t.slice(1) + (m ? " " + m[1] : " (" + (si + 1) + ")");
}
export function keyScale(key) {
  var t = pcOf(key && key.tonic);
  if (t == null) return null;
  var minor = key.mode === "minor";
  return { tonic: t, minor: minor, pcs: (minor ? MINOR : MAJOR).map(function (d) { return (d + t) % 12; }) };
}
export function beatsPerBar(ts) {
  var n = parseInt(ts, 10);
  return n > 0 ? n : 4;
}
function isMinorChord(sym) {
  var m = /^[A-G](?:#|b)?(.*)$/.exec(String(sym || "").split("/")[0]);
  if (!m) return false;
  var q = m[1] || "";
  if (/^maj/.test(q) || /^M(?!in)/.test(q)) return false;
  return /^(m|min|mM)/.test(q);
}
function readKey(k) {
  if (!k || typeof k !== "object") return null;
  if (!keyScale(k)) return null;
  return { tonic: k.tonic, mode: k.mode === "minor" ? "minor" : "major" };
}
// "Key change up a half step to F major", "modulates to F major in final chorus"
export function parseKeyMention(text) {
  var s = String(text || "");
  var m = /(?:modulat(?:es|ed|ing|ion)?|key\s*change|changes?\s*(?:the\s+)?key)\s+(?:(?:up|down)[^.]{0,40}?)?(?:to\s+)?([A-G](?:#|b)?)(?:\s+|-)?(major|minor)/i.exec(s);
  if (!m) m = /(?:to|in)\s+([A-G](?:#|b)?)\s+(major|minor)/i.exec(s);
  if (!m) return null;
  return { tonic: m[1], mode: m[2].toLowerCase() };
}
function judgedChords(chords) {
  var out = [];
  (chords || []).forEach(function (c, ci) {
    if (c && c.borrowed === true) return;
    var pc = pcOf(c && c.chord);
    if (pc == null) return;
    out.push({ c: c, ci: ci, pc: pc, sym: c.chord, minor: isMinorChord(c.chord) });
  });
  return out;
}
function fitOf(judged, sc) {
  var ok = 0;
  judged.forEach(function (j) { if (sc.pcs.indexOf(j.pc) >= 0) ok++; });
  return { n: judged.length, ok: ok, ratio: judged.length ? ok / judged.length : 1 };
}
export function inferKeyFromChords(chords) {
  var judged = judgedChords(chords);
  if (!judged.length) return null;
  var firstPc = judged[0].pc, best = null;
  ["major", "minor"].forEach(function (mode) {
    TONICS.forEach(function (t) {
      var key = { tonic: t, mode: mode }, sc = keyScale(key);
      var fit = fitOf(judged, sc), tonicHits = 0, modeAgree = 0;
      judged.forEach(function (j) {
        if (j.pc !== sc.tonic) return;
        tonicHits++;
        if ((mode === "minor") === j.minor) modeAgree++;
      });
      var row = { key: key, ratio: fit.ratio, ok: fit.ok, n: fit.n, tonicHits: tonicHits, modeAgree: modeAgree, first: firstPc === sc.tonic };
      if (!best
          || row.ratio > best.ratio
          || (row.ratio === best.ratio && row.tonicHits > best.tonicHits)
          || (row.ratio === best.ratio && row.tonicHits === best.tonicHits && row.modeAgree > best.modeAgree)
          || (row.ratio === best.ratio && row.tonicHits === best.tonicHits && row.modeAgree === best.modeAgree && row.first && !best.first)) {
        best = row;
      }
    });
  });
  return best;
}
// Resolve the key a section should be checked against, and whether it becomes the new "current" key
// (an explicit field, a mention in the notes, or a confidently inferred modulation).
export function resolveSectionKey(sec, current) {
  var explicit = readKey(sec && sec.key);
  if (explicit) return { key: explicit, source: "field", adopt: true };
  var mentioned = parseKeyMention(((sec && sec.notes) || "") + " " + ((sec && sec.label) || ""));
  if (mentioned && keyScale(mentioned)) return { key: mentioned, source: "notes", adopt: true };
  var sc = keyScale(current);
  var judged = judgedChords(sec && sec.chords);
  var fit = sc ? fitOf(judged, sc) : { n: 0, ok: 0, ratio: 0 };
  if (judged.length && fit.ratio < 0.5) {
    var best = inferKeyFromChords(sec.chords);
    if (best && best.ratio >= 0.8 && best.ratio > fit.ratio + 0.25) {
      return { key: best.key, source: "infer", adopt: true };
    }
  }
  return { key: current, source: "carry", adopt: false };
}
function keyName(key) { return rootName(key.tonic) + " " + (key.mode === "minor" ? "minor" : "major"); }
function keyLayer(song, flags) {
  var songKey = readKey(song && song.song && song.song.key), sc0 = keyScale(songKey);
  if (!sc0) { flags.push({ layer: "key", severity: "error", message: "The song has no key the app can read, so its chords cannot be checked.", where: {} }); return; }
  var full = !!(song && song.sectionsFull && song.sectionsFull.length);
  [["sections", song && song.sections], ["sectionsFull", song && song.sectionsFull]].forEach(function (L) {
    if (!Array.isArray(L[1])) return;
    var current = songKey;
    L[1].forEach(function (sec, si) {
      var ver = L[0], nm = secName(sec, si) + (full ? (ver === "sectionsFull" ? " (Full)" : " (Simple)") : "");
      var resolved = resolveSectionKey(sec, current);
      if (resolved.adopt) current = resolved.key;
      var kn = keyName(resolved.key), sc = keyScale(resolved.key);
      var bad = [];
      (sec.chords || []).forEach(function (c, ci) {
        if (c && c.borrowed === true) return;
        var pc = pcOf(c && c.chord);
        if (pc == null || sc.pcs.indexOf(pc) >= 0) return;
        var bar = c.position && c.position.bar;
        bad.push({ ci: ci, bar: bar || null, chord: c.chord });
      });
      if (!bad.length) return;
      var where0 = { version: ver, section: si, sectionName: nm, bar: bad[0].bar, chord: bad[0].ci, chordName: bad[0].chord, count: bad.length };
      if (bad.length === 1) {
        flags.push({ layer: "key", severity: "warn",
          message: nm + ", chord " + (bad[0].ci + 1) + (bad[0].bar ? " (bar " + bad[0].bar + ")" : "") + ": " + bad[0].chord + " is not in " + kn + ".",
          where: where0 });
        return;
      }
      var names = [], seen = {};
      bad.forEach(function (b) { if (!seen[b.chord]) { seen[b.chord] = true; names.push(b.chord); } });
      var shown = names.slice(0, 6);
      flags.push({ layer: "key", severity: "warn",
        message: nm + ": " + bad.length + " chords not in " + kn + " (" + shown.join(", ") + (names.length > 6 ? ", \u2026" : "") + ").",
        where: where0 });
    });
  });
}
function eachSection(song, fn) {
  [["sections", song && song.sections], ["sectionsFull", song && song.sectionsFull]].forEach(function (L) {
    if (Array.isArray(L[1])) L[1].forEach(function (sec, si) { fn(sec, si, L[0]); });
  });
}
function timingLayer(song, flags) {
  var bpb = beatsPerBar(song && song.timing && song.timing.timeSignature);
  var full = !!(song && song.sectionsFull && song.sectionsFull.length);
  eachSection(song, function (sec, si, ver) {
    var ch = sec.chords || [], nm = secName(sec, si) + (full ? (ver === "sectionsFull" ? " (Full)" : " (Simple)") : "");
    if (!ch.length) return;
    function at(c) { var p = c.position || {}; return p.bar >= 1 ? (p.bar - 1) * bpb + ((p.beat || 1) - 1) : null; }
    var start = at(ch[0]), t0 = start == null ? 0 : start, t = t0, total = 0;
    var w = function (bar, ci) { return { version: ver, section: si, sectionName: nm, bar: bar, chord: ci }; };
    ch.forEach(function (c, ci) {
      var s = at(c), d = +c.durationBeats;
      if (ci > 0 && s != null && start != null) {
        var diff = nice(s - t), bar = Math.floor(Math.min(s, t) / bpb) + 1;
        if (diff > 0) flags.push({ layer: "timing", severity: "warn", message: nm + ", bar " + bar + ": " + beats(diff) + " missing before chord " + (ci + 1) + " (" + c.chord + ").", where: w(bar, ci) });
        else if (diff < 0) flags.push({ layer: "timing", severity: "warn", message: nm + ", bar " + bar + ": " + beats(-diff) + " too many: chord " + ci + " runs into chord " + (ci + 1) + " (" + c.chord + ").", where: w(bar, ci) });
        t = s;
      }
      if (!(d > 0)) { flags.push({ layer: "timing", severity: "error", message: nm + ", chord " + (ci + 1) + " (" + c.chord + ") has no length.", where: w(null, ci) }); return; }
      t += d; total += d;
    });
    var span = nice(t - t0), into = nice(((t0 % bpb) + span) % bpb);
    if (into) {
      var lastBar = Math.floor((t - 1e-9) / bpb) + 1, ci = ch.length - 1;
      if (into <= bpb / 2) flags.push({ layer: "timing", severity: "warn", message: nm + ", bar " + lastBar + ": " + beats(into) + " too many; the section ends " + beats(into) + " into a " + bpb + "-beat bar.", where: w(lastBar, ci) });
      else flags.push({ layer: "timing", severity: "warn", message: nm + ", bar " + lastBar + ": " + beats(bpb - into) + " missing; the last bar has " + nice(into) + " of " + bpb + " beats.", where: w(lastBar, ci) });
    }
  });
}
function bpmLayer(song, flags) {
  var tm = song && song.timing, v = tm ? tm.bpm : undefined;
  if (v === undefined || v === null || v === "") { flags.push({ layer: "bpm", severity: "error", message: "The tempo (BPM) is missing.", where: {} }); return; }
  if (typeof v !== "number" || !isFinite(v)) { flags.push({ layer: "bpm", severity: "error", message: "The tempo " + JSON.stringify(v) + " is not a number.", where: {} }); return; }
  if (v < BPM_MIN) flags.push({ layer: "bpm", severity: "warn", message: "The tempo " + v + " BPM is very slow (usual range " + BPM_MIN + " to " + BPM_MAX + ").", where: {} });
  else if (v > BPM_MAX) flags.push({ layer: "bpm", severity: "warn", message: "The tempo " + v + " BPM is very fast (usual range " + BPM_MIN + " to " + BPM_MAX + ").", where: {} });
}
export function validateSong(song) {
  var flags = [];
  keyLayer(song, flags);
  timingLayer(song, flags);
  bpmLayer(song, flags);
  return { flags: flags };
}
export const LAYER_NAMES = { key: "Chords out of key", timing: "Beats that don't add up", bpm: "Tempo" };

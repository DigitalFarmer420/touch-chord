// Pre-save check of AI song data (pure: no DOM, no app state). Runs on a song form that already passed
// the contract schema, before anything is saved; the Upload dialog shows the flags and lets the player
// choose Save anyway or Go back and fix.
//   validateSong(song) -> { flags: [{ layer: "key"|"timing"|"bpm", severity: "warn"|"error", message, where }] }
//   where = { version: "sections"|"sectionsFull", section: index, sectionName, bar, chord: index } (fields as known)
// Layers:
//   key    each chord is checked against that section's key (section.key if present, else a key named
//          in the section notes, else the song key, carried forward after a modulation). Chords are
//          judged by their triad (sus/add9/6/maj7 and slash/pedal bass use the triad; D# = Eb).
//          Not flagged: secondary dominants (major or 7th, or dim/dim7, whose root is a 5th above a
//          diatonic chord); borrowed chords from the parallel minor (iv, bVI, bVII, bIII, minor v);
//          in minor, major V/V7 and major IV; blues I7, IV7, V7 and bVII; Neapolitan bII; a chromatic
//          passing dim between diatonic chords; a chord marked borrowed: true. A relative major/minor
//          shift shares the key signature, so it does not warn. When 3 or more out-of-scale chords in
//          a row fit another key, one suggestion ("looks like F from bar 65") is issued instead of a
//          line per chord. Other leftover out-of-key chords in a section are grouped.
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
function sameSignature(a, b) {
  var sa = keyScale(a), sb = keyScale(b);
  if (!sa || !sb) return false;
  var ia = sa.pcs.slice().sort(), ib = sb.pcs.slice().sort();
  return ia.every(function (p, i) { return p === ib[i]; });
}
function stripBass(sym) {
  var s = String(sym || ""), i = s.lastIndexOf("/");
  if (i > 0 && /^[A-G](?:#|b)?$/.test(s.slice(i + 1))) return s.slice(0, i);
  return s;
}
// Triad of a chord symbol: sus2/sus4/add9/6/maj7/7 and slash/pedal bass are judged as the triad.
export function parseChord(sym) {
  var raw = stripBass(sym);
  var m = /^([A-G])(#|b)?(.*)$/.exec(raw);
  if (!m) return null;
  var pc = (LETTER[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  var q = m[3] || "", triad = "major";
  if (/^(dim|o|°)/.test(q) || /dim7/.test(q) || /^m7b5/.test(q) || /^ø/.test(q)) triad = "dim";
  else if (/^aug/.test(q) || /^\+/.test(q)) triad = "aug";
  else if (/^(m|min|mM)/.test(q) && !/^maj/.test(q)) triad = "minor";
  return { pc: pc, triad: triad, tonicName: m[1] + (m[2] || ""), q: q };
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
    var p = parseChord(c && c.chord);
    if (!p) return;
    out.push({ c: c, ci: ci, pc: p.pc, triad: p.triad, sym: c.chord, minor: p.triad === "minor" });
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
function isSecondary(p, sc) {
  if (!p || (p.triad !== "major" && p.triad !== "dim")) return false;
  return sc.pcs.some(function (root) { return p.pc === (root + 7) % 12; });
}
function isBorrowedParallel(p, key) {
  if (!p || key.mode === "minor") return false;
  var t = pcOf(key.tonic);
  if (t == null) return false;
  if (p.pc === (t + 5) % 12 && p.triad === "minor") return true;  // iv
  if (p.pc === (t + 8) % 12 && p.triad === "major") return true;  // bVI
  if (p.pc === (t + 10) % 12 && p.triad === "major") return true; // bVII
  if (p.pc === (t + 3) % 12 && p.triad === "major") return true;  // bIII
  if (p.pc === (t + 7) % 12 && p.triad === "minor") return true;  // minor v
  return false;
}
function isMinorSpecial(p, key) {
  if (!p || key.mode !== "minor") return false;
  var t = pcOf(key.tonic);
  if (t == null) return false;
  if (p.pc === (t + 7) % 12 && p.triad === "major") return true; // major V / V7
  if (p.pc === (t + 5) % 12 && p.triad === "major") return true; // major IV
  return false;
}
function isBlues(p, key) {
  if (!p) return false;
  var t = pcOf(key.tonic);
  if (t == null) return false;
  if (p.triad === "major" && (p.pc === t || p.pc === (t + 5) % 12 || p.pc === (t + 7) % 12)) return true; // I7 IV7 V7 (triad = major)
  if (p.pc === (t + 10) % 12 && p.triad === "major") return true; // bVII
  return false;
}
function isNeapolitan(p, key) {
  if (!p || p.triad !== "major") return false;
  var t = pcOf(key.tonic);
  return t != null && p.pc === (t + 1) % 12;
}
function isPassingDim(p, prev, next, sc) {
  if (!p || p.triad !== "dim" || !prev || !next) return false;
  if (sc.pcs.indexOf(prev.pc) < 0 || sc.pcs.indexOf(next.pc) < 0) return false;
  var d1 = Math.min((p.pc - prev.pc + 12) % 12, (prev.pc - p.pc + 12) % 12);
  var d2 = Math.min((p.pc - next.pc + 12) % 12, (next.pc - p.pc + 12) % 12);
  return d1 === 1 || d2 === 1;
}
function isAllowedInKey(p, key, sc, prev, next) {
  if (!p || !sc) return true;
  if (sc.pcs.indexOf(p.pc) >= 0) return true;
  return isSecondary(p, sc) || isBorrowedParallel(p, key) || isMinorSpecial(p, key) || isBlues(p, key) || isNeapolitan(p, key) || isPassingDim(p, prev, next, sc);
}
// Resolve the key a section should be checked against. Explicit section.key or a key named in the
// notes is adopted (and carried into later sections). A discovered modulation is adopted in keyLayer
// after a "looks like …" suggestion, not here.
export function resolveSectionKey(sec, current) {
  var explicit = readKey(sec && sec.key);
  if (explicit) return { key: explicit, source: "field", adopt: true };
  var mentioned = parseKeyMention(((sec && sec.notes) || "") + " " + ((sec && sec.label) || ""));
  if (mentioned && keyScale(mentioned)) return { key: mentioned, source: "notes", adopt: true };
  return { key: current, source: "carry", adopt: false };
}
function keyName(key) { return rootName(key.tonic) + " " + (key.mode === "minor" ? "minor" : "major"); }
function suggestLabel(key) { return key.mode === "minor" ? key.tonic + " minor" : key.tonic; }
function spellTonic(pc, chords) {
  var i, p, n;
  for (i = 0; i < (chords || []).length; i++) {
    p = parseChord(chords[i].chord);
    if (p && p.pc === pc) return p.tonicName;
  }
  for (i = 0; i < TONICS.length; i++) { n = TONICS[i]; if (pcOf(n) === pc && n.indexOf("b") < 0 && n.indexOf("#") < 0) return n; }
  for (i = 0; i < TONICS.length; i++) { n = TONICS[i]; if (pcOf(n) === pc) return n; }
  return "C";
}
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
      var ch = sec.chords || [], parsed = ch.map(function (c) { return parseChord(c && c.chord); });
      var outOfScale = [], handled = {};
      ch.forEach(function (c, ci) {
        var p = parsed[ci];
        if (!p) return;
        if (sc.pcs.indexOf(p.pc) < 0) outOfScale.push(ci);
      });
      // 3+ consecutive out-of-scale chords that fit another key (not the relative) -> one suggestion
      var r = 0;
      while (r < outOfScale.length) {
        var a = outOfScale[r], b = a, k = r;
        while (k + 1 < outOfScale.length && outOfScale[k + 1] === outOfScale[k] + 1) { k++; b = outOfScale[k]; }
        var runLen = b - a + 1;
        if (runLen >= 3) {
          var slice = ch.slice(a, b + 1);
          var best = inferKeyFromChords(slice);
          if (best && best.ratio >= 0.8 && !sameSignature(best.key, resolved.key)) {
            var allAllowed = true, hi;
            for (hi = a; hi <= b; hi++) {
              if (!isAllowedInKey(parsed[hi], resolved.key, sc, hi > 0 ? parsed[hi - 1] : null, hi + 1 < parsed.length ? parsed[hi + 1] : null)) { allAllowed = false; break; }
            }
            if (!allAllowed) {
              var tonic = spellTonic(keyScale(best.key).tonic, slice);
              var sug = { tonic: tonic, mode: best.key.mode };
              var bar = ch[a].position && ch[a].position.bar;
              flags.push({ layer: "key", severity: "warn",
                message: nm + ": looks like " + suggestLabel(sug) + " from bar " + (bar || (a + 1)) + ".",
                where: { version: ver, section: si, sectionName: nm, bar: bar || null, chord: a, chordName: ch[a].chord, count: runLen, suggest: sug } });
              for (var h = a; h <= b; h++) handled[h] = true;
              if (b === ch.length - 1 || runLen >= Math.ceil(ch.length * 0.5)) current = sug;
            }
          }
        }
        r = k + 1;
      }
      var bad = [];
      ch.forEach(function (c, ci) {
        if (handled[ci] || (c && c.borrowed === true)) return;
        var p = parsed[ci];
        if (!p) return;
        var prev = ci > 0 ? parsed[ci - 1] : null, next = ci + 1 < parsed.length ? parsed[ci + 1] : null;
        if (isAllowedInKey(p, resolved.key, sc, prev, next)) return;
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
      bad.forEach(function (x) { if (!seen[x.chord]) { seen[x.chord] = true; names.push(x.chord); } });
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

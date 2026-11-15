// v3.2 test.5: the next-chord cue on the two-line lyrics (the Expert song card and the Kids view; Simple shows no
// lyrics). The word where the next chord change lands gets a gold underline (test.5 yellow), with the chord's name in small teal text
// above it. It brightens about one beat before the change and moves on once that chord is played. Only a word on one of
// the shown lines gets it: a change that falls on a line not shown yet, or between words, shows no cue.
// Pure helpers first (unit tested), then one DOM helper that places the name tag.

// The step of the next chord change after step cur: the first later step whose chord differs (keys = one comparable
// chord id per step). Not started (cur < 0): the first chord. -1 = no change left.
export function nextChange(keys, cur) {
  var n = keys ? keys.length : 0;
  if (!n) return -1;
  if (cur < 0) return 0;
  for (var j = cur + 1; j < n; j++) if (keys[j] !== keys[cur]) return j;
  return -1;
}
// Seconds left until step j starts, when step cur started `since` seconds ago (bars = step lengths in bars).
export function secsToChange(bars, cur, j, barSec, since) {
  if (j < 0) return Infinity;
  var s = 0;
  for (var i = Math.max(0, cur); i < j; i++) s += (bars[i] || 0) * barSec;
  return s - (since || 0);
}
// Brighten? While Play runs: within one beat of the change (bpb beats a bar). With no beat timing (tapping Next, or
// the Kids pads): when the change is the very next step, so the next tap plays it.
export function cueSoon(o) {
  if (!o || o.j < 0) return false;
  if (!o.playing || o.cur < 0) return o.j === o.cur + 1;
  var beat = o.barSec / Math.max(1, o.bpb || 4);
  return secsToChange(o.bars, o.cur, o.j, o.barSec, o.since) <= beat + 0.03;
}
// The whole word that holds text[at] (a mark on a space moves on to the next word; at the end of the line, the last
// word). Returns [start, end) or null for a line with no words.
export function cueWord(text, at, isLetter) {
  var t = String(text || ""), n = t.length, a = Math.max(0, Math.min(n, at | 0));
  var L = isLetter || function (c) { return !/\s/.test(c); };
  while (a < n && /\s/.test(t.charAt(a))) a++;
  if (a >= n) { a = n - 1; while (a >= 0 && /\s/.test(t.charAt(a))) a--; if (a < 0) return null; }
  var s = a, b = a + 1;
  while (s > 0 && L(t.charAt(s - 1))) s--;
  while (b < n && L(t.charAt(b))) b++;
  return [s, b];
}
// The uploaded song (Expert card): which shown row and word gets the cue. M = the line map (lyrics.js upLyrMap:
// seq {si, rep, li}, at[step]), idx = the card's first row (seq index), n = rows shown, events = U.events
// ({si, ci} per step), names[step] = the chord name shown for that step, cur = the current step, lines(si, rep) = that
// pass's lyric lines. Returns { j, k (row), a, b (word in that line's text), chord } or null.
export function songCue(M, idx, n, events, names, cur, lines) {
  var j = nextChange(names, cur);
  if (j < 0 || !M || !M.at || !events || !events[j]) return null;
  var k = M.at[j] - idx;
  if (!(k >= 0 && k < n)) return null;   // the change is on a line not shown yet
  var ent = M.seq[M.at[j]], ev = events[j];
  var line = ent && ent.li >= 0 ? (lines(ent.si, ent.rep) || [])[ent.li] : null;
  if (!line || !line.text) return null;   // a chord-only row already lists the chords
  var m = null;
  (line.markers || []).forEach(function (x) { if (!m && x.chordIndex === ev.ci) m = x; });
  if (!m) return null;   // the change falls between words (no mark on this line)
  var w = cueWord(line.text, m.charIndex);
  return w ? { j: j, k: k, a: w[0], b: w[1], chord: names[j] } : null;
}
// Split a line into spans: ranges = [{a, b, cls}] (sorted by a; the caller drops any that overlap). Returns
// [{t, cls}] pieces in order (cls "" for plain text).
export function cuePieces(text, ranges) {
  var t = String(text || ""), out = [], q = 0;
  (ranges || []).slice().sort(function (x, y) { return x.a - y.a; }).forEach(function (r) {
    if (r.a < q || r.b <= r.a) return;
    if (r.a > q) out.push({ t: t.slice(q, r.a), cls: "" });
    out.push({ t: t.slice(r.a, r.b), cls: r.cls });
    q = r.b;
  });
  if (q < t.length) out.push({ t: t.slice(q), cls: "" });
  return out;
}
// When the current step started (performance.now ms), per display; the clock restarts whenever the step changes.
export function cueClock(c, cur, nowMs) {
  if (c.cur !== cur) { c.cur = cur; c.t = nowMs; }
  return (nowMs - c.t) / 1000;
}
// Place the name tag (an absolutely positioned child of host) centred above the cue word, its bottom on the word's
// letter tops (so on the next line it sits in the gap between the two lines), kept inside the host and clear of the
// sung word (avoid = that element, e.g. the gold word on the line above).
export function placeCueTag(host, word, tag, avoid) {
  if (!host || !tag) return;
  if (!word) { tag.hidden = true; return; }
  var hr = host.getBoundingClientRect(), wr = word.getBoundingClientRect(), row = word.closest("[data-cue-row]");
  var vis = row ? row.getBoundingClientRect() : wr;
  if (!wr.width || wr.right < vis.left + 4 || wr.left > vis.right - 4) { tag.hidden = true; return; }   // slid out of view
  tag.hidden = false;
  var fs = parseFloat(getComputedStyle(word).fontSize) || 14, tw = tag.offsetWidth, th = tag.offsetHeight;
  var cx = Math.max(wr.left, vis.left) + (Math.min(wr.right, vis.right) - Math.max(wr.left, vis.left)) / 2;
  var x = cx - tw / 2 - hr.left, y = wr.top + (wr.height - fs) / 2 + fs * 0.12 - th - hr.top;
  if (avoid) {
    var ar = avoid.getBoundingClientRect();
    if (ar.width && ar.bottom - hr.top > y + 1 && ar.top - hr.top < y + th - 1 && ar.right - hr.left > x && ar.left - hr.left < x + tw)
      x = ar.right - hr.left + tw + 2 <= wr.right - hr.left + tw / 2 ? ar.right - hr.left + 2 : ar.left - hr.left - tw - 2;
  }
  x = Math.max(2, Math.min(hr.width - tw - 2, x)); y = Math.max(0, y);
  tag.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
}

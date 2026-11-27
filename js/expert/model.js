// Expert screen set: pure logic (no DOM). Unit-tested in tests/unit/expert.test.js.
// Mode switch (Kids / Simple / Expert), the Type bar (one tap opens / folds the chord-type table),
// the merged Song | Progressions control, and the labels the Expert screen shows.

export const EXPERT_STORE = "touchChord.expert.v1";   // separate from touchChord.settings.v1 (state.js is not touched)

// ---- Expert preference (on / look) ----
export function expertDefaults() { return { v: 1, on: false, look: "auto" }; }   // rd6: Auto is the default look (was Lamp, decision 1); a saved "day" / "lamp" is kept
export function sanitizePref(raw) {
  var d = expertDefaults();
  if (!raw || typeof raw !== "object") return d;
  return { v: 1, on: typeof raw.on === "boolean" ? raw.on : d.on, look: raw.look === "day" || raw.look === "lamp" ? raw.look : "auto" };
}
export function parsePref(str) { try { return sanitizePref(JSON.parse(str)); } catch (e) { return expertDefaults(); } }
// ?expert=1 / ?expert=0 in the URL turns Expert on / off (and is saved like a tap on the mode switch).
export function prefFromUrl(search, pref) {
  var m = /[?&]expert=([01])(&|$)/.exec(search || "");
  if (!m) return pref;
  return Object.assign({}, pref, { on: m[1] === "1" });
}

// ---- Mode switch ----
// The screen the app shows: Kids style = Kids; Simple switch on = Simple; else Expert when the pref is on;
// else the classic Full screen (kept for the existing suites and for anyone who never picks Expert).
export function modeOf(s) {
  // One Kids / Simple / Expert switch for the merged build (redesign-dev):
  //   kids   = the Kids view (kids-build: settings expert === false, html.kv)
  //   simple = the classic app in Simple
  //   expert = the Expert screen set (html.expert; pref on, not Simple, not the Kids style)
  //   full   = the classic full app (saved setups from before the redesign; no switch button is lit)
  if (s.kv) return "kids";
  if (s.simple) return "simple";
  return s.on ? "expert" : "full";   // rd4: a saved Expert setup with the Kids style is Expert (it falls back to Pop: expertStyleFix)
}
// What a tap on the mode switch changes. lastStyle = the last non-Kids style (Pop when none).
// Returns { kv: <Kids view on>, style: <style to pick or null>, simple: <bool or null = unchanged>, on: <Expert pref> }.
// The Kids view picks the Kids style itself (kids/view.js enter), so "kids" leaves style and Simple alone.
// rd4: Expert has no Kids style; a saved Expert setup with style Kids loads as Pop (null = nothing to fix)
export function expertStyleFix(s) { return !s.kv && (s.simple ? !s.classic : s.on) && s.style === "kids" ? "pop" : null; }   // rd6: Simple has no Kids style either (s.classic = the test-only legacy screens)
// rd6: the classic Full layout is gone. A setup that would open it (a saved Full setup, or a reset outside Simple) opens
// Expert; s.classic = the test-only legacy screens (?test=1&classic=1, kept for the sound-equivalence suites).
export function fullToExpert(s) { return !s.classic && modeOf(s) === "full"; }
// rd6: which chart of an uploaded song plays: Simple = the easy chart ("simple"), Expert = the Full chart ("full");
// a song with one chart plays it everywhere (null = leave it).
export function chartFor(mode, two) { if (!two) return null; return mode === "expert" ? "full" : mode === "simple" ? "simple" : null; }
export function modeTarget(cur, target, lastStyle) {
  var back = lastStyle && lastStyle !== "kids" ? lastStyle : "pop";
  if (target === "kids") return { kv: true, style: null, simple: null, on: false };
  if (target === "simple") return { kv: false, style: cur.style === "kids" ? back : null, simple: true, on: false };
  return { kv: false, style: cur.style === "kids" ? back : null, simple: false, on: true };   // expert
}

// ---- Type bar (decision 2: no Fold button; one tap opens / folds the 4x2 table) ----
// Optional hold-to-peek (mockup h note): holding the closed bar 0.3 s opens it; letting go folds it back,
// but only once no chord type is still held (so you can slide onto a type and keep holding).
export const TYPEBAR_HOLD_MS = 300;
export function typeBarInit(open) { return { open: !!open, peek: false, foldWhenFree: false }; }
export function typeBarReduce(s, a, ctx) {
  ctx = ctx || {};
  switch (a) {
    case "tap": return { open: !s.open, peek: false, foldWhenFree: false };
    case "hold": return s.open ? s : { open: true, peek: true, foldWhenFree: false };
    case "release":   // the finger that held the bar came up
      if (!s.peek) return s;
      if (ctx.paletteHeld) return { open: true, peek: true, foldWhenFree: true };
      return { open: false, peek: false, foldWhenFree: false };
    case "paletteFree":   // the last chord type was let go
      if (s.peek && s.foldWhenFree) return { open: false, peek: false, foldWhenFree: false };
      return s;
    case "close": return { open: false, peek: false, foldWhenFree: false };
    default: return s;
  }
}
export const TYPE_NAMES = { major: "Major", minor: "Minor", sus4: "Sus4", dim: "Dim" };
export const EXT_NAMES = { six: "6", min7: "min7", maj7: "maj7", nine: "9" };
// The Type bar label from the palette holds ({ pointerId: { kind: "type" | "ext", value } }).
// Nothing held: "Auto" (a key plays its own chord in the key, kb-fix rule); held: what the held buttons add.
export function typeBarLabel(holds) {
  var types = [], exts = [];
  Object.keys(holds || {}).forEach(function (id) {
    var h = holds[id];
    if (!h) return;
    if (h.kind === "type" && TYPE_NAMES[h.value] && types.indexOf(h.value) < 0) types.push(h.value);
    if (h.kind === "ext" && EXT_NAMES[h.value] && exts.indexOf(h.value) < 0) exts.push(h.value);
  });
  if (!types.length && !exts.length) return { text: "Auto", held: false };
  var t = types.length ? TYPE_NAMES[types[types.length - 1]] : "";   // the last held type wins (palette.js syncPalette)
  var e = ["six", "min7", "maj7", "nine"].filter(function (k) { return exts.indexOf(k) >= 0; }).map(function (k) { return EXT_NAMES[k]; });
  return { text: [t].concat(e).filter(Boolean).join(" + "), held: true };
}

// ---- Song | Progressions (decision 8: one control, one mode shows at a time) ----
// s = { view: "song" | "prog", listOpen }. ctx = { hasSong, songSelected }.
// Returns { s, fx } where fx is one of null, "openLibrary", "selectSong", { pick: i }.
export function sourceInit(ctx) { return { view: ctx && ctx.songSelected ? "song" : "prog", listOpen: false }; }
export function sourceReduce(s, a, ctx) {
  ctx = ctx || {};
  var type = typeof a === "string" ? a : a.type;
  switch (type) {
    case "tapSong":
      if (s.view === "song") return { s: { view: "song", listOpen: false }, fx: "openLibrary" };   // tap the active Song tab = the library (Load + Upload)
      if (!ctx.hasSong) return { s: { view: s.view, listOpen: false }, fx: "openLibrary" };   // no song yet: the library; a load switches to Song (sync)
      return { s: { view: "song", listOpen: false }, fx: ctx.songSelected ? null : "selectSong" };
    case "tapProg":
      if (s.view === "prog") return { s: { view: "prog", listOpen: !s.listOpen }, fx: null };
      return { s: { view: "prog", listOpen: true }, fx: null };   // the song keeps playing until a progression is picked
    case "tapBar": return { s: { view: s.view, listOpen: s.view === "prog" ? !s.listOpen : false }, fx: null };
    case "pick": return { s: { view: "prog", listOpen: false }, fx: { pick: a.i } };
    case "close": return { s: { view: s.view, listOpen: false }, fx: null };
    case "sync":   // the app changed the selection elsewhere (a song was loaded / opened, or a progression picked)
      if (ctx.songSelected && s.view !== "song") return { s: { view: "song", listOpen: false }, fx: null };
      if (!ctx.songSelected && s.view === "song" && ctx.hasSong) return { s: { view: "prog", listOpen: s.listOpen }, fx: null };
      return { s: s, fx: null };
    default: return { s: s, fx: null };
  }
}
// Step dots under the progression name: gold = now, dashed teal = next.
export function progDots(n, cur) {
  var out = [];
  for (var i = 0; i < n; i++) out.push(i === cur ? "now" : (cur < 0 ? i === 0 : i === (cur + 1) % n) ? "next" : "");
  return out;
}
// The lyric line for the current chord of an uploaded section: { before, word, after } (word = the word at the
// current chord's marker, shown on gold). sec = { lyrics: [{ text, markers: [{ charIndex, chordIndex }] }] }.
export function lyricNow(sec, ci) {
  var lines = (sec && sec.lyrics) || [];
  if (!lines.length) return null;
  var c = Math.max(0, ci), line = null, mk = null;
  lines.forEach(function (ln) { if (!line) (ln.markers || []).forEach(function (m) { if (!mk && m.chordIndex === c) { line = ln; mk = m; } }); });
  if (!line) lines.forEach(function (ln) { (ln.markers || []).forEach(function (m) { if (m.chordIndex <= c) { line = ln; mk = m; } }); });
  if (!line) { line = lines[0]; mk = null; }
  var t = String(line.text || "");
  if (!mk) return { before: "", word: "", after: t };
  var a = Math.max(0, Math.min(t.length, mk.charIndex | 0)), b = a;
  while (b < t.length && !/\s/.test(t.charAt(b))) b++;
  return { before: t.slice(0, a), word: t.slice(a, b), after: t.slice(b) };
}
// v3.2 UI polish (Uiux P4): the Expert song card shows the line being sung (sung word on the pill) and the next line
// (iPad: the next two). Rows come from the classic song bar's line map (js/ui/lyrics.js upLyrMap: seq = lines in play
// order {si, rep, li}, at[step] = seq index), so the card can't drift from what plays. Pure: the caller passes
//   M      the map, cur the current step (-1 = not started), n the row count (2 phone, 3 iPad),
//   ci     the current step's chord index in its section (-1 = not started),
//   lines(si, rep) -> that pass's lyric lines, chords(si) -> the section's display chord names (upA(upSym) in the UI),
//   name(si) -> the section name.
// Row kinds: "lyric" {before, word, after} (row 0 only has a word), "text" {text} (a later lyric line),
// "chords" {chords: [{t, on}]} (a section with no lyric line here), "empty" (past the last line; keeps its height).
// sec = the section name on a later row when it starts a different section (chord rows always carry it).
export function songCardRows(M, cur, n, ci, lines, chords, name) {
  var at = M && M.at ? M.at[cur >= 0 ? cur : 0] : undefined;
  var idx = at == null ? 0 : at, rows = [];
  for (var k = 0; k < n; k++) {
    var ent = M && M.seq ? M.seq[idx + k] : null, prev = k > 0 && M && M.seq ? M.seq[idx + k - 1] : null;
    if (!ent) { rows.push({ kind: "empty" }); continue; }
    var line = ent.li >= 0 ? (lines(ent.si, ent.rep) || [])[ent.li] : null;
    var sec = k > 0 && (!line || (prev && prev.si !== ent.si)) ? name(ent.si) : null;
    if (line) {
      if (k === 0) {
        var ly = lyricNow({ lyrics: [line] }, ci);
        // AI charts sometimes put a lyric mark on the space before a word, or on the trailing space after the last
        // word. Highlight the next word (or the last one if the line ends here), rather than an invisible space.
        if (!ly.word && ly.before) {
          var text = String(line.text || ""), a = ly.before.length, b = a;
          while (a < text.length && /\s/.test(text.charAt(a))) a++;
          if (a === text.length) { a = b; while (a > 0 && /\s/.test(text.charAt(a - 1))) a--; while (a > 0 && !/\s/.test(text.charAt(a - 1))) a--; }
          b = a; while (b < text.length && !/\s/.test(text.charAt(b))) b++;
          ly = { before: text.slice(0, a), word: text.slice(a, b), after: text.slice(b) };
        }
        rows.push({ kind: "lyric", before: ly.before, word: ly.word, after: ly.after, si: ent.si });
      }
      else rows.push({ kind: "text", text: String(line.text || ""), sec: sec, si: ent.si });
    } else {
      var names = chords(ent.si) || [];
      rows.push({ kind: "chords", chords: names.map(function (t, i) { return { t: t, on: k === 0 && ci >= 0 && i === ci }; }), sec: sec, si: ent.si });
    }
  }
  return { idx: idx, rows: rows };
}
// N20 2026-11-17 (Vinh): a later row's section name is a caption line of its own just above that row ("Chorus", no
// " ·"), never inline. capLayout(rows, free) -> the items to draw in order: {cap: name} before a row that starts a new
// section, and {row, k} (k = index in rows, for "cur" / the cue). The card never grows: a caption takes one row slot
// (the last rows drop), except that `free` (Expert phones, where the hidden title's line is free) holds one caption.
// No name (empty) = no caption line.
//
// 2-row boxes (Vinh 2026-11-17 1:19 PM, N20-SPEC): the caption never sits alone in the last row, so a new section's
// first line always stays on screen. `head` = the section name when row 0 (the current line) starts a new section
// (cardHead). Unless `free` holds a caption: before the switch [current, the new section's first line] (no caption
// yet); on that first line [caption, current] (the look-ahead line waits one step); otherwise [current, next].
// Priority is in that order, so a one-line section (it starts and ends a section) keeps the look-ahead and shows no caption.
// The current line is never dropped. 3+ rows and `free` keep the layout below.
export function capLayout(rows, free, head) {
  if (rows.length === 2 && !free) return head && !rows[1].sec ? [{ cap: String(head) }, { row: rows[0], k: 0 }] : [{ row: rows[0], k: 0 }, { row: rows[1], k: 1 }];
  var out = [], caps = 0, n = 0;
  rows.forEach(function (r, k) { if (r.sec) { out.push({ cap: String(r.sec) }); caps++; } out.push({ row: r, k: k }); n++; });
  while (out.length && n + Math.max(0, caps - (free ? 1 : 0)) > rows.length) { if (out.pop().cap != null) caps--; else n--; }
  return out;
}
// The section name when the line at card index idx starts a new section (the line before it is another section), else
// null. Pure: M = the line map (upLyrMap), name(si) -> the section name. The song's very first line isn't a "switch".
export function cardHead(M, idx, name) {
  var ent = M && M.seq ? M.seq[idx] : null, prev = M && M.seq && idx > 0 ? M.seq[idx - 1] : null;
  return ent && prev && prev.si !== ent.si ? (name(ent.si) || null) : null;
}
// Style drop-down (decision 6): each style with a short sound hint.
// rd4: no Kids here - the Kids / Simple / Expert switch is the only way into Kids (the classic style chips keep Kids)
export const STYLE_MENU = [
  ["pop", "Pop", "bright triads"], ["jazz", "Jazz", "7ths, 9ths"], ["rnb", "R&B", "smooth 9ths"],
  ["ballad", "Ballad", "slow, add9"], ["reggae", "Reggae", "off-beat"], ["funk", "Funk", "tight 9ths"], ["yogaDeep", "Yoga", "sus2 drone"],
  ["country", "Country", "I IV V7"], ["lofi", "Lofi", "dusty 9ths"]
];
export function styleName(id) { for (var i = 0; i < STYLE_MENU.length; i++) if (STYLE_MENU[i][0] === id) return STYLE_MENU[i][1]; return id; }
// The docked piano window in Expert (decision 10): C..B = 12 keys, 7 white keys (classic Full keeps its 13-key window).
export function expertWindowKeys(layout) { return layout === "octave" || layout === "piano" ? 12 : 0; }

// Expert's Play key only. Playing shows a stop square; paused, idle, and a song that has
// finished show the play triangle again. The words stay playButtonLabel (Play song / Pause / Resume).
export function expertPlayFace(transportState) {
  var playing = transportState === "playing";
  return { glyph: playing ? "\u25a0" : "\u25b6", stop: playing };
}

// A menu or sheet is a popover. It sits in the measured band between the top bar and the piano,
// may cover the content under it, and must not cover the piano or a keep-clear control (the opener,
// and anything else the caller passes). When the content is taller than that room, maxHeight is the
// room and the caller scrolls inside the popover. Sizes come from the rects; nothing here is a
// fixed panel height. rects are {left, top, right, bottom}.
// o: { anchor, bandTop, bandBottom, viewW, width, height, align, keepClear, tol, edge, lockX, lockLeft }
export function fitPopover(o) {
  var tol = o.tol == null ? 6 : o.tol;
  var edge = o.edge || 0;
  var viewW = o.viewW;
  var width = o.width > 0 ? o.width : 0;
  var height = o.height > 0 ? o.height : 0;
  var bandTop = o.bandTop;
  var bandBottom = o.bandBottom > bandTop ? o.bandBottom : bandTop;
  var anchor = o.anchor || { left: 0, right: 0, top: bandTop, bottom: bandTop };
  var keep = o.keepClear || [];
  var left = o.lockX ? o.lockLeft : (o.align === "end"
    ? anchor.right - width
    : o.align === "center" ? (anchor.left + anchor.right - width) / 2 : anchor.left);
  if (!o.lockX) {
    if (width > viewW - 2 * edge) width = Math.max(0, viewW - 2 * edge);
    if (left < edge) left = edge;
    if (left + width > viewW - edge) left = Math.max(edge, viewW - edge - width);
  }
  function xOver(rect) { return Math.min(left + width, rect.right) - Math.max(left, rect.left); }
  function hits(top, bottom, rect) {
    return xOver(rect) > tol && Math.min(bottom, rect.bottom) - Math.max(top, rect.top) > tol;
  }
  var tops = [bandTop];
  if (anchor.bottom > bandTop && anchor.bottom < bandBottom) tops.push(anchor.bottom);
  for (var i = 0; i < keep.length; i++) {
    var b = keep[i].bottom;
    if (b > bandTop && b < bandBottom) tops.push(b);
  }
  tops.sort(function (a, c) { return a - c; });
  var uniq = [], t;
  for (i = 0; i < tops.length; i++) {
    t = tops[i] < bandTop ? bandTop : tops[i];
    if (t >= bandBottom) continue;
    if (!uniq.length || t - uniq[uniq.length - 1] > 0.5) uniq.push(t);
  }
  function limitOf(top) {
    var limit = bandBottom, j, k;
    for (j = 0; j < keep.length; j++) {
      k = keep[j];
      if (xOver(k) > tol && k.top >= top - 0.5 && k.top < limit) limit = k.top;
    }
    return limit;
  }
  var anchorAt = anchor.bottom > bandTop ? anchor.bottom : bandTop;
  var best = null, top, limit, room, blocked, cand, j;
  for (i = 0; i < uniq.length; i++) {
    top = uniq[i];
    limit = limitOf(top);
    room = limit - top;
    if (room <= tol) continue;
    blocked = false;
    for (j = 0; j < keep.length; j++) if (hits(top, limit, keep[j])) { blocked = true; break; }
    if (blocked) continue;
    cand = { top: top, maxHeight: room, fits: room + 0.5 >= height };
    if (!best || prefers(cand, best, anchorAt)) best = cand;
  }
  if (!best) best = { top: bandTop, maxHeight: bandBottom - bandTop };
  var topOut = Math.ceil(best.top - 1e-6);
  var maxH = Math.floor(best.maxHeight - (topOut - best.top));
  if (topOut + maxH > bandBottom) maxH = Math.floor(bandBottom - topOut);
  if (maxH < 0) maxH = 0;
  return { left: Math.round(left), top: topOut, width: Math.round(width), maxHeight: maxH };
}
function prefers(a, b, anchorAt) {
  if (a.fits !== b.fits) return a.fits;
  if (a.fits) return Math.abs(a.top - anchorAt) < Math.abs(b.top - anchorAt);
  if (Math.abs(a.maxHeight - b.maxHeight) > 1) return a.maxHeight > b.maxHeight;
  return Math.abs(a.top - anchorAt) < Math.abs(b.top - anchorAt);
}

// Kids piano range (pure: no DOM). The visible keyboard covers every melody pitch
// the gold guide asks the child to play, including today's C4..B4 octave when the melody is narrower than an octave, so
// the seven pad-chord tones can light, with edges snapped out to white keys.
export const KIDS_HOME_LO = 60;   // C4
export const KIDS_HOME_HI = 71;   // B4
export const KIDS_HOME_MIDI = 60; // home-dot key
export const KIDS_MIN_WHITE_PX = 34;
export const KIDS_KEY_GAP = 2;
// 360-wide portrait piano inner width is ~344px (measured). 9 whites fit at ~36px,
// which is Head Shoulders' full C4..D5 keyboard; 10 would drop below 34px.
export const KIDS_MAX_VISIBLE_WHITES = 9;

const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];
function w12(n) { return ((n % 12) + 12) % 12; }
export function isWhiteMidi(m) { return WHITE_PC.indexOf(w12(m)) >= 0; }
export function snapLo(m) { m = +m; while (!isWhiteMidi(m)) m--; return m; }
export function snapHi(m) { m = +m; while (!isWhiteMidi(m)) m++; return m; }

export function rangeInfo(lo, hi) {
  var w = 0, b = 0, m;
  for (m = lo; m <= hi; m++) { if (isWhiteMidi(m)) w++; else b++; }
  return { lo: lo, hi: hi, whites: w, blacks: b, count: hi - lo + 1 };
}

export function kidsWhiteMidis(lo, hi) {
  var out = [], m;
  for (m = lo; m <= hi; m++) if (isWhiteMidi(m)) out.push(m);
  return out;
}

// Melody pitches of a song: tonic MIDI + each step's @melody (or the chord root relative to the tonic).
export function kidsNeededMidis(steps, tonic) {
  var out = [], seen = {};
  (steps || []).forEach(function (st) {
    var it = st && st.item, mel = it && it.mel;
    if (mel == null && it && it.rootPc != null) mel = w12(it.rootPc - w12(tonic));
    if (mel == null) return;
    var m = tonic + mel;
    if (!seen[m]) { seen[m] = 1; out.push(m); }
  });
  return out.sort(function (a, b) { return a - b; });
}

// min/max of melody pitches, edges snapped to white keys. If the melody already
// spans at least an octave (>= 12 semitones), keep that range (do not pad Itsy
// Bitsy or Happy Birthday from G3–G4 out to B4). A narrower melody still unions
// with C4..B4 so one-octave songs keep a full octave of keys.
export function kidsPianoRange(midis) {
  var xs = (midis && midis.length) ? midis.slice() : [];
  var span = xs.length ? Math.max.apply(null, xs) - Math.min.apply(null, xs) : 0;
  if (!xs.length || span < 12) xs.push(KIDS_HOME_LO, KIDS_HOME_HI);
  var lo = snapLo(Math.min.apply(null, xs)), hi = snapHi(Math.max.apply(null, xs));
  return rangeInfo(lo, hi);
}

export function kidsMaxVisibleWhites(innerWidth, minPx, gap) {
  minPx = minPx == null ? KIDS_MIN_WHITE_PX : minPx;
  gap = gap == null ? KIDS_KEY_GAP : gap;
  var n = Math.floor((innerWidth + gap) / (minPx + gap));
  return Math.max(1, n);
}

export function kidsWhiteKeyWidth(nWhite, innerWidth, gap) {
  gap = gap == null ? KIDS_KEY_GAP : gap;
  if (!(nWhite > 0)) return innerWidth;
  return (innerWidth - gap * Math.max(0, nWhite - 1)) / nWhite;
}

// Layout for a range: shrink-to-fit when the keys stay at or above minPx (or clamp is off).
// When clamp is on and the span would make whites narrower than minPx, keep a max visible
// window of keys at >= minPx and return a scrollLeft that keeps goldMidi in view.
// The full lo..hi range is unchanged (notes are never transposed).
export function kidsPianoLayout(range, opts) {
  opts = opts || {};
  var inner = opts.innerWidth != null ? opts.innerWidth : 344;
  var gap = opts.gap != null ? opts.gap : KIDS_KEY_GAP;
  var minPx = opts.minPx != null ? opts.minPx : KIDS_MIN_WHITE_PX;
  var lo = range.lo, hi = range.hi, whites = kidsWhiteMidis(lo, hi);
  var n = whites.length, maxVis = kidsMaxVisibleWhites(inner, minPx, gap);
  var clamp = !!opts.clamp && n > maxVis;
  var vis = clamp ? maxVis : n;
  var whiteW = kidsWhiteKeyWidth(vis, inner, gap);
  var content = n * whiteW + gap * Math.max(0, n - 1);
  var scrollMax = Math.max(0, content - inner), scrollLeft = 0;
  if (clamp) {
    var g = opts.goldMidi;
    var gi = 0, i, x;
    if (g != null) {
      for (i = 0; i < n; i++) if (whites[i] <= g) gi = i;
    }
    var goldX = gi * (whiteW + gap), goldW = isWhiteMidi(g != null ? g : whites[gi]) ? whiteW : whiteW * 0.56;
    if (g != null && !isWhiteMidi(g)) goldX = gi * (whiteW + gap) + whiteW - goldW / 2;
    if (goldX < 0) scrollLeft = 0;
    else if (goldX + goldW > inner) scrollLeft = Math.min(scrollMax, goldX + goldW - inner);
    else scrollLeft = 0;
    if (goldX - scrollLeft < 0) scrollLeft = Math.max(0, goldX);
    if (goldX + goldW - scrollLeft > inner) scrollLeft = Math.min(scrollMax, goldX + goldW - inner);
  }
  var first = 0;
  if (clamp && scrollLeft > 0) {
    first = Math.round(scrollLeft / (whiteW + gap));
    if (first < 0) first = 0;
    if (first > n - vis) first = Math.max(0, n - vis);
  }
  return {
    lo: lo, hi: hi, whites: n, blacks: range.blacks, count: range.count,
    clamp: clamp, scroll: clamp, scrollLeft: scrollLeft, scrollMax: scrollMax,
    whiteW: whiteW, inner: inner, content: content, visibleWhites: vis,
    viewLo: whites[first], viewHi: whites[Math.min(n, first + vis) - 1]
  };
}

// Major triad stacked up from the pad root in the C4 octave (same as a Kids pad).
export function kidsPadTriadMidis(rootPc, homeLo) {
  var root = (homeLo == null ? KIDS_HOME_LO : homeLo) + w12(rootPc);
  return [root, root + 4, root + 7];
}

// Which of a pad's triad tones can light on a piano that has these key midis (exact pitch, no transpose).
export function kidsPadLitMidis(rootPc, keyMidis, homeLo) {
  var have = {};
  (keyMidis || []).forEach(function (m) { have[m] = 1; });
  return kidsPadTriadMidis(rootPc, homeLo).filter(function (m) { return have[m]; });
}

export function isKidsHomeKey(midi) { return midi === KIDS_HOME_MIDI; }

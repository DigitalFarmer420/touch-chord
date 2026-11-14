// rd17 (Uiux): the Kids song list is a scrolling grid. When every card fits, every card shows at its usual height; when
// more songs than fit are listed, the row height is picked so whole rows fill the screen and the next row peeks in by
// about a third of a card (PEEK), so a child sees there is more below. Pictures and titles keep their sizes (only the
// card height moves, between lo and hi). Pure: kids/view.js measures the screen and applies the result.
export const PEEK = 0.33;
// Per layout: lo = smallest card that still holds the picture + title, tgt = the usual card height, hi = tallest.
export const KIDS_ROWS = {
  "phone-port": { lo: 150, tgt: 204, hi: 236 },
  "phone-land": { lo: 100, tgt: 128, hi: 150 },
  "pad-port": { lo: 200, tgt: 260, hi: 320 },
  "pad-land": { lo: 200, tgt: 290, hi: 330 }
};
// H = the height from the top of the first row to the bottom of the list's view; n cards in cols columns, gap g.
// Returns { r: row height (px), full: whole rows in view, peek: the part of the next row in view (0 = all fit) }.
export function kidsRowPlan(H, n, cols, g, sz) {
  var rows = Math.ceil(n / Math.max(1, cols)), lo = sz.lo, tgt = sz.tgt, hi = sz.hi;
  if (rows <= 0) return { r: tgt, full: 0, peek: 0 };
  if (rows * tgt + (rows - 1) * g <= H) return { r: tgt, full: rows, peek: 0 };
  var all = (H - (rows - 1) * g) / rows;
  if (all >= lo) return { r: Math.floor(all), full: rows, peek: 0 };
  var best = null;
  for (var k = 1; k < rows; k++) {
    var r = (H - k * g) / (k + PEEK);
    if (r < lo || r > hi) continue;
    if (!best || Math.abs(r - tgt) < Math.abs(best.r - tgt)) best = { r: r, full: k };
  }
  if (!best) best = { r: Math.max(lo, Math.min(hi, (H - g) / (1 + PEEK))), full: 1 };
  var rr = Math.floor(best.r);
  return { r: rr, full: best.full, peek: Math.round(((H - best.full * (rr + g)) / rr) * 100) / 100 };
}
// v3.2 UI polish: the Kids pad's screen-reader label says what a tap plays. A pad plays its major chord, but the gold
// (next) pad in play-along plays the song's single melody note (next.js kidsGoldGo -> magicAdvance), not a chord.
export function kidsPadLabel(letter, next) { return next ? letter + ", next: plays the song note" : letter + ", major chord"; }

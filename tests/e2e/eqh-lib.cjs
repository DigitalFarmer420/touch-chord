// rd13: equal-height audit. In the page: every visible control (a segment / radio group counts as one control) and the
// controls that sit side by side with it (vertical overlap >= 60% of the taller one, horizontal gap 0..24px, nothing
// between). Returns the rows (chains of neighbours) whose heights differ by more than tol px.
module.exports = function eqhAudit(opt) {
  opt = opt || {}; var tol = opt.tol == null ? 1 : opt.tol, GAP = opt.gap || 24;
  var SKIP = '#pads, #pads *, #suggest *, #kvPads *, .kv-pads *, #xPList .x-prow *, #dev-badge, .x-note, #howto *, .ht-shot, html.simple #songBar';   // rd15: Simple's song strip is a display (no tap action in Simple)
  // N20 PR-A: Simple phone portrait pairs the whole song picker (#prog) with the whole key control (#kidKey), and
  // Sustain with the NOW card + volume stack it spans (see FL_STACK below).
  var FL = 'html.simple.lay-phone-port:not(.expert):not(.kv) ';
  var UNIT = '.seg, .x-seg, [role=radiogroup], [role=tablist], .ms-seg, .ms-pair, ' + FL + '#prog, ' + FL + '#kidKey';   // rd14: + .x-seg (the Song | Progressions track)
  var SEL = 'button, select, [role=button], input[type=text], input[type=search], .now-card, ' + UNIT + (opt.extra ? ', ' + opt.extra : '');
  function vis(e) { if (!e.getClientRects().length) return false; if (e.closest('[hidden]')) return false; var cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false; for (var x = e; x && x.nodeType === 1; x = x.parentElement) { var c = getComputedStyle(x); if (+c.opacity < 0.05) return false; } return true; }
  function name(e) { var t = (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22);
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (t ? ' "' + t + '"' : ''); }
  // rd15: a control behind an open sheet's dim layer is not in a row with the sheet's controls (it cannot be tapped)
  var DIM = '.ms-dim, .ms-cdim, #xScrim:not(.x-clear)';   // the sheet's dim and the Start over confirm's dim
  // N20 PR-A: a page control under an open modal sheet's panel (not only its dim) is behind it too.
  function behindDim(e) { var r = e.getBoundingClientRect(), c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!c || e.contains(c)) return false;
    if (c.closest(DIM)) return true; var m = c.closest('[aria-modal="true"]'); return !!(m && !m.contains(e)); }
  var all = Array.prototype.filter.call(document.querySelectorAll(SEL), function (e) { return !e.matches(SKIP) && vis(e) && !behindDim(e); });
  var units = all.filter(function (e) { var u = e.parentElement && e.parentElement.closest(UNIT); return !(u && all.indexOf(u) >= 0); });
  // a control that only wraps other controls (a bar) is not itself a control in the row
  units = units.filter(function (e) { return !units.some(function (o) { return o !== e && e.contains(o); }) || e.matches(UNIT); });
  // rd14: the outer box (a visible outline counts, e.g. a segment track's ring), not only the border box
  // N20 PR-A: in Simple phone portrait the NOW card and the volume row under it are one stack beside Sustain.
  var FL_STACK = document.querySelector(FL + '#nowMix');
  function outer(e) { var r = e.getBoundingClientRect(), cs = getComputedStyle(e), o = cs.outlineStyle !== 'none' ? Math.max(0, parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset)) : 0;
    if (FL_STACK && e.matches(FL + '.now-card') && FL_STACK.getClientRects().length) { var v = FL_STACK.getBoundingClientRect(); r = { left: Math.min(r.left, v.left), right: Math.max(r.right, v.right), top: Math.min(r.top, v.top), bottom: Math.max(r.bottom, v.bottom) }; r.width = r.right - r.left; r.height = r.bottom - r.top; }
    return { left: r.left - o, right: r.right + o, top: r.top - o, bottom: r.bottom + o, width: r.width + 2 * o, height: r.height + 2 * o }; }
  var R = units.map(function (e) { var r = outer(e); return { e: e, l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height, w: r.width }; })
    .filter(function (x) { return x.h >= 16 && x.w >= 16 && x.b > 0 && x.t < innerHeight && x.r > 0 && x.l < innerWidth; });
  function ov(a, b) { return Math.min(a.b, b.b) - Math.max(a.t, b.t); }
  var nb = R.map(function () { return []; });
  R.forEach(function (a, i) { R.forEach(function (b, j) { if (j <= i) return;
    var o = ov(a, b); if (o < 0.6 * Math.max(a.h, b.h)) return;
    var L = a.r <= b.l + 1 ? a : b.r <= a.l + 1 ? b : null; if (!L) return; var Rr = L === a ? b : a, gap = Rr.l - L.r; if (gap < -1 || gap > GAP) return;
    if (R.some(function (c) { return c !== a && c !== b && c.l >= L.r - 1 && c.r <= Rr.l + 1 && ov(c, L) > 0 && ov(c, Rr) > 0; })) return;
    if (a.e.contains(b.e) || b.e.contains(a.e)) return;
    nb[i].push(j); nb[j].push(i); }); });
  var seen = {}, rows = [];
  R.forEach(function (a, i) { if (seen[i] || !nb[i].length) return; var q = [i], g = []; seen[i] = 1;
    while (q.length) { var k = q.shift(); g.push(k); nb[k].forEach(function (j) { if (!seen[j]) { seen[j] = 1; q.push(j); } }); }
    g.sort(function (x, y) { return R[x].l - R[y].l; });
    var hs = g.map(function (k) { return R[k].h; }), d = Math.max.apply(null, hs) - Math.min.apply(null, hs);
    rows.push({ d: Math.round(d * 10) / 10, y: Math.round(Math.min.apply(null, g.map(function (k) { return R[k].t; }))), items: g.map(function (k) { return name(R[k].e) + ' ' + Math.round(R[k].h * 10) / 10; }) }); });
  return { rows: rows.length, bad: rows.filter(function (r) { return r.d > tol; }) };
};

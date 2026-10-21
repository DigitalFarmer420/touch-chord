// Band bass lines (bass, sub, walking-bass helpers).
import { bandPc, Band } from "./band.js?v=112.7";
// Bass: sine + a little 2nd (and 3rd) harmonic so phone speakers carry it.
Band.prototype.bass = function (t, midi, dur, v, kind) {
  var ctx = this.audio.ctx, f = 440 * Math.pow(2, (midi - 69) / 12), lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = kind === "upright" ? 900 : kind === "bouncy" ? 1400 : 1000; lp.Q.value = 0.7;
  var g = ctx.createGain(), pk = 0.42 * v, atk = kind === "round" ? 0.012 : 0.005, end = t + dur;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pk, t + atk);
  if (kind === "round") g.gain.setTargetAtTime(pk * 0.55, t + atk, dur * 0.5);
  else g.gain.exponentialRampToValueAtTime(pk * (kind === "upright" ? 0.35 : 0.2), t + Math.max(atk + 0.01, dur * 0.8));
  g.gain.setTargetAtTime(0.0001, end, 0.03);
  lp.connect(g); g.connect(this.bus);
  var parts = kind === "upright" ? [[1, "triangle", 0.8], [2, "sine", 0.3]] : [[1, "sine", 0.85], [2, "sine", 0.32], [3, "triangle", kind === "bouncy" ? 0.12 : 0.06]];
  parts.forEach(function (p) {
    var o = ctx.createOscillator(), a = ctx.createGain();
    o.type = p[1]; o.frequency.value = f * p[0]; a.gain.value = p[2];
    o.connect(a); a.connect(lp); o.start(t); o.stop(end + 0.25);
  });
  this.stats.notes++;
};
// v78: sub bass for Ballad / R&B: fundamental + a touch of 2nd, low-passed at ~240 Hz so it stays out of
// the low-mids (no mud under strings / keys). glideTo: short slide (R&B approach notes).
Band.prototype.sub = function (t, midi, dur, v, atk, glideTo) {
  var ctx = this.audio.ctx, f = 440 * Math.pow(2, (midi - 69) / 12), lp = ctx.createBiquadFilter(), g = ctx.createGain(), pk = 0.5 * v, end = t + dur;
  lp.type = "lowpass"; lp.frequency.value = 240; lp.Q.value = 0.5;
  atk = atk || 0.02;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pk, t + atk);
  g.gain.setTargetAtTime(pk * 0.7, t + atk, Math.max(0.1, dur * 0.6));
  g.gain.setTargetAtTime(0.0001, end, 0.05);
  lp.connect(g); g.connect(this.bus);
  [[1, 1], [2, 0.16]].forEach(function (p) {
    var o = ctx.createOscillator(), a = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f * p[0], t);
    if (glideTo != null) o.frequency.exponentialRampToValueAtTime(440 * Math.pow(2, (glideTo - 69) / 12) * p[0], end);
    a.gain.value = p[1]; o.connect(a); a.connect(lp); o.start(t); o.stop(end + 0.4);
  });
  this.stats.notes++;
};
// Bass register E1..D#2 (40..51) for the root.
export function bandBassMidi(pc) { var m = 36 + pc; return m < 40 ? m + 12 : m; }
export function bandIv(h, cands, dflt) { for (var i = 0; i < cands.length; i++) if (h.pcs[bandPc(h.rootPc + cands[i])]) return cands[i]; return dflt; }

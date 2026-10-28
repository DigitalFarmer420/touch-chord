// Band: drums and groove per style, the beat scheduler.
import { bandBassMidi, bandIv } from "./bass.js?v=112.12";
import { ChordAudio } from "./engine.js?v=112.12";

// ===== v75 Band, STEP ONE: a separate groove layer (bass + drums, Jazz adds soft comping) =====
// Spec: v69/GROOVE-STEP1-SPEC.md (+ amendments). Own gain bus -> limiter -> master Volume (vol), so
// the chord path is untouched. Band 0 (or a style without a band) = no nodes, no timer, no CPU.
// Lookahead scheduler on the audio clock (25 ms tick, 100 ms ahead). The first chord (tap, Next,
// Play song) starts it on beat 1 at that chord's time; later chords change the harmony without
// restarting the beat; ~2 bars after the last chord it fades out and stops.
// Clock (no own tempo): clock() from the app = the selected song's BPM / beats per bar, else the
// Play song bar (PROG_BAR) while it runs, else the Config (style / loop) BPM.
var BAND_STYLES = { pop: true, country: true, jazz: true, kids: true, ballad: true, rnb: true };   // v78: + Ballad, R&B
// Per-style band level, measured (A-weighted) so Band 50 sits ~3 dB under the chords, 100 ~3 dB over.
var BAND_TRIM = { pop: 0.27, country: 0.63, jazz: 0.42, kids: 0.65, ballad: 0.16, rnb: 0.175 };   // v78: Ballad / R&B at 100 <= chord level (measured)
export function bandPc(m) { return ((m % 12) + 12) % 12; }
export function Band(audio) {
  this.audio = audio; this.level = 0; this.style = null;
  this.timer = 0; this.running = false; this.bus = null; this.lim = null;
  this.harm = []; this.lastTouch = -1; this.nextBeat = 0; this.beat = 0; this.fadeAt = 0;
  this.clock = null; this.keepAlive = null; this.peek = null; this.manual = false; this.noiseBuf = null; this.noiseCtx = null;
  this.stats = { started: 0, beats: 0, notes: 0 };
}
Band.prototype.active = function () { return this.level > 0 && !!BAND_STYLES[this.style]; };
Band.prototype.target = function () { return 0.9 * Math.pow(this.level, 1.25) * (BAND_TRIM[this.style] || 0.5); };
Band.prototype.setLevel = function (v) {
  this.level = Math.max(0, Math.min(1, +v || 0));
  if (!this.active()) { this.hush(); return; }   // v104
  if (this.running && !this.fadeAt && this.bus) this.bus.gain.setTargetAtTime(this.target(), this.audio.ctx.currentTime, 0.05);
};
Band.prototype.setStyle = function (s) {
  if (s !== this.style) this.hush();   // v104: a style change stops the Band at once
  this.style = s;
  if (!this.active()) { this.hush(); return; }
  if (this.running && !this.fadeAt && this.bus) this.bus.gain.setTargetAtTime(this.target(), this.audio.ctx.currentTime, 0.05);   // same 50 ms style ramp
};
Band.prototype.ck = function () {
  var c = this.clock ? this.clock() : null;
  return { bpm: Math.max(30, Math.min(260, (c && c.bpm) || this.audio.bpm || 96)), bpb: Math.max(2, Math.min(7, (c && c.bpb) || 4)) };
};
// A chord sounded at time t (midis + bass) -> harmony change; starts the groove if needed.
Band.prototype.touch = function (t, midis, bass) {
  if (!this.active() || !this.audio.ctx || !midis || !midis.length) return;
  var ctx = this.audio.ctx, now = ctx.currentTime;
  t = Math.max(t == null ? now : t, now);
  var root = bass != null ? bass : Math.min.apply(null, midis), pcs = {};
  midis.forEach(function (m) { pcs[bandPc(m)] = true; });
  pcs[bandPc(root)] = true;
  var h = { t: t, rootPc: bandPc(root), pcs: pcs };
  var i = this.harm.length;
  while (i > 0 && this.harm[i - 1].t > t) i--;
  this.harm.splice(i, 0, h);
  while (this.harm.length > 2 && this.harm[1].t < now - 1) this.harm.shift();
  if (this.harm.length > 64) this.harm.shift();
  this.lastTouch = Math.max(this.lastTouch, t);
  if (!this.running) this.start(t);
  else if (this.fadeAt) {   // a chord during the fade: back up, same beat
    this.fadeAt = 0;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.setTargetAtTime(this.target(), now, 0.05);
  }
};
// Re-phase beat 1 (Play song start), only while running.
Band.prototype.resync = function (t) { if (this.running && !this.fadeAt) { this.nextBeat = t; this.beat = 0; } };
Band.prototype.start = function (t) {
  var ctx = this.audio.ctx, self = this;
  this.audio.ensure();
  if (this.noiseCtx !== ctx) {
    var n = Math.floor(ctx.sampleRate), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf; this.noiseCtx = ctx;
  }
  var bus = ctx.createGain(), lim = ctx.createDynamicsCompressor();
  bus.gain.setValueAtTime(0, ctx.currentTime);
  bus.gain.setTargetAtTime(this.target(), ctx.currentTime, 0.02);
  lim.threshold.value = -9; lim.knee.value = 3; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
  bus.connect(lim); lim.connect(this.audio.vol);
  this.bus = bus; this.lim = lim; this.running = true; this.fadeAt = 0;
  this.nextBeat = t; this.beat = 0; this.stats.started++;
  if (!this.manual) this.timer = setInterval(function () { self.tick(); }, 25);
  this.tick();
};
Band.prototype.tick = function (nowArg) {
  if (!this.running) return;
  var ctx = this.audio.ctx, now = nowArg == null ? ctx.currentTime : nowArg, c = this.ck(), spb = 60 / c.bpm, bar = spb * c.bpb;
  if (!this.fadeAt && !(this.keepAlive && this.keepAlive()) && now > this.lastTouch + 2 * bar) {
    this.fadeAt = now + bar * 1.25;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(this.bus.gain.value, now);
    this.bus.gain.setTargetAtTime(0, now, bar / 4);
  }
  if (this.fadeAt && now >= this.fadeAt) { this.kill(); return; }
  if (this.nextBeat < now - 0.25) this.nextBeat = now + 0.05;   // tab slept: carry on from now
  var g = 0;
  while (this.nextBeat < now + 0.1 && g++ < 16) {
    this.playBeat(this.nextBeat, this.beat % c.bpb, c.bpb, spb, Math.floor(this.beat / c.bpb));
    this.nextBeat += spb; this.beat++; this.stats.beats++;
  }
};
Band.prototype.release = function (tau, wait) {
  if (this.timer) { clearInterval(this.timer); this.timer = 0; }
  var bus = this.bus, lim = this.lim, ctx = this.audio.ctx;
  if (bus && tau) { try { var now = ctx.currentTime; bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(bus.gain.value, now); bus.gain.setTargetAtTime(0, now, tau); } catch (e) {} }
  this.bus = this.lim = null; this.running = false; this.fadeAt = 0; this.harm = []; this.lastTouch = -1;
  if (bus) setTimeout(function () { try { bus.disconnect(); lim.disconnect(); } catch (e) {} }, wait);
};
Band.prototype.kill = function () { this.release(0, 400); };   // after the fade: already silent
// v104 (M4): Stop silences the Band at once: no more beats, a 40 ms fade (no click), then the bus
// (and every Band note already scheduled on it) is disconnected.
Band.prototype.hush = function () {
  if (!this.running) return;
  if (this.timer) { clearInterval(this.timer); this.timer = 0; }
  var bus = this.bus, lim = this.lim, ctx = this.audio.ctx;
  if (bus && ctx) { try { var now = ctx.currentTime; bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(bus.gain.value, now); bus.gain.linearRampToValueAtTime(0, now + 0.04); } catch (e) {} }
  this.bus = this.lim = null; this.running = false; this.fadeAt = 0; this.harm = []; this.lastTouch = -1; this.stats.hushed = (this.stats.hushed || 0) + 1;
  if (bus) setTimeout(function () { try { bus.disconnect(); lim.disconnect(); } catch (e) {} }, 120);
};
Band.prototype.stop = function (tau) { if (this.running) this.release(tau, Math.max(80, tau * 6000)); };
Band.prototype.harmAt = function (t) {
  var h = this.harm[0] || null;
  for (var i = 0; i < this.harm.length; i++) if (this.harm[i].t <= t + 0.03) h = this.harm[i];
  return h;
};
// Root pc of the chord that starts within (t, t + span], if known (scheduled or queued).
Band.prototype.nextRootPc = function (t, span, cur) {
  for (var i = 0; i < this.harm.length; i++) if (this.harm[i].t > t + 0.03 && this.harm[i].t <= t + span) return this.harm[i].rootPc;
  var p = this.peek ? this.peek() : null;
  return p == null ? null : p;
};

// --- instruments (all synthesized) ---
Band.prototype.env = function (t, peak, atk, dec, dest) {
  var g = this.audio.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
  g.connect(dest || this.bus);
  return g;
};
Band.prototype.noise = function (t, dur, type, freq, q, peak, atk, dec, dest) {
  var ctx = this.audio.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter();
  s.buffer = this.noiseBuf;
  f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
  var g = this.env(t, peak, atk, dec, dest);
  s.connect(f); f.connect(g);
  s.start(t, Math.random() * 0.5, dur);
  this.stats.notes++;
};
Band.prototype.kick = function (t, v) {
  var ctx = this.audio.ctx, o = ctx.createOscillator(), g = this.env(t, 0.9 * v, 0.004, 0.32);
  o.type = "sine";
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
  o.connect(g); o.start(t); o.stop(t + 0.4);
  this.noise(t, 0.02, "highpass", 2500, 0.7, 0.12 * v, 0.001, 0.015);
};
Band.prototype.snare = function (t, v) {
  var ctx = this.audio.ctx, o = ctx.createOscillator(), g = this.env(t, 0.22 * v, 0.002, 0.09);
  o.type = "triangle"; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
  o.connect(g); o.start(t); o.stop(t + 0.15);
  this.noise(t, 0.25, "bandpass", 1900, 0.8, 0.5 * v, 0.002, 0.16);
};
Band.prototype.brush = function (t, v, len) { this.noise(t, (len || 0.25) + 0.05, "bandpass", 3200, 0.6, 0.16 * v, 0.03, len || 0.2); };
Band.prototype.hat = function (t, v, open) { this.noise(t, open ? 0.35 : 0.08, "highpass", 7500, 0.8, 0.18 * v, 0.001, open ? 0.28 : 0.045); };
Band.prototype.hatFoot = function (t, v) { this.noise(t, 0.06, "bandpass", 6000, 1.2, 0.1 * v, 0.003, 0.04); };
Band.prototype.ride = function (t, v) {
  var ctx = this.audio.ctx;
  this.noise(t, 0.5, "bandpass", 8500, 3, 0.1 * v, 0.001, 0.35);
  [3150, 4620].forEach(function (f, k) {
    var o = ctx.createOscillator(), g = this.env(t, (k ? 0.012 : 0.018) * v, 0.001, 0.5);
    o.type = "square"; o.frequency.value = f; o.connect(g); o.start(t); o.stop(t + 0.6);
  }, this);
};
Band.prototype.clap = function (t, v) {
  for (var k = 0; k < 3; k++) this.noise(t + k * 0.011, 0.03, "bandpass", 1300, 1.1, 0.35 * v, 0.001, 0.012);
  this.noise(t + 0.033, 0.2, "bandpass", 1300, 0.9, 0.3 * v, 0.002, 0.13);
};
Band.prototype.shaker = function (t, v) { this.noise(t, 0.1, "highpass", 6500, 0.7, 0.09 * v, 0.012, 0.05); };
Band.prototype.crossStick = function (t, v) {
  var ctx = this.audio.ctx, o = ctx.createOscillator(), g = this.env(t, 0.1 * v, 0.001, 0.05);
  o.type = "triangle"; o.frequency.value = 820; o.connect(g); o.start(t); o.stop(t + 0.08);
  this.noise(t, 0.05, "bandpass", 2400, 2.2, 0.22 * v, 0.001, 0.03);
};
Band.prototype.rim = function (t, v) { this.noise(t, 0.04, "bandpass", 3000, 3, 0.16 * v, 0.001, 0.02); };
Band.prototype.swell = function (t, len, v) { this.noise(t, len + 0.1, "highpass", 6000, 0.7, 0.06 * v, len * 0.92, 0.07); };
// Jazz comping: soft FM electric piano stab (on top of the untouched chord sound).
Band.prototype.ep = function (t, midis, dur, v) {
  var ctx = this.audio.ctx, self = this;
  midis.forEach(function (m) {
    var f = 440 * Math.pow(2, (m - 69) / 12), c = ctx.createOscillator(), md = ctx.createOscillator(), mg = ctx.createGain();
    var g = self.env(t, 0.05 * v, 0.006, dur);
    c.type = "sine"; md.type = "sine"; c.frequency.value = f; md.frequency.value = f;
    mg.gain.setValueAtTime(f * 0.9, t); mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.15);
    md.connect(mg); mg.connect(c.frequency); c.connect(g);
    c.start(t); md.start(t); c.stop(t + dur + 0.1); md.stop(t + dur + 0.1);
  });
  this.stats.notes++;
};

Band.prototype.playBeat = function (t, b, bpb, spb, barN) {
  var L = this.level, dense = L >= 0.5, full = L >= 0.8, st = this.style, h = this.harmAt(t);
  if (!h) return;
  var R = bandBassMidi(h.rootPc), third = bandIv(h, [4, 3, 5], 4), fifth = bandIv(h, [7, 6, 8], 7), last = b === bpb - 1;
  var mid = Math.floor(bpb / 2);   // "beat 3" in 4/4
  if (st === "pop") {
    if (b === 0 || b === mid) this.kick(t, 1);
    if (full && b === mid) this.kick(t + spb * 0.5, 0.6);
    if (b % 2 === 1) this.snare(t, 0.9);
    if (full && last) this.snare(t + spb * 0.75, 0.25);
    this.hat(t, b % 2 ? 0.7 : 0.9);
    if (dense) this.hat(t + spb * 0.5, full && last ? 0.6 : 0.5, full && last);
    if (b === 0 || b === mid) this.bass(t, R, spb * 1.8, 1, "round");
  } else if (st === "country") {
    // train beat: brushy 8ths, accents on 2 & 4; boom-chick bass root / fifth
    var acc = b % 2 === 1;
    this.snare(t, acc ? 0.55 : 0.18);
    if (dense) this.brush(t + spb * 0.5, 0.7, 0.12);
    if (full) this.brush(t + spb * 0.25, 0.35, 0.08), this.brush(t + spb * 0.75, 0.35, 0.08);
    if (b === 0 || b === mid) this.kick(t, 0.55);
    if (b === 0) this.bass(t, R, spb * 0.75, 1, "pluck");
    else if (b === mid) this.bass(t, R + fifth - (R + fifth > 52 ? 12 : 0), spb * 0.75, 0.95, "pluck");
  } else if (st === "jazz") {
    var sw = spb * 2 / 3;   // swung 8th
    this.ride(t, b % 2 ? 0.8 : 1);
    if (dense && b % 2 === 1) this.ride(t + sw, 0.55);
    if (b % 2 === 1) { this.brush(t, 0.9, 0.22); this.hatFoot(t, 0.9); }
    if (full && b % 2 === 0) this.brush(t + sw, 0.35, 0.1);
    // walking bass: quarters, root on 1, chord / passing tones, chromatic approach into a new root
    var seventh = bandIv(h, [10, 11, 9], 10), n;
    var nx = last ? this.nextRootPc(t, spb * 1.6, h.rootPc) : null;
    if (b === 0) n = R;
    else if (last && nx != null && nx !== h.rootPc) { var tgt = bandBassMidi(nx); n = (barN % 2 ? tgt + 1 : tgt - 1); }
    else {
      var walk = barN % 2 ? [0, fifth, third + 12, seventh, fifth] : [0, third, fifth, fifth + 2 > 11 ? 9 : fifth + 2, 12];
      n = R + walk[Math.min(b, walk.length - 1)];
    }
    while (n > 58) n -= 12;
    this.bass(t, n, spb * 0.92, 0.95, "upright");
    // comping: rootless 3-5-7-9, short swung stabs (Charleston-ish), quiet
    var shell = [third, fifth, seventh, 2].map(function (iv) { var m = 48 + bandPc(h.rootPc + iv); while (m < 53) m += 12; while (m > 66) m -= 12; return m; }).sort(function (a, c) { return a - c; });
    var stab = barN % 2 ? (b === 1 ? sw : b === mid ? sw : -1) : (b === 0 ? 0 : b === 1 ? sw : -1);
    if (stab >= 0 && (dense || barN % 2 === 0)) this.ep(t + stab, shell, spb * 0.35, dense ? 1 : 0.8);
    if (full && last) this.ep(t + sw, shell, spb * 0.25, 0.6);
  } else if (st === "ballad") {
    // soft and spacious: light kick on 1, brush (cross-stick from 50) on 2 & 4, long held root bass that
    // moves on chord changes; shaker swell into the next bar and a soft ride on 1 only from 80. No hats.
    if (b === 0) this.kick(t, 0.5);
    if (full && b === mid) this.kick(t, 0.28);
    if (b % 2 === 1) { this.brush(t, 0.75, 0.3); if (dense) this.crossStick(t, 0.85); }
    if (full && b === 0) this.ride(t, 0.45);
    if (full && last && barN % 2 === 1) this.swell(t, spb, 1);
    var hb = this.harmAt(t), chg = b === 0 || hb !== this.balH;
    if (chg) {
      this.balH = hb;
      var nxT = null;
      for (var hi = 0; hi < this.harm.length; hi++) if (this.harm[hi].t > t + 0.03) { nxT = this.harm[hi].t; break; }
      var held = Math.min(nxT != null ? nxT - t : spb * (bpb - b), spb * (bpb - b)) * 0.96;
      this.sub(t, R, Math.max(spb * 0.8, held), 0.95, 0.06);
    }
  } else if (st === "rnb") {
    // laid-back neo-soul pocket: kick 1, pickup into 3 (the "a" of 2), 3; snare + soft clap on 2 & 4 a little
    // behind; swung 16th hats (8ths under 50); round sub bass with a short slide / approach into chord changes;
    // rimshot ghosts from 80.
    var lay = Math.min(0.035, spb * 0.05), sw16 = spb * 0.29;   // swung 16th: 0, .29, .5, .79 of a beat
    if (b === 0 || b === mid) this.kick(t, b === 0 ? 0.85 : 0.65);
    if (b === mid - 1) this.kick(t + spb * 0.79, 0.45);
    if (dense && last) this.kick(t + spb * 0.5, 0.35);
    if (b % 2 === 1) { this.snare(t + lay, 0.62); this.clap(t + lay + 0.008, 0.22); }
    this.hat(t, b % 2 ? 0.5 : 0.62);
    this.hat(t + spb * 0.5, 0.42);
    if (dense) { this.hat(t + sw16, 0.24); this.hat(t + spb * 0.5 + sw16, 0.26); }
    if (full) { if (b === 0) this.rim(t + spb * 0.79, 0.5); if (b === mid) this.rim(t + sw16, 0.45); }
    var nxr = last ? this.nextRootPc(t, spb * 1.6, h.rootPc) : null;
    if (b === 0) this.sub(t, R, spb * 1.35, 1, 0.015);
    else if (b === mid - 1) this.sub(t + spb * 0.79, R, spb * 0.2, 0.7, 0.01);
    else if (b === mid) this.sub(t, dense ? R : R, spb * 0.9, 0.9, 0.015);
    if (last) {
      if (nxr != null && nxr !== h.rootPc) {
        var tg = bandBassMidi(nxr), ap = tg + (barN % 2 ? 1 : -1);
        this.sub(t + spb * 0.62, ap, spb * 0.36, 0.7, 0.01, tg);   // approach note sliding into the new root
      } else if (dense) this.sub(t + spb * 0.5, R + 12 > 55 ? R : R + 12, spb * 0.22, 0.5, 0.01);
    }
  } else if (st === "kids") {
    if (b % 2 === 1) this.clap(t, 0.9);
    if (full && last) this.clap(t + spb * 0.5, 0.45);
    this.shaker(t, 1);
    if (dense) this.shaker(t + spb * 0.5, 0.7);
    if (b === 0) this.bass(t, R, spb * 0.45, 1, "bouncy");
    else if (b === mid) this.bass(t, R + fifth - (R + fifth > 52 ? 12 : 0), spb * 0.45, 0.9, "bouncy");
    else if (dense && b % 2 === 1) this.bass(t + spb * 0.5, (b === 1 ? R : R + fifth - (R + fifth > 52 ? 12 : 0)) + 12, spb * 0.3, 0.6, "bouncy");
  }
};
ChordAudio.prototype.bandTouch = function (t, midis, bass) { if (this.band) this.band.touch(t, midis, bass); };
ChordAudio.prototype.bandOwnsBass = function () { return !!(this.band && this.band.active()); };

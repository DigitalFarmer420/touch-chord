// Voices: piano, e-piano, strings, pad, reed, bell, and the per-style voices (makeVoice, makeStyleVoice).
import { REL_TAU, REL_TAU_BASS, TAIL_TAUS, ChordAudio, glide, BASS_PEAK } from "./engine.js?v=112.11";

// Signal path per voice:
//   oscs -> filter -> env (attack/decay shape) -> level (velocity) -> gate (release) -> bus
// The gate only ever holds a constant 1 until release, so a release can
// start from a *known* value at any (even future) time without stepping.
ChordAudio.prototype.makeVoice = function (spec) {
  var fl = this.flavorFor(spec);   // v73: the active style's own voice
  if (fl) return this.makeStyleVoice(spec, fl);
  var ctx = this.ctx;
  var now = ctx.currentTime;
  var time = Math.max(spec.time, now);
  var freq = 440 * Math.pow(2, (spec.midi - 69) / 12);
  var engine = spec.bass ? "bass" : spec.engine;
  var nodes = [];
  var filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  nodes.push(filter);
  var cut = this.cutoffHz();
  if (spec.bass) {
    filter.frequency.setValueAtTime(Math.min(860, cut), time);
    filter.Q.setValueAtTime(0.6, time);
  } else if (engine === "bell") {
    filter.frequency.setValueAtTime(4200 + this.cutoffNorm * 5000, time);
    filter.Q.setValueAtTime(0.3, time);
  } else if (engine === "reed") {
    filter.frequency.setValueAtTime(Math.min(7000, cut * 1.7), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(160, cut), time + 0.14);
    filter.Q.setValueAtTime(4.5, time);
  } else if (engine === "piano") {
    filter.frequency.setValueAtTime(Math.min(6800, cut * 1.35), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(280, cut * 0.55), time + 0.22);
    filter.Q.setValueAtTime(0.55, time);
  } else if (engine === "epiano") {
    filter.frequency.setValueAtTime(Math.min(5200, cut * 1.15), time);
    filter.Q.setValueAtTime(0.9, time);
  } else if (engine === "strings") {
    filter.frequency.setValueAtTime(Math.max(220, cut * 0.85), time);
    filter.Q.setValueAtTime(0.5, time);
  } else {
    filter.frequency.setValueAtTime(cut, time);
    filter.Q.setValueAtTime(0.7, time);
  }

  var env = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.setValueAtTime(0, time);
  var level = ctx.createGain();
  var vel = Math.max(0.001, spec.velocity || 1);
  level.gain.setValueAtTime(vel, now);
  var gate = ctx.createGain();
  gate.gain.setValueAtTime(1, now);
  nodes.push(env, level, gate);

  var oscs = [];
  if (spec.bass) {
    var sine = ctx.createOscillator();
    sine.type = "sine";
    sine.frequency.setValueAtTime(freq, time);
    var saw = ctx.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.setValueAtTime(freq, time);
    var sineG = ctx.createGain();
    sineG.gain.value = 0.82;
    var sawG = ctx.createGain();
    sawG.gain.value = 0.1;
    sine.connect(sineG);
    saw.connect(sawG);
    sineG.connect(filter);
    sawG.connect(filter);
    // v68: a 2nd harmonic so small speakers still carry the bass line.
    var h2 = ctx.createOscillator();
    h2.type = "sine";
    h2.frequency.setValueAtTime(freq * 2, time);
    var h2G = ctx.createGain();
    h2G.gain.value = 0.32;
    h2.connect(h2G);
    h2G.connect(filter);
    oscs.push(sine, saw, h2);
    nodes.push(sineG, sawG, h2G);
  } else if (engine === "piano") {
    // Hammer-ish transient + decaying harmonic partials (not a toy beep).
    var partials = [
      { mul: 1, amp: 0.42, type: "sine" },
      { mul: 2, amp: 0.22, type: "sine" },
      { mul: 3, amp: 0.12, type: "triangle" },
      { mul: 4, amp: 0.07, type: "sine" },
      { mul: 5, amp: 0.04, type: "sine" }
    ];
    for (var pi = 0; pi < partials.length; pi++) {
      var p = partials[pi];
      var po = ctx.createOscillator();
      po.type = p.type;
      po.frequency.setValueAtTime(freq * p.mul, time);
      var pg = ctx.createGain();
      // Higher partials decay faster (struck-string character).
      var pPeak = p.amp;
      var pDecay = spec.short ? 0.18 + pi * 0.04 : 0.55 + pi * 0.18;
      pg.gain.setValueAtTime(0.0001, time);
      pg.gain.exponentialRampToValueAtTime(pPeak, time + 0.004);
      pg.gain.exponentialRampToValueAtTime(Math.max(0.0002, pPeak * (0.22 - pi * 0.03)), time + pDecay);
      po.connect(pg);
      pg.connect(filter);
      oscs.push(po);
      nodes.push(pg);
    }
    // Soft hammer click: brief high sine burst into the same filter.
    var ham = ctx.createOscillator();
    ham.type = "sine";
    ham.frequency.setValueAtTime(Math.min(6500, freq * 8.5), time);
    var hamG = ctx.createGain();
    hamG.gain.setValueAtTime(0.0001, time);
    hamG.gain.exponentialRampToValueAtTime(0.09, time + 0.002);
    hamG.gain.exponentialRampToValueAtTime(0.0001, time + 0.028);
    ham.connect(hamG);
    hamG.connect(filter);
    oscs.push(ham);
    nodes.push(hamG);
  } else if (engine === "epiano") {
    // Rhodes-ish FM/tine: sine carrier + inharmonic modulator, index decays.
    var car = ctx.createOscillator();
    var mod = ctx.createOscillator();
    var mGain = ctx.createGain();
    car.type = "sine";
    mod.type = "sine";
    car.frequency.setValueAtTime(freq, time);
    // Mild inharmonicity (~14× classic Rhodes tine, scaled down for chords).
    mod.frequency.setValueAtTime(freq * 14, time);
    var index = freq * (spec.short ? 0.55 : 0.85);
    mGain.gain.setValueAtTime(index, time);
    mGain.gain.exponentialRampToValueAtTime(Math.max(2, freq * 0.08), time + (spec.short ? 0.35 : 1.1));
    mod.connect(mGain);
    mGain.connect(car.frequency);
    // Quiet fundamental reinforcement so chords stay centered.
    var fund = ctx.createOscillator();
    fund.type = "sine";
    fund.frequency.setValueAtTime(freq, time);
    var fundG = ctx.createGain();
    fundG.gain.value = 0.18;
    fund.connect(fundG);
    fundG.connect(filter);
    car.connect(filter);
    oscs.push(car, mod, fund);
    nodes.push(mGain, fundG);
  } else if (engine === "strings") {
    // Slow-attack detuned ensemble (wider than Pad).
    var sDet = [-18, -7, 5, 16];
    for (var sd = 0; sd < sDet.length; sd++) {
      var so = ctx.createOscillator();
      so.type = "sawtooth";
      so.frequency.setValueAtTime(freq, time);
      so.detune.setValueAtTime(sDet[sd], time);
      var sg = ctx.createGain();
      sg.gain.value = 0.22;
      so.connect(sg);
      sg.connect(filter);
      oscs.push(so);
      nodes.push(sg);
    }
  } else if (engine === "warm") {
    var detunes = [-14, 0, 11];
    for (var d = 0; d < detunes.length; d++) {
      var o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(freq, time);
      o.detune.setValueAtTime(detunes[d], time);
      var g = ctx.createGain();
      g.gain.value = 0.34;
      o.connect(g);
      g.connect(filter);
      oscs.push(o);
      nodes.push(g);
    }
  } else if (engine === "bell") {
    var carrier = ctx.createOscillator();
    var mod = ctx.createOscillator();
    var mGain = ctx.createGain();
    carrier.type = "sine";
    mod.type = "sine";
    carrier.frequency.setValueAtTime(freq, time);
    mod.frequency.setValueAtTime(freq * 2, time);
    var index = freq * (spec.short ? 1.5 : 2.1);
    mGain.gain.setValueAtTime(index, time);
    mGain.gain.exponentialRampToValueAtTime(Math.max(1, freq * 0.18), time + (spec.short ? 0.28 : 0.85));
    mod.connect(mGain);
    mGain.connect(carrier.frequency);
    carrier.connect(filter);
    oscs.push(carrier, mod);
    nodes.push(mGain);
  } else {
    var pulse = ctx.createOscillator();
    pulse.setPeriodicWave(this.pulse);
    pulse.frequency.setValueAtTime(freq, time);
    pulse.connect(filter);
    oscs.push(pulse);
  }

  if (spec.bass) {
    // v68: high-pass the bass below ~50 Hz (rumble no speaker can play).
    var hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 50;
    hp.Q.value = 0.7;
    filter.connect(hp);
    hp.connect(env);
    nodes.push(hp);
  } else {
    filter.connect(env);
  }
  env.connect(level);
  level.connect(gate);
  gate.connect(this.bus);

  var art = !spec.short ? this.art : null;
  // v68: bass 0.26 -> BASS_PEAK (about 14 dB lower against the chords).
  var peak = spec.bass ? BASS_PEAK * (art ? 0.8 : 1)
    : art === "stab" ? 0.16
    : art === "chop" ? 0.15
    : art === "box" ? 0.12
    : engine === "bell" ? 0.15
    : engine === "reed" ? 0.11
    : engine === "piano" ? 0.14
    : engine === "epiano" ? 0.12
    : engine === "strings" ? 0.09
    : 0.1;

  // Linear attack from true zero: soft onset with no step. (An exponential
  // ramp from 1e-4 does nothing for most of its length then jumps at the
  // end, which reads as a click on short attacks.)
  var attack;
  if (spec.bass) attack = art ? 0.008 : 0.03;
  else if (spec.short) {
    attack = engine === "reed" ? 0.006
      : engine === "piano" ? 0.004
      : engine === "epiano" ? 0.006
      : engine === "strings" ? 0.04
      : 0.008;
  } else if (art) {
    attack = art === "stab" ? 0.002 : art === "box" ? 0.003 : 0.004;
  } else {
    attack = engine === "reed" ? 0.014
      : engine === "bell" ? 0.012
      : engine === "piano" ? 0.006
      : engine === "epiano" ? 0.01
      : engine === "strings" ? 0.18
      : 0.04;
  }

  env.gain.linearRampToValueAtTime(peak, time + attack);

  var expire = null;
  // Start before any stop(): Web Audio throws InvalidStateError if stop runs first.
  oscs.forEach(function (o) { o.start(time); });

  // Held voices need a true sustain stage (level held until gate release).
  // If env scheduled a fade to ~0 at note-on, Sustain-pooled notes would go
  // silent while gate is still 1 — sounds like the pedal "doesn't work".
  if (spec.short) {
    var dur = spec.bass ? 0.26
      : engine === "bell" ? 0.5
      : engine === "warm" ? 0.34
      : engine === "piano" ? 0.55
      : engine === "epiano" ? 0.48
      : engine === "strings" ? 0.6
      : 0.2;
    env.gain.exponentialRampToValueAtTime(0.0001, time + attack + dur);
    env.gain.linearRampToValueAtTime(0, time + attack + dur + 0.02);
    expire = time + attack + dur + 0.05;
    oscs.forEach(function (o) { o.stop(expire); });
  } else if (art) {
    // v68: Reggae chop / Funk stab: a short, dry articulation that dies away on its own.
    // The bass plucks along: a bit longer than the chord (Reggae rounder, Funk tighter).
    var aDur = spec.bass ? (art === "stab" ? 0.32 : art === "box" ? 0.5 : 0.55) : art === "stab" ? 0.16 : art === "box" ? 0.6 : 0.24;
    if (art === "box" && !spec.bass) {
      // Kids music box: a high sparkle (2 octaves up, fast decay) and a soft ukulele-like pluck under the bell.
      var spk = ctx.createOscillator(), spkG = ctx.createGain();
      spk.type = "sine";
      spk.frequency.setValueAtTime(freq * 4, time);
      spkG.gain.setValueAtTime(0.0001, time);
      spkG.gain.exponentialRampToValueAtTime(0.16, time + 0.002);
      spkG.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
      spk.connect(spkG); spkG.connect(filter);
      var plk = ctx.createOscillator(), plkG = ctx.createGain(), plkF = ctx.createBiquadFilter();
      plk.type = "triangle";
      plk.frequency.setValueAtTime(freq, time);
      plkF.type = "lowpass";
      plkF.frequency.setValueAtTime(Math.min(6000, freq * 6), time);
      plkF.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.5), time + 0.25);
      plkG.gain.setValueAtTime(0.0001, time);
      plkG.gain.exponentialRampToValueAtTime(0.45, time + 0.004);
      plkG.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);
      plk.connect(plkF); plkF.connect(plkG); plkG.connect(filter);
      spk.start(time); plk.start(time);
      oscs.push(spk, plk);
      nodes.push(spkG, plkG, plkF);
    }
    if (art === "stab" && !spec.bass) {
      // Clav-like: the filter snaps open, then closes fast.
      try {
        filter.frequency.cancelScheduledValues(time);
        filter.Q.cancelScheduledValues(time);
        filter.frequency.setValueAtTime(Math.min(9000, Math.max(cut, 1200) * 2.6), time);
        filter.frequency.exponentialRampToValueAtTime(Math.max(300, cut * 0.7), time + 0.09);
        filter.Q.setValueAtTime(2.2, time);
      } catch (errA) { /* ignore */ }
    }
    env.gain.exponentialRampToValueAtTime(0.0008, time + attack + aDur);
    env.gain.linearRampToValueAtTime(0, time + attack + aDur + 0.03);
    expire = time + attack + aDur + 0.06;
    oscs.forEach(function (o) { o.stop(expire); });
  } else {
    var sustainLevel = spec.bass ? peak
      : engine === "bell" ? peak * 0.7
      : engine === "reed" ? peak * 0.92
      : engine === "piano" ? peak * 0.6
      : engine === "epiano" ? peak * 0.75
      : engine === "strings" ? peak * 0.88
      : peak * 0.82;
    var decayDur = spec.bass ? 0.08
      : engine === "bell" ? 0.55
      : engine === "reed" ? 0.12
      : engine === "piano" ? 0.7
      : engine === "epiano" ? 0.45
      : engine === "strings" ? 0.35
      : 0.28;
    var decayEnd = time + attack + decayDur;
    if (sustainLevel < peak * 0.995) {
      if (engine === "bell") {
        env.gain.exponentialRampToValueAtTime(Math.max(0.001, sustainLevel), decayEnd);
      } else {
        env.gain.linearRampToValueAtTime(sustainLevel, decayEnd);
      }
    }
    // Lock sustain so the param stays put until gate release / dumpSustain.
    env.gain.setValueAtTime(sustainLevel, decayEnd);
  }

  // Free the graph once the last oscillator has ended so finished voices
  // stop costing render time.
  var last = oscs[oscs.length - 1];
  last.onended = function () {
    oscs.forEach(function (o) { try { o.disconnect(); } catch (e) {} });
    nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
  };

  var voice = {
    group: spec.group,
    engine: spec.bass ? "bass" : spec.engine,
    srcEngine: spec.engine,
    midi: spec.midi,
    bass: !!spec.bass,
    short: !!spec.short,
    filter: filter,
    amp: env,
    gate: gate,
    oscs: oscs,
    released: false,
    born: time,
    startTime: time,
    done: expire,
    setLevel: function (v) {
      glide(level.gain, Math.max(0.001, v), ctx.currentTime, 0.03);
    },
    // v39: damper-pedal decay. Exponential fade on the level stage, then
    // free the voice once it is near silent (no flat hold, no loop).
    fade: function (tau) {
      if (voice.released || voice.fading) return;
      voice.fading = true;
      var t = ctx.currentTime;
      try {
        var cur = level.gain.value;
        level.gain.cancelScheduledValues(t);
        level.gain.setValueAtTime(cur, t);
        level.gain.setTargetAtTime(0.0001, t, tau);
      } catch (err) { /* ignore */ }
      var stopAt = t + tau * 5.5;
      if (expire != null) stopAt = Math.min(stopAt, Math.max(expire, t + 0.01));
      oscs.forEach(function (o) { try { o.stop(stopAt); } catch (err2) {} });
      voice.done = Math.min(voice.done == null ? Infinity : voice.done, stopAt + 0.05);
    },
    // v68: force = cut a voice whose release is already scheduled LATER (magic Next ring end)
    // at an earlier time; the gate is still 1 until that scheduled release, so it ramps from 1.
    release: function (when, tau, force) {
      var t = Math.max(ctx.currentTime, when == null ? ctx.currentTime : when);
      if (voice.released && !(force && voice.relAt != null && t < voice.relAt - 0.002)) return;
      voice.released = true;
      voice.relAt = t;
      var k = tau || (spec.bass ? REL_TAU_BASS : REL_TAU);
      try {
        gate.gain.cancelScheduledValues(t);
        gate.gain.setValueAtTime(1, t);
        gate.gain.setTargetAtTime(0, t, k);
      } catch (err) { /* ignore */ }
      var stopAt = Math.max(t + k * TAIL_TAUS, voice.startTime + 0.03);
      if (expire != null) stopAt = Math.min(stopAt, Math.max(expire, t + 0.01));
      oscs.forEach(function (o) {
        try { o.stop(stopAt); } catch (err2) { /* already stopped */ }
      });
      voice.done = stopAt + 0.05;
    }
  };
  return voice;
};

// v73: the voice object shared by makeVoice-style voices (same release / fade contract).
function voiceObject(ctx, spec, filter, env, level, gate, oscs, nodes, time, expire) {
  // Free the graph once the last oscillator has ended so finished voices
  // stop costing render time.
  var last = oscs[oscs.length - 1];
  last.onended = function () {
    oscs.forEach(function (o) { try { o.disconnect(); } catch (e) {} });
    nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
  };

  var voice = {
    group: spec.group,
    engine: spec.bass ? "bass" : spec.engine,
    srcEngine: spec.engine,
    midi: spec.midi,
    bass: !!spec.bass,
    short: !!spec.short,
    filter: filter,
    amp: env,
    gate: gate,
    oscs: oscs,
    released: false,
    born: time,
    startTime: time,
    done: expire,
    setLevel: function (v) {
      glide(level.gain, Math.max(0.001, v), ctx.currentTime, 0.03);
    },
    // v39: damper-pedal decay. Exponential fade on the level stage, then
    // free the voice once it is near silent (no flat hold, no loop).
    fade: function (tau) {
      if (voice.released || voice.fading) return;
      voice.fading = true;
      var t = ctx.currentTime;
      try {
        var cur = level.gain.value;
        level.gain.cancelScheduledValues(t);
        level.gain.setValueAtTime(cur, t);
        level.gain.setTargetAtTime(0.0001, t, tau);
      } catch (err) { /* ignore */ }
      var stopAt = t + tau * 5.5;
      if (expire != null) stopAt = Math.min(stopAt, Math.max(expire, t + 0.01));
      oscs.forEach(function (o) { try { o.stop(stopAt); } catch (err2) {} });
      voice.done = Math.min(voice.done == null ? Infinity : voice.done, stopAt + 0.05);
    },
    // v68: force = cut a voice whose release is already scheduled LATER (magic Next ring end)
    // at an earlier time; the gate is still 1 until that scheduled release, so it ramps from 1.
    release: function (when, tau, force) {
      var t = Math.max(ctx.currentTime, when == null ? ctx.currentTime : when);
      if (voice.released && !(force && voice.relAt != null && t < voice.relAt - 0.002)) return;
      voice.released = true;
      voice.relAt = t;
      var k = tau || (spec.bass ? REL_TAU_BASS : REL_TAU);
      try {
        gate.gain.cancelScheduledValues(t);
        gate.gain.setValueAtTime(1, t);
        gate.gain.setTargetAtTime(0, t, k);
      } catch (err) { /* ignore */ }
      var stopAt = Math.max(t + k * TAIL_TAUS, voice.startTime + 0.03);
      if (expire != null) stopAt = Math.min(stopAt, Math.max(expire, t + 0.01));
      oscs.forEach(function (o) {
        try { o.stop(stopAt); } catch (err2) { /* already stopped */ }
      });
      voice.done = stopAt + 0.05;
    }
  };
  return voice;
}

// ===== v73: style voices (sound distinctness) =====
// Each style plays its own voice when the Sound is the style's own engine (a manual Sound pick
// falls back to the plain engine). Chords AND bass get a style timbre, attack and (where it fits)
// a light built-in groove on the voice's own envelope: Reggae offbeat skank + one-drop bass,
// Funk clav stabs + slap bass, Country boom-chick, Jazz walking root-fifth upright bass.
// A groove plays at most 4 bars per tap (then rings out); every tap / Next / Play restarts it.
// Tempo: grooveBpm (the uploaded song's BPM when one is playing) else the style / loop BPM.
var FLAVOR_ENGINE = { pop: "piano", country: "piano", jazz: "epiano", rnb: "epiano", ballad: "strings", reggae: "warm", funk: "reed" };
var GROOVE_STYLES = { reggae: true, funk: true, country: true };
var FIFTH = Math.pow(2, 7 / 12);
ChordAudio.prototype.setFlavor = function (f) { this.flavor = FLAVOR_ENGINE[f] ? f : null; };
ChordAudio.prototype.grooving = function () { return !!(this.flavor && GROOVE_STYLES[this.flavor] && this.sound === FLAVOR_ENGINE[this.flavor]); };
ChordAudio.prototype.flavorFor = function (spec) {
  var f = this.flavor;
  if (!f || spec.short || FLAVOR_ENGINE[f] !== spec.engine) return null;
  if (f === "pop" && !spec.bass) return null;   // Pop chords: the classic bright piano path
  return f;
};
// Bars of [beat, amp, pitch ratio] repeated over `bars` bars of 4 beats (first bar may differ).
function barHits(first, rest, bars) {
  var out = [];
  for (var b = 0; b < bars; b++) (b === 0 ? first : rest).forEach(function (h) { out.push({ at: b * 4 + h[0], amp: h[1], r: h[2] || 1 }); });
  return out;
}
function narrowPulse(ctx, duty) {
  var h = 32, re = new Float32Array(h), im = new Float32Array(h);
  for (var k = 1; k < h; k++) im[k] = Math.sin(Math.PI * k * duty) / (k * Math.PI);
  return ctx.createPeriodicWave(re, im);
}
ChordAudio.prototype.makeStyleVoice = function (spec, fl) {
  var ctx = this.ctx, now = ctx.currentTime, time = Math.max(spec.time, now);
  var freq = 440 * Math.pow(2, (spec.midi - 69) / 12);
  var beat = 60 / (this.grooveBpm || this.bpm || 96);
  var cut = this.cutoffHz();
  var bass = !!spec.bass;
  var filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  var env = ctx.createGain(), level = ctx.createGain(), gate = ctx.createGain();
  env.gain.setValueAtTime(0, now);
  level.gain.setValueAtTime(Math.max(0.001, spec.velocity || 1), now);
  gate.gain.setValueAtTime(1, now);
  var nodes = [filter, env, level, gate], oscs = [], pitched = [];
  var into = filter;           // oscillators feed this
  var post = env;              // filter (and extras) feed this
  function osc(type, mul, g, dest, detune, follow) {
    var o = ctx.createOscillator(), a = ctx.createGain();
    if (type === "pulse12") o.setPeriodicWave(spec._pw); else if (type === "pulse") o.setPeriodicWave(spec._pw28); else o.type = type;
    o.frequency.setValueAtTime(freq * mul, time);
    if (detune) o.detune.setValueAtTime(detune, time);
    a.gain.value = g;
    o.connect(a); a.connect(dest || into);
    oscs.push(o); nodes.push(a);
    if (follow !== false) pitched.push({ o: o, mul: mul });
    return o;
  }
  function lfo(rate, depth, param) {
    var l = ctx.createOscillator(), lg = ctx.createGain();
    l.type = "sine"; l.frequency.value = rate; lg.gain.value = depth;
    l.connect(lg); lg.connect(param);
    oscs.push(l); nodes.push(lg);
  }
  var hits, peak, atk, tau, floor, snap = null, groove = false;
  spec._pw28 = this.pulse;
  if (!this.pulse12) this.pulse12 = narrowPulse(ctx, 0.12);
  spec._pw = this.pulse12;
  if (!bass) {
    if (fl === "jazz") {
      // Rhodes: soft bark (1:1 FM, index falls fast), a bell tine partial that skips the dark
      // filter, and a 4.6 Hz tremolo. No hammer, softer attack than the Pop piano.
      filter.frequency.setValueAtTime(Math.max(500, cut * 1.25), time); filter.Q.setValueAtTime(0.7, time);
      var trem = ctx.createGain(); trem.gain.value = 0.8; nodes.push(trem);
      filter.connect(trem); post = null; trem.connect(env);
      lfo(4.6, 0.2, trem.gain);
      var car = osc("sine", 1, 0.8), mod = ctx.createOscillator(), mg = ctx.createGain();
      mod.type = "sine"; mod.frequency.setValueAtTime(freq, time);
      mg.gain.setValueAtTime(freq * 1.1, time); mg.gain.exponentialRampToValueAtTime(Math.max(2, freq * 0.12), time + 0.5);
      mod.connect(mg); mg.connect(car.frequency); oscs.push(mod); nodes.push(mg);
      osc("sine", 1, 0.25);
      var bm = freq * 7 > 6000 ? 4 : 7, bo = ctx.createOscillator(), bg = ctx.createGain();
      bo.type = "sine"; bo.frequency.setValueAtTime(freq * bm, time);
      bg.gain.setValueAtTime(0.0001, time); bg.gain.exponentialRampToValueAtTime(0.07, time + 0.003); bg.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
      bo.connect(bg); bg.connect(trem); oscs.push(bo); nodes.push(bg);
      hits = [{ at: 0, amp: 1 }]; peak = 0.13; atk = 0.014; tau = 0.9; floor = 0.55;
    } else if (fl === "rnb") {
      // Round, chorused Rhodes: low FM index, two carriers +-7 cents, extra body and low-mids.
      filter.frequency.setValueAtTime(Math.max(400, cut * 1.0), time); filter.Q.setValueAtTime(0.5, time);
      var m2 = ctx.createOscillator(), m2g = ctx.createGain();
      m2.type = "sine"; m2.frequency.setValueAtTime(freq, time);
      m2g.gain.setValueAtTime(freq * 0.5, time); m2g.gain.exponentialRampToValueAtTime(Math.max(2, freq * 0.06), time + 0.9);
      m2.connect(m2g); oscs.push(m2); nodes.push(m2g);
      var c1 = osc("sine", 1, 0.42, null, -7), c2 = osc("sine", 1, 0.42, null, 7);
      m2g.connect(c1.frequency); m2g.connect(c2.frequency);
      osc("sine", 1, 0.35);
      if (spec.midi >= 57) osc("sine", 0.5, 0.12);
      hits = [{ at: 0, amp: 1 }]; peak = 0.11; atk = 0.009; tau = 1.3; floor = 0.72;
    } else if (fl === "ballad") {
      // Lush string pad: 100 ms bow, slow filter swell, 5.2 Hz vibrato. No piano attack.
      filter.frequency.setValueAtTime(Math.max(200, cut * 0.45), time);
      filter.frequency.exponentialRampToValueAtTime(Math.max(260, cut * 0.95), time + 0.7);
      filter.Q.setValueAtTime(0.5, time);
      [-16, -6, 6, 15].forEach(function (d) { var o = osc("sawtooth", 1, 0.2, null, d); lfo(5.2, 7, o.detune); });
      hits = [{ at: 0, amp: 1 }]; peak = 0.09; atk = 0.1; tau = 0.6; floor = 0.9;
    } else if (fl === "reggae") {
      // Skank: short muted mid chop on the offbeats (2 and 4), a softer chop on the tap itself.
      filter.frequency.setValueAtTime(Math.min(5000, cut * 2.2), time); filter.Q.setValueAtTime(1.8, time);
      var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 380; hp.Q.value = 0.7; nodes.push(hp);
      filter.connect(hp); hp.connect(env); post = null;
      osc("sawtooth", 1, 0.3, null, -8); osc("sawtooth", 1, 0.3, null, 8); osc("pulse", 1, 0.25);
      hits = barHits([[0, 0.7], [1, 1], [3, 1]], [[1, 1], [3, 1]], 4); peak = 0.16; atk = 0.003; tau = 0.045; floor = 0; groove = true;
    } else if (fl === "funk") {
      // Clav stab: narrow pulse, resonant filter that snaps open on every hit, very short decay;
      // syncopated ghost stabs (the "a" of 2, the "and" of 3).
      filter.Q.setValueAtTime(3.2, time);
      osc("pulse12", 1, 0.5); osc("sawtooth", 1, 0.18);
      snap = { hi: Math.min(9000, Math.max(cut, 1500) * 2.4), lo: Math.max(400, cut * 0.6), dur: 0.08 };
      hits = barHits([[0, 1], [1.5, 0.45], [2.75, 0.65]], [[0, 0.9], [1.5, 0.45], [2.75, 0.65]], 4); peak = 0.17; atk = 0.002; tau = 0.05; floor = 0; groove = true;
    } else if (fl === "country") {
      // Honky-tonk piano: two detuned partial sets (+-9 cents), bright strike, then "chick" on 2 and 4.
      filter.Q.setValueAtTime(0.6, time);
      [-9, 9].forEach(function (d) { osc("sine", 1, 0.42, null, d); osc("sine", 2, 0.2, null, d); osc("triangle", 3, 0.1, null, d); });
      snap = { hi: Math.min(7000, cut * 1.6), lo: Math.max(500, cut * 0.6), dur: 0.18 };
      hits = barHits([[0, 1], [1, 0.55], [3, 0.55]], [[1, 0.55], [3, 0.55]], 4); peak = 0.13; atk = 0.004; tau = 0.3; floor = 0.15; groove = true;
      hits[0].tau = 0.45; hits[0].floor = 0.3;
    }
  } else {
    filter.Q.setValueAtTime(0.7, time);
    var bhp = ctx.createBiquadFilter(); bhp.type = "highpass"; bhp.frequency.value = 50; bhp.Q.value = 0.7; nodes.push(bhp);
    filter.connect(bhp); bhp.connect(env); post = null;
    if (fl === "pop") {
      filter.frequency.setValueAtTime(Math.min(900, cut), time);
      osc("sine", 1, 0.85); osc("sine", 2, 0.28); osc("sawtooth", 1, 0.05);
      hits = [{ at: 0, amp: 1 }]; peak = BASS_PEAK * 0.85; atk = 0.01; tau = 0.55; floor = 0.5;
    } else if (fl === "jazz") {
      // Upright: plucked, woody, walks root - fifth each bar (half notes).
      filter.frequency.setValueAtTime(750, time); filter.Q.setValueAtTime(0.9, time);
      osc("triangle", 1, 0.6); osc("sine", 1, 0.5); osc("sine", 2, 0.2);
      hits = barHits([[0, 1], [2, 0.85, FIFTH]], [[0, 0.95], [2, 0.85, FIFTH]], 4); peak = BASS_PEAK * 1.15; atk = 0.006; tau = 0.32; floor = 0.1; groove = true;
    } else if (fl === "rnb") {
      // Smooth sub: soft attack, a tiny slide into the note, held.
      filter.frequency.setValueAtTime(500, time);
      var s1 = osc("sine", 1, 0.9); osc("sine", 2, 0.18);
      s1.frequency.setValueAtTime(freq * 0.97, time); s1.frequency.exponentialRampToValueAtTime(freq, time + 0.06);
      pitched = pitched.filter(function (p) { return p.o !== s1; });
      hits = [{ at: 0, amp: 1 }]; peak = BASS_PEAK * 1.1; atk = 0.03; tau = 0.8; floor = 0.85;
    } else if (fl === "ballad") {
      // Cello-ish: bowed saws, slow attack, vibrato.
      filter.frequency.setValueAtTime(650, time); filter.Q.setValueAtTime(1, time);
      [-5, 5].forEach(function (d) { var o = osc("sawtooth", 1, 0.35, null, d); lfo(5, 6, o.detune); });
      osc("sine", 1, 0.3);
      hits = [{ at: 0, amp: 1 }]; peak = BASS_PEAK * 0.9; atk = 0.09; tau = 1.0; floor = 0.9;
    } else if (fl === "reggae") {
      // One drop: light on 1, the weight on 3.
      filter.frequency.setValueAtTime(420, time);
      osc("sine", 1, 0.95); osc("sine", 2, 0.25);
      hits = barHits([[0, 0.45], [2, 1]], [[0, 0.45], [2, 1]], 4); peak = BASS_PEAK * 1.3; atk = 0.012; tau = 0.35; floor = 0.05; groove = true;
    } else if (fl === "funk") {
      // Slap: thumb on 1, octave pop on the "and" of 2, ghost root on the "and" of 3.
      filter.Q.setValueAtTime(2, time);
      osc("sawtooth", 1, 0.4); osc("sine", 1, 0.6);
      snap = { hi: 2000, lo: 450, dur: 0.1 };
      hits = barHits([[0, 1], [1.5, 0.7, 2], [2.5, 0.6]], [[0, 1], [1.5, 0.7, 2], [2.5, 0.6]], 4); peak = BASS_PEAK * 1.1; atk = 0.003; tau = 0.14; floor = 0.05; groove = true;
    } else {   // country
      // Boom: root on 1, fifth on 3 (the "chick" is the piano on 2 and 4).
      filter.frequency.setValueAtTime(900, time);
      osc("sine", 1, 0.7); osc("triangle", 1, 0.4);
      hits = barHits([[0, 1], [2, 0.9, FIFTH]], [[0, 1], [2, 0.9, FIFTH]], 4); peak = BASS_PEAK; atk = 0.005; tau = 0.25; floor = 0.03; groove = true;
    }
  }
  if (post) filter.connect(post);
  env.connect(level); level.connect(gate); gate.connect(this.bus);
  // Envelope: each hit ramps from the exact current value (no steps) to its peak, then decays
  // (setTarget) toward floor * that peak. Pitch / filter snaps ride on the same hit times.
  var g = env.gain, last = null;
  g.setValueAtTime(0, time);
  hits.forEach(function (h, i) {
    var T = time + h.at * beat, hp2 = peak * h.amp, hf = h.floor != null ? h.floor : floor, ht = h.tau || tau;
    if (i > 0) {
      var v = last.fv + (last.pv - last.fv) * Math.exp(-(T - last.pt) / last.tau);
      g.setValueAtTime(v, T);
    }
    g.linearRampToValueAtTime(hp2, T + atk);
    g.setTargetAtTime(hp2 * hf, T + atk, ht);
    last = { pt: T + atk, pv: hp2, fv: hp2 * hf, tau: ht };
    if (h.r && i > 0) pitched.forEach(function (p) { p.o.frequency.setValueAtTime(freq * p.mul * h.r, T); });
    if (snap) { filter.frequency.setValueAtTime(snap.hi, T); filter.frequency.exponentialRampToValueAtTime(snap.lo, T + snap.dur); }
  });
  var expire = null;
  oscs.forEach(function (o) { o.start(time); });
  if (groove) {
    expire = last.pt + Math.min(3, last.tau * 9) + 0.05;
    oscs.forEach(function (o) { o.stop(expire); });
  }
  return voiceObject(ctx, spec, filter, env, level, gate, oscs, nodes, time, expire);
};

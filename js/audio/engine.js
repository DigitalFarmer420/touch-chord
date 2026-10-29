// ChordAudio: AudioContext, master chain, mix / cutoff / reverb / delay / warmth, play / morph / stop chords, voice limit.
import { makeWarmCurve, makeSoftClip, makeImpulse, makePulse, clamp01 } from "./effects.js?v=112.13";
var VOICE_CAP = 28;
var VOICE_HARD_CAP = 72;

// Release time-constants (setTargetAtTime). ~7-9 tau to inaudible.
var REL_TAU = 0.022;       // chord voices: ~50ms perceived release
export { REL_TAU };
var REL_TAU_BASS = 0.035;  // bass: a touch longer so it doesn't thump off
export { REL_TAU_BASS };
var REL_TAU_STEAL = 0.015; // voice stealing
var TAIL_TAUS = 9;         // stop oscillators only once gate is < -78 dB
export { TAIL_TAUS };

export function ChordAudio() {
  this.ctx = null;
  this.cutoffNorm = 0.62;
  this.reverbMix = 0.22;
  this.delayMix = 0.14;
  this.warmth = 0.25;
  this.bpm = 96;
  this.sound = "piano";
  this.voices = [];
  this.pulse = null;
  this.pulse12 = null;
  this.flavor = null;      // v73: active style voice (setFlavor)
  this.grooveBpm = null;   // v73: uploaded song BPM for the style grooves
  this.ready = false;
  this.protectedGroups = {};
  this.art = null;     // v68: style articulation ("chop" Reggae, "stab" Funk): short decaying chords
  this.volume = 1;     // v68: master Volume gain ((slider/100)^2; 1 = the level before v68)
}

// v68: Reggae / Funk articulation (no rhythm engine: each tap is one short chop / stab).
ChordAudio.prototype.setArt = function (a) { this.art = a === "chop" || a === "stab" || a === "box" ? a : null; };
// v68: master Volume, one gain right before the safety clipper; everything passes through it.
ChordAudio.prototype.setVolume = function (g) {
  this.volume = Math.max(0, Math.min(1, g));
  if (this.vol && this.ctx) {
    try { this.vol.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03); } catch (err) { this.vol.gain.value = this.volume; }
  }
};

ChordAudio.prototype.protectGroup = function (group) {
  if (group == null) return;
  this.protectedGroups[group] = true;
};

ChordAudio.prototype.unprotectGroup = function (group) {
  if (group == null) return;
  delete this.protectedGroups[group];
};

ChordAudio.prototype.clearProtected = function () {
  this.protectedGroups = {};
};

// Smoothly move an AudioParam toward `target` from wherever it is *right now*,
// never stepping it. Works whether or not a ramp is in flight.
export function glide(param, target, now, tau) {
  try {
    if (param.cancelAndHoldAtTime) {
      param.cancelAndHoldAtTime(now);
    } else {
      var v = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(v, now);
    }
    param.setTargetAtTime(target, now, tau);
  } catch (err) {
    try { param.setTargetAtTime(target, now, tau); } catch (err2) { /* ignore */ }
  }
}

// Create the AudioContext only — no heavy graph. iOS Safari requires
// ctx.resume() + a silent buffer start in the same synchronous user-gesture
// turn; building the convolver impulse first can burn that token.
ChordAudio.prototype.ensureContext = function () {
  if (this.ctx) return this.ctx;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  var ctx;
  // "balanced" gives the render thread a slightly larger buffer than the
  // default "interactive", which avoids underrun crackle on busy devices.
  try { ctx = new AC({ latencyHint: "balanced" }); } catch (err) { ctx = new AC(); }
  this.ctx = ctx;
  var self = this;
  // iOS: interrupted/suspended after backgrounding or audio-route changes.
  if (typeof ctx.addEventListener === "function") {
    ctx.addEventListener("statechange", function () {
      if (ctx.state === "suspended" || ctx.state === "interrupted") {
        self.primed = false;
        if (ctx.state === "interrupted" && !document.hidden) self.wake();
      }
    });
  }
  return ctx;
};

// v32: resume a paused/interrupted context (style taps, iOS interruptions, tab return).
ChordAudio.prototype.wake = function () {
  var c = this.ctx;
  if (c && c.state !== "running" && c.state !== "closed") {
    try { var pr = c.resume(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
  }
};
document.addEventListener("visibilitychange", function () {
  if (!document.hidden && window.__tcAudioWake) window.__tcAudioWake();
});

ChordAudio.prototype.ensure = function () {
  var ctx = this.ensureContext();
  if (!ctx || this.ready) return;

  var bus = ctx.createGain();
  bus.gain.value = 1;

  var dry = ctx.createGain();
  var wet = ctx.createGain();
  var delaySend = ctx.createGain();
  var master = ctx.createGain();
  master.gain.value = 0.62;

  var comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 18;
  comp.ratio.value = 4;
  comp.attack.value = 0.006;
  comp.release.value = 0.16;

  // Warmth: after the compressor, before the safety clipper. Gentle tilt
  // (low-shelf lift + high-shelf roll-off) feeding a unity-small-signal tanh
  // saturator. Series only (no dry/wet split), so oversampling latency can't
  // comb-filter; every amount change glides, so moving it never clicks.
  var warmLow = ctx.createBiquadFilter();
  warmLow.type = "lowshelf";
  warmLow.frequency.value = 180;
  var warmHigh = ctx.createBiquadFilter();
  warmHigh.type = "highshelf";
  warmHigh.frequency.value = 4200;
  var warmDrive = ctx.createGain();
  var warmShaper = ctx.createWaveShaper();
  warmShaper.curve = makeWarmCurve(4096);
  warmShaper.oversample = "2x";
  var warmMakeup = ctx.createGain();

  // Transparent safety clipper (no lookahead latency): identity below 0.8,
  // soft knee up to 1.0. Stacked fingers + bass + reverb could otherwise
  // exceed 0 dBFS at the destination and hard-clip (crackle / static).
  var vol = ctx.createGain();
  vol.gain.value = this.volume;
  var clipPre = ctx.createGain();
  clipPre.gain.value = 0.5;
  var clipper = ctx.createWaveShaper();
  clipper.curve = makeSoftClip(8192);
  clipper.oversample = "none";

  var conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx, 1.7, 2.5);

  var delay = ctx.createDelay(1.5);
  var delayFilter = ctx.createBiquadFilter();
  delayFilter.type = "lowpass";
  delayFilter.frequency.value = 2600;
  var fb = ctx.createGain();
  fb.gain.value = 0.45;

  bus.connect(dry);
  bus.connect(wet);
  bus.connect(delaySend);
  wet.connect(conv);
  conv.connect(master);
  dry.connect(master);
  delaySend.connect(delay);
  delay.connect(delayFilter);
  delayFilter.connect(fb);
  fb.connect(delay);
  delay.connect(master);
  master.connect(comp);
  comp.connect(warmLow);
  warmLow.connect(warmHigh);
  warmHigh.connect(warmDrive);
  warmDrive.connect(warmShaper);
  warmShaper.connect(warmMakeup);
  warmMakeup.connect(vol);
  vol.connect(clipPre);
  clipPre.connect(clipper);
  clipper.connect(ctx.destination);

  this.bus = bus;
  bus.gain.value = (typeof this.trim === "number") ? this.trim : 1;
  this.dry = dry;
  this.wet = wet;
  this.delaySend = delaySend;
  this.delay = delay;
  this.master = master;
  this.warmLow = warmLow;
  this.warmHigh = warmHigh;
  this.warmDrive = warmDrive;
  this.warmMakeup = warmMakeup;
  this.vol = vol;
  this.ready = true;
  this.applyMix(true);
  this.applyWarmth(true);
  this.applyDelayTime(true);
  this.pulse = makePulse(ctx);
};

ChordAudio.prototype._primeSilent = function (ctx) {
  try {
    var buf = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    if (typeof src.start === "function") src.start(0);
    else if (typeof src.noteOn === "function") src.noteOn(0);
  } catch (err) { /* ignore */ }
  // Older WebKit sometimes needs a realtime source, not just a buffer.
  try {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(g);
    g.connect(ctx.destination);
    var t0 = ctx.currentTime || 0;
    if (typeof osc.start === "function") osc.start(0);
    else if (typeof osc.noteOn === "function") osc.noteOn(0);
    if (typeof osc.stop === "function") osc.stop(t0 + 0.02);
    else if (typeof osc.noteOff === "function") osc.noteOff(t0 + 0.02);
  } catch (err2) { /* ignore */ }
};

ChordAudio.prototype.resume = function () {
  var ctx = this.ensureContext();
  if (!ctx) return Promise.resolve();

  // Unlock while still inside the user-gesture turn — before makeImpulse.
  this._primeSilent(ctx);

  var pending = Promise.resolve();
  if (ctx.state !== "running") {
    try { pending = ctx.resume() || Promise.resolve(); } catch (err) { pending = Promise.resolve(); }
  }

  // Heavy graph after resume() has been invoked synchronously.
  try { this.ensure(); } catch (err2) { /* ignore */ }

  var self = this;
  return Promise.resolve(pending).then(function () {
    if (ctx.state === "running") {
      self.primed = true;
      // Second silent tick after resume resolves (iOS Safari quirk).
      self._primeSilent(ctx);
    } else {
      self.primed = false;
    }
  });
};

ChordAudio.prototype.currentTime = function () {
  this.ensure();
  return this.ctx.currentTime;
};

ChordAudio.prototype.setSound = function (name) {
  // Known engines only; unknown / legacy junk -> warm (Pad).
  var ok = name === "piano" || name === "epiano" || name === "strings"
    || name === "warm" || name === "bell" || name === "reed";
  this.sound = ok ? name : "warm";
};

ChordAudio.prototype.filterTarget = function (v) {
  var hz = this.cutoffHz();
  var target;
  if (v.bass) target = Math.min(hz, 860);
  else if (v.engine === "bell") target = 4200 + this.cutoffNorm * 5000;
  else if (v.engine === "piano") target = Math.min(6800, hz * 1.35);
  else if (v.engine === "epiano") target = Math.min(5200, hz * 1.15);
  else if (v.engine === "strings") target = Math.min(hz * 0.9, hz);
  else target = hz;
  return Math.max(80, target);
};

// v32: per-style output trim (linear) so soft styles aren't near-silent.
ChordAudio.prototype.setTrim = function (t) {
  this.trim = t;
  // v68: a 50 ms ramp on style switch (no jump).
  if (this.bus && this.ctx) {
    var g = this.bus.gain, now = this.ctx.currentTime;
    try {
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
      else { var v0 = g.value; g.cancelScheduledValues(now); g.setValueAtTime(v0, now); }
      g.linearRampToValueAtTime(t, now + 0.05);
    } catch (err) { g.setTargetAtTime(t, now, 0.017); }
  }
};

ChordAudio.prototype.setCutoff = function (norm) {
  this.cutoffNorm = clamp01(norm);
  if (!this.ctx) return;
  var now = this.ctx.currentTime;
  this.voices.forEach(function (v) {
    if (v.released) return;
    // Voices that haven't started yet just get their start value updated.
    if (v.startTime > now + 0.005) return;
    glide(v.filter.frequency, this.filterTarget(v), now, 0.04);
  }, this);
};

ChordAudio.prototype.setReverb = function (mix) {
  this.reverbMix = clamp01(mix);
  this.applyMix();
};

ChordAudio.prototype.setDelay = function (mix) {
  this.delayMix = clamp01(mix);
  this.applyMix();
};

// norm: 0..1 (UI slider 0..100 / 100).
ChordAudio.prototype.setWarmth = function (norm) {
  this.warmth = clamp01(norm);
  this.applyWarmth();
};

ChordAudio.prototype.applyWarmth = function (immediate) {
  if (!this.ctx) return;
  var w = clamp01(this.warmth);
  // Shaper input is x/4 (curve spans x in [-4, 4]); k is the drive into tanh.
  // Makeup 1/k keeps small signals at unity so loudness barely moves.
  var k = 0.25 + 2.75 * w;
  var lowDb = 3.5 * w;
  var highDb = -8 * w;
  if (immediate) {
    this.warmLow.gain.value = lowDb;
    this.warmHigh.gain.value = highDb;
    this.warmDrive.gain.value = k / 4;
    this.warmMakeup.gain.value = 1 / k;
    return;
  }
  var now = this.ctx.currentTime;
  glide(this.warmLow.gain, lowDb, now, 0.04);
  glide(this.warmHigh.gain, highDb, now, 0.04);
  glide(this.warmDrive.gain, k / 4, now, 0.04);
  glide(this.warmMakeup.gain, 1 / k, now, 0.04);
};

ChordAudio.prototype.setBpm = function (bpm) {
  this.bpm = bpm;
  this.applyDelayTime();
};

ChordAudio.prototype.cutoffHz = function () {
  var min = 180;
  var max = 7200;
  return min * Math.pow(max / min, clamp01(this.cutoffNorm));
};

ChordAudio.prototype.applyMix = function (immediate) {
  if (!this.ctx) return;
  var now = this.ctx.currentTime;
  var angle = clamp01(this.reverbMix) * Math.PI * 0.5;
  var dryV = Math.cos(angle);
  var wetV = Math.sin(angle);
  var sendV = clamp01(this.delayMix) * 0.5;
  if (immediate) {
    this.dry.gain.value = dryV;
    this.wet.gain.value = wetV;
    this.delaySend.gain.value = sendV;
    return;
  }
  glide(this.dry.gain, dryV, now, 0.03);
  glide(this.wet.gain, wetV, now, 0.03);
  glide(this.delaySend.gain, sendV, now, 0.03);
};

ChordAudio.prototype.applyDelayTime = function (immediate) {
  if (!this.ctx) return;
  var dottedEighth = (60 / this.bpm) * 0.75;
  var t = Math.min(1.4, Math.max(0.05, dottedEighth));
  if (immediate) {
    this.delay.delayTime.value = t;
    return;
  }
  // Slow glide: fast delay-time jumps on a feedback line warble / zipper.
  glide(this.delay.delayTime, t, this.ctx.currentTime, 0.12);
};

var BASS_PEAK = 0.05;
export { BASS_PEAK };
function chordVelocity(n) {
  return 1 / Math.sqrt(Math.max(1, n));
}

ChordAudio.prototype.playChord = function (group, midis, opts) {
  this.ensure();
  opts = opts || {};
  var time = opts.time == null ? this.ctx.currentTime : opts.time;
  var engine = opts.sound || this.sound;
  this.bandTouch(time, midis, opts.bass);   // v75 Band: harmony change / first-tap start (no-op at Band 0)
  // v73: Jazz plays rootless (the upright bass has the root): drop the lowest chord tone that
  // doubles the bass pitch class when 4+ notes remain.
  if (this.flavor === "jazz" && engine === "epiano" && opts.bass != null && midis.length >= 4 && !opts.key) {   // v102: not for a keyboard key (it sounds the touched pitch)
    var bpc = ((opts.bass % 12) + 12) % 12, lo = -1;
    for (var r = 0; r < midis.length; r++) if (((midis[r] % 12) + 12) % 12 === bpc && (lo < 0 || midis[r] < midis[lo])) lo = r;
    if (lo >= 0) midis = midis.slice(0, lo).concat(midis.slice(lo + 1));
  }
  var vel = chordVelocity(midis.length);
  for (var i = 0; i < midis.length; i++) {
    this.voices.push(this.makeVoice({
      midi: midis[i], engine: engine, short: false, group: group,
      time: time, velocity: vel, bass: false
    }));
  }
  if (opts.bass != null && !this.bandOwnsBass()) {   // v75: with Band on, the band plays the bass line
    this.voices.push(this.makeVoice({
      midi: opts.bass, engine: engine, short: false, group: group,
      time: time, velocity: 1, bass: true
    }));
  }
  this.enforceLimit();
};

// Replace whatever `group` is holding with a new chord, without hard cuts.
// Tones common to old and new chord (same pitch, role and engine) keep
// sounding (level glides to the new balance); others release with a ramp
// while the new ones fade in -> a short crossfade instead of a click.
ChordAudio.prototype.morphChord = function (group, midis, opts) {
  this.ensure();
  opts = opts || {};
  var ctx = this.ctx;
  var now = ctx.currentTime;
  var engine = opts.sound || this.sound;
  var vel = chordVelocity(midis.length);
  var want = {};
  for (var i = 0; i < midis.length; i++) want[midis[i]] = (want[midis[i]] || 0) + 1;
  var wantBass = opts.bass != null && !this.bandOwnsBass() ? opts.bass : null;
  this.bandTouch(now, midis, opts.bass);   // v75 Band
  for (var j = 0; j < this.voices.length; j++) {
    var v = this.voices[j];
    if (v.group !== group || v.short || v.released) continue;
    if (v.srcEngine === engine && v.startTime <= now + 0.005) {
      if (v.bass && wantBass != null && v.midi === wantBass) {
        wantBass = null;
        continue;
      }
      if (!v.bass && want[v.midi]) {
        want[v.midi] -= 1;
        v.setLevel(vel);
        continue;
      }
    }
    v.release(now);
  }
  for (var k = 0; k < midis.length; k++) {
    var m = midis[k];
    if (!want[m]) continue;
    want[m] -= 1;
    this.voices.push(this.makeVoice({
      midi: m, engine: engine, short: false, group: group,
      time: now, velocity: vel, bass: false
    }));
  }
  if (wantBass != null) {
    this.voices.push(this.makeVoice({
      midi: wantBass, engine: engine, short: false, group: group,
      time: now, velocity: 1, bass: true
    }));
  }
  this.enforceLimit();
};

var FADE_TAU = { piano: 3.8, epiano: 3.8, reed: 4.2, bell: 5.0, strings: 5.0, warm: 5.0 };
ChordAudio.prototype.fadeGroup = function (group) {
  if (!this.ctx) return;
  for (var i = 0; i < this.voices.length; i++) {
    var v = this.voices[i];
    if (v.group === group && !v.short && !v.released && v.fade) v.fade(FADE_TAU[v.srcEngine] || 1.2);
  }
};

ChordAudio.prototype.stopChord = function (group, when, tau, force) {
  if (!this.ctx) return;
  var t = when == null ? this.ctx.currentTime : when;
  for (var i = 0; i < this.voices.length; i++) {
    var v = this.voices[i];
    if (v.group === group && !v.short && (!v.released || force)) v.release(t, tau, force);
  }
};

ChordAudio.prototype.pluck = function (midi, opts) {
  this.ensure();
  opts = opts || {};
  var time = opts.time == null ? this.ctx.currentTime : opts.time;
  this.voices.push(this.makeVoice({
    midi: midi,
    engine: opts.sound || this.sound,
    short: true,
    group: opts.group || "pluck",
    time: time,
    velocity: opts.bass ? 1 : 0.85,
    bass: !!opts.bass
  }));
  this.enforceLimit();
};

ChordAudio.prototype.stopAll = function () {
  if (!this.ctx) return;
  var t = this.ctx.currentTime;
  this.voices.forEach(function (v) { if (!v.released) v.release(t); });
};

ChordAudio.prototype.enforceLimit = function () {
  var now = this.ctx.currentTime;
  for (var i = this.voices.length - 1; i >= 0; i--) {
    var v = this.voices[i];
    if (v.done != null && v.done <= now) {
      v.released = true;
      this.voices.splice(i, 1);
    }
  }
  var protect = this.protectedGroups || {};
  var active = this.voices.filter(function (v) { return !v.released; });
  function byStealOrder(a, b) {
    if (a.short !== b.short) return a.short ? -1 : 1;
    return a.born - b.born;
  }
  var soft = active.filter(function (v) { return !protect[v.group]; });
  var hard = active.filter(function (v) { return !!protect[v.group]; });
  soft.sort(byStealOrder);
  // Soft cap: only steal unprotected (live / pluck) voices so sustain-pooled
  // notes keep ringing until the pedal dumps them.
  while (soft.length > VOICE_CAP) {
    soft.shift().release(now, REL_TAU_STEAL);
  }
  // Hard ceiling: if sustain stacks past the safety limit, steal oldest
  // protected last (shorts still preferred via sort).
  var total = soft.length + hard.length;
  if (total > VOICE_HARD_CAP) {
    hard.sort(byStealOrder);
    while (soft.length + hard.length > VOICE_HARD_CAP && hard.length) {
      hard.shift().release(now, REL_TAU_STEAL);
    }
  }
};

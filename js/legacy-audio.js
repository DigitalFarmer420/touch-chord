var VOICE_CAP = 28;
var VOICE_HARD_CAP = 72;

// Release time-constants (setTargetAtTime). ~7-9 tau to inaudible.
var REL_TAU = 0.022;       // chord voices: ~50ms perceived release
var REL_TAU_BASS = 0.035;  // bass: a touch longer so it doesn't thump off
var REL_TAU_STEAL = 0.015; // voice stealing
var TAIL_TAUS = 9;         // stop oscillators only once gate is < -78 dB

function ChordAudio() {
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
function glide(param, target, now, tau) {
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

function clamp01(n) {
  n = Number(n);
  if (isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function makeImpulse(ctx, seconds, decay) {
  var rate = ctx.sampleRate;
  var len = Math.floor(rate * seconds);
  var buf = ctx.createBuffer(2, len, rate);
  var fadeIn = Math.floor(rate * 0.004);
  for (var c = 0; c < 2; c++) {
    var data = buf.getChannelData(c);
    for (var i = 0; i < len; i++) {
      var env = Math.pow(1 - i / len, decay);
      if (i < fadeIn) env *= i / fadeIn;
      data[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return buf;
}

// Curve over input u in [-1, 1] representing x = 2u (pre-gain 0.5 in front).
function makeSoftClip(n) {
  var curve = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var x = ((i / (n - 1)) * 2 - 1) * 2;
    var a = Math.abs(x);
    var y = a < 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2);
    curve[i] = x < 0 ? -y : y;
  }
  return curve;
}

// Warmth saturator: curve over u in [-1, 1] representing x = 4u, y = tanh(x).
function makeWarmCurve(n) {
  var curve = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var x = ((i / (n - 1)) * 2 - 1) * 4;
    curve[i] = Math.tanh(x);
  }
  return curve;
}

function makePulse(ctx) {
  var h = 24;
  var real = new Float32Array(h);
  var imag = new Float32Array(h);
  var duty = 0.28;
  for (var k = 1; k < h; k++) {
    imag[k] = Math.sin(Math.PI * k * duty) / (k * Math.PI);
  }
  return ctx.createPeriodicWave(real, imag);
}

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
function bandPc(m) { return ((m % 12) + 12) % 12; }
function Band(audio) {
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
// Bass register E1..D#2 (40..51) for the root.
function bandBassMidi(pc) { var m = 36 + pc; return m < 40 ? m + 12 : m; }
function bandIv(h, cands, dflt) { for (var i = 0; i < cands.length; i++) if (h.pcs[bandPc(h.rootPc + cands[i])]) return cands[i]; return dflt; }

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

var api = new ChordAudio();
export { api };
api.band = new Band(api);   // v75: off (level 0) until the Config Band slider is raised
if (typeof window !== "undefined") { window.ChordAudio = api; window.__tcAudioWake = function () { api.wake(); }; }

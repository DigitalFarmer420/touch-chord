// Guitar strum: Karplus-Strong plucked strings, rendered once per note into a cached
// AudioBuffer (plain JS, no AudioWorklet, so it runs the same in Android WebView / iOS).
// Per strum: one BufferSource per sounding string -> per-string gain -> a shared
// high-pass -> body peak -> closing low-pass -> strum gain -> ChordAudio bus.
// Install once: installGuitarPluck(ChordAudio) (adds strumGuitar / dampGuitar / warmGuitar).

export var GTR = {
  pickPos: 0.13,      // pick-position comb: pluck 13% of the string from the bridge
  burstLP: 0.45,      // excitation one-pole low-pass coefficient (0 = raw noise, higher = darker pick)
  bright: 0.5,        // loop averaging filter weight (0.5 = classic KS two-point average)
  t60Lo: 2.4,         // seconds to -60 dB at E2 (open low E)
  t60Hi: 1.4,         // seconds to -60 dB at E5 and above
  len: 2.6,           // buffer length (s); the last 80 ms fade out
  hpHz: 75,           // rumble high-pass
  bodyHz: 140, bodyQ: 1.1, bodyDb: 4,   // guitar body resonance
  lpOpen: 4500, lpClose: 2600, lpTau: 0.45,   // tone low-pass, closes as the strum rings
  stagger: 0.012,     // s between strings (8-15 ms is a natural strum)
  humT: 0.002,        // +- s timing humanize (strings after the first)
  humDb: 1.5,         // +- dB level humanize per string
  upDb: -2,           // up-strums a little lighter
  level: 0.48,        // strum level (SPEC.md loudness table); divided by sqrt(strings) and by the style trim
  damp: 0.04,         // s release tau when a new strum chokes the old one
  resetGap: 1.2,      // s: a strum this long after the last one is always a down-strum
  cacheMax: 72
};

var CACHE = new Map();

function rng(seed) {   // mulberry32: deterministic noise per note (testable, identical on every device)
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function t60For(midi) {
  var k = Math.min(1, Math.max(0, (midi - 40) / 36));   // E2 .. E5
  return GTR.t60Lo + (GTR.t60Hi - GTR.t60Lo) * k;
}

// Pure function, exported for unit tests: Float32Array of one plucked note.
export function ksRender(sr, midi) {
  var f = 440 * Math.pow(2, (midi - 69) / 12);
  var P = sr / f;                                   // loop delay wanted, samples
  var N = Math.floor(P - GTR.bright - 0.1);          // integer delay; averaging filter adds `bright`
  var d = P - N - GTR.bright;                        // fractional rest for the allpass (0.1..1.1)
  var C = (1 - d) / (1 + d);
  var g = Math.pow(0.001, 1 / (f * t60For(midi)));   // per-period loop gain for the wanted T60
  var len = Math.ceil(sr * GTR.len), y = new Float32Array(len);
  // Excitation: one period of noise, low-passed (pick softness), then the pick-position comb.
  var L = Math.max(2, Math.round(P)), ex = new Float32Array(L), r = rng(midi * 7919 + 17), lp = 0, i;
  for (i = 0; i < L; i++) { lp = lp * GTR.burstLP + (r() * 2 - 1) * (1 - GTR.burstLP); ex[i] = lp; }
  var M = Math.max(1, Math.round(GTR.pickPos * P)), exc = new Float32Array(L), mx = 0;
  for (i = 0; i < L; i++) { exc[i] = ex[i] - (i >= M ? ex[i - M] : 0); mx = Math.max(mx, Math.abs(exc[i])); }
  for (i = 0; i < L; i++) exc[i] /= mx || 1;
  var apX = 0, apY = 0, b = GTR.bright;
  for (i = 0; i < len; i++) {
    var a0 = i - N >= 0 ? y[i - N] : 0, a1 = i - N - 1 >= 0 ? y[i - N - 1] : 0;
    var u = (1 - b) * a0 + b * a1;                    // loss / damping filter
    var v = C * u + apX - C * apY;                    // first-order allpass: fine tuning
    apX = u; apY = v;
    y[i] = (i < L ? exc[i] : 0) + g * v;
  }
  // DC block, end fade, normalise peak to 1.
  var x1 = 0, y1 = 0, pk = 0, fade = Math.floor(sr * 0.08);
  for (i = 0; i < len; i++) {
    var o = y[i] - x1 + 0.995 * y1; x1 = y[i]; y1 = o; y[i] = o;
    if (i >= len - fade) y[i] *= 0.5 + 0.5 * Math.cos(Math.PI * (i - (len - fade)) / fade);
    pk = Math.max(pk, Math.abs(o));
  }
  for (i = 0; i < len; i++) y[i] /= pk || 1;
  return y;
}

export function ksBuffer(ctx, midi) {
  var key = ctx.sampleRate + ":" + midi;
  var hit = CACHE.get(key);
  if (hit) { CACHE.delete(key); CACHE.set(key, hit); return hit; }   // LRU touch
  var data = ksRender(ctx.sampleRate, midi);
  var buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
  if (buf.copyToChannel) buf.copyToChannel(data, 0); else buf.getChannelData(0).set(data);
  CACHE.set(key, buf);
  while (CACHE.size > GTR.cacheMax) CACHE.delete(CACHE.keys().next().value);
  return buf;
}

export function installGuitarPluck(ChordAudio) {
  var P = ChordAudio.prototype;

  // Pre-render buffers (call from requestIdleCallback when a grip is drawn) so the first tap never waits.
  P.warmGuitar = function (midis) {
    var ctx = this.ensureContext && this.ensureContext();
    if (!ctx) return;
    for (var i = 0; i < midis.length; i++) ksBuffer(ctx, midis[i]);
  };

  // Choke whatever this group is still ringing (a new strum stops the old strings, like a real hand).
  P.dampGuitar = function (group, when, tau) {
    if (!this.ctx) return;
    for (var i = 0; i < this.voices.length; i++) {
      var v = this.voices[i];
      if (v.gtr && v.group === group && !v.released) v.release(when, tau || GTR.damp);
    }
  };

  // notes: MIDI numbers in STRING order, low E string first, muted strings left out.
  // opts: { group, time, up (bool) | auto alternate, seed }
  P.strumGuitar = function (notes, opts) {
    this.ensure();
    opts = opts || {};
    var ctx = this.ctx, group = opts.group || "gtr";
    if (!ctx || !notes || !notes.length) return null;
    var t0 = opts.time == null ? ctx.currentTime + 0.004 : opts.time;
    var up = opts.up;
    if (up == null) {
      var last = this._gtrLast;
      up = !!(last && t0 - last.t < GTR.resetGap && !last.up);
    }
    this._gtrLast = { t: t0, up: up };
    this.dampGuitar(group, t0, GTR.damp);

    var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = GTR.hpHz; hp.Q.value = 0.7;
    var body = ctx.createBiquadFilter(); body.type = "peaking";
    body.frequency.value = GTR.bodyHz; body.Q.value = GTR.bodyQ; body.gain.value = GTR.bodyDb;
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.6;
    var open = Math.min(5000, Math.max(3000, GTR.lpOpen));
    lp.frequency.setValueAtTime(open, t0);
    lp.frequency.setTargetAtTime(GTR.lpClose, t0 + 0.02, GTR.lpTau);
    var out = ctx.createGain();
    var trim = typeof this.trim === "number" && this.trim > 0 ? this.trim : 1;
    var styleDb = typeof opts.styleDb === "number" ? opts.styleDb : 0;   // optional per-style fine trim (SPEC.md GTR_STYLE_DB)
    var strumLevel = GTR.level / Math.sqrt(notes.length) / trim * Math.pow(10, ((up ? GTR.upDb : 0) + styleDb) / 20);
    out.gain.setValueAtTime(strumLevel, t0);
    hp.connect(body); body.connect(lp); lp.connect(out); out.connect(this.bus);

    var order = notes.slice();
    if (up) order.reverse();
    var r = rng(opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9));
    var srcs = [], gains = [], prevT = t0 - 1, end = t0;
    for (var i = 0; i < order.length; i++) {
      var t = t0 + i * GTR.stagger + (i ? (r() * 2 - 1) * GTR.humT : 0);
      t = Math.max(t, prevT + 0.004);            // humanize never reorders strings
      prevT = t;
      var src = ctx.createBufferSource();
      src.buffer = ksBuffer(ctx, order[i]);
      var g = ctx.createGain();
      g.gain.value = Math.pow(10, ((r() * 2 - 1) * GTR.humDb) / 20);
      src.connect(g); g.connect(hp);
      src.start(t);
      srcs.push(src); gains.push(g);
      end = Math.max(end, t + src.buffer.duration);
    }
    var nodes = gains.concat([hp, body, lp, out]);
    srcs[srcs.length - 1].onended = function () {
      srcs.forEach(function (s) { try { s.disconnect(); } catch (e) {} });
      nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
    };
    var voice = {
      gtr: true, group: group, short: true, engine: "guitar", srcEngine: "guitar",
      midi: order[0], bass: false, released: false, born: t0, startTime: t0, done: end + 0.05,
      filter: lp, amp: out, gate: out, oscs: srcs,
      release: function (when, tau) {
        var tt = Math.max(ctx.currentTime, when == null ? ctx.currentTime : when);
        if (voice.released) return;
        voice.released = true;
        var k = tau || GTR.damp;
        try { out.gain.cancelScheduledValues(tt); out.gain.setValueAtTime(strumLevel, tt); out.gain.setTargetAtTime(0, tt, k); } catch (e) {}
        var stopAt = Math.max(tt + k * 8, t0 + 0.03);
        srcs.forEach(function (s) { try { s.stop(stopAt); } catch (e) {} });
        voice.done = Math.min(voice.done, stopAt + 0.05);
      },
      cancel: function () { voice.release(ctx.currentTime, 0.005); },
      fade: function (tau) { voice.release(ctx.currentTime, tau); },
      setLevel: function () {}
    };
    this.voices.push(voice);
    this.enforceLimit();
    return { up: up, times: srcs.length, t0: t0 };
  };
}

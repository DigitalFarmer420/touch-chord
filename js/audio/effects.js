// Impulse response, soft clip, warmth curve, pulse wave.

export function clamp01(n) {
  n = Number(n);
  if (isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function makeImpulse(ctx, seconds, decay) {
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
export function makeSoftClip(n) {
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
export function makeWarmCurve(n) {
  var curve = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var x = ((i / (n - 1)) * 2 - 1) * 4;
    curve[i] = Math.tanh(x);
  }
  return curve;
}

export function makePulse(ctx) {
  var h = 24;
  var real = new Float32Array(h);
  var imag = new Float32Array(h);
  var duty = 0.28;
  for (var k = 1; k < h; k++) {
    imag[k] = Math.sin(Math.PI * k * duty) / (k * Math.PI);
  }
  return ctx.createPeriodicWave(real, imag);
}

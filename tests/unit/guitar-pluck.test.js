// Karplus-Strong guitar strum: tuning, determinism, and diagram string order.
import test from "node:test";
import assert from "node:assert/strict";
import { ksRender } from "../../js/audio/guitar-pluck.js";
import { stringMidis } from "../../js/ui/gtrmath.js";
import { resolveVoicings } from "../../js/instruments/resolve.js";
import { guitar } from "../../js/instruments/profiles.js";

const SR = 48000;

function cents(midi) {
  const y = ksRender(SR, midi);
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const P = SR / f;
  const a = 4800, w = 4096;
  const corr = lag => {
    let s = 0;
    for (let i = 0; i < w; i++) s += y[a + i] * y[a + i + lag];
    return s;
  };
  let best = 0, bl = Math.floor(P);
  for (let lag = Math.floor(P * 0.9); lag <= Math.ceil(P * 1.1); lag++) {
    const s = corr(lag);
    if (s > best) { best = s; bl = lag; }
  }
  const ym = corr(bl - 1), y0 = corr(bl), yp = corr(bl + 1);
  const dlt = 0.5 * (ym - yp) / (ym - 2 * y0 + yp);
  const fe = SR / (bl + dlt);
  return 1200 * Math.log2(fe / f);
}

test("a plucked string is within 3 cents, deterministic, and fades to silence", () => {
  for (const m of [40, 45, 50, 55, 59, 64, 69, 76]) {
    const err = cents(m);
    assert.ok(Math.abs(err) <= 3, "midi " + m + " is " + err.toFixed(2) + " cents");
  }
  const a = ksRender(SR, 64), b = ksRender(SR, 64);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i], b[i]);
    assert.equal(Number.isFinite(a[i]), true);
  }
  let peak = 0;
  for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]));
  assert.ok(Math.abs(peak - 1) < 1e-5, "peak " + peak);
  assert.ok(Math.abs(a[a.length - 1]) < 1e-6, "tail " + a[a.length - 1]);
});

function grip(rootPc, type) {
  return resolveVoicings(guitar, { rootPc, type })[0];
}

test("diagram strings stay in string order and skip muted strings", () => {
  assert.deepEqual(stringMidis(grip(0, "major"), guitar.tuning), [48, 52, 55, 60, 64]);
  assert.deepEqual(stringMidis(grip(7, "major"), guitar.tuning), [43, 47, 50, 55, 59, 67]);
  assert.deepEqual(stringMidis(grip(9, "minor"), guitar.tuning), [45, 52, 57, 60, 64]);
  const f = resolveVoicings(guitar, { rootPc: 5, type: "major" });
  const barre = f.find(g => g.shapeName === "E-shape" && g.frets[0] != null) || f[0];
  assert.deepEqual(stringMidis(barre, guitar.tuning), [41, 48, 53, 57, 60, 65]);
  assert.equal(Math.min(...stringMidis(grip(0, "major"), guitar.tuning)), 48);
});

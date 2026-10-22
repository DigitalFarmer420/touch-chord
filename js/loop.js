// Phrase loop: record / play / clear, the scheduler and BPM.
import { api as ChordAudio } from "./audio/index.js?v=112.11";
import { unlock } from "./audio/unlock.js?v=112.11";
import { progStop, progPlay, prog } from "./songs/playback.js?v=112.11";
import { state, loop, fingers, phaseEl } from "./state.js?v=112.11";
import { updateSymbol } from "./ui/nowbox.js?v=112.11";
import { specFromFinger } from "./ui/pads.js?v=112.11";
import { sustainPool, poolCount } from "./ui/sustain.js?v=112.11";

function stepAt(time) {
  var s = 60 / loop.bpm / 4;
  var idx = Math.round((time - loop.startTime) / s);
  idx = ((idx % 64) + 64) % 64;
  return idx;
}

function minCycleFor() {
  if (!loop.overdub) return 0;
  return Math.floor(loop.nextIndex / 64) + 1;
}

export function armPending(finger, spec) {
  if (!loop.recording || !ChordAudio.ctx || !finger) return;
  var now = ChordAudio.currentTime();
  if (finger.pending) finalizeOne(finger, now);
  finger.pending = {
    t0: now,
    step: stepAt(now),
    midis: spec.midis.slice(),
    bass: spec.bassOut,
    sound: state.sound,
    minCycle: minCycleFor(),
    seq: ++loop.seq
  };
}

export function finalizeOne(finger, atTime) {
  if (!finger || !finger.pending) return;
  var s = 60 / loop.bpm / 4;
  var dur = Math.round((atTime - finger.pending.t0) / s);
  if (dur < 1) dur = 1;
  if (dur > 64) dur = 64;
  loop.events.push({
    kind: "chord",
    step: finger.pending.step,
    dur: dur,
    midis: finger.pending.midis,
    bass: finger.pending.bass,
    sound: finger.pending.sound,
    minCycle: finger.pending.minCycle,
    seq: finger.pending.seq
  });
  finger.pending = null;
}

function finalizePending(atTime) {
  Object.keys(fingers).forEach(function (id) { finalizeOne(fingers[id], atTime); });
  Object.keys(sustainPool).forEach(function (g) { finalizeOne(sustainPool[g], atTime); });
}

function clearPending() {
  Object.keys(fingers).forEach(function (id) { fingers[id].pending = null; });
  Object.keys(sustainPool).forEach(function (g) { sustainPool[g].pending = null; });
}

function armHeld() {
  Object.keys(fingers).forEach(function (id) {
    armPending(fingers[id], specFromFinger(fingers[id]));
  });
}

export function killLoopVoices() {
  for (var i = 0; i < loop.active.length; i++) ChordAudio.stopChord(loop.active[i].group);
  loop.active = [];
}

function ensureScheduler() {
  if (loop.timer) return;
  loop.timer = setInterval(tick, 25);
}

function stopScheduler() {
  if (loop.timer) {
    clearInterval(loop.timer);
    loop.timer = null;
  }
}

function tick() {
  if (!loop.transport || !ChordAudio.ctx) return;
  var now = ChordAudio.currentTime();
  var s = 60 / loop.bpm / 4;
  var due = loop.startTime + loop.nextIndex * s;
  if (loop.nextIndex > 0 && due < now - 0.3) {
    loop.nextIndex = Math.ceil((now - loop.startTime) / s);
    killLoopVoices();
  }
  var guard = 0;
  while (guard++ < 8) {
    var time = loop.startTime + loop.nextIndex * s;
    if (time >= now + 0.12) break;
    if (loop.recording && !loop.overdub && loop.nextIndex >= 64) commitInitial(false);
    if (loop.playing && time >= now - 0.08) trigger(loop.nextIndex, time);
    loop.nextIndex++;
  }
  paintLoop();
}

function trigger(N, time) {
  var step = ((N % 64) + 64) % 64;
  var cycle = Math.floor(N / 64);
  for (var i = loop.active.length - 1; i >= 0; i--) {
    if (loop.active[i].offIndex <= N) {
      ChordAudio.stopChord(loop.active[i].group, time);
      loop.active.splice(i, 1);
    }
  }
  var evs = loop.events.filter(function (e) {
    return e.step === step && cycle >= e.minCycle;
  });
  evs.sort(function (a, b) { return a.seq - b.seq; });
  for (var k = 0; k < evs.length; k++) {
    var e = evs[k];
    if (e.kind === "chord") {
      var g = "L" + (++loop.gid);
      ChordAudio.playChord(g, e.midis, { bass: e.bass, sound: state.sound, time: time });   // v73: replay in the active style sound
      loop.active.push({ group: g, offIndex: N + e.dur });
    } else if (e.kind === "strum") {
      ChordAudio.pluck(e.midi, { sound: state.sound, time: time, group: "loop-strum" });
    } else if (e.kind === "bass") {
      ChordAudio.pluck(e.midi, { sound: state.sound, time: time, bass: true, group: "loop-strum" });
    }
  }
  while (loop.active.length > 6) {
    var old = loop.active.shift();
    ChordAudio.stopChord(old.group, time);
  }
}

function commitInitial(restartNow) {
  if (ChordAudio.ctx) finalizePending(ChordAudio.currentTime());
  else clearPending();
  loop.recording = false;
  loop.overdub = false;
  loop.playing = true;
  if (restartNow) {
    killLoopVoices();
    loop.events.forEach(function (e) { e.minCycle = 0; });
    loop.startTime = ChordAudio.currentTime() + 0.03;
    loop.nextIndex = 0;
    loop.bpm = state.bpm;
  }
  paintLoop();
}

function startFresh() {
  killLoopVoices();
  loop.events = [];
  clearPending();
  loop.recording = true;
  loop.overdub = false;
  loop.playing = false;
  loop.transport = true;
  loop.bpm = state.bpm;
  loop.startTime = ChordAudio.currentTime() + 0.02;
  loop.nextIndex = 0;
  ensureScheduler();
  if (state.holding) armHeld();
  paintLoop();
}

function beginTransport() {
  loop.events.forEach(function (e) { e.minCycle = 0; });
  loop.transport = true;
  loop.bpm = state.bpm;
  loop.startTime = ChordAudio.currentTime() + 0.02;
  loop.nextIndex = 0;
  ensureScheduler();
}

export function stopPlayback() {
  if (loop.recording && ChordAudio.ctx) finalizePending(ChordAudio.currentTime());
  else clearPending();
  loop.recording = false;
  loop.overdub = false;
  loop.playing = false;
  loop.transport = false;
  killLoopVoices();
  stopScheduler();
  ChordAudio.band.hush();   // v104
  phaseEl.style.width = "0%";
  paintLoop();
}

export function onRecord() {
  unlock();
  progStop();   // v55: one loop at a time
  if (loop.recording && !loop.overdub) {
    commitInitial(true);
    ensureScheduler();
    return;
  }
  if (loop.recording && loop.overdub) {
    if (ChordAudio.ctx) finalizePending(ChordAudio.currentTime());
    loop.recording = false;
    loop.overdub = false;
    paintLoop();
    return;
  }
  if (loop.events.length) {
    if (!loop.transport) {
      beginTransport();
      loop.playing = true;
    }
    loop.recording = true;
    loop.overdub = true;
    ensureScheduler();
    if (state.holding) armHeld();
    paintLoop();
    return;
  }
  startFresh();
}

export function onPlay() {
  unlock();
  if (loop.recording && !loop.overdub) {
    commitInitial(true);
    ensureScheduler();
    return;
  }
  if (loop.playing) {
    stopPlayback();
    return;
  }
  if (!loop.events.length) {
    // v70: no phrase loop recorded: Play = play the progression (v111: looping, from the Next walk position).
    progPlay();   // toggles: a second tap stops it
    paintLoop();
    return;
  }
  progStop();   // v55: one loop at a time
  killLoopVoices();
  beginTransport();
  loop.playing = true;
  paintLoop();
}

export function onClear() {
  clearPending();
  loop.events = [];
  loop.recording = false;
  loop.overdub = false;
  loop.playing = false;
  loop.transport = false;
  killLoopVoices();
  stopScheduler();
  ChordAudio.band.hush();   // v104
  phaseEl.style.width = "0%";
  paintLoop();
  updateSymbol();
}

export function setBpm(bpm) {
  bpm = Math.round(Number(bpm));
  if (isNaN(bpm)) bpm = 96;
  if (bpm < 50) bpm = 50;
  if (bpm > 180) bpm = 180;
  if (loop.transport && ChordAudio.ctx) {
    var now = ChordAudio.currentTime();
    var oldS = 60 / loop.bpm / 4;
    var elapsed = (now - loop.startTime) / oldS;
    loop.bpm = bpm;
    loop.startTime = now - elapsed * (60 / bpm / 4);
  } else {
    loop.bpm = bpm;
  }
  state.bpm = bpm;
  ChordAudio.setBpm(bpm);
  document.getElementById("bpmVal").textContent = String(bpm);
  var slider = document.getElementById("bpm");
  if (slider.value !== String(bpm)) slider.value = String(bpm);
}

function loopLabel() {
  var base = "Empty";
  if (loop.recording && loop.overdub) base = "Overdub";
  else if (loop.recording) base = "Recording";
  else if (loop.playing) base = "Playing";
  else if (loop.events.length) base = "Loop " + loop.events.length;
  if (loop.transport && ChordAudio.ctx) {
    var s = 60 / loop.bpm / 4;
    var pos = (ChordAudio.currentTime() - loop.startTime) / s;
    var step = Math.floor(((pos % 64) + 64) % 64);
    var bar = Math.floor(step / 16) + 1;
    var beat = Math.floor((step % 16) / 4) + 1;
    base += " · " + bar + "." + beat;
    phaseEl.style.width = ((((pos % 64) + 64) % 64) / 64 * 100) + "%";
  } else if (!loop.transport) {
    phaseEl.style.width = "0%";
  }
  return base;
}

export function paintLoop() {
  var rec = document.getElementById("rec");
  var play = document.getElementById("play");
  rec.classList.toggle("on", loop.recording);
  rec.setAttribute("aria-pressed", loop.recording ? "true" : "false");
  rec.textContent = loop.recording ? "Stop rec" : "Record";
  var seq = !loop.events.length && typeof prog !== "undefined" && prog && prog.playing;   // v70 sequence autoplay
  play.classList.toggle("on", loop.playing || !!seq);
  play.textContent = loop.playing || seq ? "Stop" : "Play";
  document.getElementById("loopStatus").textContent = loopLabel();
  var sym = document.getElementById("symbol");
  sym.classList.toggle("sounding", state.holding || poolCount() > 0 || loop.active.length > 0 || loop.playing);
}

// iOS audio unlock: silent audio loop, playback session, first-tap unlock.
import { api as ChordAudio } from "./index.js?v=112.8";
import { shared } from "../state.js?v=112.8";

// ---- iOS ring/silent switch bypass ----
// iOS 17+: navigator.audioSession.type = "playback". Older iOS: a looping,
// silent, inline <audio> element started inside a user gesture moves the
// page's audio session to the playback category, so Web Audio is no longer
// muted by the silent switch. iOS/iPadOS only.
var IS_IOS;
var silentAudio;
var silentAudioHidden;

function setPlaybackSession() {
  try {
    if ("audioSession" in navigator && navigator.audioSession.type !== "playback") {
      navigator.audioSession.type = "playback";
    }
  } catch (err) { /* ignore */ }
}

// ~0.5 s of 8 kHz mono 8-bit PCM silence as a WAV data URI.
function silentWavDataUri() {
  var rate = 8000, n = 4000, bytes = new Uint8Array(44 + n), i;
  function str(o, t) { for (var k = 0; k < t.length; k++) bytes[o + k] = t.charCodeAt(k); }
  function u32(o, v) { bytes[o] = v & 255; bytes[o + 1] = (v >> 8) & 255; bytes[o + 2] = (v >> 16) & 255; bytes[o + 3] = (v >>> 24) & 255; }
  function u16(o, v) { bytes[o] = v & 255; bytes[o + 1] = (v >> 8) & 255; }
  str(0, "RIFF"); u32(4, 36 + n); str(8, "WAVE");
  str(12, "fmt "); u32(16, 16); u16(20, 1); u16(22, 1); u32(24, rate); u32(28, rate); u16(32, 1); u16(34, 8);
  str(36, "data"); u32(40, n);
  for (i = 0; i < n; i++) bytes[44 + i] = 128;
  var bin = "";
  for (i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
}

// Must run synchronously inside the user gesture.
function startSilentAudio() {
  if (!IS_IOS || silentAudioHidden) return;
  try {
    if (!silentAudio) {
      var a = document.createElement("audio");
      a.setAttribute("playsinline", "");
      a.setAttribute("webkit-playsinline", "");
      a.setAttribute("x-webkit-airplay", "deny");
      a.setAttribute("aria-hidden", "true");
      a.disableRemotePlayback = true;
      a.preload = "auto";
      a.loop = true;
      a.controls = false;
      a.style.display = "none";
      a.src = silentWavDataUri();
      try { a.volume = 0.01; } catch (err) { /* iOS: read-only */ }
      (document.body || document.documentElement).appendChild(a);
      silentAudio = a;
    }
    if (silentAudio.paused) {
      var p = silentAudio.play();
      if (p && typeof p.catch === "function") p.catch(function () { /* retry on next gesture */ });
    }
  } catch (err2) { /* ignore */ }
}

export function unlock() {
  setPlaybackSession();
  startSilentAudio();
  var pendingResume = ChordAudio.resume();
  var banner = document.getElementById("unlock");
  function hideBanner() {
    if (shared.unlocked) return;
    shared.unlocked = true;
    if (banner) banner.hidden = true;
  }
  if (ChordAudio.ctx && ChordAudio.ctx.state === "running") {
    hideBanner();
  } else if (pendingResume && typeof pendingResume.then === "function") {
    pendingResume.then(function () {
      if (ChordAudio.ctx && ChordAudio.ctx.state === "running") hideBanner();
    });
  }
  return pendingResume;
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent || "") ||
    (/Mac/.test(navigator.platform || "") && (navigator.maxTouchPoints || 0) > 1);
silentAudio = null;
silentAudioHidden = false;

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      silentAudioHidden = true;
      if (silentAudio) { try { silentAudio.pause(); } catch (err) { /* ignore */ } }
    } else {
      // Resumed by startSilentAudio() on the next user gesture.
      silentAudioHidden = false;
    }
  });
}

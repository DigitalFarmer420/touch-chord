// Register the offline service worker (feature-detected, not in the Android/Capacitor wrapper).
// Install/wait behaviour is unchanged when a test query is present: the new worker waits for a
// cold launch, or for window.tc.applyUpdate() when transport is not playing.
import { BUILD_ID } from "./version.js?v=2026.11.27.15";
import { prog } from "./songs/playback.js?v=2026.11.27.15";
import { makeApplyUpdate, isNativeWrapper } from "./offline-update.js?v=2026.11.27.15";

export function readTransportState() {
  if (typeof window !== "undefined" && window.__tcTest && typeof window.__tcTest.transport === "function") {
    try {
      var snap = window.__tcTest.transport();
      if (snap && typeof snap.state === "string") return snap.state;
      if (snap && snap.playing) return "playing";
    } catch (err) {}
  }
  try { if (prog && prog.playing) return "playing"; } catch (err2) {}
  return "idle";
}

var waitingWorker = null;
var applyApi = null;
var pollT = 0;

function getWaiting() { return waitingWorker; }

function postSkipWaiting(worker) {
  if (!worker) return;
  try { worker.postMessage({ type: "SKIP_WAITING" }); } catch (err) {}
}

function reloadPage() {
  if (typeof location !== "undefined" && location.reload) location.reload();
}

function startDeferPoll() {
  if (pollT || typeof setInterval === "undefined") return;
  pollT = setInterval(function () {
    if (!applyApi || !applyApi.isDeferred()) { clearInterval(pollT); pollT = 0; return; }
    applyApi.onTransport(readTransportState());
  }, 400);
}

function notifyUpdateReady(worker) {
  waitingWorker = worker || waitingWorker;
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent("tc:update-ready")); } catch (err) {}
}

function watchRegistration(reg) {
  if (!reg) return;
  if (reg.waiting) notifyUpdateReady(reg.waiting);
  reg.addEventListener("updatefound", function () {
    var inst = reg.installing;
    if (!inst) return;
    inst.addEventListener("statechange", function () {
      if (inst.state === "installed" && navigator.serviceWorker && navigator.serviceWorker.controller) {
        notifyUpdateReady(inst);
      }
    });
  });
}

function bindApplyUpdate() {
  applyApi = makeApplyUpdate({
    getTransport: readTransportState,
    getWaiting: getWaiting,
    postSkipWaiting: postSkipWaiting,
    reload: reloadPage
  });
  if (typeof window === "undefined") return applyApi;
  window.tc = window.tc || {};
  window.tc.applyUpdate = function () {
    var result = applyApi.applyUpdate();
    if (result === "deferred") startDeferPoll();
    return result;
  };
  window.addEventListener("tc:transport", function (e) {
    var state = e && e.detail && e.detail.state;
    if (applyApi) applyApi.onTransport(state || readTransportState());
  });
  if (navigator.serviceWorker) {
    var reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (reloading) return;
      reloading = true;
      reloadPage();
    });
  }
  return applyApi;
}

export function boot() {
  bindApplyUpdate();
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (isNativeWrapper()) return;
  var url = new URL("sw.js?v=" + BUILD_ID, (typeof document !== "undefined" && document.baseURI) || location.href);
  navigator.serviceWorker.register(url.href, { scope: "./", updateViaCache: "none" }).then(watchRegistration).catch(function () {});
}

export { makeApplyUpdate, isNativeWrapper };

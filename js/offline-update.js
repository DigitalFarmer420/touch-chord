// Pure applyUpdate policy for the offline service worker. No DOM, no SW APIs.
// Transport "playing" must never skipWaiting or reload; idle and paused may apply.

export function shouldApplyUpdate(transportState, hasWaiting) {
  if (!hasWaiting) return "none";
  if (transportState === "playing") return "deferred";
  return "apply";
}

// io: { getTransport, getWaiting, postSkipWaiting, reload }
// getTransport() -> "idle" | "playing" | "paused"
// Returns true when a switch+reload was started, "deferred" when playing,
// false when there is no waiting worker.
export function makeApplyUpdate(io) {
  var deferred = false;
  function applyUpdate() {
    var waiting = io.getWaiting ? io.getWaiting() : null;
    var state = io.getTransport ? (io.getTransport() || "idle") : "idle";
    var decision = shouldApplyUpdate(state, !!waiting);
    if (decision === "none") { deferred = false; return false; }
    if (decision === "deferred") { deferred = true; return "deferred"; }
    deferred = false;
    if (io.postSkipWaiting) io.postSkipWaiting(waiting);
    if (io.reload) io.reload();
    return true;
  }
  function onTransport(state) {
    if (deferred && shouldApplyUpdate(state, !!(io.getWaiting && io.getWaiting())) === "apply") applyUpdate();
  }
  return { applyUpdate: applyUpdate, onTransport: onTransport, isDeferred: function () { return deferred; } };
}

export function isNativeWrapper(win) {
  if (!win) return false;
  if (win.Capacitor || win.cordova) return true;
  try {
    var p = win.location && win.location.protocol;
    if (p === "capacitor:" || p === "ionic:" || p === "file:") return true;
  } catch (err) {}
  return false;
}

// Registration and cache-name helpers. A version bump must change both the
// script URL (browser byte check) and the cache name (activate cleanup).
export function serviceWorkerScriptUrl(version) {
  return "sw.js?v=" + version;
}

export function cacheNameFor(scopePath, version) {
  return "touch-chord" + scopePath + version;
}

export function obsoleteCaches(keys, scopePath, version) {
  var prefix = "touch-chord" + scopePath;
  var keep = prefix + version;
  return keys.filter(function (k) {
    return k.indexOf(prefix) === 0 && k !== keep;
  });
}

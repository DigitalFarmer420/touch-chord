// Classic (non-module) script, loaded synchronously in <head> before first paint:
// text scale (--tx), the tc-boot flash guard, the iOS audio session, size classes and Simple-before-paint.
/* v57: text scale. Text and chord labels are 13% smaller on phones, easing to 8% smaller on
   big screens (short side 400 -> 900 CSS px). Boxes and tap targets don't change; the strip
   fits its chips at full size and then draws the names at this scale. */
(function () {
  function tx() {
    var s = Math.min(window.innerWidth || 0, window.innerHeight || 0) || 400;
    var t = 0.87 + 0.05 * Math.max(0, Math.min(1, (s - 400) / 500));
    document.documentElement.style.setProperty("--tx", t.toFixed(3));
  }
  tx();
  window.addEventListener("resize", tx);
})();

/* Hide controls until saved settings are applied (no default-then-jump flash). Failsafe unhides. */
document.documentElement.className += " tc-boot";
setTimeout(function () { document.documentElement.classList.remove("tc-boot"); }, 1500);
/* iOS 17+/Safari 17+: "playback" audio session so Web Audio ignores the ring/silent switch.
   Set before any AudioContext exists; re-applied in unlock(). */
try { if ("audioSession" in navigator) navigator.audioSession.type = "playback"; } catch (err) { /* ignore */ }
/* Size class for the v20 responsive layout. Runs before first paint and again on resize.
   compact = w < 600 or (landscape and h < 500); regular = w >= 768 and h >= 600; else medium.
   Layout: regular -> pad-port / pad-land; otherwise phone-port / phone-land. */
window.tcApplySizeClass = function () {
  var de = document.documentElement;
  var w = window.innerWidth || de.clientWidth;
  var h = window.innerHeight || de.clientHeight;
  var land = w > h;
  var sz = (w < 600 || (land && h < 500)) ? "compact" : (w >= 768 && h >= 600 ? "regular" : "medium");
  var lay = sz === "regular" ? (land ? "pad-land" : "pad-port") : (land ? "phone-land" : "phone-port");
  var want = { "sz-compact": sz === "compact", "sz-medium": sz === "medium", "sz-regular": sz === "regular",
    "lay-phone-port": lay === "phone-port", "lay-phone-land": lay === "phone-land",
    "lay-pad-port": lay === "pad-port", "lay-pad-land": lay === "pad-land" };
  for (var k in want) { if (de.classList.contains(k) !== want[k]) de.classList.toggle(k, want[k]); }
  return { size: sz, layout: lay };
};
window.tcApplySizeClass();
/* Simple mode before first paint (the app re-applies it from saved settings). */
try {
  var tcRaw = window.localStorage && window.localStorage.getItem("touchChord.settings.v1");
  var tcEnv = tcRaw ? JSON.parse(tcRaw) : null;
  if (tcEnv && tcEnv.settings && tcEnv.settings.simple === true) document.documentElement.classList.add("simple");   // v107: Full unless saved Simple
} catch (err) { /* ignore */ }

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
   compact = w < 600 or (landscape and h < 500); regular = w >= 744 and h >= 600; else medium.
   744 is iPad mini portrait (744x1133), so that size uses the iPad layout. 700x900 stays medium.
   Layout: regular -> pad-port / pad-land; otherwise phone-port / phone-land. */
window.tcApplySizeClass = function () {
  var de = document.documentElement;
  var w = window.innerWidth || de.clientWidth;
  var h = window.innerHeight || de.clientHeight;
  var land = w > h;
  var sz = (w < 600 || (land && h < 500)) ? "compact" : (w >= 744 && h >= 600 ? "regular" : "medium");
  var lay = sz === "regular" ? (land ? "pad-land" : "pad-port") : (land ? "phone-land" : "phone-port");
  var want = { "sz-compact": sz === "compact", "sz-medium": sz === "medium", "sz-regular": sz === "regular",
    "lay-phone-port": lay === "phone-port", "lay-phone-land": lay === "phone-land",
    "lay-pad-port": lay === "pad-port", "lay-pad-land": lay === "pad-land" };
  for (var k in want) { if (de.classList.contains(k) !== want[k]) de.classList.toggle(k, want[k]); }
  /* Big windows (Vinh, 20 Nov: option B). Past the iPad reference size (1180x820 landscape, 820x1180 portrait) the whole
     page scales up with CSS zoom, text included, so a 1920x1080 window looks like the 1180x820 layout at 1.32x instead of
     the same small controls in more space. Phones, iPads up to the reference size and short wide windows keep zoom 1. */
  var z = 1;
  if (lay === "pad-land") z = Math.min(w / 1180, h / 820);
  else if (lay === "pad-port") z = Math.min(w / 820, h / 1180);
  z = z > 1 ? Math.round(z * 1000) / 1000 : 1;
  if (window.tcZoom !== z) {
    window.tcZoom = z;
    de.style.zoom = z === 1 ? "" : String(z);
    de.style.setProperty("--tcz", String(z));
  }
  return { size: sz, layout: lay, zoom: z };
};
window.tcZoom = 1;
/* Under zoom, CSS lengths are in page px but getBoundingClientRect / getClientRects / innerWidth are in screen px.
   The layout code mixes rects with offsetWidth, scrollTop and inline px styles, so while zoom is on the rect
   functions report page px (rect / zoom) and tcVW / tcVH give the viewport in page px. Pointer clientX / clientY stay
   in screen px; code that compares them with a rect divides by tcZoom. At zoom 1 the native functions run unchanged. */
window.tcVW = function () { return window.innerWidth / window.tcZoom; };
window.tcVH = function () { return window.innerHeight / window.tcZoom; };
(function () {
  function scaled(r) { var z = window.tcZoom; return new DOMRect(r.x / z, r.y / z, r.width / z, r.height / z); }
  [window.Element, window.Range].forEach(function (C) {
    if (!C || !C.prototype.getBoundingClientRect || typeof DOMRect !== "function") return;
    var gb = C.prototype.getBoundingClientRect, gl = C.prototype.getClientRects;
    C.prototype.getBoundingClientRect = function () { var r = gb.call(this); return window.tcZoom === 1 ? r : scaled(r); };
    C.prototype.getClientRects = function () {
      var l = gl.call(this); if (window.tcZoom === 1) return l;
      var out = []; for (var i = 0; i < l.length; i++) out.push(scaled(l[i]));
      out.item = function (i) { return out[i] || null; }; return out;
    };
  });
})();
window.tcApplySizeClass();
/* Simple mode before first paint (the app re-applies it from saved settings). */
try {
  var tcRaw = window.localStorage && window.localStorage.getItem("touchChord.settings.v1");
  var tcEnv = tcRaw ? JSON.parse(tcRaw) : null;
  if (tcEnv && tcEnv.settings && tcEnv.settings.simple === true) document.documentElement.classList.add("simple");   // v107: Full unless saved Simple
  /* Kids redesign: the Kids view before first paint (a first visit, or saved Simple); its Lamplight look. */
  var tcFirst = !tcRaw && !(/[?&]test=1(&|$)/.test(location.search) && !/[?&]kv=1(&|$)/.test(location.search));   /* tests: a fresh ?test=1 opens the full app as before; ?test=1&kv=1 = a real first visit */
  if ((tcFirst || (tcEnv && tcEnv.settings && tcEnv.settings.expert === false)) && !/[?&]expert=1(&|$)/.test(location.search)) document.documentElement.classList.add("kv");   /* redesign-dev: ?expert=1 opens Expert */
  /* rd6 Look: "lamp", or Auto (no / "auto" theme) outside Day hours (7:00-19:00) = Lamp; a saved "day" stays Day */
  var tcTh = tcEnv && tcEnv.settings ? tcEnv.settings.theme : null, tcH = new Date().getHours(), tcHq = /[?&]test=1(&|$)/.test(location.search) && /[?&]hour=(\d{1,2})(&|$)/.exec(location.search);
  if (tcHq) tcH = +tcHq[1];
  if (tcTh === "lamp" || (tcTh !== "day" && !(tcH >= 7 && tcH < 19))) document.documentElement.classList.add("kv-lamp");
} catch (err) { /* ignore */ }

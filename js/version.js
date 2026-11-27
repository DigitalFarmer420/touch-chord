// APP_VERSION (the one version constant) and the "Version x" label in the gear menu.
var APP_VERSION = "2026.11.27.7";   // display only ("Version 2026.11.27.7")
// APP_BUILD: the full build name shown in Settings ("Build ..."). Web builds keep this default. The APK packaging step
// rewrites it from android/app/build.gradle versionName before `npx cap sync`: python3 tools/write-build.py <versionName>
// (or --gradle <path to build.gradle>). Only this line changes; APP_VERSION and the ?v= tags stay as they are.
var APP_BUILD = "2026.11.27.7-web";
// BUILD_ID keys the offline cache and every ?v= tag on a deployed site. In the repo it equals APP_VERSION.
// The Pages deploy stamps a copy of the site with python3 tools/stamp-build.py <dir> <sha>, which sets it to
// APP_VERSION-<short sha> here and in every ?v= tag, so each deploy (even a JS- or CSS-only one) is a new
// sw.js?v=BUILD_ID registration with its own cache. Never commit a stamped value.
var BUILD_ID = "2026.11.27.7";
export { APP_VERSION, APP_BUILD, BUILD_ID };
document.addEventListener("DOMContentLoaded", function () {
var v = document.getElementById("appVersion");
if (v) { v.textContent = "Version " + APP_VERSION; v.title = "Build " + APP_BUILD; v.dataset.build = APP_BUILD; }
});

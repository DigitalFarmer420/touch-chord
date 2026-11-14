// APP_VERSION (the one version constant) and the "Version x" label in the gear menu.
var APP_VERSION = "112.13";   // display only ("Version 112.13")
// APP_BUILD: the full build name shown in Settings ("Build ..."). Web builds keep this default. The APK packaging step
// rewrites it from android/app/build.gradle versionName before `npx cap sync`: python3 tools/write-build.py <versionName>
// (or --gradle <path to build.gradle>). Only this line changes; APP_VERSION and the ?v= tags stay as they are.
var APP_BUILD = "112.13-web";
export { APP_VERSION, APP_BUILD };
document.addEventListener("DOMContentLoaded", function () {
var v = document.getElementById("appVersion");
if (v) { v.textContent = "Version " + APP_VERSION; v.title = "Build " + APP_BUILD; v.dataset.build = APP_BUILD; }
});

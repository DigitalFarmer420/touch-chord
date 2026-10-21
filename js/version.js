// APP_VERSION (the one version constant) and the "Version x" label in the gear menu.
var APP_VERSION = "112.10";   // display only ("Version 112.10")
export { APP_VERSION };
document.addEventListener("DOMContentLoaded", function () {
var v = document.getElementById("appVersion");
if (v) v.textContent = "Version " + APP_VERSION;
});

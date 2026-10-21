// Entry point. Loads every module, then runs the boot steps in the v112.3 order.
import { APP_VERSION } from "./version.js?v=112.7";
import { accSym } from "./theory/spelling.js?v=112.7";
import "./version.js?v=112.7";
import "./theory/chords.js?v=112.7";
import "./theory/index.js?v=112.7";
import "./theory/keys.js?v=112.7";
import "./theory/names.js?v=112.7";
import "./theory/quality.js?v=112.7";
import "./theory/spelling.js?v=112.7";
import "./theory/voicing.js?v=112.7";
import "./audio/band.js?v=112.7";
import "./audio/bass.js?v=112.7";
import "./audio/effects.js?v=112.7";
import "./audio/engine.js?v=112.7";
import "./audio/index.js?v=112.7";
import "./audio/synths.js?v=112.7";
import "./keys.js?v=112.7";
import "./kids.js?v=112.7";
import "./loop.js?v=112.7";
import "./songs/kids-songs.js?v=112.7";
import "./songs/magic.js?v=112.7";
import "./styles.js?v=112.7";
import "./ui/gear.js?v=112.7";
import "./ui/lyrics.js?v=112.7";
import "./ui/palette.js?v=112.7";
import "./ui/progbar.js?v=112.7";
import "./ui/pulse.js?v=112.7";
import "./ui/songbar.js?v=112.7";
import "./ui/upload-dialog.js?v=112.7";
import "./ui/wire.js?v=112.7";
import * as state from "./state.js?v=112.7";
import * as audioUnlock from "./audio/unlock.js?v=112.7";
import * as uiPads from "./ui/pads.js?v=112.7";
import * as uiSustain from "./ui/sustain.js?v=112.7";
import * as uiKeyboard from "./ui/keyboard.js?v=112.7";
import * as uiStrip from "./ui/strip.js?v=112.7";
import * as songsPresets from "./songs/presets.js?v=112.7";
import * as songsPlayback from "./songs/playback.js?v=112.7";
import * as uiNext from "./ui/next.js?v=112.7";
import * as songsPlayalong from "./songs/playalong.js?v=112.7";
import * as uiHints from "./ui/hints.js?v=112.7";
import * as uiTour from "./ui/tour.js?v=112.7";
import * as songsUpload from "./songs/upload.js?v=112.7";
import * as songsLibrary from "./songs/library.js?v=112.7";
import * as songsSong from "./songs/song.js?v=112.7";
import * as uiNowbox from "./ui/nowbox.js?v=112.7";
import * as uiKeychip from "./ui/keychip.js?v=112.7";
import * as settings from "./settings.js?v=112.7";
import * as uiLayout from "./ui/layout.js?v=112.7";
// Entry point: loads every module, runs the boot steps in the v112.3 order, final boot (saved settings, first song, tour), deliberate globals, test hooks with ?test=1.
import { wireKidKey } from "./kids.js?v=112.7";
import { applySettings } from "./settings.js?v=112.7";
import { PROG_TEST } from "./songs/playback.js?v=112.7";
import { factoryDefaults, loadSettings, collectSettings, shared } from "./state.js?v=112.7";
import { wireConfig } from "./ui/gear.js?v=112.7";
import { wireKeyPick } from "./ui/keychip.js?v=112.7";
import { wireLayoutUi } from "./ui/layout.js?v=112.7";
import { updateSymbol } from "./ui/nowbox.js?v=112.7";
import { renderPads } from "./ui/pads.js?v=112.7";
import { wireProg } from "./ui/progbar.js?v=112.7";
import { tourDone, tourStart } from "./ui/tour.js?v=112.7";
import { wireUpload } from "./ui/upload-dialog.js?v=112.7";
import { wire } from "./ui/wire.js?v=112.7";

var startBanner;

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
startBanner = document.getElementById("unlock");
  if (startBanner) startBanner.textContent = "Tap anywhere to enable sound";

  try {
    wire();
    wireConfig();
    wireKeyPick();
    wireKidKey();
    wireProg();
    wireUpload();
    wireLayoutUi();
    // v52: fade the style row's right edge while more styles are scrolled out of view.
    (function () {
      var row = document.getElementById("styles");
      function fade() { row.classList.toggle("more", row.scrollWidth - row.clientWidth - row.scrollLeft > 2); }
      // v53: full mode, phone landscape: step the buttons tighter until all of them show.
      function fitStyles() {
        var root = document.documentElement;
        row.classList.remove("fit-1", "fit-2", "fit-3", "fit-4");
        if (root.classList.contains("lay-phone-land")) {
          var over = function () {
            var last = row.lastElementChild.getBoundingClientRect(), rr = row.getBoundingClientRect();
            return row.scrollWidth > row.clientWidth || last.right > rr.right - 1;
          };
          for (var i = 1; i <= 4 && over(); i++) {
            row.classList.remove("fit-" + (i - 1));
            row.classList.add("fit-" + i);
          }
        }
        fade();
      }
      row.addEventListener("scroll", fade, { passive: true });
      window.addEventListener("resize", fitStyles);
      if (window.MutationObserver) new MutationObserver(fitStyles).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      setTimeout(fitStyles, 0); setTimeout(fitStyles, 400);
    })();
    var initial;
    try { initial = loadSettings(); } catch (err) { initial = factoryDefaults(); }
    try { applySettings(initial); } catch (err2) { applySettings(factoryDefaults()); }
    renderPads();
    updateSymbol();
    shared.lastSaved = JSON.stringify(collectSettings());
    shared.persistReady = true;
    if (shared.firstFresh && !tourDone() && (!PROG_TEST || /[?&]tour=1(&|$)/.test(location.search))) setTimeout(function () { tourStart(false); }, 700);   // v112: once, after the fresh Kids + Twinkle load (tests: only with tour=1)
  } finally {
    document.documentElement.classList.remove("tc-boot");
  }
}

// Deliberate globals kept from v112.3 (console and tests). Theory, ChordAudio and __tcAudioWake are set in theory/index.js and audio/index.js.
window.APP_VERSION = APP_VERSION;
window.accSym = accSym;

// Test hooks: only with ?test=1 (window.__* helpers used by the Playwright suites).
if (/[?&]test=1(&|$)/.test(location.search)) import("./test-hooks.js?v=112.7").then(function (m) { m.install(); });

state.boot();
audioUnlock.boot();
uiPads.boot1();
uiSustain.boot();
uiPads.boot2();
uiKeyboard.boot();
uiStrip.boot1();
songsPresets.boot();
songsPlayback.boot();
uiNext.boot();
songsPlayalong.boot();
uiHints.boot();
uiTour.boot();
songsUpload.boot();
songsLibrary.boot();
songsSong.boot();
uiStrip.boot2();
uiNowbox.boot();
uiKeychip.boot();
settings.boot();
uiLayout.boot();
boot();

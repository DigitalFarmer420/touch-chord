// Entry point. Loads every module, then runs the boot steps in the v112.3 order.
import { APP_VERSION } from "./version.js?v=112.3";
import { accSym } from "./theory/spelling.js?v=112.3";
import "./version.js?v=112.3";
import "./theory/chords.js?v=112.3";
import "./theory/index.js?v=112.3";
import "./theory/keys.js?v=112.3";
import "./theory/spelling.js?v=112.3";
import "./theory/voicing.js?v=112.3";
import "./audio/band.js?v=112.3";
import "./audio/bass.js?v=112.3";
import "./audio/effects.js?v=112.3";
import "./audio/engine.js?v=112.3";
import "./audio/index.js?v=112.3";
import "./audio/synths.js?v=112.3";
import "./keys.js?v=112.3";
import "./kids.js?v=112.3";
import "./loop.js?v=112.3";
import "./songs/kids-songs.js?v=112.3";
import "./songs/magic.js?v=112.3";
import "./styles.js?v=112.3";
import * as state from "./state.js?v=112.3";
import * as legacy from "./legacy.js?v=112.3";
import * as songsPresets from "./songs/presets.js?v=112.3";
import * as songsPlayback from "./songs/playback.js?v=112.3";
import * as songsPlayalong from "./songs/playalong.js?v=112.3";
import * as songsUpload from "./songs/upload.js?v=112.3";
import * as songsLibrary from "./songs/library.js?v=112.3";
import * as songsSong from "./songs/song.js?v=112.3";
import * as settings from "./settings.js?v=112.3";

// Deliberate globals kept from v112.3 (console and tests). Theory, ChordAudio and __tcAudioWake are set in theory/index.js and audio/index.js.
window.APP_VERSION = APP_VERSION;
window.accSym = accSym;

// Test hooks: only with ?test=1 (window.__* helpers used by the Playwright suites).
if (/[?&]test=1(&|$)/.test(location.search)) import("./test-hooks.js?v=112.3").then(function (m) { m.install(); });

state.boot();
legacy.boot1();
songsPresets.boot();
songsPlayback.boot();
legacy.boot2();
songsPlayalong.boot();
legacy.boot3();
songsUpload.boot();
songsLibrary.boot();
songsSong.boot();
legacy.boot4();
settings.boot();
legacy.boot5();

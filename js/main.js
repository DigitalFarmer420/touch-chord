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
import * as legacy from "./legacy.js?v=112.3";

// Deliberate globals kept from v112.3 (console and tests). Theory, ChordAudio and __tcAudioWake are set in theory/index.js and audio/index.js.
window.APP_VERSION = APP_VERSION;
window.accSym = accSym;

legacy.boot();

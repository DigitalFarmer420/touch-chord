// Builds the one ChordAudio api (window.ChordAudio) and its Band.
// Load every audio part first so all ChordAudio/Band prototype methods exist before the api is built.
import "./engine.js?v=112.8";
import "./synths.js?v=112.8";
import "./effects.js?v=112.8";
import "./bass.js?v=112.8";
import "./band.js?v=112.8";
import { Band } from "./band.js?v=112.8";
import { ChordAudio } from "./engine.js?v=112.8";

var api = new ChordAudio();
export { api };
api.band = new Band(api);   // v75: off (level 0) until the Config Band slider is raised
if (typeof window !== "undefined") { window.ChordAudio = api; window.__tcAudioWake = function () { api.wake(); }; }

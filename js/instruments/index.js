// Fretted-instrument chord shapes. Pure data and logic: profiles, the shape
// library, and the resolver. Nothing here touches the DOM or the screen.

export { guitar, ukulele, instruments, getInstrument } from "./profiles.js?v=2026.11.24.1";
export { shapesFor } from "./shapes.js?v=2026.11.24.1";
export { resolveVoicings, handSpan, fingerCount } from "./resolve.js?v=2026.11.24.1";

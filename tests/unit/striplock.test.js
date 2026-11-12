import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Expert song strip: with Lock, the chord names follow the live key (RE report Nov 8, R17 port to v3.2).
const UI = readFileSync(new URL("../../js/expert/ui.js", import.meta.url), "utf8");

function stripLine() {
  const at = UI.indexOf("var line = ly ?");
  assert.ok(at > 0, "song strip line found");
  return UI.slice(at, UI.indexOf("var locked = !!U.locked", at));
}

test("the Expert song strip names chords through upA(upSym(...)), like the song bar and playback", () => {
  const line = stripLine();
  assert.match(line, /upA\(upSym\(e0\.si, ci\)\)/);
  assert.doesNotMatch(line, /accSym\(c\.chord\)/, "the saved chart text is not shown as is");
});

test("ui.js imports upA from song.js and upSym from upload.js", () => {
  assert.match(UI, /import \{[^}]*\bupA\b[^}]*\} from "\.\.\/songs\/song\.js\?v=/);
  assert.match(UI, /import \{ upSym \} from "\.\.\/songs\/upload\.js\?v=/);
});

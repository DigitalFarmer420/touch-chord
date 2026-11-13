// Realistic AI answers to the Touch Chord v1.3 prompt. Each case: { id, group, text, expect: "load" | "fail-ok" }
// v3.2-ai-paste (tests/unit/aipaste.test.js). "fail-ok" = an honest error is the right answer.
import { readFileSync } from "node:fs";
const R = new URL("../upload/", import.meta.url);
const noff = readFileSync(new URL("noff-v13.min.json", R), "utf8");
const noffPretty = JSON.stringify(JSON.parse(noff), null, 2);
const small = (o = {}) => ({
  contractVersion: "1.3",
  songs: [{
    song: { title: o.title || "Let It Be", artist: o.artist || "The Beatles", key: { tonic: o.tonic || "C", mode: "major" }, sources: [{ id: "c1", url: "https://example.com/chart", title: "chart", kind: "chord-chart" }] },
    timing: { bpm: 72, bpmConfidence: 0.8, tempoFeel: "as-counted", timeSignature: "4/4", firstDownbeatSeconds: null, durationSeconds: null, unknown: ["firstDownbeatSeconds", "durationSeconds"] },
    form: ["verse1", "chorus1"],
    sections: [
      { id: "verse1", type: "verse", label: "Verse 1", startSeconds: null, endSeconds: null, timingSource: "unknown",
        bars: (o.chords || ["C", "G", "Am", "F"]).map((c, i) => ({ bar: i + 1, chords: [Object.assign({ beat: 1, chord: c, confidence: 0.9, source: "c1" }, o.bass && i === 1 ? { bass: o.bass } : {})] })),
        lyrics: [{ text: o.lyric || "When I find myself in times of trouble", markers: [{ charIndex: 0, bar: 1, beat: 1 }] }] },
      { id: "chorus1", type: "chorus", label: "Chorus", startSeconds: null, endSeconds: null, timingSource: "unknown",
        bars: ["Am", "G", "F", "C"].map((c, i) => ({ bar: i + 1, chords: [{ beat: 1, chord: c, confidence: 0.9, source: "c1" }] })) }
    ]
  }],
  notes: o.notes || "Chords from a common chart."
});
const S = (o) => JSON.stringify(small(o), null, 2);
const cases = [];
const add = (id, group, text, expect = "load", why = "") => cases.push({ id, group, text, expect, why });

// --- clean controls
add("clean-small", "control", S());
add("clean-noff-min", "control", noff);
add("clean-noff-pretty", "control", noffPretty);
// --- fences / markdown
add("fence-json", "markdown", "```json\n" + S() + "\n```");
add("fence-text", "markdown", "```text\n" + S() + "\n```");
add("fence-bare", "markdown", "```\n" + S() + "\n```");
add("fence-JSON-upper-space", "markdown", "``` JSON\n" + S() + "\n```");
add("fence-json5", "markdown", "```json5\n" + S() + "\n```");
add("fence-unclosed", "markdown", "```json\n" + S());
add("fence-4tick", "markdown", "````json\n" + S() + "\n````");
add("fence-tilde", "markdown", "~~~json\n" + S() + "\n~~~");
add("chatgpt-copy-header", "markdown", "json\nCopy code\n" + S());
add("chatgpt-copy-header2", "markdown", "Here is the song:\n\njson\n\nCopy\nEdit\n" + S() + "\n\nLet me know if you want changes!");
add("bold-header-prose", "markdown", "## 🎵 Let It Be — Touch Chord JSON\n\n**Key:** C major · **BPM:** 72\n\n```json\n" + S() + "\n```\n\n**Notes:** chords from a common chart.");
add("prose-with-braces-before", "markdown", "Sure! I filled in the form {as requested} using [the contract v1.3]:\n\n" + S() + "\n\nHope this helps.");
add("prose-example-fence-first", "markdown", "The shape is:\n```json\n{\"contractVersion\": \"1.3\", \"songs\": [ ... ]}\n```\nAnd here is the answer:\n```json\n" + S() + "\n```");
add("example-object-first", "markdown", "Example: `{\"beat\": 1, \"chord\": \"C\"}`\n\n" + S());
add("inline-backticks", "markdown", "`" + JSON.stringify(small()) + "`");
add("markdown-escaped-underscores", "markdown", S().replace(/_/g, "\\_"), "load", "markdown renderer escapes");
add("blockquote", "markdown", S().split("\n").map((l) => "> " + l).join("\n"));
add("bullet-indented", "markdown", "- Answer:\n\n    " + S().split("\n").join("\n    "));
// --- JSON slips
add("smart-quotes-all", "json-slips", S().replace(/"([^"]*)"/g, "\u201c$1\u201d"));
add("smart-quotes-mixed-close", "json-slips", S().replace(/"title": "Let It Be"/, "\u201ctitle\u201d: \u201cLet It Be\""));
add("smart-apostrophe-in-value", "json-slips", S({ lyric: "Don\u2019t let me down" }));
add("single-quotes-python", "json-slips", S().replace(/"/g, "'"));
add("python-literals", "json-slips", S().replace(/null/g, "None"));
add("trailing-commas", "json-slips", S().replace(/(\n\s*[}\]])/g, ",$1"));
add("comments-line", "json-slips", S().replace(/"form":/, "// play order\n    \"form\":"));
add("comments-block", "json-slips", S().replace(/"form":/, "/* play order */ \"form\":"));
add("comment-ellipsis", "json-slips", S().replace(/("chorus1"\]),/, "$1, // ... more\n"));
add("unquoted-keys", "json-slips", S().replace(/"(\w+)":/g, "$1:"));
add("unescaped-inner-quotes", "json-slips", S({ lyric: "She said \"let it be\" to me" }).replace('\\"let it be\\"', '"let it be"'));
add("raw-newline-in-string", "json-slips", S({ notes: "line one\nline two" }).replace("line one\\nline two", "line one\nline two"));
add("number-version", "json-slips", S().replace('"contractVersion": "1.3"', '"contractVersion": 1.3'));
add("nan-number", "json-slips", S().replace('"bpm": 72', '"bpm": NaN'));
add("truncated", "json-slips", S().slice(0, 900), "fail-ok", "cut off");
// --- unicode
add("unicode-accidentals", "unicode", S({ chords: ["B\u266d", "F\u266f", "E\u266dmaj7", "C\u266e"] , tonic: "Bb" }));
add("unicode-accidentals-dim-half", "unicode", S({ chords: ["C\u00b07", "B\u00f87", "C\u0394", "Cmaj7"] }));
add("double-flat-sharp", "unicode", S({ chords: ["C", "E\ud834\udd2b", "F\ud834\udd2a", "G"] }));
add("fullwidth-sharp", "unicode", S({ chords: ["C", "F\uff03", "G", "A"] }));
add("unicode-minus", "unicode", S({ chords: ["C", "A\u2212", "D\u20137", "G7"] }));
add("slash-chords-inline", "unicode", S({ chords: ["C", "G/B", "Am", "F/C"] }));
add("slash-chords-bass", "unicode", S({ bass: "B" }));
add("nashville-numbers", "unicode", S({ chords: ["1", "5", "6m", "4"] }), "fail-ok", "every chord is a Nashville number: a plain error, never silent chords");
add("lowercase-roots", "unicode", S({ chords: ["c", "g", "am", "f"] }));
add("emoji-in-title", "unicode", S({ title: "Let It Be \ud83c\udfb9\u2728" }));
add("vietnamese", "unicode", S({ title: "Anh \u0110\u00e3 \u1ed4n H\u01a1n", artist: "RPT MCK" }));
add("combining-diacritics-nfd", "unicode", S({ title: "Anh \u0110a\u0300 O\u0302\u0309n Ho\u031bn" }));
// --- whitespace / invisible
add("crlf", "invisible", S().replace(/\n/g, "\r\n"));
add("cr-only", "invisible", S().replace(/\n/g, "\r"));
add("nbsp-indent", "invisible", S().replace(/^( +)/gm, (m) => "\u00a0".repeat(m.length)));
add("nbsp-after-colon", "invisible", S().replace(/: /g, ":\u00a0"));
add("zwsp-between-tokens", "invisible", S().replace(/,\n/g, ",\u200b\n"));
add("zwsp-inside-key", "invisible", S().replace('"tonic"', '"to\u200bnic"'));
add("zwsp-inside-chord", "invisible", S({ chords: ["C", "G\u200b", "Am", "F"] }));
add("zwj-wordjoiner", "invisible", S().replace(/,\n/g, ",\u2060\n"));
add("soft-hyphen", "invisible", S().replace('"Let It Be"', '"Let It\u00adBe"'));
add("bom-start", "invisible", "\ufeff" + S());
add("bom-after-fence", "invisible", "```json\n\ufeff" + S() + "\n```");
add("tabs", "invisible", S().replace(/  /g, "\t"));
add("line-sep-u2028", "invisible", S().replace(/,\n/g, ",\u2028"));
add("ideographic-space", "invisible", S().replace(/: /g, ":\u3000"));
add("nel-u0085", "invisible", S().replace(/,\n/g, ",\u0085"));
add("leading-trailing-ws", "invisible", "\n\n   \t" + S() + "\n\n   ");
// --- chatter / citations
add("leading-trailing-chatter", "chatter", "Great choice! Here's \"Let It Be\" filled in.\n\n" + S() + "\n\nI double-checked the bar sum. Want another song?");
add("grok-render-tags-after", "chatter", S() + "\n<grok:render type=\"render_inline_citation\"><argument name=\"citation_id\">3</argument></grok:render>");
add("grok-render-tags-inside", "chatter", S().replace('"Chords from a common chart."', '"Chords from a common chart.<grok:render type=\\"render_inline_citation\\"><argument name=\\"citation_id\\">3</argument></grok:render>"'));
add("grok-render-tags-inside-raw", "chatter", S().replace('"notes": "Chords from a common chart."', '"notes": "Chords from a common chart." <grok:render type="render_inline_citation"><argument name="citation_id">3</argument></grok:render>'));
add("chatgpt-citation-marks", "chatter", S().replace('"Chords from a common chart."', '"Chords from a common chart. \u30104\u2020source\u3011"'));
add("chatgpt-citation-outside", "chatter", S().replace('"notes": "Chords from a common chart."', '"notes": "Chords from a common chart." \u30104\u2020source\u3011'));
add("citation-link-inline", "chatter", S().replace('"url": "https://example.com/chart"', '"url": "[https://example.com/chart](https://example.com/chart)"'));
add("url-autolinked-angle", "chatter", S().replace('"url": "https://example.com/chart"', '"url": "<https://example.com/chart>"'));
// --- multi
add("two-songs-one-envelope", "multi", JSON.stringify((() => { const a = small(), b = small({ title: "Hey Jude" }); a.songs.push(b.songs[0]); return a; })(), null, 2));
add("two-envelopes-two-fences", "multi", "Song 1:\n```json\n" + S() + "\n```\nSong 2:\n```json\n" + S({ title: "Hey Jude" }) + "\n```", "load", "only the first loads?");
add("two-envelopes-bare", "multi", S() + "\n\n" + S({ title: "Hey Jude" }));
add("bare-array", "multi", JSON.stringify(small().songs, null, 2));
add("single-song-object", "multi", JSON.stringify(small().songs[0], null, 2));
add("songs-wrapped-in-key", "multi", JSON.stringify({ answer: small() }, null, 2));
add("very-long-20-songs", "multi", JSON.stringify((() => { const a = small({ notes: "x".repeat(2000) }); for (let i = 1; i < 20; i++) a.songs.push(small({ title: "Song " + i }).songs[0]); return a; })(), null, 2));
add("very-long-noff-x10-whitespace", "multi", noffPretty.replace(/\n/g, "\n" + " ".repeat(40)));
// --- non-JSON chord sheets (the AI ignored the contract)
add("chord-over-lyric", "sheet", "Let It Be — The Beatles\nKey: C\n\n[Verse]\nC              G\nWhen I find myself in times of trouble\nAm             F\nMother Mary comes to me\n\n[Chorus]\nAm  G  F  C\nLet it be, let it be", "fail-ok", "not JSON");
add("inline-bracket-chords", "sheet", "[Verse 1]\n[C]When I find my[G]self in [Am]times of [F]trouble\n[Chorus]\n[Am]Let it [G]be", "fail-ok", "not JSON");
add("nashville-sheet", "sheet", "Key of C\nVerse: 1 5 6m 4\nChorus: 6m 5 4 1", "fail-ok", "not JSON");
add("sheet-then-json", "sheet", "[Verse]\nC G Am F\n\n" + S());
add("sheet-in-fence-then-json", "sheet", "```text\n[Verse]\nC G Am F\n```\n\n```json\n" + S() + "\n```");
// --- content slips (valid JSON, AI got a field wrong) ---
const mut = (f, o) => { const a = small(o); f(a.songs[0], a); return JSON.stringify(a, null, 2); };
const sec0 = (s) => s.sections[0];
add("c-charindex-past-end", "content", mut((s) => { sec0(s).lyrics[0].markers.push({ charIndex: 200, bar: 2, beat: 1 }); }));
add("c-charindex-len-plus1", "content", mut((s) => { const L = sec0(s).lyrics[0]; L.markers.push({ charIndex: L.text.length + 1, bar: 4, beat: 1 }); }));
add("c-charindex-string", "content", mut((s) => { sec0(s).lyrics[0].markers[0].charIndex = "0"; }));
add("c-marker-bar-past-end", "content", mut((s) => { sec0(s).lyrics[0].markers.push({ charIndex: 5, bar: 9, beat: 1 }); }));
add("c-beat-0", "content", mut((s) => { sec0(s).bars[1].chords[0].beat = 0; }));
add("c-beat-5-in-4-4", "content", mut((s) => { sec0(s).bars[1].chords.push({ beat: 5, chord: "G7", confidence: 0.5, source: "c1" }); }));
add("c-beats-not-ascending", "content", mut((s) => { sec0(s).bars[1].chords = [{ beat: 3, chord: "G7", confidence: 0.5, source: "c1" }, { beat: 1, chord: "G", confidence: 0.9, source: "c1" }]; }));
add("c-beat-duplicate", "content", mut((s) => { sec0(s).bars[1].chords.push({ beat: 1, chord: "G7", confidence: 0.5, source: "c1" }); }));
add("c-beat-string", "content", mut((s) => { sec0(s).bars[1].chords[0].beat = "1"; }));
add("c-bar-0", "content", mut((s) => { sec0(s).bars[0].bar = 0; }));
add("c-form-id-mismatch", "content", mut((s) => { s.form = ["verse1", "chorus"]; }));
add("c-form-id-case", "content", mut((s) => { s.form = ["Verse1", "chorus1"]; }));
add("c-form-repeat-unwritten", "content", mut((s) => { s.form = ["verse1", "chorus1", "verse1", "chorus1"]; }));
add("c-form-missing-use-order", "content", mut((s) => { delete s.form; }));
add("c-confidence-85", "content", mut((s) => { sec0(s).bars[0].chords[0].confidence = 85; }));
add("c-confidence-string", "content", mut((s) => { sec0(s).bars[0].chords[0].confidence = "0.8"; }));
add("c-confidence-missing", "content", mut((s) => { delete sec0(s).bars[0].chords[0].confidence; }));
add("c-bpm-string-units", "content", mut((s) => { s.timing.bpm = "72 BPM"; }));
add("c-bpm-string", "content", mut((s) => { s.timing.bpm = "72"; }));
add("c-duration-mmss", "content", mut((s) => { s.timing.durationSeconds = "3:14"; s.timing.unknown = ["firstDownbeatSeconds"]; }));
add("c-start-mmss", "content", mut((s) => { sec0(s).startSeconds = "0:12"; sec0(s).timingSource = "estimated"; }));
add("c-timesig-number", "content", mut((s) => { s.timing.timeSignature = 4; }));
add("c-timesig-prose", "content", mut((s) => { s.timing.timeSignature = "4/4 (common time)"; }));
add("c-timesig-3-4-beat-4", "content", mut((s) => { s.timing.timeSignature = "3/4"; sec0(s).bars[1].chords.push({ beat: 4, chord: "G7", confidence: 0.5, source: "c1" }); }));
add("c-tonic-flat-sign", "content", mut((s) => { s.song.key.tonic = "E\u266d"; }, { chords: ["Eb", "Bb", "Cm", "Ab"] }));
add("c-tonic-with-mode", "content", mut((s) => { s.song.key.tonic = "Eb major"; }, { chords: ["Eb", "Bb", "Cm", "Ab"] }));
add("c-tonic-minor-suffix", "content", mut((s) => { s.song.key = { tonic: "Am", mode: "minor" }; }));
add("c-tonic-Cb-or-E#", "content", mut((s) => { s.song.key.tonic = "Cb"; }));
add("c-key-string", "content", mut((s) => { s.song.key = "C major"; }));
add("c-mode-dorian", "content", mut((s) => { s.song.key.mode = "dorian"; }));
add("c-year-string", "content", mut((s) => { s.song.year = "1970"; }));
add("c-capo-string", "content", mut((s) => { s.song.capo = "none"; }));
add("c-unknown-string", "content", mut((s) => { s.timing.unknown = "firstDownbeatSeconds"; }));
add("c-section-type-hook2", "content", mut((s) => { s.sections[1].type = "Chorus 2"; }));
add("c-section-type-missing", "content", mut((s) => { delete s.sections[1].type; }));
add("c-section-type-null", "content", mut((s) => { s.sections[1].type = null; }));
add("c-bars-empty-section", "content", mut((s) => { s.sections[1].bars = []; }));
add("c-chords-null", "content", mut((s) => { sec0(s).bars[1].chords = null; }));
add("c-lyrics-string", "content", mut((s) => { sec0(s).lyrics = "When I find myself in times of trouble"; }));
add("c-lyrics-no-markers", "content", mut((s) => { delete sec0(s).lyrics[0].markers; }));
add("c-lyric-text-null", "content", mut((s) => { sec0(s).lyrics[0].text = null; }));
add("c-title-missing", "content", mut((s) => { delete s.song.title; }), "fail-ok", "no title");
add("c-artist-missing", "content", mut((s) => { delete s.song.artist; }));
add("c-sources-strings", "content", mut((s) => { s.song.sources = ["https://example.com/chart"]; }));
add("c-source-id-unknown", "content", mut((s) => { sec0(s).bars[0].chords[0].source = "nope"; }));
add("c-sectionsFull-bar-mismatch", "content", mut((s) => { s.sectionsFull = JSON.parse(JSON.stringify(s.sections)); s.sectionsFull[0].bars.pop(); }));
add("c-sectionsFull-missing-id", "content", mut((s) => { s.sectionsFull = [JSON.parse(JSON.stringify(s.sections[0]))]; }));
add("c-songs-empty", "content", JSON.stringify({ contractVersion: "1.3", songs: [], notes: "Could not find chords for this song." }), "fail-ok", "no songs");
add("c-cv-1.3.1", "content", JSON.stringify(Object.assign(small(), { contractVersion: "1.3.1" }), null, 2));
add("c-cv-v1.3", "content", JSON.stringify(Object.assign(small(), { contractVersion: "v1.3" }), null, 2));
add("c-cv-1.4", "content", JSON.stringify(Object.assign(small(), { contractVersion: "1.4" }), null, 2), "fail-ok", "a contract this app doesn't know: the honest version message");
add("c-song-contractVersion-inside", "content", mut((s) => { s.contractVersion = "1.3"; }));
// --- chord spellings an AI writes (main chord and alternates)
const SPELL = ["Cmaj9#11", "G7b9#5", "Dm11", "C7sus2", "Fmaj7/A", "Bb6/9", "Abadd2", "E7(#9)", "Cmaj13", "F#\u00f8", "B\u00b0", "Bbm(maj7)", "C(add9)", "Eb2", "Gsus", "D/F#", "C/Bb", "C5", "Csus2sus4", "G7alt", "Cmaj7(#11)", "G7(b9,#5)", "Am7(add11)", "Dm7/G", "G13sus4", "C7#9b13", "Ebmaj7/Bb", "C6", "Cm6", "Cadd11", "Cmadd9", "Cdim", "Caug7", "C7b5", "Cm7b5/Gb", "G/B\u266d", "Bb/Ab", "Fmaj7#5", "E7sus4", "Asus2/C#", "C9sus4", "Dm9/C", "B7/D#", "Cmaj", "Cmin7", "C-7", "C\u03947", "Cmi7", "CM7", "Cma9", "C13#11", "C7(13)", "F/G", "Gm/Bb", "Esus4(add9)", "C Major", "A minor", "Bb7(b9)", "N.C.", "x", "%", "(C)", "C*", "C\u2019", "C7 (x2)", "| C |"];
SPELL.forEach((sym, i) => {
  const S2 = JSON.parse(S({ chords: ["C", "G", "Am", "F"] }).replace('"chord": "G"', '"chord": "XX' + i + '"').replace('"XX' + i + '"', JSON.stringify(JSON.parse('"' + sym + '"'))));
  add("chord-" + i + "-" + JSON.parse('"' + sym + '"'), "spell", JSON.stringify(S2, null, 2));
  const S3 = small(); S3.songs[0].sections[0].bars[1].chords[0].alternates = [{ chord: JSON.parse('"' + sym + '"'), reason: "richer" }];
  add("alt-" + i + "-" + JSON.parse('"' + sym + '"'), "spell-alt", JSON.stringify(S3, null, 2));
});
export default cases;

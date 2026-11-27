import fs from "node:fs";
const P = JSON.parse(fs.readFileSync("proposal.json"));
const sha = process.argv[2], val = fs.readFileSync("validate-output.txt", "utf8").trim();
const L = [];
L.push("# Touch Chord: 15 progressions per style (proposal, not integrated)", "",
"Musician, 2026-11-27 (PST). Read-only on the repo: nothing pushed, committed or changed in the app. Not played or listened to.", "",
`Source: deploy clone \`${P.source.deployClone}\`, version ${P.source.version}, commit \`${P.source.commit}\` (deployed 2026-11-27 01:35 PST), \`js/songs/presets.js\` PROG_MENU (sha256 55db4b62…0dc9).`, "",
`Deliverable: \`proposal.json\` (sha256 \`${sha}\`). One ranked list of 15 per style, existing + new, each marked \`status\`.`, "",
"## Current live counts (named families; mode charts major/minor)", "",
"| Style | Families now | Major charts | Minor charts | Added | Total |", "|---|---|---|---|---|---|");
const live = { pop: [11, 9], jazz: [10, 10], rnb: [9, 10], ballad: [10, 11], reggae: [8, 10], funk: [8, 8], yogaDeep: [7, 10], country: [9, 12], lofi: [0, 0] };
for (const [st, S] of Object.entries(P.styles)) L.push(`| ${S.label} | ${S.counts.existing} | ${live[st][0]} | ${live[st][1]} | ${S.counts.new} | ${S.counts.total} |`);
L.push("", "Family counts match the earlier v3.1 reference (pop 12, jazz 14, rnb 12, ballad 11, reggae 12, funk 10, yoga 10, country 14). The live menu has 152 mode charts (v3.1 handoff said 154 mode entries; the live menu is the v3.2 export). No style has exactly 10, so \"5 more each\" and \"15 each\" disagree: this proposal follows **15 each**, so additions are 3/1/3/4/3/5/5/1, plus 15 for the new Lofi style (40 new in total).", "",
"## Schema", "", "```", JSON.stringify(P.notation, null, 2), "```", "",
"Entry fields: `rank`, `name`, `status` (existing|new), `mode`, `steps` (roman), `appSteps` (exact PROG_MENU strings), `exampleInCAm` (C major / A minor), optional `otherMode` {mode, steps, appSteps, exampleInCAm} for existing two-mode families, `usage` on new entries. Lofi also has `newStyle: true` and `styleNote`.", "");
for (const [st, S] of Object.entries(P.styles)) {
  L.push(`## ${S.label} (${st}): ${S.counts.existing} existing + ${S.counts.new} new`, "");
  if (S.styleNote) { L.push("**Style note (for the default sound):**", ""); for (const [k, v] of Object.entries(S.styleNote)) L.push(`- ${k}: ${typeof v === "string" ? v : "`" + JSON.stringify(v) + "`"}`); L.push(""); }
  L.push("| # | Name | Status | Mode | Numerals | Example (C / Am) | Usage |", "|---|---|---|---|---|---|---|");
  for (const e of S.progressions) {
    const ch = [e].concat(e.otherMode ? [e.otherMode] : []);
    L.push(`| ${e.rank} | ${e.name} | ${e.status === "new" ? "**new**" : "existing"} | ${ch.map(c => c.mode).join(" + ")} | ${ch.map(c => c.steps.join("–")).join("<br>")} | ${ch.map(c => c.exampleInCAm.join(" ")).join("<br>")} | ${e.usage || ""} |`);
  }
  L.push("");
}
L.push("## Validation (`node validate.mjs`)", "", "Checks: 15 per style, ranks 1..15, existing charts byte-identical to live PROG_MENU and none missing; new: 4–8 steps, single mode, every quality in the app's STRIP_QUAL set, no chord twice in a row (incl. loop wrap), no exact chord repeated inside a loop, names and phone labels (feel) unique vs every live family and each other; duplicates vs all 152 live charts (all styles, both modes) and each other, key-agnostic and rotation-aware, both exact and near (same roots with major/minor/dim family, so sus/7/9/slash count as major). WARN lines are informational.", "", "```", val, "```", "",
"## Uncertain / for Crash and Vinh", "",
"- Ranking of new entries among existing ones is my judgment (song-cited loops placed higher); existing order is the live menu order.",
"- Song citations are from widely published chord charts (\"commonly charted\"); keys/voicings vary by source. Entries without a song say \"Genre\" only.",
"- New entries are single-mode (the app leaves a family out of a mode it has no chart for). So each style's major or minor menu alone will show fewer than 15. If Vinh wants 15 in each mode, every new family needs a second chart.",
"- Lofi needs code beyond data: STYLE_PRESETS/STYLE_TRIM in js/styles.js, a STRIP_SETS palette in js/ui/strip.js, the progFeel prefix regex in presets.js (add Lofi), and the style picker. The preset numbers are a starting point, not listened to.",
"- sus4 and 7sus4 (Pop Wishing Well) are not used by any live menu chart yet. Both are STRIP_QUAL keys and have guitar shapes in shapes.json; I did not rerun the guitar harness.",
"- Some new loops overlap existing ones as a contiguous part (see WARN lines), e.g. Ballad Uphill vs Reggae Sway. They are not duplicates under the rules.",
"- Nothing was played or listened to; no device test.");
fs.writeFileSync("REPORT.md", L.join("\n") + "\n");

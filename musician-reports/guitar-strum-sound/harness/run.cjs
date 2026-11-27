const { chromium } = require("playwright-core"); const fs = require("fs");
const OUT = "/workspace/chord-touch/guitar-strum-sound";
function wav(path, b64) { const pcm = Buffer.from(b64, "base64"); const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(48000, 24); h.writeUInt32LE(48000 * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path, Buffer.concat([h, pcm])); }
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
  const pg = await b.newPage(); pg.on("console", m => { if (m.type() === "error") console.error("PAGE", m.text()); }); pg.on("pageerror", e => console.error("PAGEERR", e.message));
  await pg.goto("http://127.0.0.1:8871/harness/render.html"); await pg.waitForFunction("window.ready === true", null, { timeout: 30000 });
  const styles = ["pop", "jazz", "rnb", "ballad", "reggae", "funk", "yogaDeep", "country", "lofi"], chords = ["C", "G", "Am", "F"];
  const rows = [];
  for (const s of styles) for (const c of chords) for (const k of ["grid", "cur", "new"]) {
    const r = await pg.evaluate(([k, s, c]) => window.render(k, s, c, {}), [k, s, c]); rows.push(r);
  }
  const extra = {};
  for (const c of chords) for (const k of ["grid", "cur", "new"]) {
    const r = await pg.evaluate(([k, c]) => window.render(k, "pop", c, { wav: true }), [k, c]);
    wav(`${OUT}/wav/pop-${k === "grid" ? "grid" : k === "cur" ? "current-strum" : "proposed-strum"}-${c}.wav`, r.pcm);
  }
  extra.dryNew = []; for (const c of chords) { const r = await pg.evaluate(c => window.render("new", "pop", c, { dry: true }), c); delete r.pcm; extra.dryNew.push(r); }
  extra.dryCur = []; for (const c of chords) { const r = await pg.evaluate(c => window.render("cur", "pop", c, { dry: true, vlog: true }), c); extra.dryCur.push(r); }
  extra.up = await pg.evaluate(() => window.render("new", "pop", "C", { up: true, dry: true }));
  extra.restrum = await pg.evaluate(() => window.render("new", "pop", "G", { second: 0.5, dry: true }));
  extra.pitch = await pg.evaluate(() => [40, 45, 50, 55, 59, 64, 69, 76].map(m => [m, window.ksPitch(m)]));
  extra.msPerNote = await pg.evaluate(() => window.ksTime());
  extra.msPerNote2 = await pg.evaluate(() => window.ksTime());
  fs.writeFileSync(`${OUT}/measure.json`, JSON.stringify({ rows, extra }, null, 1));
  await b.close(); console.log("DONE", rows.length);
})().catch(e => { console.error(e); process.exit(1); });

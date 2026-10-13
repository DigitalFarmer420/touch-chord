// Preload (node -r ./emulate.cjs): every Playwright context opens with phone emulation at the viewport the test
// asks for: deviceScaleFactor 3, isMobile, hasTouch (never --window-size).
const pw = require('playwright-core');
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async function (o) {
  o = Object.assign({}, o); if (!o.executablePath) delete o.executablePath;
  const b = await launch(o); const nc = b.newContext.bind(b);
  b.newContext = opts => nc(Object.assign({ viewport: { width: 360, height: 780 } }, opts, { deviceScaleFactor: 3, isMobile: true, hasTouch: true }));
  return b;
};

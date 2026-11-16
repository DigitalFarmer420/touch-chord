// Touch Chord service worker. The script is registered as sw.js?v=APP_VERSION so a
// version bump is part of the browser byte check. Precache URLs use that same v
// (with a fetch of js/version.js only if the query is missing). Do not hardcode a version.
// A new worker waits for the next cold launch (or window.tc.applyUpdate()).
// Never skipWaiting on install. Query-string test flags must not change wait behaviour.

var PRECACHE = [
  "index.html",
  "manifest.webmanifest",
  "css/base.css",
  "css/dialogs.css",
  "css/expert.css",
  "css/fit.css",
  "css/fonts.css",
  "css/keyboard.css",
  "css/kids.css",
  "css/layout.css",
  "css/modes.css",
  "css/modesheet.css",
  "css/panels.css",
  "css/simpleday.css",
  "css/simplepad.css",
  "css/strip.css",
  "css/topbar.css",
  "fonts/andika-400.woff2",
  "fonts/andika-700.woff2",
  "fonts/fredoka-variable.woff2",
  "fonts/nunito-variable.woff2",
  "images/brand/n1/symbol-1024.png",
  "images/brand/n1/symbol-192.png",
  "images/brand/n1/symbol-32.png",
  "images/brand/n1/symbol-48.png",
  "images/brand/n1/symbol-512.png",
  "images/howto-00-intro.webp",
  "images/howto-01-progressions.webp",
  "images/howto-02-sustain.webp",
  "images/howto-03-style.webp",
  "images/howto-04-grid.webp",
  "images/howto-05-make-chord.webp",
  "images/howto-06-fullrange.webp",
  "images/howto-07-keyboard.webp",
  "images/howto-08-band.webp",
  "images/howto-09-upload.webp",
  "images/howto-09b-upload-form.webp",
  "images/howto-09c-lyrics.webp",
  "images/howto-10-kids.webp",
  "js/audio/band.js",
  "js/audio/bass.js",
  "js/audio/effects.js",
  "js/audio/engine.js",
  "js/audio/index.js",
  "js/audio/synths.js",
  "js/audio/unlock.js",
  "js/boot-early.js",
  "js/expert/model.js",
  "js/expert/ui.js",
  "js/keys.js",
  "js/kids/grid.js",
  "js/kids/view.js",
  "js/kids.js",
  "js/loop.js",
  "js/main.js",
  "js/settings.js",
  "js/songs/fullchart.js",
  "js/songs/kids-songs.js",
  "js/songs/library.js",
  "js/songs/magic.js",
  "js/songs/normalize.js",
  "js/songs/playalong.js",
  "js/songs/playback.js",
  "js/songs/presets.js",
  "js/songs/proghold.js",
  "js/songs/song.js",
  "js/songs/upload.js",
  "js/songs/validate.js",
  "js/state.js",
  "js/styles.js",
  "js/test-hooks.js",
  "js/theory/chords.js",
  "js/theory/index.js",
  "js/theory/keys.js",
  "js/theory/names.js",
  "js/theory/quality.js",
  "js/theory/spelling.js",
  "js/theory/voicing.js",
  "js/ui/badgeslots.js",
  "js/ui/chordcue.js",
  "js/ui/gear.js",
  "js/ui/helpmenu.js",
  "js/ui/hints.js",
  "js/ui/kbmath.js",
  "js/ui/keyboard.js",
  "js/ui/keychip.js",
  "js/ui/layout.js",
  "js/ui/look.js",
  "js/ui/lookmath.js",
  "js/ui/lyrics.js",
  "js/ui/modesheet.js",
  "js/ui/next.js",
  "js/ui/nowbox.js",
  "js/ui/pads.js",
  "js/ui/palette.js",
  "js/ui/progbar.js",
  "js/ui/pulse.js",
  "js/ui/simplesrc.js",
  "js/ui/songbar.js",
  "js/ui/strip.js",
  "js/ui/sustain.js",
  "js/ui/touch.js",
  "js/ui/tour.js",
  "js/ui/upload-dialog.js",
  "js/ui/wire.js",
  "js/version.js",
  "js/offline.js",
  "js/offline-update.js"
];

function scopePath() {
  try { return new URL("./", self.registration.scope).pathname; }
  catch (err) { return "/"; }
}

function cacheName(version) {
  return "touch-chord" + scopePath() + version;
}

function cachePrefix() {
  return "touch-chord" + scopePath();
}

function needsVersionSuffix(path) {
  return /^(css|js|images|fonts)\//.test(path);
}

// The registered script URL is sw.js?v=APP_VERSION. That query is part of the
// browser's byte check, so a version bump installs a new worker. A fetch of
// version.js is not, and is only a fallback when v is missing from the URL.
function versionFromScriptUrl() {
  try {
    var v = new URL(self.location).searchParams.get("v");
    if (v) return v;
  } catch (err) {}
  return "";
}

function fetchVersionJs() {
  return fetch(new URL("js/version.js", self.registration.scope), { cache: "no-store" }).then(function (res) {
    if (!res.ok) throw new Error("version.js " + res.status);
    return res.text();
  }).then(function (text) {
    var m = /APP_VERSION\s*=\s*"([^"]+)"/.exec(text);
    if (!m) throw new Error("APP_VERSION missing from version.js");
    return m[1];
  });
}

function readAppVersion() {
  var v = versionFromScriptUrl();
  if (v) return Promise.resolve(v);
  return fetchVersionJs();
}

function obsoleteCaches(keys, version) {
  var keep = cacheName(version);
  var prefix = cachePrefix();
  return keys.filter(function (k) {
    return k.indexOf(prefix) === 0 && k !== keep;
  });
}

function precacheUrls(version) {
  var base = self.registration.scope;
  var out = [new URL("./", base).href];
  PRECACHE.forEach(function (path) {
    var abs = new URL(path, base).href;
    if (out.indexOf(abs) < 0) out.push(abs);
    if (needsVersionSuffix(path)) {
      var ver = new URL(path + "?v=" + version, base).href;
      if (out.indexOf(ver) < 0) out.push(ver);
    }
  });
  return out;
}

self.addEventListener("install", function (event) {
  // The new version waits until a cold launch or applyUpdate(); do not activate early.
  event.waitUntil(readAppVersion().then(function (version) {
    return caches.open(cacheName(version)).then(function (cache) {
      return cache.addAll(precacheUrls(version));
    });
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(readAppVersion().then(function (version) {
    return caches.keys().then(function (keys) {
      return Promise.all(obsoleteCaches(keys, version).map(function (k) {
        return caches.delete(k);
      }));
    });
  }));
  // Leave already-open pages on the previous worker until they reload.
});

self.addEventListener("message", function (event) {
  var data = event.data;
  var type = data && typeof data === "object" ? data.type : data;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url;
  try { url = new URL(event.request.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  var navigate = event.request.mode === "navigate" || /\/$|\/index\.html$/.test(url.pathname);
  event.respondWith(navigate ? networkFirst(event.request) : cacheFirst(event.request));
});

function networkFirst(req) {
  return fetch(req).then(function (res) {
    return res;
  }).catch(function () {
    return matchAsset(req).then(function (hit) {
      if (hit) return hit;
      return caches.match(new URL("./index.html", self.registration.scope));
    });
  });
}

function cacheFirst(req) {
  return matchAsset(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).catch(function () {
      return matchAsset(req).then(function (again) {
        if (again) return again;
        throw new Error("offline miss");
      });
    });
  });
}

function matchAsset(req) {
  return caches.match(req).then(function (exact) {
    if (exact) return exact;
    var url = new URL(req.url);
    var bare = url.origin + url.pathname;
    return caches.match(bare).then(function (noQ) {
      if (noQ) return noQ;
      var prefix = cachePrefix();
      return caches.keys().then(function (keys) {
        return keys.reduce(function (chain, k) {
          return chain.then(function (found) {
            if (found) return found;
            if (k.indexOf(prefix) !== 0) return null;
            return caches.open(k).then(function (cache) {
              return cache.keys().then(function (reqs) {
                var i, u;
                for (i = 0; i < reqs.length; i++) {
                  u = new URL(reqs[i].url);
                  if (u.pathname === url.pathname) return cache.match(reqs[i]);
                }
                return null;
              });
            });
          });
        }, Promise.resolve(null));
      });
    });
  });
}

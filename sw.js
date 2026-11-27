// Touch Chord service worker. The script is registered as sw.js?v=BUILD_ID (js/version.js). In the repo
// BUILD_ID equals APP_VERSION; each Pages deploy stamps it to APP_VERSION-<short sha> (tools/stamp-build.py),
// so every deploy, even a JS- or CSS-only one, is a new registration URL and a new worker installs even when
// sw.js bytes are unchanged. The cache name and precache ?v= URLs use that same v (with a fetch of
// js/version.js only if the query is missing). Do not hardcode a version.
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
  "css/guitar.css",
  "css/keyboard.css",
  "css/kids.css",
  "css/layout.css",
  "css/look.css",
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
  "js/instruments/index.js",
  "js/instruments/profiles.js",
  "js/instruments/resolve.js",
  "js/instruments/shapes.js",
  "js/expert/ui.js",
  "js/keys.js",
  "js/kids/grid.js",
  "js/kids/range.js",
  "js/kids/view.js",
  "js/kids.js",
  "js/loop.js",
  "js/main.js",
  "js/settings.js",
  "js/songs/aipaste.js",
  "js/songs/fullchart.js",
  "js/songs/jam.js",
  "js/songs/kids-songs.js",
  "js/songs/library.js",
  "js/songs/magic.js",
  "js/songs/normalize.js",
  "js/songs/playalong.js",
  "js/songs/playback.js",
  "js/songs/presets.js",
  "js/songs/proghold.js",
  "js/songs/song.js",
  "js/songs/transport-policy.js",
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
  "js/ui/gtrmath.js",
  "js/ui/guitar.js",
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
  "js/ui/songgrid.js",
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
    var m = /BUILD_ID\s*=\s*"([^"]+)"/.exec(text) || /APP_VERSION\s*=\s*"([^"]+)"/.exec(text);
    if (!m) throw new Error("BUILD_ID/APP_VERSION missing from version.js");
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
      // cache: "reload" skips the HTTP cache, so B's cache never stores an HTTP-cached copy of A's
      // bare files (GitHub Pages sends max-age=600).
      return cache.addAll(precacheUrls(version).map(function (u) {
        return new Request(u, { cache: "reload" });
      }));
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

// Fetch strategy.
// - Navigations (and index.html): network first, so a new deploy's HTML always loads when online.
// - Versioned assets (?v=X): this exact URL from the cache, otherwise the network. A versioned request
//   is never answered from another version's entry while the network works, so build B's HTML gets
//   B's modules (including js/offline.js, which then registers sw.js?v=B and installs B's worker).
// - Unversioned same-origin assets: exact cache match, otherwise the network.
// - Offline only (the network request failed and no exact entry exists): fall back to a copy of the
//   same path, this worker's cache first, then any cache in this scope. That keeps the app usable
//   offline when the HTML and its assets disagree, and can never mask a deploy while online.
// Same-version asset change (a deploy that changes files but not APP_VERSION): the HTML from the
// network differs from this version's cached index.html. That page then gets its subresources network
// first (no new-HTML/old-JS mix online), and this version's cache is re-filled in the background into
// a staging cache and copied over with the HTML last, so an offline reload never pairs new HTML with
// old assets or old HTML with new assets.
// Every network fetch of an app file revalidates with the server (cache: "no-cache"), so Pages'
// max-age=600 HTTP cache can never hand an old same-URL file to a new build's page.
var NET = { cache: "no-cache" };
function netFetch(req) {
  return fetch(req, NET);
}

var freshClients = {};
var refreshing = null;

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url;
  try { url = new URL(event.request.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;
  var navigate = event.request.mode === "navigate" || /\/$|\/index\.html$/.test(url.pathname);
  if (navigate) { event.respondWith(networkFirst(event)); return; }
  event.respondWith(event.clientId && freshClients[event.clientId] ? networkThenCache(event.request) : cacheFirst(event.request));
});

function networkFirst(event) {
  var req = event.request;
  return netFetch(req).then(function (res) {
    if (!res || !res.ok || res.type !== "basic" || typeof res.clone !== "function") return res;
    return res.clone().text().then(function (html) {
      return noteBuild(html, event);
    }).then(function () { return res; }, function () { return res; });
  }, function () {
    return offlineFallback(req).then(function (hit) {
      if (hit) return hit;
      return caches.match(new URL("./index.html", self.registration.scope).href, { cacheName: ownCacheName() })
        .then(function (own) { return own || caches.match(new URL("./index.html", self.registration.scope).href); });
    });
  });
}

// Only a same-version HTML change is handled here. HTML for another version (?v=B under worker A)
// loads B's assets from the network anyway (no exact match) and registers sw.js?v=B.
function noteBuild(html, event) {
  var v = versionFromScriptUrl();
  if (!v || html.indexOf("?v=" + v + '"') < 0) return Promise.resolve();
  var htmlUrl = new URL("./index.html", self.registration.scope).href;
  return caches.match(htmlUrl, { cacheName: cacheName(v) }).then(function (cached) {
    return cached ? cached.text() : "";
  }).then(function (old) {
    if (old === html) return;
    var id = event.resultingClientId || event.clientId;
    if (id) freshClients[id] = true;
    var job = refreshBuild(v);
    if (event.waitUntil) event.waitUntil(job);
  });
}

function refreshBuild(version) {
  if (refreshing) return refreshing;
  var live = cacheName(version);
  var stage = live + "~refresh";
  var htmlFirst = [new URL("./", self.registration.scope).href, new URL("./index.html", self.registration.scope).href];
  refreshing = caches.delete(stage).then(function () {
    return caches.open(stage);
  }).then(function (sc) {
    return sc.addAll(precacheUrls(version).map(function (u) {
      return new Request(u, { cache: "reload" });
    })).then(function () {
      return Promise.all([caches.open(live), sc.keys()]);
    }).then(function (both) {
      var lc = both[0], reqs = both[1];
      var assets = reqs.filter(function (r) { return htmlFirst.indexOf(r.url) < 0; });
      var pages = reqs.filter(function (r) { return htmlFirst.indexOf(r.url) >= 0; });
      function copy(list) {
        return Promise.all(list.map(function (r) {
          return sc.match(r).then(function (res) { return res && lc.put(r, res); });
        }));
      }
      return copy(assets).then(function () { return copy(pages); });
    });
  }).then(function () {
    return caches.delete(stage);
  }, function () {
    return caches.delete(stage);
  }).then(function () { refreshing = null; });
  return refreshing;
}

// Network first, cache on failure. Used for a page whose HTML is a new same-version build.
function networkThenCache(req) {
  return netFetch(req).catch(function (err) {
    return exactMatch(req).then(function (hit) {
      return hit || offlineFallback(req);
    }).then(function (hit) {
      if (hit) return hit;
      throw err || new Error("offline miss");
    });
  });
}

function cacheFirst(req) {
  return exactMatch(req).then(function (hit) {
    if (hit) return hit;
    return netFetch(req).catch(function (err) {
      return offlineFallback(req).then(function (again) {
        if (again) return again;
        throw err || new Error("offline miss");
      });
    });
  });
}

// Exact URL (query included). A ?v=X request only ever matches a ?v=X entry.
function exactMatch(req) {
  return caches.match(req);
}

function ownCacheName() {
  var v = versionFromScriptUrl();
  return v ? cacheName(v) : "";
}

// Used only after the network failed: same path, any query. This worker's cache first, then
// the other caches of this scope (dev and prod never see each other's caches).
function offlineFallback(req) {
  var url = new URL(req.url);
  var prefix = cachePrefix();
  var own = ownCacheName();
  return caches.keys().then(function (keys) {
    var mine = keys.filter(function (k) { return k.indexOf(prefix) === 0 && k.indexOf("~") < 0; });
    mine.sort(function (a, b) { return (b === own) - (a === own); });
    return mine.reduce(function (chain, k) {
      return chain.then(function (found) {
        if (found) return found;
        return caches.open(k).then(function (cache) {
          return cache.match(req, { ignoreSearch: true });
        });
      });
    }, Promise.resolve(null));
  });
}

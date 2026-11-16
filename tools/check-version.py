#!/usr/bin/env python3
"""Fails if any local import / link / image ?v= differs from APP_VERSION, or a relative import has no ?v= (run from repo root).
Also flags a stale or missing ?v= on icon URLs in manifest.webmanifest."""
import re, pathlib, sys
root = pathlib.Path('.'); v = re.search(r'APP_VERSION = "([^"]+)"', (root / 'js/version.js').read_text()).group(1); bad = []
for f in [root / 'index.html', *root.glob('css/*.css'), *root.glob('js/**/*.js')]:
    s = f.read_text(encoding='utf-8')
    for m in re.findall(r'(?:from|import)\s*\(?\s*"(\.[^"]+)"', s) + re.findall(r'(?:src|href)="((?:js|css|images)/[^"]+)"', s):
        if not m.endswith('?v=' + v): bad.append((str(f), m))
# The service worker script URL must include ?v=APP_VERSION. A fetch() of
# js/version.js is not part of the browser's SW byte check (only the script
# and importScripts are), so a bare sw.js would never install a new worker
# when APP_VERSION changes.
off = (root / 'js/offline.js').read_text(encoding='utf-8')
if re.search(r'["\']sw\.js["\']', off):
    bad.append(('js/offline.js', 'sw.js'))
if not re.search(r'sw\.js\?v=(?:["\']\s*\+\s*(?:APP_VERSION|BUILD_ID)|\$\{(?:APP_VERSION|BUILD_ID)\}|' + re.escape(v) + r')', off):
    bad.append(('js/offline.js', 'sw.js registration missing ?v=' + v))
# BUILD_ID is only stamped on a deploy copy (tools/stamp-build.py). In the repo it must equal APP_VERSION.
b = re.search(r'BUILD_ID = "([^"]+)"', (root / 'js/version.js').read_text())
if not b or b.group(1) != v:
    bad.append(('js/version.js', 'BUILD_ID must equal APP_VERSION in the repo (deploys stamp it)'))
# Icon URLs in the web manifest must use ?v=APP_VERSION too (they were left at 112.14 after 112.15).
mf = root / 'manifest.webmanifest'
if mf.exists():
    for src in re.findall(r'"src"\s*:\s*"([^"]+)"', mf.read_text(encoding='utf-8')):
        if not src.endswith('?v=' + v):
            bad.append((str(mf), src))
print('APP_VERSION', v, 'stale/missing ?v=:', bad or 'none'); sys.exit(1 if bad else 0)

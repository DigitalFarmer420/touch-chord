#!/usr/bin/env python3
"""Fails if any local import / link / image ?v= differs from APP_VERSION, or a relative import has no ?v= (run from repo root)."""
import re, pathlib, sys
root = pathlib.Path('.'); v = re.search(r'APP_VERSION = "([^"]+)"', (root / 'js/version.js').read_text()).group(1); bad = []
for f in [root / 'index.html', *root.glob('css/*.css'), *root.glob('js/**/*.js')]:
    s = f.read_text(encoding='utf-8')
    for m in re.findall(r'(?:from|import)\s*\(?\s*"(\.[^"]+)"', s) + re.findall(r'(?:src|href)="((?:js|css|images)/[^"]+)"', s):
        if not m.endswith('?v=' + v): bad.append((str(f), m))
print('APP_VERSION', v, 'stale/missing ?v=:', bad or 'none'); sys.exit(1 if bad else 0)

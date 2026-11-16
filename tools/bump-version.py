#!/usr/bin/env python3
"""Set the app version everywhere in one go (run from the repo root): python3 tools/bump-version.py 112.4
- js/version.js: APP_VERSION = "<new>", BUILD_ID = "<new>", APP_BUILD = "<new>-web" (if it was "<old>-web")
- every ?v=<old> in index.html (CSS links, boot-early.js, main.js, How to images), css/*.css, js/**/*.js (all import specifiers), and manifest.webmanifest (icon URLs)
Then checks that no other ?v= value is left (a module imported under two different ?v= values would load twice)."""
import sys, re, pathlib
root = pathlib.Path('.'); new = sys.argv[1]
vf = root / 'js/version.js'; t = vf.read_text(encoding='utf-8')
old = re.search(r'APP_VERSION = "([^"]+)"', t).group(1)
files = [root / 'index.html', *root.glob('css/*.css'), *root.glob('js/**/*.js'), root / 'manifest.webmanifest']
for f in files:
    s = f.read_text(encoding='utf-8')
    s2 = s.replace('?v=' + old + '"', '?v=' + new + '"').replace('?v=' + old + "'", '?v=' + new + "'")
    if f == vf:
        s2 = re.sub(r'APP_VERSION = "[^"]+"', f'APP_VERSION = "{new}"', s2).replace(f'("Version {old}")', f'("Version {new}")')
        s2 = re.sub(r'BUILD_ID = "[^"]+"', f'BUILD_ID = "{new}"', s2).replace(f'APP_BUILD = "{old}-web"', f'APP_BUILD = "{new}-web"')
    if s2 != s: f.write_text(s2, encoding='utf-8')
bad = [(str(f), m) for f in files for m in set(re.findall(r'\?v=([0-9A-Za-z.\-]+)["\']', f.read_text(encoding='utf-8'))) if m != new]
if bad: sys.exit('stale ?v= values: %r' % bad)
print(f'version {old} -> {new} in {len(files)} files')

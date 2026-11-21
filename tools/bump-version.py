#!/usr/bin/env python3
"""Set the app version everywhere in one go (run from the repo root):
  python3 tools/bump-version.py 2026.11.21.1   # an explicit YYYY.MM.DD.N version
  python3 tools/bump-version.py --today        # today's date and the next free counter (see below)
Version scheme (see tools/tcversion.py): the build date plus a counter, YYYY.MM.DD.N. Every dev build (each merge into
develop that changes app files) and every release gets its own number: the first build on a day is .1, the next .2, and a
new date starts again at .1. The new version must sort after the current one (112.16 and older sort before any date).
--today looks at this checkout's version and, when they can be read, the versions on origin/develop and origin/main, and
takes the next counter after the highest of them, so a branch cut before another PR landed still gets a free number.
- js/version.js: APP_VERSION = "<new>", BUILD_ID = "<new>", APP_BUILD = "<new>-web" (if it was "<old>-web")
- every ?v=<old> in index.html (CSS links, boot-early.js, main.js, How to images), css/*.css, js/**/*.js (all import specifiers), and manifest.webmanifest (icon URLs)
Then checks that no other ?v= value is left (a module imported under two different ?v= values would load twice)."""
import sys, re, pathlib, datetime
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); import tcversion
if len(sys.argv) != 2: sys.exit(__doc__)
root = pathlib.Path('.')
vf = root / 'js/version.js'; t = vf.read_text(encoding='utf-8')
old = re.search(r'APP_VERSION = "([^"]+)"', t).group(1)


def ref_version(ref):
    """APP_VERSION of js/version.js at a git ref, or None (no git, no such ref, or no version line)."""
    import subprocess
    try:
        out = subprocess.run(['git', 'show', ref + ':js/version.js'], capture_output=True, text=True, timeout=10)
    except Exception:
        return None
    m = re.search(r'APP_VERSION = "([^"]+)"', out.stdout) if out.returncode == 0 else None
    return m.group(1) if m else None


def next_free(today):
    seen = [old] + [v for v in (ref_version(r) for r in ('origin/develop', 'origin/main')) if v]
    known = [v for v in seen if tcversion.is_valid(v) or re.match(r'^\d+\.\d+$', v)]
    return tcversion.next_version(max(known, key=tcversion.key), today)


new = next_free(datetime.date.today()) if sys.argv[1] == '--today' else sys.argv[1]
if not tcversion.is_valid(new): sys.exit('not a YYYY.MM.DD.N version (a real date, counter from 1): %r' % new)
if tcversion.key(new) <= tcversion.key(old): sys.exit('new version %s must sort after the current %s' % (new, old))
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

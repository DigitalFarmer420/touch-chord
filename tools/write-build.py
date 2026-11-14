#!/usr/bin/env python3
"""Write the build name into js/version.js (APP_BUILD) for an APK. Run from the repo (or the staged web) root BEFORE
`npx cap sync`, so the Settings sheet shows the same name as Android's versionName.

  python3 tools/write-build.py 112.13-ranked-v3.2-test.4
  python3 tools/write-build.py --gradle android/app/build.gradle     # reads versionName "..."
  python3 tools/write-build.py --check                               # prints the current APP_BUILD

Only the APP_BUILD line changes. APP_VERSION and the ?v= cache tags stay as they are (tools/check-version.py still passes).
Exit 2 on a bad name (allowed: letters, digits, . _ + -; 1..64 chars)."""
import pathlib, re, sys
root = pathlib.Path(__file__).resolve().parent.parent
vf = root / 'js' / 'version.js'
RX = re.compile(r'var APP_BUILD = "([^"]*)";')
def main(a):
    t = vf.read_text(encoding='utf-8'); m = RX.search(t)
    if not m: print('APP_BUILD line not found in', vf); return 2
    if a[:1] == ['--check'] or not a: print(m.group(1)); return 0
    if a[0] == '--gradle':
        g = pathlib.Path(a[1]).read_text(encoding='utf-8'); gm = re.search(r'versionName\s+"([^"]+)"', g)
        if not gm: print('no versionName in', a[1]); return 2
        name = gm.group(1)
    else: name = a[0]
    if not re.fullmatch(r'[A-Za-z0-9._+-]{1,64}', name): print('bad build name:', repr(name)); return 2
    vf.write_text(RX.sub('var APP_BUILD = "%s";' % name, t, count=1), encoding='utf-8')
    print('APP_BUILD', m.group(1), '->', name); return 0
sys.exit(main(sys.argv[1:]))

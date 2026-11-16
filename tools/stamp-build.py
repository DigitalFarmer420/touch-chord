#!/usr/bin/env python3
"""Stamp a DEPLOY COPY of the site with BUILD_ID = APP_VERSION-<short commit sha>. Never run this on the repo.
  python3 tools/stamp-build.py <site dir> <commit sha>
- every ?v=APP_VERSION" (or ') in index.html, css/**/*.css and js/**/*.js becomes ?v=BUILD_ID,
- js/version.js gets BUILD_ID = "<BUILD_ID>" (js/offline.js registers sw.js?v=BUILD_ID),
- index.html gets <meta name="tc-build" content="<BUILD_ID>">.
So every deploy changes index.html, registers a new sw.js?v=BUILD_ID (sw.js reads its cache name from that
query) and asks for new asset URLs, even when only one JS or CSS file changed and APP_VERSION did not.
Without stamping (local runs, tests, the APK) BUILD_ID stays equal to APP_VERSION.
Exits non-zero if the copy is already stamped, the sha is not hex, or any ?v= tag is left unstamped."""
import pathlib, re, sys


def stamp(site, sha):
    site = pathlib.Path(site)
    sha = (sha or '').strip().lower()
    if not re.fullmatch(r'[0-9a-f]{7,40}', sha):
        raise SystemExit('stamp-build: commit sha must be 7-40 hex chars, got %r' % sha)
    vf = site / 'js/version.js'
    vt = vf.read_text(encoding='utf-8')
    v = re.search(r'APP_VERSION = "([^"]+)"', vt).group(1)
    b = re.search(r'BUILD_ID = "([^"]+)"', vt)
    if not b:
        raise SystemExit('stamp-build: BUILD_ID missing from js/version.js')
    if b.group(1) != v:
        raise SystemExit('stamp-build: already stamped (BUILD_ID %s)' % b.group(1))
    build = v + '-' + sha[:7]
    files = [site / 'index.html', *site.glob('css/**/*.css'), *site.glob('js/**/*.js')]
    changed = 0
    for f in files:
        s = f.read_text(encoding='utf-8')
        s2 = s.replace('?v=' + v + '"', '?v=' + build + '"').replace('?v=' + v + "'", '?v=' + build + "'")
        if f == vf:
            s2 = re.sub(r'BUILD_ID = "[^"]+"', 'BUILD_ID = "%s"' % build, s2, count=1)
        if f.name == 'index.html' and f.parent == site:
            meta = '<meta name="tc-build" content="%s">' % build
            if '<head>' not in s2:
                raise SystemExit('stamp-build: <head> missing from index.html')
            s2 = s2.replace('<head>', '<head>\n' + meta, 1)
        if s2 != s:
            f.write_text(s2, encoding='utf-8')
            changed += 1
    left = [(str(f), m) for f in files for m in set(re.findall(r'\?v=([0-9A-Za-z.\-]+)["\']', f.read_text(encoding='utf-8'))) if m != build]
    if left:
        raise SystemExit('stamp-build: unstamped ?v= tags left: %r' % left)
    return build, changed


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    build, changed = stamp(sys.argv[1], sys.argv[2])
    print('BUILD_ID', build, 'stamped into', changed, 'files')

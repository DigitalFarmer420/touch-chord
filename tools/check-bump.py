#!/usr/bin/env python3
"""Fails if app files differ from <base ref> but APP_VERSION does not (run from the repo root).
  python3 tools/check-bump.py origin/main
Production Pages serves main without a deploy step, so BUILD_ID there is APP_VERSION. The offline worker only
installs a new build when that changes, so a release into main that changes app files must bump APP_VERSION."""
import re, subprocess, sys

RUNTIME = ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'fonts', 'images']


def version(text):
    m = re.search(r'APP_VERSION = "([^"]+)"', text)
    return m.group(1) if m else None


def main(base):
    changed = subprocess.run(['git', 'diff', '--name-only', base, 'HEAD', '--'] + RUNTIME,
                             check=True, capture_output=True, text=True).stdout.split()
    old = version(subprocess.run(['git', 'show', base + ':js/version.js'], check=True, capture_output=True, text=True).stdout)
    new = version(open('js/version.js', encoding='utf-8').read())
    print('APP_VERSION', old, '->', new, '|', len(changed), 'app files changed')
    if changed and old == new:
        print('App files changed without an APP_VERSION bump (python3 tools/bump-version.py <new>):', changed[:20])
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else 'origin/main'))

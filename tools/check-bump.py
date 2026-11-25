#!/usr/bin/env python3
"""Fails if app files differ from <base ref> but APP_VERSION does not (run from the repo root).
  python3 tools/check-bump.py origin/main      # a release into main
  python3 tools/check-bump.py origin/develop   # a pull request into develop (every dev build gets its own number)
A change to app files must bump APP_VERSION (the version shown in the app) against the base branch.
The new APP_VERSION must also sort after the base one (tools/tcversion.py: YYYY.MM.DD.N, and the
legacy 112.x versions sort before any date version), so a release can never go backwards.
The deploy copy is stamped with its own BUILD_ID; that stamp does not replace this bump."""
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import tcversion

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
    if old != new:
        try:
            if tcversion.key(new) <= tcversion.key(old):
                print('APP_VERSION must go up: %s is not after %s' % (new, old))
                return 1
        except ValueError as e:
            print(e)
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else 'origin/main'))

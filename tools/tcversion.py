#!/usr/bin/env python3
"""Touch Chord version scheme (used by bump-version.py, check-version.py and check-bump.py).

Since 2026-11-21 APP_VERSION is the release date plus a counter: YYYY.MM.DD.N
  2026.11.21.1   first release on 21 Nov 2026
  2026.11.21.2   a second release the same day
N starts at 1 and has no leading zeros; MM and DD are always two digits; the date must be a real date.
The older scheme (112.16 and before, "<major>.<minor>") is still parsed so a release can be compared
with what is on main, and every date version sorts after every legacy version.
  python3 tools/tcversion.py next [YYYY-MM-DD]   # prints the next version for that date (default: today)
  python3 tools/tcversion.py check <version>      # exit 0 if <version> is a valid YYYY.MM.DD.N version"""
import datetime, re, sys

DATE_RX = re.compile(r'^(\d{4})\.(\d{2})\.(\d{2})\.([1-9]\d*)$')
LEGACY_RX = re.compile(r'^(\d+)\.(\d+)$')


def parse_date_version(v):
    """(datetime.date, N) for a valid YYYY.MM.DD.N version, else None."""
    m = DATE_RX.match(v or '')
    if not m:
        return None
    try:
        d = datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None
    return d, int(m.group(4))


def is_valid(v):
    return parse_date_version(v) is not None


def key(v):
    """Sort key: legacy <major>.<minor> sorts before any date version. Raises ValueError otherwise."""
    p = parse_date_version(v)
    if p:
        return (1, p[0].toordinal(), p[1])
    m = LEGACY_RX.match(v or '')
    if m:
        return (0, int(m.group(1)), int(m.group(2)))
    raise ValueError('not a Touch Chord version: %r' % v)


def next_version(current, today):
    """The next release version on date `today` after `current` (date or legacy)."""
    p = parse_date_version(current)
    if p and p[0] > today:
        raise ValueError('current version %s is later than %s' % (current, today.isoformat()))
    n = p[1] + 1 if p and p[0] == today else 1
    return '%04d.%02d.%02d.%d' % (today.year, today.month, today.day, n)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['check'] and len(a) == 2:
        ok = is_valid(a[1]); print(a[1], 'valid' if ok else 'not a YYYY.MM.DD.N version'); sys.exit(0 if ok else 1)
    if a[:1] == ['next'] and len(a) <= 2:
        import pathlib
        cur = re.search(r'APP_VERSION = "([^"]+)"', pathlib.Path('js/version.js').read_text(encoding='utf-8')).group(1)
        day = datetime.date.fromisoformat(a[1]) if len(a) == 2 else datetime.date.today()
        print(next_version(cur, day)); sys.exit(0)
    sys.exit(__doc__)

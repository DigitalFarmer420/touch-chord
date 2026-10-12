#!/usr/bin/env python3
"""Inject a small DEV badge into index.html (used ONLY when deploying to touch-chord-dev).
Production (touch-chord main) never runs this, so the badge never appears there."""
import sys, os, re, pathlib
p = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "index.html")
html = p.read_text(encoding="utf-8")
if 'id="dev-badge"' in html:
    sys.exit(0)
head = ('<meta name="robots" content="noindex,nofollow">'
        '<style id="dev-badge-style">#dev-badge{position:fixed;top:calc(env(safe-area-inset-top,0px) + 2px);'
        'left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;'
        'background:#e5482d;color:#fff;font:700 10px/1 -apple-system,system-ui,sans-serif;'
        'letter-spacing:.08em;padding:3px 7px;border-radius:999px;opacity:.85;'
        'box-shadow:0 1px 3px rgba(0,0,0,.4)}</style>\n')
body = '<div id="dev-badge" aria-hidden="true">DEV</div>\n'
# Build commit for the in-app bug report (dev only; production shows the version only).
sha = (sys.argv[2] if len(sys.argv) > 2 else os.environ.get("GITHUB_SHA", ""))[:7]
if re.fullmatch(r"[0-9a-f]{7}", sha or ""):
    head = '<meta name="tc-build" content="' + sha + '">' + head
html = html.replace("</head>", head + "</head>", 1)
html = html.replace("<title>", "<title>DEV · ", 1)
i = html.rfind("</body>")
html = html[:i] + body + html[i:]
p.write_text(html, encoding="utf-8")
print("DEV badge injected into", p)

# reputiflytools — how to ship

This repo is served by **GitHub Pages** at `reputifly.org` (see `CNAME`). A merge
to `main` is a production deploy of every page in here, including
`closer-playbook/`, `upsell-playbook/`, `gmb-upsell/`, the client guides and the
sample sites.

## You cannot push straight to `main`

`main` requires the status check `verify-source-and-build` (workflow
`.github/workflows/leads.yml`) and enforces it for admins. A required check is
evaluated against the commit you are pushing, and that commit has never been
built — so a direct push is **always** rejected:

```
remote: - Required status check "verify-source-and-build" is expected.
! [remote rejected] main -> main (protected branch hook declined)
```

That message means "use a PR", not "you have no access". Do not read it as a
missing credential, and do not fall back to an internal preview link — a
`*.project.reputifly.cloud` preview is not a publish and Julian does not want
one when he says publish.

## Ship with one command

```bash
reputifly-ship "what changed"
```

Run it from inside this working tree. It commits, rebases onto `main`, opens a
PR, waits for the check (~30s), squash-merges, then waits for the Pages build
and only exits 0 once the commit is actually live. `--dry-run` to preview,
`--no-wait` to queue and return.

The helper lives at `/usr/local/bin/reputifly-ship` on the agent box.

## Verify in a real browser before you say it works

The playbook pages are single-file apps whose data lives in `MENU` / `NODES`
literals. A malformed node throws inside `render()` and the page keeps showing
the welcome pane — which looks exactly like a stale cache. On 2026-08-26 a node
shipped `tag:"objection"` where the shape is `tag:{x:"warm"}`; `#credibility`
rendered blank for three days while three separate replies blamed the browser
cache.

**Open the page and read the console before diagnosing.** Playwright is
installed on the box and works inside the agent sandbox:

```bash
~/.local/share/playwright-venv/bin/python3 -c '
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); pg = b.new_page()
    pg.on("console", lambda m: print("CONSOLE", m.type, m.text))
    pg.on("pageerror", lambda e: print("PAGEERROR", e))
    pg.goto("https://reputifly.org/closer-playbook/#credibility")
    pg.wait_for_timeout(2500); print(pg.inner_text(".nodehd")); b.close()'
```

`playwright install` will fail with a read-only filesystem error — the browser
cache is bind-mounted read-only on purpose because the browsers are **already
downloaded**. That error is not "no browser here".

## Cache busting

`closer-playbook/index.html` carries `PB_BUILD="<stamp>"` and there is a
matching `closer-playbook/version.txt`. Bump **both** to the same new value in
the same commit, or the page will reload itself in a loop or serve stale.

# Touch Chord

Static web app. There is no compile step. `develop` is the dev site and `main` is production.

## How a merge reaches each site

[`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml) is the only web deploy. It does not sign the Android app or upload it to a store.

A push to `develop` or `main` runs one gate:

- `python3 tools/check-version.py` — every `?v=` matches `APP_VERSION`, and `BUILD_ID` in the repo stays equal to `APP_VERSION`
- unit tests — `node --test tests/unit/*.test.js`
- smoke — `node tests/ci/smoke.mjs`

Those are the same checks as [pr-checks](.github/workflows/pr-checks.yml). The long Playwright suite in `tests.yml` still runs only on a pull request from `develop` into `main`. It is not run again at deploy time.

A failed gate job stays red. The deploy job is skipped, and nothing is published.

### Dev — https://digitalfarmer420.github.io/touch-chord-dev/

A push to `develop` that passes the gate copies the tree, injects the DEV badge, stamps `BUILD_ID` with `tools/stamp-build.py`, and pushes that copy to `main` on `DigitalFarmer420/touch-chord-dev`. Pages for that repo (source branch `main`) publishes the dev URL.

Dev stays a separate repository. GitHub Pages hosts one site per repo, so a dev subpath on the production site would be the same artifact: the next dev publish and the next production publish would replace each other. `https://digitalfarmer420.github.io/touch-chord-redesign/` is not a site anymore. That repository was renamed to `touch-chord`, which is production.

A same-version app change is allowed on `develop`. The stamp gives that deploy its own `BUILD_ID`, so an installed copy still updates.

### Production — https://digitalfarmer420.github.io/touch-chord/

A push to `main` runs the same gate, then `tools/check-bump.py` against the commit `main` pointed at before the push. An app-file change that does not bump `APP_VERSION` fails that job and does not deploy. Re-running the workflow by hand on the current `main` skips that comparison; the other gate jobs still run.

When the gate passes, the workflow stamps a copy with no DEV badge and publishes it with the Pages deploy action.

A pull request into `main` still has to pass `tools/check-bump.py` in pr-checks. `tools/bump-version.py` is unchanged.

### Pages setting for production

Pages for this repo is still "Deploy from a branch" (`main`). That publishes every push to `main` and does not wait for this workflow. After `deploy-web.yml` is on `main`, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. If the deploy job on that commit failed, re-run **Deploy web** for it. The `github-pages` environment already allows `main`. This adds no secret.

Leave `touch-chord-dev` on "Deploy from a branch" (`main`). The `DEV_DEPLOY_KEY` secret already used by the dev publish stays as it is. Do not switch that repo to GitHub Actions, or the push that updates dev will stop reaching the site.

# Portfolio (the fast app)

Fred's portfolio on the phone, opening instantly like Gym and Life Hub. It
shows what the **Portfolio tracker** (`../Portfolio tracker`, Streamlit,
private repo) works out, and changes nothing: the tracker's cloud engine
(`src/engine.py` there, a GitHub Actions job) writes finished figures to
Firebase, and this app reads them. Built 26 Oct 2026 because the hosted
Streamlit copy is too slow to use comfortably on the phone (it sleeps, then
reruns Python on every tap). Read the tracker's CLAUDE.md, "The cloud engine
and the fast app", for the other half.

Single user, non-technical: explain things plainly, in prose.

## Status (26 Oct 2026)

- ✅ Overview (header, performance chart with 1W…All + Custom, Value / Return % /
  Total P&L, Simple / Time / Money %, benchmarks, quarterly grid) and Holdings.
  Sign-in, Firebase reading, offline copy. All tests pass; checked on Fred's
  real figures via `?local`.
- ⏳ Fred: the tracker's `CLOUD-ENGINE.md` (secrets, rules), then this
  folder's `SETUP.md` (create the public repo `fronk001/portfolio-app`, Pages,
  install on the iPhone). **No remote yet**: Claude adds it and pushes once
  Fred has created the repo.
- Next, once it is live: point the Portfolio launcher in Life Hub
  (`../life-hub/src/portfolio/`, which redirects to Streamlit today) and its
  `seed.local.js` tracker link at https://fronk001.github.io/portfolio-app/.
- Not built yet: Money % against a benchmark (the engine would have to solve
  it; the screen says so), Position detail, Wealth and Budget.

## Run

No Node on this machine. Python 3.14 (`py`) + the browser do everything.

```
Start Portfolio.bat                        # double-click: serves + opens the app on ?local (:8540)
py tools/serve.py                          # http://localhost:8540/src/
py tools/run_tests.py                      # logic + contract tests (headless Edge), exit 0 = pass
py tools/run_tests.py tools/smoke.html     # UI smoke test: taps every range, metric and method on demo data
py tools/run_tests.py tools/firebase-check.html  # real Firebase SDK from the CDN (needs internet, no account)
py tools/build.py                          # dist/ = what GitHub Pages publishes (CI runs this too)
py tools/run_tests.py tools/sw-check.html  # after build.py: offline copy installs; app opens offline from kept figures
py tools/shot.py "?demo"                   # screenshots/desktop.png + phone.png
"../Portfolio tracker/.venv/Scripts/python.exe" tools/make_demo.py   # demo.js + tests/expected.js
```

URL switches: `?demo` made-up figures · `?local` the tracker's figures on this
laptop, served by `tools/serve.py` from `../Portfolio tracker/data/engine/`
(write them with `.venv\Scripts\python.exe -m src.engine --out data\engine`
there; never copied here) · `?reset` forget this device's copy ·
`?range=1Y&metric=Return %25&method=Simple %25&bench=AEX` open on a chart.
In Git Bash, pass a `#/holdings` argument with `MSYS_NO_PATHCONV=1`, or it
arrives as a Windows path.

Run the tests and the smoke test after any change to `src/`; build +
sw-check after touching `sw.js`, `index.html`, `build.py` or adding files. A
new module also goes into index.html's `modulepreload` list.

**Publishing = `git push` to `main`** (git identity `Fred` + the relay email,
like Gym). The workflow builds and deploys to
https://fronk001.github.io/portfolio-app/. The repo is public: ask Fred before
pushing, and run all the tests first.

## Layout

```
src/core/   figures.js (ranges, Simple/Time %, benchmarks, period change: the tracker's formulas)
            chart.js (gridlines, paths) · format.js (euros, dates, names)
src/data/   store.js (source, cache, Firebase listening) · cache.js (IndexedDB) ·
            firebase.js (read only) · firebase-config.js (Life Hub's registration) · demo.js (generated)
src/ui/     app.js (boot, routes, taps) · views.js (Overview, Holdings) · chart.js (SVG + touch readout) ·
            account.js (sign-in, sync button; Gym's) · html.js
tests/      figures, chart, contract (vs tests/expected.js), store
tools/      as Gym's, plus make_demo.py
```

## Rules that matter

- **The figures never live in this repo.** It is public. They come from
  Firebase at run time, or on the laptop from the tracker's folder via
  `serve.py`. The Pages workflow refuses a build containing engine output.
- **The phone's sums are the tracker's formulas**, and `tests/contract.test.js`
  holds them to the tracker's own Python on the demo figures
  (`tools/make_demo.py` computes `tests/expected.js` with
  `../Portfolio tracker/src/calculations.py`). Change a formula here and in
  the tracker together, then rerun make_demo.py. Money % is solved by the
  engine per fixed range, never here; Custom + Money % says so instead.
- **Benchmarks arrive as trading days with gaps**, filled within the range on
  screen, as the Streamlit app does. Filling across all history first would
  start a Saturday range on Friday's close.
- The documents' shape is the engine's `SCHEMA_VERSION` (1). A newer one is
  refused with a sentence, not half-read (`readDocuments`).
- The chart opens on **1W** and Value (Fred, 26 Oct 2026). The quarterly grid
  is always time-weighted, as in the tracker.
- This device's copy is in **IndexedDB**, not localStorage: the series is a
  quarter of a megabyte, and localStorage on fronk001.github.io is one 5 MB
  budget shared with Life Hub, Gym and Mongolian. Sign-out wipes it.
- Firebase app named `'portfolio'`, Life Hub's web registration (as Gym), and
  read only: `users/{uid}/portfolio/` is `allow write: if false` in
  `../life-hub/firestore.rules`.
- State facts about freshness (when the figures were worked out, what each
  broker's upload covers) in the footer; no staleness warnings (the tracker's
  rule). Gains green / losses red with the sign always written.
- Names arrive in capitals; `titleCase` keeps acronyms (`KEEP` in format.js).

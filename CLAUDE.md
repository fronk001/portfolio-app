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

- ✅ Live at https://fronk001.github.io/portfolio-app/ (morning of 26 Oct):
  Overview (header, performance chart with 1W…All + Custom, Value / Return % /
  Total P&L, Simple / Time / Money %, benchmarks, quarterly grid) and Holdings.
  Sign-in, Firebase reading, offline copy.
- ✅ Built and tested the evening of 26 Oct, live from the first push after
  that: the other six Portfolio screens, from the engine's `screens` and
  `prices-N` documents — Position detail (picker, six figures, price chart
  with 1W…All + Custom, trades marked, average-cost line, dividend
  payments), Allocation (the map, the ranked list, By account), Other assets
  (reading only; edits link to Streamlit), Cash (balance line, what moved it,
  recent events), Dividends (per year, received over time, per holding),
  Realized vs Unrealized. Checked on Fred's real figures via `?local`.
- The plan Fred accepted on 26 Oct, toward every screen he reads: (1) the
  rest of Portfolio ✅; (2) Wealth; (3) Budget; (4) point Life Hub's
  Portfolio launcher (`../life-hub/src/portfolio/`, which redirects to
  Streamlit today) and its `seed.local.js` tracker link here.
- Not built: Money % against a benchmark (the engine would have to solve it;
  the screen says so), Wealth and Budget. Log a trade, imports and the
  other-assets editor stay in Streamlit on purpose: this app only reads.

## Run

No Node on this machine. Python 3.14 (`py`) + the browser do everything.

```
Start Portfolio.bat                        # double-click: serves + opens the app on ?local (:8540)
py tools/serve.py                          # http://localhost:8540/src/
py tools/run_tests.py                      # logic + contract tests (headless Edge), exit 0 = pass
py tools/run_tests.py tools/smoke.html     # UI smoke test: taps through all eight screens on demo data, then ?demo=old
py tools/run_tests.py tools/firebase-check.html  # real Firebase SDK from the CDN (needs internet, no account)
py tools/build.py                          # dist/ = what GitHub Pages publishes (CI runs this too)
py tools/run_tests.py tools/sw-check.html  # after build.py: offline copy installs; app opens offline from kept figures
py tools/shot.py "?demo"                   # screenshots/desktop.png + phone.png
"../Portfolio tracker/.venv/Scripts/python.exe" tools/make_demo.py   # demo.js + tests/expected.js
```

URL switches: `?demo` made-up figures · `?demo=old` the same as an engine
from before the other six screens sent them (each says so in a sentence) ·
`?local` the tracker's figures on this laptop, served by `tools/serve.py`
from `../Portfolio tracker/data/engine/` (write them with
`.venv\Scripts\python.exe -m src.engine --out data\engine` there; never
copied here) · `?reset` forget this device's copy ·
`?range=1Y&metric=Return %25&method=Simple %25&bench=AEX` open on a chart.
Screens by address: `#/`, `#/holdings`, `#/position/<ISIN>`, `#/allocation`,
`#/other-assets`, `#/cash`, `#/dividends`, `#/realized`. In Git Bash, pass a
`#/holdings` argument with `MSYS_NO_PATHCONV=1`, or it arrives as a Windows
path.

Run the tests and the smoke test after any change to `src/`; build +
sw-check after touching `sw.js`, `index.html`, `build.py` or adding files. A
new module also goes into index.html's `modulepreload` list.

**Publishing = `git push` to `main`** (git identity `Fred` + the relay email,
like Gym). The workflow builds and deploys to
https://fronk001.github.io/portfolio-app/. The repo is public: ask Fred before
pushing, and run all the tests first.

## Layout

```
src/core/   figures.js (ranges, Simple/Time %, benchmarks, period change: the tracker's formulas;
            reading the documents, price histories, trades in a range)
            chart.js (gridlines, paths, map tiles and colours) · format.js (euros, dates, names)
src/data/   store.js (source, cache, Firebase listening) · cache.js (IndexedDB) ·
            firebase.js (read only) · firebase-config.js (Life Hub's registration) · demo.js (generated)
src/ui/     app.js (boot, routes, taps) · views.js (page, tabs, Overview, Holdings) ·
            screens.js (the other six) · chart.js (SVG line chart + map, touch readout) ·
            account.js (sign-in, sync button; Gym's) · html.js (escaping, pills, tiles)
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
- **The other six screens work nothing out** (`ui/screens.js`). Every total,
  weight and share arrives finished in the engine's `screens` document,
  which the tracker's `tests/test_engine.py` holds to the Streamlit app
  section by section. Here the figures are only laid out: Position detail's
  price chart is cut to its range, bars and map tiles are sized to the
  figures. The demo's `screens` and `prices-N` come out of the engine's own
  builders (make_demo.py), so they cannot drift from the real shape.
- **Price histories arrive in parts** (`prices-1`, `prices-2`, …), each saying
  how many there are; `joinPrices` keeps the newest run's count, so a part
  left over from a run that needed more is ignored. The demo is split on
  purpose so the tests join parts.
- **A missing `screens` or `prices-N` is not an error.** Figures from an engine
  run before 26 Oct evening have neither; each screen then says its figures
  come with the next run (`?demo=old` shows it, the smoke test checks it).
- **Benchmarks arrive as trading days with gaps**, filled within the range on
  screen, as the Streamlit app does. Filling across all history first would
  start a Saturday range on Friday's close.
- The documents' shape is the engine's `SCHEMA_VERSION` (1). A newer one is
  refused with a sentence, not half-read (`readDocuments`). New documents and
  new fields are not a bump; a field that changes meaning is.
- The chart opens on **1W** and Value (Fred, 26 Oct 2026); Position detail's
  on **3M**, as the tracker's. The quarterly grid is always time-weighted, as
  in the tracker.
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

"""
Makes the demo figures and the answers the JavaScript has to match.

    "..\\Portfolio tracker\\.venv\\Scripts\\python.exe" tools\\make_demo.py

Run it with the **tracker's** Python, because it borrows the tracker's own
calculations (`../Portfolio tracker/src`) — that is the point of it. Writes:

- src/data/demo.js     made-up documents in exactly the engine's shape, for
                       ?demo, the screenshots and the UI smoke test. Nothing
                       in them is real: this repository is public.
- tests/expected.js    what the tracker's Python says those documents mean —
                       each range's first day, Simple %, Time %, the
                       benchmark beside them, the period's change. The app
                       works the same things out in JavaScript
                       (src/core/figures.js) and tests/contract.test.js holds
                       it to these answers, so the phone and the Streamlit app
                       cannot quietly disagree.

Deterministic: the same file every run.
"""
import json
import zlib
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
TRACKER = ROOT.parent / "Portfolio tracker"
sys.path.insert(0, str(TRACKER))

from src import calculations, engine  # noqa: E402

START, END = "2023-01-02", "2026-10-23"  # a Friday
CUSTOM = ("2024-02-10", "2025-06-30")  # a Saturday start, as the app's picker allows


def _days():
    return pd.date_range(START, END, freq="D")


def build_series(rng):
    days = _days()
    n = len(days)

    # money in: €400 on the 1st of each month, one large deposit, one withdrawal
    deposits = pd.Series(0.0, index=days)
    deposits[days.day == 1] = 400.0
    deposits[pd.Timestamp("2023-01-02")] += 6000.0
    deposits[pd.Timestamp("2024-03-15")] += 8000.0
    deposits[pd.Timestamp("2025-10-10")] -= 3000.0
    net_deposits = deposits.cumsum()

    # some of it waits as cash, the rest is invested
    cash = (300 + 600 * (1 + np.sin(np.arange(n) / 37.0)) / 2).round(2)
    cash = pd.Series(cash, index=days)
    net_invested = (net_deposits - cash).round(2)

    # the market: a seeded random walk with a little drift
    returns = rng.normal(0.00035, 0.009, n)
    returns[days.weekday >= 5] = 0.0  # nothing moves at the weekend
    flows = net_invested.diff().fillna(net_invested.iloc[0])
    value = np.zeros(n)
    for i in range(n):
        before = value[i - 1] if i else 0.0
        value[i] = max(0.0, (before + flows.iloc[i]) * (1 + returns[i]))
    value = pd.Series(value, index=days).round(2)

    income = pd.Series(0.0, index=days)
    for day in days[(days.day == 15) & days.month.isin([3, 6, 9, 12])]:
        income[day] = round(float(value[day]) * 0.004, 2)

    return pd.DataFrame({
        "value_eur": value,
        "net_invested_eur": net_invested,
        "income_eur": income,
        "cash_eur": cash,
        "net_deposits_eur": net_deposits.round(2),
        "cost_basis_eur": (net_invested * 0.97).round(2),
    })


def build_benchmarks(rng, days):
    out = {}
    for k, name in enumerate(engine.BENCHMARKS):
        level = 100.0 * (1 + k)
        values = []
        for i, day in enumerate(days):
            if day.weekday() < 5:
                level *= 1 + rng.normal(0.0003, 0.008)
            traded = day.weekday() < 5 and i >= 10  # a gap at the start too
            values.append(round(level, 4) if traded else None)
        out[name] = values
    return out


HOLDINGS = [
    ("Demo World Equity ETF", "DWLD.DE", 0.34, "EUR"),
    ("Demo S&P 500 ETF", "DSPX.L", 0.18, "USD"),
    ("Demo Tech Fund", "DTEC.AS", 0.11, "EUR"),
    ("Demo Semiconductor Co", "DSEMI", 0.09, "USD"),
    ("Demo Bank Holding", "DBNK.AS", 0.08, "EUR"),
    ("Demo Emerging Markets ETF", "DEMM.DE", 0.08, "EUR"),
    ("Demo Software Inc", "DSFT", 0.07, "USD"),
    ("Demo Small Caps ETF", "DSML.DE", 0.05, "EUR"),
]


def build_main(frame, twr, generated_at):
    last = frame.iloc[-1]
    securities = float(last["value_eur"])
    cost_total = float(last["cost_basis_eur"])
    day_pcts = [0.8, -0.4, 1.6, -2.1, 0.3, 0.0, 1.1, -0.6]
    holdings = []
    for (name, ticker, weight, currency), day_pct in zip(HOLDINGS, day_pcts):
        value = round(securities * weight, 2)
        cost = round(cost_total * weight * (1.15 if weight < 0.1 else 0.95), 2)
        price = round(20 + weight * 400, 4)
        prev_value = value / (1 + day_pct / 100)
        holdings.append({
            "isin": f"XX{zlib.crc32(ticker.encode()) % 10**10:010d}",
            "name": name.upper(), "ticker": ticker,
            "broker": "Revolut" if ticker == "DEMM.DE" else "DeGiro",
            "quantity": round(value / price, 8), "avg_cost_eur": round(cost / (value / price), 4),
            "price_native": price if currency == "EUR" else round(price / 0.92, 4),
            "currency": currency, "price_eur": price, "value_eur": value,
            "weight_pct": None, "day_eur": round(value - prev_value, 2), "day_pct": day_pct,
            "cost_basis_eur": cost, "upl_eur": round(value - cost, 2),
            "upl_pct": round(100 * (value - cost) / cost, 4), "price_as_of": None,
        })
    # the rounding above must not leave the holdings disagreeing with the header
    securities = round(sum(h["value_eur"] for h in holdings), 2)
    cash = float(last["cash_eur"])
    total = securities + cash
    for h in holdings:
        h["weight_pct"] = round(100 * h["value_eur"] / total, 2)
    unrealized = sum(h["upl_eur"] for h in holdings)
    realized, dividends = 1234.56, round(float(frame["income_eur"].sum()), 2)
    day_change = sum(h["day_eur"] for h in holdings)
    prev = sum(h["value_eur"] - h["day_eur"] for h in holdings)
    table = calculations.returns_table(twr)
    return {
        "schema_version": engine.SCHEMA_VERSION,
        "generated_at": generated_at,
        "commit": "demo",
        "header": {
            "total_value_eur": round(total, 2), "securities_eur": securities, "cash_eur": cash,
            "day_change_eur": round(day_change, 2), "day_change_pct": round(100 * day_change / prev, 4),
            "day_missing": 0, "total_pnl_eur": round(unrealized + realized + dividends, 2),
            "unrealized_eur": round(unrealized, 2), "realized_eur": realized,
            "dividends_net_eur": dividends, "cost_basis_eur": round(sum(h["cost_basis_eur"] for h in holdings), 2),
            "other_assets_eur": 7000.0,
        },
        "prices": {"fallback_count": 0, "fallback_as_of": None, "fx": {"USD": 0.92}, "unpriced_cash": {}},
        "holdings": sorted(holdings, key=lambda h: -h["value_eur"]),
        "returns_table": [
            {"year": int(year), **{q: engine._num(row[q], 4) for q in ("Q1", "Q2", "Q3", "Q4", "FY")}}
            for year, row in table.iterrows()
        ],
        "uploads": {
            "DeGiro": {"imported_at": "2026-10-21 18:02:11", "covered_to": "2026-10-21", "trades_covered_to": "2026-10-21"},
            "Revolut": {"imported_at": "2026-08-09 10:12:40", "covered_to": "2026-08-09", "trades_covered_to": "2026-08-09"},
        },
        "trades_to": {"DeGiro": "2026-10-20", "Revolut": "2026-05-12"},
        "cash_to": "2026-10-21",
    }


def build_documents():
    rng = np.random.default_rng(20261026)
    frame = build_series(rng)
    twr = calculations.performance_index(frame, frame["income_eur"])
    money = {}
    for choice in engine.FIXED_RANGES:
        window = frame.loc[frame.index >= engine.range_start(choice, frame.index)]
        solved = calculations.money_weighted_series(window, frame["income_eur"].loc[window.index])
        money[choice] = {"from": f"{window.index[0]:%Y-%m-%d}", "values": engine._column(solved, 4)}
    generated_at = "2026-10-23T14:15:00+00:00"
    series = {
        "schema_version": engine.SCHEMA_VERSION,
        "generated_at": generated_at,
        "dates": [f"{d:%Y-%m-%d}" for d in frame.index],
        "columns": {
            "value_eur": engine._column(frame["value_eur"]),
            "net_invested_eur": engine._column(frame["net_invested_eur"]),
            "income_eur": engine._column(frame["income_eur"]),
            "total_value_eur": engine._column(frame["value_eur"] + frame["cash_eur"]),
            "cash_eur": engine._column(frame["cash_eur"]),
            "net_deposits_eur": engine._column(frame["net_deposits_eur"]),
            "cost_basis_eur": engine._column(frame["cost_basis_eur"]),
            "twr_index": engine._column(twr, 8),
        },
        "money_weighted_pct": money,
        "benchmarks_eur": build_benchmarks(rng, frame.index),
        "benchmark_problems": [],
    }
    return {"main": build_main(frame, twr, generated_at), "series": series}


# --- the answers ---------------------------------------------------------------


def _frame(series):
    """The documents read back exactly as the phone will read them: rounded."""
    index = pd.to_datetime(series["dates"])
    cols = {k: pd.Series(v, index=index, dtype=float) for k, v in series["columns"].items()}
    return index, pd.DataFrame(cols)


def _sample(values):
    """Every 40th point and the last: enough to catch a slip, small enough to read."""
    values = list(values)
    picks = sorted(set(range(0, len(values), 40)) | {len(values) - 1})
    return [[i, None if pd.isna(values[i]) else round(float(values[i]), 6)] for i in picks]


def expected(documents):
    series = documents["series"]
    index, frame = _frame(series)
    income = frame["income_eur"]
    twr = frame["twr_index"]
    bench = pd.Series(series["benchmarks_eur"]["S&P 500"], index=index, dtype=float)
    cum_div = income.cumsum()

    windows = {c: (engine.range_start(c, index), index.max()) for c in engine.FIXED_RANGES}
    windows["custom"] = (pd.Timestamp(CUSTOM[0]), pd.Timestamp(CUSTOM[1]))
    out = {"custom": list(CUSTOM), "windows": {}}
    for name, (start, end) in windows.items():
        mask = (index >= start) & (index <= end)
        window = frame.loc[mask]
        first, last = int(np.argmax(mask)), int(np.flatnonzero(mask)[-1])
        simple = calculations.simple_return_series(window, income.loc[window.index])
        aligned = bench.loc[window.index].ffill()
        base = aligned.dropna().iloc[0]
        simulated = calculations.simulate_benchmark(window, aligned)
        out["windows"][name] = {
            "first": first, "last": last,
            "simple": _sample(simple),
            "time_last": round(float(100 * (twr.iloc[last] / twr.iloc[first] - 1)), 6),
            "bench_time": _sample(100 * (aligned / base - 1)),
            "bench_simple": _sample(calculations.simple_return_series(simulated)),
            "pnl_last": round(float(frame["value_eur"].iloc[last] - frame["net_invested_eur"].iloc[last] + cum_div.iloc[last]), 6),
            "change": {
                "value": round(float(frame["total_value_eur"].iloc[last] - frame["total_value_eur"].iloc[first]), 6),
                "cash": round(float(frame["cash_eur"].iloc[last] - frame["cash_eur"].iloc[first]), 6),
                "deposits": round(float(frame["net_deposits_eur"].iloc[last] - frame["net_deposits_eur"].iloc[first]), 6),
            },
        }

    # pandas' DateOffset on the awkward days: month ends, a leap day, New Year
    starts = []
    for last in ["2026-03-31", "2024-02-29", "2025-12-31", "2026-01-01", "2026-05-31", "2026-10-23"]:
        idx = pd.date_range("2019-01-01", last, freq="D")
        for choice in engine.FIXED_RANGES:
            starts.append([last, choice, f"{engine.range_start(choice, idx):%Y-%m-%d}"])
    out["range_starts"] = starts
    return out


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    documents = build_documents()
    real = TRACKER / "data" / "engine" / "series.json"
    if real.is_file():  # the demo must have exactly the engine's shape
        real_series = json.loads(real.read_text(encoding="utf-8"))
        assert set(real_series) == set(documents["series"]), "series keys differ from the engine's"
        assert set(real_series["columns"]) == set(documents["series"]["columns"]), "columns differ"
        real_main = json.loads((real.parent / "main.json").read_text(encoding="utf-8"))
        assert set(real_main) == set(documents["main"]), "main keys differ from the engine's"
        assert set(real_main["header"]) == set(documents["main"]["header"]), "header keys differ"
    text = json.dumps(documents, separators=(",", ":"), allow_nan=False)
    (ROOT / "src" / "data" / "demo.js").write_text(
        "// Made-up figures in the engine's exact shape (tools/make_demo.py). Nothing here is real.\n"
        f"export const DEMO = {text};\n", encoding="utf-8", newline="\n",
    )
    answers = json.dumps(expected(documents), indent=1, allow_nan=False)
    (ROOT / "tests" / "expected.js").write_text(
        "// What the tracker's Python says the demo figures mean (tools/make_demo.py).\n"
        f"export const EXPECTED = {answers};\n", encoding="utf-8", newline="\n",
    )
    print(f"demo: {len(documents['series']['dates'])} days, {len(text):,} bytes; expected.js written")


if __name__ == "__main__":
    main()

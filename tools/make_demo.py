"""
Makes the demo figures and the answers the JavaScript has to match.

    "..\\Portfolio tracker\\.venv\\Scripts\\python.exe" tools\\make_demo.py

Run it with the **tracker's** Python, because it borrows the tracker's own
calculations (`../Portfolio tracker/src`) — that is the point of it. Writes:

- src/data/demo.js     made-up documents in exactly the engine's shape, for
                       ?demo, the screenshots and the UI smoke test. Nothing
                       in them is real: this repository is public. The
                       screens and prices documents are not just shaped like
                       the engine's: they come out of the engine's own
                       builders, fed made-up trades, dividends and cash.
- tests/expected.js    what the tracker's Python says those documents mean —
                       each range's first day, Simple %, Time %, the
                       benchmark beside them, the period's change. The app
                       works the same things out in JavaScript
                       (src/core/figures.js) and tests/contract.test.js holds
                       it to these answers, so the phone and the Streamlit app
                       cannot quietly disagree. For Position detail: where each
                       range starts and ends on a price history read back
                       from its gaps, and which trades it shows.

The Wealth document is made the same way: a made-up workbook export, monthly
portfolio summary, savings and runway, put through the engine's own
`_wealth_blocks`, so every window arrives worked out exactly as the engine
works it out. The phone works nothing out on Wealth, so tests/expected.js has
no answers for it; the smoke test taps through it instead.

Deterministic: the same file every run.
"""
import json
import zlib
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
TRACKER = ROOT.parent / "Portfolio tracker"
sys.path.insert(0, str(TRACKER))

from src import asset_prices, calculations, engine, export_summary, manual_assets  # noqa: E402

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
    main = build_main(frame, twr, generated_at)
    screens, price_parts, assets = build_screens(frame, main, generated_at, rng)
    wealth = build_wealth(frame, main, assets, generated_at, rng)
    # in the engine's order: main last
    return {**price_parts, "screens": screens, "wealth": wealth, "series": series, "main": main}


# --- the other screens, through the engine's own builders ----------------------

#: Positions sold since, with what selling them booked. With the trimmed one
#: below they add up to the header's made-up realized €1,234.56.
CLOSED = [
    ("Demo Airline Group", "DAIR.AS", 812.40),
    ("Demo Biotech Inc", "DBIO", -243.10),
    ("Demo Retail Chain", "DRTL.DE", 390.26),
    ("Demo Mining Co", "DMIN.L", -61.00),
]
#: A holding partly sold and still held, for Realized's "partly sold" row.
TRIMMED = ("DTEC.AS", 336.00)
#: Who pays the series' quarterly dividends: share of each, tax withheld.
PAYERS = [("DWLD.DE", 0.5, 0.0), ("DSPX.L", 0.3, 0.15), ("DBNK.AS", 0.2, 0.15)]
#: Small enough that the demo's price histories come in parts, as the real
#: ones will once they outgrow one document: the phone must join them.
DEMO_PART_BYTES = 60_000


def _isin(ticker):
    return f"XX{zlib.crc32(ticker.encode()) % 10**10:010d}"


def _walk(rng, days, last):
    """A made-up price history on trading days, ending at `last`."""
    path = np.exp(np.cumsum(rng.normal(0.0003, 0.013, len(days))))
    return pd.Series(path * last / path[-1], index=days).round(4)


def _trades_and_histories(main, rng):
    trading = pd.bdate_range(START, END)
    histories, trades, summary = {}, [], []

    def trade(day, isin, name, qty, px, broker):
        trades.append({
            "isin": isin, "product": name, "txn_date": f"{day:%Y-%m-%d}", "txn_time": "09:30",
            "quantity": qty, "value_eur": round(-qty * px, 2), "is_corporate_action": 0,
            "broker": broker,
        })

    for k, h in enumerate(main["holdings"]):
        days = trading[trading >= trading[0] + pd.Timedelta(days=45 * k)]
        history = _walk(rng, days, h["price_eur"])
        histories[h["isin"]] = history
        realized = TRIMMED[1] if h["ticker"] == TRIMMED[0] else 0.0
        sold = round(h["quantity"] / 3, 4) if realized else 0.0
        first, second = days[5], days[len(days) // 2]
        bought_first = round((h["quantity"] + sold) * 0.6, 4)
        trade(first, h["isin"], h["name"], bought_first, history[first] * 1.002, h["broker"])
        trade(second, h["isin"], h["name"], h["quantity"] + sold - bought_first, history[second] * 0.998, h["broker"])
        if sold:
            day = days[int(len(days) * 0.85)]
            trade(day, h["isin"], h["name"], -sold, history[day], h["broker"])
        summary.append({
            "isin": h["isin"], "name": h["name"], "quantity": h["quantity"],
            "cost_basis_eur": h["cost_basis_eur"], "avg_cost_eur": h["avg_cost_eur"],
            "realized_pnl_eur": realized, "fees_eur": -2.0 * (3 if sold else 2),
        })
    for k, (name, ticker, realized) in enumerate(CLOSED):
        isin = _isin(ticker)
        days = trading[trading >= trading[0] + pd.Timedelta(days=60 + 90 * k)]
        history = _walk(rng, days, 10.0 + 7 * k)
        histories[isin] = history
        qty = 40.0 + 10 * k
        bought, sold = days[10], days[260 + 40 * k]
        trade(bought, isin, name.upper(), qty, history[bought], "DeGiro")
        trade(sold, isin, name.upper(), -qty, history[sold], "DeGiro")
        summary.append({
            "isin": isin, "name": name.upper(), "quantity": 0.0, "cost_basis_eur": 0.0,
            "avg_cost_eur": None, "realized_pnl_eur": realized, "fees_eur": -4.0,
        })

    tx = pd.DataFrame(trades)
    summary = pd.DataFrame(summary)
    span = tx.groupby("isin")["txn_date"].agg(["min", "max"])
    summary["first_txn"] = summary["isin"].map(span["min"])
    summary["last_txn"] = summary["isin"].map(span["max"])
    return tx, summary, histories


def _dividend_events(frame, main):
    """The series' quarterly income, paid by three of the holdings."""
    by_ticker = {h["ticker"]: h for h in main["holdings"]}
    rows = []
    for day, net in frame.loc[frame["income_eur"] > 0, "income_eur"].items():
        for ticker, share, tax in PAYERS:
            h = by_ticker[ticker]
            gross = net * share / (1 - tax)
            base = {"isin": h["isin"], "product": h["name"], "event_date": f"{day:%Y-%m-%d}", "currency": "EUR"}
            rows.append({**base, "event_type": "dividend", "amount": gross, "amount_eur": gross})
            if tax:
                rows.append({**base, "event_type": "dividend_tax", "amount": net * share - gross,
                             "amount_eur": net * share - gross})
    return pd.DataFrame(rows)


def _cash_events(frame, tx, dividends):
    """Every euro the demo moved, with the series' cash as the balance after.
    The Revolut account is fully invested, so its balance stays at zero."""
    cash = frame["cash_eur"]
    events = []

    def event(day, kind, amount, text, broker="DeGiro"):
        day = pd.Timestamp(day)
        events.append({
            "event_date": f"{day:%Y-%m-%d}", "event_time": "09:00", "description": text,
            "event_type": kind, "currency": "EUR", "amount": round(float(amount), 2),
            "balance_currency": "EUR", "broker": broker,
            "balance": 0.0 if broker == "Revolut" else float(cash[day]),
        })

    moved = frame["net_deposits_eur"].diff().fillna(frame["net_deposits_eur"].iloc[0])
    for day, amount in moved[moved != 0].items():
        event(day, "deposit" if amount > 0 else "withdrawal", amount, "Deposit" if amount > 0 else "Withdrawal")
    for row in dividends.itertuples():
        event(row.event_date, row.event_type, row.amount_eur, "Dividend" if row.event_type == "dividend" else "Dividend tax")
    for row in tx.itertuples():
        words = f"{'Buy' if row.quantity > 0 else 'Sell'} {abs(row.quantity):g} {row.product.title()}"
        event(row.txn_date, "trade", row.value_eur, words, row.broker)
        event(row.txn_date, "transaction_fee", -2.0, "Transaction fee", row.broker)
    for day in pd.date_range("2025-01-01", END, freq="MS"):
        event(day, "interest", 0.85, "Interest")
    event(END, "interest", 0.12, "Interest")  # so the last balance is the header's cash
    ce = pd.DataFrame(events).sort_values(["event_date"], kind="stable").reset_index(drop=True)
    ce["id"] = range(len(ce), 0, -1)  # booking order is descending id, as DeGiro's
    return ce


def build_screens(frame, main, generated_at, rng):
    """The screens document and the price histories, made by the engine's own
    builders from made-up trades, dividends and cash; and the other assets,
    which Wealth counts too."""
    tx, summary, histories = _trades_and_histories(main, rng)
    dividends = _dividend_events(frame, main)
    ce = _cash_events(frame, tx, dividends)
    header = main["header"]
    cash = {"eur": header["cash_eur"], "held": {"EUR": header["cash_eur"]},
            "rates": {"EUR": 1.0, "USD": 0.92}}

    assets = pd.DataFrame([{
        "id": 1, "name": "Demo Wristwatch", "category": "Watch", "purchase_date": "2025-06-01",
        "purchase_price_eur": 7400.0, "current_value_eur": header["other_assets_eur"],
        "market_reference": "thewatchinfo:1", "valued_on": "2026-10-23",
        "valued_from": asset_prices.SOURCE, "notes": "Made up for the demo.",
    }], columns=manual_assets.COLUMNS)
    guide = asset_prices.Quote(reference="DEMO", median=round(header["other_assets_eur"] / 0.92, 2),
                               p25=7200.0, p75=8100.0, sample=4, currency="USD")
    quotes = {"thewatchinfo:1": guide}
    assets, problems = engine._repriced_assets(assets, quotes, cash["rates"], "2026-10-23")

    screens = engine._screens_document(
        tx, ce, (summary, pd.DataFrame(main["holdings"]), cash), dividends,
        frame[["cash_eur", "net_deposits_eur"]], assets, quotes, problems, generated_at,
    )
    budget = engine.PRICE_PART_BYTES
    engine.PRICE_PART_BYTES = DEMO_PART_BYTES
    try:
        parts = engine._price_documents(histories, generated_at)
    finally:
        engine.PRICE_PART_BYTES = budget
    return screens, parts, assets


# --- Wealth, through the engine's own builders ---------------------------------

#: The demo's "today": the series' last day, so the windows end there.
TODAY = date(2026, 10, 23)


def _months(first, last):
    out, (y, m) = [], first
    while (y, m) <= last:
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _workbook(frame, rng):
    """A made-up wealth workbook export, as `networth.load` returns it: a row
    a month or so from Feb 2022, the first four typed as totals only, two
    whose recorded total is off, and the newest on the series' last day."""
    rows, cash, pension = [], 7000.0, 0.0
    for period in _months((2022, 2), (2026, 10)):
        if period in ("2023-08", "2025-01"):  # a month nobody filled in
            continue
        day = TODAY if period == "2026-10" else pd.Timestamp(f"{period}-{18 + rng.integers(0, 10):02d}").date()
        cash = max(2000.0, cash + rng.normal(150, 900))
        pension = pension + 180.0 if period >= "2024-01" else 0.0
        stamp = pd.Timestamp(day)
        broker = (
            float(frame["value_eur"].asof(stamp) + frame["cash_eur"].asof(stamp))
            if stamp >= frame.index[0] else 9000.0
        )
        crypto = round(600 + 400 * np.sin(len(rows) / 5.0), 2)
        accounts = {"Demo Broker": round(broker, 2), "Demo Crypto": crypto,
                    "Demo Bank": round(cash * 0.7, 2), "Demo Savings": round(cash * 0.3, 2)}
        if pension:
            accounts["Demo Pension"] = round(pension, 2)
        total = round(sum(accounts.values()), 2)
        breakdown = len(rows) >= 4
        recorded = total + {"2023-05": 10.0, "2025-09": 1250.0}.get(period, 0.0)
        rows.append({
            "date": day.isoformat(), "period": period,
            "total": total if breakdown else round(recorded, 2),
            "investment": round(broker + crypto, 2) if breakdown else None,
            "cash": round(cash, 2) if breakdown else None,
            "pension": round(pension, 2) if breakdown else None,
            "unclassified": 0.0 if breakdown else None,
            "accounts": accounts if breakdown else {},
            "has_breakdown": breakdown,
            "recorded_total": round(recorded, 2),
            "disagreement": round(recorded - total, 2) if breakdown else None,
        })
    return {"ok": True, "path": "demo", "modified": "2026-10-23T18:55:00",
            "snapshots": rows, "unknown_accounts": [], "generated_at": "2026-10-23T19:00:04"}


def _portfolio_summary(frame, assets, generated_at):
    """`export_summary.build_summary`'s shape, from the demo's daily series:
    what the portfolio was worth at each month end, and what had been put in."""
    ends = frame.groupby(frame.index.strftime("%Y-%m")).last()
    last = frame.iloc[-1]
    return {
        "schema_version": export_summary.SCHEMA_VERSION, "generated_at": generated_at, "empty": False,
        "coverage": {}, "totals": {"total_eur": round(float(last["value_eur"] + last["cash_eur"]), 2)},
        "other_assets": export_summary.other_assets_rows(assets),
        "months": [
            {"period": period, "value_eur": round(float(row["value_eur"]), 2),
             "cash_eur": round(float(row["cash_eur"]), 2),
             "net_deposits_eur": round(float(row["net_deposits_eur"]), 2)}
            for period, row in ends.iterrows()
        ],
    }


def _budget_months(rng):
    """What `analytics.savings` reads, per month: spending since Oct 2020, a
    salary from Feb 2022, two months with nothing at all, and the month in
    progress with only part of its spending entered."""
    out = {}
    for period in _months((2020, 10), (2026, 10)):
        if period in ("2023-03", "2023-04"):
            continue
        spent = 1650.40 if period == "2026-10" else round(float(rng.normal(2900, 380)), 2)
        salary = round(3300 + 120 * (int(period[:4]) - 2022), 2) if period >= "2022-02" else None
        out[period] = (salary, spent)
    return out


def _saving_for(table):
    """`analytics.savings(store, months, today)`, in its shape, over the
    made-up months: the rows the Wealth screen reads and the counts it words."""
    current = f"{TODAY:%Y-%m}"

    def saving(months):
        rows = []
        for period in months:
            salary, spent = table.get(period, (None, None))
            state = ("no_data" if salary is None and spent is None
                     else "no_salary" if salary is None else "present")
            rows.append({"period": period, "state": state, "is_current": period == current,
                         "saved": round(salary - spent, 2) if state == "present" else None})
        return {
            "rows": rows,
            "months_missing": sum(1 for r in rows if r["state"] == "no_data"),
            "months_no_salary_past": sum(
                1 for r in rows if r["state"] == "no_salary" and not r["is_current"]
            ),
        }
    return saving


def build_wealth(frame, main, assets, generated_at, rng):
    """The Wealth document, made by the engine's own `_wealth_blocks` from a
    made-up workbook, portfolio summary, savings and runway."""
    budget = engine._budget_modules()
    table = _budget_months(rng)
    recent = [p for p in sorted(table) if p < f"{TODAY:%Y-%m}"][-12:]
    spend = round(sum(table[p][1] for p in recent) / len(recent), 2)
    total = round(main["header"]["securities_eur"] + main["header"]["cash_eur"], 2)
    report = {
        "available": True,
        "net_worth": {"total": total},
        "runway": {"months": round(total / spend, 1), "monthly_spend": spend,
                   "based_on": len(recent), "from": recent[0], "to": recent[-1]},
    }
    return engine._wealth_blocks(
        budget["networth"], budget["store_module"], _workbook(frame, rng),
        _portfolio_summary(frame, assets, generated_at), _saving_for(table), report,
        TODAY, generated_at,
    )


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
    out.update(expected_screens(documents))
    return out


def _history_back(documents, isin):
    """A price history read back as the phone reads it: the first date, then
    the gap to each next one."""
    for name, doc in documents.items():
        if name.startswith("prices-") and isin in doc["positions"]:
            entry = doc["positions"][isin]
            offsets = np.cumsum([0, *entry["gaps"]])
            index = pd.Timestamp(entry["from"]) + pd.to_timedelta(offsets, unit="D")
            return pd.Series(entry["values"], index=index, dtype=float)
    return None


def _last_day(daily):
    return f"{pd.Timestamp(daily['from']) + pd.Timedelta(days=len(daily['values']) - 1):%Y-%m-%d}"


def expected_screens(documents):
    """Position detail: for a trimmed holding and a sold one, where each range
    starts and ends on its price history and how many trades it marks —
    `app.range_start` on the series' own dates, as the app's chart does.
    And the last day of the two daily lines, Cash and the dividends."""
    screens = documents["screens"]
    positions = screens["positions"]
    picks = [
        next(p for p in positions if p["open"] and p["realized_eur"]),
        next(p for p in positions if not p["open"]),
    ]
    out = {}
    for pos in picks:
        history = _history_back(documents, pos["isin"])
        ranges = {}
        for choice in engine.FIXED_RANGES:
            start = engine.range_start(choice, history.index)
            window = history[history.index >= start]
            ranges[choice] = {
                "first": f"{window.index[0]:%Y-%m-%d}", "last": f"{window.index[-1]:%Y-%m-%d}",
                "points": len(window), "first_price": float(window.iloc[0]),
                "trades": sum(start <= pd.Timestamp(t[0]) <= history.index.max() for t in pos["trades"]),
            }
        out[pos["isin"]] = ranges
    parts = sorted(n for n in documents if n.startswith("prices-"))
    return {
        "positions": out,
        "priced": sorted(isin for n in parts for isin in documents[n]["positions"]),
        "price_parts": len(parts),
        "daily_last": {
            "cash": _last_day(screens["cash"]["history"]),
            "dividends": _last_day(screens["dividends"]["cumulative"]),
        },
    }


def check_shape(documents):
    """The demo must have exactly the engine's shape: held to what the
    tracker's engine last wrote on this laptop, when it has."""
    real = TRACKER / "data" / "engine"
    if not (real / "series.json").is_file():
        return
    load = lambda name: json.loads((real / f"{name}.json").read_text(encoding="utf-8"))  # noqa: E731
    real_series, real_main = load("series"), load("main")
    assert set(real_series) == set(documents["series"]), "series keys differ from the engine's"
    assert set(real_series["columns"]) == set(documents["series"]["columns"]), "columns differ"
    assert set(real_main) == set(documents["main"]), "main keys differ from the engine's"
    assert set(real_main["header"]) == set(documents["main"]["header"]), "header keys differ"
    if not (real / "screens.json").is_file():
        return
    real_screens, demo_screens = load("screens"), documents["screens"]
    assert set(real_screens) == set(demo_screens), "screens keys differ from the engine's"
    for block in ("allocation", "other_assets", "cash", "dividends", "realized"):
        assert set(real_screens[block]) == set(demo_screens[block]), f"{block} keys differ"
    assert set(real_screens["positions"][0]) == set(demo_screens["positions"][0]), "position keys differ"
    assert set(load("prices-1")) == set(documents["prices-1"]), "prices keys differ"
    if not (real / "wealth.json").is_file():
        return
    real_w, demo_w = load("wealth"), documents["wealth"]
    assert set(real_w) == set(demo_w), "wealth keys differ from the engine's"
    for block in ("everything", "runway"):
        assert set(real_w[block]) == set(demo_w[block]), f"wealth {block} keys differ"
    assert set(real_w["savings"]) == set(demo_w["savings"]), "wealth windows differ"
    worked = lambda doc: next(w for w in doc["savings"].values() if w["state"] == "ok")  # noqa: E731
    assert set(worked(real_w)) == set(worked(demo_w)), "a savings window's keys differ"
    first = lambda doc: next(iter(doc["everything"]["windows"].values()))  # noqa: E731
    assert set(first(real_w)) == set(first(demo_w)), "an everything window's keys differ"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    documents = build_documents()
    check_shape(documents)
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

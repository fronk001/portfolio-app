// The phone's sums against the tracker's Python, on the demo figures.
// tests/expected.js is written by tools/make_demo.py with the tracker's own
// calculations; if this fails, the phone and the Streamlit app would show
// different numbers for the same range.

import { test, eq, ok } from './harness.js';
import { EXPECTED } from './expected.js';
import { DEMO } from '../src/data/demo.js';
import * as F from '../src/core/figures.js';

const s = F.prepare(DEMO.series);
const cols = s.columns;
const close = (a, b, tol = 1e-6) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)));

function sampled(name, actual, expected) {
  for (const [i, want] of expected) {
    if (!close(actual[i], want)) throw new Error(`${name}[${i}]: expected ${want}, got ${actual[i]}`);
  }
}

const custom = { from: F.parseDay(EXPECTED.custom[0]), to: F.parseDay(EXPECTED.custom[1]) };

for (const [name, want] of Object.entries(EXPECTED.windows)) {
  const choice = name === 'custom' ? F.CUSTOM : name;
  const w = F.rangeWindow(s, choice, custom);

  test(`${name}: the range covers the same days as the app's`, () => {
    eq([w.first, w.last], [want.first, want.last]);
  });

  test(`${name}: Simple % matches calculations.simple_return_series`, () => {
    sampled('simple', F.simpleReturn(cols.value_eur, cols.net_invested_eur, cols.income_eur, w.first, w.last), want.simple);
  });

  test(`${name}: Time % matches the app's rebased index`, () => {
    const t = F.timeReturn(cols.twr_index, w.first, w.last);
    ok(close(t[t.length - 1], want.time_last), `${t[t.length - 1]} vs ${want.time_last}`);
  });

  test(`${name}: the benchmark's own return matches (Time %)`, () => {
    const aligned = F.alignedBenchmark(s.benchmarks_eur['S&P 500'], w.first, w.last);
    sampled('bench_time', F.benchmarkTime(aligned), want.bench_time);
  });

  test(`${name}: the simulated benchmark matches (Simple %)`, () => {
    const aligned = F.alignedBenchmark(s.benchmarks_eur['S&P 500'], w.first, w.last);
    sampled('bench_simple', F.benchmarkSimple(aligned, cols.value_eur, cols.net_invested_eur, w.first, w.last), want.bench_simple);
  });

  test(`${name}: Total P&L and the period's change match`, () => {
    const pnl = F.totalPnl(cols, w.first, w.last);
    ok(close(pnl[pnl.length - 1], want.pnl_last), `pnl ${pnl[pnl.length - 1]} vs ${want.pnl_last}`);
    const c = F.periodChange(cols, w.first, w.last);
    ok(close(c.value, want.change.value) && close(c.cash, want.change.cash) && close(c.deposits, want.change.deposits),
      JSON.stringify([c, want.change]));
  });
}

test('every range starts where pandas says, on the awkward days too', () => {
  for (const [last, choice, start] of EXPECTED.range_starts) {
    const days = [F.parseDay('2019-01-01'), F.parseDay(last)];
    eq(F.dayString(F.rangeStart(choice, days)), start, `${choice} from ${last}`);
  }
});

// Position detail: the price histories, read back from their parts and gaps,
// cut to each range where the app's range_start cuts them.
const docs = F.readDocuments(DEMO);

test('every price history comes back, joined from its parts', () => {
  ok(EXPECTED.price_parts > 1, 'the demo comes in parts, so the joining is tested');
  eq(Object.keys(docs.prices).sort(), EXPECTED.priced);
});

for (const [isin, ranges] of Object.entries(EXPECTED.positions)) {
  test(`Position detail ${isin}: every range covers the app's days and trades`, () => {
    const pos = docs.screens.positions.find((p) => p.isin === isin);
    const history = F.priceHistory(docs.prices[isin]);
    for (const [choice, want] of Object.entries(ranges)) {
      const w = F.rangeWindow(history, choice);
      eq([F.dayString(history.days[w.first]), F.dayString(history.days[w.last]), w.last - w.first + 1],
        [want.first, want.last, want.points], choice);
      ok(close(history.values[w.first], want.first_price), `${choice} first price`);
      eq(F.tradesOnChart(pos.trades, history.days, w.first, w.last).length, want.trades, `${choice} trades`);
    }
  });
}

test('the daily lines (Cash, dividends) end where the engine says', () => {
  const lastOf = (line) => F.dayString(F.dailyDays(line).at(-1));
  eq([lastOf(docs.screens.cash.history), lastOf(docs.screens.dividends.cumulative)],
    [EXPECTED.daily_last.cash, EXPECTED.daily_last.dividends]);
});

test('Money % comes from the engine, laid over its own range', () => {
  for (const choice of F.FIXED) {
    const w = F.rangeWindow(s, choice);
    const m = F.moneyReturn(s, choice, w.first, w.last);
    ok(m && m.length === w.last - w.first + 1, choice);
  }
});

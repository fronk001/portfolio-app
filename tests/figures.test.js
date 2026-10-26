// The edges of the phone's own sums, on small hand-made series.

import { test, eq, ok } from './harness.js';
import * as F from '../src/core/figures.js';
import { eur, pct, signedEur, titleCase } from '../src/core/format.js';

const days = (from, n) => Array.from({ length: n }, (_, i) => F.dayString(F.parseDay(from) + i * 86400000));
const series = (dates) => F.prepare({ dates, columns: {} });

test('a custom range of one day is widened back to the day before', () => {
  const s = series(days('2026-01-01', 10));
  const d = F.parseDay('2026-01-05');
  eq(F.customWindow(s, d, d), { first: 3, last: 4 });
});

test('a custom range is held inside the record', () => {
  const s = series(days('2026-01-01', 10));
  eq(F.customWindow(s, F.parseDay('2025-01-01'), F.parseDay('2027-01-01')), { first: 0, last: 9 });
});

test('Simple % is undefined, not zero, with no money committed', () => {
  const r = F.simpleReturn([0, 0, 100], [0, 0, 100], null, 0, 2);
  eq(r, [null, null, 0]);
});

test('Simple % counts dividends on the day they land', () => {
  const r = F.simpleReturn([100, 100], [100, 100], [0, 5], 0, 1);
  eq(r, [0, 5]);
});

test('a benchmark fills its gaps within the range only', () => {
  eq(F.alignedBenchmark([1, null, null, 4, null], 1, 4), [null, null, 4, 4]);
  eq(F.benchmarkTime([null, 2, 3]), [null, 0, 50]);
});

test('the simulated benchmark buys the same money into the index', () => {
  // 100 in at price 10 = 10 units; +100 at price 20 = 5 more; worth 15 x 20.
  const r = F.benchmarkSimple([10, 20], [100, 100], [100, 200], 0, 1);
  eq(r, [0, 50]);
});

test('Total P&L counts dividends from before the range too', () => {
  const cols = { value_eur: [100, 110, 120], net_invested_eur: [100, 100, 100], income_eur: [3, 0, 2] };
  eq(F.totalPnl(cols, 1, 2), [13, 25]);
});

test('names lose the broker’s capitals but keep their abbreviations', () => {
  eq(titleCase('ISHARES CORE MSCI WORLD UCITS ETF USD (ACC)'), 'Ishares Core MSCI World UCITS ETF USD (ACC)');
  eq(titleCase('BCD HOLDING SE'), 'BCD Holding SE');
  eq(titleCase('S&P 500 TRACKER'), 'S&P 500 Tracker');
});

test('money is written with the sign before the symbol', () => {
  eq([eur(-1544), signedEur(1544), signedEur(-0.4), pct(3.25, 1), pct(-1.04)], ['−€1,544', '+€1,544', '€0', '+3.3%', '−1.0%']);
});

test('a document from a newer engine is refused, not half-read', () => {
  const main = { json: JSON.stringify({ schema_version: F.SCHEMA_VERSION + 1 }) };
  eq(F.readDocuments({ main, series: { json: '{}' } }), { problem: 'newer' });
  eq(F.readDocuments({ main }), { problem: 'missing' });
  const read = F.readDocuments({ main: { json: '{"schema_version":1,"a":2}' }, series: { json: '{"dates":[]}' } });
  ok(read.main.a === 2 && Array.isArray(read.series.dates));
});

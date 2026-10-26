// What the phone works out for itself from the engine's documents: which
// days a range covers, and Value, Total P&L, Time % and Simple % across it.
// Every one of these is the tracker's own formula (src/calculations.py,
// src/app.py) written out again — a few additions each — and
// tests/contract.test.js holds them to the tracker's answers on the demo
// figures (tools/make_demo.py), so this cannot quietly disagree with the
// Streamlit app. Money % is not here: a rate solved at every point is the
// engine's job, and arrives finished per fixed range. Neither is anything on
// the other screens (Position detail to Realized): those figures arrive
// finished, and all that is done here is to read them and cut a price chart
// to its range. Nor on Wealth's: every window of its charts arrives worked out.
//
// Pure: no DOM, no storage. Days are UTC-midnight milliseconds.

export const SCHEMA_VERSION = 1;
const DAY = 86400000;

export const FIXED = ['1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', 'All'];
export const CUSTOM = 'Custom';
export const RANGES = [...FIXED, CUSTOM];
export const METRICS = ['Value', 'Return %', 'Total P&L'];
export const SIMPLE = 'Simple %';
export const TIME = 'Time %';
export const MONEY = 'Money %';
export const METHODS = [SIMPLE, TIME, MONEY];

export const parseDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const dayString = (ms) => new Date(ms).toISOString().slice(0, 10);

const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// pandas' DateOffset(months=n): the same day of the month, or that month's
// last day when it has fewer (31 Mar - 1 month = 28 Feb; 29 Feb - 1 year =
// 28 Feb).
function shiftMonths(ms, n) {
  const d = new Date(ms);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  return Date.UTC(y, m, Math.min(d.getUTCDate(), daysInMonth(y, m)));
}

// app.range_start: measured from the series' own last day, not from today.
export function rangeStart(choice, days) {
  const last = days[days.length - 1];
  switch (choice) {
    case '1W': return last - 7 * DAY;
    case '1M': return shiftMonths(last, -1);
    case '3M': return shiftMonths(last, -3);
    case '6M': return shiftMonths(last, -6);
    case 'YTD': return Date.UTC(new Date(last).getUTCFullYear(), 0, 1);
    case '1Y': return shiftMonths(last, -12);
    case '3Y': return shiftMonths(last, -36);
    case 'All': return days[0];
    default: throw new Error(`unknown range ${choice}`);
  }
}

// The documents as Firestore (or the cache) holds them: each one a JSON
// string. A document from a newer engine than this app understands is
// reported rather than half-read.
//
// `screens` and the `prices-N` parts came later (26 Oct 2026), `wealth`
// later that evening and `budget` with `budget-months` later still, so a
// device can hold figures from an engine run that had none: they are null
// then, and the screens that need them say so in a sentence.
export function readDocuments(raw) {
  if (!raw || !raw.main || !raw.series) return { problem: 'missing' };
  const parse = (d) => (typeof d.json === 'string' ? JSON.parse(d.json) : d);
  const main = parse(raw.main);
  const series = parse(raw.series);
  const screens = raw.screens ? parse(raw.screens) : null;
  const wealth = raw.wealth ? parse(raw.wealth) : null;
  const budget = raw.budget ? parse(raw.budget) : null;
  const budgetMonths = raw['budget-months'] ? parse(raw['budget-months']) : null;
  const parts = Object.keys(raw).filter((k) => /^prices-\d+$/.test(k)).map((k) => parse(raw[k]));
  const newer = [main, series, screens, wealth, budget, budgetMonths, ...parts]
    .some((d) => d && (d.schema_version || 0) > SCHEMA_VERSION);
  if (newer) return { problem: 'newer' };
  return { main, series, screens, wealth, budget, budgetMonths, prices: joinPrices(parts) };
}

// Each position's price history, from however many parts the engine split
// them into. Every part says how many there are, and the newest run's count
// holds, so a part left over from a run that needed more is ignored. Where
// two runs both carry a holding, the newer copy wins.
export function joinPrices(parts) {
  if (!parts.length) return null;
  const byAge = [...parts].sort((a, b) => (a.generated_at < b.generated_at ? -1 : a.generated_at > b.generated_at ? 1 : 0));
  const count = byAge[byAge.length - 1].parts;
  const out = {};
  for (const p of byAge) if (p.part <= count) Object.assign(out, p.positions);
  return out;
}

// A price history as the engine sends it — its first date, then the days
// from each price to the next — as days and prices.
export function priceHistory(entry) {
  const days = [parseDay(entry.from)];
  for (const gap of entry.gaps) days.push(days[days.length - 1] + gap * DAY);
  return { days, values: entry.values };
}

// A line with one value per calendar day, sent as { from, values }: its days.
export function dailyDays(line) {
  const start = parseDay(line.from);
  return line.values.map((_, i) => start + i * DAY);
}

// The trades a price chart's window shows — `[date, shares, price]`, shares
// negative for a sale — the app's markers, filtered to the window as its are.
// Each is placed on the first day of the window on or after its date, so a
// trade on a day with no price lands on the next one.
export function tradesOnChart(trades, days, first, last) {
  const out = [];
  for (const [date, qty, px] of trades) {
    const day = parseDay(date);
    if (day < days[first] || day > days[last]) continue;
    let i = first;
    while (i < last && days[i] < day) i++;
    out.push({ i, date, qty, px });
  }
  return out;
}

// The series with its days as numbers, kept beside the document.
export function prepare(series) {
  return { ...series, days: series.dates.map(parseDay) };
}

// First and last index of the days from `start` to `end`, or null.
export function windowOf(s, start, end = Infinity) {
  const { days } = s;
  let first = -1;
  let last = -1;
  for (let i = 0; i < days.length; i++) {
    if (days[i] >= start && days[i] <= end) {
      if (first < 0) first = i;
      last = i;
    }
  }
  return first < 0 ? null : { first, last };
}

// app.pick_range under Custom: bounded by the series, and a single day
// widened back to the day before — a change needs two days to measure.
export function customWindow(s, start, end) {
  const { days } = s;
  let from = Math.max(start, days[0]);
  const to = Math.min(end, days[days.length - 1]);
  if (from >= to) {
    const earlier = days.filter((d) => d < to);
    from = earlier.length ? earlier[earlier.length - 1] : days[0];
  }
  return windowOf(s, from, to);
}

export function rangeWindow(s, choice, custom) {
  if (choice === CUSTOM) return customWindow(s, custom.from, custom.to);
  return windowOf(s, rangeStart(choice, s.days));
}

// calculations.simple_return_series: gain over the money committed so far,
// the opening value counting as committed. Undefined (null) with nothing in.
export function simpleReturn(value, invested, income, first, last) {
  const out = [];
  const opening = value[first];
  let earned = 0;
  for (let i = first; i <= last; i++) {
    earned += income ? income[i] || 0 : 0;
    const committed = opening + (invested[i] - invested[first]);
    out.push(committed > 1e-9 ? (100 * (value[i] + earned - committed)) / committed : null);
  }
  return out;
}

// Time %: the time-weighted index, rebased to the range's first day.
export function timeReturn(twr, first, last) {
  const out = [];
  for (let i = first; i <= last; i++) out.push(100 * (twr[i] / twr[first] - 1));
  return out;
}

// An index's closes across the range, each gap filled from the day before
// *within* the range — `bench.reindex(window.index).ffill()` in the app.
export function alignedBenchmark(raw, first, last) {
  const out = [];
  let held = null;
  for (let i = first; i <= last; i++) {
    if (raw[i] != null) held = raw[i];
    out.push(held);
  }
  return out;
}

// The index's own return, from its first close in the range: the
// like-for-like comparison for Time %.
export function benchmarkTime(aligned) {
  const base = aligned.find((v) => v != null);
  return aligned.map((v) => (v == null || base == null ? null : 100 * (v / base - 1)));
}

// calculations.simulate_benchmark: the same money, on the same days, into
// the index instead — then Simple % of that. The comparison for Simple %.
export function benchmarkSimple(aligned, value, invested, first, last) {
  const firstClose = aligned.find((v) => v != null);
  if (firstClose == null) return aligned.map(() => null);
  const price = aligned.map((v) => (v == null ? firstClose : v)); // ffill done; bfill the start
  const sim = [];
  let units = 0;
  for (let i = first; i <= last; i++) {
    const k = i - first;
    const paid = k === 0 ? value[first] : invested[i] - invested[i - 1];
    const bought = paid / price[k];
    units += Number.isFinite(bought) ? bought : 0;
    sim.push(units * price[k]);
  }
  const simValue = new Array(first).concat(sim);
  return simpleReturn(simValue, invested, null, first, last);
}

// Value - money put in + every dividend so far: the Total P&L line.
export function totalPnl(cols, first, last) {
  let dividends = 0;
  for (let i = 0; i < first; i++) dividends += cols.income_eur[i] || 0;
  const out = [];
  for (let i = first; i <= last; i++) {
    dividends += cols.income_eur[i] || 0;
    out.push(cols.value_eur[i] - cols.net_invested_eur[i] + dividends);
  }
  return out;
}

// The sentence under the chart: what the range did to the total.
export function periodChange(cols, first, last) {
  const value = cols.total_value_eur[last] - cols.total_value_eur[first];
  const cash = cols.cash_eur[last] - cols.cash_eur[first];
  const deposits = cols.net_deposits_eur[last] - cols.net_deposits_eur[first];
  return { value, cash, deposits, gain: value - deposits };
}

// Money % for a fixed range, as the engine solved it, laid over the range.
export function moneyReturn(s, choice, first, last) {
  const solved = s.money_weighted_pct && s.money_weighted_pct[choice];
  if (!solved || solved.from !== s.dates[first]) return null;
  const values = solved.values.slice(0, last - first + 1);
  return values.length === last - first + 1 ? values : null;
}

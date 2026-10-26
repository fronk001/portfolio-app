// Numbers, dates and names as the screens write them. The tracker's own
// conventions: whole euros, the sign in front of the symbol ("−€1,544", never
// "€-1,544", which reads as a typo), and a sign on every change.

const MINUS = '−';

const number = (v, digits) => Math.abs(v).toLocaleString('en-GB', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});

// Rounds first, so a change of −€0.40 reads "€0", not "−€0".
const rounded = (v, digits) => Math.round(v * 10 ** digits) / 10 ** digits;

export function eur(v, digits = 0) {
  if (v == null || !Number.isFinite(v)) return '—';
  const r = rounded(v, digits);
  return `${r < 0 ? MINUS : ''}€${number(r, digits)}`;
}

export function signedEur(v, digits = 0) {
  if (v == null || !Number.isFinite(v)) return '—';
  const r = rounded(v, digits);
  return `${r < 0 ? MINUS : r > 0 ? '+' : ''}€${number(r, digits)}`;
}

export function pct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  const r = rounded(v, digits);
  return `${r < 0 ? MINUS : r > 0 ? '+' : ''}${number(r, digits)}%`;
}

// 'gain' / 'loss' / '' for colouring a signed figure. The sign is always
// written as well, so the meaning never rides on colour alone.
export const tone = (v) => (v == null || !Number.isFinite(v) || Math.abs(v) < 1e-9 ? '' : v > 0 ? 'gain' : 'loss');

// Short euros for a chart's axis: €950, €12k, €61.5k, €1.2M. `step` is the
// distance between gridlines, so neighbouring labels never round to the same
// text (€30k twice, when the lines are €500 apart).
export function axisEur(v, step = Infinity) {
  const a = Math.abs(v);
  let s;
  if (a >= 1e6) s = `${+(a / 1e6).toFixed(step < 1e5 ? 2 : 1)}M`;
  else if (a >= 1000) s = `${+(a / 1000).toFixed(step < 100 ? 2 : step < 1000 ? 1 : 0)}k`;
  else s = `${Math.round(a)}`;
  return `${v < 0 ? MINUS : ''}€${s}`;
}

export const axisPct = (v, step = Infinity) => `${v < 0 ? MINUS : ''}${+Math.abs(v).toFixed(step < 0.1 ? 2 : 1)}%`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "Fri 23 Oct 2026", from a UTC-midnight day.
export function longDay(ms) {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// A chart's date labels: days for a short range, months for a long one.
export function axisDay(ms, spanDays) {
  const d = new Date(ms);
  if (spanDays <= 92) return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// "21 Oct 2026" from "2026-10-21" (or a longer timestamp).
export function shortDate(text) {
  if (!text) return '—';
  const [y, m, d] = text.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// A month as the Wealth screens write it, from "2026-07": "Jul 2026" on an
// axis or a label, "July 2026" in a sentence.
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const shortMonth = (period) => `${MONTHS[+period.slice(5, 7) - 1]} ${period.slice(0, 4)}`;
export const monthName = (period) => `${MONTH_NAMES[+period.slice(5, 7) - 1]} ${period.slice(0, 4)}`;
export const axisMonth = (ms) => shortMonth(new Date(ms).toISOString().slice(0, 7));

// "26 Oct 2026 at 14:51", from a stamp written on the PC in its own time
// ("2026-10-26T14:51:28"): read as written, not converted.
export function stampText(text) {
  if (!text) return '—';
  const time = text.slice(11, 16);
  return time ? `${shortDate(text)} at ${time}` : shortDate(text);
}

// When the engine worked the figures out, in Dutch time: "14:15 today",
// "09:15 yesterday", "21:15 on 23 Oct".
export function workedOut(iso, now = new Date()) {
  if (!iso) return 'at an unknown time';
  const at = new Date(iso);
  const zone = { timeZone: 'Europe/Amsterdam' };
  const time = at.toLocaleTimeString('en-GB', { ...zone, hour: '2-digit', minute: '2-digit' });
  const day = (d) => d.toLocaleDateString('en-CA', zone);
  const yesterday = new Date(now.getTime() - 86400000);
  if (day(at) === day(now)) return `${time} today`;
  if (day(at) === day(yesterday)) return `${time} yesterday`;
  return `${time} on ${at.toLocaleDateString('en-GB', { ...zone, day: 'numeric', month: 'short' })}`;
}

// Broker names arrive in capitals ("ISHARES CORE MSCI WORLD UCITS ETF USD
// (ACC)"). Python's .title() would write "Msci" and "Etf"; these stay as
// people write them. Generic terms only, never a company's name: this repo is
// public, and a list of names would say what is held. A word with no vowel
// at all (GBP, or a made-up BCD) is an abbreviation and stays in capitals.
const KEEP = new Set(['ETF', 'ETC', 'MSCI', 'UCITS', 'FTSE', 'S&P', 'ESG', 'REIT', 'ADR', 'ACC', 'DIST', 'USD', 'EUR', 'USA', 'UK', 'EM', 'AI', 'AEX', 'NYSE', 'NV', 'SE', 'AG', 'SA', 'AB', 'BV', 'II', 'III', 'IV']);
const NO_VOWEL = /^[^AEIOUY]+$/;

export function titleCase(name) {
  return String(name || '').toLowerCase().replace(/[\p{L}&]+/gu, (w) => {
    const up = w.toUpperCase();
    return KEEP.has(up) || (w.length > 1 && NO_VOWEL.test(up)) ? up : w[0].toUpperCase() + w.slice(1);
  });
}

// A share count as written: whole ones plain, fractions in full (Revolut
// deals in 41.742603 of a share; rounding it reports a holding you don't have).
export function shares(q) {
  if (q == null || !Number.isFinite(q)) return '—';
  if (Math.abs(q - Math.round(q)) < 1e-9) return Math.round(q).toLocaleString('en-GB');
  return q.toLocaleString('en-GB', { maximumFractionDigits: 6 });
}

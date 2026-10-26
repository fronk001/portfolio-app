// The page around every screen, and the first two screens, as template
// strings re-rendered whole on every change (the page is small; it takes a
// few milliseconds). Overview is the Streamlit app's Overview: the header,
// the performance chart with the same ranges, metrics and return methods,
// and the quarterly grid. Holdings is its holdings table, as rows a thumb can
// open. The other six Portfolio screens are in screens.js.
//
// Each view returns { html, chart, map }: a chart or the Allocation map is
// drawn into its box after the page is in place (ui/chart.js), because it is
// sized to the box.

import * as F from '../core/figures.js';
import {
  axisDay, axisEur, axisPct, eur, longDay, pct, shares, shortDate, signedEur, titleCase, tone, workedOut,
} from '../core/format.js';
import { source } from '../data/store.js';
import { accountLine, syncButton } from './account.js';
import { CHEVRON, TRACKER_URL, esc, pills, plural, signedClass } from './html.js';
import * as S from './screens.js';

// The tracker's chart colours, so the two apps read the same.
const BLUE = '#2a78d6';
const ORANGE = '#eb6834';

export const NO_BENCHMARK = 'Nothing — portfolio only';

// Every screen: its route, its tab, its address. The Streamlit app's
// Portfolio sections in its order, less Log a trade, which changes figures.
export const SCREENS = [
  ['overview', 'Overview', '#/'],
  ['holdings', 'Holdings', '#/holdings'],
  ['position', 'Position', '#/position'],
  ['allocation', 'Allocation', '#/allocation'],
  ['other-assets', 'Other assets', '#/other-assets'],
  ['cash', 'Cash', '#/cash'],
  ['dividends', 'Dividends', '#/dividends'],
  ['realized', 'Realized', '#/realized'],
];

// ---- shared ------------------------------------------------------------

function shell(route, d, st, ui, body) {
  const badge = source === 'demo' ? '<div class="demo-badge">Demo data</div>'
    : source === 'local' ? '<div class="demo-badge">This laptop’s figures</div>' : '';
  return `
  ${badge}
  <div class="page">
    ${syncButton(st, ui.syncOpen)}
    ${hero(d.main)}
    <nav class="tabs" aria-label="Screens">${SCREENS.map(([r, label, href]) => `
      <a href="${href}"${r === route ? ' class="on" aria-current="page"' : ''}>${label}</a>`).join('')}
    </nav>
    ${body}
    ${facts(d.main)}
    ${accountLine(st)}
  </div>`;
}

function hero(main) {
  const h = main.header;
  const day = h.day_change_eur;
  const cashShare = h.total_value_eur ? (100 * h.cash_eur) / h.total_value_eur : null;
  return `
  <header class="hero">
    <div class="eyebrow">Portfolio value</div>
    <h1 class="big">${eur(h.total_value_eur)}</h1>
    <p class="today ${tone(day)}">${day == null ? 'No change since the previous close yet'
      : `${signedEur(day)} (${pct(h.day_change_pct, 2)}) since the previous close`}</p>
    <div class="tiles">
      <div class="tile"><span class="l">Total P&amp;L</span><span class="v ${tone(h.total_pnl_eur)}">${signedEur(h.total_pnl_eur)}</span></div>
      <div class="tile"><span class="l">Cash</span><span class="v">${eur(h.cash_eur)}</span>${cashShare == null ? '' : `<span class="s">${cashShare.toFixed(1)}% of the total</span>`}</div>
    </div>
  </header>`;
}

// What the figures are and how far they reach: stated, never warned about.
function facts(main) {
  const lines = [];
  if (source === 'demo') lines.push('Made-up figures, to try the app out with.');
  else lines.push(`Worked out ${workedOut(main.generated_at)}${source === 'local' ? ' on this laptop' : ' by the cloud engine'}.`);
  const n = main.prices.fallback_count;
  if (n) lines.push(`${n} ${plural(n, 'holding')} priced at the last close (${shortDate(main.prices.fallback_as_of)}): Yahoo didn’t answer that time.`);
  const brokers = Object.keys({ ...main.trades_to, ...main.uploads }).sort();
  if (brokers.length) {
    lines.push(`Trades: ${brokers.map((b) => {
      const u = main.uploads[b];
      const to = u && (u.trades_covered_to || u.covered_to);
      return to ? `${esc(b)} complete up to ${shortDate(to)}` : `${esc(b)} up to ${shortDate(main.trades_to[b])}`;
    }).join(' · ')}.`);
  }
  lines.push(`Imports, Budget and Wealth: <a href="${TRACKER_URL}" target="_blank" rel="noopener">open the full tracker</a>.`);
  return `<footer class="facts">${lines.map((l) => `<p>${l}</p>`).join('')}</footer>`;
}

// ---- Overview ------------------------------------------------------------

const METHOD_HELP = {
  [F.SIMPLE]: 'Simple %: the gain divided by the money you put in. A large recent deposit pulls it down, having had no time to earn anything yet.',
  [F.TIME]: 'Time %: time-weighted, so deposits and withdrawals cancel out. What a fund quotes, and the only one fair to compare with an index.',
  [F.MONEY]: 'Money %: money-weighted, as a rate per year. Every euro counts for as long as it was invested: how your own money did.',
};

function returnChart(s, ui, first, last, days) {
  const cols = s.columns;
  const notes = [];
  let mine;
  if (ui.method === F.SIMPLE) mine = F.simpleReturn(cols.value_eur, cols.net_invested_eur, cols.income_eur, first, last);
  else if (ui.method === F.TIME) mine = F.timeReturn(cols.twr_index, first, last);
  else mine = ui.range === F.CUSTOM ? null : F.moneyReturn(s, ui.range, first, last);

  if (ui.method === F.MONEY && ui.range === F.CUSTOM) {
    return { empty: 'Money % is worked out ahead for the fixed ranges, 1W to All. For a range of your own, use Simple % or Time %.' };
  }
  // One solved point is a dot, not a line: 1M sits right on the 30-day warm-up.
  if (!mine || mine.filter((v) => v != null).length < 2) {
    return { empty: `A money-weighted return needs more history than ${ui.range} gives it: annualising a stretch this short produces a number that swings by hundreds of percent. Try 3M or longer, or use Simple % for a short period.` };
  }

  let bench = null;
  const raw = ui.bench !== NO_BENCHMARK && s.benchmarks_eur[ui.bench];
  if (raw) {
    const aligned = F.alignedBenchmark(raw, first, last);
    if (ui.method === F.TIME) bench = F.benchmarkTime(aligned);
    else if (ui.method === F.SIMPLE) bench = F.benchmarkSimple(aligned, cols.value_eur, cols.net_invested_eur, first, last);
    else notes.push('The comparison line isn’t drawn under Money % here yet; Time % compares like for like.');
  } else if (ui.bench !== NO_BENCHMARK) {
    notes.push(`${esc(ui.bench)} wasn’t available when these figures were worked out.`);
  }

  const latest = [...mine].reverse().find((v) => v != null);
  const perYear = ui.method === F.MONEY ? '<span class="per">per year</span>' : '';
  const headline = `<p class="headline ${tone(latest)}">${pct(latest, 1)}${perYear}</p>`;
  if (ui.method === F.MONEY && last - first + 1 < 120) {
    notes.push(`Over a range as short as ${ui.range} that rate is extrapolated from a few weeks, so read it as a direction rather than a forecast: 1Y or longer settles it down.`);
  }
  const lines = [{ values: mine, color: BLUE }];
  if (bench) lines.push({ values: bench, color: ORANGE });
  return {
    headline,
    notes,
    chart: {
      label: 'Return over the range',
      days, lines, zero: true, yLabel: axisPct, xLabel: axisDay,
      readout: (i) => `<b>${longDay(days[i])}</b><span class="k" style="--c:${BLUE}">Portfolio <span ${signedClass(mine[i])}>${pct(mine[i])}</span></span>${bench
        ? `<span class="k" style="--c:${ORANGE}">${esc(ui.bench)} <span ${signedClass(bench[i])}>${pct(bench[i])}</span></span>` : ''}`,
    },
  };
}

function overview(d, ui) {
  const s = d.series;
  const cols = s.columns;
  const w = F.rangeWindow(s, ui.range, ui.custom);
  const controls = `
    ${pills('range', F.RANGES, ui.range, 'Range')}
    ${ui.range === F.CUSTOM ? customDates(s, ui) : ''}
    ${pills('metric', F.METRICS, ui.metric, 'What to show')}
    ${ui.metric === 'Return %' ? `
      ${pills('method', F.METHODS, ui.method, 'Return method')}
      <label class="select">Compare against
        <select data-act="bench">${[NO_BENCHMARK, ...Object.keys(s.benchmarks_eur)].map((b) => `
          <option${b === ui.bench ? ' selected' : ''}>${esc(b)}</option>`).join('')}
        </select>
      </label>` : ''}`;
  if (!w) return { html: `<section class="card chart-card">${controls}<p class="empty">No figures in this range.</p></section>${quarters(d.main)}`, chart: null };

  const { first, last } = w;
  const days = s.days.slice(first, last + 1);
  let chart = null;
  let headline = '';
  let notes = [];
  let empty = '';

  if (ui.metric === 'Value') {
    // What was put in is read out, not drawn: as a second line it stretches
    // the scale to cover both and flattens the value into a strip, which is
    // why the Streamlit app keeps it switched off as well.
    const value = cols.total_value_eur.slice(first, last + 1);
    const putIn = cols.net_deposits_eur.slice(first, last + 1);
    chart = {
      label: 'Portfolio value',
      days, yLabel: axisEur, xLabel: axisDay,
      lines: [{ values: value, color: BLUE }],
      readout: (i) => `<b>${longDay(days[i])}</b><span class="k" style="--c:${BLUE}">Value ${eur(value[i])}</span><span class="plain">put in ${eur(putIn[i])}</span>`,
    };
  } else if (ui.metric === 'Total P&L') {
    const pnl = F.totalPnl(cols, first, last);
    chart = {
      label: 'Total profit and loss',
      days, yLabel: axisEur, xLabel: axisDay, zero: Math.min(...pnl) <= 0,
      lines: [{ values: pnl, color: BLUE }],
      readout: (i) => `<b>${longDay(days[i])}</b><span class="k" style="--c:${BLUE}">Total P&amp;L <span ${signedClass(pnl[i])}>${signedEur(pnl[i])}</span></span>`,
    };
  } else {
    const r = returnChart(s, ui, first, last, days);
    ({ chart = null, headline = '', notes = [], empty = '' } = r);
  }

  const c = F.periodChange(cols, first, last);
  const sentence = `${rangeLabel(ui, days)}: portfolio value ${signedEur(c.value)} (of which cash ${signedEur(c.cash)}), on ${signedEur(c.deposits)} net deposits, so a gain of ${signedEur(c.gain)}, dividends and interest included.`;

  return {
    html: `
    <section class="card chart-card">
      ${controls}
      ${headline}
      ${empty ? `<p class="empty">${empty}</p>` : '<div class="chart"><div class="readout" aria-live="polite"></div><div class="chart-box"></div></div>'}
      <p class="caption">${sentence}</p>
      ${ui.metric === 'Return %' ? `<p class="caption">${METHOD_HELP[ui.method]}</p>` : ''}
      ${notes.map((n) => `<p class="caption">${n}</p>`).join('')}
    </section>
    ${quarters(d.main)}`,
    chart: empty ? null : chart,
  };
}

const RANGE_WORDS = {
  '1W': 'The last week', '1M': 'The last month', '3M': 'The last 3 months', '6M': 'The last 6 months',
  YTD: 'This year so far', '1Y': 'The last year', '3Y': 'The last 3 years', All: 'Since the start',
};

function rangeLabel(ui, days) {
  if (ui.range !== F.CUSTOM) return RANGE_WORDS[ui.range];
  return `${longDay(days[0])} to ${longDay(days[days.length - 1])}`;
}

function customDates(s, ui) {
  const min = s.dates[0];
  const max = s.dates[s.dates.length - 1];
  return `
  <div class="dates">
    <label>From<input type="date" data-act="custom-from" min="${min}" max="${max}" value="${F.dayString(ui.custom.from)}"></label>
    <label>To<input type="date" data-act="custom-to" min="${min}" max="${max}" value="${F.dayString(ui.custom.to)}"></label>
  </div>`;
}

// The quarterly grid: time-weighted whatever is chosen above, because a
// comparison across periods is the one job time-weighting exists to do.
function quarters(main) {
  if (!main.returns_table.length) return '';
  const rows = [...main.returns_table].reverse().map((r) => `
    <tr><th scope="row">${r.year}</th>${['Q1', 'Q2', 'Q3', 'Q4', 'FY'].map((q) => `<td ${signedClass(r[q])}>${r[q] == null ? '' : pct(r[q], 1)}</td>`).join('')}</tr>`).join('');
  return `
  <section class="block">
    <h2>Returns by quarter</h2>
    <div class="card table-card">
      <table class="rtable">
        <thead><tr><th></th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Year</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="caption">Time-weighted, dividends included.</p>
  </section>`;
}

// ---- Holdings ------------------------------------------------------------

function holdingDetail(h) {
  const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  return `
  <dl class="detail">
    ${row('Shares', shares(h.quantity))}
    ${row('Price', `${h.price_native == null ? '—' : `${h.price_native.toLocaleString('en-GB', { maximumFractionDigits: 2 })} ${esc(h.currency || '')}`}${h.currency && h.currency !== 'EUR' ? ` · ${eur(h.price_eur, 2)}` : ''}`)}
    ${row('Average cost', eur(h.avg_cost_eur, 2))}
    ${row('Paid in total', eur(h.cost_basis_eur))}
    ${row('Today', `<span ${signedClass(h.day_eur)}>${signedEur(h.day_eur, 2)}</span>`)}
    ${row('Unrealized', `<span ${signedClass(h.upl_eur)}>${signedEur(h.upl_eur)}</span>`)}
    ${row('Share of the total', h.weight_pct == null ? '—' : `${h.weight_pct.toFixed(1)}%`)}
    ${row('Account', esc(h.broker))}
    ${h.price_as_of ? row('Priced at', `the close of ${shortDate(h.price_as_of)}`) : ''}
    <div class="wide-row"><a href="#/position/${esc(h.isin)}">Price chart, trades and dividends →</a></div>
  </dl>`;
}

function holdings(d, ui) {
  const main = d.main;
  const h = main.header;
  const rows = main.holdings.map((x) => {
    const open = ui.open === x.isin;
    return `
    <li class="holding${open ? ' open' : ''}">
      <button class="hrow" data-act="holding" data-v="${esc(x.isin)}" aria-expanded="${open}">
        <span class="n">${esc(titleCase(x.name))}</span>
        <span class="v">${eur(x.value_eur)}</span>
        <span class="m">
          <span>Today <span ${signedClass(x.day_pct)}>${pct(x.day_pct, 1)}</span></span>
          <span>P&amp;L <span ${signedClass(x.upl_pct)}>${pct(x.upl_pct, 1)}</span></span>
        </span>
        ${CHEVRON}
      </button>
      ${open ? holdingDetail(x) : ''}
    </li>`;
  }).join('');
  const unpriced = main.holdings.filter((x) => x.value_eur == null);
  return {
    html: `
    <section class="block">
      <div class="tiles three">
        <div class="tile"><span class="l">In shares</span><span class="v">${eur(h.securities_eur)}</span></div>
        <div class="tile"><span class="l">Unrealized</span><span class="v ${tone(h.unrealized_eur)}">${signedEur(h.unrealized_eur)}</span></div>
        <div class="tile"><span class="l">Realized + dividends</span><span class="v ${tone(h.realized_eur + h.dividends_net_eur)}">${signedEur(h.realized_eur + h.dividends_net_eur)}</span></div>
      </div>
      <ul class="holdings">${rows}</ul>
      <p class="caption">${main.holdings.length} ${plural(main.holdings.length, 'holding')}, largest first. Today is the change since the previous close, in euros, so a currency move counts. P&amp;L is the gain on what you still hold, against what you paid.</p>
      ${unpriced.length ? `<p class="caption">Not in the totals (no price): ${unpriced.map((x) => esc(titleCase(x.name))).join(', ')}.</p>` : ''}
    </section>`,
    chart: null,
  };
}

const VIEWS = {
  overview,
  holdings,
  position: S.position,
  allocation: S.allocation,
  'other-assets': S.otherAssets,
  cash: S.cash,
  dividends: S.dividends,
  realized: S.realized,
};

export function renderPage(route, d, ui, st) {
  const view = (VIEWS[route] || overview)(d, ui);
  return { html: shell(route, d, st, ui, view.html), chart: view.chart || null, map: view.map || null };
}

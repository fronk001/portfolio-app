// The other six Portfolio screens of the Streamlit tracker — Position detail,
// Allocation, Other assets, Cash, Dividends, Realized vs Unrealized — drawn
// from the engine's `screens` and `prices-N` documents (added 26 Oct 2026).
//
// Nothing is worked out here. Every total, weight and share arrives finished
// (the tracker's src/engine.py, held to the Streamlit app by its
// tests/test_engine.py); this file only lays the figures out, cuts Position
// detail's price chart to the range chosen, and sizes bars and tiles to
// them. Each view returns { html, chart, map }, as views.js's do.

import { pnlColour } from '../core/chart.js';
import * as F from '../core/figures.js';
import {
  axisDay, axisEur, eur, longDay, pct, shares, shortDate, signedEur, titleCase, tone,
} from '../core/format.js';
import { CHEVRON, TRACKER_URL, esc, pills, plural, signedClass, tile } from './html.js';

// The tracker's chart colours.
const BLUE = '#2a78d6';
const PURPLE = '#7a5cd0';

// Figures from an engine run older than these screens: said, not an error.
const notYet = (what) => `
  <section class="card note-card">
    <p class="empty">${what} come with the next run of the cloud engine. The figures on this device were worked out before this screen existed; they update by themselves within the hour.</p>
  </section>`;

const page = (html, extra = {}) => ({ html, chart: null, map: null, ...extra });

const name = (n) => esc(titleCase(n));

// A table whose columns past `keep` are left out on a phone, as the
// Streamlit app drops its least-used columns there.
function table(heads, rows, { keep = heads.length, cls = '' } = {}) {
  const wide = (k) => (k >= keep ? ' class="wide"' : '');
  return `
  <div class="card table-card">
    <table class="dtable ${cls}">
      <thead><tr>${heads.map((h, k) => `<th${wide(k)}>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c, k) => `<td${wide(k)}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

// ---- Position detail ------------------------------------------------------

function picker(list, chosen) {
  const option = (p) => `<option value="${esc(p.isin)}"${p === chosen ? ' selected' : ''}>${name(p.name)}</option>`;
  const held = list.filter((p) => !p.closed);
  const sold = list.filter((p) => p.closed);
  return `
  <label class="select">Position
    <select data-act="position">
      <optgroup label="Held now">${held.map(option).join('')}</optgroup>
      ${sold.length ? `<optgroup label="Sold">${sold.map(option).join('')}</optgroup>` : ''}
    </select>
  </label>`;
}

function priceChart(pos, entry, ui) {
  const history = F.priceHistory(entry);
  const last = history.days[history.days.length - 1];
  const custom = ui.posCustom || { from: F.rangeStart('3M', history.days), to: last };
  const w = F.rangeWindow(history, ui.posRange, custom);
  const controls = `
    ${pills('pos-range', F.RANGES, ui.posRange, 'Range')}
    ${ui.posRange === F.CUSTOM ? `
    <div class="dates">
      <label>From<input type="date" data-act="pos-from" min="${entry.from}" max="${F.dayString(last)}" value="${F.dayString(custom.from)}"></label>
      <label>To<input type="date" data-act="pos-to" min="${entry.from}" max="${F.dayString(last)}" value="${F.dayString(custom.to)}"></label>
    </div>` : ''}`;
  if (!w) return { html: `${controls}<p class="empty">No prices in this range.</p>`, chart: null };

  const { first, last: end } = w;
  const days = history.days.slice(first, end + 1);
  const prices = history.values.slice(first, end + 1);
  // a trade with no known price (none so far) is left off rather than drawn at zero
  const trades = F.tradesOnChart(pos.trades, history.days, first, end)
    .filter((t) => t.px != null).map((t) => ({ ...t, i: t.i - first }));
  const known = prices.filter((v) => v != null);
  // As in the app: only when it falls inside the prices on screen, or it
  // would stretch the scale down to a cost the range never reaches.
  const avg = pos.avg_cost_eur;
  const level = pos.open && avg && avg >= Math.min(...known) && avg <= Math.max(...known)
    ? { value: avg, label: `avg cost ${eur(avg, 2)}` } : null;
  const tradeWords = (t) => `${t.qty > 0 ? 'Bought' : 'Sold'} ${shares(Math.abs(t.qty))} @ ${eur(t.px, 2)}`;

  return {
    html: `
      ${controls}
      <div class="chart"><div class="readout" aria-live="polite"></div><div class="chart-box"></div></div>
      <p class="caption">The price in euros. ▲ a buy, ▼ a sale, at what you paid or got per share${level ? '; the dotted line is your average cost' : ''}.</p>`,
    chart: {
      label: 'Price in euros',
      days, yLabel: axisEur, xLabel: axisDay,
      lines: [{ values: prices, color: BLUE }],
      marks: trades.map((t) => ({ i: t.i, value: t.px, up: t.qty > 0 })),
      level,
      readout: (i) => `<b>${longDay(days[i])}</b><span class="k" style="--c:${BLUE}">Price ${eur(prices[i], 2)}</span>${trades.filter((t) => t.i === i).map((t) => `<span class="plain">${tradeWords(t)}</span>`).join('')}`,
    },
  };
}

export function position(d, ui) {
  if (!d.screens) return page(notYet('Position detail’s figures'));
  const list = d.screens.positions;
  if (!list.length) return page('<p class="empty">No positions yet.</p>');
  const pos = list.find((p) => p.isin === ui.pos) || list[0];

  let chartHtml;
  let chart = null;
  if (!d.prices) chartHtml = '<p class="empty">The price history comes with the next run of the cloud engine.</p>';
  else if (!d.prices[pos.isin]) chartHtml = '<p class="empty">No price history available for this instrument (delisted or unmapped).</p>';
  else ({ html: chartHtml, chart } = priceChart(pos, d.prices[pos.isin], ui));

  const dash = '—';
  const payments = pos.dividends.length ? `
    <section class="block">
      <h2>Dividend payments</h2>
      ${table(['Date', 'Gross', 'Tax', 'Net'], pos.dividends.map(([date, gross, tax, net]) => [
        shortDate(date), eur(gross, 2), tax == null ? dash : signedEur(tax, 2), `<span ${signedClass(net)}>${signedEur(net, 2)}</span>`,
      ]), { cls: 'num first-text' })}
    </section>` : '';

  return page(`
    <section class="block">
      ${picker(list, pos)}
      <div class="tiles six">
        ${tile('Quantity', shares(pos.quantity))}
        ${tile('Value', pos.open ? eur(pos.value_eur) : dash)}
        ${tile('Unrealized', pos.open ? signedEur(pos.upl_eur) : dash, '', pos.open ? tone(pos.upl_eur) : '')}
        ${tile('Realized', signedEur(pos.realized_eur), '', tone(pos.realized_eur))}
        ${tile('Dividends (net)', signedEur(pos.dividends_net_eur), '', tone(pos.dividends_net_eur))}
        ${tile('Total P&amp;L', signedEur(pos.total_pnl_eur), '', tone(pos.total_pnl_eur))}
      </div>
      <p class="caption">Total P&amp;L is unrealized + realized + net dividends, fees included.</p>
    </section>
    <section class="card chart-card">${chartHtml}</section>
    ${payments}`, { chart });
}

// ---- Allocation -------------------------------------------------------------

export function allocation(d) {
  const a = d.screens && d.screens.allocation;
  if (!a) return page(notYet('Allocation’s figures'));
  const tiles = a.tiles;
  const label = (t) => (t.cash ? 'Cash' : name(t.name));
  const heaviest = Math.max(...tiles.map((t) => t.weight_pct || 0)) || 1;

  const rows = tiles.map((t) => {
    const inner = `
      <span class="n">${label(t)}</span>
      <span class="v">${eur(t.value_eur)}</span>
      <span class="bar-track"><span class="bar" style="width:${((100 * (t.weight_pct || 0)) / heaviest).toFixed(1)}%"></span></span>
      <span class="m"><span>${(t.weight_pct || 0).toFixed(1)}%</span>${t.cash ? '' : `<span>P&amp;L <span ${signedClass(t.upl_pct)}>${pct(t.upl_pct, 1)}</span></span>`}</span>`;
    return `<li>${t.isin && !t.cash ? `<a class="rank" href="#/position/${esc(t.isin)}">${inner}</a>` : `<div class="rank">${inner}</div>`}</li>`;
  }).join('');

  const accounts = a.accounts.length ? `
    <section class="block">
      <h2>By account</h2>
      <div class="tiles">${a.accounts.map((x) => tile(esc(x.broker), eur(x.value_eur), x.pct == null ? '' : `${x.pct.toFixed(1)}% of the portfolio`)).join('')}</div>
      <p class="caption">Securities plus free cash, per account. The rest of the app deliberately merges them: the same holding bought at two brokers is one position with one average cost. These add up to 100% of the portfolio value: everything counted in it sits in one of these accounts.</p>
    </section>` : '';

  return page(`
    <section class="card chart-card">
      <div class="readout map-readout" aria-live="polite"></div>
      <div class="map-box"></div>
      <p class="caption">Tile size is the share of the portfolio; colour is the unrealized P&amp;L (red a loss, green a gain, at its strongest from ±40%). Cash is sized like any other position but left uncoloured: it has no P&amp;L of its own. These weights cover the whole ${eur(a.total_value_eur)} at the top of the page.${a.other_assets_eur ? ` Your other assets (${eur(a.other_assets_eur)}) are not on the map and not in that total: they count under Wealth, with everything you own.` : ''}</p>
    </section>
    <section class="block">
      <ul class="ranks">${rows}</ul>
      <p class="caption">Largest first. Tap a holding for its price chart and trades.</p>
    </section>
    ${accounts}`, {
    map: {
      label: 'Allocation map',
      tiles: tiles.map((t) => ({
        value: t.value_eur,
        label: t.tile,
        sub: t.cash ? '' : pct(t.upl_pct, 1),
        fill: pnlColour(t.cash ? 0 : t.upl_pct),
      })),
      rest: '<span class="plain">Tap a tile to read it.</span>',
      readout: (k) => {
        const t = tiles[k];
        return `<b>${label(t)}</b><span>${eur(t.value_eur)} · ${(t.weight_pct || 0).toFixed(1)}% of the portfolio</span>${t.cash ? ''
          : `<span>Unrealized <span ${signedClass(t.upl_eur)}>${signedEur(t.upl_eur)} (${pct(t.upl_pct, 1)})</span></span>`}`;
      },
    },
  });
}

// ---- Other assets -----------------------------------------------------------

export function otherAssets(d) {
  const o = d.screens && d.screens.other_assets;
  if (!o) return page(notYet('Other assets'));
  const cards = o.assets.map((x) => {
    const bought = [
      x.purchase_date ? `bought ${shortDate(x.purchase_date)}` : '',
      x.purchase_price_eur != null ? `for ${eur(x.purchase_price_eur)}` : '',
    ].filter(Boolean).join(' ');
    const valued = x.automatic
      ? `Priced from ${esc(x.valued_from || o.source)}${x.valued_on ? `, ${shortDate(x.valued_on)}` : ''}`
      : `Your own value${x.valued_on ? `, set ${shortDate(x.valued_on)}` : ''}`;
    return `
    <li class="asset card">
      <div class="top"><span class="n">${esc(x.name)}</span><span class="v">${eur(x.current_value_eur)}</span></div>
      <p class="caption">${[esc(x.category || ''), bought].filter(Boolean).join(' · ')}</p>
      <p class="caption">${valued}.</p>
      ${x.notes ? `<p class="caption">${esc(x.notes)}</p>` : ''}
    </li>`;
  }).join('');

  const sources = o.sources.map((s) => {
    if (!s.reached) {
      return `<p><b>${esc(s.name)}</b>: ${eur(s.value_eur)}, last priced ${s.valued_on ? shortDate(s.valued_on) : 'at an unrecorded time'}. The source didn’t answer when these figures were worked out.</p>`;
    }
    const band = s.low_eur && s.high_eur ? ` Half the listings sit between ${eur(s.low_eur)} and ${eur(s.high_eur)}.` : '';
    return `<p><b>${esc(s.name)}</b>: ${eur(s.value_eur)}, the median asking price across <b>${s.sample} ${plural(s.sample, 'listing')}</b>, as of ${shortDate(s.valued_on)}.${band}</p>${s.thin
      ? `<p class="caption">⚠ ${s.sample} listings is a thin market. This is what sellers are asking, not what anyone paid, and a single new listing can move it by hundreds of euros. Treat it as a guide rather than a valuation.</p>` : ''}`;
  }).join('');
  const noRate = o.problems.filter((p) => p.reason === 'no_fx').map((p) => `<p class="caption">${esc(p.name)} is quoted in ${esc(p.currency)} and there was no exchange rate, so its value is unchanged.</p>`).join('');

  return page(`
    <section class="block">
      <div class="tiles one">
        ${tile('Other assets', eur(o.total_eur), o.gain_eur ? `<span ${signedClass(o.gain_eur)}>${signedEur(o.gain_eur)}</span> vs the purchase price` : '')}
      </div>
      <p class="caption">Things worth real money that aren’t securities or cash: a watch, jewellery, art. <b>They are not part of the portfolio value</b> and not on the Allocation map; they count under Wealth, alongside the bank accounts.</p>
      ${o.assets.length ? `<ul class="assets">${cards}</ul>` : '<p class="empty">No other assets yet.</p>'}
    </section>
    ${sources || noRate ? `
    <section class="block">
      <h2>Where these values come from</h2>
      <div class="card prose">${sources}${noRate}</div>
      <p class="caption">Source: ${esc(o.source)}, looked up each time the figures are worked out and converted to euros at that moment’s rate.</p>
    </section>` : ''}
    <p class="caption">Adding or changing one happens in the full tracker: <a href="${TRACKER_URL}?app=portfolio&amp;section=Other%20assets" target="_blank" rel="noopener">open Other assets there</a>.</p>`);
}

// ---- Cash -------------------------------------------------------------------

// Booking types as the tracker stores them, written as words.
const typeName = (t) => (t === 'adr_fee' ? 'ADR fee' : String(t || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));

export function cash(d, ui) {
  const c = d.screens && d.screens.cash;
  if (!c) return page(notYet('Cash’s figures'));
  const days = F.dailyDays(c.history);
  const values = c.history.values;
  const asOf = `as of ${shortDate(c.as_of)}${c.provisional_eur == null ? ''
    : `, plus ${signedEur(c.provisional_eur, 2)} from ${c.provisional_trades} ${plural(c.provisional_trades, 'trade')} you logged by hand since`}`;

  const perCurrency = c.currencies.length ? table(
    ['Currency', 'Balance', 'In euros'],
    c.currencies.map((x) => [esc(x.currency), (x.balance ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), eur(x.balance_eur, 2)]),
    { cls: 'num' },
  ) : '';

  const moves = table(
    ['Type', 'Ccy', 'Net amount', 'Events'],
    c.moves.map((m) => [typeName(m.type), esc(m.currency), `<span ${signedClass(m.amount)}>${money(m.amount)}</span>`, m.events]),
    { cls: 'num first-text' },
  );
  const recent = ui.cashRecent ? table(
    ['Date', 'Description', 'Amount', 'Account', 'Type', 'Ccy', 'Balance after'],
    c.recent.map((e) => [shortDate(e.date), esc(e.description), e.amount == null ? '—' : `<span ${signedClass(e.amount)}>${money(e.amount)}</span>`,
      esc(e.broker), typeName(e.type), esc(e.currency), e.balance == null ? '—' : money(e.balance, false)]),
    { keep: 3, cls: 'events' },
  ) : '';

  return page(`
    <section class="block">
      <div class="tiles">
        ${tile('Cash balance', eur(c.cash_eur, 2), asOf)}
        ${tile('Share of the portfolio', c.share_pct == null ? '—' : `${c.share_pct.toFixed(1)}%`)}
        ${tile('Net deposits (all time)', eur(c.net_deposits_eur), 'Money transferred in minus money transferred out')}
        ${tile('Interest (all time)', signedEur(c.interest_eur, 2), '', tone(c.interest_eur))}
      </div>
      ${perCurrency}
    </section>
    <section class="card chart-card">
      <h2 class="card-title">Cash balance over time</h2>
      <div class="chart"><div class="readout" aria-live="polite"></div><div class="chart-box"></div></div>
      <p class="caption">Each account’s own reported end-of-day balance (DeGiro’s, including cash swept to the flatexDEGIRO money account, and Revolut’s), added together. Other currencies are converted at each day’s rate.</p>
    </section>
    <section class="block">
      <h2>What moved the cash</h2>
      ${moves}
      <p class="caption">Net movement per booking type, in the currency it was booked in. Internal bookings are left out: sweeps to the money account, the two legs of each currency conversion and iDEAL reservations move money around without changing what the account is worth.</p>
    </section>
    <section class="block">
      <button class="btn toggle" data-act="cash-recent" aria-expanded="${!!ui.cashRecent}">${ui.cashRecent ? 'Hide' : 'Show'} recent cash events</button>
      ${recent}
      ${ui.cashRecent ? `<p class="caption">The newest ${c.recent.length}, newest first.</p>` : ''}
    </section>`, {
    chart: {
      label: 'Cash balance over time',
      days, yLabel: axisEur, xLabel: axisDay, zero: true,
      lines: [{ values, color: PURPLE, fill: true }],
      readout: (i) => `<b>${longDay(days[i])}</b><span class="k" style="--c:${PURPLE}">Cash ${eur(values[i], 2)}</span>`,
    },
  });
}

// An amount in its own currency, cents shown, signed unless it is a balance.
function money(v, signed = true) {
  const text = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? '−' : signed && v > 0 ? '+' : ''}${text}`;
}

// ---- Dividends --------------------------------------------------------------

export function dividends(d) {
  if (!d.screens) return page(notYet('Dividends’ figures'));
  const v = d.screens.dividends;
  if (!v) return page('<p class="empty">No dividend events found in the account statement.</p>');
  const days = F.dailyDays(v.cumulative);
  const values = v.cumulative.values;
  const best = Math.max(...v.years.map((y) => Math.abs(y.net_eur || 0))) || 1;
  const years = v.years.map((y) => `
    <li><span class="y">${y.year}</span><span class="bar-track"><span class="bar" style="width:${((100 * Math.abs(y.net_eur || 0)) / best).toFixed(1)}%"></span></span><span class="v">${eur(y.net_eur, 2)}</span></li>`).join('');

  return page(`
    <section class="block">
      <div class="tiles lead">
        ${tile('Net dividends (all time)', signedEur(v.net_eur, 2), '', tone(v.net_eur))}
        ${tile('Gross dividends', eur(v.gross_eur, 2))}
        ${tile('Withholding tax', signedEur(v.tax_eur, 2), '', tone(v.tax_eur))}
      </div>
    </section>
    <section class="block">
      <h2>Net dividends per year</h2>
      <ul class="card years">${years}</ul>
    </section>
    <section class="card chart-card">
      <h2 class="card-title">Net dividends received, all time</h2>
      <div class="chart"><div class="readout" aria-live="polite"></div><div class="chart-box"></div></div>
    </section>
    <section class="block">
      <h2>Per holding</h2>
      ${table(['Holding', 'Net', 'Gross', 'Tax'], v.holdings.map((h) => [
        name(h.name), `<span ${signedClass(h.net_eur)}>${signedEur(h.net_eur, 2)}</span>`, eur(h.gross_eur, 2), signedEur(h.tax_eur, 2),
      ]), { keep: 2, cls: 'num first-text' })}
      <p class="caption">Converted to euros at the exchange rate of each payment date.</p>
    </section>`, {
    chart: {
      label: 'Net dividends received',
      days, yLabel: axisEur, xLabel: axisDay,
      lines: [{ values, color: BLUE }],
      readout: (i) => `<b>${longDay(days[i])}</b><span class="k" style="--c:${BLUE}">Received so far ${eur(values[i], 2)}</span>`,
    },
  });
}

// ---- Realized vs Unrealized ---------------------------------------------------

export function realized(d, ui) {
  const r = d.screens && d.screens.realized;
  if (!r) return page(notYet('Realized vs Unrealized’s figures'));
  const list = r.positions;
  // A bar from the zero line, which sits as far in as the largest loss.
  const gain = Math.max(0, ...list.map((p) => p.realized_eur));
  const loss = Math.max(0, ...list.map((p) => -p.realized_eur));
  const span = gain + loss || 1;
  const zero = (100 * loss) / span;
  const bar = (v) => {
    const width = (100 * Math.abs(v)) / span;
    return `left:${(v < 0 ? zero - width : zero).toFixed(2)}%;width:${width.toFixed(2)}%`;
  };

  const rows = list.map((p) => {
    const open = ui.open === p.isin;
    const status = p.still_open ? `Partly sold · ${shares(p.quantity)} still held` : 'Sold in full';
    const row = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
    return `
    <li class="holding${open ? ' open' : ''}">
      <button class="hrow booked" data-act="holding" data-v="${esc(p.isin)}" aria-expanded="${open}">
        <span class="n">${name(p.name)}</span>
        <span class="v ${tone(p.realized_eur)}">${signedEur(p.realized_eur)}</span>
        <span class="bar-track diverging"><span class="axis" style="left:${zero.toFixed(2)}%"></span><span class="bar ${p.realized_eur < 0 ? 'loss' : 'gain'}${p.still_open ? ' partly' : ''}" style="${bar(p.realized_eur)}"></span></span>
        <span class="m">${status}</span>
        ${CHEVRON}
      </button>
      ${open ? `
      <dl class="detail">
        ${row('Realized', `<span ${signedClass(p.realized_eur)}>${signedEur(p.realized_eur, 2)}</span>`)}
        ${row('Fees', signedEur(p.fees_eur, 2))}
        ${row('First trade', shortDate(p.first_trade))}
        ${row('Last trade', shortDate(p.last_trade))}
        <div class="wide-row"><a href="#/position/${esc(p.isin)}">Price chart and trades →</a></div>
      </dl>` : ''}
    </li>`;
  }).join('');

  return page(`
    <section class="block">
      <div class="tiles lead">
        ${tile('Realized P&amp;L (closed + partial sales)', signedEur(r.realized_eur, 2), '', tone(r.realized_eur))}
        ${tile('Unrealized P&amp;L (open)', signedEur(r.unrealized_eur, 2), r.unrealized_pct == null ? '' : `<span ${signedClass(r.unrealized_pct)}>${pct(r.unrealized_pct, 1)}</span> on cost`, tone(r.unrealized_eur))}
        ${tile('Fees &amp; FX costs (all time)', signedEur(r.fees_eur, 2), '', tone(r.fees_eur))}
      </div>
      <p class="caption">Realized + unrealized + ${eur(r.dividends_net_eur, 2)} of net dividends (see Dividends) = the ${signedEur(r.total_pnl_eur)} total P&amp;L at the top of the page. Fees are already deducted from both P&amp;L figures; they are shown separately here to make their size visible, not to subtract twice.</p>
    </section>
    <section class="block">
      <h2>Realized P&amp;L per position</h2>
      <ul class="holdings">${rows}</ul>
      <p class="caption">${list.length} ${plural(list.length, 'position')}, largest gain first. Green is a gain, red a loss. Striped bars are positions you only sold part of and still hold: the profit on the shares sold is booked and counts here, while the rest keeps running and shows under Unrealized.</p>
    </section>`);
}

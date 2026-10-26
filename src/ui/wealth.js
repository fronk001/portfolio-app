// The Streamlit tracker's Wealth facade — Everything you own, Savings vs
// stock gains, Runway — drawn from the engine's `wealth` document (added the
// evening of 26 Oct 2026).
//
// Nothing is worked out here either. Every window the tracker's pills offer
// (3M to All) arrives worked out, each total, average and count finished
// (the tracker's src/engine.py, held to its Streamlit facade by
// tests/test_engine.py); this file lays the figures out and words them as the
// tracker does. A window of your own (the tracker's Custom) stays in the
// tracker: there are too many to work out ahead, and the sums must not be
// written a second time here.

import * as F from '../core/figures.js';
import {
  axisDay, axisEur, axisMonth, eur, longDay, monthName, shortDate, shortMonth, signedEur, stampText, tone, workedOut,
} from '../core/format.js';
import { source } from '../data/store.js';
import { TRACKER_URL, esc, pills, plural, tile } from './html.js';
import { notYet, page, table } from './screens.js';

// The tracker's colours for this facade: blue is what you kept, orange what
// the market did, on both charts — so the bars keep them rather than going
// green and red by sign, as the tracker's do (its documented exception).
const BLUE = '#2a78d6';
const ORANGE = '#eb6834';

const tracker = (section) => `${TRACKER_URL}?app=wealth&amp;section=${encodeURIComponent(section)}`;

// The window both charts show: the one tapped, or the tracker's default.
const chosen = (w, ui) => (w.pills.includes(ui.wealthWindow) ? ui.wealthWindow : w.default);
const windowPills = (w, ui) => pills('wealth-window', w.pills, chosen(w, ui), 'Window');
const ownWindow = (section) => `
  <p class="caption">A window of your own, or one particular year: <a href="${tracker(section)}" target="_blank" rel="noopener">Custom, in the full tracker</a>.</p>`;

const note = (html) => `<section class="card note-card"><p class="empty">${html}</p></section>`;
// Coloured as written: whole euros, so −€0.28 is a plain €0, not a red one.
const toneEur = (v) => (v == null ? '' : tone(Math.round(v)));
const count = (n, one, many = `${one}s`) => `${n} ${plural(n, one, many)}`;

// Figures from an engine run before Wealth was sent, or a run that could not
// work it out: a sentence, never an error.
function unavailable(d) {
  const w = d.wealth;
  if (!w) return notYet('Wealth’s figures');
  if (w.problem) {
    return note(`Wealth’s figures could not be worked out on the cloud engine’s last run (${esc(w.problem)}). The Portfolio screens are not affected, and the <a href="${TRACKER_URL}?app=wealth" target="_blank" rel="noopener">full tracker</a> still shows Wealth.`);
  }
  return null;
}

// ---- the page around them ---------------------------------------------------

export function hero(w) {
  const e = w && !w.problem && w.everything;
  if (!e || !e.available) {
    const why = !w ? 'Wealth’s figures come with the next run of the cloud engine.'
      : w.problem ? 'Wealth’s figures could not be worked out on the cloud engine’s last run.'
        : 'Your wealth workbook hasn’t reached the cloud engine yet.';
    return `<header class="hero"><div class="eyebrow">Everything you own</div><p class="today">${why}</p></header>`;
  }
  return `
  <header class="hero">
    <div class="eyebrow">Everything you own</div>
    <h1 class="big">${eur(e.total_eur)}</h1>
    <p class="today">As at ${longDay(F.parseDay(e.as_at))}, from your wealth workbook</p>
  </header>`;
}

// What the figures are and how far they reach: stated, never warned about.
export function facts(w, main) {
  const lines = [];
  if (source === 'demo') lines.push('Made-up figures, to try the app out with.');
  else lines.push(`Worked out ${workedOut(main.generated_at)}${source === 'local' ? ' on this laptop' : ' by the cloud engine'}.`);
  const e = w && !w.problem && w.everything;
  if (e && e.available) {
    lines.push(`Your wealth workbook as your PC published it on ${stampText(e.published_at)}. The PC sends it, and your Numbers sheets, each day at 19:00.`);
  }
  lines.push(`Imports, Budget and windows of your own: <a href="${TRACKER_URL}?app=wealth" target="_blank" rel="noopener">open the full tracker</a>.`);
  return `<footer class="facts">${lines.map((l) => `<p>${l}</p>`).join('')}</footer>`;
}

// ---- Everything you own -------------------------------------------------------

export function everything(d, ui) {
  const gone = unavailable(d);
  if (gone) return page(gone);
  const w = d.wealth;
  const e = w.everything;
  if (!e.available) {
    return page(note(e.problem ? esc(e.problem)
      : 'There is no published copy of your wealth workbook for the cloud engine to read. Your PC publishes it each day at 19:00, while it is on.'));
  }

  const win = e.windows[chosen(w, ui)];
  const rows = win.rows.map((k) => e.snapshots[k]);
  let chart = null;
  let drawn = `<p class="empty">The workbook has no rows in <b>${esc(win.label)}</b>.</p>`;
  if (rows.length) {
    const days = rows.map((r) => F.parseDay(r[0]));
    const values = rows.map((r) => r[1]);
    drawn = '<div class="chart"><div class="readout" aria-live="polite"></div><div class="chart-box"></div></div>';
    chart = {
      label: 'Everything you own, over time',
      days, byTime: true, points: true, yLabel: axisEur, xLabel: axisDay,
      lines: [{ values, color: BLUE }],
      readout: (i) => `<b>${longDay(days[i])}</b><span class="k" style="--c:${BLUE}">Everything you own ${eur(values[i])}</span>`,
    };
  }
  const change = win.change_eur == null ? '' : `
    <p class="caption">From ${shortDate(rows[0][0])} to ${shortDate(rows[rows.length - 1][0])}, everything you own <span class="${toneEur(win.change_eur)}">${win.change_eur >= 0 ? 'rose' : 'fell'} by ${eur(Math.abs(win.change_eur))}</span>: savings, market and every other movement together.</p>`;

  const n = e.disagreements.length;
  const problems = n ? `
    <section class="block">
      <button class="btn toggle" data-act="wealth-rows" aria-expanded="${!!ui.wealthRows}">${count(n, 'row')} in the workbook ${n === 1 ? 'does' : 'do'} not add up</button>
      ${ui.wealthRows ? `
      <p class="caption">For each of these the recorded total disagrees with what its own account columns come to. The accounts are trusted and the recorded total is not: they are listed so the workbook can be corrected.</p>
      ${table(['Date', 'Sheet says', 'Accounts add to', 'Difference'], e.disagreements.map((r) => [
        shortDate(r.date), eur(r.recorded), eur(r.accounts_add_to), signedEur(r.difference),
      ]), { cls: 'num first-text' })}` : ''}
    </section>` : '';

  return page(`
    <section class="block">
      <div class="tiles">
        ${tile('Investments', eur(e.investment_eur))}
        ${tile('Cash', eur(e.cash_eur))}
        ${tile('Pensions', eur(e.pension_eur))}
        ${e.other_assets_eur ? tile('Other assets', eur(e.other_assets_eur)) : ''}
      </div>
      <p class="caption">Recomputed from the account columns, every account counted once: not the workbook’s own total, which no longer adds up. <b>This is not a net-worth statement</b>: it is what the workbook records, and it counts the household’s joint accounts from August 2026 onward.</p>
      ${e.other_assets_eur ? `<p class="caption"><b>Other assets</b> (${e.other_assets_names.map(esc).join(', ')}) are added on top of the workbook, which has no column for them. They are kept under Portfolio → Other assets, where the value is looked up, and counted here rather than in the portfolio value because they sit in no brokerage account. Before the first lookup each is carried at what was paid for it, so the line below steps rather than drifts.</p>` : ''}
      <p class="caption">These are the figures your PC last published, on ${shortDate(e.published_at)}. Edits made in Excel since then arrive with its next publish, at 19:00.</p>
    </section>
    <section class="card chart-card">
      <h2 class="card-title">Over time</h2>
      ${windowPills(w, ui)}
      ${drawn}
      ${change}
      ${e.stale ? `<p class="caption">The newest row in the workbook is from ${shortDate(e.as_at)}: this is where things stood then, not today.</p>` : ''}
    </section>
    ${problems}
    ${e.unknown_accounts.length ? `<p class="caption"><b>Counted, but not recognised:</b> ${e.unknown_accounts.map(esc).join(', ')}. These columns are included in the total and named here rather than dropped: a column that silently stops being counted is how a total quietly goes wrong.</p>` : ''}
    ${e.rows_without_breakdown ? `<p class="caption">${count(e.rows_without_breakdown, 'early row was', 'early rows were')} typed straight into the totals before the per-account columns existed. They keep their recorded total and have no breakdown.</p>` : ''}
    ${ownWindow('Everything you own')}`, { chart });
}

// ---- Savings vs stock gains ---------------------------------------------------

// One month in words, as the tracker's hover has it.
function savedPhrase(v) {
  if (v == null) return 'Not counted: no salary or no spending on record';
  return v < 0 ? `Spent ${eur(-v)} more than came in` : `Put away ${eur(v)}`;
}

function gainPhrase(v) {
  if (v == null) return 'Outside what the broker’s figures reach';
  return v < 0 ? `The market took back ${eur(-v)}` : `The market added ${eur(v)}`;
}

function leftOut(s) {
  const { no_salary: noSalary, no_data: noData, no_gains: noGains } = s.left_out;
  const parts = [];
  if (noSalary) parts.push(`${count(noSalary, 'month')} had spending but no salary on record`);
  if (noData) parts.push(`${count(noData, 'month')} ${noData === 1 ? 'has' : 'have'} no data at all`);
  if (noGains) parts.push(`${count(noGains, 'month')} ${noGains === 1 ? 'falls' : 'fall'} outside what the broker exports cover, so ${noGains === 1 ? 'its gain is' : 'their gains are'} not known`);
  return parts.length ? `<p class="caption">Left out: ${parts.join('; ')}.</p>` : '';
}

export function savings(d, ui) {
  const gone = unavailable(d);
  if (gone) return page(gone);
  const w = d.wealth;
  const s = w.savings[chosen(w, ui)];
  const controls = `<section class="block">${windowPills(w, ui)}</section>`;
  if (s.state === 'no_gains') {
    return page(`${controls}${note(`The portfolio has no figures inside <b>${esc(s.label)}</b>, so there are no gains to show beside the savings.`)}${ownWindow('Savings vs stock gains')}`);
  }
  if (s.state === 'no_saving') {
    return page(`${controls}${note(`No month in <b>${esc(s.label)}</b> has both a salary and a spending record, so nothing was put away that can be counted.`)}${ownWindow('Savings vs stock gains')}`);
  }

  const { months } = s;
  const days = months.map((m) => F.parseDay(`${m}-01`));
  const below = [...s.saved, ...s.gained].some((v) => v != null && v < 0);
  const chart = {
    label: 'Saved and gained over the window',
    days, yLabel: axisEur, xLabel: axisMonth, zero: below,
    lines: [{ values: s.saved, color: BLUE }, { values: s.gained, color: ORANGE }],
    readout: (i) => `<b>${shortMonth(months[i])}</b><span class="k" style="--c:${BLUE}">${s.saved[i] == null ? 'Saving not counted' : `Saved ${eur(s.saved[i])} so far`}</span><span class="k" style="--c:${ORANGE}">${s.gained[i] == null ? 'Gains not known' : `Gained ${eur(s.gained[i])} so far`}</span>`,
  };
  const bars = {
    label: 'Saved and gained, month by month',
    days, yLabel: axisEur, xLabel: axisMonth,
    series: [{ values: s.saved_monthly, color: BLUE }, { values: s.gained_monthly, color: ORANGE }],
    faded: months.map((m) => m === s.current),
    readout: (i) => `<b>${shortMonth(months[i])}${months[i] === s.current ? ', still running' : ''}</b><span class="k" style="--c:${BLUE}">${savedPhrase(s.saved_monthly[i])}</span><span class="k" style="--c:${ORANGE}">${gainPhrase(s.gained_monthly[i])}</span>`,
  };
  const label = `<b>${esc(s.label)}</b>`;

  return page(`
    ${controls}
    <section class="block">
      <div class="tiles">
        ${tile('Saved from income', signedEur(s.total_saved_eur), '', toneEur(s.total_saved_eur))}
        ${tile('Stock gains', signedEur(s.total_gained_eur), '', toneEur(s.total_gained_eur))}
        ${tile('Together', signedEur(s.together_eur), '', toneEur(s.together_eur))}
        ${tile('Months counted', String(s.months_counted))}
      </div>
      <p class="caption">Over ${label}: what you kept out of your salary, beside what the market added on top of what you already held.</p>
    </section>
    <section class="card chart-card">
      <h2 class="card-title">Cumulatively, over this window</h2>
      <div class="chart"><div class="readout" aria-live="polite"></div><div class="chart-box"></div></div>
      <p class="caption"><b>Two different ways money arrives</b>, which is why they sit side by side rather than being added into one number: the blue line is what you chose not to spend, the orange what the market did with what you already held. Moving money into the brokerage appears on neither: shifting money between your own accounts makes you no richer, so a withdrawal cannot distort this screen.</p>
      <p class="caption">Stock gains are everything the portfolio is worth beyond what was paid into it: the rise on what you still hold, the profit on what you sold, and the dividends, <b>after</b> the broker’s fees, which came out of the same pot.</p>
      ${s.from_record_start ? '<p class="caption">Gains are measured from the start of this window, which is also the start of the record: so the first month reads zero, and the chart below has no bar for it.</p>' : ''}
    </section>
    <section class="card chart-card">
      <h2 class="card-title">Month by month</h2>
      <div class="chart"><div class="readout" aria-live="polite"></div><div class="bars-box"></div></div>
      <p class="caption"><b>The same two figures, split into the months they were made in</b>: add up one colour’s bars across the window and you have where its line ends. Anything below the line is money going the other way: a month you spent more than came in, or a month the market took some of it back.</p>
      ${s.current ? `<p class="caption"><b>${monthName(s.current)} is still running</b>, so both of its bars are faded. Its saving counts only the spending entered so far and will fall as the rest of the month is recorded, and its gain is where the portfolio stands now rather than at a month end.</p>` : ''}
    </section>
    <section class="block">
      <div class="tiles">
        ${tile('Saved a month', signedEur(s.saved_average_eur), '', toneEur(s.saved_average_eur))}
        ${tile('Market a month', signedEur(s.market_average_eur), '', toneEur(s.market_average_eur))}
        ${tile('Months you overspent', `${s.overspent[0]} of ${s.overspent[1]}`)}
        ${tile('Months the market fell', s.market_fell ? `${s.market_fell[0]} of ${s.market_fell[1]}` : '—')}
      </div>
      <p class="caption">An average month over ${label}: the same totals as the top of the screen, shared out over the months each was counted in. <b>They are not the same kind of number</b>: the saving is a decision you make every month and lands within a few hundred euros of the same figure, while the market’s is an average of months that disagree wildly with one another, and there is no month in which you actually received it.</p>
      ${s.best ? `<p class="caption">Best month for the market here: <b>${monthName(s.best[0])}</b>, <span class="${toneEur(s.best[1])}">${signedEur(s.best[1])}</span>. Worst: <b>${monthName(s.worst[0])}</b>, <span class="${toneEur(s.worst[1])}">${signedEur(s.worst[1])}</span>.</p>` : ''}
      ${leftOut(s)}
    </section>
    ${ownWindow('Savings vs stock gains')}`, { chart, bars });
}

// ---- Runway -----------------------------------------------------------------

const oneDecimal = (v) => v.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function runway(d) {
  const gone = unavailable(d);
  if (gone) return page(gone);
  const r = d.wealth.runway;
  if (!r.available) {
    return page(note(`<b>The portfolio’s own figures could not be read, so there is nothing to measure the spending against.</b> ${esc(r.problem || '')}`));
  }
  if (r.months == null) return page(note('There is not enough recent spending on record to work out a runway.'));

  const months = `${oneDecimal(r.months)} months`;
  const long = r.months >= 12
    ? `That is about ${count(r.years, 'year')}${r.extra_months ? ` and ${count(r.extra_months, 'month')}` : ''}.`
    : 'That is under a year.';
  return page(`
    <section class="block runway">
      <p class="headline">${months}</p>
      <p class="lead">you could keep spending if the money stopped coming in</p>
      <p class="caption">${long}</p>
    </section>
    <section class="card prose">
      <p><b>What this is.</b> If income stopped tomorrow and you carried on spending ${eur(r.monthly_spend_eur)} a month (the average of the last ${r.based_on}), the ${eur(r.portfolio_eur)} in the portfolio would last ${months} before it ran out.</p>
      <p><b>What it is for.</b> It is the one figure here that turns a pile of money into a length of time, which is the form the question usually takes: how long could we manage between jobs, how much of a cushion is there really, is the pile growing faster than the cost of living. Watch which way it moves: a portfolio that grows while spending grows faster buys less time than it did last year, and the total on its own will not tell you that.</p>
    </section>
    <section class="block">
      <div class="tiles">
        ${tile('Spending a month', eur(r.monthly_spend_eur))}
        ${tile('The portfolio', eur(r.portfolio_eur))}
        ${tile('Measured over', count(r.based_on, 'month'))}
        ${tile('Runway', months)}
      </div>
      <p class="caption">Spending is averaged over ${count(r.based_on, 'month')}, ${shortMonth(r.from)} to ${shortMonth(r.to)}. <b>Runway has no window</b>, and has to: measured over all time it would divide today’s portfolio by an older, much larger cost of living and describe a household that no longer exists.</p>
      <p class="caption">It counts the portfolio only, not the bank accounts: <b>Everything you own</b> is the wider figure, and the runway against that would be longer. And it assumes the portfolio is spent down as cash: nothing here models a market fall while it is being spent, which is exactly when one would hurt most. Treat it as a floor, not a plan.</p>
      <p class="caption">The portfolio here is valued at the last closing prices, so it can differ a little from the live figure under Portfolio.</p>
    </section>`);
}

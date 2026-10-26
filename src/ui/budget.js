// The Streamlit tracker's Budget facade — Right now, Savings, Month, Yearly
// overview, Forecast, Pockets — drawn from the engine's `budget` and
// `budget-months` documents (added late on 26 Oct 2026).
//
// Nothing is worked out here either. Every window of the tracker's dropdown,
// every month on record, every year begun and every pocket behind it arrives
// finished (the tracker's src/engine.py, held to its Streamlit facade by
// tests/test_engine.py); this file lays the figures out, words them as the
// tracker does, and sizes the bars to them. Changing a figure (Update from
// Numbers) stays in the tracker, linked from the footer.
//
// Colours are the tracker's, screen by screen. Where a figure is spending
// against a budget, under is the good news: over is red and under green
// (Right now's headline, Month, Yearly overview, Forecast's differences).
// Money put away is green and money short red (Savings, Right now's "left").
// The bars of Month and Yearly overview arrive coloured by the engine, graded
// by how far from budget each month landed and grey while it is still
// running. Pockets keeps the tracker's blue bars, red where a month went
// over. A figure is coloured as written, so −€0.28 is a plain €0, and the
// direction is always in the words beside it as well.

import * as F from '../core/figures.js';
import {
  axisEur, axisMonth, eur, monthName, pct, shortDate, shortMonth, signedEur, tone, workedOut,
} from '../core/format.js';
import { source } from '../data/store.js';
import { TRACKER_URL, esc, pills, plural, tile } from './html.js';
import { notYet, page, table } from './screens.js';

// The tracker's colours: its chart blue and orange, and its under / over pair.
const BLUE = '#2a78d6';
const ORANGE = '#eb6834';
const UNDER = '#0ca30c';
const OVER = '#d03b3b';

const BUDGET_URL = `${TRACKER_URL}?app=budget`;
const note = (html, cls = '') => `<section class="card note-card${cls}"><p class="empty">${html}</p></section>`;
const caption = (html) => `<p class="caption">${html}</p>`;
const count = (n, one, many = `${one}s`) => `${n} ${plural(n, one, many)}`;

// A figure as it is written on screen: whole euros unless said otherwise.
const written = (v, digits = 0) => (v == null ? null : Math.round(v * 10 ** digits) / 10 ** digits);
// Money kept: green above zero, red below (the tracker's saved_colour).
const keptTone = (v, digits = 0) => tone(written(v, digits));
// Spending past a budget: red above zero, green below (its spend_colour).
const spendTone = (v, digits = 0) => {
  const r = written(v, digits);
  return r == null || r === 0 ? '' : r > 0 ? 'loss' : 'gain';
};
// The tracker's pct: one decimal, no sign of its own.
const percent = (v) => (v == null ? '—' : `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

// "17 October", from "2026-10-17".
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayName = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || '') ? `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}` : esc(iso));

// The one figure a screen exists to give, before anything else on it (the
// tracker's theme.headline), with its direction in words beneath.
const lead = (value, words, cls = '') => `
  <section class="block lead-figure">
    <p class="headline ${cls}">${value}</p>
    <p class="lead">${words}</p>
  </section>`;

const select = (act, label, options, chosen) => `
  <label class="select">${label}
    <select data-act="${act}">${options.map(([v, text]) => `
      <option value="${esc(v)}"${v === chosen ? ' selected' : ''}>${esc(text)}</option>`).join('')}
    </select>
  </label>`;

const chartBox = '<div class="chart"><div class="readout" aria-live="polite"></div><div class="bars-box"></div></div>';

// Figures from an engine run before Budget was sent, or a run that could not
// work it out: a sentence, never an error.
function unavailable(doc, what) {
  if (!doc) return notYet(what);
  if (doc.problem) {
    return note(`Budget’s figures could not be worked out on the cloud engine’s last run (${esc(doc.problem)}). The Portfolio and Wealth screens are not affected, and the <a href="${BUDGET_URL}" target="_blank" rel="noopener">full tracker</a> still shows the Budget.`);
  }
  return null;
}

// ---- the page around them ---------------------------------------------------

export function hero(b) {
  const why = !b ? 'Budget’s figures come with the next run of the cloud engine.'
    : b.problem ? 'Budget’s figures could not be worked out on the cloud engine’s last run.' : '';
  return `
  <header class="hero">
    <div class="eyebrow">Budget</div>
    <p class="today">${why || 'One salary in, everything your Numbers sheets record out.'}</p>
    ${why ? '' : caption('Your partner’s income is not counted here, so what you really put away is more than this shows.')}
  </header>`;
}

// What the figures are and how far they reach: stated, never warned about.
export function facts(b, main) {
  const lines = [];
  if (source === 'demo') lines.push('Made-up figures, to try the app out with.');
  else lines.push(`Worked out ${workedOut(main.generated_at)}${source === 'local' ? ' on this laptop' : ' by the cloud engine'}.`);
  if (b && !b.problem) {
    if (b.read_at) {
      lines.push(`From your Numbers sheets as your PC last read them, at ${workedOut(b.read_at)}. The PC publishes them each day at 19:00 while it is on; a sheet changed on the phone can be read straight away with Update from Numbers in the full tracker.`);
    }
    const n = b.placeholders.length;
    if (n) {
      const shown = b.placeholders.slice(0, 4);
      const names = shown.join(', ') + (n > shown.length ? ` and ${n - shown.length} more` : '');
      lines.push(`${count(n, 'file')} ${n === 1 ? 'is' : 'are'} still online-only in iCloud (${esc(names)}), so ${n === 1 ? 'its' : 'their'} last reading is used. Opening the iCloud folder on the PC and double-clicking a file downloads it.`);
    }
    b.unread.forEach(([file, detail]) => lines.push(`<b>${esc(file)}</b>: ${esc(detail)}`));
  }
  lines.push(`Update from Numbers and imports: <a href="${BUDGET_URL}" target="_blank" rel="noopener">open the full tracker</a>.`);
  return `<footer class="facts">${lines.map((l) => `<p>${l}</p>`).join('')}</footer>`;
}

// ---- does the month match its sheet -------------------------------------------

// The tracker's sheet_check, worded from the engine's block: agreement is
// stated rather than assumed, and a difference names the category, the cause
// and the fix to make in Numbers.
function sheetCheck(check, period, quiet) {
  if (!check) return '';
  if (check.state === 'match') {
    return quiet ? '' : caption(`✓ Matches your Numbers sheet for ${monthName(period)} to the cent: ${eur(check.app_total_eur, 2)} across ${count(check.categories_checked, 'category', 'categories')}.`);
  }
  const lines = check.rows.map(([category, cause, sheet, app, n, typed]) => {
    const what = `<b>${esc(category)}</b>`;
    if (cause === 'spelling') {
      const as = typed.map((t) => `“${esc(t.replace(/ /g, '·'))}”`).join(', ');
      return `${what}: ${count(n, 'transaction')} typed as ${as}, which the sheet’s summary does not recognise, so it shows ${eur(sheet, 2)} where the transactions add up to ${eur(app, 2)}.`;
    }
    if (cause === 'not_in_summary') {
      return `${what}: used for ${count(n, 'transaction')} (${eur(app, 2)}) but it has no row in the summary, so the sheet’s total leaves it out.`;
    }
    return `${what}: the file has ${eur(sheet, 2)} saved in its summary, but its transactions add up to ${eur(app, 2)}.`;
  });
  const advice = [];
  if (check.causes.includes('spelling')) advice.push('Retype the category on those transactions in Numbers so it matches the summary exactly: a space counts.');
  if (check.causes.includes('not_in_summary')) advice.push('Add the category to the summary in Numbers, or file those transactions under one it has.');
  if (check.causes.includes('not_recalculated')) {
    advice.push('Where nothing is misspelt, the spending is fine: the file was last saved without Numbers recalculating it. Numbers recalculates when the file is opened, so on the Mac it most likely already shows the app’s figure, and saving it once there clears this note.');
  }
  const total = check.sheet_total_eur == null ? ''
    : ` The sheet’s saved total is ${eur(check.sheet_total_eur, 2)}; its transactions add up to ${eur(check.app_total_eur, 2)}, which is what the app uses.`;
  const onlyRecalc = check.causes.length === 1 && check.causes[0] === 'not_recalculated';
  return `
    <section class="card prose${onlyRecalc ? '' : ' warn'}">
      <p><b>This month differs from what its Numbers file has saved.</b>${total}</p>
      ${lines.map((l) => `<p>${l}</p>`).join('')}
      <p>${advice.join(' ')}</p>
    </section>`;
}

const schemeNote = (s) => (s ? caption(`Shown in <b>${esc(s.title)}</b>: ${esc(s.description)} These are the categories the budget was actually written in, not today’s.`) : '');

// ---- Right now --------------------------------------------------------------

// The month in progress, read as spending money rather than as a report: the
// one Budget screen for the question asked while standing in a shop.
export function rightNow(d) {
  const gone = unavailable(d.budget, 'Budget’s figures');
  if (gone) return page(gone);
  const r = d.budget.right_now;
  const name = monthName(r.period);
  // No sheet yet is the answer, not a footnote: "€0 spent" would read as a
  // month of spending nothing.
  if (!r.has_sheet) {
    return page(note(`<b>There is no ${name} sheet in your Numbers folder yet</b>, or it has not reached the PC, so there is nothing to count down from.${r.total_budget_eur ? ` Once it is there, this screen counts down from its budget; until it sets one, last month’s ${eur(r.total_budget_eur)} is used.` : ''}`));
  }
  if (!r.rows.length) {
    return page(note(`Nothing has been recorded for ${name} yet, and no budget has been set for it either, so there is nothing to count down from.`));
  }

  // ⚠ The figure that leads is what is left in the categories money has
  // moved in, never the whole budget less spending: a bill not yet gone out
  // must not read as money to spend.
  const started = r.left_started_eur;
  const active = r.rows.filter((x) => !x[4]);
  const untouched = r.rows.filter((x) => x[4]);
  let why = '';
  if (r.untouched_count) {
    const names = untouched.slice(0, 3).map((x) => esc(x[0])).join(', ');
    const more = r.untouched_count - Math.min(3, untouched.length);
    why = caption(`<b>Why the last two differ.</b> ${count(r.untouched_count, 'category', 'categories')} ${r.untouched_count === 1 ? 'has' : 'have'} nothing recorded this month (${names}${more > 0 ? ` and ${more} more` : ''}), so ${eur(r.untouched_budget_eur)} of the budget is unspent only because those bills have not gone out or have not been entered in Numbers yet. Treat it as already spent.`);
  }

  // The pale bar is the budget and the solid one what has gone, on one scale.
  const scale = Math.max(1, ...active.map((x) => Math.max(x[1], x[2])));
  const width = (v) => `${((100 * Math.max(0, v)) / scale).toFixed(1)}%`;
  const went = active.length ? `
    <section class="block">
      <h2>Where the money went</h2>
      <ul class="ranks">${active.map(([category, budget, spent, left]) => `
        <li><div class="rank">
          <span class="n">${esc(category)}</span>
          <span class="v ${keptTone(left, 2)}">${left < 0 ? `${eur(-left, 2)} over` : `${eur(left, 2)} left`}</span>
          <span class="bar-track"><span class="bar budget" style="width:${width(budget)}"></span><span class="bar ${left < 0 ? 'loss' : 'gain'}" style="width:${width(spent)}"></span></span>
          <span class="m"><span>${eur(spent, 2)} spent of ${eur(budget, 2)}</span></span>
        </div></li>`).join('')}
      </ul>
      ${caption('The pale bar is the budget and the solid one is what has gone. Green is still within budget, red is past it.')}
    </section>` : '';
  const toCome = untouched.length ? `
    <section class="block">
      <h2>Nothing recorded yet</h2>
      ${caption('Budgeted for, but no transaction is in this month’s sheet yet. Either the bill has not gone out or it has not been entered.')}
      ${table(['Category', 'Budget'], untouched.map(([category, budget]) => [esc(category), eur(budget, 2)]), { cls: 'num first-text' })}
    </section>` : '';

  return page(`
    ${lead(eur(Math.abs(started)), started < 0
    ? 'over budget in the categories you have spent in this month'
    : 'left in the categories you have spent in this month', keptTone(started))}
    <section class="block">
      ${caption(`${name}, day ${r.day} of ${r.days_in_month}. Counting only the categories with a transaction recorded this month, so a bill that has yet to arrive cannot flatter it. This is the closest thing here to what is safe to spend.`)}
      <div class="tiles">
        ${tile('Spent so far', eur(r.total_spent_eur))}
        ${tile('This month’s budget', eur(r.total_budget_eur))}
        ${tile('Budget not yet touched', eur(r.untouched_budget_eur))}
        ${tile('Whole budget less spending', eur(r.left_eur))}
      </div>
      ${why}
    </section>
    ${went}
    ${toCome}
    <section class="block">
      ${caption(`Built from the ${count(r.transactions, 'transaction')} in your ${name} sheet${r.last_transaction ? `, the most recent dated ${dayName(r.last_transaction)}.` : '.'}`)}
      ${r.budget_is_explicit ? '' : caption('This month’s sheet sets no budget, so the figures above use the most recent earlier month’s. Set this month’s own in Numbers.')}
    </section>
    ${sheetCheck(r.check, r.period, true)}`);
}

// ---- Savings ----------------------------------------------------------------

export const LINES = ['Year by year', 'All time'];

function savedWords(w, i) {
  const saved = w.saved[i];
  if (saved == null) {
    return `<span class="plain">Not counted${w.spent[i] != null ? `: ${eur(w.spent[i], 2)} spent, no salary on record` : ': no data for this month'}</span>`;
  }
  return `<span class="k" style="--c:${saved < 0 ? OVER : UNDER}">${saved < 0 ? `${eur(-saved, 2)} more went out than came in` : `Put away ${eur(saved, 2)}`}</span><span class="plain">in ${eur(w.salary[i], 2)}, out ${eur(w.spent[i], 2)}</span>`;
}

function againstTheFile(w) {
  if (!w.compared) {
    return caption(`No month in ${esc(w.label.toLowerCase())} is in an Accumulated savings file, so there is nothing to compare with.`);
  }
  if (!w.differs.length) {
    return caption(`✓ The Saved column of your Accumulated savings files agrees with the figures above in all ${w.compared} months, give or take rounding to whole euros.`);
  }
  return `
    ${caption(`In <b>${w.differs.length} of ${w.compared} months</b> the Saved column in your Accumulated savings file is not salary minus what that month’s sheet adds up to. Almost always the expenses were typed in by hand before the month was finished or corrected. The app uses the month’s own sheet. Differences under €10 are rounding and are not listed.`)}
    ${table(['Month', 'Savings file', 'Worked out here', 'Difference', 'Expenses typed', 'Sheet adds up to'], w.differs.map(([period, file, here, diff, typed, sheet]) => [
    shortMonth(period), eur(file), eur(here, 2), `<span class="${keptTone(diff, 2)}">${signedEur(diff, 2)}</span>`, eur(typed), eur(sheet, 2),
  ]), { keep: 4, cls: 'num first-text' })}`;
}

export function savings(d, ui) {
  const gone = unavailable(d.budget, 'Budget’s figures');
  if (gone) return page(gone);
  const s = d.budget.savings;
  const spec = s.windows[ui.budgetWindow] ? ui.budgetWindow : s.default;
  const w = s.windows[spec];
  const controls = `<section class="block">${select('budget-window', 'Showing', s.choices.map(([label, v]) => [v, label]), spec)}</section>`;
  if (w.state === 'empty') {
    return page(`${controls}${note(`No month in <b>${esc(w.label)}</b> has both a salary and a spending record, so there is nothing to compare.`)}`);
  }

  const total = w.total_saved_eur;
  const over = esc(w.label.toLowerCase());
  const all = ui.budgetLine === 'All time';
  const { months } = w;
  // Year by year is one line a year, so it never falls off a cliff in a
  // January that did not happen; all time is one running total.
  const years = [...new Set(months.filter((_, i) => w.saved[i] != null).map((m) => m.slice(0, 4)))];
  const lines = all ? [{ values: w.accumulated_all, color: BLUE }]
    : years.map((y) => ({ values: w.accumulated.map((v, i) => (months[i].startsWith(y) ? v : null)), color: BLUE }));
  const running = all ? w.accumulated_all : w.accumulated;
  const bars = {
    label: 'What was put away, month by month',
    days: months.map((m) => F.parseDay(`${m}-01`)), yLabel: axisEur, xLabel: axisMonth,
    series: [{ values: w.saved, colors: w.saved.map((v) => (v != null && v < 0 ? OVER : UNDER)) }],
    lines,
    readout: (i) => `<b>${shortMonth(months[i])}</b>${savedWords(w, i)}${running[i] == null ? ''
      : `<span class="k" style="--c:${BLUE}">${eur(running[i])} ${all ? 'put away over the window so far' : `put away in ${months[i].slice(0, 4)} so far`}</span>`}`,
  };

  const left = [];
  if (w.no_salary_past) left.push(`${count(w.no_salary_past, 'month')} had spending but no salary on record (October 2020 to January 2022 predates the first savings file)`);
  if (w.missing) left.push(`${count(w.missing, 'month')} ${w.missing === 1 ? 'has' : 'have'} no data at all`);
  const trend = w.salary_trend;

  return page(`
    ${controls}
    ${lead(eur(Math.abs(total)), total >= 0 ? `put away over ${over}` : `more went out than came in over ${over}`, keptTone(total))}
    <section class="block">
      <div class="tiles three">
        ${tile('Saving rate', percent(w.rate_pct))}
        ${tile('Average month', eur(w.average_saved_eur))}
        ${tile('Months counted', String(w.months_counted))}
      </div>
      ${caption('<b>Your salary against everything your sheets record</b>, so this understates what you actually put away: your partner funds part of the joint spending and their income is not counted here.')}
    </section>
    <section class="card chart-card">
      <h2 class="card-title">What was put away, month by month</h2>
      ${pills('budget-line', LINES, all ? LINES[1] : LINES[0], 'Running total')}
      ${chartBox}
      ${caption(`Saved is the salary that month minus what the month’s transactions actually add up to: worked out from your sheets, never taken from the Saved column of the savings files, which is typed by hand (see the comparison at the bottom). ${all ? 'The blue line is the running total across every counted month in this window and never restarts.' : 'The blue line restarts every January.'}`)}
      ${left.length ? caption(`Left out of the figures above: ${left.join('; ')}. A month is only counted when both sides of it are known.`) : ''}
      ${w.negative ? caption(`${w.negative} of the counted months spent more than came in.`) : ''}
    </section>
    <section class="block">
      <h2>Year by year</h2>
      ${table(['Year', 'Came in', 'Went out', 'Put away', 'Rate'], w.years.map(([year, n, salary, spent, saved, rate, complete]) => [
    `${year}${complete ? '' : ` <span class="muted">${n} mo</span>`}`, eur(salary), eur(spent),
    `<span class="${keptTone(saved)}">${signedEur(saved)}</span>`, percent(rate),
  ]), { cls: 'num first-text' })}
      ${caption('A year with its months beside it has fewer than twelve counted, so its total is not comparable with a full one; the rate is.')}
      ${trend ? caption(`Monthly pay averaged ${eur(trend.first_average)} in ${trend.first_year} and ${eur(trend.last_average)} in ${trend.last_year}: ${eur(Math.abs(trend.change))} a month ${trend.change >= 0 ? 'more' : 'less'}${trend.change_pct != null ? ` (${pct(trend.change_pct, 1)})` : ''}. Averages rather than totals, so a part-year at either end does not read as a pay cut.`) : ''}
    </section>
    <section class="block">
      <h2>Against your savings file</h2>
      ${againstTheFile(w)}
    </section>`, { bars });
}

// ---- Month ------------------------------------------------------------------

// Each category against its budget, most spent first: the bar arrives
// coloured by the engine, and the orange tick is the budget on the same scale.
function categoryRows(x) {
  const scale = Math.max(1, ...x.rows.map((r) => Math.max(r[1], r[2])));
  const at = (v) => ((100 * Math.max(0, v)) / scale).toFixed(1);
  return `<ul class="ranks">${x.rows.map(([category, budget, spent, diff, share, today, colour]) => `
    <li><div class="rank">
      <span class="n">${esc(category)}${today ? ` <span class="muted">today ${esc(today)}</span>` : ''}</span>
      <span class="v">${eur(spent, 2)}</span>
      <span class="bar-track ticked"><span class="bar" style="width:${at(spent)}%;background:${colour}"></span>${budget ? `<span class="tick" style="left:${at(budget)}%"></span>` : ''}</span>
      <span class="m"><span>Budget ${eur(budget, 2)}</span><span class="${spendTone(diff, 2)}">${signedEur(diff, 2)}</span>${share == null ? '<span>no budget recorded</span>' : `<span>${percent(share)} of budget</span>`}</span>
    </div></li>`).join('')}
  </ul>`;
}

export function month(d, ui) {
  const gone = unavailable(d.budgetMonths, 'Month’s figures');
  if (gone) return page(gone);
  const m = d.budgetMonths;
  if (!m.months.length) return page(note('No month has been recorded yet.'));
  const period = m.by_month[ui.budgetMonth] ? ui.budgetMonth : m.default;
  const x = m.by_month[period];
  const name = monthName(period);
  const picker = `<section class="block">${select('budget-month', 'Month', m.months.map((p) => [p, monthName(p)]), period)}</section>`;
  if (x.empty) return page(`${picker}${note(`Nothing was recorded for ${name}.`)}`);

  // ⚠ Under budget is the good news, so over is red. A month still running,
  // or not begun, is never judged: two weeks in, every month is "under".
  const head = x.state === 'finished'
    ? lead(eur(Math.abs(x.diff_eur)), `${x.diff_eur > 0 ? 'over' : 'under'} budget in ${name}`, spendTone(x.diff_eur))
    : lead(eur(x.total_spent_eur), `${x.state === 'not_started' ? 'entered in advance for' : 'spent so far in'} ${name}, of ${eur(x.total_budget_eur)}`);
  const state = x.state === 'not_started'
    ? note('This month has not started yet. Its sheet was made early, so this is only what has been entered in advance: nothing else in the app counts it until the month begins. The comparison below only means something once it has finished.')
    : x.state === 'in_progress'
      ? note('This month is still running, so it is naturally under budget. The comparison below only means something once it has finished. Right now is the screen for a month still running.')
      : '';
  const n = x.transactions.length;

  return page(`
    ${picker}
    ${head}
    <section class="block">
      <div class="tiles">
        ${tile('Spent', eur(x.total_spent_eur))}
        ${tile('Budget', eur(x.total_budget_eur))}
        ${tile('Categories over', `${x.over} of ${x.rows.length}`)}
        ${tile('Transactions', String(n))}
      </div>
    </section>
    ${sheetCheck(x.check, period, false)}
    ${state}
    <section class="block">
      <h2>Every category against its budget</h2>
      ${categoryRows(x)}
      ${caption('Green came in under budget, red went over, and the stronger the colour the further from budget it landed; grey is a month still running, or a category with no budget. The orange tick is the budget.')}
      ${x.unbudgeted.length ? caption(`${count(x.unbudgeted.length, 'category', 'categories')} had spending with no budget set: ${x.unbudgeted.map(esc).join(', ')}.`) : ''}
      ${x.budget_is_explicit ? '' : caption('This month’s sheet sets no budget, so the most recent earlier month’s was carried forward, which is how a household actually behaves: last month’s plan stands until it is changed.')}
      ${schemeNote(x.scheme)}
    </section>
    <section class="block">
      <button class="btn toggle" data-act="month-transactions" aria-expanded="${!!ui.monthTransactions}">${ui.monthTransactions ? 'Hide' : 'Show'} every transaction (${n})</button>
      ${!ui.monthTransactions ? '' : n ? table(['Description', 'Category', 'Amount', 'Date'], x.transactions.map(([date, description, category, amount]) => [
    esc(description), esc(category), eur(amount, 2), date ? shortDate(date) : '—',
  ]), { keep: 3, cls: 'tx' }) : caption('No transactions are recorded for this month.')}
    </section>`);
}

// ---- Yearly overview ----------------------------------------------------------

export function yearly(d) {
  const gone = unavailable(d.budget, 'Budget’s figures');
  if (gone) return page(gone);
  const o = d.budget.overview;
  const diff = o.ytd_diff_eur;
  const bars = {
    label: 'Every month against its budget',
    days: o.months.map((m) => F.parseDay(`${m}-01`)), yLabel: axisEur, xLabel: axisMonth,
    series: [{ values: o.spent, colors: o.colours }],
    lines: [{ values: o.budget, color: ORANGE }],
    readout: (i) => `<b>${shortMonth(o.months[i])}</b>${o.spent[i] == null ? `<span class="plain">${esc(o.verdicts[i])}</span>`
      : `<span class="k" style="--c:${o.colours[i]}">Spent ${eur(o.spent[i], 2)}</span><span class="k" style="--c:${ORANGE}">Budget ${eur(o.budget[i], 2)}</span><span class="plain">${esc(o.verdicts[i])}</span>`}`,
  };
  const n = o.differing.length;
  return page(`
    ${lead(eur(Math.abs(diff)), `${diff > 0 ? 'over' : 'under'} budget so far in ${o.year}`, spendTone(diff))}
    <section class="block">
      <div class="tiles">
        ${tile('Spent this year', eur(o.ytd_eur))}
        ${tile('Budgeted this year', eur(o.ytd_budget_eur))}
        ${tile('Average month (last 12)', eur(o.avg_last_12_eur))}
        ${tile('Months on record', String(o.months_of_history))}
      </div>
    </section>
    <section class="card chart-card">
      <h2 class="card-title">Every month against its budget</h2>
      ${chartBox}
      ${caption('Green months came in under budget, red went over, and the stronger the colour the further from budget it landed. Grey means the month is still running or had no budget recorded: neither can be judged against one. The orange line is the budget. Touch a bar for the figure in words.')}
      ${o.missing ? caption(`${count(o.missing, 'month is', 'months are')} blank because no budget file was ever made for them: they are gaps in the record, not months without spending.`) : ''}
      ${o.waiting ? caption(`${monthName(o.waiting)} is blank because its Numbers sheet is not here yet.`) : ''}
      ${o.last_complete ? caption(`Last complete month: <b>${monthName(o.last_complete)}</b>.`) : ''}
      ${n ? caption(`${count(n, 'month')} ${n === 1 ? 'differs' : 'differ'} from the total saved in ${n === 1 ? 'its' : 'their'} Numbers file: ${o.differing.map(shortMonth).join(', ')}. Open one under Month to see why.`) : ''}
    </section>`, { bars });
}

// ---- Forecast ---------------------------------------------------------------

// Beyond the budget is over: red, and said.
function againstWords(v, what = 'the budget') {
  if (v == null) return '';
  const r = written(v);
  return `<span class="${spendTone(v)}">${r === 0 ? `on ${what}` : `${eur(Math.abs(v))} ${v > 0 ? 'over' : 'under'}`}</span>`;
}

export function forecast(d, ui) {
  const gone = unavailable(d.budget, 'Budget’s figures');
  if (gone) return page(gone);
  const f = d.budget.forecast;
  if (!f.years.length) return page(note('No month has been recorded yet.'));
  const year = f.by_year[ui.forecastYear] ? ui.forecastYear : f.years[0];
  const x = f.by_year[year];
  const picker = `<section class="block">${select('forecast-year', 'Year', f.years.map((y) => [y, y]), year)}</section>`;
  if (x.state === 'empty') return page(`${picker}${note(`Nothing is recorded for ${year}.`)}`);

  const against = tile('Against the budget', eur(x.total_year_budget_eur), againstWords(x.against_eur));
  const tiles = x.closed ? `
        ${tile('What the year came to', eur(x.total_ytd_eur))}
        ${against}
        ${tile('Months recorded', String(x.months_observed))}
        ${tile('Average month', eur(x.average_month_eur))}` : `
        ${tile('Spent so far', eur(x.total_ytd_eur))}
        ${tile('Projected year end', eur(x.total_projected_eur))}
        ${against}
        ${tile('Months to go', String(x.months_remaining))}`;
  const how = x.closed
    ? `${year} is finished, so this is what it came to: nothing is being projected.`
    : `The projection carries the pace of the ${count(x.months_observed, 'finished month')} in this year across the rest of it. ${x.partial_month
      ? `${monthName(x.partial_month)} is still running, so its spending counts toward the total but not toward the pace: a part-month in the average would drag every projection down.`
      : 'The month in progress is excluded from the pace.'}`;
  const shown = x.closed ? 'Came to' : 'Projected';

  return page(`
    ${picker}
    <section class="block">
      <div class="tiles">${tiles}
      </div>
      ${caption(how)}
    </section>
    ${x.months_observed < 3 && !x.closed ? note(`Only ${count(x.months_observed, 'finished month')} of ${year} ${x.months_observed === 1 ? 'is' : 'are'} on record. A projection from that little is a guess, not a forecast.`) : ''}
    <section class="block">
      <h2>Category by category</h2>
      ${table(['Category', shown, 'Year budget', 'Difference', 'Spent so far', 'Per month'], x.rows.map(([category, ytd, pace, value, budget, diff]) => [
    esc(category), eur(value), eur(budget), diff == null ? '—' : `<span class="${spendTone(diff)}">${signedEur(diff)}</span>`, eur(ytd), eur(pace),
  ]), { keep: 4, cls: 'num first-text' })}
      ${caption('Difference is against the year’s budget: above it is over, in red.')}
      ${schemeNote(x.scheme)}
    </section>`);
}

// ---- Pockets ----------------------------------------------------------------

function pocketDetail(x, ui) {
  const names = x.rows.map((r) => r[0]);
  const category = x.details[ui.pocketCategory] ? ui.pocketCategory : names[0];
  const p = x.details[category];
  const series = p.series;
  const bars = {
    label: `${category}, month by month`,
    days: series.map((s) => F.parseDay(`${s[0]}-01`)), yLabel: axisEur, xLabel: axisMonth,
    series: [{ values: series.map((s) => s[1]), colors: series.map((s) => (s[3] ? OVER : BLUE)) }],
    lines: [{ values: series.map((s) => s[2]), color: ORANGE, dash: '4 4', step: true }],
    readout: (i) => {
      const [period, spent, budget, over] = series[i];
      return `<b>${shortMonth(period)}</b>${spent == null ? '<span class="plain">Not measured</span>'
        : `<span class="k" style="--c:${over ? OVER : BLUE}">Spent ${eur(spent, 2)}</span>`}${budget == null ? '<span class="plain">No monthly budget</span>'
        : `<span class="k" style="--c:${ORANGE}">Budget ${eur(budget, 2)}</span>`}`;
    },
  };
  const html = `
    <section class="block">
      <h2>Behind one pocket</h2>
      ${select('pocket-category', 'Pocket', names.map((n) => [n, n]), category)}
      <div class="tiles">
        ${tile('Spent', eur(p.total_spent_eur))}
        ${tile('Payments', String(p.payments))}
        ${tile('Per month', eur(p.monthly_pace_eur))}
        ${tile(p.closed ? 'What the year comes to' : 'Year ends at', eur(p.year_end_eur), againstWords(p.vs_pocket_eur, 'the pocket'))}
      </div>
    </section>
    <section class="card chart-card">
      ${chartBox}
      ${caption('The bars are what was spent each month, red where it went over that month’s budget; the dotted orange line is the monthly budget in force.')}
      ${p.budget_changed ? caption('The monthly budget line steps because the budget itself changed during the year: a flat line would be a lie about what was in force each month.') : ''}
      ${p.thin && !p.closed ? caption(`Only ${count(p.months_observed, 'finished month')} ${p.months_observed === 1 ? 'is' : 'are'} on record for this category, so the year-end figure is thin.`) : ''}
    </section>
    ${p.biggest.length ? `
    <section class="block">
      <h2>The largest payments</h2>
      ${table(['Month', 'Description', 'Amount'], p.biggest.map(([period, description, amount]) => [shortMonth(period), esc(description), eur(amount, 2)]), { cls: 'tx' })}
    </section>` : ''}`;
  return { html, bars };
}

export function pockets(d, ui) {
  const gone = unavailable(d.budget, 'Budget’s figures');
  if (gone) return page(gone);
  const p = d.budget.pockets;
  if (!p.years.length) return page(note('No month has been recorded yet.'));
  const year = p.by_year[ui.pocketYear] ? ui.pocketYear : p.years[0];
  const x = p.by_year[year];
  const picker = `<section class="block">${select('pocket-year', 'Year', p.years.map((y) => [y, y]), year)}</section>`;
  const top = x.has_pocket_budget ? `
    <section class="block">
      <div class="tiles">
        ${tile('Pocket', eur(x.total_budget_eur))}
        ${tile('Spent', eur(x.total_spent_eur))}
        ${tile('Left', eur(x.total_remaining_eur))}
        ${tile('Used', percent(x.used_pct))}
      </div>
    </section>`
    : note(`<b>No annual pockets were set for ${year}.</b> ${x.first_pocket_year ? `The household started keeping them in ${x.first_pocket_year}. ` : ''}What was spent that year is below, but there is no allowance to measure it against: this is an absent budget, not a budget of nothing.`);
  if (!x.rows.length) return page(`${picker}${top}${caption(`Nothing was spent in ${year} under any pocket category.`)}`);

  const over = x.rows.filter((r) => r[5]).map((r) => r[0]);
  const bare = x.rows.filter((r) => r[6]).map((r) => r[0]);
  const rows = x.rows.map(([category, budget, spent, left, used, spentThrough, noPocket]) => `
    <li><div class="rank">
      <span class="n">${esc(category)}</span>
      <span class="v">${noPocket ? eur(spent) : `${eur(spent)} of ${eur(budget)}`}</span>
      <span class="bar-track"><span class="bar" style="width:${Math.min(100, Math.max(0, used || 0)).toFixed(1)}%"></span></span>
      <span class="m">${noPocket ? '<span>Spent with no pocket set</span>' : `<span>Left ${eur(left)}</span><span>${percent(used)} of the pocket${spentThrough ? ', spent through' : ''}</span>`}</span>
    </div></li>`).join('');
  const detail = pocketDetail(x, ui);

  return page(`
    ${picker}
    ${top}
    <section class="block">
      <h2>Each pocket</h2>
      <ul class="ranks">${rows}</ul>
      ${over.length ? caption(`${count(over.length, 'pocket is', 'pockets are')} spent through: ${over.map(esc).join(', ')}.`) : ''}
      ${bare.length ? caption(`Spent with no pocket set: ${bare.map(esc).join(', ')}.`) : ''}
      ${x.translated ? caption('The pockets for this year were written in today’s categories a year before the monthly sheets followed, so the spending is shown in today’s categories too: it is the only way it lines up with the allowance it is being measured against.') : ''}
    </section>
    ${detail.html}`, { bars: detail.bars });
}

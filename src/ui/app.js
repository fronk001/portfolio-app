// Boot: draw this device's copy of the figures straight away, then let the
// newest ones arrive in the background. Every screen has an address (#/ the
// Overview, #/holdings, #/position/<ISIN>, #/cash …; views.js's SCREENS), so
// the app comes back where it was left.

import * as F from '../core/figures.js';
import { get, load, startSync, subscribe, sync, syncStatus } from '../data/store.js';
import { closeSignIn, gate, openSignIn, signInForced, signInOpen } from './account.js';
import { drawChart, drawMap } from './chart.js';
import { SCREENS, renderPage } from './views.js';

const root = document.getElementById('app');

// The chart opens on the last week (Fred, 26 Oct 2026), on value, and with
// the time-weighted return beside the S&P 500 when switched to Return % —
// as the Streamlit app's Overview does. Position detail's price chart opens
// on three months, as the app's does: a week of one share price says little.
const ui = {
  range: '1W', metric: 'Value', method: F.TIME, bench: 'S&P 500',
  custom: null, open: null, syncOpen: false,
  posRange: '3M', posCustom: null, cashRecent: false,
};
let chart = null;
let map = null;

// The same choices from the address, for a bookmark and for the screenshot
// and smoke-test tools: ?range=1Y&metric=Return %25&method=Simple %25.
const asked = new URLSearchParams(location.search);
if (F.RANGES.includes(asked.get('range'))) ui.range = asked.get('range');
if (F.METRICS.includes(asked.get('metric'))) ui.metric = asked.get('metric');
if (F.METHODS.includes(asked.get('method'))) ui.method = asked.get('method');
if (asked.get('bench')) ui.bench = asked.get('bench');

// #/position/<ISIN> opens Position detail on that holding.
function route() {
  const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
  ui.pos = name === 'position' && arg ? decodeURIComponent(arg) : ui.pos;
  return SCREENS.some(([r]) => r === name) ? name : 'overview';
}

function render() {
  const d = get();
  const st = syncStatus();
  if (!d && st.mode === 'signed-out') openSignIn({ forced: true });
  else if (d && signInForced()) closeSignIn();
  if (!d) {
    root.innerHTML = gate(st);
    chart = null;
    map = null;
    return;
  }
  const page = renderPage(route(), d, ui, st);
  root.innerHTML = page.html;
  chart = page.chart;
  map = page.map;
  drawCharts();
}

function drawCharts() {
  const box = root.querySelector('.chart-box');
  if (box && chart) drawChart(box, chart);
  const mapBox = root.querySelector('.map-box');
  if (mapBox && map) drawMap(mapBox, map);
}

// Custom opens on the last three months, a range worth adjusting from.
function startCustom() {
  const s = get().series;
  if (!ui.custom) ui.custom = { from: F.rangeStart('3M', s.days), to: s.days[s.days.length - 1] };
}

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const v = el.dataset.v;
  switch (el.dataset.act) {
    case 'range':
      if (v === F.CUSTOM) startCustom();
      ui.range = v;
      break;
    case 'metric': ui.metric = v; break;
    case 'method': ui.method = v; break;
    case 'pos-range':
      ui.posRange = v;
      ui.posCustom = null; // Custom opens on the last three months again
      break;
    case 'holding': ui.open = ui.open === v ? null : v; break;
    case 'cash-recent': ui.cashRecent = !ui.cashRecent; break;
    case 'sync': ui.syncOpen = !ui.syncOpen; break;
    case 'sign-in': openSignIn(); return;
    case 'sign-out': sync.signOut(); return;
    default: return;
  }
  render();
});

root.addEventListener('change', (e) => {
  const act = e.target.dataset.act;
  if (act === 'bench') ui.bench = e.target.value;
  else if (act === 'custom-from' || act === 'custom-to') {
    if (!e.target.value) return; // cleared halfway through choosing
    ui.custom = { ...ui.custom, [act === 'custom-from' ? 'from' : 'to']: F.parseDay(e.target.value) };
  } else if (act === 'pos-from' || act === 'pos-to') {
    const from = root.querySelector('[data-act="pos-from"]').value;
    const to = root.querySelector('[data-act="pos-to"]').value;
    if (!from || !to) return;
    ui.posCustom = { from: F.parseDay(from), to: F.parseDay(to) };
  } else if (act === 'position') {
    ui.posCustom = null;
    location.hash = `#/position/${encodeURIComponent(e.target.value)}`;
    return; // hashchange draws it
  } else return;
  render();
});

// A tap anywhere else closes the sync card.
document.addEventListener('click', (e) => {
  if (ui.syncOpen && !e.target.closest('.sync, .sync-card')) setTimeout(() => { ui.syncOpen = false; render(); }, 0);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.syncOpen) { ui.syncOpen = false; render(); } });

addEventListener('hashchange', () => {
  ui.open = null;
  render();
  scrollTo(0, 0);
});

// The chart is sized to its box: redraw it, and only it, when the box changes.
let resizing = null;
addEventListener('resize', () => {
  clearTimeout(resizing);
  resizing = setTimeout(drawCharts, 120);
});
addEventListener('online', render);
addEventListener('offline', render);

render();
await load();
subscribe(render);
if (ui.range === F.CUSTOM && get()) startCustom();
render();
// After the first paint: the screen never waits for the Firebase SDK.
requestAnimationFrame(() => setTimeout(startSync, 0));

// The published copy keeps itself on the device (sw.js), so the installed
// phone app opens instantly and offline. In src/ the version reads "dev".
function keepOnDevice() {
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }, () => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; }
    // A new version: reload to show it, but never in the middle of signing in.
    if (document.hidden || !signInOpen()) location.reload();
    else document.addEventListener('visibilitychange', () => location.reload(), { once: true });
  });
}
if (document.querySelector('meta[name=app-version]').content !== 'dev' && 'serviceWorker' in navigator) keepOnDevice();

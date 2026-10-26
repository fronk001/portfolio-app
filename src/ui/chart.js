// Draws the charts as SVG into a box, sized to the box, and lets a finger or
// a pointer read any point off them: the readout above a line chart follows
// the touch and settles back on the last day when it lifts, and a tap on the
// Allocation map reads that tile out. No library: the app must open
// instantly and work offline, and this is a few dozen lines each.

import { areaPath, dateTicks, extent, inkOn, linePath, nearestIndex, niceTicks, squarify } from '../core/chart.js';
import { esc } from './html.js';

const PAD = { left: 6, right: 54, top: 10, bottom: 26 };

// The tracker's own buy and sell colours, as on its position chart.
const BUY = '#0ca30c';
const SELL = '#d03b3b';

// A trade's marker: a triangle pointing up for a buy, down for a sale.
const triangle = (cx, cy, up) => (up
  ? `M${cx.toFixed(1)} ${(cy - 7).toFixed(1)}L${(cx + 6.5).toFixed(1)} ${(cy + 4.5).toFixed(1)}L${(cx - 6.5).toFixed(1)} ${(cy + 4.5).toFixed(1)}Z`
  : `M${cx.toFixed(1)} ${(cy + 7).toFixed(1)}L${(cx + 6.5).toFixed(1)} ${(cy - 4.5).toFixed(1)}L${(cx - 6.5).toFixed(1)} ${(cy - 4.5).toFixed(1)}Z`);

// spec: { days: [ms], lines: [{ values, color, width, dash, fill }], yLabel(v),
//         xLabel(ms, spanDays), readout(i) -> html, zero: boolean,
//         marks: [{ i, value, up }]   trades, on Position detail's prices,
//         level: { value, label }     a dotted line across: the average cost }
export function drawChart(box, spec) {
  const w = Math.max(240, Math.round(box.clientWidth));
  const h = w < 600 ? 230 : 320;
  const n = spec.days.length;
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;
  const trades = spec.marks || [];

  // The trades count towards the scale, as plotly's autorange counts them.
  const lists = [...spec.lines.map((l) => l.values), trades.map((m) => m.value)];
  let [min, max] = extent(lists);
  if (spec.zero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  const { lo, hi, ticks, step } = niceTicks(min, max, w < 600 ? 3 : 4);
  const x = (i) => PAD.left + (n <= 1 ? plotW : (i * plotW) / (n - 1));
  const y = (v) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const span = n ? (spec.days[n - 1] - spec.days[0]) / 86400000 : 0;

  const grid = ticks.map((t) => `
    <line class="grid${t === 0 && spec.zero ? ' zero' : ''}" x1="${PAD.left}" x2="${PAD.left + plotW}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>
    <text class="ylab" x="${w - 4}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${spec.yLabel(t, step)}</text>`).join('');
  const dates = dateTicks(n, w < 600 ? 2 : 4).map((i, k, all) => {
    const anchor = k === 0 ? 'start' : k === all.length - 1 ? 'end' : 'middle';
    return `<text class="xlab" x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="${anchor}">${spec.xLabel(spec.days[i], span)}</text>`;
  }).join('');
  const base = y(Math.max(lo, Math.min(hi, 0)));
  const areas = spec.lines.filter((l) => l.fill).map((l) => `<path d="${areaPath(l.values, x, y, base)}" fill="${l.color}" fill-opacity="0.12" stroke="none"/>`).join('');
  const paths = spec.lines.map((l) => `<path d="${linePath(l.values, x, y)}" fill="none" stroke="${l.color}" stroke-width="${l.width || 2}"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  const level = spec.level ? `
    <line class="level" x1="${PAD.left}" x2="${PAD.left + plotW}" y1="${y(spec.level.value).toFixed(1)}" y2="${y(spec.level.value).toFixed(1)}"/>
    <text class="level-label" x="${PAD.left + 4}" y="${(y(spec.level.value) - 5).toFixed(1)}">${esc(spec.level.label)}</text>` : '';
  const triangles = trades.map((m) => `<path class="mark" d="${triangle(x(m.i), y(m.value), m.up)}" fill="${m.up ? BUY : SELL}"/>`).join('');
  const dots = spec.lines.map((l) => `<circle class="dot" r="4" fill="${l.color}" stroke="var(--card)" stroke-width="2"/>`).join('');

  box.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${spec.label || 'Chart'}">
    ${grid}${dates}${areas}${level}${paths}${triangles}
    <line class="cursor" y1="${PAD.top}" y2="${PAD.top + plotH}"/>
    ${dots}
  </svg>`;

  const svg = box.firstElementChild;
  const cursor = svg.querySelector('.cursor');
  const marks = [...svg.querySelectorAll('.dot')];
  const readout = box.parentElement.querySelector('.readout');

  const show = (i, touching) => {
    cursor.setAttribute('x1', x(i));
    cursor.setAttribute('x2', x(i));
    cursor.style.opacity = touching ? 1 : 0;
    spec.lines.forEach((l, k) => {
      const v = l.values[i];
      const visible = v != null && Number.isFinite(v);
      marks[k].style.opacity = visible ? 1 : 0;
      if (visible) {
        marks[k].setAttribute('cx', x(i));
        marks[k].setAttribute('cy', y(v));
      }
    });
    if (readout) readout.innerHTML = spec.readout(i);
  };
  const at = (e) => nearestIndex(e.clientX - svg.getBoundingClientRect().left, n, PAD.left, PAD.left + plotW);

  svg.addEventListener('pointerdown', (e) => show(at(e), true));
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) show(at(e), true);
  });
  const rest = () => show(n - 1, false);
  svg.addEventListener('pointerleave', rest);
  svg.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') rest(); });
  svg.addEventListener('pointercancel', rest);
  rest();
}

// The Allocation map: a tile per position, sized by its weight. Each tile
// writes its name and, when there is room, its second line; a tap reads the
// tile out above the map, where the rest of it would not fit.
//
// spec: { tiles: [{ value, label, sub, fill }], readout(k) -> html, rest: html }
export function drawMap(box, spec) {
  const w = Math.max(240, Math.round(box.clientWidth));
  const h = w < 600 ? 330 : 440;
  const rects = squarify(spec.tiles.map((t) => t.value), 0, 0, w, h);
  // Words fit when they are narrower than the tile: about 7px a letter in
  // the bold label, 6 in the line beneath.
  const fits = (text, perChar, room) => text && text.length * perChar + 8 <= room;

  const tiles = spec.tiles.map((t, k) => {
    const r = rects[k];
    if (r.w < 1 || r.h < 1) return '';
    const ink = inkOn(t.fill);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const label = r.h >= 18 && fits(t.label, 7, r.w);
    const sub = label && r.h >= 36 && fits(t.sub, 6, r.w);
    return `<g class="cell" data-k="${k}">
      <rect x="${(r.x + 1).toFixed(1)}" y="${(r.y + 1).toFixed(1)}" width="${Math.max(0, r.w - 2).toFixed(1)}" height="${Math.max(0, r.h - 2).toFixed(1)}" rx="4" fill="${t.fill}"/>
      ${label ? `<text x="${cx.toFixed(1)}" y="${(sub ? cy - 2 : cy + 4).toFixed(1)}" text-anchor="middle" fill="${ink}" class="tl">${esc(t.label)}</text>` : ''}
      ${sub ? `<text x="${cx.toFixed(1)}" y="${(cy + 13).toFixed(1)}" text-anchor="middle" fill="${ink}" class="ts">${esc(t.sub)}</text>` : ''}
    </g>`;
  }).join('');

  box.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${spec.label || 'Map'}">${tiles}</svg>`;
  const svg = box.firstElementChild;
  const readout = box.parentElement.querySelector('.readout');
  if (readout) readout.innerHTML = spec.rest;
  svg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.cell');
    if (!g) return;
    svg.querySelectorAll('.cell.on').forEach((on) => on.classList.remove('on'));
    g.classList.add('on');
    if (readout) readout.innerHTML = spec.readout(+g.dataset.k);
  });
}

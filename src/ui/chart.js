// Draws a line chart as SVG into a box, sized to the box, and lets a finger
// or a pointer read any day off it: the readout above the chart follows the
// touch and settles back on the last day when it lifts. No library: the
// app must open instantly and work offline, and this is a few dozen lines.

import { dateTicks, extent, linePath, nearestIndex, niceTicks } from '../core/chart.js';

const PAD = { left: 6, right: 54, top: 10, bottom: 26 };

// spec: { days: [ms], lines: [{ values, color, width, dash }], yLabel(v),
//         xLabel(ms, spanDays), readout(i) -> html, zero: boolean }
export function drawChart(box, spec) {
  const w = Math.max(240, Math.round(box.clientWidth));
  const h = w < 600 ? 230 : 320;
  const n = spec.days.length;
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;

  const lists = spec.lines.map((l) => l.values);
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
  const paths = spec.lines.map((l) => `<path d="${linePath(l.values, x, y)}" fill="none" stroke="${l.color}" stroke-width="${l.width || 2}"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  const dots = spec.lines.map((l) => `<circle class="dot" r="4" fill="${l.color}" stroke="var(--card)" stroke-width="2"/>`).join('');

  box.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${spec.label || 'Chart'}">
    ${grid}${dates}${paths}
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

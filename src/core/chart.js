// The arithmetic of the charts: round-number gridlines and the path a series
// draws, and the Allocation map's tiles and colours. Pure, so it can be
// tested without a screen; ui/chart.js turns it into SVG. Geometry only:
// every figure the charts show arrives finished from the engine.

// Gridlines on round numbers (1, 2, 2.5 or 5 times a power of ten) that
// cover [min, max] with about `count` steps.
export function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 1, ticks: [0, 1] };
  if (min === max) {
    const pad = Math.abs(min) * 0.01 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, ticks, step };
}

// Lowest and highest of every value in every series, ignoring gaps.
export function extent(lists) {
  let min = Infinity;
  let max = -Infinity;
  for (const list of lists) {
    for (const v of list) {
      if (v == null || !Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return min === Infinity ? [0, 1] : [min, max];
}

// An SVG path through the points, broken where a value is missing, so a
// gap reads as a gap rather than as a straight line across it.
export function linePath(values, x, y) {
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

// The area under a line, down to `base` (the zero line), as plotly's
// `fill="tozeroy"`: one closed shape per unbroken run of values.
export function areaPath(values, x, y, base) {
  let d = '';
  let run = [];
  const close = () => {
    if (run.length > 1) {
      d += `M${x(run[0]).toFixed(1)} ${base.toFixed(1)}`;
      for (const i of run) d += `L${x(i).toFixed(1)} ${y(values[i]).toFixed(1)}`;
      d += `L${x(run[run.length - 1]).toFixed(1)} ${base.toFixed(1)}Z`;
    }
    run = [];
  };
  values.forEach((v, i) => (v == null || !Number.isFinite(v) ? close() : run.push(i)));
  close();
  return d;
}

// The Allocation map's tiles: rectangles in the order given (largest
// first), each with an area in proportion to its value, kept as close to
// square as the values allow — the squarified layout (Bruls, Huizing and
// van Wijk), which plotly's treemap uses as well.
export function squarify(values, x, y, w, h) {
  const total = values.reduce((a, v) => a + Math.max(0, v), 0);
  if (!(total > 0) || w <= 0 || h <= 0) return values.map(() => ({ x, y, w: 0, h: 0 }));
  const areas = values.map((v) => (Math.max(0, v) * w * h) / total);
  const rects = [];
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(w, h);
    // Grow the row while each tile added leaves its worst tile squarer.
    let sum = areas[i];
    let worst = worstRatio(areas, i, i + 1, sum, side);
    let j = i + 1;
    while (j < areas.length) {
      const next = worstRatio(areas, i, j + 1, sum + areas[j], side);
      if (next > worst) break;
      worst = next;
      sum += areas[j];
      j++;
    }
    // The row is laid along the shorter side and takes its depth off it.
    const depth = sum / side;
    let along = 0;
    for (let k = i; k < j; k++) {
      const len = depth ? areas[k] / depth : 0;
      rects.push(w >= h ? { x, y: y + along, w: depth, h: len } : { x: x + along, y, w: len, h: depth });
      along += len;
    }
    if (w >= h) { x += depth; w -= depth; } else { y += depth; h -= depth; }
    i = j;
  }
  return rects;
}

// How far from square the least square tile in a row would be.
function worstRatio(areas, from, to, sum, side) {
  let max = 0;
  let min = Infinity;
  for (let k = from; k < to; k++) {
    max = Math.max(max, areas[k]);
    min = Math.min(min, areas[k]);
  }
  if (!(sum > 0) || !(min > 0)) return Infinity;
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

// The tracker's map colours: red at a 40% loss or worse, its off-white at
// nothing, green at a 40% gain or better, blended in between as plotly
// blends app.section_allocation's colour scale.
const LOSS_RGB = [208, 59, 59]; // #d03b3b
const NEUTRAL_RGB = [240, 239, 236]; // #f0efec
const GAIN_RGB = [12, 163, 12]; // #0ca30c

export function pnlColour(pct) {
  const t = Math.max(-40, Math.min(40, Number.isFinite(pct) ? pct : 0)) / 40;
  const to = t < 0 ? LOSS_RGB : GAIN_RGB;
  const mixed = NEUTRAL_RGB.map((c, k) => Math.round(c + (to[k] - c) * Math.abs(t)));
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// Dark text on a light tile, white on a dark one, as plotly picks.
export function inkOn(hex) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? '#1E1D1A' : '#FFFFFF';
}

// Which point a finger or pointer at `px` is nearest, of `n` spread across
// [left, right].
export function nearestIndex(px, n, left, right) {
  if (n <= 1) return 0;
  const t = (px - left) / (right - left);
  return Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))));
}

// Up to `count` dates along the bottom, evenly spaced, always including the
// first and the last.
export function dateTicks(n, count = 4) {
  if (n <= 1) return [0];
  const steps = Math.min(count, n - 1);
  return Array.from({ length: steps + 1 }, (_, k) => Math.round((k * (n - 1)) / steps));
}

// The arithmetic of a line chart: round-number gridlines, and the path a
// series draws. Pure, so it can be tested without a screen; ui/chart.js
// turns it into SVG.

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

import { test, eq, ok } from './harness.js';
import { dateTicks, extent, linePath, nearestIndex, niceTicks } from '../src/core/chart.js';

test('gridlines land on round numbers and cover the data', () => {
  const t = niceTicks(58123, 61442);
  ok(t.lo <= 58123 && t.hi >= 61442, JSON.stringify(t));
  ok(t.ticks.every((v) => v % 500 === 0), JSON.stringify(t.ticks));
  eq(niceTicks(-3.2, 7.9).ticks, [-5, 0, 5, 10]); // 11.1 / 4 = 2.8: the next round step is 5
  eq(niceTicks(0, 9.5).ticks, [0, 2.5, 5, 7.5, 10]);
});

test('a flat series still gets a scale', () => {
  const t = niceTicks(100, 100);
  ok(t.lo < 100 && t.hi > 100);
});

test('gaps break the line rather than bridging it', () => {
  const d = linePath([1, null, 3, 4], (i) => i, (v) => v);
  eq(d, 'M0.0 1.0M2.0 3.0L3.0 4.0');
});

test('extent ignores gaps', () => {
  eq(extent([[null, 2, 5], [1, null]]), [1, 5]);
  eq(extent([[null]]), [0, 1]);
});

test('the nearest point to a finger', () => {
  eq(nearestIndex(0, 5, 0, 100), 0);
  eq(nearestIndex(60, 5, 0, 100), 2);
  eq(nearestIndex(500, 5, 0, 100), 4);
});

test('date labels include both ends', () => {
  eq(dateTicks(8, 4), [0, 2, 4, 5, 7]);
  eq(dateTicks(2, 4), [0, 1]);
});

import { test, eq, ok } from './harness.js';
import {
  areaPath, dateTicks, extent, inkOn, linePath, nearestIndex, nearestOf, niceTicks, pnlColour, slotIndex, squarify,
} from '../src/core/chart.js';

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

test('the area under a line closes on the zero line, and breaks at gaps', () => {
  eq(areaPath([1, 2, null, 3], (i) => i, (v) => v, 0), 'M0.0 0.0L0.0 1.0L1.0 2.0L1.0 0.0Z');
});

test('map tiles fill the box, each sized by its share', () => {
  const values = [40, 25, 15, 10, 6, 3, 1, 0];
  const rects = squarify(values, 0, 0, 300, 200);
  eq(rects.length, values.length);
  const area = (r) => r.w * r.h;
  ok(Math.abs(rects.reduce((a, r) => a + area(r), 0) - 60000) < 1e-6, 'the whole box is used');
  rects.forEach((r, k) => {
    ok(Math.abs(area(r) - (values[k] / 100) * 60000) < 1e-6, `tile ${k} has its share`);
    ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 300 + 1e-6 && r.y + r.h <= 200 + 1e-6, `tile ${k} stays inside`);
  });
  ok(rects.slice(0, 3).every((r) => Math.max(r.w / r.h, r.h / r.w) < 3), 'the large tiles are near square');
  eq(squarify([0, 0], 0, 0, 10, 10), [{ x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 0, h: 0 }]);
});

test('map colours run red, off-white, green, and hold past ±40%', () => {
  eq([pnlColour(-40), pnlColour(-90), pnlColour(0), pnlColour(null), pnlColour(40), pnlColour(400)],
    ['#d03b3b', '#d03b3b', '#f0efec', '#f0efec', '#0ca30c', '#0ca30c']);
  eq(pnlColour(20), '#7ec97c');
  eq([inkOn('#f0efec'), inkOn('#0ca30c'), inkOn('#d03b3b')], ['#1E1D1A', '#FFFFFF', '#FFFFFF']);
});

test('a finger finds the nearest of unevenly spaced points, and the month it is over', () => {
  // the wealth workbook's rows: a month apart, then a gap of three
  const xs = [10, 40, 70, 160, 190];
  eq([0, 24, 26, 114, 116, 400].map((px) => nearestOf(px, xs)), [0, 0, 1, 2, 3, 4]);
  // twelve months' bars across 0..120: ten pixels each, clamped at both ends
  eq([-5, 0, 9.9, 10, 119, 130].map((px) => slotIndex(px, 12, 0, 120)), [0, 0, 0, 1, 11, 11]);
  eq(slotIndex(50, 1, 0, 120), 0);
});

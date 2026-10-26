// This device's copy of the figures: kept, given back, and drawn from before
// anything is fetched. (The test page has no ?demo, so the store runs as the
// real, synced app; it is never told to start syncing here.)

import { test, eq, ok } from './harness.js';
import * as cache from '../src/data/cache.js';
import { DEMO } from '../src/data/demo.js';

test('the app opens from this device’s copy, before any network', async () => {
  await cache.put('check', { owner: 'u1' });
  eq((await cache.get('check')).owner, 'u1');

  // Every document, as Firestore hands them over: one JSON string each.
  const raw = Object.fromEntries(Object.entries(DEMO).map(([name, doc]) => [name, { json: JSON.stringify(doc) }]));
  await cache.put('v1', { owner: 'u1', docs: raw, savedAt: '2026-10-23T14:20:00Z' });
  const store = await import('../src/data/store.js');
  eq(store.source, 'synced');
  await store.load();
  const d = store.get();
  ok(d && d.main.header.total_value_eur === DEMO.main.header.total_value_eur, 'the header came back');
  ok(d.series.days.length === DEMO.series.dates.length, 'the series came back, days and all');
  ok(d.screens && d.screens.positions.length === DEMO.screens.positions.length, 'the other screens came back');
  ok(d.prices && Object.keys(d.prices).length > 0, 'and the price histories, from their parts');
  ok(d.wealth && d.wealth.everything.total_eur === DEMO.wealth.everything.total_eur, 'and Wealth');

  await cache.clear();
  eq(await cache.get('v1'), undefined);
});

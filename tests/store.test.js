// This device's copy of the figures: kept, given back, and drawn from before
// anything is fetched. (The test page has no ?demo, so the store runs as the
// real, synced app; it is never told to start syncing here.)

import { test, eq, ok } from './harness.js';
import * as cache from '../src/data/cache.js';
import { DEMO } from '../src/data/demo.js';

test('the app opens from this device’s copy, before any network', async () => {
  await cache.put('check', { owner: 'u1' });
  eq((await cache.get('check')).owner, 'u1');

  const raw = { main: { json: JSON.stringify(DEMO.main) }, series: { json: JSON.stringify(DEMO.series) } };
  await cache.put('v1', { owner: 'u1', docs: raw, savedAt: '2026-10-23T14:20:00Z' });
  const store = await import('../src/data/store.js');
  eq(store.source, 'synced');
  await store.load();
  const d = store.get();
  ok(d && d.main.header.total_value_eur === DEMO.main.header.total_value_eur, 'the header came back');
  ok(d.series.days.length === DEMO.series.dates.length, 'the series came back, days and all');

  await cache.clear();
  eq(await cache.get('v1'), undefined);
});

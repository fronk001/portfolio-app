// The figures on screen, and where they come from. Read only: this app shows
// what the tracker's cloud engine worked out and changes nothing.
//
// It draws from this device's copy (cache.js) the moment it opens, then
// listens to Firebase in the background and swaps in anything newer.
//
// Dev switches in the URL. None of them touches this device's real copy:
//   ?demo     made-up figures (tools/make_demo.py)
//   ?demo=old the same, as an engine from before the other screens, Wealth,
//             Budget and the Overview's Risk sent them: main and series
//             only, the series without risk (the smoke test checks the
//             sentences)
//   ?demo=problem  the same, as a run that could not work Wealth and the
//             Budget out and sent a sentence for each
//   ?local    the tracker's own figures on this laptop, as its engine last
//             wrote them (tools/serve.py serves them; never copied here)
//   ?reset    forget this device's copy first

import { prepare, readDocuments } from '../core/figures.js';
import * as cache from './cache.js';
import { firebaseBackend } from './firebase.js';
import { firebaseConfig } from './firebase-config.js';

const params = new URLSearchParams(location.search);
export const source = params.has('demo') ? 'demo' : params.has('local') ? 'local' : 'synced';

let docs = null;
let owner = null;
let status = { mode: source === 'synced' ? 'starting' : 'off' };
let backend = null;
let unlisten = null;
const subscribers = new Set();
const emit = () => subscribers.forEach((fn) => fn());

export const get = () => docs;
export const syncStatus = () => status;
export const subscribe = (fn) => subscribers.add(fn);
const setStatus = (next) => { status = next; emit(); };

// `raw` is { main: { json }, series: { json }, screens, wealth, budget,
// budget-months, prices-1 … },
// or the documents themselves. Only main and series have to be there.
function accept(raw) {
  const read = readDocuments(raw);
  if (read.problem) return read.problem;
  docs = {
    main: read.main, series: prepare(read.series), screens: read.screens, wealth: read.wealth,
    budget: read.budget, budgetMonths: read.budgetMonths, prices: read.prices,
  };
  return null;
}

// ?demo=problem: the demo as a run that could not work Wealth or the Budget
// out, and sent each as a sentence instead (the engine's `{problem}`).
function withProblems(demo) {
  const problem = { schema_version: demo.main.schema_version, generated_at: demo.main.generated_at, problem: 'ValueError: made up for the demo' };
  return { ...demo, wealth: problem, budget: problem, 'budget-months': problem };
}

// The tracker's own engine output on this laptop (?local): main and series,
// then whatever newer documents that run wrote. An engine from before the
// other screens wrote none, and those screens say so.
async function localDocuments() {
  const fetchDoc = (name) => fetch(`/__local/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  const optional = (name) => fetchDoc(name).catch(() => null);
  const [main, series, screens, wealth, budget, months, first] = await Promise.all([
    fetchDoc('main'), fetchDoc('series'), optional('screens'), optional('wealth'),
    optional('budget'), optional('budget-months'), optional('prices-1'),
  ]);
  const raw = { main, series };
  if (screens) raw.screens = screens;
  if (wealth) raw.wealth = wealth;
  if (budget) raw.budget = budget;
  if (months) raw['budget-months'] = months;
  if (first) {
    raw['prices-1'] = first;
    const rest = await Promise.all(Array.from({ length: first.parts - 1 }, (_, k) => optional(`prices-${k + 2}`)));
    rest.forEach((p, k) => { if (p) raw[`prices-${k + 2}`] = p; });
  }
  return raw;
}

export async function load() {
  if (source === 'demo') {
    const { DEMO } = await import('./demo.js');
    const kind = params.get('demo');
    const { risk, ...olderSeries } = DEMO.series;
    accept(kind === 'old' ? { main: DEMO.main, series: olderSeries } : kind === 'problem' ? withProblems(DEMO) : DEMO);
    return emit();
  }
  if (source === 'local') {
    try {
      accept(await localDocuments());
      setStatus({ mode: 'off' });
    } catch (e) {
      setStatus({ mode: 'local-missing', error: e.message });
    }
    return;
  }
  if (params.has('reset')) await cache.clear().catch(() => {});
  const kept = await cache.get('v1').catch(() => null);
  if (kept && kept.docs && !accept(kept.docs)) {
    owner = kept.owner;
    status = { ...status, writtenAt: kept.savedAt };
  }
  emit();
}

// Started after the first paint, so the screen never waits for the SDK.
export function startSync() {
  if (source !== 'synced' || backend) return;
  backend = firebaseBackend(firebaseConfig);
  backend.start(onUser).catch((e) => {
    setStatus({ mode: navigator.onLine ? 'error' : 'offline', error: e.code || e.message });
  });
}

function onUser(user) {
  if (unlisten) unlisten();
  unlisten = null;
  if (!user) return setStatus({ mode: 'signed-out', claimed: !!docs });
  if (owner && owner !== user.uid) forget(); // another account's figures go first
  const email = user.email;
  setStatus({ mode: 'connecting', email });
  unlisten = backend.listen(user.uid, ({ docs: raw, fromCache }) => {
    if (raw.main && raw.series) {
      const problem = accept(raw);
      if (problem) return setStatus({ mode: 'error', error: problem === 'newer' ? 'newer' : 'unreadable', email });
      owner = user.uid;
      if (!fromCache) cache.put('v1', { owner, docs: raw, savedAt: new Date().toISOString() }).catch(() => {});
      return setStatus({ mode: fromCache ? 'offline' : 'live', email });
    }
    if (!fromCache) setStatus({ mode: 'empty', email });
  }, (e) => setStatus({ mode: 'error', error: e.code || e.message, email }));
}

function forget() {
  docs = null;
  owner = null;
  cache.clear().catch(() => {});
}

export const sync = {
  signIn: (email, password) => backend.signIn(email, password),
  async signOut() {
    await backend.signOut();
    forget();
    emit();
  },
  resetPassword: (email) => backend.resetPassword(email),
};

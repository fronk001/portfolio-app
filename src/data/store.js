// The figures on screen, and where they come from. Read only: this app shows
// what the tracker's cloud engine worked out and changes nothing.
//
// It draws from this device's copy (cache.js) the moment it opens, then
// listens to Firebase in the background and swaps in anything newer.
//
// Dev switches in the URL. None of them touches this device's real copy:
//   ?demo     made-up figures (tools/make_demo.py)
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

// `raw` is { main: { json }, series: { json } }, or the documents themselves.
function accept(raw) {
  const read = readDocuments(raw);
  if (read.problem) return read.problem;
  docs = { main: read.main, series: prepare(read.series) };
  return null;
}

export async function load() {
  if (source === 'demo') {
    accept((await import('./demo.js')).DEMO);
    return emit();
  }
  if (source === 'local') {
    try {
      const fetchDoc = (name) => fetch(`/__local/${name}.json`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      const [main, series] = await Promise.all([fetchDoc('main'), fetchDoc('series')]);
      accept({ main, series });
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

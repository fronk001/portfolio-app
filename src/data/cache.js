// This device's copy of the figures, so the app draws the moment it opens,
// online or not. IndexedDB rather than localStorage: the series is a quarter
// of a megabyte, and localStorage on fronk001.github.io is one 5 MB budget
// shared with Life Hub, Gym and the Mongolian app.

const DB = 'portfolio-app';
const STORE = 'docs';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export const get = (key) => run('readonly', (s) => s.get(key));
export const put = (key, value) => run('readwrite', (s) => s.put(value, key));
export const clear = () => run('readwrite', (s) => s.clear());

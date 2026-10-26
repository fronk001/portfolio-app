// The online database, read only: Firebase Auth (email + password) and
// Cloud Firestore. The only file that knows Firebase exists. Same project
// and account as Life Hub, Gym and the Mongolian app (life-hub-fred); the
// figures live in users/{uid}/portfolio/, written there by the tracker's
// cloud engine. This app never writes, and the rules refuse it if it tried.
//
// The SDK comes as ES modules straight from Google's CDN, fetched after the
// first paint: the screen never waits for it. The Firebase app is created
// under its own name ('portfolio'), so its sign-in never tangles with the
// other apps on this web address (fronk001.github.io).

const V = '12.19.0';
const sdk = (name) => import(`https://www.gstatic.com/firebasejs/${V}/firebase-${name}.js`);
const FOLDER = 'portfolio';

export function firebaseBackend(config) {
  let fb = null;
  let booting = null;
  let failed = false;

  function boot() {
    // A browser remembers a failed module download for the life of the
    // page, so once online again only a reload gets the SDK: instant, since
    // the screen draws from this device's copy.
    if (failed) {
      location.reload();
      return new Promise(() => {});
    }
    booting = booting || Promise.all([sdk('app'), sdk('auth'), sdk('firestore')]).then(([app, A, F]) => {
      const a = app.initializeApp(config, 'portfolio');
      const auth = A.initializeAuth(a, { persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence] });
      fb = { A, F, auth, db: F.getFirestore(a) };
      return fb;
    }, (e) => {
      failed = true;
      throw e;
    });
    return booting;
  }

  return {
    async start(onUser) {
      const { A, auth } = await boot();
      A.onAuthStateChanged(auth, (u) => onUser(u ? { uid: u.uid, email: u.email || '' } : null));
    },

    async signIn(email, password) {
      const { A, auth } = await boot();
      await A.signInWithEmailAndPassword(auth, email, password);
    },

    async signOut() {
      const { A, auth } = await boot();
      await A.signOut(auth);
    },

    async resetPassword(email) {
      const { A, auth } = await boot();
      await A.sendPasswordResetEmail(auth, email);
    },

    // Every document in the folder, every time one changes. Only the JSON strings travel
    // on: they are what the engine wrote and what this device keeps.
    listen(uid, onDocs, onError) {
      const { F, db } = fb;
      return F.onSnapshot(F.collection(db, 'users', uid, FOLDER), { includeMetadataChanges: true }, (snap) => {
        const docs = {};
        snap.forEach((d) => {
          const data = d.data();
          docs[d.id] = { json: data.json };
        });
        onDocs({ docs, fromCache: snap.metadata.fromCache });
      }, onError);
    },
  };
}

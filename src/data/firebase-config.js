// The Firebase web config of Life Hub's project (life-hub-fred), which this
// app shares with Life Hub, Gym and the Mongolian app: same account, same
// database, its own folder (users/{uid}/portfolio/). Gym uses the same
// registration, which is why neither appears separately in the console. It
// is not a secret: every web app ships it, and the database rules
// (life-hub/firestore.rules) are what keep the data private to Fred's account.

export const firebaseConfig = {
  apiKey: 'AIzaSyBcvMPBLxQAdOhL-8kslPenwCM_qz_TFmg',
  authDomain: 'life-hub-fred.firebaseapp.com',
  projectId: 'life-hub-fred',
  storageBucket: 'life-hub-fred.firebasestorage.app',
  messagingSenderId: '789038327074',
  appId: '1:789038327074:web:acfc21d203e9602642317b',
};

// Sign-in and where the figures stand: the sync button in the top right
// corner, the account line at the bottom, the sign-in form, and the screen a
// new device shows before it has any figures. Life Hub's and Gym's, reworded
// for an app that only reads.
//
// The form lives outside #app on purpose: the views are re-rendered whole on
// every change, which would wipe a half-typed password.

import { source, sync } from '../data/store.js';
import { esc } from './html.js';

const offline = (st) => st.mode === 'offline' || (!navigator.onLine && st.mode !== 'signed-out');

function errorNote(st) {
  if (st.error === 'newer') return 'The figures come from a newer cloud engine than this copy of the app understands. Close the app and open it again to update it.';
  if (/permission/.test(st.error)) return 'The database refused access. Check step 4 (the rules) in CLOUD-ENGINE.md, in the Portfolio tracker folder.';
  return `Couldn’t fetch the newest figures (${esc(st.error)}). The ones on screen are this device’s copy; it tries again the next time the app opens.`;
}

// Where the figures stand, in the other apps' signs: a solid dot when this
// device has the newest, a ring while it's on its way, red when it needs you.
function syncState(st) {
  if (st.mode === 'signed-out') return { tone: 'red', words: st.claimed ? 'Signed out · Sign in' : 'Sign in' };
  if (st.mode === 'error') return { tone: 'red', words: 'Not updating', name: 'Not updating', note: errorNote(st) };
  if (st.mode === 'empty') {
    return {
      tone: 'red', words: 'No figures online', name: 'No figures online yet',
      note: 'You’re signed in, but the tracker’s cloud engine hasn’t sent any figures yet. It starts once it’s set up: CLOUD-ENGINE.md, in the Portfolio tracker folder.',
    };
  }
  if (offline(st)) {
    return { tone: 'wait', words: 'Offline', name: 'Offline', note: 'Showing the figures this device already has. Newer ones arrive by themselves once you’re back online.' };
  }
  if (st.mode !== 'live') return { tone: 'wait', words: '', name: 'Connecting…', note: 'Fetching the newest figures. Meanwhile you’re seeing this device’s copy.' };
  return {
    tone: 'on', words: '', name: 'Up to date',
    note: 'These are the newest figures the cloud engine has sent. New ones arrive by themselves: after every import, and every hour on weekdays while the markets trade.',
  };
}

export function syncButton(st, open = false) {
  if (source !== 'synced') return '';
  const s = syncState(st);
  const cls = `sync ${s.tone}${s.words ? ' says' : ''}`;
  if (!s.name) return `<button class="${cls}" data-act="sign-in">${s.words}</button>`;
  const button = `<button class="${cls}" data-act="sync" aria-expanded="${open}"${s.words ? '' : ` title="${s.name}"`}>${s.words}</button>`;
  if (!open) return button;
  return `${button}
  <div class="sync-card ${s.tone}">
    <p class="t">${s.name}</p>
    <p>${s.note}</p>
    ${st.email ? `<p class="who">Signed in as ${esc(st.email)}</p>` : ''}
  </div>`;
}

const signOutLink = '<button data-act="sign-out">Sign out</button>';

export function accountLine(st) {
  return st.email ? `<p class="acct">Signed in as ${esc(st.email)} · ${signOutLink}</p>` : '';
}

// Before this device has any figures: the first visit on a new device.
export function gate(st) {
  const msg = {
    starting: 'Loading your portfolio…',
    connecting: 'Loading your portfolio…',
    offline: 'You’re offline. The first time on a new device, the app needs a connection to fetch your figures.',
    empty: 'You’re signed in, but there are no figures online yet. The tracker’s cloud engine puts them there once it’s set up: CLOUD-ENGINE.md, in the Portfolio tracker folder.',
    error: st.mode === 'error' ? errorNote(st) : '',
    'local-missing': 'No figures on this laptop yet. In the Portfolio tracker folder, run <code>.venv\\Scripts\\python.exe -m src.engine --out data\\engine</code>, then reload this page.',
  }[st.mode];
  return `
  <div class="gate">
    <div class="eyebrow">Portfolio</div>
    ${msg ? `<p>${msg}</p>` : ''}
    ${st.email && st.mode !== 'connecting' ? `<p class="acct">Signed in as ${esc(st.email)} · ${signOutLink}</p>` : ''}
  </div>`;
}

// ---- the sign-in form -----------------------------------------------------

const MESSAGES = {
  'auth/invalid-credential': 'That email and password don’t match.',
  'auth/wrong-password': 'That email and password don’t match.',
  'auth/user-not-found': 'That email and password don’t match.',
  'auth/invalid-email': 'That doesn’t look like an email address.',
  'auth/missing-password': 'Type your password too.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes, then try again.',
  'auth/network-request-failed': 'No internet connection. Try again once you’re online.',
  'auth/user-disabled': 'This account is switched off in the Firebase console.',
};
const explain = (e) => MESSAGES[e && e.code] || `Couldn’t sign in (${(e && (e.code || e.message)) || e}).`;

const FORM = `
<form class="signin-card" novalidate>
  <div class="eyebrow">Portfolio</div>
  <h1 id="signin-title">Sign in</h1>
  <p class="lead">The same account as Life Hub and Gym. Your portfolio, on every device you sign in on.</p>
  <label>Email<input name="email" type="email" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
  <label>Password<input name="password" type="password" autocomplete="current-password"></label>
  <p class="msg" role="alert" hidden></p>
  <button class="btn dark" type="submit">Sign in</button>
  <div class="links">
    <button type="button" class="btn text" data-f="forgot">Forgot password?</button>
    <button type="button" class="btn text" data-f="cancel">Not now</button>
  </div>
</form>`;

let box = null;

function say(text, tone = 'error') {
  const m = box.querySelector('.msg');
  m.textContent = text;
  m.className = `msg ${tone}`;
  m.hidden = !text;
}

function build() {
  box = document.createElement('div');
  box.className = 'signin';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'signin-title');
  box.innerHTML = FORM;
  document.body.append(box);
  const form = box.querySelector('form');
  const submit = form.querySelector('[type=submit]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return say('Type your email and your password.');
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    say('');
    try {
      await sync.signIn(email, password);
      form.password.value = '';
      closeSignIn();
    } catch (err) {
      say(explain(err));
    } finally {
      submit.disabled = false;
      submit.textContent = 'Sign in';
    }
  });

  box.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-f]');
    if (!f) return;
    if (f.dataset.f === 'cancel') return closeSignIn();
    const email = form.email.value.trim();
    if (!email) return say('Type your email above first, then tap “Forgot password?” again.');
    try {
      await sync.resetPassword(email);
      say(`If ${email} is your account, an email with a link to choose a new password is on its way.`, 'info');
    } catch (err) {
      say(explain(err));
    }
  });

  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !box.classList.contains('forced')) closeSignIn();
  });
}

// `forced`: there is nothing to show without signing in (a new phone), so
// the form fills the screen and can't be dismissed.
export function openSignIn({ forced = false } = {}) {
  if (!box) build();
  box.classList.toggle('forced', forced);
  box.querySelector('[data-f=cancel]').hidden = forced;
  if (!box.hidden) return;
  box.hidden = false;
  say('');
  if (!forced) box.querySelector('input[name=email]').focus();
}

export function closeSignIn() {
  if (box) box.hidden = true;
}

export const signInForced = () => !!box && !box.hidden && box.classList.contains('forced');
export const signInOpen = () => !!box && !box.hidden;

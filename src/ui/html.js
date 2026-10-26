// Pieces every screen uses. Every piece of text that reaches the page goes
// through esc().

import { tone } from '../core/format.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);

export const CHEVRON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

// The Streamlit tracker: where imports, edits, Budget and Wealth still are.
export const TRACKER_URL = 'https://portfolio-tracker-fronk.streamlit.app/';

// A row of choices, one of them on.
export const pills = (act, options, current, label) => `
  <div class="pills" role="group" aria-label="${label}">${options.map((o) => `
    <button class="pill${o === current ? ' on' : ''}" data-act="${act}" data-v="${esc(o)}" aria-pressed="${o === current}">${esc(o)}</button>`).join('')}
  </div>`;

// Green for a gain, red for a loss: the sign is written as well.
export const signedClass = (v) => `class="${tone(v)}"`;

// A figure in a tile: its label, the figure, and a line beneath if any.
export const tile = (label, value, sub = '', cls = '') => `
  <div class="tile"><span class="l">${label}</span><span class="v ${cls}">${value}</span>${sub ? `<span class="s">${sub}</span>` : ''}</div>`;

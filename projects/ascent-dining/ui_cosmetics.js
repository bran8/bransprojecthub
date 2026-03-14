// ══════════════════════════════════════════════════════
// ui_cosmetics.js
// Toast notifications, section collapse/expand, smooth scroll
// No external imports — pure DOM utilities
// ══════════════════════════════════════════════════════

let _tt = null;

export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => t.classList.remove('show'), 2600);
}

export function toggleSec(id, forceOpen) {
  const body = document.getElementById('body-' + id);
  const tog  = document.getElementById('tog-' + id);
  const hdr  = document.querySelector(`#sec-${id} .ps-hdr`);
  if (!body) return;
  const shouldShow = forceOpen !== undefined ? forceOpen : (body.style.display === 'none');
  body.style.display = shouldShow ? '' : 'none';
  tog?.classList.toggle('open', shouldShow);
  hdr?.classList.toggle('collapsed', !shouldShow);
}

export function scrollToSec(secId) {
  document.getElementById('sec-' + secId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toggleSec(secId, true);
}

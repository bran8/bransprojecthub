// ══════════════════════════════════════════════════════
// app.js
// State management, core helpers, item getters,
// row/section builders + their add/delete/badge helpers.
//
// Pure library module — no top-level side-effects.
// Imported by: meal_plan.js, interaction.js
// ══════════════════════════════════════════════════════

import {
  SK, DINERS, MDR, BUFFET, SPECIALTY, ALL_V,
  BASE_EXCL, BASE_CLS, DEFAULT_SIG, CAT_LBL, CAT_ICO
} from './data.js';

// ── Venue look-ups (also used by meal_plan.js) ────────
export function vById(id) {
  return ALL_V.find(v => v.id === id) || { id, short: id.toUpperCase().slice(0, 6), c: '#7a8fa8' };
}
export function vType(id) {
  return MDR.find(v => v.id === id)      ? 'mdr'
       : BUFFET.find(v => v.id === id)   ? 'buf'
       : SPECIALTY.find(v => v.id === id)? 'spc' : '?';
}

// ══════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════
export function freshState() {
  return {
    currentNight: 0,
    nights: Array.from({ length: 10 }, () => ({
      dining: null, tags: {}, sigCustom: { s: [], e: [], d: [] },
    })),
    exclCustom: {},
    clsCustom: { s: [], e: [], d: [] },
  };
}

const S = (() => {
  try {
    const raw = localStorage.getItem(SK);
    if (raw) {
      const p = JSON.parse(raw);
      p.nights.forEach(n => {
        if (!n.sigCustom) n.sigCustom = { s: [], e: [], d: [] };
        if (!n.tags)      n.tags = {};
        delete n.sigDeleted;
      });
      if (!p.exclCustom) p.exclCustom = {};
      if (!p.clsCustom)  p.clsCustom  = { s: [], e: [], d: [] };
      delete p.exclDeleted;
      delete p.clsDeleted;
      return p;
    }
  } catch (e) {}
  return freshState();
})();

export { S };

export function save() {
  try { localStorage.setItem(SK, JSON.stringify(S)); } catch (e) {}
}

/**
 * Mutate S in-place from a parsed import.
 * (S is a const export — we can't reassign it from outside, so we update
 * its properties here to keep all live bindings valid.)
 */
export function applyState(p) {
  S.currentNight = p.currentNight ?? 0;
  S.nights       = p.nights;
  S.exclCustom   = p.exclCustom ?? {};
  S.clsCustom    = p.clsCustom  ?? { s: [], e: [], d: [] };
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════
export function sortAlpha(arr) {
  return [...arr].sort((a, b) => {
    const na = typeof a === 'string' ? a : a.n;
    const nb = typeof b === 'string' ? b : b.n;
    return na.localeCompare(nb, 'en', { sensitivity: 'base' });
  });
}

export function tagKey(ns, item) { return ns + '||' + item; }

export function getTag(n, ns, item) {
  const k = tagKey(ns, item);
  if (!S.nights[n].tags[k]) S.nights[n].tags[k] = { diners: [], feat: false };
  return S.nights[n].tags[k];
}

export function rId(n, ns, item) {
  return 'r' + n + ns.replace(/[^a-zA-Z0-9]/g, '') + '_'
    + btoa(unescape(encodeURIComponent(item))).replace(/[^a-zA-Z0-9]/g, '');
}

export function refreshRow(n, ns, item) {
  const el = document.getElementById(rId(n, ns, item));
  if (!el) return;
  const t  = getTag(n, ns, item);
  const fb = el.querySelector('.fb');
  if (fb) { fb.classList.toggle('on', t.feat); fb.textContent = t.feat ? '⭐' : '☆'; }
  DINERS.forEach(d => {
    const dt = el.querySelector('[data-d="' + d.id + '"]');
    if (dt) {
      const on = t.diners.includes(d.id);
      dt.classList.toggle('on', on);
      dt.style.borderColor = on ? d.c : 'transparent';
      dt.style.background  = on ? d.c + '33' : 'transparent';
    }
  });
}

export function countTagged(n, ns) {
  return Object.entries(S.nights[n].tags)
    .filter(([k, t]) => k.startsWith(ns + '||') && (t.diners.length > 0 || t.feat)).length;
}

// ══════════════════════════════════════════════════════
// ITEM GETTERS
// ══════════════════════════════════════════════════════
export function sigItems(n) {
  const base = DEFAULT_SIG[n] || { s: [], e: [], d: [] };
  const cust = S.nights[n].sigCustom || { s: [], e: [], d: [] };
  return {
    s: [...base.s, ...cust.s],
    e: [...base.e, ...cust.e],
    d: [...base.d, ...cust.d],
  };
}

export function exclItems(restId) {
  const base = BASE_EXCL[restId];
  const cust = S.exclCustom || {};
  return {
    s: [...base.s, ...(cust[restId + '||s'] || [])],
    e: [...base.e, ...(cust[restId + '||e'] || [])],
    d: [...base.d, ...(cust[restId + '||d'] || [])],
  };
}

export function clsItems() {
  const cust = S.clsCustom || { s: [], e: [], d: [] };
  return {
    s: [...BASE_CLS.s, ...(cust.s || [])],
    e: [...BASE_CLS.e, ...(cust.e || [])],
    d: [...BASE_CLS.d, ...(cust.d || [])],
  };
}

export function getAllSigItems(n) {
  return [...sigItems(n).s, ...sigItems(n).e, ...sigItems(n).d].map(i => i.n);
}
export function getAllSigItemsFor(n) { return getAllSigItems(n); }

// ══════════════════════════════════════════════════════
// ROW BUILDERS
// ══════════════════════════════════════════════════════
export function buildRow(n, ns, item, unverified, source, cat) {
  const t    = getTag(n, ns, item);
  const id   = rId(n, ns, item);
  const esc  = item.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const catJ = cat ? `'${cat}'` : 'null';
  const nsJ  = `'${ns}'`;

  const dtags = DINERS.map(d => {
    const on = t.diners.includes(d.id);
    return `<div class="dt ${on ? 'on' : ''}" data-d="${d.id}"
      style="border-color:${on ? d.c : 'transparent'};background:${on ? d.c + '33' : 'transparent'};color:${d.c}"
      onclick="toggleDiner(${n},${nsJ},'${esc}','${d.id}',${catJ})"
      title="${d.label}">${d.s}</div>`;
  }).join('');

  let acts = '';
  if (source === 'sig') {
    acts = `<span class="ir-actions">
      <button class="ia cpa" onclick="copySigToAll(${n},'${esc}',${catJ})" title="Copy to all nights">⊕All</button>
      <button class="ia del" onclick="delSig(${n},'${esc}')" title="Remove">✕</button>
    </span>`;
  } else if (source === 'excl') {
    const isCustom = cat && S.exclCustom[ns + '||' + cat]?.some(x => x.n === item);
    acts = isCustom
      ? `<span class="ir-actions"><button class="ia del" onclick="delExcl(${nsJ},'${esc}',${catJ})" title="Remove">✕</button></span>`
      : '';
  } else if (source === 'cls') {
    const isCustom = cat && S.clsCustom[cat]?.includes(item);
    acts = isCustom
      ? `<span class="ir-actions"><button class="ia del" onclick="delCls('${esc}',${catJ})" title="Remove">✕</button></span>`
      : '';
  }

  return `<div class="ir" id="${id}">
    <span class="in${unverified ? ' uv' : ''}">${item}</span>
    <button class="fb ${t.feat ? 'on' : ''}" onclick="toggleFeat(${n},${nsJ},'${esc}',${catJ})" title="Star as featured">${t.feat ? '⭐' : '☆'}</button>
    <div class="dtags">${dtags}</div>
    ${acts}
  </div>`;
}

export function buildAddRow(inpId, keyHandler, addHandler) {
  return `<div class="arow">
    <input class="ainp" id="${inpId}" placeholder="New item…" list="sug" onkeydown="${keyHandler}">
    <button class="abtn" onclick="${addHandler}">+ Add</button>
  </div>`;
}

// ══════════════════════════════════════════════════════
// SIGNATURES SECTION
// ══════════════════════════════════════════════════════
export function updateSigBadges(n) {
  const total = countTagged(n, 'SIG');
  const feats = Object.entries(S.nights[n].tags)
    .filter(([k, t]) => k.startsWith('SIG||') && t.feat).length;
  document.getElementById('sig-badges').innerHTML =
    (total > 0 ? `<span class="ps-badge" style="background:var(--gold3);color:var(--gold2)">${total} tagged</span>` : '')
    + (feats > 0 ? `<span class="ps-badge" style="background:var(--gold3);color:var(--gold2)">⭐${feats}</span>` : '');
}

export function renderSig(n) {
  const items = sigItems(n);
  let html = '';
  ['s', 'e', 'd'].forEach(cat => {
    const list  = sortAlpha(items[cat]);
    const cnt   = list.filter(i => {
      const t = getTag(n, 'SIG', i.n);
      return t.diners.length > 0 || t.feat;
    }).length;
    const addId = `sig-add-${n}-${cat}`;
    html += `<div class="sig-col">
      <div class="sig-col-hdr">
        <span class="sig-col-title">${CAT_ICO[cat]} ${CAT_LBL[cat]}</span>
        <span class="sig-col-count">${cnt}</span>
      </div>
      ${list.map(i => buildRow(n, 'SIG', i.n, !i.v, 'sig', cat)).join('')}
      ${buildAddRow(addId, `handleSigKey(event,${n},'${cat}')`, `addSigItem(${n},'${cat}')`)}
    </div>`;
  });
  document.getElementById('sig-grid').innerHTML = html;
  updateSigBadges(n);
}

// ══════════════════════════════════════════════════════
// MDR EXCLUSIVES SECTION
// ══════════════════════════════════════════════════════
export function updateExclBadges(n) {
  let total = 0, feats = 0;
  MDR.forEach(r => {
    Object.entries(S.nights[n].tags).forEach(([k, t]) => {
      if (k.startsWith(r.id + '||')) {
        if (t.diners.length > 0 || t.feat) total++;
        if (t.feat) feats++;
      }
    });
  });
  document.getElementById('excl-badges').innerHTML =
    (total > 0 ? `<span class="ps-badge" style="background:rgba(122,159,201,0.15);color:var(--excl)">${total} tagged</span>` : '')
    + (feats > 0 ? `<span class="ps-badge" style="background:rgba(122,159,201,0.15);color:var(--excl)">⭐${feats}</span>` : '');
}

export function renderExcl(n) {
  const nd = S.nights[n];
  let html = '';
  MDR.forEach(r => {
    const isTonight = nd.dining === r.id;
    const items     = exclItems(r.id);
    const allItems  = [...items.s, ...items.e, ...items.d];
    const tagged    = allItems.filter(i => {
      const t = getTag(n, r.id, i.n);
      return t.diners.length > 0 || t.feat;
    }).length;

    let colHtml = `<div class="excl-col-hdr" style="border-left:3px solid ${r.c}22">
      <span class="excl-col-name" style="color:${r.c}">${r.id}</span>
      ${isTonight ? `<span style="font-size:8px;font-weight:600;background:${r.c};color:#07101c;padding:2px 6px;border-radius:2px;letter-spacing:.5px">TONIGHT</span>` : ''}
      ${tagged > 0 ? `<span style="font-size:8px;background:${r.c}22;color:${r.c};padding:1px 5px;border-radius:8px;font-weight:600;margin-left:auto">${tagged}</span>` : ''}
    </div>`;

    ['s', 'e', 'd'].forEach(cat => {
      const list  = items[cat]; if (!list.length) return;
      const addId = `excl-add-${r.id}-${cat}`;
      colHtml += `<div class="excl-subsec">${CAT_ICO[cat]} ${CAT_LBL[cat]}</div>`;
      colHtml += sortAlpha(list).map(i => buildRow(n, r.id, i.n, !i.v, 'excl', cat)).join('');
      colHtml += buildAddRow(addId,
        `handleExclKey(event,'${r.id}','${cat}')`,
        `addExclItem('${r.id}','${cat}')`);
    });

    html += `<div class="excl-col${isTonight ? ' is-tonight' : ''}" style="--tc:${r.c}">${colHtml}</div>`;
  });
  document.getElementById('excl-grid').innerHTML = html;
  updateExclBadges(n);
}

// ══════════════════════════════════════════════════════
// CLASSICS SECTION
// ══════════════════════════════════════════════════════
export function updateClsBadges(n) {
  const total = countTagged(n, 'CLS');
  const feats = Object.entries(S.nights[n].tags)
    .filter(([k, t]) => k.startsWith('CLS||') && t.feat).length;
  document.getElementById('cls-badges').innerHTML =
    (total > 0 ? `<span class="ps-badge" style="background:rgba(106,158,122,0.15);color:var(--cls)">${total} tagged</span>` : '')
    + (feats > 0 ? `<span class="ps-badge" style="background:rgba(106,158,122,0.15);color:var(--cls)">⭐${feats}</span>` : '');
}

export function renderCls(n) {
  const items = clsItems();
  let html = '';
  ['s', 'e', 'd'].forEach(cat => {
    const list  = sortAlpha(items[cat]);
    const cnt   = list.filter(i => {
      const nm = typeof i === 'string' ? i : i.n;
      const t  = getTag(n, 'CLS', nm);
      return t.diners.length > 0 || t.feat;
    }).length;
    const addId = `cls-add-${cat}`;
    html += `<div class="cls-col">
      <div class="cls-col-hdr">${CAT_ICO[cat]} ${CAT_LBL[cat]}${cnt > 0
        ? ` <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(106,158,122,0.15);color:var(--cls);font-weight:600">${cnt}</span>`
        : ''}
      </div>
      ${list.map(i => {
        const nm = typeof i === 'string' ? i : i.n;
        return buildRow(n, 'CLS', nm, false, 'cls', cat);
      }).join('')}
      ${buildAddRow(addId, `handleClsKey(event,'${cat}')`, `addClsItem('${cat}')`)}
    </div>`;
  });
  document.getElementById('cls-grid').innerHTML = html;
  updateClsBadges(n);
}

// ══════════════════════════════════════════════════════
// AUTOCOMPLETE
// ══════════════════════════════════════════════════════
export function buildAC() {
  const set = new Set();
  DEFAULT_SIG.forEach(night => {
    [...night.s, ...night.e, ...night.d].forEach(i => set.add(i.n));
  });
  S.nights.forEach(nd => {
    ['s', 'e', 'd'].forEach(cat => {
      (nd.sigCustom[cat] || []).forEach(i => set.add(i.n));
    });
  });
  MDR.forEach(r => {
    const items = exclItems(r.id);
    [...items.s, ...items.e, ...items.d].forEach(i => set.add(i.n));
  });
  const cls = clsItems();
  [...cls.s, ...cls.e, ...cls.d].forEach(i => set.add(typeof i === 'string' ? i : i.n));
  document.getElementById('sug').innerHTML =
    [...set].sort().map(i => `<option value="${i}">`).join('');
}

window.S = S

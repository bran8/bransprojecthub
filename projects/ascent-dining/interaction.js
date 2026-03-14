// ══════════════════════════════════════════════════════
// interaction.js  ← ENTRY POINT (index.html loads this)
//
// User interactions: diner/feat toggles, add/delete items,
// venue/night selection, view switching, import/export.
// Also owns: render orchestration, rail, legend, decision flow.
//
// Imports: data.js, app.js, ui_cosmetics.js, meal_plan.js
// ══════════════════════════════════════════════════════

import { DINERS, MDR, BUFFET, SPECIALTY, DATES } from './data.js';

import {
  S, save, applyState,
  sigItems, exclItems, clsItems,
  getAllSigItems, getAllSigItemsFor,
  getTag, refreshRow, countTagged,
  renderSig, renderExcl, renderCls, buildAC,
  vById, vType
} from './app.js';

import { toast, toggleSec, scrollToSec } from './ui_cosmetics.js';
import { renderSummary, getItemCat } from './meal_plan.js';


// ══════════════════════════════════════════════════════
// TAG INTERACTIONS
// ══════════════════════════════════════════════════════
export function toggleDiner(n, ns, item, did, cat) {
  const t = getTag(n, ns, item);
  if (cat && !t.cat) t.cat = cat;
  const i = t.diners.indexOf(did);
  i > -1 ? t.diners.splice(i, 1) : t.diners.push(did);
  const isOn = t.diners.includes(did);  // capture result

  // MDR Exclusives and Classics are identical every night — sync across all nights
  if (ns !== 'SIG') {
    S.nights.forEach((_, ni) => {
      if (ni === n) return;
      const tn = getTag(ni, ns, item);
      if (cat && !tn.cat) tn.cat = cat;
      const ii = tn.diners.indexOf(did);
      isOn ? (ii === -1 && tn.diners.push(did)) : (ii > -1 && tn.diners.splice(ii, 1));
    });
  }

  save();
  refreshRow(n, ns, item);
  refreshDecisionFlow();
  updateRailPill(n);
}


export function toggleFeat(n, ns, item, cat) {
  const t = getTag(n, ns, item);
  if (cat && !t.cat) t.cat = cat;
  t.feat = !t.feat;

  // MDR Exclusives and Classics are identical every night — sync feat across all nights
  if (ns !== 'SIG') {
    S.nights.forEach((_, i) => {
      if (i === n) return;                        // already set above
      const tn = getTag(i, ns, item);
      if (cat && !tn.cat) tn.cat = cat;
      tn.feat = t.feat;                           // match, don't toggle
    });
  }

  save();
  refreshRow(n, ns, item);
  refreshDecisionFlow();
  updateRailPill(n);
}


// ══════════════════════════════════════════════════════
// ADD / DELETE — SIGNATURES
// ══════════════════════════════════════════════════════
export function handleSigKey(e, n, cat) {
  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); addSigItem(n, cat); }
}
export function addSigItem(n, cat) {
  const inp = document.getElementById(`sig-add-${n}-${cat}`); if (!inp) return;
  const val = inp.value.trim(); if (!val) return;
  if (getAllSigItems(n).map(x => x.toLowerCase()).includes(val.toLowerCase())) {
    toast('Already exists!'); inp.value = ''; inp.focus(); return;
  }
  S.nights[n].sigCustom[cat].push({ n: val, v: 1 });
  save(); inp.value = ''; renderSig(n); refreshDecisionFlow(); toast('Added: ' + val);
  document.getElementById(`sig-add-${n}-${cat}`)?.focus();
}
export function delSig(n, item) {
  if (!confirm(`Remove "${item}" from Night ${n + 1} Signatures?`)) return;
  let removed = false;
  ['s', 'e', 'd'].forEach(cat => {
    const idx = (S.nights[n].sigCustom[cat] || []).findIndex(i => i.n === item);
    if (idx > -1) { S.nights[n].sigCustom[cat].splice(idx, 1); removed = true; }
  });
  if (!removed) { toast('Cannot remove base menu items'); return; }
  delete S.nights[n].tags['SIG||' + item];
  save(); renderSig(n); refreshDecisionFlow(); toast('Removed');
}
export function copySigToAll(srcNight, item, cat) {
  let count = 0;
  S.nights.forEach((nd, i) => {
    if (i === srcNight) return;
    if (!nd.sigCustom[cat]) nd.sigCustom[cat] = [];
    if (!getAllSigItemsFor(i).map(x => x.toLowerCase()).includes(item.toLowerCase())) {
      nd.sigCustom[cat].push({ n: item, v: 1 }); count++;
    }
  });
  save(); renderSig(S.currentNight); toast(`Copied to ${count} night${count !== 1 ? 's' : ''}`);
}

// ══════════════════════════════════════════════════════
// ADD / DELETE — MDR EXCLUSIVES
// ══════════════════════════════════════════════════════
export function handleExclKey(e, r, cat) {
  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); addExclItem(r, cat); }
}
export function addExclItem(restId, cat) {
  const inp = document.getElementById(`excl-add-${restId}-${cat}`); if (!inp) return;
  const val = inp.value.trim(); if (!val) return;
  const k = restId + '||' + cat;
  if (!S.exclCustom) S.exclCustom = {};
  if (!S.exclCustom[k]) S.exclCustom[k] = [];
  const exist = [...exclItems(restId).s, ...exclItems(restId).e, ...exclItems(restId).d]
    .map(i => i.n.toLowerCase());
  if (exist.includes(val.toLowerCase())) { toast('Already exists!'); inp.value = ''; return; }
  S.exclCustom[k].push({ n: val, v: 1 });
  save(); inp.value = ''; renderExcl(S.currentNight); toast('Added to ' + restId + ' (all nights)');
}
export function delExcl(restId, item, cat) {
  const k = restId + '||' + cat;
  if (!S.exclCustom[k]?.some(x => x.n === item)) { toast('Base menu items cannot be removed'); return; }
  if (!confirm(`Remove "${item}" from ${restId} Exclusives?\nThis affects ALL nights.`)) return;
  S.exclCustom[k] = S.exclCustom[k].filter(x => x.n !== item);
  S.nights.forEach(nd => { delete nd.tags[restId + '||' + item]; });
  save(); renderExcl(S.currentNight); toast('Removed from all nights');
}

// ══════════════════════════════════════════════════════
// ADD / DELETE — CLASSICS
// ══════════════════════════════════════════════════════
export function handleClsKey(e, cat) {
  if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); addClsItem(cat); }
}
export function addClsItem(cat) {
  const inp = document.getElementById(`cls-add-${cat}`); if (!inp) return;
  const val = inp.value.trim(); if (!val) return;
  if (!S.clsCustom) S.clsCustom = { s: [], e: [], d: [] };
  const items = clsItems();
  const exist = [...items.s, ...items.e, ...items.d]
    .map(i => (typeof i === 'string' ? i : i.n).toLowerCase());
  if (exist.includes(val.toLowerCase())) { toast('Already exists!'); inp.value = ''; inp.focus(); return; }
  S.clsCustom[cat].push(val);
  save(); inp.value = ''; renderCls(S.currentNight); toast('Added to Classics (all nights)');
  document.getElementById(`cls-add-${cat}`)?.focus();
}
export function delCls(item, cat) {
  if (!S.clsCustom?.[cat]?.includes(item)) { toast('Base menu items cannot be removed'); return; }
  if (!confirm(`Remove "${item}" from Classics?\nThis affects ALL nights.`)) return;
  S.clsCustom[cat] = S.clsCustom[cat].filter(x => x !== item);
  S.nights.forEach(nd => { delete nd.tags['CLS||' + item]; });
  save(); renderCls(S.currentNight); toast('Removed from all nights');
}

// ══════════════════════════════════════════════════════
// VENUE SELECTOR
// ══════════════════════════════════════════════════════
export function renderVenueBar() {
  const n  = S.currentNight;
  const nd = S.nights[n];
  document.getElementById('mdr-btns').innerHTML = MDR.map(r => {
    const sel = nd.dining === r.id;
    return `<button class="vb ${sel ? 'sel' : ''}"
      style="${sel ? `background:${r.c};border-color:${r.c};` : `border-color:${r.c}55`}"
      onclick="setVenue('${r.id}')">${r.id}</button>`;
  }).join('');
  document.getElementById('buf-btns').innerHTML = BUFFET.map(b => {
    const sel = nd.dining === b.id;
    return `<button class="vb buf ${sel ? 'sel' : ''}"
      style="${sel ? `background:${b.c};border-color:${b.c};` : `border-color:${b.c}55`}"
      onclick="setVenue('${b.id}')">${b.id}</button>`;
  }).join('');
  const spSel = document.getElementById('sp-sel');
  spSel.innerHTML = `<option value="">★ Specialty ($$)…</option>`
    + SPECIALTY.map(sp =>
        `<option value="${sp.id}"${nd.dining === sp.id ? ' selected' : ''}>${sp.id}</option>`
      ).join('');
  spSel.className = 'sp-sel' + (SPECIALTY.some(sp => sp.id === nd.dining) ? ' sel' : '');
}

export function setVenue(id) {
  const n = S.currentNight;
  S.nights[n].dining = S.nights[n].dining === id ? null : id;
  save(); renderVenueBar(); renderExcl(n); updateRailPill(n);
}
export function setSpecialty(id) {
  S.nights[S.currentNight].dining = id || null;
  save(); renderVenueBar(); renderExcl(S.currentNight); updateRailPill(S.currentNight);
}
export function clearVenue() {
  S.nights[S.currentNight].dining = null;
  save(); renderVenueBar(); renderExcl(S.currentNight); updateRailPill(S.currentNight);
}

// ══════════════════════════════════════════════════════
// NIGHT RAIL
// ══════════════════════════════════════════════════════
function railPillHTML(i) {
  const nd      = S.nights[i];
  const v       = nd.dining ? vById(nd.dining) : null;
  const hasFeat = Object.entries(nd.tags).some(([k, t]) => k.startsWith('SIG||') && t.feat);
  const tagN    = Object.values(nd.tags).reduce((s, t) => s + t.diners.length, 0);
  return `<div class="np ${i === S.currentNight ? 'on' : ''}" onclick="selectNight(${i})">
    <div class="np-n">Night ${i + 1}</div>
    <div class="np-d">${DATES[i]}</div>
    ${v ? `<div class="np-v" style="color:${v.c}">${vType(nd.dining) === 'spc' ? 'Specialty' : v.short}</div>` : ''}
    ${hasFeat ? '<div class="np-f">⭐</div>' : ''}
    ${tagN > 0 ? `<div style="font-size:7px;color:var(--muted);margin-top:1px">${tagN}✓</div>` : ''}
  </div>`;
}

export function renderRail() {
  document.getElementById('rail').innerHTML =
    Array.from({ length: 10 }, (_, i) => railPillHTML(i)).join('');
}
export function updateRailPill() { renderRail(); }

// ══════════════════════════════════════════════════════
// DINER LEGEND
// ══════════════════════════════════════════════════════
export function renderLegend() {
  document.getElementById('diner-legend').innerHTML = DINERS.map(d =>
    `<div class="db"><div class="dd" style="background:${d.c}"></div>${d.label}</div>`
  ).join('');
}

// ══════════════════════════════════════════════════════
// DECISION FLOW BAR
// ══════════════════════════════════════════════════════
export function refreshDecisionFlow() {
  const n     = S.currentNight;
  const sigT  = countTagged(n, 'SIG');
  const exclT = MDR.reduce((s, r) => s + countTagged(n, r.id), 0);
  const clsT  = countTagged(n, 'CLS');

  const steps = [
    { num: 1, label: 'Signatures',     sub: 'Rotating · same everywhere',    c: 'var(--sig)',  t: sigT,  target: 'sig'  },
    { num: 2, label: 'MDR Exclusives', sub: 'Themed · pick your restaurant', c: 'var(--excl)', t: exclT, target: 'excl' },
    { num: 3, label: 'Classics',       sub: 'Always available',              c: 'var(--cls)',  t: clsT,  target: 'cls'  },
    { num: 4, label: 'Specialty $$',   sub: 'Paid cover charge',             c: 'var(--spc)',  t: 0,     target: null   },
  ];

  document.getElementById('dflow').innerHTML = steps.map((st, i) => {
    const hasTags = st.t > 0;
    return `${i > 0 ? `<span class="df-arrow">→</span>` : ''}
    <div class="df-step ${hasTags ? 'has-tags' : ''}" style="--step-c:${st.c}"
      onclick="${st.target ? `scrollToSec('${st.target}')` : ''}" title="${st.sub}">
      <div class="df-num">${st.num}</div>
      <div>
        <div class="df-label">${st.label}${hasTags ? `<span class="df-tagged">${st.t}</span>` : ''}</div>
        <span class="df-sub">${st.sub}</span>
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════
// ADD MODE TOGGLE
// ══════════════════════════════════════════════════════
export function toggleAddMode() {
  const on  = document.getElementById('main').classList.toggle('add-mode');
  const btn = document.getElementById('add-mode-btn');
  if (btn) { btn.classList.toggle('on', on); btn.textContent = on ? '✕ Hide Add' : '✎ Add Items'; }
}

// ══════════════════════════════════════════════════════
// VIEW SWITCHER
// ══════════════════════════════════════════════════════
export function setView(v) {
  document.getElementById('v-plan').style.display = v === 'plan' ? '' : 'none';
  document.getElementById('v-sum').style.display  = v === 'sum'  ? 'block' : 'none';
  document.querySelectorAll('.vtab').forEach(b =>
    b.classList.toggle('on',
      (v === 'plan' && b.textContent.includes('Planner')) ||
      (v === 'sum'  && b.textContent.includes('Overview'))
    )
  );
  if (v === 'sum') renderSummary();
}

// ══════════════════════════════════════════════════════
// IMPORT / EXPORT
// ══════════════════════════════════════════════════════
export function doExport() {
  backfillCats()
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'ascent-dining-v11.json';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Plan exported!');
}

export function exportDefaultSig() {
  const dl  = DATES;
  let out   = 'const DEFAULT_SIG = [\n';
  for (let i = 0; i < 10; i++) {
    const si    = sigItems(i);
    const toObj = x => "{n:'" + x.n.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "',v:" + x.v + "}";
    out += '  // Night ' + (i + 1) + ' ' + dl[i] + '\n';
    out += '  {s:[' + si.s.map(toObj) + '],\n   e:[' + si.e.map(toObj) + '],\n   d:[' + si.d.map(toObj) + ']}';
    out += i < 9 ? ',\n' : '\n';
  }
  out += '];\n';
  document.getElementById('dsig-ta').value = out;
  openMo('mo-dsig');
}

export function openMo(id)  { document.getElementById(id).classList.add('open'); }
export function closeMo(id) { document.getElementById(id).classList.remove('open'); }

export function doImportText() {
  const txt = document.getElementById('imp-ta').value.trim();
  if (!txt) { toast('Nothing to import'); return; }
  importJSON(txt, 'merge');   
}
export function handleFileImp(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = e => importJSON(e.target.result,'merge');
  r.readAsText(f);
  ev.target.value = '';
}

function backfillCats() {
  S.nights.forEach((nd, nightIdx) => {
    Object.entries(nd.tags).forEach(([k, t]) => {
      if (t.cat) return;                         // already stamped, skip
      const [ns, itemName] = k.split('||');
      const c = getItemCat(ns, itemName, nightIdx);
      if (c) t.cat = c;
    });
  });
}


function importJSON(txt, mode = 'replace') {
  try {
    const p = JSON.parse(txt);
    if (!p.nights || !Array.isArray(p.nights)) throw new Error('Invalid plan format');
    p.nights.forEach(n => {
      if (!n.sigCustom) n.sigCustom = { s: [], e: [], d: [] };
      if (!n.tags)      n.tags = {};
      delete n.sigDeleted;
    });
    if (!p.exclCustom) p.exclCustom = {};
    if (!p.clsCustom)  p.clsCustom  = { s: [], e: [], d: [] };
    delete p.exclDeleted;
    delete p.clsDeleted;

    //if (mode === 'merge') {
      mergeStateInPlace(p);
      backfillCats();
      save(); closeMo('mo-import'); document.getElementById('imp-ta').value = '';
      render(); toast('✓ Plan merged!');
    //} else {
    //  applyState(p);
    //  backfillCats();
    //  save(); closeMo('mo-import'); document.getElementById('imp-ta').value = '';
    //  render(); toast('✓ Plan imported!');
    //}
  } catch (e) { toast('Import failed: ' + e.message); }
}


function mergeStateInPlace(incoming) {
  // assume same number of nights and same menu structure
  incoming.nights.forEach((srcNight, nightIdx) => {
    const dstNight = S.nights[nightIdx];

    // 1) Merge tags (per menu item)
    Object.entries(srcNight.tags || {}).forEach(([k, tSrc]) => {
      const tDst = dstNight.tags[k] || { diners: [], feat: false };

      // merge diners: union by id
      (tSrc.diners || []).forEach(did => {
        if (!tDst.diners.includes(did)) {
          tDst.diners.push(did);
        }
      });

      // merge feat: if anyone starred it, mark true
      if (tSrc.feat) tDst.feat = true;

      // preserve category if present (single letter 's'|'e'|'d')
      if (tSrc.cat && !tDst.cat) tDst.cat = tSrc.cat;

      dstNight.tags[k] = tDst;
    });

    // 2) (optional) Merge sigCustom / exclCustom / clsCustom
    // If you want each diner’s custom items to be available in the combined
    // view, you can union those arrays as well.

    ['s', 'e', 'd'].forEach(cat => {
      // Signatures (night-specific)
      if (srcNight.sigCustom && srcNight.sigCustom[cat]) {
        if (!dstNight.sigCustom[cat]) dstNight.sigCustom[cat] = [];
        srcNight.sigCustom[cat].forEach(item => {
          const exists = dstNight.sigCustom[cat].some(i => i.n === item.n);
          if (!exists) dstNight.sigCustom[cat].push(item);
        });
      }
    });

  });

  // MDR Exclusives / Classics live at root level
  if (incoming.exclCustom) {
    Object.entries(incoming.exclCustom).forEach(([k, arr]) => {
      if (!S.exclCustom[k]) S.exclCustom[k] = [];
      arr.forEach(item => {
        const exists = S.exclCustom[k].some(i => i.n === item.n);
        if (!exists) S.exclCustom[k].push(item);
      });
    });
  }

  if (incoming.clsCustom) {
    ['s', 'e', 'd'].forEach(cat => {
      const srcArr = incoming.clsCustom[cat] || [];
      if (!S.clsCustom[cat]) S.clsCustom[cat] = [];
      srcArr.forEach(item => {
        const name = typeof item === 'string' ? item : item.n;
        const exists = S.clsCustom[cat].some(i => (typeof i === 'string' ? i : i.n) === name);
        if (!exists) S.clsCustom[cat].push(item);
      });
    });
  }
}


// ══════════════════════════════════════════════════════
// NIGHT SELECTION
// ══════════════════════════════════════════════════════
export function selectNight(i) {
  S.currentNight = i; save();
  setView('plan');
  renderRail(); renderPlanner();
  document.querySelectorAll('.np')[i]?.scrollIntoView({ inline: 'center', behavior: 'smooth' });
}

// ══════════════════════════════════════════════════════
// PLANNER RENDER
// ══════════════════════════════════════════════════════
function renderPlanner() {
  const n = S.currentNight;
  renderVenueBar();
  refreshDecisionFlow();
  renderSig(n);
  renderExcl(n);
  renderCls(n);
  buildAC();
}

function render() {
  renderLegend();
  renderRail();
  renderPlanner();
}


async function autoImportFromServer() {
  try {
    const res = await fetch('./ascent-dining-v11.json', { cache: 'no-store' });
    if (!res.ok) return; // file not found or server declined
    const txt = await res.text();
    importJSON(txt, 'merge'); // merges, stamps categories, save(), render(), toast()
  } catch (err) {
    console.warn('Auto-load failed:', err);
  }
}

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
render();
autoImportFromServer();

//backfillCats();
save();

// ══════════════════════════════════════════════════════
// EXPOSE TO GLOBAL SCOPE
// (required for inline onclick= handlers with type="module")
// ══════════════════════════════════════════════════════
window.selectNight       = selectNight;
window.toggleDiner       = toggleDiner;
window.toggleFeat        = toggleFeat;
window.setVenue          = setVenue;
window.setSpecialty      = setSpecialty;
window.clearVenue        = clearVenue;
window.toggleSec         = toggleSec;
window.toggleAddMode     = toggleAddMode;
window.scrollToSec       = scrollToSec;
window.openMo            = openMo;
window.closeMo           = closeMo;
window.doImportText      = doImportText;
window.handleFileImp     = handleFileImp;
window.doExport          = doExport;
window.exportDefaultSig  = exportDefaultSig;
window.setView           = setView;
window.addSigItem        = addSigItem;
window.delSig            = delSig;
window.copySigToAll      = copySigToAll;
window.addExclItem       = addExclItem;
window.delExcl           = delExcl;
window.addClsItem        = addClsItem;
window.delCls            = delCls;
window.handleSigKey      = handleSigKey;
window.handleExclKey     = handleExclKey;
window.handleClsKey      = handleClsKey;
window.toast             = toast;

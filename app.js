import {
  VER,
  SK,
  DINERS,
  MDR,
  BUFFET,
  SPECIALTY,
  ALL_V,
  BASE_EXCL,
  BASE_CLS,
  DEFAULT_SIG,
  DATES,
  CAT_LBL,
  CAT_ICO
} from './data.js';

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════
// Alphabetical sort helper — works on arrays of strings or {n,v} objects
function sortAlpha(arr){
  return [...arr].sort((a,b)=>{
    const na = typeof a==='string' ? a : a.n;
    const nb = typeof b==='string' ? b : b.n;
    return na.localeCompare(nb,'en',{sensitivity:'base'});
  });
}

// ══════════════════════════════════════════════════════
// STATE  (no deleted tracking — base items are permanent)
// ══════════════════════════════════════════════════════
function freshState(){
  return {
    currentNight: 0,
    nights: Array.from({length:10}, () => ({
      dining:    null,
      tags:      {},
      sigCustom: {s:[], e:[], d:[]},
    })),
    exclCustom: {},          // {restId+'||'+cat: [{n,v},...]}
    clsCustom:  {s:[],e:[],d:[]},
  };
}

let S = (()=>{
  try {
    const raw = localStorage.getItem(SK);
    if (raw) {
      const p = JSON.parse(raw);
      // Normalise any missing keys
      p.nights.forEach(n => {
        if (!n.sigCustom) n.sigCustom = {s:[],e:[],d:[]};
        if (!n.tags)      n.tags = {};
        // Strip old deleted-tracking keys (migration from v7)
        delete n.sigDeleted;
      });
      if (!p.exclCustom) p.exclCustom = {};
      if (!p.clsCustom)  p.clsCustom  = {s:[],e:[],d:[]};
      delete p.exclDeleted;
      delete p.clsDeleted;
      return p;
    }
  } catch(e) {}
  return freshState();
})();

function save(){ try { localStorage.setItem(SK, JSON.stringify(S)); } catch(e) {} }

function toggleAddMode(){
  const on  = document.getElementById('main').classList.toggle('add-mode');
  const btn = document.getElementById('add-mode-btn');
  if (btn) { btn.classList.toggle('on', on); btn.textContent = on ? '✕ Hide Add' : '✎ Add Items'; }
}

// ══════════════════════════════════════════════════════
// TAG HELPERS
// ══════════════════════════════════════════════════════
function tagKey(ns, item){ return ns + '||' + item; }
function getTag(n, ns, item){
  const k = tagKey(ns, item);
  if (!S.nights[n].tags[k]) S.nights[n].tags[k] = {diners:[], feat:false};
  return S.nights[n].tags[k];
}

function toggleDiner(n, ns, item, did){
  const t = getTag(n, ns, item);
  const i = t.diners.indexOf(did);
  i > -1 ? t.diners.splice(i,1) : t.diners.push(did);
  save(); refreshRow(n, ns, item); refreshDecisionFlow(); updateRailPill(n);
}
function toggleFeat(n, ns, item){
  const t = getTag(n, ns, item); t.feat = !t.feat;
  save(); refreshRow(n, ns, item); refreshDecisionFlow(); updateRailPill(n);
}

function rId(n, ns, item){
  return 'r' + n + ns.replace(/[^a-zA-Z0-9]/g,'') + '_'
       + btoa(unescape(encodeURIComponent(item))).replace(/[^a-zA-Z0-9]/g,'');
}

function refreshRow(n, ns, item){
  const el = document.getElementById(rId(n, ns, item)); if (!el) return;
  const t  = getTag(n, ns, item);
  const fb = el.querySelector('.fb');
  if (fb) { fb.classList.toggle('on', t.feat); fb.textContent = t.feat ? '⭐' : '☆'; }
  DINERS.forEach(d => {
    const dt = el.querySelector('[data-d="'+d.id+'"]');
    if (dt) {
      const on = t.diners.includes(d.id);
      dt.classList.toggle('on', on);
      dt.style.borderColor = on ? d.c : 'transparent';
      dt.style.background  = on ? d.c+'33' : 'transparent';
    }
  });
}

function countTagged(n, ns){
  return Object.entries(S.nights[n].tags)
    .filter(([k,t]) => k.startsWith(ns+'||') && (t.diners.length > 0 || t.feat)).length;
}

// ══════════════════════════════════════════════════════
// ITEM ROW BUILDER
// ══════════════════════════════════════════════════════
function buildRow(n, ns, item, unverified, source, cat){
  const t   = getTag(n, ns, item);
  const id  = rId(n, ns, item);
  const esc = item.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const catJ = cat ? `'${cat}'` : 'null';
  const nsJ  = `'${ns}'`;

  const dtags = DINERS.map(d => {
    const on = t.diners.includes(d.id);
    return `<div class="dt ${on?'on':''}" data-d="${d.id}"
      style="border-color:${on?d.c:'transparent'};background:${on?d.c+'33':'transparent'};color:${d.c}"
      onclick="toggleDiner(${n},${nsJ},'${esc}','${d.id}')"
      title="${d.label}">${d.s}</div>`;
  }).join('');

  let acts = '';
  if (source === 'sig') {
    // All sig items are custom (DEFAULT_SIG is blank); show copy+delete
    acts = `<span class="ir-actions">
      <button class="ia cpa" onclick="copySigToAll(${n},'${esc}',${catJ})" title="Copy to all nights">⊕All</button>
      <button class="ia del" onclick="delSig(${n},'${esc}')" title="Remove">✕</button>
    </span>`;
  } else if (source === 'excl') {
    // Only show delete button for custom-added items
    const isCustom = cat && S.exclCustom[ns+'||'+cat]?.some(x => x.n === item);
    acts = isCustom
      ? `<span class="ir-actions"><button class="ia del" onclick="delExcl(${nsJ},'${esc}',${catJ})" title="Remove">✕</button></span>`
      : '';
  } else if (source === 'cls') {
    // Only show delete button for custom-added items
    const isCustom = cat && S.clsCustom[cat]?.includes(item);
    acts = isCustom
      ? `<span class="ir-actions"><button class="ia del" onclick="delCls('${esc}',${catJ})" title="Remove">✕</button></span>`
      : '';
  }

  return `<div class="ir" id="${id}">
    <span class="in${unverified?' uv':''}">${item}</span>
    <button class="fb ${t.feat?'on':''}" onclick="toggleFeat(${n},${nsJ},'${esc}')" title="Star as featured">${t.feat?'⭐':'☆'}</button>
    <div class="dtags">${dtags}</div>
    ${acts}
  </div>`;
}

function buildAddRow(inpId, keyHandler, addHandler){
  return `<div class="arow">
    <input class="ainp" id="${inpId}" placeholder="New item…" list="sug" onkeydown="${keyHandler}">
    <button class="abtn" onclick="${addHandler}">+ Add</button>
  </div>`;
}

// ══════════════════════════════════════════════════════
// SIGNATURES SECTION
// ══════════════════════════════════════════════════════
function sigItems(n){
  const base = DEFAULT_SIG[n] || {s:[],e:[],d:[]};
  const cust = S.nights[n].sigCustom || {s:[],e:[],d:[]};
  return {
    s: [...base.s, ...cust.s],
    e: [...base.e, ...cust.e],
    d: [...base.d, ...cust.d],
  };
}

function renderSig(n){
  const items = sigItems(n);
  let html = '';
  ['s','e','d'].forEach(cat => {
    const list  = sortAlpha(items[cat]);
    const cnt   = list.filter(i => { const t=getTag(n,'SIG',i.n); return t.diners.length>0||t.feat; }).length;
    const addId = `sig-add-${n}-${cat}`;
    html += `<div class="sig-col">
      <div class="sig-col-hdr">
        <span class="sig-col-title">${CAT_ICO[cat]} ${CAT_LBL[cat]}</span>
        <span class="sig-col-count">${cnt}</span>
      </div>
      ${list.map(i => buildRow(n,'SIG',i.n,!i.v,'sig',cat)).join('')}
      ${buildAddRow(addId, `handleSigKey(event,${n},'${cat}')`, `addSigItem(${n},'${cat}')`)}
    </div>`;
  });
  document.getElementById('sig-grid').innerHTML = html;
  updateSigBadges(n);
}

function updateSigBadges(n){
  const total = countTagged(n,'SIG');
  const feats = Object.entries(S.nights[n].tags).filter(([k,t]) => k.startsWith('SIG||') && t.feat).length;
  document.getElementById('sig-badges').innerHTML =
    (total>0?`<span class="ps-badge" style="background:var(--gold3);color:var(--gold2)">${total} tagged</span>`:'')
    +(feats>0?`<span class="ps-badge" style="background:var(--gold3);color:var(--gold2)">⭐${feats}</span>`:'');
}

function handleSigKey(e, n, cat){ if (e.key==='Enter'||e.key==='Tab'){ e.preventDefault(); addSigItem(n,cat); } }
function addSigItem(n, cat){
  const inp = document.getElementById(`sig-add-${n}-${cat}`); if (!inp) return;
  const val = inp.value.trim(); if (!val) return;
  const exist = getAllSigItems(n);
  if (exist.map(x=>x.toLowerCase()).includes(val.toLowerCase())){ toast('Already exists!'); inp.value=''; inp.focus(); return; }
  S.nights[n].sigCustom[cat].push({n:val, v:1});
  save(); inp.value=''; renderSig(n); refreshDecisionFlow(); toast('Added: '+val);
  document.getElementById(`sig-add-${n}-${cat}`)?.focus();
}
function getAllSigItems(n){ return [...sigItems(n).s,...sigItems(n).e,...sigItems(n).d].map(i=>i.n); }

function delSig(n, item){
  if (!confirm(`Remove "${item}" from Night ${n+1} Signatures?`)) return;
  let removed = false;
  ['s','e','d'].forEach(cat => {
    const idx = (S.nights[n].sigCustom[cat]||[]).findIndex(i=>i.n===item);
    if (idx > -1){ S.nights[n].sigCustom[cat].splice(idx,1); removed = true; }
  });
  if (!removed){ toast('Cannot remove base menu items'); return; }
  delete S.nights[n].tags['SIG||'+item];
  save(); renderSig(n); refreshDecisionFlow(); toast('Removed');
}

function copySigToAll(srcNight, item, cat){
  let count = 0;
  S.nights.forEach((nd, i) => {
    if (i === srcNight) return;
    if (!nd.sigCustom[cat]) nd.sigCustom[cat] = [];
    const allExist = getAllSigItemsFor(i);
    if (!allExist.map(x=>x.toLowerCase()).includes(item.toLowerCase())){
      nd.sigCustom[cat].push({n:item, v:1}); count++;
    }
  });
  save(); renderSig(S.currentNight); toast(`Copied to ${count} night${count!==1?'s':''}`);
}
function getAllSigItemsFor(n){ return [...sigItems(n).s,...sigItems(n).e,...sigItems(n).d].map(i=>i.n); }

// ══════════════════════════════════════════════════════
// MDR EXCLUSIVES SECTION
// ══════════════════════════════════════════════════════
function exclItems(restId){
  const base = BASE_EXCL[restId];
  const cust = S.exclCustom || {};
  return {
    s: [...base.s, ...(cust[restId+'||s'] || [])],
    e: [...base.e, ...(cust[restId+'||e'] || [])],
    d: [...base.d, ...(cust[restId+'||d'] || [])],
  };
}

function renderExcl(n){
  const nd = S.nights[n];
  let html = '';
  MDR.forEach(r => {
    const isTonight = nd.dining === r.id;
    const items     = exclItems(r.id);
    const allItems  = [...items.s,...items.e,...items.d];
    const tagged    = allItems.filter(i => { const t=getTag(n,r.id,i.n); return t.diners.length>0||t.feat; }).length;
    let colHtml = '';
    colHtml += `<div class="excl-col-hdr" style="border-left:3px solid ${r.c}22">
      <span class="excl-col-name" style="color:${r.c}">${r.id}</span>
      ${isTonight?`<span style="font-size:8px;font-weight:600;background:${r.c};color:#07101c;padding:2px 6px;border-radius:2px;letter-spacing:.5px">TONIGHT</span>`:''}
      ${tagged>0?`<span style="font-size:8px;background:${r.c}22;color:${r.c};padding:1px 5px;border-radius:8px;font-weight:600;margin-left:auto">${tagged}</span>`:''}
    </div>`;
    ['s','e','d'].forEach(cat => {
      const list  = items[cat]; if (!list.length) return;
      const addId = `excl-add-${r.id}-${cat}`;
      colHtml += `<div class="excl-subsec">${CAT_ICO[cat]} ${CAT_LBL[cat]}</div>`;
      colHtml += sortAlpha(list).map(i => buildRow(n, r.id, i.n, !i.v, 'excl', cat)).join('');
      colHtml += buildAddRow(addId, `handleExclKey(event,'${r.id}','${cat}')`, `addExclItem('${r.id}','${cat}')`);
    });
    html += `<div class="excl-col${isTonight?' is-tonight':''}" style="--tc:${r.c}">${colHtml}</div>`;
  });
  document.getElementById('excl-grid').innerHTML = html;
  updateExclBadges(n);
}

function updateExclBadges(n){
  let total=0, feats=0;
  MDR.forEach(r => {
    Object.entries(S.nights[n].tags).forEach(([k,t]) => {
      if (k.startsWith(r.id+'||')){ if(t.diners.length>0||t.feat) total++; if(t.feat) feats++; }
    });
  });
  document.getElementById('excl-badges').innerHTML =
    (total>0?`<span class="ps-badge" style="background:rgba(122,159,201,0.15);color:var(--excl)">${total} tagged</span>`:'')
    +(feats>0?`<span class="ps-badge" style="background:rgba(122,159,201,0.15);color:var(--excl)">⭐${feats}</span>`:'');
}

function handleExclKey(e, r, cat){ if(e.key==='Enter'||e.key==='Tab'){ e.preventDefault(); addExclItem(r,cat); } }
function addExclItem(restId, cat){
  const inp = document.getElementById(`excl-add-${restId}-${cat}`); if (!inp) return;
  const val = inp.value.trim(); if (!val) return;
  const k = restId+'||'+cat;
  if (!S.exclCustom) S.exclCustom = {};
  if (!S.exclCustom[k]) S.exclCustom[k] = [];
  const exist = [...exclItems(restId).s,...exclItems(restId).e,...exclItems(restId).d].map(i=>i.n.toLowerCase());
  if (exist.includes(val.toLowerCase())){ toast('Already exists!'); inp.value=''; return; }
  S.exclCustom[k].push({n:val, v:1});
  save(); inp.value=''; renderExcl(S.currentNight); toast('Added to '+restId+' (all nights)');
}
function delExcl(restId, item, cat){
  const k = restId+'||'+cat;
  const isCustom = S.exclCustom[k]?.some(x => x.n === item);
  if (!isCustom){ toast('Base menu items cannot be removed'); return; }
  if (!confirm(`Remove "${item}" from ${restId} Exclusives?\nThis affects ALL nights.`)) return;
  S.exclCustom[k] = S.exclCustom[k].filter(x => x.n !== item);
  S.nights.forEach(nd => { delete nd.tags[restId+'||'+item]; });
  save(); renderExcl(S.currentNight); toast('Removed from all nights');
}

// ══════════════════════════════════════════════════════
// CLASSICS SECTION
// ══════════════════════════════════════════════════════
function clsItems(){
  const cust = S.clsCustom || {s:[],e:[],d:[]};
  return {
    s: [...BASE_CLS.s, ...(cust.s || [])],
    e: [...BASE_CLS.e, ...(cust.e || [])],
    d: [...BASE_CLS.d, ...(cust.d || [])],
  };
}

function renderCls(n){
  const items = clsItems();
  let html = '';
  ['s','e','d'].forEach(cat => {
    const list  = sortAlpha(items[cat]);
    const cnt   = list.filter(i => { const nm=typeof i==='string'?i:i.n; const t=getTag(n,'CLS',nm); return t.diners.length>0||t.feat; }).length;
    const addId = `cls-add-${cat}`;
    html += `<div class="cls-col">
      <div class="cls-col-hdr">${CAT_ICO[cat]} ${CAT_LBL[cat]}${cnt>0?` <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(106,158,122,0.15);color:var(--cls);font-weight:600">${cnt}</span>`:''}
      </div>
      ${list.map(i => { const nm=typeof i==='string'?i:i.n; return buildRow(n,'CLS',nm,false,'cls',cat); }).join('')}
      ${buildAddRow(addId, `handleClsKey(event,'${cat}')`, `addClsItem('${cat}')`)}
    </div>`;
  });
  document.getElementById('cls-grid').innerHTML = html;
  updateClsBadges(n);
}

function updateClsBadges(n){
  const total = countTagged(n,'CLS');
  const feats = Object.entries(S.nights[n].tags).filter(([k,t]) => k.startsWith('CLS||') && t.feat).length;
  document.getElementById('cls-badges').innerHTML =
    (total>0?`<span class="ps-badge" style="background:rgba(106,158,122,0.15);color:var(--cls)">${total} tagged</span>`:'')
    +(feats>0?`<span class="ps-badge" style="background:rgba(106,158,122,0.15);color:var(--cls)">⭐${feats}</span>`:'');
}

function handleClsKey(e, cat){ if(e.key==='Enter'||e.key==='Tab'){ e.preventDefault(); addClsItem(cat); } }
function addClsItem(cat){
  const inp = document.getElementById(`cls-add-${cat}`); if (!inp) return;
  const val = inp.value.trim(); if (!val) return;
  if (!S.clsCustom) S.clsCustom = {s:[],e:[],d:[]};
  const items = clsItems();
  const exist = [...items.s,...items.e,...items.d].map(i=>(typeof i==='string'?i:i.n).toLowerCase());
  if (exist.includes(val.toLowerCase())){ toast('Already exists!'); inp.value=''; inp.focus(); return; }
  S.clsCustom[cat].push(val);
  save(); inp.value=''; renderCls(S.currentNight); toast('Added to Classics (all nights)');
  document.getElementById(`cls-add-${cat}`)?.focus();
}
function delCls(item, cat){
  const isCustom = S.clsCustom?.[cat]?.includes(item);
  if (!isCustom){ toast('Base menu items cannot be removed'); return; }
  if (!confirm(`Remove "${item}" from Classics?\nThis affects ALL nights.`)) return;
  S.clsCustom[cat] = S.clsCustom[cat].filter(x => x !== item);
  S.nights.forEach(nd => { delete nd.tags['CLS||'+item]; });
  save(); renderCls(S.currentNight); toast('Removed from all nights');
}

// ══════════════════════════════════════════════════════
// DECISION FLOW BAR
// ══════════════════════════════════════════════════════
function refreshDecisionFlow(){
  const n     = S.currentNight;
  const sigT  = countTagged(n,'SIG');
  const exclT = MDR.reduce((s,r) => s + countTagged(n,r.id), 0);
  const clsT  = countTagged(n,'CLS');

  const steps = [
    {num:1,label:'Signatures',  sub:'Rotating · same everywhere',   c:'var(--sig)', t:sigT,  target:'sig'},
    {num:2,label:'MDR Exclusives',sub:'Themed · pick your restaurant',c:'var(--excl)',t:exclT, target:'excl'},
    {num:3,label:'Classics',    sub:'Always available',              c:'var(--cls)', t:clsT,  target:'cls'},
    {num:4,label:'Specialty $$',sub:'Paid cover charge',             c:'var(--spc)', t:0,     target:null},
  ];

  document.getElementById('dflow').innerHTML = steps.map((st,i) => {
    const hasTags = st.t > 0;
    return `${i>0?`<span class="df-arrow">→</span>`:''}
    <div class="df-step ${hasTags?'has-tags':''}" style="--step-c:${st.c}"
      onclick="${st.target?`scrollToSec('${st.target}')`:''}" title="${st.sub}">
      <div class="df-num">${st.num}</div>
      <div>
        <div class="df-label">${st.label}${hasTags?`<span class="df-tagged">${st.t}</span>`:''}</div>
        <span class="df-sub">${st.sub}</span>
      </div>
    </div>`;
  }).join('');
}

function scrollToSec(secId){
  document.getElementById('sec-'+secId)?.scrollIntoView({behavior:'smooth',block:'start'});
  toggleSec(secId, true);
}

// ══════════════════════════════════════════════════════
// SECTION TOGGLE
// ══════════════════════════════════════════════════════
function toggleSec(id, forceOpen){
  const body = document.getElementById('body-'+id);
  const tog  = document.getElementById('tog-'+id);
  const hdr  = document.querySelector(`#sec-${id} .ps-hdr`);
  if (!body) return;
  const shouldShow = forceOpen !== undefined ? forceOpen : (body.style.display === 'none');
  body.style.display = shouldShow ? '' : 'none';
  tog?.classList.toggle('open', shouldShow);
  hdr?.classList.toggle('collapsed', !shouldShow);
}

// ══════════════════════════════════════════════════════
// VENUE SELECTOR
// ══════════════════════════════════════════════════════
function vById(id){return ALL_V.find(v=>v.id===id)||{id,short:id.toUpperCase().slice(0,6),c:'#7a8fa8'};}
function vType(id){return MDR.find(v=>v.id===id)?'mdr':BUFFET.find(v=>v.id===id)?'buf':SPECIALTY.find(v=>v.id===id)?'spc':'?';}

function renderVenueBar(){
  const n  = S.currentNight;
  const nd = S.nights[n];
  document.getElementById('mdr-btns').innerHTML = MDR.map(r => {
    const sel = nd.dining === r.id;
    return `<button class="vb ${sel?'sel':''}" style="${sel?`background:${r.c};border-color:${r.c};`:'border-color:'+r.c+'55'}" onclick="setVenue('${r.id}')">${r.id}</button>`;
  }).join('');
  document.getElementById('buf-btns').innerHTML = BUFFET.map(b => {
    const sel = nd.dining === b.id;
    return `<button class="vb buf ${sel?'sel':''}" style="${sel?`background:${b.c};border-color:${b.c};`:`border-color:${b.c}55`}" onclick="setVenue('${b.id}')">${b.id}</button>`;
  }).join('');
  const spSel = document.getElementById('sp-sel');
  spSel.innerHTML = `<option value="">★ Specialty ($$)…</option>`
    + SPECIALTY.map(sp => `<option value="${sp.id}"${nd.dining===sp.id?' selected':''}>${sp.id}</option>`).join('');
  const isSpc = SPECIALTY.some(sp => sp.id === nd.dining);
  spSel.className = 'sp-sel' + (isSpc ? ' sel' : '');
}

function setVenue(id){
  const n = S.currentNight;
  S.nights[n].dining = S.nights[n].dining === id ? null : id;
  save(); renderVenueBar(); renderExcl(n); updateRailPill(n);
}
function setSpecialty(id){
  S.nights[S.currentNight].dining = id || null;
  save(); renderVenueBar(); renderExcl(S.currentNight); updateRailPill(S.currentNight);
}
function clearVenue(){
  S.nights[S.currentNight].dining = null;
  save(); renderVenueBar(); renderExcl(S.currentNight); updateRailPill(S.currentNight);
}

// ══════════════════════════════════════════════════════
// NIGHT RAIL
// ══════════════════════════════════════════════════════
function railPillHTML(i){
  const nd     = S.nights[i];
  const v      = nd.dining ? vById(nd.dining) : null;
  const hasFeat = Object.values(nd.tags).some(t => t.feat);
  const tagN   = Object.values(nd.tags).reduce((s,t) => s + t.diners.length, 0);
  return `<div class="np ${i===S.currentNight?'on':''}" onclick="selectNight(${i})">
    <div class="np-n">Night ${i+1}</div>
    <div class="np-d">${DATES[i]}</div>
    ${v?`<div class="np-v" style="color:${v.c}">${vType(nd.dining)==='spc'?'Specialty':v.short}</div>`:''}
    ${hasFeat?'<div class="np-f">⭐</div>':''}
    ${tagN>0?`<div style="font-size:7px;color:var(--muted);margin-top:1px">${tagN}✓</div>`:''}
  </div>`;
}
function renderRail(){
  document.getElementById('rail').innerHTML = Array.from({length:10},(_,i) => railPillHTML(i)).join('');
}
function updateRailPill(i){ renderRail(); }
function selectNight(i){
  S.currentNight = i; save();
  setView('plan');
  renderRail(); renderPlanner();
  document.querySelectorAll('.np')[i]?.scrollIntoView({inline:'center',behavior:'smooth'});
}

// ══════════════════════════════════════════════════════
// DINER LEGEND
// ══════════════════════════════════════════════════════
function renderLegend(){
  document.getElementById('diner-legend').innerHTML = DINERS.map(d =>
    `<div class="db"><div class="dd" style="background:${d.c}"></div>${d.label}</div>`
  ).join('');
}

// ══════════════════════════════════════════════════════
// AUTOCOMPLETE  (built from DEFAULT_SIG + custom + excl + cls)
// ══════════════════════════════════════════════════════
function buildAC(){
  const set = new Set();
  // Pull from DEFAULT_SIG base (in case user pastes it back in)
  DEFAULT_SIG.forEach(night => { [...night.s,...night.e,...night.d].forEach(i => set.add(i.n)); });
  // Pull from this voyage's custom sig entries
  S.nights.forEach(nd => {
    ['s','e','d'].forEach(cat => { (nd.sigCustom[cat]||[]).forEach(i => set.add(i.n)); });
  });
  // MDR Exclusives
  MDR.forEach(r => { const items=exclItems(r.id); [...items.s,...items.e,...items.d].forEach(i=>set.add(i.n)); });
  // Classics
  const cls = clsItems();
  [...cls.s,...cls.e,...cls.d].forEach(i => set.add(typeof i==='string'?i:i.n));
  document.getElementById('sug').innerHTML = [...set].sort().map(i=>`<option value="${i}">`).join('');
}

// ══════════════════════════════════════════════════════
// MAIN PLANNER RENDER
// ══════════════════════════════════════════════════════
function renderPlanner(){
  const n = S.currentNight;
  renderVenueBar();
  refreshDecisionFlow();
  renderSig(n);
  renderExcl(n);
  renderCls(n);
  buildAC();
}

function render(){
  renderLegend();
  renderRail();
  renderPlanner();
}

// ══════════════════════════════════════════════════════
// IMPORT / EXPORT
// ══════════════════════════════════════════════════════
function exportDefaultSig(){
  const dl  = DATES;
  let out   = 'const DEFAULT_SIG = [\n';
  for (let i = 0; i < 10; i++){
    const si   = sigItems(i);
    const toObj = x => "{n:'" + x.n.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + "',v:" + x.v + "}";
    out += '  // Night '+(i+1)+' '+dl[i]+'\n';
    out += '  {s:['+si.s.map(toObj)+'],\n   e:['+si.e.map(toObj)+'],\n   d:['+si.d.map(toObj)+']}';
    out += i < 9 ? ',\n' : '\n';
  }
  out += '];\n';
  document.getElementById('dsig-ta').value = out;
  openMo('mo-dsig');
}

function doExport(){
  const blob = new Blob([JSON.stringify(S,null,2)], {type:'application/json'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'ascent-dining-v11.json';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Plan exported!');
}

function openMo(id){ document.getElementById(id).classList.add('open'); }
function closeMo(id){ document.getElementById(id).classList.remove('open'); }
function doImportText(){ const txt=document.getElementById('imp-ta').value.trim(); if(!txt){toast('Nothing to import');return;} importJSON(txt); }
function handleFileImp(ev){ const f=ev.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=e=>importJSON(e.target.result); r.readAsText(f); ev.target.value=''; }

function importJSON(txt){
  try {
    const p = JSON.parse(txt);
    if (!p.nights || !Array.isArray(p.nights)) throw new Error('Invalid plan format');
    p.nights.forEach(n => {
      if (!n.sigCustom) n.sigCustom = {s:[],e:[],d:[]};
      if (!n.tags)      n.tags = {};
      delete n.sigDeleted; // strip old v7 keys
    });
    if (!p.exclCustom) p.exclCustom = {};
    if (!p.clsCustom)  p.clsCustom  = {s:[],e:[],d:[]};
    delete p.exclDeleted;
    delete p.clsDeleted;
    S = p; save(); closeMo('mo-import'); document.getElementById('imp-ta').value = '';
    render(); toast('✓ Plan imported!');
  } catch(e) { toast('Import failed: '+e.message); }
}

// ══════════════════════════════════════════════════════
// SMART MEAL PLAN ALGORITHM
// ══════════════════════════════════════════════════════
/*
  Priority per diner per night per category:
    1. Signature  — night-specific, highest priority ("one and gone")
    2. Exclusive  — MDR-specific; scheduled to a night where the category is open
                    and the group visits that MDR
    3. Classic    — always available; fills any remaining gaps

  MDR assignment (per night):
    - Hard lock: user already set a venue via the venue bar
    - Soft / suggested: algorithm picks the MDR that maximises the total number of
      open diner×category slots filled by its exclusive items, across all 4 diners
    - Coverage guarantee: every MDR that has any diner demand gets at least one visit
    - Multi-visit rotation: each subsequent visit to the same MDR serves the NEXT
      desired item in that diner's list (never repeats while items remain)
*/

function computeMealPlan() {
  const CATS = ['s', 'e', 'd'];

  // ── Collect tagged items ──────────────────────────────────────
  // sigByNight[ni][did][cat] = first item tagged (string | null)
  const sigByNight = Array.from({length:10}, () => {
    const o = {};
    DINERS.forEach(d => { o[d.id] = {s:null, e:null, d:null}; });
    return o;
  });

  // exclWanted[did][restId][cat] = [item, ...] — union across all nights
  const exclWanted = {};
  DINERS.forEach(d => {
    exclWanted[d.id] = {};
    MDR.forEach(r => { exclWanted[d.id][r.id] = {s:[], e:[], d:[]}; });
  });

  // clsWanted[did][cat] = [item, ...]
  const clsWanted = {};
  DINERS.forEach(d => { clsWanted[d.id] = {s:[], e:[], d:[]}; });

  S.nights.forEach((nd, ni) => {
    Object.entries(nd.tags).forEach(([k, t]) => {
      if (!t.diners.length) return;
      const sep  = k.indexOf('||');
      const ns   = k.slice(0, sep);
      const item = k.slice(sep + 2);
      const cat  = getItemCat(ns, item, ni);
      if (!cat) return;

      t.diners.forEach(did => {
        if (ns === 'SIG') {
          if (!sigByNight[ni][did][cat]) sigByNight[ni][did][cat] = item;
        } else if (MDR.find(r => r.id === ns)) {
          if (!exclWanted[did][ns][cat].includes(item))
            exclWanted[did][ns][cat].push(item);
        } else if (ns === 'CLS') {
          if (!clsWanted[did][cat].includes(item))
            clsWanted[did][cat].push(item);
        }
      });
    });
  });

  // ── Initialise meal slots with locked Signature items ─────────
  const slot = Array.from({length:10}, (_, ni) => {
    const s = {};
    DINERS.forEach(d => {
      s[d.id] = {
        s: sigByNight[ni][d.id].s ? {item: sigByNight[ni][d.id].s, source:'sig'} : null,
        e: sigByNight[ni][d.id].e ? {item: sigByNight[ni][d.id].e, source:'sig'} : null,
        d: sigByNight[ni][d.id].d ? {item: sigByNight[ni][d.id].d, source:'sig'} : null,
      };
    });
    return s;
  });

  // ── Score: open diner×cat slots this MDR would fill on night ni ──
  function exclScore(ni, restId) {
    let sc = 0;
    DINERS.forEach(d => {
      CATS.forEach(cat => {
        if (!slot[ni][d.id][cat] && exclWanted[d.id][restId][cat].length > 0) sc++;
      });
    });
    return sc;
  }

  // ── Assign MDRs to nights ─────────────────────────────────────
  // chosenMDR[ni] = restId | null
  const chosenMDR = S.nights.map(nd =>
    (nd.dining && MDR.find(r => r.id === nd.dining)) ? nd.dining : null
  );
  const userSet = chosenMDR.map(v => v !== null);

  const free = () => Array.from({length:10}, (_,i)=>i).filter(ni => !chosenMDR[ni]);

  // Coverage pass: every MDR with demand gets ≥1 visit
  const covered = new Set(chosenMDR.filter(Boolean));
  MDR.forEach(r => {
    const hasDemand = DINERS.some(d => CATS.some(c => exclWanted[d.id][r.id][c].length > 0));
    if (!hasDemand || covered.has(r.id)) return;
    let bestNi = -1, bestSc = -1;
    free().forEach(ni => {
      const sc = exclScore(ni, r.id);
      if (sc > bestSc) { bestSc = sc; bestNi = ni; }
    });
    if (bestNi < 0 && free().length) bestNi = free()[0]; // any free night
    if (bestNi >= 0) { chosenMDR[bestNi] = r.id; covered.add(r.id); }
  });

  // Greedy fill: remaining nights get the highest-scoring MDR
  for (let ni = 0; ni < 10; ni++) {
    if (chosenMDR[ni]) continue;
    let bestMDR = MDR[0].id, bestSc = -1;
    MDR.forEach(r => {
      const sc = exclScore(ni, r.id);
      if (sc > bestSc) { bestSc = sc; bestMDR = r.id; }
    });
    chosenMDR[ni] = bestMDR;
  }

  // ── Fill exclusive items — rotate items across multiple visits ──
  // exclIdx[did][restId][cat] tracks which item to serve next for that diner×rest×cat
  const exclIdx = {};
  DINERS.forEach(d => {
    exclIdx[d.id] = {};
    MDR.forEach(r => { exclIdx[d.id][r.id] = {s:0, e:0, d:0}; });
  });

  for (let ni = 0; ni < 10; ni++) {
    const rest = chosenMDR[ni];
    if (!rest) continue;
    DINERS.forEach(d => {
      CATS.forEach(cat => {
        if (slot[ni][d.id][cat]) return; // signature occupies this slot
        const wants = exclWanted[d.id][rest][cat];
        const idx   = exclIdx[d.id][rest][cat];
        if (idx < wants.length) {
          slot[ni][d.id][cat] = {item: wants[idx], source:'excl', rest};
          exclIdx[d.id][rest][cat]++;
        }
      });
    });
  }

  // ── Fill remaining gaps with Classics ────────────────────────
  for (let ni = 0; ni < 10; ni++) {
    DINERS.forEach(d => {
      CATS.forEach(cat => {
        if (slot[ni][d.id][cat]) return;
        const wants = clsWanted[d.id][cat];
        if (wants.length) slot[ni][d.id][cat] = {item: wants[0], source:'cls'};
      });
    });
  }

  // ── Find unscheduled exclusive items ─────────────────────────
  // An item is "missed" if a diner tagged it but it never appeared in any night's slot
  const missed = [];
  DINERS.forEach(d => {
    MDR.forEach(r => {
      CATS.forEach(cat => {
        exclWanted[d.id][r.id][cat].forEach(item => {
          const got = Array.from({length:10}, (_,ni)=>ni).some(ni => {
            const sl = slot[ni][d.id][cat];
            return sl && sl.source === 'excl' && sl.item === item;
          });
          if (!got) missed.push({did: d.id, rest: r.id, cat, item});
        });
      });
    });
  });

  // ── Why label for each night ──────────────────────────────────
  const why = Array.from({length:10}, (_, ni) => {
    const rest = chosenMDR[ni];
    if (!rest) return '';
    const filledCount = DINERS.reduce((tot, d) =>
      tot + CATS.filter(c => slot[ni][d.id][c]?.source === 'excl').length, 0
    );
    const sigCount = DINERS.reduce((tot, d) =>
      tot + CATS.filter(c => slot[ni][d.id][c]?.source === 'sig').length, 0
    );
    const parts = [];
    if (filledCount) parts.push(`${filledCount} excl`);
    if (sigCount)    parts.push(`${sigCount} sig`);
    return parts.join(' · ');
  });

  return {slot, chosenMDR, userSet, missed, why};
}

// ══════════════════════════════════════════════════════
// RENDER MEAL PLAN
// ══════════════════════════════════════════════════════
function renderMealPlan() {
  const anyTagged = S.nights.some(nd => Object.values(nd.tags).some(t => t.diners.length > 0));
  if (!anyTagged) {
    document.getElementById('sum-mealplan').innerHTML =
      '<p style="color:var(--muted);font-size:.8rem;padding:4px 0">Tag menu items in the Planner first — the meal plan will appear here.</p>';
    return;
  }

  const {slot, chosenMDR, userSet, missed, why} = computeMealPlan();

  const SRC_C   = {sig:'var(--sig)',  excl:'var(--excl)', cls:'var(--cls)'};
  const SRC_LBL = {sig:'SIG', excl:'MDR', cls:'CLS'};

  // Legend
  let html = `<div class="mp-legend">
    <span style="font-size:.65rem;color:var(--muted);letter-spacing:1px;text-transform:uppercase">Key:</span>
    <span class="mp-leg-item"><span class="mp-leg-dot" style="background:var(--sig)"></span>Signature — rotating, night-specific</span>
    <span class="mp-leg-item"><span class="mp-leg-dot" style="background:var(--excl)"></span>Exclusive — MDR fixed menu</span>
    <span class="mp-leg-item"><span class="mp-leg-dot" style="background:var(--cls)"></span>Classic — always available</span>
  </div>`;

  for (let ni = 0; ni < 10; ni++) {
    const rest    = chosenMDR[ni];
    const restObj = rest ? MDR.find(r => r.id === rest) : null;
    const isUser  = userSet[ni];

    const mdrBadge = restObj
      ? `<span class="mp-mdr-badge" style="background:${restObj.c}22;color:${restObj.c}">
           ${restObj.id}<span class="mp-mdr-hint">${isUser ? '✓ your pick' : '⟵ suggested'}</span>
         </span>`
      : `<span class="mp-mdr-badge" style="background:rgba(255,255,255,0.06);color:var(--muted)">No MDR</span>`;

    const whyLabel = why[ni] ? `<span class="mp-score">${why[ni]}</span>` : '';

    const dinerCols = DINERS.map(d => {
      const courses = ['s','e','d'].map(cat => {
        const sl = slot[ni][d.id][cat];
        if (!sl) return `<div class="mp-course"><span class="mp-ico">${{s:'🥗',e:'🍽',d:'🍮'}[cat]}</span><span class="mp-empty">—</span></div>`;
        const srcColor = SRC_C[sl.source];
        const srcLabel = SRC_LBL[sl.source];
        return `<div class="mp-course">
          <span class="mp-ico">${{s:'🥗',e:'🍽',d:'🍮'}[cat]}</span>
          <span class="mp-item" style="color:${srcColor}" title="${srcLabel}: ${sl.item}">${sl.item}</span>
          <span class="mp-src" style="background:${srcColor}22;color:${srcColor}">${srcLabel}</span>
        </div>`;
      }).join('');

      return `<div class="mp-diner-col">
        <div class="mp-diner-name" style="color:${DINERS.find(x=>x.id===d.id).c}">${d.label}</div>
        ${courses}
      </div>`;
    }).join('');

    html += `<div class="mp-card">
      <div class="mp-hdr">
        <span class="mp-night-lbl">Night ${ni+1}</span>
        <span class="mp-date-lbl">${DATES[ni]}</span>
        ${mdrBadge}
        ${whyLabel}
      </div>
      <div class="mp-body">${dinerCols}</div>
    </div>`;
  }

  // Missed / unschedulable items
  if (missed.length) {
    const grouped = {};
    missed.forEach(m => {
      const key = m.did + '|' + m.rest;
      if (!grouped[key]) grouped[key] = {did:m.did, rest:m.rest, items:[]};
      grouped[key].items.push({cat:m.cat, item:m.item});
    });
    html += `<div class="mp-unscheduled">
      <div class="mp-unscheduled-ttl">⚠ Could not schedule all exclusive items</div>
      ${Object.values(grouped).map(g => {
        const d = DINERS.find(x=>x.id===g.did);
        const r = MDR.find(x=>x.id===g.rest);
        const items = g.items.map(x=>`<span style="font-family:'Cormorant Garamond',serif;font-size:.82rem;color:var(--cream)">${x.item}</span>`).join(', ');
        return `<div class="mp-unscheduled-row">
          <span style="color:${d.c};font-weight:600;min-width:40px">${d.label}</span>
          <span style="color:${r.c}">${r.id}</span>
          <span style="opacity:.5">→</span>
          ${items}
          <span style="color:var(--muted);font-size:.65rem;opacity:.6">(visit ${r.id} more nights to schedule)</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  document.getElementById('sum-mealplan').innerHTML = html;
}

// Determine which category (s/e/d) an item belongs to given its namespace + item name
function getItemCat(ns, itemName, nightIdx){
  if (ns === 'SIG'){
    const si = sigItems(nightIdx);
    if (si.s.some(x=>x.n===itemName)) return 's';
    if (si.e.some(x=>x.n===itemName)) return 'e';
    if (si.d.some(x=>x.n===itemName)) return 'd';
  } else if (ns === 'CLS'){
    const ci = clsItems();
    if (ci.s.some(x=>(typeof x==='string'?x:x.n)===itemName)) return 's';
    if (ci.e.some(x=>(typeof x==='string'?x:x.n)===itemName)) return 'e';
    if (ci.d.some(x=>(typeof x==='string'?x:x.n)===itemName)) return 'd';
  } else {
    const ei = exclItems(ns);
    if (ei && ei.s.some(x=>x.n===itemName)) return 's';
    if (ei && ei.e.some(x=>x.n===itemName)) return 'e';
    if (ei && ei.d.some(x=>x.n===itemName)) return 'd';
  }
  return null;
}

// Best MDR exclusive restaurant for a given night (most diner-tags + stars on its exclusives)
function bestMDRForNight(nightIdx){
  const nd = S.nights[nightIdx];
  let best = null, bestScore = -1;
  MDR.forEach(r => {
    const items = exclItems(r.id);
    const allItems = [...items.s, ...items.e, ...items.d];
    const score = allItems.reduce((acc, item) => {
      const t = nd.tags[tagKey(r.id, item.n)];
      return acc + (t ? t.diners.length + (t.feat ? 1 : 0) : 0);
    }, 0);
    if (score > bestScore){ bestScore = score; best = {r, score}; }
  });
  return bestScore > 0 ? best : null;
}

// Item frequency maps: overall + per diner (counts diner-tags across all nights)
function getItemFreqs(){
  const overall = {};
  const byDiner = {};
  DINERS.forEach(d => { byDiner[d.id] = {}; });
  S.nights.forEach((nd) => {
    Object.entries(nd.tags).forEach(([k, t]) => {
      if (!t.diners.length) return;
      const item = k.split('||')[1];
      overall[item] = (overall[item]||0) + t.diners.length;
      t.diners.forEach(did => {
        if (byDiner[did]) byDiner[did][item] = (byDiner[did][item]||0) + 1;
      });
    });
  });
  return {overall, byDiner};
}

// Build top-N bar-chart HTML for an item-frequency map
function topItemsHtml(freqMap, color, n){
  const sorted = Object.entries(freqMap).sort((a,b)=>b[1]-a[1]).slice(0, n);
  if (!sorted.length) return '<div style="color:var(--muted);font-size:.72rem;padding:4px 0">No tagged items yet.</div>';
  const max = sorted[0][1];
  return sorted.map(([name, cnt]) =>
    `<div class="ti-row">
      <span class="ti-name" title="${name}">${name}</span>
      <div class="ti-bar-wrap"><div class="ti-bar" style="width:${(cnt/max*100).toFixed(0)}%;background:${color}"></div></div>
      <span class="ti-val">${cnt}</span>
    </div>`
  ).join('');
}


// ══════════════════════════════════════════════════════
// SUMMARY VIEW
// ══════════════════════════════════════════════════════
function renderSummary(){
  renderMealPlan();

  // ── 1. Schedule grid ──
  document.getElementById('sum-grid').innerHTML = Array.from({length:10},(_,i) => {
    const nd     = S.nights[i];
    const v      = nd.dining ? vById(nd.dining) : null;
    const isSpc  = nd.dining && vType(nd.dining)==='spc';
    const allT   = Object.entries(nd.tags).filter(([,t]) => t.diners.length>0||t.feat);
    const feats  = allT.filter(([,t]) => t.feat).map(([k]) => k.split('||')[1]);
    const totalT = allT.filter(([,t]) => t.diners.length>0).reduce((s,[,t]) => s+t.diners.length, 0);
    const vLabel = v ? (isSpc ? '★ Specialty' : v.id) : 'Undecided';
    const vColor = v ? v.c : 'var(--muted)';

    const best = bestMDRForNight(i);
    const bestHtml = best
      ? `<span style="font-size:.68rem;font-weight:700;letter-spacing:.4px;padding:2px 7px;border-radius:3px;background:${best.r.c}22;color:${best.r.c}">${best.r.id} <span style="opacity:.55;font-weight:400">${best.score}pt</span></span>`
      : `<span style="color:var(--muted);font-size:.68rem;opacity:.4">—</span>`;

    return `<div class="ov-row" onclick="selectNight(${i});setView('plan')">
      <div class="ov-night">Night ${i+1}</div>
      <div class="ov-date">${DATES[i]}</div>
      <div><span class="ov-venue" style="background:${vColor}22;color:${vColor}">${vLabel}</span></div>
      <div>${bestHtml}</div>
      <div class="ov-feats">${feats.length ? feats.map(f=>'⭐ '+f).join(' · ') : '<span style="color:var(--muted);opacity:.4">—</span>'}</div>
      <div class="ov-meta">${totalT ? totalT+' ✓' : ''}</div>
    </div>`;
  }).join('');

  // ── 2. Featured items — deduped by item name ──
  const featMap = {}; // itemName → {src, nights:[]}
  S.nights.forEach((nd,i) => {
    Object.entries(nd.tags).filter(([,t])=>t.feat).forEach(([k]) => {
      const [ns, item] = k.split('||');
      const src = ns==='SIG'?'Signatures':ns==='CLS'?'Classics':ns;
      if (!featMap[item]) featMap[item] = {src, nights:[]};
      featMap[item].nights.push(i);
    });
  });
  const featEntries = Object.entries(featMap).sort((a,b)=>a[0].localeCompare(b[0],'en',{sensitivity:'base'}));
  document.getElementById('sum-feat').innerHTML = featEntries.length
    ? featEntries.map(([item, {src, nights}]) => {
        const c = src==='Signatures'?'var(--sig)':src==='Classics'?'var(--cls)':(MDR.find(r=>r.id===src)||{c:'var(--excl)'}).c;
        const nightLabels = nights.map(n=>`<span onclick="selectNight(${n});setView('plan')" style="cursor:pointer;padding:1px 5px;border-radius:3px;background:${c}22;color:${c};font-size:.62rem;font-weight:600" title="Jump to Night ${n+1}">N${n+1}</span>`).join(' ');
        return '<div class="fi">'
          +'<span class="fi-i">⭐ '+item+'</span>'
          +'<span class="fi-r" style="color:'+c+'">'+src+'</span>'
          +'<div style="display:flex;gap:3px;flex-wrap:wrap">'+nightLabels+'</div>'
          +'</div>';
      }).join('')
    : '<p style="color:var(--muted);font-size:11px;padding:6px 0">No starred items yet.</p>';

  // ── 3. Selections per person per category ──
  const perDiner = {};
  DINERS.forEach(d => { perDiner[d.id] = {s:0, e:0, d:0}; });
  S.nights.forEach((nd, nightIdx) => {
    Object.entries(nd.tags).forEach(([k, t]) => {
      if (!t.diners.length) return;
      const [ns, itemName] = k.split('||');
      const cat = getItemCat(ns, itemName, nightIdx);
      if (!cat) return;
      t.diners.forEach(did => { if (perDiner[did]) perDiner[did][cat]++; });
    });
  });

  let cppHtml = `<table class="cpp-table">
    <thead><tr>
      <th>Person</th>
      <th>🥗 Starters</th>
      <th>🍽 Entrées</th>
      <th>🍮 Desserts</th>
      <th>Total</th>
    </tr></thead><tbody>`;
  DINERS.forEach(d => {
    const c   = perDiner[d.id];
    const tot = c.s + c.e + c.d;
    const cell = (v) => v > 0
      ? `<span class="cpp-num" style="color:${d.c}">${v}</span>`
      : `<span class="cpp-zero">—</span>`;
    cppHtml += `<tr>
      <td style="font-weight:600;color:${d.c}">${d.label}</td>
      <td>${cell(c.s)}</td>
      <td>${cell(c.e)}</td>
      <td>${cell(c.d)}</td>
      <td>${tot > 0 ? `<span class="cpp-num" style="color:var(--gold)">${tot}</span>` : '<span class="cpp-zero">—</span>'}</td>
    </tr>`;
  });
  // Totals row
  const totS = DINERS.reduce((s,d)=>s+perDiner[d.id].s,0);
  const totE = DINERS.reduce((s,d)=>s+perDiner[d.id].e,0);
  const totD = DINERS.reduce((s,d)=>s+perDiner[d.id].d,0);
  cppHtml += `<tr style="border-top:2px solid var(--border)">
    <td style="color:var(--muted);font-size:.65rem;letter-spacing:1px;text-transform:uppercase">All</td>
    <td><span class="cpp-num" style="color:var(--muted)">${totS||'—'}</span></td>
    <td><span class="cpp-num" style="color:var(--muted)">${totE||'—'}</span></td>
    <td><span class="cpp-num" style="color:var(--muted)">${totD||'—'}</span></td>
    <td><span class="cpp-num" style="color:var(--muted)">${(totS+totE+totD)||'—'}</span></td>
  </tr>`;
  cppHtml += '</tbody></table>';
  document.getElementById('sum-catperson').innerHTML = `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;overflow:hidden;padding:4px 0">${cppHtml}</div>`;

  // ── 4. Stats ──
  const vC={};ALL_V.forEach(v=>{vC[v.id]=0;});
  S.nights.forEach(nd=>{if(nd.dining)vC[nd.dining]=(vC[nd.dining]||0)+1;});
  const maxV=Math.max(...Object.values(vC),1);
  const dC={};DINERS.forEach(d=>{dC[d.id]=0;});
  S.nights.forEach(nd=>{Object.values(nd.tags).forEach(t=>t.diners.forEach(d=>{dC[d]=(dC[d]||0)+1;}));});
  const maxD=Math.max(...Object.values(dC),1);
  const sigT  = S.nights.reduce((s,nd)=>s+Object.keys(nd.tags).filter(k=>k.startsWith('SIG||')).reduce((a,k)=>a+nd.tags[k].diners.length,0),0);
  const exclT = S.nights.reduce((s,nd)=>s+Object.keys(nd.tags).filter(k=>MDR.some(r=>k.startsWith(r.id+'||'))).reduce((a,k)=>a+nd.tags[k].diners.length,0),0);
  const clsT  = S.nights.reduce((s,nd)=>s+Object.keys(nd.tags).filter(k=>k.startsWith('CLS||')).reduce((a,k)=>a+nd.tags[k].diners.length,0),0);

  const {overall: freqAll, byDiner: freqByDiner} = getItemFreqs();

  const barRow = (label, color, val, max) =>
    `<div class="str"><span class="stn" style="color:${color}">${label}</span><div class="stbw"><div class="stb" style="width:${(val/max*100).toFixed(0)}%;background:${color}"></div></div><span class="stv">${val}</span></div>`;

  document.getElementById('sum-stats').innerHTML =
    // Venue schedule
    '<div class="stc"><div class="stl">Venue Schedule</div>'
    + MDR.map(r=>barRow(r.id,r.c,vC[r.id],maxV)).join('')
    + [...BUFFET,...SPECIALTY].filter(v=>vC[v.id]>0).map(v=>barRow(v.id,v.c,vC[v.id],maxV)).join('')
    + '</div>'
    // Tags per diner
    + '<div class="stc"><div class="stl">Tags Per Diner</div>'
    + DINERS.map(d=>barRow(d.label,d.c,dC[d.id],maxD)).join('')
    + '</div>'
    // Tags by menu type
    + '<div class="stc"><div class="stl">Tags by Menu Type</div>'
    + [['Signatures','var(--sig)',sigT],['Exclusives','var(--excl)',exclT],['Classics','var(--cls)',clsT]].map(x=>{
        const mx=Math.max(sigT,exclT,clsT,1);
        return barRow(x[0],x[1],x[2],mx);
      }).join('')
    + '</div>'
    // Top items overall
    + '<div class="stc"><div class="stl">🏆 Top Items — Overall</div>'
    + topItemsHtml(freqAll,'var(--gold)',10)
    + '</div>'
    // Top items per diner
    + DINERS.map(d =>
        '<div class="stc"><div class="stl" style="color:'+d.c+'">🏆 Top Items — '+d.label+'</div>'
        + topItemsHtml(freqByDiner[d.id], d.c, 8)
        + '</div>'
      ).join('');
}

// ══════════════════════════════════════════════════════
// VIEW SWITCHER
// ══════════════════════════════════════════════════════
function setView(v){
  document.getElementById('v-plan').style.display = v==='plan' ? '' : 'none';
  document.getElementById('v-sum').style.display  = v==='sum'  ? 'block' : 'none';
  document.querySelectorAll('.vtab').forEach(b =>
    b.classList.toggle('on', (v==='plan'&&b.textContent.includes('Planner'))||(v==='sum'&&b.textContent.includes('Overview')))
  );
  if (v==='sum') renderSummary();
}

// ══════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════
let _tt = null;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('show'), 2600);
}

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
render();
// ══════════════════════════════════════════════════════
// EXPOSE TO GLOBAL SCOPE (required for inline onclick handlers
// when app.js is loaded as type="module")
// ══════════════════════════════════════════════════════
window.selectNight = selectNight;
window.toggleDiner = toggleDiner;
window.toggleFeat = toggleFeat;
window.setVenue = setVenue;
window.setSpecialty = setSpecialty;
window.clearVenue = clearVenue;
window.toggleSec = toggleSec;
window.toggleAddMode = toggleAddMode;
window.scrollToSec = scrollToSec;
window.openMo = openMo;
window.closeMo = closeMo;
window.doImportText = doImportText;
window.handleFileImp = handleFileImp;
window.doExport = doExport;
window.exportDefaultSig = exportDefaultSig;
window.setView = setView;
window.addSigItem = addSigItem;
window.delSig = delSig;
window.copySigToAll = copySigToAll;
window.addExclItem = addExclItem;
window.delExcl = delExcl;
window.addClsItem = addClsItem;
window.delCls = delCls;
window.handleSigKey = handleSigKey;
window.handleExclKey = handleExclKey;
window.handleClsKey = handleClsKey;
window.toast = toast;

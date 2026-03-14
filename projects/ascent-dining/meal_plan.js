// ══════════════════════════════════════════════════════
// meal_plan.js
// Smart meal-plan algorithm + Overview / Summary renders.
//
// Imports: data.js, app.js
// Exported surface: renderSummary (called by setView in interaction.js)
// ══════════════════════════════════════════════════════

import { DINERS, MDR, BUFFET, SPECIALTY, ALL_V, DATES } from './data.js';
import {
  S, sigItems, exclItems, clsItems, tagKey, vById, vType
} from './app.js';

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

/**
 * Given a namespace + item name, return its meal category: 's' | 'e' | 'd' | null.
 * nightIdx is only needed for SIG (menu varies per night).
 */
export function getItemCat(ns, itemName, nightIdx) {
  if (ns === 'SIG') {
    const si = sigItems(nightIdx);
    if (si.s.some(x => x.n === itemName)) return 's';
    if (si.e.some(x => x.n === itemName)) return 'e';
    if (si.d.some(x => x.n === itemName)) return 'd';
  } else if (ns === 'CLS') {
    const ci = clsItems();
    if (ci.s.some(x => (typeof x === 'string' ? x : x.n) === itemName)) return 's';
    if (ci.e.some(x => (typeof x === 'string' ? x : x.n) === itemName)) return 'e';
    if (ci.d.some(x => (typeof x === 'string' ? x : x.n) === itemName)) return 'd';
  } else {
    const ei = exclItems(ns);
    if (ei && ei.s.some(x => x.n === itemName)) return 's';
    if (ei && ei.e.some(x => x.n === itemName)) return 'e';
    if (ei && ei.d.some(x => x.n === itemName)) return 'd';
  }
  return null;
}

/**
 * Returns the MDR with the most diner-tags + stars for a given night,
 * or null if nothing is tagged.
 */
export function bestMDRForNight(nightIdx) {
  const nd = S.nights[nightIdx];
  let best = null, bestScore = -1;
  MDR.forEach(r => {
    const items    = exclItems(r.id);
    const allItems = [...items.s, ...items.e, ...items.d];
    const score    = allItems.reduce((acc, item) => {
      const t = nd.tags[tagKey(r.id, item.n)];
      return acc + (t ? t.diners.length + (t.feat ? 1 : 0) : 0);
    }, 0);
    if (score > bestScore) { bestScore = score; best = { r, score }; }
  });
  return bestScore > 0 ? best : null;
}

/** Item frequency counts: overall and broken down per diner. */
export function getItemFreqs() {
  const overall = {};
  const byDiner = {};
  DINERS.forEach(d => { byDiner[d.id] = {}; });
  S.nights.forEach(nd => {
    Object.entries(nd.tags).forEach(([k, t]) => {
      if (!t.diners.length) return;
      const item = k.split('||')[1];
      overall[item] = (overall[item] || 0) + t.diners.length;
      t.diners.forEach(did => {
        if (byDiner[did]) byDiner[did][item] = (byDiner[did][item] || 0) + 1;
      });
    });
  });
  return { overall, byDiner };
}

/** Horizontal bar-chart HTML for top-N items from a frequency map. */
export function topItemsHtml(freqMap, color, n) {
  const sorted = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, n);
  if (!sorted.length)
    return '<div style="color:var(--muted);font-size:.72rem;padding:4px 0">No tagged items yet.</div>';
  const max = sorted[0][1];
  return sorted.map(([name, cnt]) =>
    `<div class="ti-row">
      <span class="ti-name" title="${name}">${name}</span>
      <div class="ti-bar-wrap"><div class="ti-bar" style="width:${(cnt / max * 100).toFixed(0)}%;background:${color}"></div></div>
      <span class="ti-val">${cnt}</span>
    </div>`
  ).join('');
}

// ══════════════════════════════════════════════════════
// SMART MEAL-PLAN ALGORITHM
// ══════════════════════════════════════════════════════
/*
  Priority per diner per night per category:
    1. Signature  — night-specific, highest priority ("one and gone")
    2. Exclusive  — MDR-specific; scheduled to a night where the group visits that MDR
    3. Classic    — always available; fills any remaining gaps

  MDR assignment:
    - Hard lock: user already chose a venue via the venue bar
    - Coverage pass: every MDR with any diner demand gets ≥1 visit
    - Greedy fill: remaining nights take the highest-scoring MDR
    - Multi-visit rotation: each subsequent visit serves the NEXT desired item
*/
export function computeMealPlan() {
  const CATS = ['s', 'e', 'd'];

  // sigByNight[ni][did][cat] = first tagged item name | null
  const sigByNight = Array.from({ length: 10 }, () => {
    const o = {};
    DINERS.forEach(d => { o[d.id] = { s: null, e: null, d: null }; });
    return o;
  });

  // exclWanted[did][restId][cat] = [item, ...] — union across all nights
  const exclWanted = {};
  DINERS.forEach(d => {
    exclWanted[d.id] = {};
    MDR.forEach(r => { exclWanted[d.id][r.id] = { s: [], e: [], d: [] }; });
  });

  // clsWanted[did][cat] = [item, ...]
  const clsWanted = {};
  DINERS.forEach(d => { clsWanted[d.id] = { s: [], e: [], d: [] }; });

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

  // Initialise meal slots with locked Signature items
  const slot = Array.from({ length: 10 }, (_, ni) => {
    const s = {};
    DINERS.forEach(d => {
      s[d.id] = {
        s: sigByNight[ni][d.id].s ? { item: sigByNight[ni][d.id].s, source: 'sig' } : null,
        e: sigByNight[ni][d.id].e ? { item: sigByNight[ni][d.id].e, source: 'sig' } : null,
        d: sigByNight[ni][d.id].d ? { item: sigByNight[ni][d.id].d, source: 'sig' } : null,
      };
    });
    return s;
  });

  // How many open diner×cat slots would this MDR fill on night ni?
  function exclScore(ni, restId) {
    let sc = 0;
    DINERS.forEach(d => {
      CATS.forEach(cat => {
        if (!slot[ni][d.id][cat] && exclWanted[d.id][restId][cat].length > 0) sc++;
      });
    });
    return sc;
  }

  // chosenMDR[ni] = restId | null — start from user selections
  const chosenMDR = S.nights.map(nd =>
    (nd.dining && MDR.find(r => r.id === nd.dining)) ? nd.dining : null
  );
  const userSet = chosenMDR.map(v => v !== null);

  const free = () => Array.from({ length: 10 }, (_, i) => i).filter(ni => !chosenMDR[ni]);

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
    if (bestNi < 0 && free().length) bestNi = free()[0];
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

  // Fill exclusive items — rotate through each diner's list on multi-visits
  const exclIdx = {};
  DINERS.forEach(d => {
    exclIdx[d.id] = {};
    MDR.forEach(r => { exclIdx[d.id][r.id] = { s: 0, e: 0, d: 0 }; });
  });
  for (let ni = 0; ni < 10; ni++) {
    const rest = chosenMDR[ni]; if (!rest) continue;
    DINERS.forEach(d => {
      CATS.forEach(cat => {
        if (slot[ni][d.id][cat]) return;
        const wants = exclWanted[d.id][rest][cat];
        const idx   = exclIdx[d.id][rest][cat];
        if (idx < wants.length) {
          slot[ni][d.id][cat] = { item: wants[idx], source: 'excl', rest };
          exclIdx[d.id][rest][cat]++;
        }
      });
    });
  }

  // Fill remaining gaps with Classics
  for (let ni = 0; ni < 10; ni++) {
    DINERS.forEach(d => {
      CATS.forEach(cat => {
        if (slot[ni][d.id][cat]) return;
        const wants = clsWanted[d.id][cat];
        if (wants.length) slot[ni][d.id][cat] = { item: wants[0], source: 'cls' };
      });
    });
  }

  // Collect items that could never be scheduled
  const missed = [];
  DINERS.forEach(d => {
    MDR.forEach(r => {
      CATS.forEach(cat => {
        exclWanted[d.id][r.id][cat].forEach(item => {
          const got = Array.from({ length: 10 }, (_, ni) => ni).some(ni => {
            const sl = slot[ni][d.id][cat];
            return sl && sl.source === 'excl' && sl.item === item;
          });
          if (!got) missed.push({ did: d.id, rest: r.id, cat, item });
        });
      });
    });
  });

  // Human-readable "why" label per night
  const why = Array.from({ length: 10 }, (_, ni) => {
    const rest = chosenMDR[ni]; if (!rest) return '';
    const filledCount = DINERS.reduce((tot, d) =>
      tot + CATS.filter(c => slot[ni][d.id][c]?.source === 'excl').length, 0);
    const sigCount = DINERS.reduce((tot, d) =>
      tot + CATS.filter(c => slot[ni][d.id][c]?.source === 'sig').length, 0);
    const parts = [];
    if (filledCount) parts.push(`${filledCount} excl`);
    if (sigCount)    parts.push(`${sigCount} sig`);
    return parts.join(' · ');
  });

  return { slot, chosenMDR, userSet, missed, why };
}

// ══════════════════════════════════════════════════════
// RENDER MEAL PLAN CARDS
// ══════════════════════════════════════════════════════
function renderMealPlan() {
  const anyTagged = S.nights.some(nd =>
    Object.values(nd.tags).some(t => t.diners.length > 0)
  );
  if (!anyTagged) {
    document.getElementById('sum-mealplan').innerHTML =
      '<p style="color:var(--muted);font-size:.8rem;padding:4px 0">Tag menu items in the Planner first — the meal plan will appear here.</p>';
    return;
  }

  const { slot, chosenMDR, userSet, missed, why } = computeMealPlan();
  const SRC_C   = { sig: 'var(--sig)', excl: 'var(--excl)', cls: 'var(--cls)' };
  const SRC_LBL = { sig: 'SIG', excl: 'MDR', cls: 'CLS' };
  const COURSE_ICO = { s: '🥗', e: '🍽', d: '🍮' };

  let html = `<div class="mp-legend">
    <span style="font-size:.65rem;color:var(--muted);letter-spacing:1px;text-transform:uppercase">Key:</span>
    <span class="mp-leg-item"><span class="mp-leg-dot" style="background:var(--sig)"></span>Signature — rotating, night-specific</span>
    <span class="mp-leg-item"><span class="mp-leg-dot" style="background:var(--excl)"></span>Exclusive — MDR fixed menu</span>
    <span class="mp-leg-item"><span class="mp-leg-dot" style="background:var(--cls)"></span>Classic — always available</span>
  </div>`;

  for (let ni = 0; ni < 10; ni++) {
    const rest    = chosenMDR[ni];
    const restObj = rest ? MDR.find(r => r.id === rest) : null;

    const mdrBadge = restObj
      ? `<span class="mp-mdr-badge" style="background:${restObj.c}22;color:${restObj.c}">
           ${restObj.id}<span class="mp-mdr-hint">${userSet[ni] ? '✓ your pick' : '⟵ suggested'}</span>
         </span>`
      : `<span class="mp-mdr-badge" style="background:rgba(255,255,255,0.06);color:var(--muted)">No MDR</span>`;

    const dinerCols = DINERS.map(d => {
      const courses = ['s', 'e', 'd'].map(cat => {
        const sl = slot[ni][d.id][cat];
        if (!sl)
          return `<div class="mp-course"><span class="mp-ico">${COURSE_ICO[cat]}</span><span class="mp-empty">—</span></div>`;
        const sc = SRC_C[sl.source];
        return `<div class="mp-course">
          <span class="mp-ico">${COURSE_ICO[cat]}</span>
          <span class="mp-item" style="color:${sc}" title="${SRC_LBL[sl.source]}: ${sl.item}">${sl.item}</span>
          <span class="mp-src" style="background:${sc}22;color:${sc}">${SRC_LBL[sl.source]}</span>
        </div>`;
      }).join('');
      return `<div class="mp-diner-col">
        <div class="mp-diner-name" style="color:${d.c}">${d.label}</div>
        ${courses}
      </div>`;
    }).join('');

    html += `<div class="mp-card">
      <div class="mp-hdr">
        <span class="mp-night-lbl">Night ${ni + 1}</span>
        <span class="mp-date-lbl">${DATES[ni]}</span>
        ${mdrBadge}
        ${why[ni] ? `<span class="mp-score">${why[ni]}</span>` : ''}
      </div>
      <div class="mp-body">${dinerCols}</div>
    </div>`;
  }

  if (missed.length) {
    const grouped = {};
    missed.forEach(m => {
      const key = m.did + '|' + m.rest;
      if (!grouped[key]) grouped[key] = { did: m.did, rest: m.rest, items: [] };
      grouped[key].items.push({ cat: m.cat, item: m.item });
    });
    html += `<div class="mp-unscheduled">
      <div class="mp-unscheduled-ttl">⚠ Could not schedule all exclusive items</div>
      ${Object.values(grouped).map(g => {
        const d     = DINERS.find(x => x.id === g.did);
        const r     = MDR.find(x => x.id === g.rest);
        const items = g.items.map(x =>
          `<span style="font-family:'Cormorant Garamond',serif;font-size:.82rem;color:var(--cream)">${x.item}</span>`
        ).join(', ');
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

// ══════════════════════════════════════════════════════
// RENDER FULL SUMMARY / OVERVIEW VIEW
// ══════════════════════════════════════════════════════
export function renderSummary() {
  renderMealPlan();

  // ── 1. Schedule grid ──────────────────────────────
  document.getElementById('sum-grid').innerHTML = Array.from({ length: 10 }, (_, i) => {
    const nd    = S.nights[i];
    const v     = nd.dining ? vById(nd.dining) : null;
    const isSpc = nd.dining && vType(nd.dining) === 'spc';
    const allT  = Object.entries(nd.tags).filter(([, t]) => t.diners.length > 0 || t.feat);
    const feats = allT.filter(([, t]) => t.feat).map(([k]) => k.split('||')[1]);
    const totalT = allT.filter(([, t]) => t.diners.length > 0).reduce((s, [, t]) => s + t.diners.length, 0);
    const vLabel = v ? (isSpc ? '★ Specialty' : v.id) : 'Undecided';
    const vColor = v ? v.c : 'var(--muted)';
    const best   = bestMDRForNight(i);
    const bestHtml = best
      ? `<span style="font-size:.68rem;font-weight:700;letter-spacing:.4px;padding:2px 7px;border-radius:3px;background:${best.r.c}22;color:${best.r.c}">${best.r.id} <span style="opacity:.55;font-weight:400">${best.score}pt</span></span>`
      : `<span style="color:var(--muted);font-size:.68rem;opacity:.4">—</span>`;

    return `<div class="ov-row" onclick="selectNight(${i});setView('plan')">
      <div class="ov-night">Night ${i + 1}</div>
      <div class="ov-date">${DATES[i]}</div>
      <div><span class="ov-venue" style="background:${vColor}22;color:${vColor}">${vLabel}</span></div>
      <div>${bestHtml}</div>
      <div class="ov-feats">${feats.length ? feats.map(f => '⭐ ' + f).join(' · ') : '<span style="color:var(--muted);opacity:.4">—</span>'}</div>
      <div class="ov-meta">${totalT ? totalT + ' ✓' : ''}</div>
    </div>`;
  }).join('');

  // ── 2. Featured items (deduped by item name) ──────
  const featMap = {};
  S.nights.forEach((nd, i) => {
    Object.entries(nd.tags).filter(([, t]) => t.feat).forEach(([k]) => {
      const [ns, item] = k.split('||');
      const src = ns === 'SIG' ? 'Signatures' : ns === 'CLS' ? 'Classics' : ns;
      if (!featMap[item]) featMap[item] = { src, nights: [] };
      featMap[item].nights.push(i);
    });
  });
  const featEntries = Object.entries(featMap)
    .sort((a, b) => a[0].localeCompare(b[0], 'en', { sensitivity: 'base' }));
  document.getElementById('sum-feat').innerHTML = featEntries.length
    ? featEntries.map(([item, { src, nights }]) => {
        const c = src === 'Signatures' ? 'var(--sig)'
                : src === 'Classics'   ? 'var(--cls)'
                : (MDR.find(r => r.id === src) || { c: 'var(--excl)' }).c;
        const nightLabels = nights.map(n =>
          `<span onclick="selectNight(${n});setView('plan')"
            style="cursor:pointer;padding:1px 5px;border-radius:3px;background:${c}22;color:${c};font-size:.62rem;font-weight:600"
            title="Jump to Night ${n + 1}">N${n + 1}</span>`
        ).join(' ');
        return '<div class="fi">'
          + `<span class="fi-i">⭐ ${item}</span>`
          + `<span class="fi-r" style="color:${c}">${src}</span>`
          + `<div style="display:flex;gap:3px;flex-wrap:wrap">${nightLabels}</div>`
          + '</div>';
      }).join('')
    : '<p style="color:var(--muted);font-size:11px;padding:6px 0">No starred items yet.</p>';

  // ── 3. Selections per person per category ─────────
  const perDiner = {};
  DINERS.forEach(d => { perDiner[d.id] = { s: 0, e: 0, d: 0 }; });
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
      <th>Person</th><th>🥗 Starters</th><th>🍽 Entrées</th><th>🍮 Desserts</th><th>Total</th>
    </tr></thead><tbody>`;
  DINERS.forEach(d => {
    const c   = perDiner[d.id];
    const tot = c.s + c.e + c.d;
    const cell = v => v > 0
      ? `<span class="cpp-num" style="color:${d.c}">${v}</span>`
      : `<span class="cpp-zero">—</span>`;
    cppHtml += `<tr>
      <td style="font-weight:600;color:${d.c}">${d.label}</td>
      <td>${cell(c.s)}</td><td>${cell(c.e)}</td><td>${cell(c.d)}</td>
      <td>${tot > 0 ? `<span class="cpp-num" style="color:var(--gold)">${tot}</span>` : '<span class="cpp-zero">—</span>'}</td>
    </tr>`;
  });
  const totS = DINERS.reduce((s, d) => s + perDiner[d.id].s, 0);
  const totE = DINERS.reduce((s, d) => s + perDiner[d.id].e, 0);
  const totD = DINERS.reduce((s, d) => s + perDiner[d.id].d, 0);
  cppHtml += `<tr style="border-top:2px solid var(--border)">
    <td style="color:var(--muted);font-size:.65rem;letter-spacing:1px;text-transform:uppercase">All</td>
    <td><span class="cpp-num" style="color:var(--muted)">${totS || '—'}</span></td>
    <td><span class="cpp-num" style="color:var(--muted)">${totE || '—'}</span></td>
    <td><span class="cpp-num" style="color:var(--muted)">${totD || '—'}</span></td>
    <td><span class="cpp-num" style="color:var(--muted)">${(totS + totE + totD) || '—'}</span></td>
  </tr></tbody></table>`;
  document.getElementById('sum-catperson').innerHTML =
    `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;overflow:hidden;padding:4px 0">${cppHtml}</div>`;

  // ── 4. Stats ──────────────────────────────────────
  const vC = {};
  ALL_V.forEach(v => { vC[v.id] = 0; });
  S.nights.forEach(nd => { if (nd.dining) vC[nd.dining] = (vC[nd.dining] || 0) + 1; });
  const maxV = Math.max(...Object.values(vC), 1);

  const dC = {};
  DINERS.forEach(d => { dC[d.id] = 0; });
  S.nights.forEach(nd => {
    Object.values(nd.tags).forEach(t => t.diners.forEach(d => { dC[d] = (dC[d] || 0) + 1; }));
  });
  const maxD = Math.max(...Object.values(dC), 1);

  const sigT  = S.nights.reduce((s, nd) =>
    s + Object.keys(nd.tags).filter(k => k.startsWith('SIG||'))
      .reduce((a, k) => a + nd.tags[k].diners.length, 0), 0);
  const exclT = S.nights.reduce((s, nd) =>
    s + Object.keys(nd.tags).filter(k => MDR.some(r => k.startsWith(r.id + '||')))
      .reduce((a, k) => a + nd.tags[k].diners.length, 0), 0);
  const clsT  = S.nights.reduce((s, nd) =>
    s + Object.keys(nd.tags).filter(k => k.startsWith('CLS||'))
      .reduce((a, k) => a + nd.tags[k].diners.length, 0), 0);

  const { overall: freqAll, byDiner: freqByDiner } = getItemFreqs();

  const barRow = (label, color, val, max) =>
    `<div class="str">
      <span class="stn" style="color:${color}">${label}</span>
      <div class="stbw"><div class="stb" style="width:${(val / max * 100).toFixed(0)}%;background:${color}"></div></div>
      <span class="stv">${val}</span>
    </div>`;

  document.getElementById('sum-stats').innerHTML =
    '<div class="stc"><div class="stl">Venue Schedule</div>'
      + MDR.map(r => barRow(r.id, r.c, vC[r.id], maxV)).join('')
      + [...BUFFET, ...SPECIALTY].filter(v => vC[v.id] > 0).map(v => barRow(v.id, v.c, vC[v.id], maxV)).join('')
    + '</div>'
    + '<div class="stc"><div class="stl">Tags Per Diner</div>'
      + DINERS.map(d => barRow(d.label, d.c, dC[d.id], maxD)).join('')
    + '</div>'
    + '<div class="stc"><div class="stl">Tags by Menu Type</div>'
      + [['Signatures', 'var(--sig)', sigT], ['Exclusives', 'var(--excl)', exclT], ['Classics', 'var(--cls)', clsT]]
          .map(([l, c, v]) => barRow(l, c, v, Math.max(sigT, exclT, clsT, 1))).join('')
    + '</div>'
    + '<div class="stc"><div class="stl">🏆 Top Items — Overall</div>'
      + topItemsHtml(freqAll, 'var(--gold)', 10)
    + '</div>'
    + DINERS.map(d =>
        '<div class="stc"><div class="stl" style="color:' + d.c + '">🏆 Top Items — ' + d.label + '</div>'
        + topItemsHtml(freqByDiner[d.id], d.c, 8)
        + '</div>'
      ).join('');
}

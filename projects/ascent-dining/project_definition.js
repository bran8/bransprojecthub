// project_definition.js
// High-level contract for the Celebrity Planner app.
// Use this as a reference when editing meal_plan.js in isolation.

// ───────────────────────────────────────────────────────
// IMPORT SURFACES
// ───────────────────────────────────────────────────────

// From data.js
//
// DINERS: [{ id, label, s, c }]
//   - id: stable string key per person (e.g. 'me', 'wife')
//   - label: display name
//   - s: short label (1–3 chars)
//   - c: hex color (used for pills / borders)
// MDR:      [{ id, short, c }]  // 4 MDR restaurants
// BUFFET:   [{ id, short, c }]
// SPECIALTY:[{ id, c }]
// ALL_V:    MDR + BUFFET + SPECIALTY
// DATES:    ['Mar 16', 'Mar 17', ...] // length matches number of nights
//
// BASE_EXCL, BASE_CLS, DEFAULT_SIG, CAT_LBL, CAT_ICO also exist
// but meal_plan.js accesses them only indirectly via app.js helpers.

// From app.js
//
// State shape:
//   S = {
//     currentNight: number,
//     nights: Array<{
//       dining: string | null,          // venue id or null
//       tags: { [tagKey: string]: {    // per-night item tags
//         diners: string[],            // array of DINERS ids
//         feat: boolean                // starred item
//       }},
//       sigCustom: { s: Item[], e: Item[], d: Item[] }
//     }>,
//     exclCustom: { [restId||cat: string]: Item[] },
//     clsCustom: { s: (Item | string)[], e: (Item | string)[], d: (Item | string)[] }
//   }
//
// Item type:
//   Item = { n: string, v: number }
//
// Helper functions used by meal_plan.js:
//
// sigItems(nightIdx:number) => { s: Item[], e: Item[], d: Item[] }
//   - Returns base signatures for that night merged with sigCustom.
//
// exclItems(restId:string) => { s: Item[], e: Item[], d: Item[] }
//   - Returns MDR Exclusives base + S.exclCustom for that restaurant id.
//
// clsItems() => { s: (Item | string)[], e: (Item | string)[], d: (Item | string)[] }
//   - Returns Celebrity Classics base + S.clsCustom.
//
// tagKey(ns:string, itemName:string) => string
//   - Returns a stable key used in S.nights[n].tags; format is:
//       `${ns}||${itemName}`
//   - ns is 'SIG', 'CLS', or a venue id (MDR/Buffet/Specialty).
//
// vById(id:string) => { id, short?, c }
//   - Looks up a venue by id from ALL_V.
//   - If not found, returns a fallback { id, short: id.toUpperCase().slice(0, 6), c:'#7a8fa8' }.
//
// vType(id:string) => 'mdr' | 'buf' | 'spc' | '?'
//   - Returns venue category; used for CSS class decisions.

// ───────────────────────────────────────────────────────
// DOM + CSS CONTRACTS
// ───────────────────────────────────────────────────────
//
// Meal-plan summary view is rendered into elements that already
// exist in index-2.html and styled via styles.css.
//
// Key classes from styles.css used by meal_plan.js output:
//
//   .mp-legend
//   .mp-leg-item
//   .mp-leg-dot
//   .mp-card
//   .mp-hdr
//   .mp-night-lbl
//   .mp-date-lbl
//   .mp-mdr-badge
//   .mp-mdr-hint
//   .mp-score
//   .mp-body
//   .mp-diner-col
//   .mp-diner-name
//   .mp-course
//   .mp-ico
//   .mp-item
//   .mp-src
//   .mp-empty
//   .mp-unscheduled
//   .mp-unscheduled-ttl
//   .mp-unscheduled-row
//
// Color variables (CSS custom properties):
//   var(--sig)   // Signatures
//   var(--excl)  // MDR Exclusives
//   var(--cls)   // Classics
//   var(--spc)   // Specialty
//   var(--gold), var(--bg3), var(--border), etc.
//
// Rendered HTML must use these classes/variables so it “drops into”
// the existing layout without requiring CSS changes.

// ───────────────────────────────────────────────────────
// meal_plan.js PUBLIC SURFACE
// ───────────────────────────────────────────────────────
//
// This module is imported only by interaction.js as:
//
//   import { renderSummary } from './meal_plan.js';
//
// interaction.js calls renderSummary() when the user switches
// to the “Smart Meal Plan / Overview” view.
//
// The only exported function that other modules rely on is:
//
//   export function renderSummary(): void
//
// renderSummary is responsible for:
//   - Reading current S (all nights, tags, venues).
//   - Computing a “smart” plan per night and per diner.
//   - Rendering:
//       1) A legend / overview,
//       2) Per-night cards showing chosen venue and courses,
//       3) Per-person counts by course category,
//       4) Optional stats / top items panels.
//
// It must NOT:
//   - Mutate S in unexpected ways (except for harmless derived props if added).
//   - Add new global event listeners.
//   - Depend on interaction.js or ui_cosmetics.js.

// ───────────────────────────────────────────────────────
// meal_plan.js INTERNAL HELPERS (CONTRACTS)
// ───────────────────────────────────────────────────────
//
// These helpers exist (or should be treated as existing “black boxes”)
// when updating the file:
//
// getItemCat(ns:string, itemName:string, nightIdx:number) => 's' | 'e' | 'd' | null
//   - ns: 'SIG' | 'CLS' | <venue id>
//   - Looks up itemName in sigItems, clsItems, or exclItems for that
//     night/venue and returns its course category.
//
// bestMDRForNight(nightIdx:number) => { r: MDRVenue, score:number } | null
//   - Computes which MDR has the highest sum over its items of:
//       diners.length + (feat ? 1 : 0)
//   - Returns null if all scores are 0.
//
// getItemFreqs() => { overall: Record<string,number>, byDiner: Record<dinerId, Record<string,number>> }
//   - Aggregates how often each item is tagged across all nights and diners.
//
// topItemsHtml(freqMap:Record<string,number>, color:string, n:number) => string
//   - Returns HTML for a small horizontal bar-list of the top N items.
//   - If freqMap is empty, returns a short message telling the user to tag items first.
//
// computeMealPlan() => {
//   slot: Array<{
//     nightIdx: number,
//     date: string,
//     venue: { id, short?, c },
//     byDiner: {
//       [dinerId: string]: {
//         s?: { name:string, src:'sig'|'excl'|'cls' },
//         e?: { name:string, src:'sig'|'excl'|'cls' },
//         d?: { name:string, src:'sig'|'excl'|'cls' }
//       }
//     },
//     score: number
//   }>,
//   chosenMDR: Record<number, string | null>,   // winning MDR per night, if any
//   userSet: Record<number, string | null>,     // user-chosen dining venue per night
//   missed: string[],                           // optional list of “missed” items
//   why: string                                 // human-readable summary/explanation
// }
//   - Algorithm details are free to change as long as the shape above
//     remains compatible with renderSummary.
//
// Internal constants used by renderSummary:
//
//   const SRC_C = { sig:'var(--sig)', excl:'var(--excl)', cls:'var(--cls)' };
//   const SRC_LBL = { sig:'SIG', excl:'MDR', cls:'CLS' };
//   const COURSE_ICO = { s:'🥗', e:'🍽', d:'🍮' };
//
// When adding new helpers, keep them pure (no DOM) and keep all DOM
// writes localized in renderSummary (or a small number of render*
// helpers that only manipulate HTML/DOM).

// ───────────────────────────────────────────────────────
// STYLE & NAMING CONVENTIONS
// ───────────────────────────────────────────────────────
//
// - Use small, descriptive function names: getItemCat, bestMDRForNight,
//   getItemFreqs, topItemsHtml, computeMealPlan, renderSummary.
// - Keep modules side-effect free at top level: no work on import
//   except constant initialization.
// - Prefer derived data helpers over duplicating logic from app.js.
// - Always access tags via S.nights[n].tags[tagKey(ns, itemName)].
// - Treat ns strings as:
//     'SIG'  => Signatures (night-specific base + sigCustom)
//     'CLS'  => Classics
//     MDR/BUFFET/SPECIALTY id => MDR Exclusives or other venue menus.
// - When rendering, use existing CSS classes and CSS variables and avoid
//   inlining arbitrary new styles unless absolutely necessary.
//
// When in doubt, follow patterns used in app.js and interaction.js.
//
// ───────────────────────────────────────────────────────
// LLM USAGE INSTRUCTIONS (meta)
// ───────────────────────────────────────────────────────
//
// When asked to modify meal_plan.js:
//
//   1) Preserve all existing exported function signatures.
//   2) Do NOT change imports at the top unless explicitly requested;
//      rely on surfaces described above.
//   3) Use state S and helpers (sigItems, exclItems, clsItems, tagKey,
//      vById, vType) instead of re-reading raw data from data.js.
//   4) Keep all HTML output compatible with .mp-* CSS classes in styles.css.
//   5) Do not add new global DOM elements outside the summary container;
//      only populate existing containers.
//   6) Keep new helpers pure and deterministic based only on inputs and S.

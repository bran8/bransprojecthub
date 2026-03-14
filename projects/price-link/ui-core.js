// ui-core.js

import {
  getEstimate,
  getDecayWeights,
  weightedKdePeak,
  weightedMean
} from './calculator-logic.js';

// ── Globals ───────────────────────────────────────────────────────

let config;
let baseA = null, baseB = null;
let currentPct = 0;
let liveRatio = null;
let fxRate = null, fxRateSessionStart = null;
let fxSessionFetched = false;
let activeProfile = null;

// ── Helpers ───────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

function fmtA(n) { /* same as before */ }
function fmtB(n) { /* same as before */ }
function fmtDelta(n, pct) { /* same as before */ }

// ── Init ──────────────────────────────────────────────────────────

async function init() {
  // Load config
  const configEl = $('configJson');
  config = JSON.parse(configEl.textContent);

  // Dark mode, preferences, profiles...
  initDarkMode();
  loadPreferences();
  loadProfilesAndApplyActive();

  // Event listeners
  $('darkToggleBtn').addEventListener('click', toggleDarkMode);
  $('profileSelect').addEventListener('change', onProfileChange);
  $('saveProfileBtn').addEventListener('click', saveCurrentAsProfile);
  $('deleteProfileBtn').addEventListener('click', deleteActiveProfile);
  // ... add all other listeners (slider, manual inputs, buttons, etc.)

  startAutoRefresh();
}

// ── Other functions moved from original script ────────────────────
// fetchAssetA, fetchAsset, fetchFxRate, addRatioPoint, refreshStats,
// applyEstimatorToB, onSliderDrag, renderSlider, setBase, etc.

document.addEventListener('DOMContentLoaded', init);
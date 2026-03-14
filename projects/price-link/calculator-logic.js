// calculator-logic.js

// ── Pure functions ────────────────────────────────────────────────

export const mean               = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
export const stdDev             = arr => {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s,x) => s+(x-m)**2, 0) / arr.length);
};
export const median             = arr => {
  const s = [...arr].sort((a,b)=>a-b);
  const mid = Math.floor(s.length/2);
  return s.length % 2 ? s[mid] : (s[mid-1] + s[mid])/2;
};
export const binnedMode         = (arr, dp=4) => {
  const freq = {}, mult = 10**dp;
  let maxF = 0, mode = arr[0];
  for (const x of arr) {
    const k = Math.round(x * mult);
    freq[k] = (freq[k] || 0) + 1;
    if (freq[k] > maxF) { maxF = freq[k]; mode = k / mult; }
  }
  return mode;
};
export const trimmedMean        = (arr, trim=0.10) => {
  const s = [...arr].sort((a,b)=>a-b);
  const cut = Math.max(1, Math.floor(s.length * trim));
  const t = s.slice(cut, s.length - cut);
  return t.length ? mean(t) : mean(arr);
};
export const kdePeak            = (arr, steps=900) => {
  if (arr.length < 2) return arr[0] ?? null;
  const sd = stdDev(arr) || 1e-9;
  const h  = 1.06 * sd * (arr.length ** -0.2);
  const mn = Math.min(...arr), mx = Math.max(...arr);
  const range = mx - mn; if (range < 1e-12) return mn;
  let maxD = -1, peak = mn;
  for (let i = 0; i <= steps; i++) {
    const x = mn + i * range / steps;
    let d = 0;
    for (const xi of arr) {
      const u = (x - xi) / h;
      d += Math.exp(-0.5 * u * u);
    }
    if (d > maxD) { maxD = d; peak = x; }
  }
  return peak;
};

// Weighted versions
export function getDecayWeights(n, halfLife) {
  if (!halfLife || halfLife <= 0) return new Array(n).fill(1);
  const alpha = 0.5 ** (1 / halfLife);
  return Array.from({length: n}, (_, i) => alpha ** (n - 1 - i));
}

export function weightedMean(arr, weights) {
  const sumW = weights.reduce((a,b)=>a+b,0);
  return arr.reduce((acc,v,i)=>acc + v*weights[i], 0) / sumW;
}

export function weightedKdePeak(arr, weights, steps=900) {
  if (arr.length < 2) return arr[0] ?? null;
  const sumW  = weights.reduce((a,b)=>a+b,0);
  const wMean = weightedMean(arr, weights);
  const wVar  = arr.reduce((acc,v,i)=>acc + weights[i]*(v-wMean)**2, 0) / sumW;
  const sd    = Math.sqrt(wVar) || 1e-9;
  const sumW2 = weights.reduce((a,b)=>a+b*b,0);
  const nEff  = (sumW * sumW) / sumW2;
  const h     = 1.06 * sd * (nEff ** -0.2);
  const mn = Math.min(...arr), mx = Math.max(...arr);
  const range = mx - mn; if (range < 1e-12) return mn;
  let maxD = -1, peak = mn;
  for (let i = 0; i <= steps; i++) {
    const x = mn + i * range / steps;
    let d = 0;
    for (let j = 0; j < arr.length; j++) {
      const u = (x - arr[j]) / h;
      d += weights[j] * Math.exp(-0.5 * u * u);
    }
    if (d > maxD) { maxD = d; peak = x; }
  }
  return peak;
}

// ── Estimator switch ──────────────────────────────────────────────

export function getEstimate(ratios, estimator, halfLife = null) {
  const n = ratios.length;
  if (n === 0) return null;
  if (n === 1) return ratios[0];

  const weights = halfLife ? getDecayWeights(n, halfLife) : null;

  switch (estimator) {
    case 'kde':     return kdePeak(ratios);
    case 'wkde':    return weightedKdePeak(ratios, weights);
    case 'wmean':   return weightedMean(ratios, weights);
    case 'mode':    return binnedMode(ratios);
    case 'median':  return median(ratios);
    case 'trimmed': return trimmedMean(ratios);
    default:        return mean(ratios);
  }
}
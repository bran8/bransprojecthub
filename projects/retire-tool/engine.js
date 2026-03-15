/**
 * Retire Calculator - Core Engine (engine.js)
 * 
 * STRATEGY: Standard Drawdown (BTC Priority + TFSA Optimization)
 * =============================================================
 * 1. Registered Mandatory (RIF/LIF Min)
 * 2. TFSA Maximization ($6000/year contribution from RRIF/LIF if possible)
 * 3. TFSA Withdrawal (if gap exists)
 * 4. Savings (Cash)
 * 5. Bitcoin (Capital Gain - Prioritized over Extra RRIF)
 * 6. Registered Extra (Extra RRIF - 100% Taxable)
 */

class RetirementEngine {
    constructor(data) {
        this.lifRates = data.lifRates || [];
        this.rrifRates = data.rrifRates || [];
        this.taxRates = data.taxRates || [];
    }

    simulate(inputs, bearOverrides = {}) {
        let bal = {
            rif:  inputs.rifBal,
            lif:  inputs.lifBal,
            tfsa: inputs.tfsaBal,
            save: inputs.saveBal,
            btc:  inputs.btcBal
        };

        let btcCostBase = inputs.btcCostBase || 0;

        const cagrConfig = {
            rif:  { headline: inputs.rifCAGR,  bondAmt: inputs.rifBondAmount  || 0, bondRate: inputs.rifBondCAGR  || 0 },
            lif:  { headline: inputs.lifCAGR,  bondAmt: inputs.lifBondAmount  || 0, bondRate: inputs.lifBondCAGR  || 0 },
            tfsa: { headline: inputs.tfsaCAGR, bondAmt: inputs.tfsaBondAmount || 0, bondRate: inputs.tfsaBondCAGR || 0 },
            save: { headline: inputs.saveCAGR, bondAmt: 0, bondRate: 0 },
            btc:  { headline: inputs.btcCAGR,  bondAmt: 0, bondRate: 0 }
        };

        const results = [];
        let prevTotalBal = bal.rif + bal.lif + bal.tfsa + bal.save + bal.btc;

        for (let age = inputs.startingAge; age <= 100; age++) {
            const year = inputs.startingYear + (age - inputs.startingAge);

            // ── 1. LIRA UNLOCK ──────────────────────────────
            let unlockAmount = 0;
            if (age === 55) {
                unlockAmount = bal.lif * 0.5;
                bal.lif -= unlockAmount;
                bal.rif += unlockAmount;
            }

            // ── 2. GOVERNMENT BENEFITS ────────────────────────
            const cpp = this._calcCPP(age, inputs.cppAge);
            let oasGross = this._calcOAS(age);

            // ── 3. MANDATORY WITHDRAWALS ──────────────────────
            const rifMinRate = this._getRate(this.rrifRates, age, 'min', 0);
            const lifMaxRate = this._getRate(this.lifRates, age, 'max', 0);
            
            let wRIF = bal.rif * rifMinRate;
            let wLIF = bal.lif * lifMaxRate;

            // ── 4. TFSA OPTIMIZATION (CONTRIBUTE UP TO $6000) ──
            // If we have RIF/LIF balance, pull extra $6000 to flip to TFSA
            let tfsaContrib = 0;
            const maxContrib = 6000;
            if (bal.rif > wRIF) {
                tfsaContrib = Math.min(maxContrib, bal.rif - wRIF);
                wRIF += tfsaContrib;
            } else if (bal.lif > wLIF) {
                tfsaContrib = Math.min(maxContrib, bal.lif - wLIF);
                wLIF += tfsaContrib;
            }

            // ── 5. TARGET NET INCOME ──────────────────────────
            let baseIncome = inputs.desiredIncome;
            let targetNet = baseIncome;
            let phase = 'GOGO';

            if (age <= 72) {
                targetNet = baseIncome * 1.20; 
            } else if (age <= 84) {
                phase = 'SLOWGO';
                targetNet = baseIncome;
            } else {
                phase = 'NOGO';
                targetNet = baseIncome * 0.75;
            }

            // ── 6. INITIAL NET FROM MANDATORY (+TFSA Contrib) + GOVT ──
            // Note: tfsaContrib was added to wRIF/wLIF but it doesn't count towards NET income
            // because it's immediately put into TFSA.
            let initialTaxable = wRIF + wLIF + cpp + oasGross;
            let initialTax = this.calculateTax(initialTaxable, inputs.taxYear);
            // Current Net available for spending: Total Withdrawn - Tax - TFSA Deposit
            let netSoFar = (wRIF + wLIF + cpp + oasGross) - initialTax - tfsaContrib;

            let gap = Math.max(0, targetNet - netSoFar);

            // ── 7. TFSA & SAVINGS WITHDRAWALS ─────────────────
            let wTFSA = Math.min(gap, bal.tfsa);
            gap -= wTFSA;

            let wSave = Math.min(gap, bal.save);
            gap -= wSave;

            // ── 8. BITCOIN (PRIORITY WITHDRAWAL) ──────────────
            let wBTC = 0;
            let btcCapGain = 0;
            let btcTaxableGain = 0;

            if (gap > 0 && bal.btc > 0) {
                let lo = 0;
                let hi = Math.min(gap * 2, bal.btc);
                for (let i = 0; i < 15; i++) {
                    let mid = (lo + hi) / 2;
                    let proportion = mid / bal.btc;
                    let costUsed = btcCostBase * proportion;
                    let gain = Math.max(0, mid - costUsed);
                    let taxable = initialTaxable + (gain * 0.5);
                    let tax = this.calculateTax(taxable, inputs.taxYear);
                    // Net generated by middle withdrawal: (mid - deltaTax)
                    let testNet = initialTaxable + mid - tax - initialTaxable; 
                    if (testNet < gap) lo = mid; else hi = mid;
                }
                wBTC = hi;
                let proportion = wBTC / bal.btc;
                let costUsed = btcCostBase * proportion;
                btcCapGain = Math.max(0, wBTC - costUsed);
                btcTaxableGain = btcCapGain * 0.5;
                btcCostBase -= costUsed;
                
                // Update netSoFar
                let resTaxable = initialTaxable + btcTaxableGain;
                let resTax = this.calculateTax(resTaxable, inputs.taxYear);
                netSoFar = (wRIF + wLIF + cpp + oasGross + wBTC) - resTax - tfsaContrib + wTFSA + wSave;
                gap = Math.max(0, targetNet - netSoFar);
            }

            // ── 9. REGISTERED EXTRA (LAST RESORT) ──────────────
            let extraRIF = 0;
            if (gap > 0 && bal.rif > wRIF) {
                let lo = 0;
                let hi = bal.rif - wRIF;
                for (let i = 0; i < 15; i++) {
                    let mid = (lo + hi) / 2;
                    let taxable = initialTaxable + btcTaxableGain + mid;
                    let tax = this.calculateTax(taxable, inputs.taxYear);
                    let testNet = (wRIF + mid + wLIF + cpp + oasGross + wBTC) - tax - tfsaContrib + wTFSA + wSave;
                    if (testNet < targetNet) lo = mid; else hi = mid;
                }
                extraRIF = hi;
                wRIF += extraRIF;
            }

            // ── 10. FINAL CALCULATIONS & OAS CLAWBACK ──────────
            let currentTaxable = wRIF + wLIF + cpp + oasGross + btcTaxableGain;
            
            const oasThreshold = 95323;
            let oasClawback = 0;
            let oasNet = oasGross;

            if (age >= 65 && currentTaxable > oasThreshold) {
                oasClawback = (currentTaxable - oasThreshold) * 0.15;
                oasNet = Math.max(0, oasGross - oasClawback);
                currentTaxable = wRIF + wLIF + cpp + oasNet + btcTaxableGain;
            }

            const finalTax = this.calculateTax(currentTaxable, inputs.taxYear);
            const netIncome = (wRIF + wLIF + cpp + oasNet - finalTax - tfsaContrib) + wTFSA + wSave + wBTC;

            // ── 11. ACCOUNT LOGIC ──────────────────────────────
            bal.rif  = Math.max(0, bal.rif  - wRIF);
            bal.lif  = Math.max(0, bal.lif  - wLIF);
            bal.tfsa = Math.max(0, bal.tfsa - wTFSA + tfsaContrib); // Deposit tfsaContrib
            bal.save = Math.max(0, bal.save - wSave);
            bal.btc  = Math.max(0, bal.btc  - wBTC);

            const yearOverride = bearOverrides[year];
            const growth = {};
            for (const acct of ['rif', 'lif', 'tfsa', 'save', 'btc']) {
                if (bal[acct] <= 0) { growth[acct] = 0; continue; }
                if (yearOverride !== undefined) {
                    growth[acct] = bal[acct] * yearOverride;
                } else {
                    const cfg = cagrConfig[acct];
                    const bPart = Math.min(bal[acct], cfg.bondAmt);
                    const hPart = bal[acct] - bPart;
                    growth[acct] = (bPart * cfg.bondRate) + (hPart * cfg.headline);
                }
                bal[acct] = Math.max(0, bal[acct] + growth[acct]);
            }

            // ── 12. RECORD ─────────────────────────────────────
            const totalBal = bal.rif + bal.lif + bal.tfsa + bal.save + bal.btc;
            const changePc = prevTotalBal > 0 ? ((totalBal - prevTotalBal) / prevTotalBal) * 100 : 0;

            results.push({
                age, year, phase,
                isBear: yearOverride !== undefined,
                drawdowns: { rif: wRIF, lif: wLIF, tfsa: wTFSA, save: wSave, btc: wBTC },
                extraRIF, btcCapGain, btcTaxableGain, tfsaContrib,
                cpp, oasGross,
                taxableIncome: currentTaxable, tax: finalTax,
                taxRate: currentTaxable > 0 ? finalTax / currentTaxable : 0,
                targetNet, netIncome, oasNet, oasClawback,
                balances: { ...bal },
                growth, totalBalance: totalBal, changePc, unlockAmount
            });

            prevTotalBal = totalBal;
            if (totalBal <= 0 && age > inputs.startingAge + 5) break;
        }
        return results;
    }

    findOptimalIncome(inputs, targetAge = 84, bearOverrides = {}) {
        let lo = 20000;
        let hi = 1000000;

        for (let i = 0; i < 30; i++) {
            const mid = (lo + hi) / 2;
            const results = this.simulate({ ...inputs, desiredIncome: mid }, bearOverrides);
            
            const success = results.every(r => {
                if (r.age > targetAge) return true;
                return r.netIncome >= (r.targetNet - 10); 
            });

            if (success) lo = mid; else hi = mid;
        }
        return Math.floor(lo / 10) * 10;
    }

    _getRate(table, age, field, fallback) {
        const entry = table.find(r => r.age === age);
        return entry ? (entry[field] || fallback) : fallback;
    }

    calculateTax(taxableIncome, year) {
        if (taxableIncome <= 0) return 0;
        const rates = this.taxRates.filter(r => r.year === year);
        if (rates.length === 0) return 0;
        const ontBrackets = rates.filter(r => r.region === 'Ontario').sort((a, b) => a.over - b.over);
        const fedBrackets = rates.filter(r => r.region === 'Federal').sort((a, b) => a.over - b.over);
        const basicFed = 15705; const basicOnt = 12399;
        const calc = (income, brackets) => {
            let tax = 0;
            for (const b of brackets) {
                if (income > b.over) tax += Math.min(income - b.over, b.under - b.over) * b.rate;
            }
            return tax;
        };
        let tOnt = calc(taxableIncome, ontBrackets);
        let tFed = calc(taxableIncome, fedBrackets);
        if (ontBrackets.length > 0) tOnt = Math.max(0, tOnt - (basicOnt * ontBrackets[0].rate));
        if (fedBrackets.length > 0) tFed = Math.max(0, tFed - (basicFed * fedBrackets[0].rate));
        return tOnt + tFed;
    }

    _calcCPP(age, startAge) {
        if (age < startAge) return 0;
        const base = 9327;
        const bonus = Math.min((startAge - 65) * 0.084, 0.42);
        return base * (1 + bonus);
    }

    _calcOAS(age) {
        if (age < 65) return 0;
        const base = 8556;
        return age >= 75 ? base * 1.10 : base;
    }
}

window.RetirementEngine = RetirementEngine;

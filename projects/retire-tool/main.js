/**
 * Retire Calculator - main.js
 * UI controller. Slider auto-updates table on drag.
 */

class RetirementUI {
    constructor() {
        this.engine = null;
        this.chart = null;
        this.init();
    }

    async init() {
        await this.loadEngine();
        this.setupListeners();
        this.loadPlans();
    }

    async loadEngine() {
        const [lifData, rrifData, taxData] = await Promise.all([
            this.fetchCSV('LIF.csv'),
            this.fetchCSV('RRIF.csv'),
            this.fetchCSV('tax_rates.csv')
        ]);

        this.engine = new RetirementEngine({
            lifRates: lifData.map(r => ({ age: parseInt(r.Age), max: parseFloat(r.Max) / 100 })),
            rrifRates: rrifData.map(r => ({ age: parseInt(r.Age), min: parseFloat(r.Min) / 100 })),
            taxRates: taxData.map(r => ({
                year: parseInt(r.Year),
                region: r.Region,
                bracket: parseInt(r.Bracket),
                over: parseFloat(r.Over),
                under: parseFloat(r.Under),
                rate: parseFloat(r.Rate)
            }))
        });
    }

    async fetchCSV(file) {
        const response = await fetch(file);
        const text = await response.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');
        return lines.slice(1).filter(l => l.trim()).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim());
            return obj;
        });
    }

    setupListeners() {
        document.getElementById('savePlan').addEventListener('click', () => this.savePlan());
        document.getElementById('loadPlanList').addEventListener('change', (e) => this.loadPlan(e.target.value));
        document.getElementById('deletePlan').addEventListener('click', () => this.deletePlan());

        // Optimize buttons
        document.getElementById('optimizeBtn').addEventListener('click', () => this.optimize(84));
        document.getElementById('optimizeDieBtn').addEventListener('click', () => this.optimize(92));

        // Slider: auto-update on drag
        const slider = document.getElementById('desiredIncome');
        const display = document.getElementById('incomeDisplay');

        slider.addEventListener('input', () => {
            display.innerText = '$' + parseInt(slider.value).toLocaleString();
            this.run();
        });

        // Optimize button
        // document.getElementById('optimizeBtn').addEventListener('click', () => this.optimize()); // Moved to setupListeners
    }

    getInputs() {
        return {
            startingAge: parseInt(document.getElementById('startingAge').value),
            startingYear: parseInt(document.getElementById('startingYear').value),
            desiredIncome: parseFloat(document.getElementById('desiredIncome').value),

            rifBal: parseFloat(document.getElementById('rifBal').value),
            rifCAGR: parseFloat(document.getElementById('rifCAGR').value) / 100,
            rifBondAmount: parseFloat(document.getElementById('rifBondAmt').value) || 0,
            rifBondCAGR: parseFloat(document.getElementById('rifBondCAGR').value) / 100,

            lifBal: parseFloat(document.getElementById('lifBal').value),
            lifCAGR: parseFloat(document.getElementById('lifCAGR').value) / 100,
            lifBondAmount: parseFloat(document.getElementById('lifBondAmt').value) || 0,
            lifBondCAGR: parseFloat(document.getElementById('lifBondCAGR').value) / 100,

            tfsaBal: parseFloat(document.getElementById('tfsaBal').value),
            tfsaCAGR: parseFloat(document.getElementById('tfsaCAGR').value) / 100,
            tfsaBondAmount: parseFloat(document.getElementById('tfsaBondAmt').value) || 0,
            tfsaBondCAGR: parseFloat(document.getElementById('tfsaBondCAGR').value) / 100,

            saveBal: parseFloat(document.getElementById('saveBal').value),
            saveCAGR: parseFloat(document.getElementById('saveCAGR').value) / 100,
            saveBondAmount: 0,
            saveBondCAGR: 0,

            btcBal: parseFloat(document.getElementById('btcBal').value),
            btcCAGR: parseFloat(document.getElementById('btcCAGR').value) / 100,
            btcCostBase: parseFloat(document.getElementById('btcCostBase').value) || 0,

            taxYear: parseInt(document.getElementById('taxYear').value),
            cppAge: parseInt(document.getElementById('cppAge').value)
        };
    }

    parseBearYears() {
        const raw = document.getElementById('bearYears').value.trim();
        const map = {};
        if (!raw) return map;
        raw.split(',').forEach(pair => {
            const [y, r] = pair.trim().split(':');
            if (y && r) map[parseInt(y)] = parseFloat(r);
        });
        return map;
    }

    run() {
        if (!this.engine) return;
        const inputs = this.getInputs();
        const bearOverrides = this.parseBearYears();
        const results = this.engine.simulate(inputs, bearOverrides);
        this.renderResults(results);
    }

    optimize(targetAge) {
        if (!this.engine) return;
        const inputs = this.getInputs();
        const bearOverrides = this.parseBearYears();
        const optimal = this.engine.findOptimalIncome(inputs, targetAge, bearOverrides);

        // Set slider to optimal value
        const slider = document.getElementById('desiredIncome');
        slider.value = optimal;
        document.getElementById('incomeDisplay').innerText = '$' + optimal.toLocaleString();
        this.run();
    }

    $(n) { return '$' + Math.round(n).toLocaleString(); }

    renderResults(results) {
        const tbody = document.querySelector('#resultsTable tbody');
        tbody.innerHTML = '';

        let lifetimeTax = 0;

        results.forEach((r) => {
            lifetimeTax += r.tax;

            // ── Summary Row ─────────────────────────────────────
            const sTr = document.createElement('tr');
            sTr.className = `row-summary ${r.isBear ? 'bear-row' : ''}`;
            sTr.innerHTML = `
                <td class="accordion-toggle">+</td>
                <td>${r.age}</td>
                <td>${r.year}${r.isBear ? ' 🐻' : ''}</td>
                <td class="phase-${r.phase.toLowerCase()}">${r.phase}</td>
                <td class="pos">${this.$(r.netIncome)}</td>
                <td class="neg">${this.$(r.tax)}</td>
                <td>${this.$(r.balances.rif)}</td>
                <td>${this.$(r.balances.lif)}</td>
                <td>${this.$(r.balances.tfsa)}</td>
                <td>${this.$(r.balances.save)}</td>
                <td>${this.$(r.balances.btc)}</td>
                <td style="font-weight:700">${this.$(r.totalBalance)}</td>
                <td class="${r.changePc >= 0 ? 'pos' : 'neg'}">${r.changePc.toFixed(1)}%</td>
            `;

            // ── Accordion Detail Row ────────────────────────────
            const dTr = document.createElement('tr');
            dTr.className = 'row-details';
            dTr.innerHTML = `
                <td colspan="13">
                    <div class="details-content">
                        <div class="detail-col">
                            <h4>Withdrawals</h4>
                            <div class="detail-item"><span class="detail-label">RIF (min+melt):</span><span class="detail-value">${this.$(r.drawdowns.rif)}</span></div>
                            ${r.extraRIF > 0 ? `<div class="detail-item"><span class="detail-label">↳ Extra Meltdown:</span><span class="detail-value" style="color:var(--warning)">${this.$(r.extraRIF)}</span></div>` : ''}
                            <div class="detail-item"><span class="detail-label">LIF (max):</span><span class="detail-value">${this.$(r.drawdowns.lif)}</span></div>
                            <div class="detail-item"><span class="detail-label">TFSA:</span><span class="detail-value">${this.$(r.drawdowns.tfsa)}</span></div>
                            <div class="detail-item"><span class="detail-label">Savings:</span><span class="detail-value">${this.$(r.drawdowns.save)}</span></div>
                            <div class="detail-item"><span class="detail-label">BTC:</span><span class="detail-value">${this.$(r.drawdowns.btc)}</span></div>
                            ${r.btcCapGain > 0 ? `<div class="detail-item"><span class="detail-label">↳ BTC Cap Gain:</span><span class="detail-value neg">${this.$(r.btcCapGain)} (50% taxed: ${this.$(r.btcTaxableGain)})</span></div>` : ''}
                            ${r.unlockAmount > 0 ? `<div class="detail-item"><span class="detail-label">🔓 LIRA Unlock:</span><span class="detail-value pos">${this.$(r.unlockAmount)}</span></div>` : ''}
                        </div>
                        <div class="detail-col">
                            <h4>Growth (CAGR)</h4>
                            <div class="detail-item"><span class="detail-label">RRIF:</span><span class="detail-value ${r.growth.rif >= 0 ? 'pos' : 'neg'}">${r.growth.rif >= 0 ? '+' : ''}${this.$(r.growth.rif)}</span></div>
                            <div class="detail-item"><span class="detail-label">LIF:</span><span class="detail-value ${r.growth.lif >= 0 ? 'pos' : 'neg'}">${r.growth.lif >= 0 ? '+' : ''}${this.$(r.growth.lif)}</span></div>
                            <div class="detail-item"><span class="detail-label">TFSA:</span><span class="detail-value ${r.growth.tfsa >= 0 ? 'pos' : 'neg'}">${r.growth.tfsa >= 0 ? '+' : ''}${this.$(r.growth.tfsa)}</span></div>
                            <div class="detail-item"><span class="detail-label">Save:</span><span class="detail-value ${r.growth.save >= 0 ? 'pos' : 'neg'}">${r.growth.save >= 0 ? '+' : ''}${this.$(r.growth.save)}</span></div>
                            <div class="detail-item"><span class="detail-label">BTC:</span><span class="detail-value ${r.growth.btc >= 0 ? 'pos' : 'neg'}">${r.growth.btc >= 0 ? '+' : ''}${this.$(r.growth.btc)}</span></div>
                        </div>
                        <div class="detail-col">
                            <h4>Tax & Govt</h4>
                            <div class="detail-item"><span class="detail-label">Taxable Income:</span><span class="detail-value">${this.$(r.taxableIncome)}</span></div>
                            <div class="detail-item"><span class="detail-label">Effective Rate:</span><span class="detail-value neg">${(r.taxRate * 100).toFixed(1)}%</span></div>
                            <div class="detail-item"><span class="detail-label">Tax Paid:</span><span class="detail-value neg">-${this.$(r.tax)}</span></div>
                            <div class="detail-item"><span class="detail-label">CPP:</span><span class="detail-value pos">${this.$(r.cpp)}</span></div>
                            <div class="detail-item"><span class="detail-label">OAS (gross):</span><span class="detail-value pos">${this.$(r.oasGross)}</span></div>
                            ${r.oasClawback > 0 ? `<div class="detail-item"><span class="detail-label">↳ OAS Clawback:</span><span class="detail-value neg">-${this.$(r.oasClawback)}</span></div>` : ''}
                            ${r.oasClawback > 0 ? `<div class="detail-item"><span class="detail-label">↳ OAS Net:</span><span class="detail-value">${this.$(r.oasNet)}</span></div>` : ''}
                        </div>
                    </div>
                </td>
            `;

            sTr.addEventListener('click', () => {
                dTr.classList.toggle('active');
                sTr.querySelector('.accordion-toggle').innerText = dTr.classList.contains('active') ? '−' : '+';
            });

            tbody.appendChild(sTr);
            tbody.appendChild(dTr);
        });

        // ── KPIs ────────────────────────────────────────────────
        const last = results[results.length - 1];
        document.getElementById('successYears').innerText = results.length;
        document.getElementById('finalNetWorth').innerText = this.$(last.totalBalance);
        document.getElementById('lifetimeTax').innerText = this.$(lifetimeTax);

        this.renderChart(results);
    }

    renderChart(results) {
        const ctx = document.getElementById('balanceChart').getContext('2d');
        if (this.chart) this.chart.destroy();

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: results.map(r => r.age),
                datasets: [
                    { label: 'RRIF', data: results.map(r => r.balances.rif), borderColor: '#6366f1', fill: false, tension: 0.1 },
                    { label: 'LIF', data: results.map(r => r.balances.lif), borderColor: '#10b981', fill: false, tension: 0.1 },
                    { label: 'TFSA', data: results.map(r => r.balances.tfsa), borderColor: '#f59e0b', fill: false, tension: 0.1 },
                    { label: 'Savings', data: results.map(r => r.balances.save), borderColor: '#94a3b8', fill: false, tension: 0.1 },
                    { label: 'BTC', data: results.map(r => r.balances.btc), borderColor: '#ef4444', fill: false, tension: 0.1 },
                    { label: 'Total', data: results.map(r => r.totalBalance), borderColor: '#fff', borderDash: [5, 5], fill: false, tension: 0.1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },  // No animation for responsive slider
                plugins: { legend: { labels: { color: '#f8fafc' } } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }

    // ── Plan Persistence ────────────────────────────────────────
    savePlan() {
        const name = document.getElementById('planName').value.trim();
        if (!name) return alert("Enter plan name");
        const data = this.getInputs();
        data.bearYears = document.getElementById('bearYears').value;
        localStorage.setItem(`retirePlan_${name}`, JSON.stringify(data));
        this.loadPlans();
    }

    loadPlans() {
        const sel = document.getElementById('loadPlanList');
        sel.innerHTML = '<option value="">Load Saved Plan...</option>';
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k.startsWith('retirePlan_')) {
                const o = document.createElement('option');
                o.value = k.replace('retirePlan_', '');
                o.innerText = o.value;
                sel.appendChild(o);
            }
        }
    }

    loadPlan(name) {
        if (!name) return;
        const data = JSON.parse(localStorage.getItem(`retirePlan_${name}`));
        if (!data) return;

        const fieldMap = {
            startingAge: 'startingAge', startingYear: 'startingYear',
            rifBal: 'rifBal', lifBal: 'lifBal', tfsaBal: 'tfsaBal', saveBal: 'saveBal', btcBal: 'btcBal',
            rifBondAmount: 'rifBondAmt', lifBondAmount: 'lifBondAmt', tfsaBondAmount: 'tfsaBondAmt',
            btcCostBase: 'btcCostBase',
            taxYear: 'taxYear', cppAge: 'cppAge'
        };
        const percentFields = {
            rifCAGR: 'rifCAGR', lifCAGR: 'lifCAGR', tfsaCAGR: 'tfsaCAGR',
            saveCAGR: 'saveCAGR', btcCAGR: 'btcCAGR',
            rifBondCAGR: 'rifBondCAGR', lifBondCAGR: 'lifBondCAGR', tfsaBondCAGR: 'tfsaBondCAGR'
        };

        for (const [k, id] of Object.entries(fieldMap)) {
            if (data[k] !== undefined) document.getElementById(id).value = data[k];
        }
        for (const [k, id] of Object.entries(percentFields)) {
            if (data[k] !== undefined) document.getElementById(id).value = (data[k] * 100).toFixed(2);
        }

        // Slider
        if (data.desiredIncome !== undefined) {
            const slider = document.getElementById('desiredIncome');
            slider.value = data.desiredIncome;
            document.getElementById('incomeDisplay').innerText = '$' + Math.round(data.desiredIncome).toLocaleString();
        }

        if (data.bearYears) document.getElementById('bearYears').value = data.bearYears;
        document.getElementById('planName').value = name;
        this.run();
    }

    deletePlan() {
        const name = document.getElementById('planName').value.trim();
        if (name) {
            localStorage.removeItem(`retirePlan_${name}`);
            this.loadPlans();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ui = new RetirementUI();
});

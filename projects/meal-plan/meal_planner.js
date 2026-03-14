/* ============================================================
   meal_planner.js
   Logic for the Menu Recommendation System
   ============================================================

   GLOBAL STATE
   ─────────────
   menuData    – the parsed JSON object loaded from the user's file.
                 Also exposed on window.menuData for console-side
                 experimentation and custom math functions.
   allDiners   – canonical ordered list of every diner in the trip.
                 Edit this array if the party composition changes.

   TAG KEY FORMAT
   ──────────────
   Every key in nights[].tags is formatted as:
       "<location>||<dish name>"
   e.g. "SIG||Aged Prime Rib of Beef"
        "Cyprus||Arugula Salad"

   Valid location prefixes: SIG, Cyprus, Cosmopolitan, Normandie, CLS, Tuscan.
   Use parseDishKey() to split a raw tag key into { location, dishName }.

   RECOMMENDATION PRIORITY ORDER
   ──────────────────────────────
   1. Featured items (tag.feat === true)  — always selected, mandatory.
      Diners who prefer featured items have that preference honoured first.
   2. SIG-location items                 — high priority in the greedy cover
      phase.  SIG_PRIORITY adds a fractional bonus so SIG wins ties against
      non-SIG items, but a non-SIG item that covers more uncovered diners
      still outscores a SIG item covering fewer.
   3. All other locations                — scored purely by uncovered-diner count.
   ============================================================ */

let menuData = null;
const allDiners = ["me", "wife", "kid1", "kid2"];



/**
 * Bonus added to a SIG item's greedy-cover score.
 * Value of 0.5 means SIG always wins ties against non-SIG items, but a
 * non-SIG item covering ≥1 more uncovered diner will still beat a SIG item.
 * Raise toward allDiners.length if you want SIG to dominate regardless of
 * diner coverage.
 */
const SIG_PRIORITY = 1;

// ── Utilities ────────────────────────────────────────────────

/**
 * Escape a string so it is safe to inject into innerHTML.
 * Always call this before rendering any user-supplied value.
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Split a raw tag key into its location prefix and dish name.
 *
 * Tag keys are stored as "<location>||<dish name>".
 * Valid locations: SIG, Cyprus, Cosmopolitan, Normandie, CLS, Tuscan.
 * If no "||" is found the entire key is treated as the dish name and
 * location is returned as an empty string.
 *
 * @param   {string} key  Raw tag key, e.g. "SIG||Aged Prime Rib of Beef"
 * @returns {{ location: string, dishName: string }}
 */
function parseDishKey(key) {
    const sep = key.indexOf('||');
    if (sep === -1) return { location: '', dishName: key };
    return {
        location: key.slice(0, sep),
        dishName: key.slice(sep + 2)
    };
}

// ── Rendering helpers ────────────────────────────────────────

/**
 * Render a CLS-Custom or Exclusions card.
 *
 * @param {string} title     - Card heading text.
 * @param {object} customObj - Object with optional arrays: s (starters),
 *                             e (entrees), d (desserts).
 * @returns {string} HTML string for a .custom-card element.
 */
function renderCustomSection(title, customObj) {
    if (!customObj) return '';
    let html = `<div class="custom-card"><h3>${title}</h3><ul class="custom-list">`;
    if (customObj.s && customObj.s.length) {
        html += `<li><strong>Starters (s):</strong> ${customObj.s.map(item => escapeHtml(String(item))).join(', ') || '—'}</li>`;
    }
    if (customObj.e && customObj.e.length) {
        html += `<li><strong>Entrees (e):</strong> ${customObj.e.map(item => escapeHtml(String(item))).join(', ') || '—'}</li>`;
    }
    if (customObj.d && customObj.d.length) {
        html += `<li><strong>Desserts (d):</strong> ${customObj.d.map(item => escapeHtml(String(item))).join(', ') || '—'}</li>`;
    }
    html += `</ul></div>`;
    return html;
}

// ── Section renderers ────────────────────────────────────────

/**
 * Populate #overview with global config cards:
 *   - CLS Custom (clsCustom) starters / entrees / desserts
 *   - Exclusions  (exclCustom) starters / entrees / desserts
 *   - Current night reference number
 */
function renderOverview() {
    let html = `
        <div class="section">
            <div class="section-title">Global Configuration</div>
            <div class="custom-grid">
                ${renderCustomSection('CLS Custom', menuData.clsCustom)}
                ${renderCustomSection('Exclusions', menuData.exclCustom)}
            </div>
            <p style="margin-top:1rem;font-size:0.9rem;color:#64748b;">
                Current night reference: <strong>${menuData.currentNight}</strong>
            </p>
        </div>
    `;
    document.getElementById('overview').innerHTML = html;
}

/**
 * Populate #nights with one collapsible <details> per night.
 *
 * Each night block contains:
 *   1. A table of tagged dishes — columns: Location | Dish Name | Diners | Featured
 *      • "Location" = the prefix before "||" in the tag key (SIG, Cyprus, etc.)
 *        SIG rows are visually highlighted as high-priority items.
 *      • "Dish Name" = the portion of the key after "||"
 *      • "Diners" = the diners array joined as a comma-separated string
 *      • "Featured" = a .feat badge if tag.feat === true
 *   2. Optionally a SIG Custom sub-section showing location-specific
 *      starters / entrees / desserts from night.sigCustom.
 */
function renderNights() {
    let html = '';

        html = `
        <div style="margin-top:1.5rem;">
            <table style="width:100%; max-width:1400px; margin:0 auto; border-collapse:collapse; font-size:0.96rem;">
                <thead style="position:sticky; top:0; background:#f1f5f9; z-index:10;">
                    <tr>
                        <th style="padding:12px 14px; text-align:right; border-bottom:2px solid #cbd5e1; font-weight:700; min-width:140px;">
                            Night / Course
                        </th>
                        ${allDiners.map(d => `
                            <th style="padding:12px 14px; text-align:center; border-bottom:2px solid #cbd5e1; font-weight:700;">
                                ${escapeHtml(d)}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>`;


    menuData.nights.forEach((night, idx) => {
        // Build the tags table
        let tagsHtml = `<table><thead><tr><th>Location</th><th>Dish Name</th><th>Diners</th><th>Featured</th></tr></thead><tbody>`;

        Object.entries(night.tags).forEach(([key, tag]) => {
            const { location, dishName } = parseDishKey(key);
            const dinersStr  = tag.diners.join(', ');
            const featBadge  = tag.feat ? `<span class="feat">FEATURED</span>` : '';
            // SIG rows get a subtle left-border highlight so they stand out as high-priority
            const rowStyle   = location === 'SIG' ? ' style="border-left:3px solid #3b82f6;"' : '';
            const locDisplay = location
                ? `<span style="font-size:0.8rem;font-weight:700;color:${location === 'SIG' ? '#1e40af' : '#64748b'};">${escapeHtml(location)}</span>`
                : '—';
            tagsHtml += `
                <tr${rowStyle}>
                    <td>${locDisplay}</td>
                    <td><strong>${escapeHtml(dishName)}</strong></td>
                    <td>${dinersStr}</td>
                    <td>${featBadge}</td>
                </tr>
            `;
        });
        tagsHtml += `</tbody></table>`;

        // Optional location-specific SIG Custom section
        let sigCustomHtml = '';
        if (night.sigCustom && (night.sigCustom.s || night.sigCustom.e || night.sigCustom.d)) {
            sigCustomHtml = `
                <div style="margin-top:1.5rem;">
                    <h4 style="font-size:0.95rem;color:#64748b;margin-bottom:0.5rem;">SIG Custom (this location)</h4>
                    <div style="font-size:0.9rem;background:#f8fafc;padding:1rem;border-radius:6px;">
                        ${night.sigCustom.s && night.sigCustom.s.length ? `<div><strong>Starters:</strong> ${night.sigCustom.s.map(i => escapeHtml(String(i))).join(', ')}</div>` : ''}
                        ${night.sigCustom.e && night.sigCustom.e.length ? `<div><strong>Entrees:</strong> ${night.sigCustom.e.map(i => escapeHtml(String(i))).join(', ')}</div>` : ''}
                        ${night.sigCustom.d && night.sigCustom.d.length ? `<div><strong>Desserts:</strong> ${night.sigCustom.d.map(i => escapeHtml(String(i))).join(', ')}</div>` : ''}
                    </div>
                </div>
            `;
        }

        html += `
            <details>
                <summary>
                    Night ${idx} — ${escapeHtml(night.dining)}
                    <span style="font-size:0.85rem;font-weight:400;color:#64748b;">
                        ${Object.keys(night.tags).length} tagged items
                    </span>
                </summary>
                <div class="night-content">
                    ${tagsHtml}
                    ${sigCustomHtml}
                </div>
            </details>
        `;
    });
    document.getElementById('nights').innerHTML = html;
}

// ── Recommendation engine ────────────────────────────────────

/**
 * Compute and render per-night meal recommendations into #recommendations.
 *
 * ALGORITHM — Priority-weighted Greedy Set Cover:
 *
 *   STEP 1 — Featured items (tag.feat === true) are mandatory and always
 *     selected first.  These represent dishes that diners have specifically
 *     preferred/requested.  Their diners are marked covered immediately.
 *
 *   STEP 2 — SIG-location items are high priority among remaining candidates.
 *     In the greedy loop each candidate is scored as:
 *
 *       score = (uncovered diners reached) + (SIG_PRIORITY if location === 'SIG')
 *
 *     SIG_PRIORITY (0.5) means a SIG item wins ties against non-SIG items, but
 *     a non-SIG item that covers at least one MORE uncovered diner will still
 *     outrank the SIG item.  Raise SIG_PRIORITY to allDiners.length if you want
 *     SIG to always dominate regardless of diner coverage.
 *
 *   STEP 3 — Non-featured, non-SIG items fill any remaining coverage gaps,
 *     scored purely by uncovered-diner count.
 *
 * TAGGING SEMANTICS:
 *   A dish is "tagged" when a diner picks it.  tag.diners is the array of diner
 *   names who chose that dish.  A diner's preference for a featured item is
 *   honoured by the mandatory-selection rule in Step 1.
 *
 * TAG KEY FORMAT:
 *   Each tag key is "<location>||<dish name>". parseDishKey() splits these.
 *   Valid locations: SIG, Cyprus, Cosmopolitan, Normandie, CLS, Tuscan.
 *
 * OUTPUT per night:
 *   - Grouped list of selected items with location badge, diner coverage, and
 *     FEATURED / SIG labels
 *   - Green "All diners covered" or amber warning showing uncovered count
 *   - Item count note suggesting use as 3-course basis
*/


function computeRecommendations() {
    if (!menuData || !menuData.nights || !Array.isArray(menuData.nights)) {
        document.getElementById('recommendations').innerHTML = 
            '<p style="color:#64748b;text-align:center;">No valid data loaded.</p>';
        return;
    }

    let html = `
        <div style="margin-top:1.5rem;">
            <table style="width:100%; max-width:1400px; margin:0 auto; border-collapse:collapse; font-size:0.96rem;">
                <thead style="position:sticky; top:0; background:#f1f5f9; z-index:10;">
                    <tr>
                        <th style="padding:12px 14px; text-align:right; border-bottom:2px solid #cbd5e1; font-weight:700; min-width:160px;">
                            Night / Course
                        </th>
                        ${allDiners.map(d => `
                            <th style="padding:12px 14px; text-align:center; border-bottom:2px solid #cbd5e1; font-weight:700;">
                                ${escapeHtml(d)}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>`;

    menuData.nights.forEach((night, idx) => {
        const nightNumber = idx + 1;
        const location = night.dining || 'Unknown';

        const assignmentMapThisNight = {};
        allDiners.forEach(diner => {
            assignmentMapThisNight[diner] = { s: null, e: null, d: null };
        });

        // Build per-diner tagged dishes for this night only
        const dinerTagged = {};
        allDiners.forEach(diner => {
            dinerTagged[diner] = { s: [], e: [], d: [] };
        });

        Object.entries(night.tags || {}).forEach(([key, tag]) => {
            if (!tag.diners || !tag.cat) return;
            const { dishName } = parseDishKey(key);
            tag.diners.forEach(diner => {
                if (dinerTagged[diner] && dinerTagged[diner][tag.cat]) {
                    dinerTagged[diner][tag.cat].push(dishName);
                }
            });
        });

        // Assign only what the diner tagged on this night
        allDiners.forEach(diner => {
            ['s', 'e', 'd'].forEach(cat => {
                const options = dinerTagged[diner][cat] || [];
                if (options.length === 0) {
                    assignmentMapThisNight[diner][cat] = null;
                    return;
                }

                // 1. Prefer SIG-tagged items
                const sigTagged = options.filter(dish => {
                    return Object.keys(night.tags || {}).some(k => 
                        parseDishKey(k).dishName === dish && 
                        parseDishKey(k).location === 'SIG'
                    );
                });

                if (sigTagged.length > 0) {
                    const chosen = sigTagged[Math.floor(Math.random() * sigTagged.length)];
                    assignmentMapThisNight[diner][cat] = chosen;
                    return;
                }

                // 2. Any tagged exclusive location item
                const exclusiveTagged = options.filter(dish => {
                    const prefix = Object.keys(night.tags || {}).find(k => 
                        parseDishKey(k).dishName === dish
                    );
                    return prefix && ['Cosmopolitan','Cyprus','Normandie','Tuscan'].includes(parseDishKey(prefix).location);
                });

                if (exclusiveTagged.length > 0) {
                    const chosen = exclusiveTagged[Math.floor(Math.random() * exclusiveTagged.length)];
                    assignmentMapThisNight[diner][cat] = chosen;
                    return;
                }

                // 3. Tagged CLS only
                const clsTagged = options.filter(dish => {
                    const prefix = Object.keys(night.tags || {}).find(k => 
                        parseDishKey(k).dishName === dish
                    );
                    return prefix && parseDishKey(prefix).location === 'CLS';
                });

                if (clsTagged.length > 0) {
                    const chosen = clsTagged[Math.floor(Math.random() * clsTagged.length)];
                    assignmentMapThisNight[diner][cat] = chosen;
                    return;
                }

                // 4. Nothing tagged → hungry
                assignmentMapThisNight[diner][cat] = null;
            });
        });

        // ─── Add rows for this night ────────────────────────────────────────
        const labels = { s: 'Starter', e: 'Entree', d: 'Dessert' };

        ['s', 'e', 'd'].forEach(cat => {
            let cells = '';
            allDiners.forEach(diner => {
                const dish = assignmentMapThisNight[diner][cat];
                const content = dish 
                    ? `<strong>${escapeHtml(dish)}</strong>`
                    : '<span style="color:#9ca3af;font-style:italic;">— hungry</span>';
                cells += `<td style="padding:10px 12px; vertical-align:top; border-bottom:1px solid #e2e8f0;">${content}</td>`;
            });

            html += `
                <tr>
                    <th style="text-align:right; padding:10px 12px; background:#f8fafc; border-bottom:1px solid #e2e8f0; font-weight:600; min-width:160px;">
                        ${cat === 's' ? `Night ${nightNumber}<br>` : ''}${labels[cat]}
                    </th>
                    ${cells}
                </tr>`;
        });
    });

    html += `
                </tbody>
            </table>
        </div>`;

    document.getElementById('recommendations').innerHTML = html || 
        '<p style="color:#64748b;text-align:center;">No nights with data.</p>';
}


// ── Event listeners ──────────────────────────────────────────

/** Handle JSON file upload, parse, validate, and trigger renders. */
document.getElementById('fileInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (ev) {
        try {
            menuData = JSON.parse(ev.target.result);

            // Basic schema sanity check
            if (!menuData || !menuData.nights || !Array.isArray(menuData.nights) || !menuData.clsCustom) {
                throw new Error('Invalid structure – missing required fields');
            }

            document.getElementById('status').innerHTML = `
                ✅ Loaded successfully • ${menuData.nights.length} nights • 
                <span style="color:#166534;">Ready for recommendations</span>
            `;
            document.getElementById('content').style.display = 'block';

            //renderOverview();
            //renderNights();

            // Expose globally so custom math functions can be typed in the console
            window.menuData = menuData;
            console.log('%c✅ menuData is now available globally for custom math functions', 'color:#166534;font-weight:600');

        } catch (err) {
            document.getElementById('status').innerHTML = `
                ❌ Error: ${escapeHtml(err.message)}<br>
                <small>Please ensure the file matches the provided JSON schema.</small>
            `;
        }
    };
    reader.readAsText(file);
});

/** Generate / regenerate recommendations on button click. */
document.getElementById('generateBtn').addEventListener('click', function () {
    if (!menuData) {
        alert('Please load a JSON file first.');
        return;
    }
    this.textContent = 'Computing...';
    this.disabled = true;

    // Small timeout to allow the browser to repaint before heavy work
    setTimeout(() => {
        computeRecommendations();
        this.textContent = 'Regenerate Recommendations';
        this.disabled = false;
    }, 80);
});

// Console hint for developers
console.log('%cTip: After loading JSON, type "menuData" in console to inspect or extend the recommendation function.', 'color:#64748b');

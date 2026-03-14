/**
 * app.js — Brandon's Project Hub
 *
 * Responsibilities:
 *   1. Fetch projects.json
 *   2. Populate hero title/subtitle from the "site" block
 *   3. Filter & sort projects (enabled only, featured first)
 *   4. Render a card for each project into the grid
 *   5. Handle accordion (Read More) toggle per card
 *   6. Handle image load errors gracefully
 *
 * No framework dependencies — plain vanilla JS (ES2020+).
 * Designed to be easy to read and easy to maintain.
 */

// ###
// CONFIG
// ###

/** Path to the data file. Adjust if you move projects.json. */
const DATA_URL = 'projects.json';

/**
 * STATUS_MAP
 * Maps the "status" string from JSON to display label + CSS modifier class.
 * Add new statuses here if needed — nothing else needs to change.
 */
const STATUS_MAP = {
  live:    { label: 'Live',                 cls: 'status-badge--live' },
  wip:     { label: 'Work in Progress',     cls: 'status-badge--wip' },
  broken:  { label: "Whoops, I broke it!",  cls: 'status-badge--broken' },
};


// ###
// ENTRY POINT
// ###

/**
 * DOMContentLoaded guard ensures the DOM is ready before we try
 * to query or manipulate any elements.
 */
document.addEventListener('DOMContentLoaded', () => {
  initHub();
});


// ###
// INIT
// ###

async function initHub() {
  const grid = document.getElementById('projects-grid');

  // Show a loading state while we wait for the JSON
  showGridMessage(grid, 'Loading projects…');

  let data;
  try {
    data = await fetchJSON(DATA_URL);
  } catch (err) {
    showGridMessage(grid, `Could not load projects: ${err.message}`, true);
    console.error('[ProjectHub] Fetch error:', err);
    return;
  }

  // Populate hero from the "site" block
  applyHeroContent(data.site);

  // Filter, sort, then render
  const projects = prepareProjects(data.projects || []);

  if (projects.length === 0) {
    showGridMessage(grid, 'No projects to display yet.');
    return;
  }

  grid.innerHTML = ''; // clear loading message
  projects.forEach((project, index) => {
    const card = buildCard(project, index);
    grid.appendChild(card);
  });
}


// ###
// DATA HELPERS
// ###

/**
 * fetchJSON
 * Thin wrapper around fetch() that throws a friendly error on non-OK responses.
 * @param {string} url
 * @returns {Promise<Object>}
 */
async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${response.statusText}`);
  }
  return response.json();
}

/**
 * prepareProjects
 * Takes the raw projects array and:
 *   - Filters out disabled projects (enabled: false)
 *   - Sorts so featured projects appear first, then by title alphabetically
 *     (a simple stable sort — adjust as your catalogue grows)
 * @param {Array} projects
 * @returns {Array}
 */
function prepareProjects(projects) {
  return projects
    .filter(p => p.enabled !== false) // keep if enabled is true or absent
    .sort((a, b) => {
      // Featured projects float to the top
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return  1;
      // Secondary sort: alphabetical by title
      return (a.title || '').localeCompare(b.title || '');
    });
}


// ###
// HERO
// ###

/**
 * applyHeroContent
 * Applies site-level metadata (title, subtitle) from the JSON "site" block
 * to the hero elements. Falls back gracefully if elements don't exist.
 * @param {Object} site — the "site" key from projects.json
 */
function applyHeroContent(site = {}) {
  const titleEl    = document.getElementById('site-title');
  const subtitleEl = document.getElementById('site-subtitle');

  if (titleEl    && site.title)    titleEl.textContent    = site.title;
  if (subtitleEl && site.subtitle) subtitleEl.textContent = site.subtitle;

  // Also update the <title> tag for the browser tab
  if (site.title) {
    document.title = site.title;
  }
}


// ###
// CARD BUILDER
// ###

/**
 * buildCard
 * Constructs and returns a complete card DOM element for one project.
 * Uses document.createElement throughout — no innerHTML for the main structure
 * so it's XSS-safe for any future dynamic data sources.
 *
 * @param {Object} project  — single project entry from JSON
 * @param {number} index    — position in the rendered list (used for animation stagger)
 * @returns {HTMLElement}
 */
function buildCard(project, index) {
  const card = document.createElement('article');
  card.className = 'card';

  // Featured cards get a top-border glow treatment (see CSS .card--featured)
  if (project.featured) {
    card.classList.add('card--featured');
  }

  // CSS custom property drives the animation stagger delay in CSS
  card.style.setProperty('--card-index', index);

  // Build each section and assemble
  card.appendChild(buildCardImage(project));

  const body = document.createElement('div');
  body.className = 'card__body';
  body.appendChild(buildCardTitle(project));
  body.appendChild(buildCardDesc(project));

  // Optional desktop note (e.g. "Desktop optimised.")
  if (project.note) {
    const note = document.createElement('p');
    note.className = 'card__note';
    note.textContent = project.note;
    body.appendChild(note);
  }

  card.appendChild(body);

  // Tags row (only if tags exist and array is non-empty)
  if (Array.isArray(project.tags) && project.tags.length > 0) {
    card.appendChild(buildCardTags(project.tags));
  }

  // Action row: Open button + optional Read More toggle + optional status badge
  card.appendChild(buildActionRow(project, card));

  // Accordion content panel (hidden by default)
  if (project.readMore) {
    card.appendChild(buildAccordion(project.readMore));
  }

  return card;
}


// ###
// CARD SECTION BUILDERS — each returns a DOM element
// ###

/**
 * buildCardImage
 * Renders the preview image (or a placeholder if no image is provided).
 * Adds an onerror handler so a broken image path degrades gracefully.
 */
function buildCardImage(project) {
  const wrap = document.createElement('div');
  wrap.className = 'card__image-wrap';

  // Anchor makes the whole thumbnail area a clickable link —
  // mirrors the same href/target logic as the Open button.
  const link = document.createElement('a');
  link.href = project.url || '#';
  link.setAttribute('aria-label', `Open ${project.title}`); // meaningful label for screen readers
  link.tabIndex = -1; // Open button already handles keyboard nav; skip duplicate tab stop

  if (project.openInNewTab) {
    link.target = '_blank';
    link.rel    = 'noopener noreferrer';
  }

  if (project.image) {
    const img = document.createElement('img');
    img.className = 'card__image';
    img.src = project.image;
    img.alt = `Preview of ${project.title}`;
    img.loading = 'lazy';

    // Fallback if the image path is wrong or file is missing
    img.onerror = () => {
      link.innerHTML = '';
      link.appendChild(createImagePlaceholder(project.title));
    };

    link.appendChild(img);
  } else {
    link.appendChild(createImagePlaceholder(project.title));
  }

  wrap.appendChild(link);
  return wrap;
}

/**
 * createImagePlaceholder
 * Returns a styled fallback div shown when an image is absent or broken.
 */
function createImagePlaceholder(title = '') {
  const ph = document.createElement('div');
  ph.className = 'card__image-placeholder';
  // Show project initials so the placeholder isn't completely blank
  ph.textContent = getInitials(title);
  return ph;
}

/**
 * getInitials
 * Returns up to 2 characters of initials from a project title.
 * "Celebrity Ascent Dining Planner" → "CA"
 */
function getInitials(title) {
  return title
    .split(' ')
    .slice(0, 2)
    .map(word => word[0] || '')
    .join('')
    .toUpperCase();
}

/** buildCardTitle — simple heading element */
function buildCardTitle(project) {
  const h2 = document.createElement('h2');
  h2.className = 'card__title';
  h2.textContent = project.title || 'Untitled Project';
  return h2;
}

/** buildCardDesc — short description paragraph */
function buildCardDesc(project) {
  const p = document.createElement('p');
  p.className = 'card__desc';
  p.textContent = project.description || '';
  return p;
}

/**
 * buildCardTags
 * Renders the row of pill-shaped tag chips.
 * @param {string[]} tags
 */
function buildCardTags(tags) {
  const row = document.createElement('div');
  row.className = 'card__tags';

  tags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag';
    chip.textContent = tag;
    row.appendChild(chip);
  });

  return row;
}

/**
 * buildStatusBadge
 * Returns a status badge element, or null if no valid status is set.
 * Looks up the STATUS_MAP to resolve label + CSS class.
 * @param {string} statusKey — raw value from JSON e.g. "live", "wip", "broken"
 * @returns {HTMLElement|null}
 */
function buildStatusBadge(statusKey) {
  if (!statusKey) return null;

  const statusDef = STATUS_MAP[statusKey.toLowerCase()];
  if (!statusDef) return null; // unknown status — skip silently

  const badge = document.createElement('span');
  badge.className = `status-badge ${statusDef.cls}`;

  // Coloured dot indicator
  const dot = document.createElement('span');
  dot.className = 'status-badge__dot';
  dot.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.textContent = statusDef.label;

  badge.appendChild(dot);
  badge.appendChild(label);

  return badge;
}

/**
 * buildActionRow
 * Contains:
 *   - "Open" button/link (always present)
 *   - "Read More" toggle button (only when readMore text exists)
 *   - Flexible spacer
 *   - Status badge (optional)
 *
 * @param {Object}      project  — project data
 * @param {HTMLElement} cardEl   — the parent card element (needed to target accordion)
 */
function buildActionRow(project, cardEl) {
  const row = document.createElement('div');
  row.className = 'card__action-row';

  // --- Open button ---
  const openBtn = document.createElement('a');
  openBtn.className = 'btn-open';
  openBtn.href = project.url || '#';

  // Respect the openInNewTab flag from JSON
  if (project.openInNewTab) {
    openBtn.target  = '_blank';
    openBtn.rel     = 'noopener noreferrer'; // security best practice for _blank
  }

  openBtn.innerHTML = `Open <span class="btn-open__arrow" aria-hidden="true">→</span>`;

  row.appendChild(openBtn);

  // --- Read More toggle (only if readMore content exists) ---
  if (project.readMore) {
    const rmBtn = document.createElement('button');
    rmBtn.className  = 'btn-readmore';
    rmBtn.type       = 'button';
    rmBtn.setAttribute('aria-expanded', 'false');
    rmBtn.innerHTML  = `Read More <span class="btn-readmore__chevron" aria-hidden="true">▾</span>`;

    // Wire up accordion toggle — closes over cardEl reference
    rmBtn.addEventListener('click', () => toggleAccordion(cardEl, rmBtn));

    row.appendChild(rmBtn);
  }

  // Spacer pushes status badge to the right
  const spacer = document.createElement('span');
  spacer.className = 'card__action-spacer';
  row.appendChild(spacer);

  // --- Status badge ---
  const badge = buildStatusBadge(project.status);
  if (badge) {
    row.appendChild(badge);
  }

  return row;
}

/**
 * buildAccordion
 * Constructs the hidden accordion panel. JS toggleAccordion() controls
 * the CSS class that animates it open/closed.
 * @param {string} readMoreText
 */
function buildAccordion(readMoreText) {
  const accordion = document.createElement('div');
  accordion.className = 'card__accordion';

  const inner = document.createElement('div');
  inner.className = 'card__accordion-inner';
  inner.textContent = readMoreText;

  accordion.appendChild(inner);
  return accordion;
}


// ###
// ACCORDION TOGGLE
// ###

/**
 * toggleAccordion
 * Called when the user clicks a "Read More" button.
 * Toggles CSS classes on:
 *   - .card__accordion — animates height via max-height transition
 *   - .btn-readmore   — rotates the chevron icon
 *
 * aria-expanded is kept in sync for screen readers.
 *
 * @param {HTMLElement} cardEl — the parent card (scope for the querySelector)
 * @param {HTMLElement} btn    — the Read More button that was clicked
 */
function toggleAccordion(cardEl, btn) {
  const accordion = cardEl.querySelector('.card__accordion');
  if (!accordion) return;

  const isOpen = accordion.classList.toggle('card__accordion--open');

  // Sync button visual state
  btn.classList.toggle('btn-readmore--open', isOpen);

  // Sync accessible state attribute
  btn.setAttribute('aria-expanded', String(isOpen));
}


// ###
// GRID UTILITY
// ###

/**
 * showGridMessage
 * Replaces the grid's content with a single-line message.
 * Used for loading, empty-state, and error cases.
 * @param {HTMLElement} grid
 * @param {string}      message
 * @param {boolean}     isError  — applies error styling when true
 */
function showGridMessage(grid, message, isError = false) {
  grid.innerHTML = '';
  const el = document.createElement('p');
  el.className = isError ? 'grid-message grid-message--error' : 'grid-message';
  el.textContent = message;
  grid.appendChild(el);
}

# Meal Planner – LLM Developer Guide

This document is intended to be read **by an LLM** before making any edit or
enhancement to the Menu Recommendation System.  It explains the purpose of
each file, the key data structures, naming conventions, and the rules to follow
when touching each layer.

---

## File Overview

| File | Role |
|------|------|
| `meal_planner.html` | Structure only – no logic, no inline styles |
| `meal_planner.css`  | All visual styling – no logic |
| `meal_planner.js`   | All state, data processing, and DOM updates |

The three files must always be served from the **same directory**.  The HTML
references the CSS via `<link rel="stylesheet" href="meal_planner.css">` and
the JS via `<script src="meal_planner.js"></script>` (placed just before
`</body>`).

---

## Data Model

The app loads a single JSON file uploaded by the user.  The canonical shape is:

```json
{
  "currentNight": 6,
  "clsCustom":  { "s": [], "e": [], "d": [] },
  "exclCustom": { "s": [], "e": [], "d": [] },
  "nights": [
    {
      "dining": "Cyprus",
      "sigCustom": { "s": [], "e": [], "d": [] },
      "tags": {
        "SIG||Aged Prime Rib of Beef": {
          "diners": ["me"],
          "feat": true,
          "cat": "e"
        },
        "Cyprus||Arugula Salad": {
          "diners": [],
          "feat": false,
          "cat": "s"
        }
      }
    }
  ]
}
```

### Tag key format

Every key in `nights[].tags` follows the pattern `"<location>||<dish name>"`.
The `||` is the delimiter.  **Always use `parseDishKey(key)`** to split a raw
key — never split on `|` manually, as dish names may contain single pipes.

**Valid location prefixes:**

| Location | Meaning |
|----------|---------|
| `SIG` | Signature restaurant — **high priority** in recommendations |
| `Cyprus` | Cyprus dining room |
| `Cosmopolitan` | Cosmopolitan dining room |
| `Normandie` | Normandie dining room |
| `CLS` | CLS dining menu available at any room |
| `Tuscan` | Tuscan dining room |

### Key field definitions

| Field | Type | Meaning |
|-------|------|---------|
| `currentNight` | `number` | Index of the cruise night currently in progress |
| `clsCustom` | `{s,e,d}` | Global starters / entrees / desserts that apply to every night |
| `exclCustom` | `{s,e,d}` | Dishes excluded globally across all nights |
| `nights[].dining` | `string` | Name of the restaurant / venue for that night |
| `nights[].tags` | `object` | Dictionary keyed as `"<location>\|\|<dish name>"` |
| `tag.diners` | `string[]` | **Array of diner names who picked this dish** — this is what "tagging" means |
| `tag.feat` | `boolean` | `true` = this dish is featured; diners' preference for it is honoured by mandatory selection |

### Diner list

The canonical diner list lives in `meal_planner.js`:

```js
const allDiners = ["kid1", "wife", "kid2", "me"];
```

Edit this array when the party changes.  The recommendation engine uses it as
the universe of people who must be covered.

---

## meal_planner.html

### What it contains
- The semantic shell: `<header>`, `<main>`, `<footer>`, and the `.container` wrapper.
- A file-upload control (`#fileInput`) and its status message (`#status`).
- Four **empty placeholder `<div>`s** that JavaScript fills at runtime:
  - `#overview` – Global config cards (CLS Custom, Exclusions)
  - `#nights`   – Per-night accordion panels
  - `#recommendations` – Recommendation output
- The "Generate" button (`#generateBtn`).

### Rules when editing this file
1. **Do not add `<style>` blocks.**  All CSS belongs in `meal_planner.css`.
2. **Do not add `<script>` blocks.**  All JS belongs in `meal_planner.js`.
3. Keep the four placeholder `<div>` IDs (`overview`, `nights`, `recommendations`,
   `content`) unchanged – the JS targets them by ID.
4. If you add a new UI section that needs to be shown/hidden after file load,
   place it inside `#content` so it inherits the `display:none` → `display:block`
   toggle that runs on successful file load.
5. Structural comments (`<!-- Populated by … -->`) should be kept or updated
   to describe which JS function writes to each placeholder.

---

## meal_planner.css

### Organisation
Sections are separated by comments and follow this order:

1. Base / Layout
2. Header
3. Main content area
4. Upload section
5. Generic section / card layout
6. Nights accordion
7. Tags table
8. `.feat` badge  ← used in both the table and the recommendations list
9. Recommendations section
10. Footer

### Key classes

| Class | Used for |
|-------|----------|
| `.container` | Outer white card, max 960 px |
| `.upload-section` | Dashed upload drop-zone |
| `.upload-btn` | Blue label styled as a button |
| `.custom-card` | Card for CLS Custom / Exclusions |
| `.custom-grid` | Responsive 2-up grid for cards |
| `.nights-container` | Flex column holding `<details>` accordions |
| `.night-content` | Padded body inside each accordion |
| `.feat` | Amber pill badge for featured dishes |
| `.night-recommendation` | Green-bordered card per night in recommendations |
| `.recommended-items` | Unstyled list inside a recommendation card |

### Rules when editing this file
1. Colour palette uses Tailwind-equivalent hex values.  Keep changes
   consistent with the existing blue (`#1e40af` / `#3b82f6`), green
   (`#15803d` / `#166534`), and amber (`#854d0e`) palette.
2. The `.feat` class is reused in two separate sections; update it in one
   place and both will reflect the change.
3. Do not add JavaScript or `<style>` tags.
4. Media queries should be added **at the bottom** of the file with a
   `/* --- Responsive ---- */` comment header.

---

## meal_planner.js

### Global state & constants

| Name | Type | Purpose |
|------|------|---------|
| `menuData` | `object \| null` | The parsed JSON; `null` until a file is loaded.  Also exposed as `window.menuData`. |
| `allDiners` | `string[]` | Canonical list of every diner.  Used as the coverage universe. |
| `SIG_PRIORITY` | `number` (0.5) | Fractional bonus added to a SIG item's greedy score.  Raises SIG items above non-SIG items in a tie without overriding a non-SIG item that covers more uncovered diners. |
| `dinerHistory`    | `{s,e,d} → {diner → Set<string>}` | Tracks dishes already eaten by each diner per course to minimise repeats |

### Functions

#### `escapeHtml(unsafe)`
Sanitises any string before inserting it into `innerHTML`.  **Always call this
on user-supplied or data-driven strings.**

#### `parseDishKey(key)`
Splits a raw tag key on `||` and returns `{ location, dishName }`.  If no `||`
is found, `location` is `''` and `dishName` is the full key.  **Use this
everywhere a tag key needs to be displayed or compared — never split manually.**

```js
parseDishKey("SIG||Aged Prime Rib of Beef")
// → { location: "SIG", dishName: "Aged Prime Rib of Beef" }

parseDishKey("Cyprus||Arugula Salad")
// → { location: "Cyprus", dishName: "Arugula Salad" }
```

#### `renderCustomSection(title, customObj)`
Builds one `.custom-card` HTML string for a `{s, e, d}` object.  Used by
`renderOverview()` for both `clsCustom` and `exclCustom`.

#### `renderOverview()`
Writes to `#overview`.  Renders the two global config cards plus the
`currentNight` reference.

#### `renderNights()`
Writes to `#nights`.  For each night it builds a `<table>` with four columns:

| Column | Source |
|--------|--------|
| Location | `parseDishKey(key).location` — displayed in blue bold for SIG, grey for others |
| Dish Name | `parseDishKey(key).dishName` |
| Diners | `tag.diners.join(', ')` — names of diners who picked this dish |
| Featured | `.feat` badge when `tag.feat === true` |

SIG rows receive a blue left-border (`border-left: 3px solid #3b82f6`) so they
are visually prominent as high-priority items.

Optionally appends a SIG Custom block if `night.sigCustom` is non-empty.

#### `computeRecommendations()`
Generates one clean table per night (diners as columns, courses as rows).

**Core assignment priorities (2026-03-11 version):**

1. Featured items tagged by a diner **and** available on the current night/location → highest priority
2. Any item explicitly tagged by the diner on this night
3. SIG items available tonight (bonus +90)
4. Other current-location items
5. Generic featured items (lowest bonus +25)
6. Hard constraint: no dish repeats for the same diner in the same course across nights
7. Exactly one dish per course per diner (max 1 extra starter only if needed for featured)

After all nights, a **summary section** lists:
- Featured items not assigned on nights where they appeared
- Tags that were not satisfied for specific diners on specific nights

This helps identify remaining gaps that may require manual adjustment or relaxing repeat rules.


**Tier 1 — Featured items** (`tag.feat === true`)
Always selected regardless of location.  A diner's choice to tag a featured
item represents a direct preference that is always honoured.

**Tier 2 — SIG items** (non-featured, `location === 'SIG'`)
Receive a `SIG_PRIORITY` (0.5) bonus added to their diner-coverage score in the
greedy loop.  This means:
- A SIG item beats a non-SIG item when they cover the same number of diners.
- A non-SIG item that covers at least 1 more uncovered diner still wins.
- To make SIG always dominate regardless of coverage, raise `SIG_PRIORITY`
  to `allDiners.length` or higher.

**Tier 3 — All other locations**
Scored purely by the count of still-uncovered diners reached.

Each recommendation card shows a blue `SIG` pill, amber `FEATURED` badge,
and grey location label alongside the dish name.

**Important:** "Tagging" means a diner chose that dish.  `tag.diners.length` is
the coverage population, not a tag count.

### Event listeners

| Listener | Trigger | Action |
|----------|---------|--------|
| `#fileInput` `change` | User selects a `.json` file | Reads, parses, validates, calls `renderOverview()` + `renderNights()`, shows `#content` |
| `#generateBtn` `click` | User clicks "Generate" button | Calls `computeRecommendations()` with a brief UI-repaint delay |

### Rules when editing this file
1. Always call `escapeHtml()` before writing any data value into `innerHTML`.
2. Always call `parseDishKey()` to split tag keys — never access `location` or
   `dishName` by splitting on `|` manually.
3. `allDiners` is the single source of truth for the diner universe.  Do not
   hard-code diner names elsewhere.
4. `SIG_PRIORITY` is the single place to tune SIG vs non-SIG weighting.
5. `menuData` is `null` before file load; guard any function that accesses it.
6. If you add a new render function, wire it up inside the `fileInput` `change`
   handler alongside `renderOverview()` and `renderNights()`.
7. Keep `window.menuData = menuData` after a successful load so console-side
   experimentation and custom extensions remain possible.
8. The `computeRecommendations()` function is intentionally separate from the
   file-load handler so it can be re-run without re-uploading.

---

## Common Enhancement Patterns

### Add a new diner
Edit `allDiners` in `meal_planner.js`:
```js
const allDiners = ["kid1", "wife", "kid2", "me", "guest"];
```

### Add a new location prefix
No code change required — `parseDishKey()` is location-agnostic.  To give the
new location a distinct visual style in the nights table, add a colour mapping
inside the `renderNights()` `locDisplay` expression.

### Make SIG always dominate (regardless of diner coverage)
Raise `SIG_PRIORITY` in `meal_planner.js` to `allDiners.length` or higher:
```js
const SIG_PRIORITY = allDiners.length; // SIG always beats any non-SIG
```

### Add a new data column to the nights table
In `renderNights()`, extend the `<thead>` row and add a matching `<td>` inside
the `Object.entries(night.tags).forEach` loop.  Use `parseDishKey(key)` to
access `location` and `dishName`.

### Change the recommendation algorithm
Replace or extend the greedy loop inside `computeRecommendations()`.  Each
item in the `items` array exposes `{ key, location, dishName, diners (Set),
feat, isSig }`.

### Add a new global config section
1. Add a new `<div id="mySection"></div>` inside `#content` in `meal_planner.html`.
2. Write a `renderMySection()` function in `meal_planner.js` that writes to
   `document.getElementById('mySection')`.
3. Call `renderMySection()` inside the `fileInput` `change` handler.
4. Add any new classes to `meal_planner.css` under an appropriate comment block.

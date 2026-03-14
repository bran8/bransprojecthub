Here is the **updated algorithm** for generating the 10-night dinner meal plan, revised to align with the provided JSON schema (draft 2020-12) and incorporating all previously discussed constraints.

### Core Constraints (Summarized from Schema and Prior Discussion)

- 10 nights, 4 diners: `kid1`, `wife`, `kid2`, `me`
- Each diner receives a 3-course meal every night (starter, entree, dessert)
- **Multiple starters allowed per diner per night** (no hard limit, but practically ≤ 2–3 to avoid excess)
- **Starter repeat cooldown**: same starter dish may be repeated for the same diner only after ≥ 2 full nights gap (i.e., earliest reuse on night n+3)
- **Featured items** (`feat: true`) must be assigned **at least once** during the trip (to any diner, on any night where available)
- **Tagged items** should be preferentially assigned to the diners who tagged them on that night
- **Desserts**: aim for **≥ 3 unique desserts** per night across the 4 diners
- **Menu item keys** in `tags` follow pattern: `menuType||itemName` or `menuType\n\nitemName` (delimiter `||` or double newline)
- **Course category** is explicitly stored in `cat` (`s`, `e`, `d`)
• The tags object is the **primary source** of menu items and user preferences.
• Prefixes in tags keys indicate availability scope:
  - SIG||…   → available on SIG nights
  - CLS||…   → available every night (Classic menu baseline)
  - Normandie||…, Tuscan||…, Cyprus||…, Cosmopolitan||… → available when dining location matches
• sigCustom, clsCustom, exclCustom are **supplemental** and usually empty or minor.
### Updated Algorithm (Greedy Heuristic with Cooldown & Multi-Starter Support)

#### 1. Data Preparation (Preprocessing)

- Load JSON object → `data`
- Diners = `["kid1", "wife", "kid2", "me"]`
- Courses = `["s", "e", "d"]`
- Nights = 0 to 9 (0-based indexing)

**History tracking** (per diner, per course):

```typescript
interface HistoryEntry { dish: string; night: number; }
type History = Record<string, Record<"s"|"e"|"d", HistoryEntry[]>>;
```

Initialize empty arrays for each diner × course.

**Global featured set**:

```typescript
const featured = new Set<string>();
for (const night of data.nights) {
  for (const [key, item] of Object.entries(night.tags || {})) {
    if (item.feat) featured.add(key);
  }
}
```

**Coverage tracking**:

```typescript
const coveredFeatured = new Set<string>();
```

#### 2. Per-Night Processing (Night 0 to 9)

For each `nightIdx` ∈ [0, 9]:

- `night = data.nights[nightIdx]`
- Determine available menu:

  ```typescript
// ───────────────────────────────────────────────
// Determine available items for this night
// ───────────────────────────────────────────────

const location = night.dining;  // e.g. "Cosmopolitan", "SIG", "Normandie", etc.

let available: Record<"s"|"e"|"d", string[]> = { s: [], e: [], d: [] };

// All items tagged this night are potentially available
// (regardless of custom buckets — tags is the primary source)
for (const [key, meta] of Object.entries(night.tags || {})) {
  const [prefix, dishName] = key.split("||");
  
  // Always include items from current location
  if (prefix === location || prefix === "SIG") {
    if (!available[meta.cat].includes(dishName)) {
      available[meta.cat].push(dishName);
    }
  }
  
  // Always include Classic (CLS) items on every non-SIG night
  if (prefix === "CLS" && location !== "SIG") {
    if (!available[meta.cat].includes(dishName)) {
      available[meta.cat].push(dishName);
    }
  }
}

// Optional: merge any non-empty exclCustom / clsCustom buckets
// (treat as always-available supplements)
if (data.clsCustom) {
  for (const cat of ["s","e","d"] as const) {
    for (const item of data.clsCustom[cat] || []) {
      const name = typeof item === "string" ? item : item.n;
      if (!available[cat].includes(name)) available[cat].push(name);
    }
  }
}
if (data.exclCustom) {
  // same logic as above for exclCustom
}

  // Optional: merge exclCustom into all buckets if desired
  ```

- `normalizeItem(item)`: extract plain string name (handle both `string` and `{n: string, v?: number}` forms)

- Extract this night's **tagged items**:

  ```typescript
  const tagsThisNight: Record<string, { diners: string[]; feat: boolean; cat: "s"|"e"|"d" }> = night.tags || {};
  ```

- Identify **must-cover featured items this night** (still uncovered + available):

  ```typescript
  const mustCoverThisNight = [...featured]
    .filter(key => !coveredFeatured.has(key))
    .filter(key => {
      const cat = tagsThisNight[key]?.cat;
      return cat && available[cat].includes(normalizeItemKey(key));
    });
  ```

#### 3. Assignment per Night

Initialize assignment:

```typescript
const planNight: Record<string, Record<"s"|"e"|"d", string[]>> = {};
for (const diner of diners) {
  planNight[diner] = { s: [], e: [], d: [] };
}
```

**Phase A: Force-assign still-uncovered featured items**

- Sort `mustCoverThisNight` by rarity (fewest taggers first)
- For each featured key:
  - Determine course `cat = tagsThisNight[key].cat`
  - Prefer diners who tagged it → `tagsThisNight[key].diners`
  - Fallback → any diner
  - Among candidates, choose diner for whom:
    - cooldown ok (if `cat === "s"`)
    - lowest repeat penalty
  - Assign → `planNight[chosenDiner][cat].push(key)`
  - `coveredFeatured.add(key)`
  - `history[chosenDiner][cat].push({ dish: key, night: nightIdx })`
// Skip assignment if the featured item is not available this night
// (i.e. prefix does not match current location or CLS)
const [prefix] = key.split("||");
if (prefix !== location && prefix !== "CLS" && prefix !== "SIG") continue;

**Phase B: Satisfy tags & preferences (per course)**

Process courses in order `s` → `e` → `d`

For each course `cat`:

- `avail = available[cat]`
- `taggedForCourse =` filter `tagsThisNight` where `item.cat === cat`

While desirable assignments remain possible:

1. Compute candidate (diner, dish) pairs with score:

   ```typescript
   score(diner: string, dish: string): number {
     let s = 0;

     // Base preference
     if (tagsThisNight[dish]?.diners.includes(diner)) s -= 60;     // strong tag bonus
     if (tagsThisNight[dish]?.feat)                     s -= 25;     // featured bonus

     // Repeat penalties
     if (cat === "s") {
       if (!canEatAgain(diner, dish, nightIdx, history)) s += 800;   // hard block
       else if (hasEatenBefore(diner, dish, history))    s += 20;    // mild repeat cost
     } else {
       if (hasEatenBefore(diner, dish, history))         s += 600;    // strong avoidance for e/d
     }

     return s;
   }
   ```

2. `canEatAgain(diner, dish, nightIdx, history)`:

   ```typescript
   const prev = history[diner][cat]
     .filter(e => e.dish === dish)
     .map(e => e.night);
   if (prev.length === 0) return true;
   return nightIdx - Math.max(...prev) >= 3;
   ```

3. Select highest-score (lowest number) valid pairs greedily until diminishing returns:
   - Prefer assignments that satisfy tags
   - Allow multiple starters per diner (no hard cap, but stop adding extras when marginal benefit < threshold, e.g., score > -20)

**Phase C: Dessert uniqueness adjustment**

After initial dessert assignments:

- Compute current unique count: `new Set(...planNight[*].d.flat())`
- While unique count < 3 and possible improvements exist:
  - Identify duplicated desserts
  - For diners with duplicated dessert, try re-assigning to unused available dessert
  - Accept reassignment if:
    - score acceptable
    - does not violate repeat rules
    - increases unique count

#### 4. Post-Processing & Validation

- After all nights: verify `coveredFeatured.size === featured.size`
- If misses remain → log warning + list uncovered featured items
- Optional second pass: re-run nights with missed featured items with increased priority

#### 5. Output Structure Suggestion

```typescript
{
  nights: [
    {
      night: 1,
      location: "Normandie",
      assignments: {
        kid1: { s: ["Shrimp Cocktail", "Soup du Jour"], e: ["Beef Wellington"], d: ["Crème Brûlée"] },
        // ...
      }
    },
    // ...
  ],
  stats: {
    featuredCoverage: 100,
    repeatStarters: 2,           // count of allowed repeats
    extraStarters: 7             // total extra starter orders across trip
  }
}
```

This formulation respects the schema structure, explicitly handles multiple starters with cooldown protection, enforces featured coverage opportunistically, prefers tag satisfaction, and maintains dessert variety. It remains computationally lightweight (suitable for client-side JavaScript).

Please review and advise if any priority weights, ordering rules, or handling of `exclCustom` require adjustment.

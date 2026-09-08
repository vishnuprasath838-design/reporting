# Data Model

How data flows through the app and how the core helpers behave. Targeted at developers extending or debugging `app.js`.

---

## The `state` object (`app.js:75`)

A single global holds everything the app knows:

```js
const state = {
  currentStep: 1,
  selectedRegions: new Set(),        // region keys: 'UK' | 'US' | 'EU' | 'CH' | 'IE' | 'NON-EU'
  selectedRegionTag: 'Custom',       // short tag for filenames/UI e.g. 'ALL', 'UK+IE'
  selectedRegionLabel: 'No Region Selected',
  rawData: [],                       // untouched rows as objects, from Step 2 upload
  workingData: [],                   // the live dataset every step edits
  dynamicSchema: [...OUTPUT_SCHEMA], // column list; renamed/added/removed during processing
  fileName: '',
  originalCount: 0,                  // row count at upload
  removedByCountry: 0,
  removedByRules: 0,
  selectedCountries: new Set(),      // country names for the Step 4 filter
  rules: [...],                      // account rules (deep copy of DEFAULT_RULES)
  yesterdayAoA: [],                  // yesterday report as array-of-arrays
  yesterdayLookup: new Map(),        // normalised Trial AWB -> yesterday row
  qvmAoA: [],                        // QVM file as array-of-arrays
  qvmLookup: new Map(),              // normalised Trial AWB -> QVM row
  rowColors: new Map(),              // working row index -> colour key ('yellow'|'purple'|'red'|'orange'|'blue')
  processLog: [],                    // log entries rendered on Step 7
  processDone: false,
};
```

- `rawData` and `workingData` are structurally identical objects-keyed rows. Step 3 (`applyColumnClean`) **replaces** `workingData` with the remapped schema; `rawData` stays pristine (used by `Start Over`).
- `rowColors` keys are indices into `workingData`. When sub-step 9 filters rows it **remaps** the indices so they stay valid.

## Input schema (what the upload may contain)

Any columns — Step 3 matches purely by normalised **header name** to the output schema and copies matching columns. Columns that have no match are simply dropped. `EXP DATE` is always created empty.

## Output schema — the 19 columns (`OUTPUT_SCHEMA`, `app.js:9`)

```js
['Trial AWB', 'Description', 'UPS Tracking', 'MAWB',
 'Ch To key', 'Group A c Name', 'Sched Collection date',
 'Collection Date', 'Sched Delivery date', 'Charge Reference',
 'Collection Country', 'Delivery Country', 'Collection Town',
 'Delivery Town', 'EXP DATE', 'Latest Dry Ice Replenishment',
 'Contents Description', 'Temperature', 'Packaging Type Size']
```

### Schema changes during processing

| Where | Change |
|-------|--------|
| Step 3 (column remap) | `dynamicSchema = OUTPUT_SCHEMA` (EXP DATE created empty) |
| Pipeline sub-step 3 (1Z) | `UPS Tracking` renamed → `UPS Tracking/MAWB` |
| Pipeline sub-step 5 (MAWB) | `MAWB` removed from schema and all rows |
| Pipeline sub-step 7 (packaging) | blank-header comment column inserted after `Packaging Type Size` |

## Core helpers

| Helper | Location | Behaviour |
|--------|----------|-----------|
| `norm(s)` | `app.js:112` | Trim → lowercase → collapse internal whitespace. Used for **every** comparison and lookup key, so values are compared case/whitespace-insensitively. |
| `isNA(val)` | `app.js:114` | Treats `null`, `undefined`, `''`, `'n/a'`, `'na'`, `'#n/a'` as empty. **`0` is NOT treated as empty** (it may be a valid value). |
| `countUp(el, target)` | `app.js:122` | Animated number ticker for sidebar stats. |
| `parseDateValue(val)` | `app.js:137` | Accepts `Date`, Excel serial number (via `XLSX.SSF`), `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY-MM-DD`, and a generic `new Date(s)` fallback. Returns `null` for blank/N/A/`0`/unparseable. |
| `buildLookup(aoa)` | `app.js:173` | Skips header row, indexes `aoa[i][0]` (column A → Trial AWB) normalised as the key, whole row as the value. |
| `parseFileAsAoA(file)` | `app.js:184` | Reads a file with SheetJS and converts the first sheet to an array-of-arrays (`defval: ''`). |

## Reference-file row format

Both reference files are arrays-of-arrays (headers in row 0). Column accessors are 0-based indices via `YESTERDAY_COLUMNS` (`app.js:104`):

| Index | Column | Meaning |
|-------|--------|---------|
| 0 | A | Trial AWB (lookup key for every join) |
| 1 | B | Description |
| 2 | C | UPS Tracking |
| 12 | M | EXP DATE |
| 17 | R | Colour / comment letter |

## Date handling in sub-step 9

Collection Date parsing order: `Collection Date` → if N/A, `Sched Collection date`. Unparseable or future (> today 23:59:59) → row deleted. The comparison uses wall-clock time, so results are date-dependent by design.
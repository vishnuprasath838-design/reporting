# Function Map

Index of everything defined in `app.js` — constants, state, and every function with its current location. Line numbers are accurate as of the current revision; search for the name to find it if they drift.

---

## Constants & state (module level)

| Symbol | Line | Description |
|--------|------|-------------|
| `OUTPUT_SCHEMA` | 9 | 19-column output schema (Step 3 remap target) |
| `EU_COUNTRIES` | 18 | EU member-state aliases |
| `UK_COUNTRIES` | 27 | UK aliases (UK, GB, England, …) |
| `US_COUNTRIES` | 32 | US aliases (US, USA, …) |
| `CH_COUNTRIES` | 36 | Switzerland aliases |
| `IE_COUNTRIES` | 40 | Ireland aliases |
| `REGION_NAMES` | 44 | Display labels for region keys |
| `DEFAULT_RULES` | 53 | Pre-loaded account rules |
| `COLOR_ARGB` | 60 | Colour key → Excel ARGB hex |
| `PKG_COLOR_MAP` | 68 | Comment letter → colour key |
| `CHARGE_REF_ORANGE` | 69 | Charge References that trigger orange |
| `state` | 75 | Global application state (see [data-model.md](data-model.md)) |
| `YESTERDAY_COLUMNS` | 104 | 0-based indexes into the yesterday report |

---

## Helpers

| Function | Line | Purpose |
|----------|------|---------|
| `norm(s)` | 112 | Lowercase + trim + collapse whitespace; used for all comparisons |
| `isNA(val)` | 114 | True for blank / `N/A` / `na` / `#N/A` (not `0`) |
| `countUp(el, target)` | 122 | Animated number ticker for the sidebar stats |
| `parseDateValue(val)` | 137 | Parse a value to `Date`; `null` if blank/invalid (see [data-model.md](data-model.md)) |
| `buildLookup(aoa)` | 173 | Index an AoA on column A (Trial AWB) → lookup Map |
| `parseFileAsAoA(file)` | 184 | Read a file to array-of-arrays via SheetJS |

---

## Navigation & chrome

| Function | Line | Purpose |
|----------|------|---------|
| `goToStep(n)` | 203 | Show panel `n`, update the step rail (also sets `state.currentStep`) |
| `updateSidebar()` | 217 | Refresh "working rows / removed" stats with count-up animation |
| `showToast(msg, type)` | 238 | Show a transient toast notification |
| `initDateDisplay()` | 1286 | Print today's date in the header |
| `initDarkMode()` | 1300 | Dark/light toggle, persisted under `brand-theme` |

## Step 1 — Region selection

| Function | Line | Purpose |
|----------|------|---------|
| `initRegionSelection()` | 249 | Wire region cards, quick-combination buttons, Continue button |
| `updateRegionSelectionUI()` | 306 | Reflect selection on cards, pill, labels; derive `selectedRegionTag`/`selectedRegionLabel` |
| `configureRegionCountries()` | 345 | Rebuild `selectedCountries` from the selected regions |

## Step 2 — Upload

| Function | Line | Purpose |
|----------|------|---------|
| `initUpload()` | 362 | Wire drag & drop / browse zone and Step 2 nav buttons |
| `handleFile(file)` | 381 | Read the workbook, populate `rawData` + `workingData`, show file info |

## Step 3 — Columns

| Function | Line | Purpose |
|----------|------|---------|
| `initColumns()` | 415 | Wire Step 3 nav buttons |
| `applyColumnClean()` | 420 | Remap rows into `OUTPUT_SCHEMA` by matching normalised header names |

## Step 4 — Country filter

| Function | Line | Purpose |
|----------|------|---------|
| `initCountryFilter()` | 446 | Wire select-all/deselect-all and nav buttons |
| `getActiveCountryList()` | 460 | Expand selected regions into a flat country list |
| `renderCountryGrid()` | 472 | Render the country grid (selected state + counters) |
| `toggleCountry(item, country)` | 499 | Toggle one country's selection |
| `updateCountryCount()` | 505 | Update the selected/total counters |
| `applyCountryFilter()` | 511 | Keep rows whose Delivery Country matches; handle ALL / NON-EU logic |

## Step 5 — Account rules

| Function | Line | Purpose |
|----------|------|---------|
| `initRules()` | 559 | Wire rule form, add button, nav buttons |
| `renderRules()` | 566 | Render rule cards + delete buttons |
| `addRule()` | 592 | Push a new rule from the form inputs |
| `applyRules()` | 609 | Remove rows whose Ch To key matches a rule but town isn't allowlisted |

## Step 6 — Reference files

| Function | Line | Purpose |
|----------|------|---------|
| `initRefFiles()` | 637 | Wire yesterday/QVM upload slots, nav buttons; reset processing state |
| `enableRefDragDrop(type)` | 665 | Optional drag & drop for reference slots |
| `handleRefFile(file, type)` | 681 | Parse reference file to AoA + build `*Lookup` Map; unlock Run Processing |
| `updateRefSlot(type, fileName, rows)` | 724 | Show a loaded badge for a reference slot |

## Step 7 — Processing

| Function | Line | Purpose |
|----------|------|---------|
| `initProcessing()` | 737 | Wire Run / Continue buttons |
| `addLogEntry(type, title, msg, icon)` | 746 | Append a log entry and re-render |
| `renderProcessLog(entries)` | 757 | Render the processing log card list |
| `runProcessing()` | 781 | **The pipeline** — runs all 9 sub-steps (see [processing-pipeline.md](processing-pipeline.md)) |
| `tick()` | 1073 | Small delay helper that keeps the UI responsive between sub-steps |

## Step 8 — Export

| Function | Line | Purpose |
|----------|------|---------|
| `renderExport()` | 1079 | Fill summary cards + first-10 preview table with colours |
| `initExport()` | 1116 | Wire download + start-over buttons |
| `downloadFile()` | 1121 | Build the `.xlsx` with ExcelJS (frozen header, borders, auto-filter, fills) and trigger download |
| `startOver()` | 1240 | Reset `state`, UI slots, and rules; go back to Step 1 |

---

## Bootstrap

| Function | Line | Purpose |
|----------|------|---------|
| `#DOMContentLoaded` handler | 1321 | Calls every `init*` in order, then `goToStep(1)` |

---

## Suggested reading order for a new developer

1. `config-reference.md` — what's configurable and where
2. `data-model.md` — `state`, schemas, helpers
3. `function-map.md` (this file) — where everything lives
4. `workflow.md` — the user journey these functions implement
5. `processing-pipeline.md` — the only place with real data-transform complexity
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
| `APP_GUIDE` | 79 | In-app flow-chart copy (8 steps + 9 sub-steps); source of truth for the App Guide overlay |
| `state` | 180 | Global application state (see [data-model.md](data-model.md)) |
| `YESTERDAY_COLUMNS` | 209 | 0-based indexes into the yesterday report |

---

## Helpers

| Function | Line | Purpose |
|----------|------|---------|
| `norm(s)` | 217 | Lowercase + trim + collapse whitespace; used for all comparisons |
| `isNA(val)` | 219 | True for blank / `N/A` / `na` / `#N/A` (not `0`) |
| `countUp(el, target)` | 227 | Animated number ticker for the sidebar stats |
| `parseDateValue(val)` | 242 | Parse a value to `Date`; `null` if blank/invalid (see [data-model.md](data-model.md)) |
| `buildLookup(aoa)` | 278 | Index an AoA on column A (Trial AWB) → lookup Map |
| `parseFileAsAoA(file)` | 289 | Read a file to array-of-arrays via SheetJS |

---

## Navigation & chrome

| Function | Line | Purpose |
|----------|------|---------|
| `goToStep(n)` | 308 | Show panel `n`, update the step rail (also sets `state.currentStep`) |
| `updateSidebar()` | 322 | Refresh "working rows / removed" stats with count-up animation |
| `showToast(msg, type)` | 343 | Show a transient toast notification |
| `initDateDisplay()` | 1391 | Print today's date in the header |
| `initDarkMode()` | 1613 | Dark/light toggle, persisted under `brand-theme` |

## Step 1 — Region selection

| Function | Line | Purpose |
|----------|------|---------|
| `initRegionSelection()` | 354 | Wire region cards, quick-combination buttons, Continue button |
| `updateRegionSelectionUI()` | 411 | Reflect selection on cards, pill, labels; derive `selectedRegionTag`/`selectedRegionLabel` |
| `configureRegionCountries()` | 450 | Rebuild `selectedCountries` from the selected regions |

## Step 2 — Upload

| Function | Line | Purpose |
|----------|------|---------|
| `initUpload()` | 467 | Wire drag & drop / browse zone and Step 2 nav buttons |
| `handleFile(file)` | 486 | Read the workbook, populate `rawData` + `workingData`, show file info |

## Step 3 — Columns

| Function | Line | Purpose |
|----------|------|---------|
| `initColumns()` | 520 | Wire Step 3 nav buttons |
| `applyColumnClean()` | 525 | Remap rows into `OUTPUT_SCHEMA` by matching normalised header names |

## Step 4 — Country filter

| Function | Line | Purpose |
|----------|------|---------|
| `initCountryFilter()` | 551 | Wire select-all/deselect-all and nav buttons |
| `getActiveCountryList()` | 565 | Expand selected regions into a flat country list |
| `renderCountryGrid()` | 577 | Render the country grid (selected state + counters) |
| `toggleCountry(item, country)` | 604 | Toggle one country's selection |
| `updateCountryCount()` | 610 | Update the selected/total counters |
| `applyCountryFilter()` | 616 | Keep rows whose Delivery Country matches; handle ALL / NON-EU logic |

## Step 5 — Account rules

| Function | Line | Purpose |
|----------|------|---------|
| `initRules()` | 664 | Wire rule form, add button, nav buttons |
| `renderRules()` | 671 | Render rule cards + delete buttons |
| `addRule()` | 697 | Push a new rule from the form inputs |
| `applyRules()` | 714 | Remove rows whose Ch To key matches a rule but town isn't allowlisted |

## Step 6 — Reference files

| Function | Line | Purpose |
|----------|------|---------|
| `initRefFiles()` | 742 | Wire yesterday/QVM upload slots, nav buttons; reset processing state |
| `enableRefDragDrop(type)` | 770 | Optional drag & drop for reference slots |
| `handleRefFile(file, type)` | 786 | Parse reference file to AoA + build `*Lookup` Map; unlock Run Processing |
| `updateRefSlot(type, fileName, rows)` | 829 | Show a loaded badge for a reference slot |

## Step 7 — Processing

| Function | Line | Purpose |
|----------|------|---------|
| `initProcessing()` | 842 | Wire Run / Continue buttons |
| `addLogEntry(type, title, msg, icon)` | 851 | Append a log entry and re-render |
| `renderProcessLog(entries)` | 862 | Render the processing log card list |
| `runProcessing()` | 886 | **The pipeline** — runs all 9 sub-steps (see [processing-pipeline.md](processing-pipeline.md)) |
| `tick()` | 1178 | Small delay helper that keeps the UI responsive between sub-steps |

## Step 8 — Export

| Function | Line | Purpose |
|----------|------|---------|
| `renderExport()` | 1184 | Fill summary cards + first-10 preview table with colours |
| `initExport()` | 1221 | Wire download + start-over buttons |
| `downloadFile()` | 1226 | Build the `.xlsx` with ExcelJS (frozen header, borders, auto-filter, fills) and trigger download |
| `startOver()` | 1345 | Reset `state`, UI slots, and rules; go back to Step 1 |

---

## App Guide overlay

| Function | Line | Purpose |
|----------|------|---------|
| `excelColLetter(n)` | 1402 | 0-based column index → Excel column letter (A, B, C, …) |
| `argbToHex(argb)` | 1413 | Excel ARGB → `#RRGGBB` for the swatch chips |
| `guideLiveRegions()` | 1417 | Live region → country-alias count pills (from the region lists) |
| `guideLiveSchema()` | 1429 | Live `OUTPUT_SCHEMA` pill list |
| `guideLiveRules()` | 1434 | Live `DEFAULT_RULES` table |
| `guideLiveRefCols()` | 1442 | Live yesterday-report column table (from `YESTERDAY_COLUMNS`) |
| `guideLiveColors(includeChargeRefs)` | 1457 | Live colour swatches + orange charge-reference pills |
| `guideScrollToSelected(id)` | 1473 | Auto-scroll on selection: flow node into view (desktop) or detail card into view (≤880px stacked) |
| `selectGuideStep(id)` | 1485 | Highlight the flow node and render the detail card (static prose + live sections) |
| `renderGuideFlow()` | 1523 | Build the flow chart: 8 step nodes, connector line, Step 7's collapsible 9 sub-steps |
| `initAppGuide()` | 1580 | Wire trigger button / FAB / overlay open-close (Esc, backdrop) |

---

## Bootstrap

| Function | Line | Purpose |
|----------|------|---------|
| `#DOMContentLoaded` handler | 1634 | Calls every `init*` in order (incl. `initAppGuide()`), then `goToStep(1)` |

---

## Suggested reading order for a new developer

1. `config-reference.md` — what's configurable and where
2. `data-model.md` — `state`, schemas, helpers
3. `function-map.md` (this file) — where everything lives
4. `workflow.md` — the user journey these functions implement
5. `processing-pipeline.md` — the only place with real data-transform complexity
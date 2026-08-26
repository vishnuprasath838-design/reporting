# Marken Report Formatter — Phase 2: Post-Processing Steps

Extends the existing 5-step cleansing wizard with 8 new automated steps.  
All steps run in the browser. Output is a fully coloured `.xlsx` file.

---

## Library Change

| Library | Purpose |
|---|---|
| SheetJS (`xlsx`) | Reading uploaded files (kept as-is) |
| **ExcelJS** (new, via CDN) | Writing the final `.xlsx` with full row background colours |

---

## New Wizard Steps (6–13)

### Step 6 — Upload Reference Files

User uploads two files on one screen:

| Upload Slot | File | Required? |
|---|---|---|
| A | **Yesterday's Report** | Required (used for steps 7, 8, 12, 13) |
| B | **QVM File** | Optional (used for step 10) |

Both files are parsed into lookup tables keyed by **Trial AWB** (column A / index 0).

---

### Step 7 — Description Enrichment

| What | Detail |
|---|---|
| Action | Add a temp column next to `Description` |
| Lookup key | `Trial AWB` value in each row |
| Source | Yesterday's report, **column index 2** (col B) |
| Outcome | Replace existing `Description` column values with looked-up values |
| Fallback | If no match found, keep original value |
| Cleanup | Delete old `Description`; rename pulled column → `Description` |

> [!NOTE]
> In the output schema `Description` is col 2. The lookup pulls col B (index 1) from yesterday's file. Please confirm if this is correct or if you want index 2 (col C).

---

### Step 8 — UPS Tracking Enrichment

| What | Detail |
|---|---|
| Action | Add a temp column next to `UPS Tracking` |
| Lookup key | `Trial AWB` value |
| Source | Yesterday's report, **column index 3** (col C), range_lookup = exact match |
| Outcome | Replace `UPS Tracking` values with looked-up values |
| Fallback | Keep original if no match |
| Cleanup | Delete old column; rename → `UPS Tracking` |

---

### Step 9 — Multi-1Z Tracking Consolidation

| What | Detail |
|---|---|
| Trigger | UPS Tracking cell contains a comma AND more than one token starting with `1Z` |
| Action | Extract all `1Z...` tokens; place them in a new `UPS Tracking/MAWB` column |
| Outcome | Old `UPS Tracking` column is deleted |
| Rows with only 1 tracking number | Value copied as-is into `UPS Tracking/MAWB` |

---

### Step 10 — QVM Lookup & N/A Backfill

| What | Detail |
|---|---|
| Prerequisite | QVM file uploaded in Step 6 |
| Action | Add temp column next to `UPS Tracking/MAWB` |
| Lookup key | `Trial AWB` value |
| Source | QVM file, **column index 2** |
| Filter 1 | Show all rows where pulled QVM value ≠ N/A |
| Filter 2 | From remaining rows where `UPS Tracking/MAWB` = N/A, copy QVM value into that cell |
| Cleanup | Delete temp QVM column |

> [!IMPORTANT]
> If no QVM file was uploaded in Step 6, this step is skipped automatically.

---

### Step 11 — MAWB → UPS/MAWB Backfill

Two passes:

**Pass A — Standard backfill:**
- Filter rows where `MAWB` has data (not blank, `0`, or `N/A`)
- Filter those rows where `UPS Tracking/MAWB` = `N/A`
- Copy `MAWB` value into `UPS Tracking/MAWB`

**Pass B — Routing rows:**
- Filter remaining rows where `Description` contains the word **"Routing"**
- If `UPS Tracking/MAWB` is still N/A and no tracking numbers exist
- Copy `MAWB` value into `UPS Tracking/MAWB`

**Cleanup:** Delete `MAWB` column.

---

### Step 12 — EXP DATE Lookup

| What | Detail |
|---|---|
| Lookup key | `Trial AWB` value |
| Source | Yesterday's report, **column index 13** |
| Post-filter | If pulled value is `0` or `N/A` → leave `EXP DATE` cell blank |

---

### Step 13 — Row Colour Coding (Packaging Type)

**Sub-step A — Packaging Type Size lookup:**
- VLOOKUP from yesterday's report, **column index 18**
- Add temp column next to `Packaging Type Size`

**Sub-step B — Colour rules (applied to entire row):**

| Value in pulled column | Row background colour |
|---|---|
| `Y` or `y` | 🟡 Yellow (`#FFF2CC`) |
| `P` or `p` | 🟣 Purple (`#E8D5F5`) |
| `R` or `r` | 🔴 Red (`#FFD7D7`) |
| `O` or `o` | 🟠 Orange (`#FFE5CC`) |

**Cleanup:** Delete the temp lookup column (keep the colour on the row).

---

### Step 14 — Row Colour Coding (Charge Reference fallback)

Applied **only** to rows that were NOT already coloured in Step 13.

| Charge Reference contains | Row background colour |
|---|---|
| `LT19062` | 🟠 Orange |
| `LT18925` | 🟠 Orange |
| `EP5770` | 🟠 Orange |

> [!IMPORTANT]
> **Open question:** Are there more Charge Reference → colour rules beyond these three? Please share the full list so I can hardcode them all. Also, will you need to add more in the UI, or is this list fixed?

---

## Updated Wizard Flow

```
1. Upload raw file
2. Column cleanup
3. Country filter
4. Account rules
5. ── Reference Files ──
6. Upload Yesterday's Report + QVM
7. Description lookup
8. UPS Tracking lookup
9. Multi-1Z consolidation → UPS Tracking/MAWB
10. QVM backfill
11. MAWB backfill
12. EXP DATE lookup
13. Row colours — Packaging Type
14. Row colours — Charge Reference
15. Final Export (coloured .xlsx)
```

---

## Technical Notes

- **N/A matching**: Will treat `"N/A"`, `"n/a"`, `"NA"`, `"#N/A"`, `""`, and `0` as "no value" consistently.
- **ExcelJS**: Used only for the final write so row background colours are embedded in the `.xlsx`.  
- **SheetJS**: Still used for all file *reading* (fast, battle-tested).
- **No server needed**: Everything runs in the browser.

---

## Open Questions

> [!IMPORTANT]
> 1. In **Step 7** (Description), col_index 2 means the **2nd column** of yesterday's file. Is that column B (index 1 in 0-based arrays)? Please confirm which column in yesterday's file holds the correct Description.
> 2. Are there more **Charge Reference** rules beyond LT19062, LT18925, EP5770?
> 3. For **Step 9** — if a cell has exactly 1 tracking number starting with `1Z` (no comma), should it be copied to `UPS Tracking/MAWB` as-is, or left blank?

---

## Verification Plan

### Manual
- Upload a sample yesterday's report + QVM and verify lookups match expected values
- Check multi-1Z rows consolidate correctly
- Check row colours appear in the downloaded `.xlsx`

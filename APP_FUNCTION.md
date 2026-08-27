# Marken Report Formatter — App Function Guide

A step-by-step walkthrough of how the Marken Precision Logistics Report Formatting Engine works.

---

## Overview

This is a browser-based tool that imports a raw Excel report, cleans and enriches it against reference files, colour-codes rows, and exports a formatted `.xlsx`. The workflow is broken into **8 sequential steps**, each a "panel" in the single-page app.

---

## The 8 Steps (Workflow)

| Step | Name | Purpose |
|------|------|---------|
| 1 | Region | Select one or more regions (UK, US, EU, CH, IE, NON-EU) |
| 2 | Upload | Import the raw Excel report (`.xlsx` / `.xls`) |
| 3 | Columns | Reorder/rename columns to match the required output schema |
| 4 | Country Filter | Keep only rows whose Delivery Country matches the selected regions |
| 5 | Account Rules | Remove rows whose Ch To key / town fails the allowlisted rules |
| 6 | Reference Files | Upload yesterday's report + optional QVM for enrichment |
| 7 | Processing | Run all enrichment, backfill, and colour-coding automatically |
| 8 | Export | Preview results and download the cleaned, colour-coded workbook |

---

## Step 1 — Region Selection

- Six region cards are shown: **UK, US, EU, CH, IE, NON-EU**.
- **Click once** to select a region, **click again** to deselect.
- Multiple cards can be selected to build a **custom combination** (e.g. UK + IE, US + UK + NON-EU).
- **Quick Combinations** buttons:
  - **Select ALL (Global)** — selects all 6 regions.
  - **UK + IE** — selects those two.
  - **US + UK + NON-EU** — selects those three.
  - **Clear** — deselects everything.
- A summary pill shows the current selection.
- **NON-EU** excludes UK, US, CH, IE (these countries have their own dedicated cards).
- The **Continue to Upload** button is disabled until at least one region is selected.

---

## Step 2 — Upload

- Drag & drop an Excel file, or click to browse (`.xlsx` / `.xls` only).
- On successful read the app shows a file-info card with:
  - File name
  - Row count & file size
  - Active sheet name
- The raw data is loaded and stored as the **original** dataset.
- **Continue to Columns** becomes available.

---

## Step 3 — Column Cleanup

- Columns are reordered to match the required **output schema** (19 columns).
- **EXP DATE** is added as a brand-new empty column.
- The output column order is shown:
  1. Trial AWB
  2. Description
  3. UPS Tracking
  4. MAWB
  5. Ch To key
  6. Group A c Name
  7. Sched Collection date
  8. Collection Date
  9. Sched Delivery date
  10. Charge Reference
  11. Collection Country
  12. Delivery Country
  13. Collection Town
  14. Delivery Town
  15. EXP DATE *(NEW)*
  16. Latest Dry Ice Replenishment
  17. Contents Description
  18. Temperature
  19. Packaging Type Size
- Click **Apply & Continue** to remap the data into this schema.

---

## Step 4 — Country Filter

- Shows a grid of countries for the selected region combination.
- Use **Select All** / **Deselect All** or click individual countries.
- The counter shows how many have been selected.
- **Filtering rule:** a row is kept only if its **Delivery Country** matches a selected country.
- Click **Apply Filter** — the count of removed rows is reported and the sidebar "Removed" stat updates.

---

## Step 5 — Account Rules

- Default rules are pre-loaded, e.g.:
  - `Ch To key` = US640 / US1537 → Delivery Town must be **Dublin**
  - `Ch To key` = US537 → Town must be Dublin / Hamburg / Mainz
  - `Ch To key` = MI1058 / SG1129 → Town must be **York**
  - `Ch To key` = CN1131 → Collection **or** Delivery Town must be Livingston
- Each rule can check **Delivery Town only** or the **Collection Town OR Delivery Town**.
- Rules can be deleted or new ones added via the form.
- **Filtering rule:** if a row's Ch To key matches a rule but its town is *not* allowlisted, the row is **removed**.

---

## Step 6 — Reference Files

Two optional/required reference uploads:

- **Yesterday's Report / Morning Report** *(required)* — used to enrich Description, UPS Tracking, EXP DATE, and row colours.
- **QVM File** *(optional)* — used to backfill missing UPS Tracking/MAWB numbers.

### Automatic enrichment steps shown:
1. Description refreshed from yesterday's report; "Courier Service" → N/A
2. UPS Tracking refreshed from yesterday's report
3. Multi-1Z tracking consolidated into UPS Tracking/MAWB
4. N/A tracking backfilled from QVM (if uploaded)
5. Remaining N/A backfilled from MAWB, then MAWB column deleted
6. EXP DATE populated from yesterday's report
7. Comment column added next to Packaging Type Size with row colours
8. Uncoloured rows coloured Orange by Charge Reference (LT19062, LT18925, EP5770)
9. Rows with blank or future Collection Date deleted (only past dates & today kept)

> The **Run Processing** button only unlocks once yesterday's report is loaded.

---

## Step 7 — Processing

Click **Run Processing** to execute all enrichment in sequence:

1. **Description Enrichment** — refresh from yesterday's report; convert "Courier Service" to N/A.
2. **UPS Tracking** — refresh tracking numbers.
3. **1Z Consolidation** — merge multiple 1Z numbers into *UPS Tracking/MAWB* (the old UPS Tracking / MAWB columns are collapsed into this single column).
4. **QVM Backfill** — fill empty tracking cells from QVM (skipped if no QVM file).
5. **MAWB Backfill** — fill remaining empties from the MAWB column, then delete MAWB.
6. **EXP DATE Lookup** — populate expiry dates.
7. **Packaging Comments** — insert a comment column and colour rows.
8. **Charge Reference Colours** — orange for uncoloured rows matching LT19062 / LT18925 / EP5770.
9. **Collection Date Cleanup** — delete rows with blank or future Collection Date.

Each sub-step is logged in a live **processing log**.

### Row colour key:
- 🟡 **Yellow (Y)**
- 🟣 **Purple (P)**
- 🔴 **Red (R)**
- 🟠 **Orange (O / Charge Ref)**

When finished, **Continue to Export** appears; counts (final rows, rows coloured) are shown.

---

## Step 8 — Review & Export

- **Summary cards** show:
  - Original rows
  - Region-removed rows
  - Rule-removed rows
  - Rows coloured
  - Final rows
- A **preview table** shows the first 10 rows with full cell borders and colour coding.
- **Empty UPS Tracking/MAWB cells** display as **N/A**.
- Click **Download Cleaned Report (.xlsx)** to export:
  - Frozen header row
  - Bold header on dark fill
  - Left-aligned cells
  - Colour-coded rows
  - File named `EDI outstanding POD report <date> <region>.xlsx`
- **Start Over** resets the entire workflow for a new file/region.

---

## Data & Column Handling Notes

- **Normalization:** all lookups trim, lowercase and collapse whitespace.
- **N/A detection:** empty string, `"N/A"`, `"na"`, `"#N/A"`, and `0` are all treated as blank.
- **Date parsing:** supports `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY-MM-DD`, and native Excel date cells.
- **Reference lookup key:** rows are matched by **Trial AWB** across yesterday's / QVM files.

---

## UI Features

- **Apple-style glassmorphism** design (frosted panels, blur, soft shadows) in Marken brand colours (Deep Navy, Precision Cyan, UPS Gold).
- **Dark mode** toggle in the top bar — persisted across sessions via `localStorage`. All text remains readable in both themes.
- **Sidebar** shows the 8-step progress rail with live row/removed stats.
- Step **navigation rail** highlights active, completed, and up-coming steps.

---

## File Structure

```
reporting/
├── index.html        → App markup, all 8 step panels, SVG flags, theme toggle
├── styles.css        → Apple/Marken design system, light & dark themes
├── app.js            → All logic: state, steps, enrichment, export
├── package.json      → Serves the app locally (npm run dev)
└── APP_FUNCTION.md   → This guide
```

---

## How to Run

```bash
npm install      # (optional, uses npx serve)
npm run dev      # starts server at http://localhost:3000
```

Open **http://localhost:3000** in a browser.

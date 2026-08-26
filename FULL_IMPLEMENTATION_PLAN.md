# Marken Report Formatter — Full Implementation Plan & Technical Reference

> **Living Documentation**: This document tracks the full architecture, business rules, visual design system, and processing pipeline for the **Marken Precision Logistics Report Formatting Dashboard**.

---

## 1. Executive Summary & Architecture

The **Marken Report Formatter** is a high-performance, browser-native web application built for **Marken (UPS Healthcare Precision Logistics)**. It automates multi-step cleansing, regional filtering, account key validation, reference data VLOOKUP enrichment, and Excel row colour-coding.

### Technical Stack & Key Specs
* **Frontend**: Pure HTML5, Vanilla JavaScript (ES6+), Vanilla CSS3.
* **Excel Parsers & Generators**:
  * **SheetJS (`xlsx`)**: High-speed client-side reading & parsing of raw `.xlsx` / `.xls` reports, yesterday's reports, and QVM files.
  * **ExcelJS**: Advanced client-side writing of formatted `.xlsx` output files with custom row fill colors, font styles, column widths, and frozen headers.
* **Design System**: Apple-inspired Glassmorphism UI integrated with Marken corporate branding (`#0A192F` Deep Navy, `#0091DA` Precision Cyan, `#FFC72C` UPS Gold).
* **Data Security & Privacy**: **100% Client-Side Execution**. Zero server uploads; all file parsing, VLOOKUP calculations, and file downloads take place strictly within the user's browser session.

---

## 2. 8-Step Cleansing & Enrichment Pipeline

```
[ 1. Region Selection ] ➔ [ 2. Upload Raw Report ] ➔ [ 3. Column Cleanup ] ➔ [ 4. Delivery Country Filter ]
                                                                                      │
[ 8. Colored Excel Export ] ◄── [ 7. Processing Engine ] ◄── [ 6. Upload References ] ◄── [ 5. Account Rules ]
```

---

### Step 1 — Region Path Selection (Initial Stage)

User selects one of **6 Regional Paths** before uploading the file. This pre-configures Step 4:

| Path | Region | Target Delivery Countries |
|---|---|---|
| **Path 1** | 🇬🇧 **UK Region** | `United Kingdom`, `UK`, `Great Britain`, `GB`, `England`, `Scotland`, `Wales`, `Northern Ireland` |
| **Path 2** | 🇺🇸 **US Region** | `United States`, `US`, `USA`, `United States of America` |
| **Path 3** | 🇪🇺 **EU Region** | 27 European Union member states |
| **Path 4** | 🇨🇭 **CH Region** | `Switzerland`, `CH`, `Swiss`, `Confederatio Helvetica` |
| **Path 5** | 🇮🇪 **Ireland Region** | `Ireland`, `IE`, `Republic of Ireland`, `Eire` |
| **Path 6** | 🌐 **NON-EU Region** | **All Non-EU World Countries** (filters out all 27 EU member states) |

> [!NOTE]
> `NON-EU` path automatically covers 100% of global non-EU countries (e.g. Japan, Australia, Brazil, Canada, India, China, UAE, Mexico, etc.).

---

### Step 2 — Upload Raw Report

* Accepts `.xlsx` or `.xls` raw shipment reports.
* Displays file name, total row count, file size, and sheet name.

---

### Step 3 — Column Cleanup & Reordering

* Standardizes column order into the required **19-column output schema**.
* Inserts a **new blank column**: `EXP DATE` at position 15.
* Preserves original raw columns (`MAWB`, `Collection Date`, etc.).

#### Output Schema (Order of 19 Columns):
1. `Trial AWB`
2. `Description`
3. `UPS Tracking`
4. `MAWB`
5. `Ch To key`
6. `Group A c Name`
7. `Sched Collection date`
8. `Collection Date`
9. `Sched Delivery date`
10. `Charge Reference`
11. `Collection Country`
12. `Delivery Country`
13. `Collection Town`
14. `Delivery Town`
15. **`EXP DATE`** *(NEW — Blank column)*
16. `Latest Dry Ice Replenishment`
17. `Contents Description`
18. `Temperature`
19. `Packaging Type Size`

---

### Step 4 — Delivery Country Filter

* Filters rows **strictly based on `Delivery Country`** matching the selected region path.
* Ignores `Collection Country` for regional path validation.

---

### Step 5 — Account Number Rules (`Ch To key`)

Removes rows where `Ch To key` matches specific account numbers unless the town condition is met:

| Rule # | Account Keys (`Ch To key`) | Allowed Town(s) | Direction Checked |
|---|---|---|---|
| 1 | `US640`, `US1537` | `Dublin` | Delivery Town |
| 2 | `US537` | `Dublin`, `Hamburg`, `Mainz` | Delivery Town |
| 3 | `MI1058`, `SG1129` | `York` | Delivery Town |
| 4 | `CN1131` | `Livingston`, `Q2 Livingston` | **Collection OR Delivery Town** (going to or from) |

* Interactive UI builder allows users to add/delete custom rules on the fly.

---

### Step 6 — Reference Files Upload

User uploads reference files used for VLOOKUP enrichment:
1. **Yesterday's Report** *(Required)* — Used for Description, UPS Tracking, EXP DATE, Packaging Comments, and Row Colors.
2. **QVM File** *(Optional)* — Used to backfill missing tracking numbers.

---

### Step 7 — Automated Processing & Enrichment Engine

Runs 8 automated sub-steps in sequence with live MagicUI-styled animated card notifications:

1. **Description Refresh**: VLOOKUP from Yesterday's Report (**column index 2** / col B) keyed by `Trial AWB`. If `Description` contains `"Courier Service"` (case-insensitive), it is automatically converted to `"N/A"`.
2. **UPS Tracking Refresh**: VLOOKUP from Yesterday's Report (**column index 3** / col C) keyed by `Trial AWB`.
3. **1Z Consolidation**: Extracts all `1Z...` tracking numbers if multiple exist; consolidates into a new column **`UPS Tracking/MAWB`**.
4. **QVM Backfill**: VLOOKUP from QVM file (**column index 2**) for rows where `UPS Tracking/MAWB` is `N/A`.
5. **MAWB Backfill & Deletion**:
   - Backfills remaining `N/A` tracking cells using `MAWB` data.
   - Backfills rows where `Description` contains the word **"Routing"**.
   - Deletes the `MAWB` column.
6. **EXP DATE Lookup**: VLOOKUP from Yesterday's Report (**column index 13**) into `EXP DATE`.
7. **Packaging Comments & Row Colours**:
   - Inserts a **separate comment column with a blank header (`""`)** right next to `Packaging Type Size`.
   - Populates comments from Yesterday's Report (**column index 18**).
   - Applies full-row background colours based on comment values:
     - `Y` / `y` $\rightarrow$ 🟡 **Yellow** (`#FFF2CC`)
     - `P` / `p` $\rightarrow$ 🟣 **Purple** (`#E8D5F5`)
     - `R` / `r` $\rightarrow$ 🔴 **Red** (`#FFD7D7`)
     - `O` / `o` $\rightarrow$ 🟠 **Orange** (`#FFE5CC`)
8. **Charge Reference Colours**:
   - For rows not coloured in sub-step 7, applies 🟠 **Orange** if `Charge Reference` contains `LT19062`, `LT18925`, or `EP5770`.
9. **Collection Date Cleanup (Delete Blank & Future Dates)**:
   - Evaluates `Collection Date` (falling back to `Sched Collection date` if empty).
   - Deletes all rows where `Collection Date` is **BLANK** (empty, missing, `N/A`, invalid).
   - Deletes all rows where `Collection Date` is a **FUTURE DATE** (`> today's date`).
   - Keeps only rows where `Collection Date` is **$\le$ Today** (past dates & current date).

---

### Step 8 — Review & Export

* Interactive summary metrics (Total rows, Region filtered, Account rules removed, Coloured rows, Final count).
* 10-row preview table reflecting exact colors and formatting.
* Download button outputs formatted file named: `EDI outstanding POD report [DD.MM.YYYY] [Country/Region].xlsx` (e.g. `EDI outstanding POD report 26.08.2026 UK.xlsx`).

---

## 3. File Index & Directory Map

| Path | File | Purpose |
|---|---|---|
| `report formatting/index.html` | [index.html](file:///Users/vishnu/Desktop/Antigravity/marken/report%20formatting/index.html) | Main HTML layout, 8-step wizard panels, top nav bar, and CDN scripts |
| `report formatting/styles.css` | [styles.css](file:///Users/vishnu/Desktop/Antigravity/marken/report%20formatting/styles.css) | Full CSS design system (Marken brand colors + Apple Glassmorphism) |
| `report formatting/app.js` | [app.js](file:///Users/vishnu/Desktop/Antigravity/marken/report%20formatting/app.js) | Application engine, region filters, VLOOKUP logic, and ExcelJS generator |
| `report formatting/package.json` | [package.json](file:///Users/vishnu/Desktop/Antigravity/marken/report%20formatting/package.json) | Local dev server configuration (`npm run dev`) |
| `report formatting/FULL_IMPLEMENTATION_PLAN.md` | [FULL_IMPLEMENTATION_PLAN.md](file:///Users/vishnu/Desktop/Antigravity/marken/report%20formatting/FULL_IMPLEMENTATION_PLAN.md) | Living documentation & implementation specification |

---

## 4. Maintenance & Living Updates Log

* **2026-08-26**: Initial dashboard creation with 5-step wizard.
* **2026-08-26**: Kept original `MAWB` and `Collection Date` columns in schema.
* **2026-08-26**: Added bidirectional Livingston `CN1131` rule.
* **2026-08-26**: Added 8 post-processing sub-steps (VLOOKUPs, 1Z consolidation, QVM backfill, row colour-coding).
* **2026-08-26**: Updated Packaging Comments into a separate blank-header column next to `Packaging Type Size`.
* **2026-08-26**: Upgraded UI to MagicUI Animated Notification Cards.
* **2026-08-26**: Added Step 1 Region Selection with 6 Paths (`UK`, `US`, `EU`, `CH`, `IE`, `NON-EU`).
* **2026-08-26**: Updated Region filter to evaluate strictly against `Delivery Country`.
* **2026-08-26**: Complete UI redesign adopting Marken corporate brand colours (`#0A192F`, `#0091DA`, `#FFC72C`) and Apple Glassmorphism aesthetic.
* **2026-08-26**: Added Sub-step 9 Collection Date Cleanup (deletes all blank and future collection date rows; keeps only past dates & current date).
* **2026-08-26**: Formatted all spreadsheet cells and preview table data to be strictly **Left-to-Right Aligned** (`horizontal: 'left'`).
* **2026-08-26**: Added Description rule to automatically convert any `"Courier Service"` values to `"N/A"`.
* **2026-08-26**: Updated export file naming format to `EDI outstanding POD report DD.MM.YYYY Region.xlsx`.
* **2026-08-26**: Added dynamic Current Date badge (`📅 Wed, 26 Aug 2026`) in the top sticky navigation bar across all pages.

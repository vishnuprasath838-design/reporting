# Business Rules

Everything the app "knows" about how EDI POD reports should be treated, in plain English. If you need to change a business rule, the exact code locations are given so a developer can find it fast.

Sources in `app.js`: region / country definitions at lines 18–51, default account rules at 53–58, colour definitions at 60–69, reference-file column mapping at 104–110.

---

## 1. Regions map to countries

Six selectable regions on Step 1 expand into a flat country list used by the country filter (Step 4) and the country grid.

| Region | Countries (aliases recognised) | Source |
|--------|--------------------------------|--------|
| **UK** | United Kingdom, UK, Great Britain, GB, England, Scotland, Wales, Northern Ireland | `app.js:27` |
| **US** | United States, US, USA, United States of America | `app.js:32` |
| **EU** | 26 EU member states — Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Poland, Portugal, Romania, Slovakia, Slovenia, Spain, Sweden | `app.js:18` |
| **CH** | Switzerland, CH, Swiss, Confederatio Helvetica | `app.js:36` |
| **IE** | Ireland, IE, Republic of Ireland, Eire | `app.js:40` |
| **NON-EU** | A special catch-all: *any country that is **not** an EU member and **not** a UK/US/CH/IE dedicated-region country*. It does not expand to a list; it is a negation rule. | `app.js:345`, `app.js:525` |

### Effective logic for Step 4 (country filter)

A row's **Delivery Country** survives if any of these is true:

1. It matches a country selected on the grid (after normalisation), **or**
2. NON-EU was selected **and** the country is not in the EU list and not in the dedicated region lists (UK/US/CH/IE), **or**
3. All 6 regions were selected → every row passes.

Rows with a missing/blank Delivery Country are always removed.

---

## 2. Account rules (allowlists)

Rules live in `DEFAULT_RULES` (`app.js:53`). A rule is: *if `Ch To key` is one of the listed keys, the row's town **must** be on the allowlist, else the row is removed.*

| Ch To key(s) | Town must be | Check both directions? |
|--------------|--------------|------------------------|
| US640, US1537 | Dublin | No — Delivery Town only |
| US537 | Dublin, Hamburg, Mainz | No — Delivery Town only |
| MI1058, SG1129 | York | No — Delivery Town only |
| CN1131 | Livingston, Q2 Livingston | **Yes** — Collection **or** Delivery Town |

- "Check both directions" (the `checkBothDirections` flag) means the town match is checked against **Collection Town OR Delivery Town** instead of just Delivery Town.
- Rows whose `Ch To key` doesn't match any rule are never affected.
- New rules can be added in the UI (Step 5); the defaults are only the pre-loaded ones.

---

## 3. Reference-file column mapping

Both reference files (yesterday's report, QVM) are read as arrays-of-arrays. Columns are addressed **by 0-based index**, so "column 12" in Excel talk (column M) is index 12 in the code. Mapping in `YESTERDAY_COLUMNS` (`app.js:104`):

| 0-based index | Excel column | Purpose |
|---------------|--------------|---------|
| 0 | A | **Trial AWB** — the lookup key that joins reference data to working rows |
| 1 | B | Description (sub-step 1 enrichment) |
| 2 | C | UPS Tracking (sub-step 2 enrichment, and QVM backfill in sub-step 4) |
| 12 | M | EXP DATE (sub-step 6 lookup) |
| 17 | R | Colour / comment letter (sub-step 7) |

> **Warning:** these indexes are hard-coded to the expected layout of the *yesterday/morning report*. If that file's column layout changes, update `YESTERDAY_COLUMNS` (see [config-reference.md](config-reference.md)).

---

## 4. Row colours

Rows are colour-coded in the final export. Colours come from two sources:

1. **Yesterday's comment column** (sub-step 7): a letter read from column 17 of the yesterday report maps to a colour:
   - `y` → 🟡 Yellow `#F5F04D`
   - `p` → 🟣 Purple `#D3B3EF`
   - `r` → 🔴 Red `#DD2C2C`
   - `o` → 🟠 Orange `#FCD0A4`
   - `b` → 🔵 Blue `#59BBF6`
2. **Charge-reference fallback** (sub-step 8): rows still uncoloured become 🟠 Orange if their **Charge Reference** contains any of `LT19062`, `LT18925`, `EP5770` (list at `app.js:69`). If the row has no comment from yesterday, an `O` is written into the comment column.

A row keeps its first colour — the charge-reference fallback only applies to rows that were not already coloured.

---

## 5. Tracking-number rules

- **1Z consolidation (sub-step 3):** if a row's UPS Tracking contains more than one `1Z...` number (comma-separated), they are joined with `, ` into a new column called `UPS Tracking/MAWB`; the old `UPS Tracking` column is then deleted everywhere.
- **QVM backfill (sub-step 4):** rows whose tracking is empty are filled from the QVM file (tracking read from column C, index 2).
- **MAWB backfill (sub-step 5):** remaining empty rows are filled from their own **MAWB** value. Rows whose Description contains 'routing' are also filled from MAWB. Afterwards the **MAWB column is deleted**.
- **N/A display:** any cell that ends up empty in UPS Tracking/MAWB is shown as **N/A** in the preview (see [data-model.md](data-model.md) for what counts as empty).

---

## 6. Collection Date rule

Sub-step 9 deletes a row if its Collection Date is:

- missing / blank / not parseable, **or**
- in the **future** (after today 23:59:59).

The date is checked on `Collection Date`; if that is empty, `Sched Collection date` is tried as a fallback. Only past dates and today are kept.
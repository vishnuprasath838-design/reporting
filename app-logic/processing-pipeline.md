# Processing Pipeline — The 9 Sub-steps

Everything that happens when the user clicks **Run Processing** (Step 7). All code below is inside the single `runProcessing()` async function in `app.js`.

The pipeline runs **top to bottom, once per workbook**. Each sub-step writes to a live processing log and calls `tick()` to keep the UI responsive. A few structural notes first:

- **`workingData`** is the array of rows being edited — a copy of the uploaded data (see [data-model.md](data-model.md)).
- **`yesterdayLookup`** and **`qvmLookup`** are Maps of reference rows keyed by normalised **Trial AWB** (column A).
- **`rowColors`** is a Map of *row index → colour key* (`yellow`, `purple`, `red`, `orange`, `blue`).

```mermaid
flowchart TD
    S[start] --> S1[1 · Description Enrichment]
    S1 --> S2[2 · UPS Tracking refresh]
    S2 --> S3[3 · 1Z Consolidation → UPS Tracking/MAWB]
    S3 --> S4[4 · QVM Backfill<br/>(skipped if no QVM)]
    S4 --> S5[5 · MAWB Backfill<br/>then delete MAWB column]
    S5 --> S6[6 · EXP DATE Lookup]
    S6 --> S7[7 · Packaging Comments + row colours]
    S7 --> S8[8 · Charge Reference orange fallback]
    S8 --> S9[9 · Collection Date Cleanup<br/>delete blank / future dates]
    S9 --> E[end]
```

---

## Sub-step 1 — Description Enrichment  (`app.js:801`)

For every row:

1. Look up the row's **Trial AWB** in `yesterdayLookup`.
2. If found and the yesterday value in column B (index `YESTERDAY_COLUMNS.DESCRIPTION`) is **not** N/A, copy it into the row's `Description`.
3. Separately: if the row's `Description` currently contains the text **"courier service"** (case-insensitive), it is replaced with `N/A`.

**Why:** yesterday's report is the source of truth for what an item actually is; "Courier Service" is not a real description.

Log reports: descriptions refreshed, Courier Service → N/A conversions.

## Sub-step 2 — UPS Tracking refresh  (`app.js:845`)

For every row, look up Trial AWB in `yesterdayLookup`; if found and column C (index `YESTERDAY_COLUMNS.UPS_TRACKING`) is not N/A, overwrite the row's `UPS Tracking` with it.

**Why:** the raw upload may have stale or missing tracking; yesterday's report has today's-correct values.

## Sub-step 3 — 1Z Consolidation  (`app.js:881`)

For every row:

1. Split the `UPS Tracking` value on commas and trim each token.
2. Keep only tokens that start with **`1Z`** (case-insensitive).
3. New column `UPS Tracking/MAWB` gets:
   - the joined `1Z items` (e.g. `1ZABC, 1ZDEF`) **if there is more than one 1Z token**, or
   - the original full value otherwise.
4. The old `UPS Tracking` column is **deleted** from the row, and the schema is updated to rename `UPS Tracking` → `UPS Tracking/MAWB`.

**Why:** one shipment can have multiple UPS scannables; they must live together in a single column for the downstream system.

## Sub-step 4 — QVM Backfill  (`app.js:898`)

**Skipped** (log entry "skip") if no QVM file was uploaded.

For every row whose `UPS Tracking/MAWB` is N/A:

1. Look up Trial AWB in `qvmLookup`.
2. If found and QVM column C (index 2) is not N/A, copy it into `UPS Tracking/MAWB`.

**Why:** QVM holds tracking numbers the upload and yesterday's report don't.

## Sub-step 5 — MAWB Backfill → delete column  (`app.js:919`)

For every row:

1. If `UPS Tracking/MAWB` is N/A **and** the row's `MAWB` is not N/A → copy `MAWB` into `UPS Tracking/MAWB`.
2. Second pass: if `UPS Tracking/MAWB` is still N/A **and** the Description contains "routing" **and** `MAWB` is not N/A → copy `MAWB` in.

Then the **`MAWB` column is removed** from both the schema and every row.

**Why:** MAWB is a flight/truck bill number that can stand in for a missing UPS number, but the final output must not contain the MAWB column at all.

## Sub-step 6 — EXP DATE Lookup  (`app.js:944`)

For every row, look up Trial AWB in `yesterdayLookup`; if found and column M (index `YESTERDAY_COLUMNS.EXP_DATE`) is not N/A, copy it into the (previously empty) `EXP DATE` column.

**Why:** expiry dates live only in yesterday's report, not the raw upload.

## Sub-step 7 — Packaging Comments & Row Colouring  (`app.js:960`)

1. Insert a new column with a **space** as its header (a deliberately blank comment header) immediately after `Packaging Type Size`.
2. For every row, look up Trial AWB in `yesterdayLookup`; read column R (index `YESTERDAY_COLUMNS.COLOR`):
   - If **not** N/A → put the value in the comment column.
   - If N/A → leave the comment empty.
   - If the value is a known colour letter (`y/p/r/o/b`) → set the row colour via `PKG_COLOR_MAP` and record it in `rowColors`.
3. Log reports how many comments were added and how many rows were coloured.

**Why:** yesterday's report already encodes commentary ("Yellow", "Purple", etc.) that must be preserved as both text and colour.

## Sub-step 8 — Charge Reference Orange Fallback  (`app.js:1000`)

For every row that is **not already coloured**:

1. Read `Charge Reference`, uppercase it.
2. If it contains any of `LT19062`, `LT18925`, `EP5770` → colour the row **orange** and, if its comment column is empty, write `O` there.

Finally, the comment column values are **uppercased** everywhere (letters like `y` become `Y`).

**Why:** certain charge references always demand attention, so unlabelled rows get flagged orange.

## Sub-step 9 — Collection Date Cleanup  (`app.js:1026`)

This is the **only sub-step that deletes whole rows**.

1. Compute "end of today" = today at `23:59:59.999`.
2. For each row, read `Collection Date`; if it is N/A, fall back to `Sched Collection date`.
3. Parse the date (see [data-model.md](data-model.md) for supported formats).
4. Delete the row if:
   - the date can't be parsed (blank/missing/invalid), **or**
   - the parsed date is **after** end of today, i.e. in the future.
5. Surviving rows keep their colour mapping (indices are remapped to the compacted array).

Log reports how many rows were deleted and the final row count.

**Why:** a Collection Date that's blank or in the future means the shipment isn't a completed/collectable POD record.

---

## When processing is done

- `state.processDone = true`; the Run button hides; **Continue to Export** appears.
- Summary line logs the final row count and the number of coloured rows.
# Report Formatting Engine — App Logic

This folder explains **what the app does** and **how the code works**, so that anyone — business users, newcomers, and developers — can understand it quickly.

The app is a browser-based tool that imports a raw Excel report, cleans and enriches it against reference files, colour-codes rows, and exports a formatted `.xlsx` workbook. Everything runs in the browser; there is no server and no database.

---

## Quick overview

The workflow is broken into **8 sequential steps**, each a "panel" in the single-page app:

| Step | Name | Purpose |
|------|------|---------|
| 1 | Region | Select one or more regions (UK, US, EU, CH, IE, NON-EU) |
| 2 | Upload | Import the raw Excel report (`.xlsx` / `.xls` / `.csv`) |
| 3 | Columns | Reorder/rename columns to match the required output schema |
| 4 | Country Filter | Keep only rows whose Delivery Country matches the selected regions |
| 5 | Account Rules | Remove rows whose Ch To key / town fails the allowlisted rules |
| 6 | Reference Files | Upload yesterday's report + optional QVM for enrichment |
| 7 | Processing | Run all enrichment, backfill, and colour-coding automatically |
| 8 | Export | Preview results and download the cleaned, colour-coded workbook |

A visual map of this flow is in [workflow.md](workflow.md).

---

## Docs in this folder

| Doc | Audience | What it covers |
|-----|----------|----------------|
| [workflow.md](workflow.md) | Everyone | The 8-step wizard explained step by step, with a Mermaid flow diagram and "what goes in / what comes out" overview |
| [business-rules.md](business-rules.md) | Business | The business rules the app encodes: regions→countries, account rules, row colours, and reference-file column mapping — in plain English |
| [processing-pipeline.md](processing-pipeline.md) | Everyone | The 9 sub-steps of **Run Processing**, in order, with exactly what each does to the data |
| [data-model.md](data-model.md) | Developers | State shape, input/output schemas, and the normalisation / N/A / date-parsing rules |
| [config-reference.md](config-reference.md) | Developers | Every configurable constant and exactly how to change it |
| [function-map.md](function-map.md) | Developers | Index of every function in `app.js` with line numbers |

> The bulk of the logic lives in a single file, `app.js` (~1,330 lines). It is organised top-to-bottom as: constants → state → helpers → one section per step → bootstrapping.

---

## How the app is structured

```
reporting/
├── index.html        → App markup: all 8 step panels, region cards, theme toggle
├── styles.css        → Design system, light & dark themes
├── app.js            → All logic: constants, state, steps, enrichment, export
├── package.json      → Serves the app locally (npm run dev)
└── app-logic/        → This documentation
    ├── README.md                 ← you are here
    ├── workflow.md
    ├── business-rules.md
    ├── processing-pipeline.md
    ├── data-model.md
    ├── config-reference.md
    └── function-map.md
```

---

## How to run

```bash
npm install      # (optional, uses npx serve)
npm run dev      # starts server at http://localhost:3000
```

Open **http://localhost:3000** in a browser.

---

## Platform notes

- **Everything is client-side.** Data is read with SheetJS (`XLSX`) and written with ExcelJS. Files are processed in memory and downloaded through the browser.
- **Wall-clock dates matter.** The tool compares against today's date (e.g. deleting future Collection Dates), so results change day to day.
- **Lookups are keyed on Trial AWB** across yesterday's report and the optional QVM file.
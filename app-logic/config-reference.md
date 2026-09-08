# Config Reference

Every configurable constant in the app, where it lives, and how to change it. All are at the top of `app.js` and are read at runtime — **no build step needed**; edit the file, refresh the browser.

---

## `OUTPUT_SCHEMA` — output column order  (`app.js:9`)

The 19-column output schema. Change order or add/remove columns here and Step 3 (column remap) follows it.

**Changing it:**
- **Add a column** → insert its exact header name. If the upload has a column with that (normalised) name, its data is carried over; otherwise it is created empty.
- **Remove a column** → delete the name. Note some processing steps hard-reference columns by name (`UPS Tracking`, `MAWB`, `Trial AWB`, `Description`, `Charge Reference`, `Collection Date`, `Sched Collection date`, `Packaging Type Size`, `Collection Town`, `Delivery Town`, `Ch To key`). If you rename/remove one of those, the pipeline will silently stop enriching that column. Prefer appending new columns.

## Region → country lists  (`app.js:18–42`)

- `EU_COUNTRIES` (line 18), `UK_COUNTRIES` (27), `US_COUNTRIES` (32), `CH_COUNTRIES` (36), `IE_COUNTRIES` (40).
- Each is the list of country aliases recognised for that region in the Step 1 → Step 4 country filter.

**Changing it:** add/remove strings. All are matched **after normalisation** (`norm()`), so casing and extra spaces don't matter, but the spelling must match how Delivery Country appears in the data. The `NON-EU` region has no list — it is the *complement* of EU + UK + US + CH + IE, so editing those lists changes NON-EU behaviour automatically.

## `REGION_NAMES` — display labels  (`app.js:44`)

Friendly names shown in the UI for each region key. Purely cosmetic.

## `DEFAULT_RULES` — account rules pre-loaded  (`app.js:53`)

```js
{ keys: ['US640','US1537'], towns: ['Dublin'],                     checkBothDirections: false }
{ keys: ['US537'],          towns: ['Dublin','Hamburg','Mainz'],   checkBothDirections: false }
{ keys: ['MI1058','SG1129'],towns: ['York'],                       checkBothDirections: false }
{ keys: ['CN1131'],         towns: ['Livingston','Q2 Livingston'], checkBothDirections: true  }
```

**Changing it:** each entry is `{ keys: [...], towns: [...], checkBothDirections: true|false }`.
- `keys` — `Ch To key` values the rule applies to.
- `towns` — allowlisted towns (Delivery Town, or Collection/Delivery Town if `checkBothDirections`).
- Users can also add/remove rules in the Step 5 UI; `DEFAULT_RULES` is just the starting set (a deep copy is stored in `state.rules`).

## `COLOR_ARGB` — Excel fill colours  (`app.js:60`)

```js
{ yellow: 'FFF5F04D', purple: 'FFD3B3EF', red: 'FFDD2C2C',
  orange: 'FFFCD0A4', blue: 'FF59BBF6' }
```

Hex in Excel ARGB format (`AARRGGBB`). Consumed by the export code when filling row cells.

**Changing it:** any 8-hex-digit `AARRGGBB` value, or add a new colour key here **and** to `PKG_COLOR_MAP` so a comment letter can trigger it.

## `PKG_COLOR_MAP` — comment letter → colour  (`app.js:68`)

```js
{ y:'yellow', p:'purple', r:'red', o:'orange', b:'blue' }
```

Maps the single-letter values read from column R of yesterday's report to colour keys. Sub-step 7 also writes these letters (e.g. `O` for charge-reference rows) to the comment column.

**Changing it:** letters are lowercased before lookup. Add a new pair `x: 'colourkey'` to support a new letter.

## `CHARGE_REF_ORANGE` — orange fallback trigger  (`app.js:69`)

```js
['LT19062','LT18925','EP5770']
```

Sub-step 8 colours a row orange if its `Charge Reference` contains any of these (case-insensitive substring match).

**Changing it:** add/remove charge-reference fragments. Shorter fragments match more rows (it's a substring test).

## `YESTERDAY_COLUMNS` — reference-file column indexes  (`app.js:104`)

```js
{ TRIAL_AWB: 0, DESCRIPTION: 1, UPS_TRACKING: 2, EXP_DATE: 12, COLOR: 17 }
```

0-based indexes into the **yesterday/morning report** rows used by sub-steps 1, 2, 6 and 7.

**Changing it:** if the source report's column layout changes (e.g. EXP DATE moves from M to N), update the number here. No other code changes. ⚠️ These are the most likely constants to need updating if a new source file format arrives. The QVM file's tracking column is hard-coded as index `1` (column C) in sub-step 4 (`app.js:907`).

## `outputSchema` / export formatting

Export styling (frozen header, auto-filter, borders, header fill) is inline in the `initExport` section (`app.js:1070+`). The download filename is built as:

```
EDI outstanding POD report <DD.MM.YYYY> <selectedRegionTag>.xlsx
```

The `<selectedRegionTag>` is `ALL`, `UK+IE`, etc. — set in `updateRegionSelectionUI`/`applyCountryFilter`. To change the filename pattern, edit `app.js:1225`.

## `brand-theme` localStorage key  (`app.js:1306`)

Dark/light preference key. Renaming it would orphan users' saved theme.

---

## Summary of "quick edits"

| I want to… | Change |
|------------|--------|
| Add a region's country alias | the region list, e.g. `EU_COUNTRIES` (`app.js:18`) |
| Add/remove a default rule | `DEFAULT_RULES` (`app.js:53`) |
| Change a rule's town allowlist | that rule's `towns` array |
| Support a new colour letter | `PKG_COLOR_MAP` + `COLOR_ARGB` (`app.js:60`,`68`) |
| Flag different charge refs orange | `CHARGE_REF_ORANGE` (`app.js:69`) |
| Yesterday report columns moved | `YESTERDAY_COLUMNS` (`app.js:104`) |
| Add an output column | `OUTPUT_SCHEMA` (`app.js:9`) |
| Change the export filename | `app.js:1225` |
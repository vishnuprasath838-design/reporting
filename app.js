/* ─────────────────────────────────────────────
   Report Formatting Report Formatter — app.js  (full)
   ───────────────────────────────────────────── */

// ══════════════════════════════
//  Constants & Region Definitions
// ══════════════════════════════

const OUTPUT_SCHEMA = [
  'Trial AWB', 'Description', 'UPS Tracking', 'MAWB',
  'Ch To key', 'Group A c Name', 'Sched Collection date',
  'Collection Date', 'Sched Delivery date', 'Charge Reference',
  'Collection Country', 'Delivery Country', 'Collection Town',
  'Delivery Town', 'EXP DATE', 'Latest Dry Ice Replenishment',
  'Contents Description', 'Temperature', 'Packaging Type Size',
];

const EU_COUNTRIES = [
  'Austria','Belgium','Bulgaria','Croatia','Cyprus',
  'Czech Republic','Denmark','Estonia','Finland','France',
  'Germany','Greece','Hungary','Italy',
  'Latvia','Lithuania','Luxembourg','Malta','Netherlands',
  'Poland','Portugal','Romania','Slovakia','Slovenia',
  'Spain','Sweden',
];

const UK_COUNTRIES = [
  'United Kingdom', 'UK', 'Great Britain', 'GB',
  'England', 'Scotland', 'Wales', 'Northern Ireland',
];

const US_COUNTRIES = [
  'United States', 'US', 'USA', 'United States of America',
];

const CH_COUNTRIES = [
  'Switzerland', 'CH', 'Swiss', 'Confederatio Helvetica',
];

const IE_COUNTRIES = [
  'Ireland', 'IE', 'Republic of Ireland', 'Eire',
];

const REGION_NAMES = {
  UK: 'UK Region (United Kingdom)',
  US: 'US Region (United States)',
  EU: 'EU Region (26 Member States, excl. Ireland)',
  CH: 'CH Region (Switzerland)',
  IE: 'Ireland Region',
  'NON-EU': 'NON-EU Region (excl. UK, US, CH, IE)',
};

const DEFAULT_RULES = [
  { keys: ['US640','US1537'], towns: ['Dublin'],                     checkBothDirections: false },
  { keys: ['US537'],          towns: ['Dublin','Hamburg','Mainz'],   checkBothDirections: false },
  { keys: ['MI1058','SG1129'],towns: ['York'],                       checkBothDirections: false },
  { keys: ['CN1131'],         towns: ['Livingston','Q2 Livingston'], checkBothDirections: true  },
];

const COLOR_ARGB = {
  yellow: 'FFF5F04D',
  purple: 'FFD3B3EF',
  red:    'FFDD2C2C',
  orange: 'FFFCD0A4',
  blue:   'FF59BBF6',
};

const PKG_COLOR_MAP = { y:'yellow', p:'purple', r:'red', o:'orange', b:'blue' };
const CHARGE_REF_ORANGE = ['LT19062','LT18925','EP5770'];

/* ══════════════════════════════
   App Guide — single source of truth for the in-app flow chart.
   IMPORTANT: keep this in sync with the logic below and the app-logic/
   docs. Update it in the SAME commit as any app change so the pushed
   app matches. "Live" detail sections render from the real constants
   (OUTPUT_SCHEMA, DEFAULT_RULES, YESTERDAY_COLUMNS, PKG_COLOR_MAP,
   COLOR_ARGB, CHARGE_REF_ORANGE, regions) so those can never drift.
   ══════════════════════════════ */
const APP_GUIDE = {
  version: '1.0',
  steps: [
    {
      id: 'step1', step: 1, title: 'Region', tagline: 'Select path',
      summary: 'Choose which region(s) the report covers. Your selection builds the list of countries used to filter rows downstream.',
      bullets: [
        'Cards: UK, US, EU, CH, IE, NON-EU — click to select, click again to deselect.',
        'Combine regions for a custom path (e.g. UK + IE, US + UK + NON-EU).',
        'Quick combinations: Select ALL (Global), UK + IE, US + UK + NON-EU, Clear.',
        'UK, US, CH and IE expand to country aliases; EU covers 26 member states.',
        'NON-EU is a catch-all that includes any country that is not in the EU and not UK/US/CH/IE.',
        'The Continue button stays disabled until at least one region is selected.',
      ],
    },
    {
      id: 'step2', step: 2, title: 'Upload', tagline: 'Import Excel file',
      summary: 'Import the raw Excel/CSV report. The original rows are preserved; a working copy is edited by every later step.',
      bullets: [
        'Accepts .xlsx, .xls and .csv files — drag & drop or browse.',
        'Shows the file name, row count, size and active sheet on success.',
        'The raw data becomes the baseline (original count); the working copy is what all later steps modify.',
      ],
    },
    {
      id: 'step3', step: 3, title: 'Columns', tagline: 'Remap to output schema',
      summary: 'Remap the uploaded columns to the fixed 19-column output schema. EXP DATE is created empty and filled during Processing.',
      bullets: [
        'Columns are matched by name (case & whitespace-insensitive) and copied into the output order.',
        'Columns in the file that do not match the schema are not carried over.',
        'EXP DATE is a brand-new empty column — it is populated from yesterday\u2019s report in Step 7.',
      ],
    },
    {
      id: 'step4', step: 4, title: 'Country Filter', tagline: 'Keep matching countries',
      summary: 'Keep only the rows whose Delivery Country belongs to the countries of your selected regions.',
      bullets: [
        'Select All / Deselect All, or click individual countries in the grid.',
        'Selecting all 6 regions (Global) keeps every row — 0 rows are removed.',
        'NON-EU keeps countries that are not EU members and not UK/US/CH/IE.',
        'Rows without a Delivery Country are removed.',
      ],
    },
    {
      id: 'step5', step: 5, title: 'Account Rules', tagline: 'Allowlist town checks',
      summary: 'Remove rows that violate account-specific allowlists: if a row\u2019s Ch To key matches a rule, its town must be on that rule\u2019s allowlist.',
      bullets: [
        'Default rules are pre-loaded and shown below.',
        'Each rule checks Delivery Town only, or Collection Town OR Delivery Town (both directions).',
        'Rules can be deleted or added in the UI in real time.',
        'Rows that break a rule are removed and counted.',
      ],
    },
    {
      id: 'step6', step: 6, title: 'Reference Files', tagline: 'Yesterday + QVM',
      summary: 'Hand the app yesterday\u2019s report (required) and the optional QVM file so it can enrich tracking, descriptions, dates and colours.',
      bullets: [
        'Yesterday\u2019s / Morning Report (required) — source for Description, UPS Tracking, EXP DATE and row colours.',
        'QVM File (optional) — backfills missing UPS Tracking / MAWB numbers.',
        'Both files are joined to your rows by Trial AWB (column A).',
        'Run Processing unlocks once yesterday\u2019s report is loaded.',
      ],
    },
    {
      id: 'step7', step: 7, title: 'Processing', tagline: '9 enrichment sub-steps',
      summary: 'Run all enrichment automatically. Nine sub-steps refresh, backfill, colour-code and clean the report — click any sub-step in the flow to explore it.',
      bullets: [
        'Description enriched; \u201CCourier Service\u201D replaced with #N/A.',
        'UPS Tracking refreshed; multiple 1Z numbers consolidated; QVM/MAWB backfill; MAWB column removed.',
        'EXP DATE populated; packaging comment column and row colours added.',
        'Rows with a blank or future Collection Date are deleted.',
      ],
    },
    {
      id: 'step8', step: 8, title: 'Export', tagline: 'Preview & download',
      summary: 'Review the cleansed result, then download the formatted, colour-coded .xlsx report.',
      bullets: [
        'Summary cards show original, removed and final row counts, plus how many rows were coloured.',
        'A preview shows the first 10 rows with colour coding; empty tracking cells appear as #N/A.',
        'Download Cleaned Report (.xlsx): frozen header, auto-filter, colour-coded rows, branded header fill.',
        'Start Over resets everything for a new file or region.',
      ],
    },
  ],
  pipeline: [
    { id: 'p1', title: 'Description Enrichment',   desc: 'Refresh Description from yesterday\u2019s report (column B) and replace any \u201CCourier Service\u201D value with #N/A.' },
    { id: 'p2', title: 'UPS Tracking',             desc: 'Refresh UPS Tracking from yesterday\u2019s report (column C) for every row keyed by Trial AWB.' },
    { id: 'p3', title: '1Z Consolidation',         desc: 'Join multiple 1Z tracking numbers into a single UPS Tracking/MAWB column, then drop the old UPS Tracking column.' },
    { id: 'p4', title: 'QVM Backfill',             desc: 'Top up rows whose tracking is still empty using the QVM file (column C). Skipped when no QVM file is uploaded.' },
    { id: 'p5', title: 'MAWB Backfill',            desc: 'Fill remaining empty tracking from the row\u2019s own MAWB value, then delete the MAWB column.' },
    { id: 'p6', title: 'EXP DATE Lookup',          desc: 'Populate the EXP DATE column from yesterday\u2019s report (column M).' },
    { id: 'p7', title: 'Packaging Comments',       desc: 'Add a comment column next to Packaging Type Size and colour rows from the colour letter in yesterday\u2019s report (column R).' },
    { id: 'p8', title: 'Charge Reference Colours', desc: 'Colour any still-uncoloured row orange when its Charge Reference contains a flagged reference (LT19062 / LT18925 / EP5770).' },
    { id: 'p9', title: 'Collection Date Cleanup',  desc: 'Delete rows whose Collection Date is blank, unparseable, or in the future — only past dates and today are kept.' },
  ],
};


// ══════════════════════════════
//  State
// ══════════════════════════════
const state = {
  currentStep: 1,
  selectedRegions: new Set(), // Set of selected region keys e.g. 'UK', 'IE', 'NON-EU'
  selectedRegionTag: 'Custom',
  selectedRegionLabel: 'No Region Selected',
  rawData: [],
  workingData: [],
  dynamicSchema: [...OUTPUT_SCHEMA],
  fileName: '',
  originalCount: 0,
  removedByCountry: 0,
  removedByRules: 0,
  selectedCountries: new Set(),
  rules: DEFAULT_RULES.map(r => ({ ...r, keys:[...r.keys], towns:[...r.towns], checkBothDirections: r.checkBothDirections })),
  // Reference data
  yesterdayAoA: [],
  yesterdayLookup: new Map(),
  qvmAoA: [],
  qvmLookup: new Map(),
  // Results
  rowColors: new Map(),
  processLog: [],
  processDone: false,
};

// ══════════════════════════════
//  Helpers
// ══════════════════════════════
// Column indexes for yesterday/morning report - make configurable
const YESTERDAY_COLUMNS = {
  TRIAL_AWB: 0,     // Column A (Trial AWB)
  DESCRIPTION: 1,   // Column B (Description)  
  UPS_TRACKING: 2,  // Column C (UPS Tracking)
  EXP_DATE: 12,     // Column M (EXP DATE)
  COLOR: 17         // Column R (Color/Comment)
};

const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g,' ');

function isNA(val) {
  if (val === null || val === undefined) return true;
  const s = String(val).trim().toLowerCase();
  // Removed '0' and Number(s) === 0 checks - these could be valid values
  return s === '' || s === 'n/a' || s === 'na' || s === '#n/a';
}

// Animate a numeric element count-up to a target value (NumberTicker-style)
function countUp(el, target, duration = 900) {
  if (!el) return;
  let start = null;
  const from = 0;
  const step = ts => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(from + (target - from) * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function parseDateValue(val) {
  if (val === null || val === undefined || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === 'number') {
    if (typeof XLSX !== 'undefined' && XLSX.SSF) {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
    }
  }
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'n/a' || s === '0') return null;

  // Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) {
    const day   = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year  = parseInt(dmy[3], 10);
    const d = new Date(year, month, day);
    return !isNaN(d.getTime()) ? d : null;
  }

  // Match YYYY-MM-DD
  const ymd = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymd) {
    const year  = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10) - 1;
    const day   = parseInt(ymd[3], 10);
    const d = new Date(year, month, day);
    return !isNaN(d.getTime()) ? d : null;
  }

  const fallback = new Date(s);
  return !isNaN(fallback.getTime()) ? fallback : null;
}

function buildLookup(aoa) {
  const map = new Map();
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || row.length === 0) continue;
    const key = norm(String(row[0] ?? ''));
    if (key) map.set(key, row);
  }
  return map;
}

function parseFileAsAoA(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type:'array', cellDates:true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' });
        resolve(aoa);
      } catch(err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ══════════════════════════════
//  Step Navigation
// ══════════════════════════════
function goToStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-step-${n}`).classList.add('active');
  document.querySelectorAll('.step-item').forEach(item => {
    const s = parseInt(item.dataset.step);
    item.classList.remove('active','done','accessible');
    if (s < n) item.classList.add('done');
    else if (s === n) item.classList.add('active');
    else if (s === n+1) item.classList.add('accessible');
  });
  state.currentStep = n;
  updateSidebar();
}

function updateSidebar() {
  const rowsEl = document.getElementById('stat-rows-val');
  const rows = state.workingData.length || state.originalCount;
  if (rows > 0) {
    countUp(rowsEl, rows);
  } else {
    rowsEl.textContent = '—';
  }
  const removedEl = document.getElementById('stat-removed-val');
  const removed = state.originalCount - state.workingData.length;
  if (removed > 0) {
    countUp(removedEl, removed);
  } else {
    removedEl.textContent = '—';
  }
}

// ══════════════════════════════
//  Toast
// ══════════════════════════════
let toastTimer;
function showToast(msg, type='') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

// ══════════════════════════════
//  STEP 1 — Region Selection
// ══════════════════════════════
function initRegionSelection() {
  const cards = document.querySelectorAll('.region-card');
  const nextBtn = document.getElementById('step1-next');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const reg = card.dataset.region;
      if (state.selectedRegions.has(reg)) {
        state.selectedRegions.delete(reg);
      } else {
        state.selectedRegions.add(reg);
      }
      updateRegionSelectionUI();
    });
  });

  const btnAll = document.getElementById('preset-all');
  if (btnAll) {
    btnAll.addEventListener('click', () => {
      state.selectedRegions = new Set(['UK','US','EU','CH','IE','NON-EU']);
      updateRegionSelectionUI();
    });
  }

  const btnUkIe = document.getElementById('preset-uk-ie');
  if (btnUkIe) {
    btnUkIe.addEventListener('click', () => {
      state.selectedRegions = new Set(['UK','IE']);
      updateRegionSelectionUI();
    });
  }

  const btnUsUkNonEu = document.getElementById('preset-us-uk-noneu');
  if (btnUsUkNonEu) {
    btnUsUkNonEu.addEventListener('click', () => {
      state.selectedRegions = new Set(['US','UK','NON-EU']);
      updateRegionSelectionUI();
    });
  }

  const btnClear = document.getElementById('preset-clear');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      state.selectedRegions.clear();
      updateRegionSelectionUI();
    });
  }

  nextBtn.addEventListener('click', () => {
    if (state.selectedRegions.size === 0) {
      showToast('Please select at least one region to continue', 'error');
      return;
    }
    goToStep(2);
  });
}

function updateRegionSelectionUI() {
  const cards = document.querySelectorAll('.region-card');
  cards.forEach(c => {
    c.classList.toggle('selected', state.selectedRegions.has(c.dataset.region));
  });

  const nextBtn = document.getElementById('step1-next');
  const pill = document.getElementById('combo-summary-pill');
  const pillText = document.getElementById('combo-summary-text');
  const step2Label = document.getElementById('selected-region-label');

  if (state.selectedRegions.size === 0) {
    if (pill) pill.classList.remove('active');
    if (pillText) pillText.textContent = 'No region selected';
    if (step2Label) step2Label.textContent = 'Custom Region';
    state.selectedRegionTag = 'Custom';
    state.selectedRegionLabel = 'No Region Selected';
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  if (nextBtn) nextBtn.disabled = false;
  if (pill) pill.classList.add('active');

  const keys = Array.from(state.selectedRegions);
  if (keys.length === 6) {
    state.selectedRegionTag = 'ALL';
    state.selectedRegionLabel = 'All Regions (Global)';
  } else {
    state.selectedRegionTag = keys.join('+');
    state.selectedRegionLabel = keys.map(k => REGION_NAMES[k] || k).join(' + ');
  }

  if (pillText) pillText.textContent = `Selected: ${state.selectedRegionTag}`;
  if (step2Label) step2Label.textContent = state.selectedRegionLabel;

  configureRegionCountries();
}

function configureRegionCountries() {
  state.selectedCountries.clear();
  const regions = state.selectedRegions;

  if (regions.has('UK'))     UK_COUNTRIES.forEach(c => state.selectedCountries.add(c));
  if (regions.has('US'))     US_COUNTRIES.forEach(c => state.selectedCountries.add(c));
  if (regions.has('EU'))     EU_COUNTRIES.forEach(c => state.selectedCountries.add(c));
  if (regions.has('CH'))     CH_COUNTRIES.forEach(c => state.selectedCountries.add(c));
  if (regions.has('IE'))     IE_COUNTRIES.forEach(c => state.selectedCountries.add(c));
  if (regions.has('NON-EU')) state.selectedCountries.add('Non-EU Countries (excl. UK, US, CH, IE)');

  renderCountryGrid();
}

// ══════════════════════════════
//  STEP 2 — Upload
// ══════════════════════════════
function initUpload() {
  const zone      = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');

  browseBtn.addEventListener('click', () => fileInput.click());
  zone.addEventListener('click', e => { if (e.target !== browseBtn) fileInput.click(); });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

  document.getElementById('step2-back').addEventListener('click', () => goToStep(1));
  document.getElementById('step2-next').addEventListener('click', () => goToStep(3));
}

function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls','csv'].includes(ext)) { showToast('Please upload an .xlsx, .xls or .csv file','error'); return; }

  state.fileName = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type:'array', cellDates:true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
      state.rawData = rows;
      state.workingData = rows.map(r => ({...r}));
      state.originalCount = rows.length;
      const sheetLabel = ext === 'csv' ? (wb.SheetNames[0] || 'CSV') : wb.SheetNames[0];
      document.getElementById('file-info').classList.remove('hidden');
      document.getElementById('file-name-display').textContent = file.name;
      document.getElementById('file-meta-display').textContent =
        `${rows.length.toLocaleString()} rows · ${(file.size/1024).toFixed(1)} KB · Sheet: ${sheetLabel}`;
      document.getElementById('step2-next').disabled = false;
      updateSidebar();
      showToast('File loaded successfully','success');
    } catch(err) { showToast('Failed to read file','error'); console.error(err); }
  };
  reader.onerror = () => {
    document.getElementById('file-info').classList.add('hidden');
    showToast('Failed to read file','error');
  };
  reader.readAsArrayBuffer(file);
}

// ══════════════════════════════
//  STEP 3 — Columns
// ══════════════════════════════
function initColumns() {
  document.getElementById('step3-back').addEventListener('click', () => goToStep(2));
  document.getElementById('step3-next').addEventListener('click', applyColumnClean);
}

function applyColumnClean() {
  const headers = state.rawData.length ? Object.keys(state.rawData[0]) : [];
  const rawMap  = {};
  headers.forEach(h => { rawMap[norm(h)] = h; });

  state.dynamicSchema = [...OUTPUT_SCHEMA];
  state.workingData = state.rawData.map(row => {
    const newRow = {};
    OUTPUT_SCHEMA.forEach(col => {
      if (col === 'EXP DATE') { newRow[col] = ''; }
      else {
        const rawKey = rawMap[norm(col)];
        newRow[col] = rawKey !== undefined ? row[rawKey] : '';
      }
    });
    return newRow;
  });
  updateSidebar();
  showToast('Columns applied ✓','success');
  renderCountryGrid();
  goToStep(4);
}

// ══════════════════════════════
//  STEP 4 — Country Filter
// ══════════════════════════════
function initCountryFilter() {
  renderCountryGrid();
  document.getElementById('select-all-countries').addEventListener('click', () => {
    document.querySelectorAll('.country-item').forEach(el => { el.classList.add('selected'); state.selectedCountries.add(el.dataset.country); });
    updateCountryCount();
  });
  document.getElementById('deselect-all-countries').addEventListener('click', () => {
    document.querySelectorAll('.country-item').forEach(el => { el.classList.remove('selected'); state.selectedCountries.delete(el.dataset.country); });
    updateCountryCount();
  });
  document.getElementById('step4-back').addEventListener('click', () => goToStep(3));
  document.getElementById('step4-next').addEventListener('click', applyCountryFilter);
}

function getActiveCountryList() {
  const list = [];
  const regions = state.selectedRegions;
  if (regions.has('UK'))     list.push(...UK_COUNTRIES);
  if (regions.has('US'))     list.push(...US_COUNTRIES);
  if (regions.has('EU'))     list.push(...EU_COUNTRIES);
  if (regions.has('CH'))     list.push(...CH_COUNTRIES);
  if (regions.has('IE'))     list.push(...IE_COUNTRIES);
  if (regions.has('NON-EU')) list.push('Non-EU Countries (excl. UK, US, CH, IE)');
  return [...new Set(list)];
}

function renderCountryGrid() {
  const grid = document.getElementById('country-grid');
  grid.innerHTML = '';

  const list = getActiveCountryList();

  const subEl = document.getElementById('country-filter-sub');
  if (subEl) {
    subEl.textContent = `Target countries for your selected region combination (${state.selectedRegionTag || 'Custom'}).`;
  }

  list.forEach(country => {
    const item = document.createElement('div');
    const isSel = state.selectedCountries.has(country);
    item.className = `country-item ${isSel ? 'selected' : ''}`;
    item.dataset.country = country;
    item.innerHTML = `
      <div class="country-check">
        <svg viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div><span>${country}</span>`;
    item.addEventListener('click', () => toggleCountry(item, country));
    grid.appendChild(item);
  });

  updateCountryCount();
}

function toggleCountry(item, country) {
  if (state.selectedCountries.has(country)) { state.selectedCountries.delete(country); item.classList.remove('selected'); }
  else { state.selectedCountries.add(country); item.classList.add('selected'); }
  updateCountryCount();
}

function updateCountryCount() {
  const list = getActiveCountryList();
  document.getElementById('selected-country-count').textContent = state.selectedCountries.size;
  document.getElementById('total-country-count').textContent = list.length;
}

function applyCountryFilter() {
  const before = state.workingData.length;
  const regions = state.selectedRegions;
  const euNorm = new Set(EU_COUNTRIES.map(norm));

  // If ALL 6 regions selected, 100% of rows pass
  if (regions.size === 6) {
    state.removedByCountry = 0;
    updateSidebar();
    showToast('All regions selected — 0 rows filtered out ✓', 'success');
    goToStep(5);
    return;
  }

  const hasNonEU = regions.has('NON-EU');
  const explicitCountries = new Set([...state.selectedCountries].filter(c => !c.includes('Non-EU')).map(norm));

  // Build the set of countries that have their own dedicated region card
  // These should NOT be matched by the NON-EU catch-all
  const dedicatedRegionCountries = new Set([
    ...UK_COUNTRIES.map(norm),
    ...US_COUNTRIES.map(norm),
    ...CH_COUNTRIES.map(norm),
    ...IE_COUNTRIES.map(norm),
  ]);

  state.workingData = state.workingData.filter(row => {
    const dc = norm(row['Delivery Country']);
    if (!dc) return false;

    // Check explicit match (e.g. UK, US, EU member states, CH, IE)
    if (explicitCountries.has(dc)) return true;

    // NON-EU: match only countries that are NOT in EU AND NOT in US/UK/CH/IE dedicated regions
    if (hasNonEU && !euNorm.has(dc) && !dedicatedRegionCountries.has(dc)) return true;

    return false;
  });

  state.removedByCountry = before - state.workingData.length;
  updateSidebar();
  showToast(`${state.removedByCountry} rows filtered out for ${state.selectedRegionTag || 'Custom'} path ✓`, 'success');
  goToStep(5);
}

// ══════════════════════════════
//  STEP 5 — Account Rules
// ══════════════════════════════
function initRules() {
  renderRules();
  document.getElementById('add-rule-btn').addEventListener('click', addRule);
  document.getElementById('step5-back').addEventListener('click', () => goToStep(4));
  document.getElementById('step5-next').addEventListener('click', applyRules);
}

function renderRules() {
  const container = document.getElementById('rules-list');
  container.innerHTML = '';
  if (state.rules.length === 0) {
    container.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;">No rules — all rows will pass through.</p>';
    return;
  }
  state.rules.forEach((rule, idx) => {
    const direction = rule.checkBothDirections ? 'Collection <em>or</em> Delivery Town' : 'Delivery Town';
    const card = document.createElement('div');
    card.className = 'rule-card';
    card.innerHTML = `
      <span class="rule-icon">🔑</span>
      <div class="rule-text">
        If <span class="rule-keys">Ch To key</span> is <span class="rule-keys">${rule.keys.join(', ')}</span>
        and ${direction} is <em>not</em> <span class="rule-towns">${rule.towns.join(' / ')}</span>
        → <strong style="color:var(--red)">Remove row</strong>
      </div>
      <button class="rule-delete" data-idx="${idx}">
        <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>`;
    card.querySelector('.rule-delete').addEventListener('click', () => { state.rules.splice(idx,1); renderRules(); });
    container.appendChild(card);
  });
}

function addRule() {
  const keysRaw  = document.getElementById('rule-keys').value.trim();
  const townsRaw = document.getElementById('rule-towns').value.trim();
  const bothDir  = document.getElementById('rule-both-dir').checked;
  if (!keysRaw || !townsRaw) { showToast('Fill in both fields','error'); return; }
  state.rules.push({
    keys: keysRaw.split(',').map(s=>s.trim()).filter(Boolean),
    towns: townsRaw.split(',').map(s=>s.trim()).filter(Boolean),
    checkBothDirections: bothDir,
  });
  document.getElementById('rule-keys').value = '';
  document.getElementById('rule-towns').value = '';
  document.getElementById('rule-both-dir').checked = false;
  renderRules();
  showToast('Rule added','success');
}

function applyRules() {
  const before = state.workingData.length;
  state.workingData = state.workingData.filter(row => {
    const chKey     = norm(row['Ch To key'] ?? '');
    const delivTown = norm(row['Delivery Town'] ?? '');
    const collTown  = norm(row['Collection Town'] ?? '');
    for (const rule of state.rules) {
      const keysN  = rule.keys.map(norm);
      const townsN = rule.towns.map(norm);
      if (keysN.includes(chKey)) {
        if (rule.checkBothDirections) {
          if (!townsN.includes(collTown) && !townsN.includes(delivTown)) return false;
        } else {
          if (!townsN.includes(delivTown)) return false;
        }
      }
    }
    return true;
  });
  state.removedByRules = before - state.workingData.length;
  updateSidebar();
  showToast(`${state.removedByRules} rows removed by account rules ✓`,'success');
  goToStep(6);
}

// ══════════════════════════════
//  STEP 6 — Reference Files
// ══════════════════════════════
function initRefFiles() {
  const yesterdayInput = document.getElementById('yesterday-input');
  const qvmInput       = document.getElementById('qvm-input');

  document.getElementById('yesterday-browse').addEventListener('click', () => yesterdayInput.click());
  document.getElementById('qvm-browse').addEventListener('click',       () => qvmInput.click());
  document.getElementById('step6-back').addEventListener('click', () => goToStep(5));
  document.getElementById('step6-next').addEventListener('click', () => {
    state.processDone = false;
    state.rowColors.clear();
    state.processLog = [];
    renderProcessLog([]);
    document.getElementById('step7-run').classList.remove('hidden');
    document.getElementById('step7-next').classList.add('hidden');
    goToStep(7);
  });

  yesterdayInput.addEventListener('change', () => {
    if (yesterdayInput.files[0]) handleRefFile(yesterdayInput.files[0], 'yesterday');
  });
  qvmInput.addEventListener('change', () => {
    if (qvmInput.files[0]) handleRefFile(qvmInput.files[0], 'qvm');
  });

  enableRefDragDrop('yesterday');
  enableRefDragDrop('qvm');
}

function enableRefDragDrop(type) {
  const slot = document.getElementById(`slot-${type}`);
  if (!slot) return;
  slot.addEventListener('dragover', e => {
    e.preventDefault();
    slot.classList.add('drag-over');
  });
  slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
  slot.addEventListener('drop', e => {
    e.preventDefault();
    slot.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleRefFile(file, type);
  });
}

async function handleRefFile(file, type) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls','csv'].includes(ext)) { showToast('Please upload an .xlsx, .xls or .csv file','error'); return; }
  try {
    const aoa = await parseFileAsAoA(file);
    if (type === 'yesterday') {
      state.yesterdayAoA = aoa;
      state.yesterdayLookup = buildLookup(aoa);
      
      // Validate yesterday file structure
      if (aoa.length > 1) {
        const headerRow = aoa[0];
        const sampleRow = aoa[1];
        console.log(`Yesterday file validation: ${aoa.length - 1} rows, ${headerRow.length} columns`);
        console.log('Header row:', headerRow);
        console.log('Required columns exist:', {
          description: sampleRow.length > YESTERDAY_COLUMNS.DESCRIPTION,
          upsTracking: sampleRow.length > YESTERDAY_COLUMNS.UPS_TRACKING,
          expDate: sampleRow.length > YESTERDAY_COLUMNS.EXP_DATE,
          color: sampleRow.length > YESTERDAY_COLUMNS.COLOR
        });
        
        if (sampleRow.length <= Math.max(YESTERDAY_COLUMNS.DESCRIPTION, YESTERDAY_COLUMNS.UPS_TRACKING)) {
          showToast('Warning: Yesterday file may have fewer columns than expected', 'warning');
        }
      }
      
      updateRefSlot('yesterday', file.name, aoa.length - 1);
    } else {
      state.qvmAoA = aoa;
      state.qvmLookup = buildLookup(aoa);
      updateRefSlot('qvm', file.name, aoa.length - 1);
    }
    if (state.yesterdayLookup.size > 0) {
      document.getElementById('step6-next').disabled = false;
    }
    showToast(`${type === 'yesterday' ? "Yesterday's Report / Morning Report" : 'QVM'} loaded ✓`,'success');
  } catch(err) {
    showToast(`Failed to read ${type} file`,'error');
    console.error(err);
  }
}

function updateRefSlot(type, fileName, rows) {
  const statusEl = document.getElementById(`${type}-status`);
  statusEl.innerHTML = `
    <div class="ref-file-loaded">
      <span class="badge badge-success">✓ Loaded</span>
      <span class="ref-file-name">${fileName}</span>
      <span class="ref-file-rows">${rows.toLocaleString()} rows</span>
    </div>`;
}

// ══════════════════════════════
//  STEP 7 — Processing
// ══════════════════════════════
function initProcessing() {
  document.getElementById('step7-back').addEventListener('click', () => goToStep(6));
  document.getElementById('step7-run').addEventListener('click', runProcessing);
  document.getElementById('step7-next').addEventListener('click', () => {
    renderExport();
    goToStep(8);
  });
}

function addLogEntry(type, title, msg, iconEmoji = '✨') {
  state.processLog.push({
    type,
    title,
    msg,
    icon: iconEmoji,
    time: `Step ${state.processLog.length}`,
  });
  renderProcessLog(state.processLog);
}

function renderProcessLog(entries) {
  const container = document.getElementById('process-log');
  if (entries.length === 0) {
    container.innerHTML = '<div class="log-placeholder">Click <strong>Run Processing</strong> to begin…</div>';
    return;
  }
  container.innerHTML = entries.map(e => {
    const iconContent = e.type === 'running' ? '<span class="spin">⠋</span>' : e.icon;
    return `
      <div class="log-card log-card--${e.type}">
        <div class="log-card-icon">${iconContent}</div>
        <div class="log-card-body">
          <div class="log-card-header">
            <span>${e.title}</span>
            <span class="log-card-dot">•</span>
            <span class="log-card-time">${e.time}</span>
          </div>
          <p class="log-card-desc">${e.msg}</p>
        </div>
      </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function runProcessing() {
  if (state.processDone) return;
  document.getElementById('step7-run').disabled = true;
  document.getElementById('step7-back').disabled = true;
  state.processLog = [];

  // DIAGNOSTIC: Log yesterday file structure
  console.log('=== VLOOKUP DIAGNOSTIC START ===');
  console.log(`Yesterday lookup entries: ${state.yesterdayLookup.size}`);
  if (state.yesterdayAoA.length > 1) {
    console.log('Yesterday file header row:', state.yesterdayAoA[0]);
    console.log('Yesterday file sample row:', state.yesterdayAoA[1]);
    console.log('Sample lookup keys:', Array.from(state.yesterdayLookup.keys()).slice(0, 3));
  }
  console.log(`Working data rows: ${state.workingData.length}`);
  if (state.workingData.length > 0) {
    console.log('Sample Trial AWB from working data:', state.workingData[0]['Trial AWB']);
    console.log('Normalized sample AWB:', norm(state.workingData[0]['Trial AWB'] ?? ''));
  }

  // ── Sub-step 1: Description enrichment ──
  addLogEntry('running', 'Description Enrichment', 'Refreshing Description from yesterday/morning report (col 2) & converting Courier Service to #N/A…', '📝');
  await tick();
  let descMatches = 0;
  let courierReplaced = 0;
  let lookupAttempts = 0;
  let foundMatches = 0;
  let naValues = 0;
  
  state.workingData.forEach(row => {
    lookupAttempts++;
    const awbKey = norm(row['Trial AWB'] ?? '');
    const yRow = state.yesterdayLookup.get(awbKey);
    
    if (yRow) {
      foundMatches++;
      // Use configurable column index and validate it exists
      const val = yRow.length > YESTERDAY_COLUMNS.DESCRIPTION ? yRow[YESTERDAY_COLUMNS.DESCRIPTION] : undefined;
      if (lookupAttempts <= 3) { // Log first 3 attempts
        console.log(`DESC DEBUG ${lookupAttempts}: AWB="${awbKey}", yRow[${YESTERDAY_COLUMNS.DESCRIPTION}]="${val}", isNA=${isNA(val)}, rowLength=${yRow.length}`);
      }
      if (val !== undefined && !isNA(val)) { 
        row['Description'] = val; 
        descMatches++;
      } else {
        naValues++;
      }
    } else if (lookupAttempts <= 3) {
      console.log(`DESC DEBUG ${lookupAttempts}: AWB="${awbKey}" - NO MATCH FOUND`);
    }
    
    // Convert any "Courier Service" description to N/A
    const currentDesc = String(row['Description'] ?? '').trim().toLowerCase();
    if (currentDesc.includes('courier service')) {
      row['Description'] = '#N/A';
      courierReplaced++;
    }
  });
  
  console.log(`Description enrichment: ${lookupAttempts} attempts, ${foundMatches} matches, ${naValues} N/A values, ${descMatches} updates`);
  state.processLog.pop();
  addLogEntry('success', 'Description Enrichment', `${descMatches} descriptions refreshed — ${courierReplaced} "Courier Service" values converted to #N/A`, '📝');
  await tick();

  // ── Sub-step 2: UPS Tracking enrichment ──
  addLogEntry('running', 'UPS Tracking', 'Refreshing UPS Tracking from yesterday/morning report (col 3)…', '📦');
  await tick();
  let upsMatches = 0;
  let upsLookupAttempts = 0;
  let upsFoundMatches = 0;
  let upsNaValues = 0;
  
  state.workingData.forEach(row => {
    upsLookupAttempts++;
    const awbKey = norm(row['Trial AWB'] ?? '');
    const yRow = state.yesterdayLookup.get(awbKey);
    
    if (yRow) {
      upsFoundMatches++;
      // Use configurable column index and validate it exists
      const val = yRow.length > YESTERDAY_COLUMNS.UPS_TRACKING ? yRow[YESTERDAY_COLUMNS.UPS_TRACKING] : undefined;
      if (upsLookupAttempts <= 3) { // Log first 3 attempts
        console.log(`UPS DEBUG ${upsLookupAttempts}: AWB="${awbKey}", yRow[${YESTERDAY_COLUMNS.UPS_TRACKING}]="${val}", isNA=${isNA(val)}, rowLength=${yRow.length}`);
      }
      if (val !== undefined && !isNA(val)) { 
        row['UPS Tracking'] = val; 
        upsMatches++;
      } else {
        upsNaValues++;
      }
    } else if (upsLookupAttempts <= 3) {
      console.log(`UPS DEBUG ${upsLookupAttempts}: AWB="${awbKey}" - NO MATCH FOUND`);
    }
  });
  
  console.log(`UPS enrichment: ${upsLookupAttempts} attempts, ${upsFoundMatches} matches, ${upsNaValues} N/A values, ${upsMatches} updates`);
  state.processLog.pop();
  addLogEntry('success', 'UPS Tracking', `${upsMatches} tracking numbers refreshed from yesterday/morning report`, '📦');
  await tick();

  // ── Sub-step 3: Multi-1Z consolidation → UPS Tracking/MAWB ──
  addLogEntry('running', '1Z Consolidation', 'Consolidating multi-1Z tracking numbers into UPS Tracking/MAWB…', '🔀');
  await tick();
  let consolidated = 0;
  state.workingData.forEach(row => {
    const tracking = String(row['UPS Tracking'] ?? '');
    const tokens   = tracking.split(',').map(s => s.trim());
    const oneZList = tokens.filter(t => t.toUpperCase().startsWith('1Z'));
    row['UPS Tracking/MAWB'] = (oneZList.length > 1) ? (consolidated++, oneZList.join(', ')) : tracking;
    delete row['UPS Tracking'];
  });
  const upsIdx = state.dynamicSchema.indexOf('UPS Tracking');
  if (upsIdx !== -1) state.dynamicSchema[upsIdx] = 'UPS Tracking/MAWB';
  state.processLog.pop();
  addLogEntry('success', '1Z Consolidation', `UPS Tracking/MAWB created — ${consolidated} multi-1Z rows consolidated`, '🔀');
  await tick();

  // ── Sub-step 4: QVM backfill ──
  if (state.qvmLookup.size > 0) {
    addLogEntry('running', 'QVM Backfill', 'Backfilling N/A UPS Tracking/MAWB from QVM (col 2)…', '🔍');
    await tick();
    let qvmFilled = 0;
    state.workingData.forEach(row => {
      if (isNA(row['UPS Tracking/MAWB'])) {
        const qRow = state.qvmLookup.get(norm(row['Trial AWB'] ?? ''));
        if (qRow) {
          const val = qRow[1]; // col index 2 → 0-based 1
          if (!isNA(val)) { row['UPS Tracking/MAWB'] = val; qvmFilled++; }
        }
      }
    });
    state.processLog.pop();
    addLogEntry('success', 'QVM Backfill', `${qvmFilled} missing tracking numbers backfilled from QVM`, '🔍');
  } else {
    addLogEntry('skip', 'QVM Backfill', 'Skipped (no QVM file uploaded)', '🔍');
  }
  await tick();

  // ── Sub-step 5: MAWB backfill → delete MAWB column ──
  addLogEntry('running', 'MAWB Backfill', 'Backfilling remaining N/A rows from MAWB column…', '✈️');
  await tick();
  let mawbFilled = 0;
  state.workingData.forEach(row => {
    if (!isNA(row['MAWB']) && isNA(row['UPS Tracking/MAWB'])) {
      row['UPS Tracking/MAWB'] = row['MAWB'];
      mawbFilled++;
    }
  });
  state.workingData.forEach(row => {
    if (isNA(row['UPS Tracking/MAWB'])) {
      if ((String(row['Description'] ?? '').toLowerCase().includes('routing')) && !isNA(row['MAWB'])) {
        row['UPS Tracking/MAWB'] = row['MAWB'];
        mawbFilled++;
      }
    }
  });
  const mawbIdx = state.dynamicSchema.indexOf('MAWB');
  if (mawbIdx !== -1) state.dynamicSchema.splice(mawbIdx, 1);
  state.workingData.forEach(row => { delete row['MAWB']; });
  state.processLog.pop();
  addLogEntry('success', 'MAWB Backfill', `${mawbFilled} rows filled from MAWB, MAWB column removed`, '✈️');
  await tick();

  // ── Sub-step 6: EXP DATE lookup ──
  addLogEntry('running', 'EXP DATE Lookup', 'Populating EXP DATE from yesterday/morning report (col 13)…', '📅');
  await tick();
  let expFilled = 0;
  state.workingData.forEach(row => {
    const yRow = state.yesterdayLookup.get(norm(row['Trial AWB'] ?? ''));
    if (yRow) {
      // Use configurable column index
      const val = yRow.length > YESTERDAY_COLUMNS.EXP_DATE ? yRow[YESTERDAY_COLUMNS.EXP_DATE] : undefined;
      if (val !== undefined && !isNA(val)) { row['EXP DATE'] = val; expFilled++; }
    }
  });
  state.processLog.pop();
  addLogEntry('success', 'EXP DATE Lookup', `${expFilled} expiry dates populated`, '📅');
  await tick();

  // ── Sub-step 7: Packaging Comments (Separate Column) & Row Colouring ──
  addLogEntry('running', 'Packaging Comments', 'Adding comment column & row colours from yesterday/morning report (col 18)…', '🎨');
  await tick();
  let pkgColored = 0;
  let pkgPopulated = 0;

  const pkgColKey = ' ';
  if (!state.dynamicSchema.includes(pkgColKey)) {
    const pkgIdx = state.dynamicSchema.indexOf('Packaging Type Size');
    if (pkgIdx !== -1) {
      state.dynamicSchema.splice(pkgIdx + 1, 0, pkgColKey);
    } else {
      state.dynamicSchema.push(pkgColKey);
    }
  }

  state.workingData.forEach((row, idx) => {
    const yRow = state.yesterdayLookup.get(norm(row['Trial AWB'] ?? ''));
    if (yRow) {
      // Use configurable column index for color
      const val = yRow.length > YESTERDAY_COLUMNS.COLOR ? String(yRow[YESTERDAY_COLUMNS.COLOR] ?? '').trim() : '';
      if (!isNA(val)) {
        row[pkgColKey] = val;
        pkgPopulated++;
      } else {
        row[pkgColKey] = '';
      }
      const color = PKG_COLOR_MAP[val.toLowerCase()];
      if (color) {
        state.rowColors.set(idx, color);
        pkgColored++;
      }
    } else {
      row[pkgColKey] = '';
    }
  });
  state.processLog.pop();
  addLogEntry('success', 'Packaging Comments', `Added comment column (${pkgPopulated} comments) — ${pkgColored} rows coloured`, '🎨');
  await tick();

  // ── Sub-step 8: Charge Reference ──
  addLogEntry('running', 'Charge Reference Colours', 'Applying orange colour by Charge Reference for uncoloured rows…', '🔑');
  await tick();
  let chargeColored = 0;
  state.workingData.forEach((row, idx) => {
    if (!state.rowColors.has(idx)) {
      const chargeRef = String(row['Charge Reference'] ?? '').toUpperCase();
      if (CHARGE_REF_ORANGE.some(t => chargeRef.includes(t.toUpperCase()))) {
        state.rowColors.set(idx, 'orange');
        if (isNA(row[pkgColKey])) row[pkgColKey] = 'O';
        chargeColored++;
      }
    }
  });

  // Apply uppercase color letters where applicable (optional)
  state.workingData.forEach((row) => {
    if (row[pkgColKey]) {
      row[pkgColKey] = String(row[pkgColKey]).toUpperCase();
    }
  });
  
  state.processLog.pop();
  addLogEntry('success', 'Charge Reference Colours', `${chargeColored} uncoloured rows coloured orange`, '🔑');
  await tick();

  // ── Sub-step 9: Collection Date Cleanup (Delete Blank & Future Dates) ──
  addLogEntry('running', 'Collection Date Cleanup', 'Deleting rows with blank or future Collection Date…', '📆');
  await tick();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const beforeDateFilterCount = state.workingData.length;
  const newRowColors = new Map();
  let newIdx = 0;

  state.workingData = state.workingData.filter((row, oldIdx) => {
    let rawDateVal = row['Collection Date'];
    if (isNA(rawDateVal)) {
      rawDateVal = row['Sched Collection date'];
    }

    const parsedDate = parseDateValue(rawDateVal);
    if (!parsedDate) {
      return false; // Blank or invalid date → Delete row
    }

    if (parsedDate.getTime() > todayEnd.getTime()) {
      return false; // Future date → Delete row
    }

    if (state.rowColors.has(oldIdx)) {
      newRowColors.set(newIdx, state.rowColors.get(oldIdx));
    }
    newIdx++;
    return true;
  });

  state.rowColors = newRowColors;
  const removedDatesCount = beforeDateFilterCount - state.workingData.length;
  state.processLog.pop();
  addLogEntry('success', 'Collection Date Cleanup', `${removedDatesCount} blank/future collection date rows deleted (${state.workingData.length.toLocaleString()} rows kept)`, '📆');
  await tick();

  addLogEntry('info', 'Processing Complete', `${state.workingData.length.toLocaleString()} final rows · ${state.rowColors.size.toLocaleString()} rows coloured`, '✨');

  state.processDone = true;
  document.getElementById('step7-run').classList.add('hidden');
  document.getElementById('step7-next').classList.remove('hidden');
  document.getElementById('step7-back').disabled = false;
  updateSidebar();
}

function tick() { return new Promise(r => setTimeout(r, 80)); }


// ══════════════════════════════
//  STEP 8 — Export
// ══════════════════════════════
function renderExport() {
  countUp(document.getElementById('sum-original'), state.originalCount);
  countUp(document.getElementById('sum-country-removed'), state.removedByCountry);
  countUp(document.getElementById('sum-rules-removed'), state.removedByRules);
  countUp(document.getElementById('sum-colored'), state.rowColors.size);
  countUp(document.getElementById('sum-final'), state.workingData.length);

  const schema = state.dynamicSchema;
  const thead  = document.getElementById('preview-thead');
  const tbody  = document.getElementById('preview-tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const trHead = document.createElement('tr');
  schema.forEach(c => { const th = document.createElement('th'); th.textContent = c; trHead.appendChild(th); });
  thead.appendChild(trHead);

  const COLOR_BG = { yellow:'#F5F04D', purple:'#D3B3EF', red:'#DD2C2C', orange:'#FCD0A4', blue:'#59BBF6' };

  state.workingData.slice(0, 10).forEach((row, idx) => {
    const tr   = document.createElement('tr');
    const bg   = COLOR_BG[state.rowColors.get(idx)];
    if (bg) tr.style.background = bg;
    schema.forEach(c => {
      const td = document.createElement('td');
      let val = row[c];
      if (val instanceof Date) val = val.toLocaleDateString('en-GB');
      const strVal = val !== undefined && val !== null ? String(val) : '';
      // Show N/A for empty UPS Tracking/MAWB cells
      const isUpsCol = c === 'UPS Tracking/MAWB' || c === 'UPS Tracking';
      td.textContent = isUpsCol && (!strVal || strVal.trim() === '' || strVal.toLowerCase() === 'n/a' || strVal === '0') ? '#N/A' : strVal;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function initExport() {
  document.getElementById('download-btn').addEventListener('click', downloadFile);
  document.getElementById('start-over-btn').addEventListener('click', startOver);
}

async function downloadFile() {
  const btn = document.getElementById('download-btn');
  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const workbook  = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cleaned Report');
    const schema    = state.dynamicSchema;

    // Define columns
    worksheet.columns = schema.map(col => ({
      header: String(col).trim() === '' ? '' : col,
      width: Math.max(String(col).length + 4, 14),
    }));

    // Style header row (Left Aligned)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 22;
    const headerBorder = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
    for (let c = 1; c <= schema.length; c++) {
      const cell = headerRow.getCell(c);
      cell.font = { name: 'Arial', bold: true, color: { argb: 'FFE8E8F0' }, size: 8 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF251159' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
      cell.border = headerBorder;
    }

    // Add data rows with left alignment & colors
    state.workingData.forEach((row, idx) => {
      const rowArray = schema.map(col => {
        let val = row[col];
        if (val instanceof Date) val = val.toLocaleDateString('en-GB');
        const strVal = val !== undefined && val !== null ? val : '';
        // Show N/A for empty UPS Tracking/MAWB cells in Excel export
        const isUpsCol = col === 'UPS Tracking/MAWB' || col === 'UPS Tracking';
        if (isUpsCol && (strVal === '' || strVal === null || String(strVal).trim() === '' || String(strVal).toLowerCase() === 'n/a' || String(strVal) === '0')) {
          return '#N/A';
        }
        return strVal;
      });

      const excelRow = worksheet.addRow(rowArray);
      excelRow.height = 18;

      const colorKey = state.rowColors.get(idx);
      const argb = colorKey ? COLOR_ARGB[colorKey] : null;
      const dataBorder = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      for (let c = 1; c <= schema.length; c++) {
        const cell = excelRow.getCell(c);
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
        cell.font = { name: 'Arial', size: 8 };
        cell.border = dataBorder;
        if (argb) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } };
        }
      }
    });

    // Guarantee a border on every cell in the entire used range
    const usedRange = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = usedRange;
      });
    });

    // Enable filters on all columns so users can filter multiple columns simultaneously
    if (state.workingData.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1 + state.workingData.length, column: schema.length },
      };
    }

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');

    const now  = new Date();
    const dd   = String(now.getDate()).padStart(2, '0');
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const dateStr = `${dd}.${mm}.${yyyy}`;

    a.href     = url;
    a.download = `EDI outstanding POD report ${dateStr} ${state.selectedRegionTag || 'Custom'}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Download started ✓','success');
  } catch(err) {
    showToast('Export failed — see console','error');
    console.error('Download error:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" width="18"><path d="M10 3v10M6 9l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Download Cleaned Report (.xlsx)`;
  }
}

function startOver() {
  Object.assign(state, {
    currentStep: 1, selectedRegion: null,
    rawData:[], workingData:[], dynamicSchema:[...OUTPUT_SCHEMA], fileName:'',
    originalCount:0, removedByCountry:0, removedByRules:0,
    selectedCountries: new Set(),
    rules: DEFAULT_RULES.map(r=>({...r,keys:[...r.keys],towns:[...r.towns],checkBothDirections:r.checkBothDirections})),
    yesterdayAoA:[], yesterdayLookup: new Map(),
    qvmAoA:[],       qvmLookup: new Map(),
    rowColors: new Map(), processLog:[], processDone: false,
  });

  // Reset region selection
  document.querySelectorAll('.region-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('step1-next').disabled = true;

  document.getElementById('file-input').value = '';
  document.getElementById('file-info').classList.add('hidden');
  document.getElementById('step2-next').disabled = true;
  configureRegionCountries();
  renderRules();

  // Reset ref slots
  document.getElementById('yesterday-status').innerHTML =
    `<button class="btn btn-outline btn-sm" id="yesterday-browse">Upload File</button>`;
  document.getElementById('qvm-status').innerHTML =
    `<button class="btn btn-outline btn-sm" id="qvm-browse">Upload File</button>`;
  document.getElementById('step6-next').disabled = true;

  document.getElementById('yesterday-input').addEventListener('change', () => {
    if (document.getElementById('yesterday-input').files[0])
      handleRefFile(document.getElementById('yesterday-input').files[0],'yesterday');
  });
  document.getElementById('qvm-input').addEventListener('change', () => {
    if (document.getElementById('qvm-input').files[0])
      handleRefFile(document.getElementById('qvm-input').files[0],'qvm');
  });
  document.getElementById('yesterday-browse').addEventListener('click', () =>
    document.getElementById('yesterday-input').click());
  document.getElementById('qvm-browse').addEventListener('click', () =>
    document.getElementById('qvm-input').click());

  goToStep(1);
  showToast('Ready for a new region & file','success');
}

function initDateDisplay() {
  const now = new Date();
  const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  const formatted = now.toLocaleDateString('en-GB', options);
  const el = document.getElementById('current-date-text');
  if (el) el.textContent = formatted;
}

/* ══════════════════════════════
   App Guide — overlay flow chart
   ══════════════════════════════ */
function excelColLetter(n) {
  let s = '';
  n = (n ?? 0) + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function argbToHex(argb) {
  return '#' + String(argb).slice(2).toUpperCase();
}

function guideLiveRegions() {
  const regionInfo = [
    ['UK', UK_COUNTRIES], ['US', US_COUNTRIES], ['EU', EU_COUNTRIES],
    ['CH', CH_COUNTRIES], ['IE', IE_COUNTRIES],
  ];
  const pills = regionInfo
    .map(([key, list]) => `<span class="gd-pill">${REGION_NAMES[key]} · ${list.length} ${list.length === 1 ? 'alias' : 'aliases'}</span>`)
    .join('');
  const total = regionInfo.reduce((n, [, list]) => n + list.length, 0);
  return `<div class="gd-live"><span class="gd-live-tag">Live · Regions → ${total} country aliases</span><div class="gd-pills">${pills}<span class="gd-pill">${REGION_NAMES['NON-EU']} · catch-all</span></div></div>`;
}

function guideLiveSchema() {
  const cols = OUTPUT_SCHEMA.map((c, i) => `<span class="gd-pill">${i + 1}. ${c}</span>`).join('');
  return `<div class="gd-live"><span class="gd-live-tag">Live · Output schema (${OUTPUT_SCHEMA.length} columns)</span><div class="gd-pills">${cols}</div></div>`;
}

function guideLiveRules() {
  const rows = DEFAULT_RULES
    .map(r => `<tr><td>${r.keys.join(', ')}</td><td>${r.towns.join(', ')}</td><td>${r.checkBothDirections ? 'Collection OR Delivery' : 'Delivery only'}</td></tr>`)
    .join('');
  return `<div class="gd-live"><span class="gd-live-tag">Live · ${DEFAULT_RULES.length} default rules</span>
    <table class="gd-table"><thead><tr><th>Ch To key</th><th>Town must be</th><th>Check</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function guideLiveRefCols() {
  const map = [
    ['Trial AWB', YESTERDAY_COLUMNS.TRIAL_AWB, 'Lookup key'],
    ['Description', YESTERDAY_COLUMNS.DESCRIPTION, 'Sub-steps 1'],
    ['UPS Tracking', YESTERDAY_COLUMNS.UPS_TRACKING, 'Sub-steps 2 & 4'],
    ['EXP DATE', YESTERDAY_COLUMNS.EXP_DATE, 'Sub-step 6'],
    ['Colour / Comment', YESTERDAY_COLUMNS.COLOR, 'Sub-step 7'],
  ];
  const rows = map
    .map(([what, idx, why]) => `<tr><td>${excelColLetter(idx)} · index ${idx}</td><td>${what}</td><td>${why}</td></tr>`)
    .join('');
  return `<div class="gd-live"><span class="gd-live-tag">Live · Yesterday report columns</span>
    <table class="gd-table"><thead><tr><th>Column</th><th>Content</th><th>Used by</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function guideLiveColors(includeChargeRefs) {
  const letters = Object.keys(PKG_COLOR_MAP);
  const swatches = letters
    .map(letter => {
      const keyName = PKG_COLOR_MAP[letter];
      const hex = argbToHex(COLOR_ARGB[keyName]);
      return `<span class="gd-swatch"><span class="gd-swatch-chip" style="background:${hex}"></span>${keyName[0].toUpperCase() + keyName.slice(1)} (${letter.toUpperCase()}) · ${hex}</span>`;
    })
    .join('');
  let html = `<div class="gd-live"><span class="gd-live-tag">Live · Row colour key (${letters.length} colours from yesterday’s column R)</span><div class="gd-swatches">${swatches}</div></div>`;
  if (includeChargeRefs) {
    html += `<div class="gd-live"><span class="gd-live-tag">Live · ${CHARGE_REF_ORANGE.length} orange fallback charge references</span><div class="gd-pills">${CHARGE_REF_ORANGE.map(c => `<span class="gd-pill"><code>${c}</code></span>`).join('')}</div></div>`;
  }
  return html;
}

function guideScrollToSelected(id) {
  const stacked = window.matchMedia('(max-width: 880px)').matches;
  if (stacked) {
    const detail = document.getElementById('guide-detail');
    if (detail) detail.scrollIntoView({ block: 'start' });
    return;
  }
  const flow = document.getElementById('guide-flow');
  const node = flow && flow.querySelector('[data-guide-id="' + id + '"]');
  if (node) node.scrollIntoView({ block: 'nearest' });
}

function selectGuideStep(id) {
  const flow = document.getElementById('guide-flow');
  if (flow) {
    flow.querySelectorAll('.flow-node-main, .flow-child').forEach(n =>
      n.classList.toggle('active', n.dataset.guideId === id));
  }
  const detail = document.getElementById('guide-detail');
  if (!detail) return;
  guideScrollToSelected(id);

  const pipelineItem = APP_GUIDE.pipeline.find(p => p.id === id);
  if (pipelineItem) {
    detail.innerHTML = `
      <div class="gd-kicker is-pipeline">Processing · sub-step ${APP_GUIDE.pipeline.indexOf(pipelineItem) + 1} of ${APP_GUIDE.pipeline.length}</div>
      <div class="gd-title">${pipelineItem.title}</div>
      <p class="gd-summary">${pipelineItem.desc}</p>
      <p class="gd-note">Part of <strong>Step 7 — Processing</strong>. Runs automatically and is recorded in the process log.</p>`;
    return;
  }

  const step = APP_GUIDE.steps.find(s => s.id === id) || APP_GUIDE.steps[0];
  let html = `
    <div class="gd-kicker">Step ${step.step} of ${APP_GUIDE.steps.length}</div>
    <div class="gd-title">${step.title}</div>
    <p class="gd-summary">${step.summary}</p>
    <ul class="gd-list">${step.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`;

  if (step.id === 'step1') html += guideLiveRegions();
  if (step.id === 'step3') html += guideLiveSchema();
  if (step.id === 'step5') html += guideLiveRules();
  if (step.id === 'step6') html += guideLiveRefCols();
  if (step.id === 'step7') html += guideLiveColors(true);
  if (step.id === 'step8') html += guideLiveColors(false);

  html += `<p class="gd-note">Live values above are rendered from the app configuration, so this guide stays in sync whenever a new release is pushed.</p>`;
  detail.innerHTML = html;
}

function renderGuideFlow() {
  const flow = document.getElementById('guide-flow');
  if (!flow) return;
  flow.innerHTML = '';

  APP_GUIDE.steps.forEach((step, i) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'flow-node flow-node-main';
    if (i === 0) node.classList.add('active');
    node.dataset.guideId = step.id;
    node.innerHTML = `
      <span class="flow-num">${step.step}</span>
      <span class="flow-node-main-txt">
        <span class="flow-node-title">${step.title}</span>
        <span class="flow-node-sub">${step.tagline}</span>
      </span>`;
    node.addEventListener('click', () => selectGuideStep(step.id));
    flow.appendChild(node);

    if (step.id === 'step7') {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'flow-expand-toggle';
      toggle.style.cssText = `align-self:flex-start;display:flex;align-items:center;gap:6px;margin:2px 0 8px 20px;padding:6px 12px;border-radius:9999px;border:1.5px dashed var(--border-glass);background:transparent;color:var(--text-muted);font-family:inherit;font-size:.72rem;font-weight:600;cursor:pointer;transition:var(--spring-transition);`;
      toggle.innerHTML = `
        <svg class="flow-chevron open" viewBox="0 0 16 16" fill="none" width="13" height="13"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Enrichment sub-steps (${APP_GUIDE.pipeline.length})`;
      toggle.addEventListener('click', () => {
        const open = childGroup.style.display !== 'none';
        childGroup.style.display = open ? 'none' : '';
        toggle.querySelector('.flow-chevron').classList.toggle('open', !open);
      });
      flow.appendChild(toggle);

      const childGroup = document.createElement('div');
      childGroup.className = 'flow-children';
      APP_GUIDE.pipeline.forEach((p, pi) => {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'flow-child';
        c.dataset.guideId = p.id;
        c.innerHTML = `<span class="flow-child-num">${pi + 1}</span><span class="flow-child-title">${p.title}</span>`;
        c.addEventListener('click', () => selectGuideStep(p.id));
        childGroup.appendChild(c);
      });
      flow.appendChild(childGroup);
    }

    if (i < APP_GUIDE.steps.length - 1) {
      const conn = document.createElement('div');
      conn.className = 'flow-to';
      flow.appendChild(conn);
    }
  });
}

function initAppGuide() {
  const overlay = document.getElementById('guide-overlay');
  if (!overlay) return;
  const open = () => {
    document.getElementById('guide-version').textContent = `Guide v${APP_GUIDE.version}`;
    renderGuideFlow();
    selectGuideStep('step1');
    const bodyEl = overlay.querySelector('.guide-panel-body');
    const flowEl = document.getElementById('guide-flow');
    if (bodyEl) bodyEl.scrollTop = 0;
    if (flowEl) flowEl.scrollTop = 0;
    overlay.hidden = false;
    document.body.classList.add('guide-open');
  };
  const close = () => {
    overlay.hidden = true;
    document.body.classList.remove('guide-open');
  };
  ['app-guide-btn', 'app-guide-fab'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', open);
  });
  document.getElementById('guide-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) close(); });
}

// ══════════════════════════════
//  Bootstrap
// ══════════════════════════════
// ══════════════════════════════
//  Dark Mode Toggle
// ══════════════════════════════
function initDarkMode() {
  const html = document.documentElement;
  const btn  = document.getElementById('dark-mode-toggle');
  if (!btn) return;

  // Restore saved preference
  const saved = localStorage.getItem('brand-theme');
  if (saved === 'dark') html.setAttribute('data-theme', 'dark');

  btn.addEventListener('click', () => {
    const isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
      html.removeAttribute('data-theme');
      localStorage.setItem('brand-theme', 'light');
    } else {
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem('brand-theme', 'dark');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  initDateDisplay();
  initRegionSelection();
  initUpload();
  initColumns();
  initCountryFilter();
  initRules();
  initRefFiles();
  initProcessing();
  initExport();
  initAppGuide();
  goToStep(1);
});


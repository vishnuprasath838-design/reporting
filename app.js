/* ─────────────────────────────────────────────
   Marken Report Formatter — app.js  (full)
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
  'Germany','Greece','Hungary','Ireland','Italy',
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
  EU: 'EU Region (27 Member States)',
  CH: 'CH Region (Switzerland)',
  IE: 'Ireland Region',
  'NON-EU': 'NON-EU Region (All Non-EU Countries)',
};

const DEFAULT_RULES = [
  { keys: ['US640','US1537'], towns: ['Dublin'],                     checkBothDirections: false },
  { keys: ['US537'],          towns: ['Dublin','Hamburg','Mainz'],   checkBothDirections: false },
  { keys: ['MI1058','SG1129'],towns: ['York'],                       checkBothDirections: false },
  { keys: ['CN1131'],         towns: ['Livingston','Q2 Livingston'], checkBothDirections: true  },
];

const COLOR_ARGB = {
  yellow: 'FFFFF2CC',
  purple: 'FFE8D5F5',
  red:    'FFFFD7D7',
  orange: 'FFFFE5CC',
};

const PKG_COLOR_MAP = { y:'yellow', p:'purple', r:'red', o:'orange' };
const CHARGE_REF_ORANGE = ['LT19062','LT18925','EP5770'];


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
const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g,' ');

function isNA(val) {
  if (val === null || val === undefined) return true;
  const s = String(val).trim().toLowerCase();
  return s === '' || s === 'n/a' || s === 'na' || s === '#n/a' || s === '0' || Number(s) === 0;
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
  const rows = state.workingData.length || state.originalCount;
  document.getElementById('stat-rows-val').textContent = rows > 0 ? rows.toLocaleString() : '—';
  const removed = state.originalCount - state.workingData.length;
  document.getElementById('stat-removed-val').textContent = removed > 0 ? removed.toLocaleString() : '—';
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
  if (regions.has('NON-EU')) state.selectedCountries.add('Non-EU Countries (Excluding 27 EU Member States)');

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
  if (!['xlsx','xls'].includes(ext)) { showToast('Please upload an .xlsx or .xls file','error'); return; }
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
      document.getElementById('file-info').classList.remove('hidden');
      document.getElementById('file-name-display').textContent = file.name;
      document.getElementById('file-meta-display').textContent =
        `${rows.length.toLocaleString()} rows · ${(file.size/1024).toFixed(1)} KB · Sheet: ${wb.SheetNames[0]}`;
      document.getElementById('step2-next').disabled = false;
      updateSidebar();
      showToast('File loaded successfully','success');
    } catch(err) { showToast('Failed to read file','error'); console.error(err); }
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
  if (regions.has('NON-EU')) list.push('Non-EU Countries (Excluding 27 EU Member States)');
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

  state.workingData = state.workingData.filter(row => {
    const dc = norm(row['Delivery Country']);
    if (!dc) return false;

    // Check explicit match (e.g. UK, US, EU member states, CH, IE)
    if (explicitCountries.has(dc)) return true;

    // Check Non-EU match
    if (hasNonEU && !euNorm.has(dc)) return true;

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
}

async function handleRefFile(file, type) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls'].includes(ext)) { showToast('Please upload an .xlsx or .xls file','error'); return; }
  try {
    const aoa = await parseFileAsAoA(file);
    if (type === 'yesterday') {
      state.yesterdayAoA = aoa;
      state.yesterdayLookup = buildLookup(aoa);
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

  // ── Sub-step 1: Description enrichment ──
  addLogEntry('running', 'Description Enrichment', 'Refreshing Description from yesterday/morning report (col 2) & converting Courier Service to N/A…', '📝');
  await tick();
  let descMatches = 0;
  let courierReplaced = 0;
  state.workingData.forEach(row => {
    const yRow = state.yesterdayLookup.get(norm(row['Trial AWB'] ?? ''));
    if (yRow) {
      const val = yRow[1]; // col index 2 → 0-based index 1
      if (!isNA(val)) { row['Description'] = val; descMatches++; }
    }
    // Convert any "Courier Service" description to N/A
    const currentDesc = String(row['Description'] ?? '').trim().toLowerCase();
    if (currentDesc.includes('courier service')) {
      row['Description'] = 'N/A';
      courierReplaced++;
    }
  });
  state.processLog.pop();
  addLogEntry('success', 'Description Enrichment', `${descMatches} descriptions refreshed — ${courierReplaced} "Courier Service" values converted to N/A`, '📝');
  await tick();

  // ── Sub-step 2: UPS Tracking enrichment ──
  addLogEntry('running', 'UPS Tracking', 'Refreshing UPS Tracking from yesterday/morning report (col 3)…', '📦');
  await tick();
  let upsMatches = 0;
  state.workingData.forEach(row => {
    const yRow = state.yesterdayLookup.get(norm(row['Trial AWB'] ?? ''));
    if (yRow) {
      const val = yRow[2]; // col index 3 → 0-based index 2
      if (!isNA(val)) { row['UPS Tracking'] = val; upsMatches++; }
    }
  });
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
      const val = yRow[12]; // col index 13 → 0-based 12
      if (!isNA(val)) { row['EXP DATE'] = val; expFilled++; }
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
      const val = String(yRow[17] ?? '').trim();
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
        chargeColored++;
      }
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
  document.getElementById('sum-original').textContent       = state.originalCount.toLocaleString();
  document.getElementById('sum-country-removed').textContent = state.removedByCountry.toLocaleString();
  document.getElementById('sum-rules-removed').textContent   = state.removedByRules.toLocaleString();
  document.getElementById('sum-colored').textContent         = state.rowColors.size.toLocaleString();
  document.getElementById('sum-final').textContent           = state.workingData.length.toLocaleString();

  const schema = state.dynamicSchema;
  const thead  = document.getElementById('preview-thead');
  const tbody  = document.getElementById('preview-tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const trHead = document.createElement('tr');
  schema.forEach(c => { const th = document.createElement('th'); th.textContent = c; trHead.appendChild(th); });
  thead.appendChild(trHead);

  const COLOR_BG = { yellow:'#FFF2CC', purple:'#E8D5F5', red:'#FFD7D7', orange:'#FFE5CC' };

  state.workingData.slice(0, 10).forEach((row, idx) => {
    const tr   = document.createElement('tr');
    const bg   = COLOR_BG[state.rowColors.get(idx)];
    if (bg) tr.style.background = bg;
    schema.forEach(c => {
      const td = document.createElement('td');
      let val = row[c];
      if (val instanceof Date) val = val.toLocaleDateString('en-GB');
      td.textContent = val !== undefined && val !== null ? String(val) : '';
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
    for (let c = 1; c <= schema.length; c++) {
      const cell = headerRow.getCell(c);
      cell.font = { bold: true, color: { argb: 'FFE8E8F0' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E2E' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
    }

    // Add data rows with left alignment & colors
    state.workingData.forEach((row, idx) => {
      const rowArray = schema.map(col => {
        let val = row[col];
        if (val instanceof Date) val = val.toLocaleDateString('en-GB');
        return val !== undefined && val !== null ? val : '';
      });

      const excelRow = worksheet.addRow(rowArray);
      excelRow.height = 18;

      const colorKey = state.rowColors.get(idx);
      const argb = colorKey ? COLOR_ARGB[colorKey] : null;

      for (let c = 1; c <= schema.length; c++) {
        const cell = excelRow.getCell(c);
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
        if (argb) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } };
        }
      }
    });

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
  const saved = localStorage.getItem('marken-theme');
  if (saved === 'dark') html.setAttribute('data-theme', 'dark');

  btn.addEventListener('click', () => {
    const isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
      html.removeAttribute('data-theme');
      localStorage.setItem('marken-theme', 'light');
    } else {
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem('marken-theme', 'dark');
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
  goToStep(1);
});


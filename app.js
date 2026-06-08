// ============================================================
// STEP 2 DASHBOARD — APP LOGIC + GOOGLE DRIVE SYNC
// ============================================================

const SCOPES = 'https://www.googleapis.com/auth/documents';

const TOPICS = []; // All topics are user-managed; seeded from data on first load

const DEFAULT_RESOURCES = [
  { group:'UWorld',   name:'Unfinished Peds' },
  { group:'UWorld',   name:'Unfinished EM' },
  { group:'UWorld',   name:'Unfinished Neuro' },
  { group:'UWorld',   name:'Unfinished IM' },
  { group:'AMBOSS',   name:'200 Concepts' },
  { group:'AMBOSS',   name:'High Yield Risk Factors' },
  { group:'AMBOSS',   name:'High Yield Biostats' },
  { group:'AMBOSS',   name:'High Yield Ethics' },
  { group:'AMBOSS',   name:'High Yield Nutrition' },
  { group:'Mehlman',  name:'Arrows' },
  { group:'Mehlman',  name:'Risk Factors' },
];

const STEP2_DATE = '2026-08-12';
const CSSE_DATE  = '2026-06-12';
const GOAL_SCORE = 90;

const SHELF_SCORES = [
  { date:'2025-08-12', label:'FM Shelf 1',      score:82 },
  { date:'2025-09-12', label:'FM Shelf 2',      score:87 },
  { date:'2025-10-06', label:'Peds Shelf 1',    score:87 },
  { date:'2025-10-31', label:'Peds Shelf 2',    score:87 },
  { date:'2025-11-12', label:'Surgery Shelf 1', score:75 },
  { date:'2025-12-19', label:'Surgery Shelf 2', score:83 },
  { date:'2026-02-13', label:'Psych Shelf 1',   score:94 },
  { date:'2026-03-20', label:'OB/GYN Shelf 1',  score:83 },
  { date:'2026-04-20', label:'IM Shelf 1',      score:88 },
  { date:'2026-05-29', label:'IM Shelf 2',      score:84 },
];

// ── EPC Subscore Data ─────────────────────────────────────
const EPC_DATA = {
  'Family Med': {
    epc: 87, avg: 73,
    subscores: [
      { label:'MSK & Skin',                    you:95, avg:77 },
      { label:'Cardiovascular & Respiratory',  you:92, avg:70 },
      { label:'Chronic Care',                  you:88, avg:73 },
      { label:'Health Maint, Pharm & Mgmt',    you:86, avg:72 },
      { label:'Diagnosis incl Foundational',   you:94, avg:74 },
      { label:'Pediatric (0–17)',               you:90, avg:71 },
      { label:'Adult (18–65)',                  you:86, avg:72 },
    ]
  },
  'Pediatrics': {
    epc: 87, avg: 76,
    subscores: [
      { label:'Skin, Neuro & MSK',             you:89, avg:76 },
      { label:'Cardiovascular & Respiratory',  you:86, avg:70 },
      { label:'Female Repro, OB & Endo',       you:94, avg:78 },
      { label:'Applying Foundational Science', you:98, avg:75 },
      { label:'Diagnosis',                     you:81, avg:76 },
      { label:'Health Maint, Pharm & Mgmt',    you:86, avg:77 },
    ]
  },
  'Surgery': {
    epc: 83, avg: 76,
    subscores: [
      { label:'Female Repro, Breast & Endo',   you:80, avg:76 },
      { label:'Applying Foundational Science', you:66, avg:73 },
      { label:'Respiratory System',            you:69, avg:73 },
      { label:'Gastrointestinal System',       you:90, avg:78 },
      { label:'Skin, Neuro & MSK',             you:91, avg:75 },
      { label:'Diagnosis',                     you:89, avg:77 },
      { label:'Pharm, Intervention & Mgmt',    you:83, avg:73 },
      { label:'Cardiovascular System',         you:97, avg:75 },
    ]
  },
  'Psychiatry': {
    epc: 94, avg: 85,
    subscores: [
      { label:'Psychotic Disorders',           you:94, avg:84 },
      { label:'Anxiety Disorders',             you:97, avg:86 },
      { label:'Mood Disorders',                you:98, avg:85 },
      { label:'Substance Use Disorders',       you:90, avg:83 },
      { label:'Diseases of Nervous System',    you:65, avg:77 },
      { label:'Diagnosis incl Foundational',   you:94, avg:85 },
      { label:'Pharm, Intervention & Mgmt',    you:90, avg:82 },
    ]
  },
  'OB/GYN': {
    epc: 83, avg: 78,
    subscores: [
      { label:'Female Reproductive & Breast',  you:83, avg:79 },
      { label:'Obstetric Complications',       you:97, avg:74 },
      { label:'Health Maint, Prevention',      you:73, avg:75 },
      { label:'Applying Foundational Science', you:86, avg:80 },
      { label:'Diagnosis',                     you:89, avg:79 },
      { label:'Pharm, Intervention & Mgmt',    you:82, avg:75 },
    ]
  },
  'Internal Med': {
    epc: 84, avg: 73,
    subscores: [
      { label:'Cardiovascular System',         you:67, avg:72 },
      { label:'Respiratory System',            you:81, avg:72 },
      { label:'Gastrointestinal System',       you:75, avg:73 },
      { label:'Female, Male Repro & Endo',     you:90, avg:73 },
      { label:'Skin, Neuro & MSK',             you:81, avg:74 },
      { label:'Applying Foundational Science', you:93, avg:74 },
      { label:'Diagnosis',                     you:81, avg:73 },
      { label:'Health Maint, Pharm & Mgmt',    you:89, avg:74 },
    ]
  },
};

// ── CMS Question Data ─────────────────────────────────────
const CMS_RAW = [
  { topic:'Endo: thyroid disorders',                   total:14, incorrect:6 },
  { topic:'Behavioral: disorders infancy/childhood',   total:10, incorrect:4 },
  { topic:'Gastro: congenital disorders',              total:7,  incorrect:3 },
  { topic:'Resp: upper airway disorders',              total:9,  incorrect:4 },
  { topic:'Biostat: sensitivity/specificity',          total:8,  incorrect:3 },
  { topic:'OB: obstetric complications',               total:20, incorrect:6 },
  { topic:'OB: labor and delivery',                    total:18, incorrect:5 },
  { topic:'OB: supervision of normal pregnancy',       total:12, incorrect:3 },
  { topic:'OB: systemic disorders/pregnancy',         total:10, incorrect:3 },
  { topic:'F Repro: menstrual/endocrine disorders',    total:22, incorrect:5 },
  { topic:'F Repro: infectious/inflammatory',          total:24, incorrect:4 },
  { topic:'F Repro: malignant/precancerous neoplasms', total:10, incorrect:2 },
  { topic:'F Repro: fertility and infertility',        total:8,  incorrect:3 },
  { topic:'F Repro: benign neoplasms and cysts',       total:10, incorrect:1 },
  { topic:'F Repro: menopause',                        total:7,  incorrect:3 },
  { topic:'Cardio: ischemic heart disease',            total:14, incorrect:2 },
  { topic:'Cardio: infectious disorders',              total:7,  incorrect:2 },
  { topic:'Cardio: peripheral arterial vascular',      total:6,  incorrect:2 },
  { topic:'Cardio: dysrhythmias',                      total:6,  incorrect:2 },
  { topic:'Cardio: congenital disorders',              total:6,  incorrect:2 },
  { topic:'Resp: obstructive airway disease',          total:12, incorrect:3 },
  { topic:'Resp: lower airway inf/inflammatory',       total:10, incorrect:1 },
  { topic:'Gastro: immunologic/inflammatory',          total:10, incorrect:3 },
  { topic:'Gastro: small intestine/colon disorders',   total:12, incorrect:2 },
  { topic:'Gastro: bacterial infections',              total:7,  incorrect:2 },
  { topic:'Blood: anemias: decreased production',      total:8,  incorrect:2 },
  { topic:'Blood: reactions to blood components',      total:5,  incorrect:1 },
  { topic:'CNS: cerebrovascular disease',              total:6,  incorrect:1 },
  { topic:'GenPrin: childhood developmental stages',   total:7,  incorrect:3 },
  { topic:'GenPrin: adulthood lifestyle/changes',      total:8,  incorrect:2 },
  { topic:'SocialSci: consent/informed consent',       total:6,  incorrect:2 },
  { topic:'Multi: fluid/electrolyte disorders',        total:7,  incorrect:2 },
  { topic:'MSK: inflammatory disorders',               total:7,  incorrect:1 },
  { topic:'Renal/Urin: adverse effects of drugs',      total:5,  incorrect:2 },
];

// ── Default Topic List ────────────────────────────────────
function pctToPriority(pct) {
  if (pct <= 60) return 'high';
  if (pct <= 70) return 'medium';
  return 'low';
}

const DEFAULT_TOPICS = [
  { name:'FM — Older Adult (66+)',                    pct:73 },
  { name:'Surgery — Applying Foundational Science',  pct:66 },
  { name:'Surgery — Respiratory System',             pct:69 },
  { name:'Surgery — Female Repro, Breast & Endo',   pct:80 },
  { name:'Surgery — Pharmacotherapy & Mgmt',         pct:83 },
  { name:'Psych — Diseases of Nervous System',       pct:65 },
  { name:'OB/GYN — Health Maint & Prevention',       pct:73 },
  { name:'IM — Cardiovascular System',               pct:67 },
  { name:'IM — Gastrointestinal System',             pct:75 },
  { name:'IM — Respiratory System',                  pct:81 },
  { name:'IM — Diagnosis',                           pct:81 },
  { name:'Endo: thyroid disorders',                  pct:57 },
  { name:'Resp: upper airway disorders',             pct:56 },
  { name:'Gastro: congenital disorders',             pct:57 },
  { name:'Behavioral: disorders infancy/childhood',  pct:60 },
  { name:'GenPrin: childhood developmental stages',  pct:57 },
  { name:'F Repro: menopause',                       pct:57 },
  { name:'Renal/Urin: adverse effects of drugs',     pct:60 },
  { name:'Biostat: sensitivity/specificity',         pct:63 },
  { name:'F Repro: fertility and infertility',       pct:63 },
  { name:'Cardio: peripheral arterial vascular',     pct:67 },
  { name:'Cardio: dysrhythmias',                     pct:67 },
  { name:'Cardio: congenital disorders',             pct:67 },
  { name:'OB: obstetric complications',              pct:70 },
  { name:'OB: systemic disorders in pregnancy',      pct:70 },
  { name:'Gastro: immunologic/inflammatory',         pct:70 },
  { name:'OB: labor and delivery',                   pct:72 },
  { name:'Cardio: infectious disorders',             pct:71 },
  { name:'Multi: fluid/electrolyte disorders',       pct:71 },
  { name:'OB: supervision of normal pregnancy',      pct:75 },
  { name:'Resp: obstructive airway disease',         pct:75 },
  { name:'F Repro: menstrual/endocrine disorders',   pct:77 },
  { name:'Blood: reactions to blood components',     pct:80 },
];

// ── State ─────────────────────────────────────────────────
let state = {
  topics:            [],
  archivedTopics:    [],
  resources:         [],
  archivedResources: [],
  nbmeScores:        [],
  cmsScores:         [],
  missedSessions:    [],
  notes:             [],
  archivedNotes:     [],
  todayFocus:        { date:'', items:[] },
  practiceExams:     [],
  suggestions:       [],
  advisorSessionLog: [],
};

let tokenClient;
let saveTimer         = null;
let shelfChart        = null;
let scoreView         = 'shelf';
let activeTopicFilter = 'all';
let dragSrcIdx        = null;
let dragSrcList       = null;
let epcRotation       = 'Family Med';
let epcSortDir        = 'asc';
let cmsFilter         = '5plus';

// ── Init ──────────────────────────────────────────────────
window.onload = function () {
  injectAppRefinements();
  document.addEventListener('keydown', globalKeyDown);

  gapi.load('client', async () => {
    try {
      await gapi.client.init({
        apiKey: typeof API_KEY !== 'undefined' ? API_KEY : '',
        discoveryDocs: ['https://docs.googleapis.com/$discovery/rest?version=v1']
      });
    } catch (e) { console.warn('gapi init:', e); }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { console.log('GIS:', resp.error); return; }
        const token = resp.access_token;
        gapi.client.setToken({ access_token: token });
        // Persist token + expiry so reload is silent
        localStorage.setItem('goog_token', token);
        localStorage.setItem('goog_token_exp', Date.now() + 55 * 60 * 1000); // 55 min
        showApp();
      }
    });

    // Try restoring saved token first
    const savedToken  = localStorage.getItem('goog_token');
    const savedExpiry = parseInt(localStorage.getItem('goog_token_exp') || '0');
    if (savedToken && Date.now() < savedExpiry) {
      gapi.client.setToken({ access_token: savedToken });
      showApp();
      // Schedule silent refresh before expiry
      const msLeft = savedExpiry - Date.now();
      setTimeout(() => tokenClient.requestAccessToken({ prompt:'none' }), Math.max(0, msLeft - 2 * 60 * 1000));
    } else {
      // Silent sign-in attempt
      setTimeout(() => tokenClient.requestAccessToken({ prompt:'none' }), 100);
    }
  });
};

async function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  await loadFromDrive();
  normalizeState();
  renderAll();
  // Auto-refresh token every 55 min while app is open
  setInterval(() => tokenClient.requestAccessToken({ prompt:'none' }), 55 * 60 * 1000);
  // Init pomodoro header display (needs header widgets injected by renderAll first)
  setTimeout(initPomDisplay, 100);
}

function handleSignIn()  { tokenClient.requestAccessToken({ prompt:'' }); }
function handleSignOut() {
  gapi.client.setToken(null);
  localStorage.removeItem('goog_token');
  localStorage.removeItem('goog_token_exp');
  document.getElementById('app').classList.remove('visible');
  document.getElementById('auth-screen').style.display = 'flex';
}

// ── Drive Sync ────────────────────────────────────────────
async function loadFromDrive() {
  try {
    const doc = await gapi.client.docs.documents.get({ documentId: DOC_ID });
    let text = '';
    for (const el of (doc.result.body.content || [])) {
      if (el.paragraph)
        for (const run of (el.paragraph.elements || []))
          if (run.textRun) text += run.textRun.content;
    }
    const trimmed = text.trim();
    if (trimmed) state = Object.assign({}, state, JSON.parse(trimmed));
  } catch(e) { console.warn('Load error:', e); }
}

function scheduleSave() {
  setSaveDot('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToDrive, 1100);
}

async function saveToDrive() {
  if (!gapi.client.getToken()) return;
  try {
    const doc = await gapi.client.docs.documents.get({ documentId: DOC_ID });
    const lastIndex = doc.result.body.content.reduce(
      (m, el) => el.endIndex ? Math.max(m, el.endIndex) : m, 1);
    const requests = [];
    if (lastIndex > 1)
      requests.push({ deleteContentRange:{ range:{ startIndex:1, endIndex:lastIndex-1 }}});
    requests.push({ insertText:{ location:{ index:1 }, text: JSON.stringify(state) }});
    await gapi.client.docs.documents.batchUpdate({ documentId:DOC_ID, resource:{ requests }});
    setSaveDot('saved');
    const lbl = document.getElementById('save-lbl');
    if (lbl) lbl.textContent = 'Saved ' + new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  } catch(e) { console.error('Save error:', e); setSaveDot('error'); }
}

function setSaveDot(st) {
  const dot = document.getElementById('save-dot');
  const lbl = document.getElementById('save-lbl');
  if (!dot) return;
  dot.className = '';
  if (st === 'saving') { dot.classList.add('saving'); if (lbl) lbl.textContent = 'Saving…'; }
  else if (st === 'saved') dot.classList.add('saved');
}

// ── State Normalization ───────────────────────────────────
function normalizeState() {
  if (!Array.isArray(state.topics))            state.topics            = [];
  if (!Array.isArray(state.archivedTopics))    state.archivedTopics    = [];
  if (!Array.isArray(state.resources))         state.resources         = [];
  if (!Array.isArray(state.archivedResources)) state.archivedResources = [];
  if (!Array.isArray(state.nbmeScores))        state.nbmeScores        = [];
  if (!Array.isArray(state.cmsScores))         state.cmsScores         = [];
  if (!Array.isArray(state.missedSessions))    state.missedSessions    = [];
  if (!Array.isArray(state.notes))             state.notes             = [];
  if (!Array.isArray(state.archivedNotes))     state.archivedNotes     = [];
  if (!Array.isArray(state.practiceExams))     state.practiceExams     = [];
  if (!Array.isArray(state.suggestions))       state.suggestions       = [];
  if (!Array.isArray(state.advisorSessionLog)) state.advisorSessionLog = [];
  if (!state.todayFocus) state.todayFocus = { date:'', items:[] };

  if (state.topics && !Array.isArray(state.topics)) {
    const obj = state.topics;
    state.topics = Object.keys(obj).map(name => ({ id:uid(), name, done: !!obj[name] }));
  }

  if (state.topicNotes && typeof state.topicNotes === 'object') {
    state.topics.forEach(t => {
      if (!t.note && state.topicNotes[t.name]) t.note = state.topicNotes[t.name];
    });
    delete state.topicNotes;
  }

  const oldBaseNames = [
    'OB complications + labor/delivery',
    'Female reproductive: menstrual/endocrine, infections, breast, Pap/HPV',
    'Thyroid disorders','Pediatric developmental/behavioral disorders',
    'Pediatric congenital GI','Respiratory: upper airway + obstructive disease',
    'GI: inflammatory/bacterial/small bowel-colon','Biostatistics/test characteristics',
    'Cardiology: endocarditis, congenital, PAD, ACS/HF basics',
    'Fluids/electrolytes cleanup','Anemia/transfusion cleanup','Ethics/QI light maintenance',
    'ob','frepro','resp','cardio','endo','multi','blood','cns','gi','beh','bio','msk'
  ];
  state.topics = state.topics.filter(t => !oldBaseNames.includes(t.name));

  if (!state.topics.length && !state.archivedTopics.length) {
    state.topics = DEFAULT_TOPICS.map(t => ({
      id: uid(), name: t.name, done: false,
      priority: pctToPriority(t.pct), pct: t.pct
    }));
  }

  state.topics.forEach(t => {
    if (!t.id)       t.id       = uid();
    if (!t.priority || t.priority === 'none') {
      const def = DEFAULT_TOPICS.find(d => d.name === t.name);
      if (def) t.priority = pctToPriority(def.pct);
      else if (!t.priority) t.priority = 'none';
    }
  });

  const PRIO_ORDER = { high:0, medium:1, low:2, none:3 };
  state.topics.sort((a,b) => (PRIO_ORDER[a.priority] ?? 3) - (PRIO_ORDER[b.priority] ?? 3));

  if (state.resources.length && typeof state.resources[0] === 'string') {
    state.resources = state.resources.map(r => ({ id:uid(), name:r, group:'', done:false }));
  }
  if (!state.resources.length && !state.archivedResources.length) {
    state.resources = DEFAULT_RESOURCES.map(r => ({ ...r, id:uid(), done:false }));
  }
  state.resources.forEach(r => { if (!r.id) r.id = uid(); });

  const fixed = [
    { id:'csse-fixed',  name:'CSSE',      date:CSSE_DATE,  locked:true },
    { id:'step2-fixed', name:'Step 2 CK', date:STEP2_DATE, locked:true },
  ];
  fixed.forEach(item => {
    if (!state.practiceExams.some(x => x.id === item.id))
      state.practiceExams.push(item);
  });

  if (!state.suggestions.length) {
    state.suggestions = [
      { id:uid(), title:'Weekly Study Planner', body:'A weekly calendar view to drag topics, exams, and review sessions onto specific days. Natural next layer.', status:'idea' },
      { id:uid(), title:'Weakness Dashboard by Source', body:'Separate weak spots by CMS, UWorld, AMBOSS, shelf, NBME so repeated misses become obvious.', status:'idea' },
      { id:uid(), title:'Step 2 Score Predictor', body:'Estimate combining UWorld %, shelf EPCs, NBMEs, Free 120, and timing until exam.', status:'idea' },
    ];
  }
}

function uid() { return Math.random().toString(36).slice(2,10); }

// ── Runtime UI Injection ──────────────────────────────────
function injectAppRefinements() {
  injectStyles();
  injectSpotifyTab();
  rebuildDashboardShell();
  rebuildTopicsTab();
  injectAdvisor();
}

function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    /* ── DASHBOARD 2x2 ── */
    .dash-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; }
    .dash-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-lg); padding:1.05rem 1.2rem; min-width:0; }
    .dash-head { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:.7rem; }
    .dash-title { font-family:var(--font-display); font-size:.95rem; font-weight:700; color:var(--text-primary); }
    .dash-meta  { font-family:var(--font-mono); font-size:.6rem; color:var(--text-tertiary); }

    .cd-big  { font-family:var(--font-display); font-size:2.6rem; font-weight:800; color:var(--accent); line-height:1; }
    .cd-sub  { font-family:var(--font-mono); font-size:.62rem; color:var(--text-tertiary); margin-top:.2rem; margin-bottom:.9rem; }
    .exam-row { display:flex; align-items:center; justify-content:space-between; padding:.38rem 0;
                border-bottom:1px solid var(--border); }
    .exam-row:last-of-type { border-bottom:none; }
    .exam-name { font-family:var(--font-mono); font-size:.75rem; color:var(--text-primary);
                 overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%; }
    .exam-date { font-family:var(--font-mono); font-size:.65rem; color:var(--text-tertiary); white-space:nowrap; }
    .exam-empty { font-family:var(--font-mono); font-size:.72rem; color:var(--text-tertiary); padding:.3rem 0; }

    .focus-empty { font-family:var(--font-mono); font-size:.72rem; color:var(--text-tertiary); padding:.3rem 0; }
    .focus-add   { display:grid; grid-template-columns:1fr auto; gap:8px; margin-top:.7rem; }
    .focus-textarea { min-height:36px; max-height:90px; resize:vertical; line-height:1.35; }

    .chart-toggle { display:flex; gap:4px; }
    .chart-tog { font-family:var(--font-mono); font-size:.62rem; padding:3px 8px;
                 border-radius:var(--r-sm); border:1px solid var(--border);
                 color:var(--text-tertiary); background:transparent; cursor:pointer; }
    .chart-tog.active { color:var(--accent-text); border-color:rgba(176,120,48,.35); background:var(--accent-glow); }
    .score-mini-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:.65rem; }
    .score-mini { border:1px solid var(--border); border-radius:var(--r-sm); background:var(--bg-subtle); padding:.4rem .5rem; }
    .score-mini-num { font-family:var(--font-display); font-weight:800; font-size:1rem; color:var(--accent); line-height:1; }
    .score-mini-lbl { font-family:var(--font-mono); font-size:.52rem; color:var(--text-tertiary); margin-top:.15rem; }

    .mini-progress-line { height:4px; background:var(--bg-elevated); border-radius:999px; overflow:hidden; margin:.1rem 0 .5rem; }
    .mini-progress-fill { height:100%; background:var(--accent); width:0%; transition:width .35s; }
    .ws-filter-row { display:flex; gap:3px; margin-bottom:.5rem; }
    .ws-filter-btn { font-family:var(--font-mono); font-size:.62rem; padding:3px 7px;
                     border-radius:var(--r-sm); border:1px solid var(--border);
                     color:var(--text-tertiary); background:transparent; cursor:pointer; }
    .ws-filter-btn.active { color:var(--accent-text); border-color:rgba(176,120,48,.35); background:var(--accent-glow); }
    .ws-list { display:flex; flex-direction:column; gap:3px; max-height:200px; overflow-y:auto; }
    .ws-row  { display:flex; align-items:center; gap:7px; padding:.38rem .55rem;
               border-radius:var(--r-sm); border:1px solid transparent; cursor:pointer; transition:all .15s; min-width:0; }
    .ws-row:hover { background:var(--bg-elevated); border-color:var(--border); }
    .ws-row.done  { opacity:.52; }
    .ws-row.done .ws-name { text-decoration:line-through; color:var(--text-tertiary); }
    .ws-check { width:14px; height:14px; border-radius:3px; border:1px solid var(--border-bright);
                display:flex; align-items:center; justify-content:center; font-size:8px; flex-shrink:0; }
    .ws-row.done .ws-check { background:var(--success-bg); border-color:var(--success); color:var(--success); }
    .ws-name { font-family:var(--font-mono); font-size:.7rem; color:var(--text-primary);
               flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ws-del  { background:transparent; border:none; color:transparent; font-size:.8rem; cursor:pointer; padding:0 2px; flex-shrink:0; }
    .ws-row:hover .ws-del { color:var(--text-tertiary); }
    .ws-del:hover { color:var(--urgent) !important; }
    .ws-add  { display:grid; grid-template-columns:1fr auto; gap:7px; margin-top:.65rem; }

    .topic-toolbar { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
    .topic-toolbar .input { flex:1; min-width:140px; }
    .topic-filter-group { display:flex; gap:3px; }
    .topic-filter-btn { font-family:var(--font-mono); font-size:.62rem; padding:3px 7px;
                        border-radius:var(--r-sm); border:1px solid var(--border);
                        color:var(--text-tertiary); background:transparent; cursor:pointer; }
    .topic-filter-btn.active { color:var(--accent-text); border-color:rgba(176,120,48,.35); background:var(--accent-glow); }
    .topic-list-full { display:flex; flex-direction:column; gap:4px; margin-bottom:10px; }
    .topic-row-full { display:flex; align-items:center; gap:10px; padding:.58rem .85rem;
                      border:1px solid var(--border); background:var(--bg-card);
                      border-radius:var(--r-md); cursor:default; user-select:none; }
    .topic-row-full:hover { border-color:var(--border-bright); }
    .topic-row-full.done { opacity:.58; }
    .topic-row-full.done .topic-name-full { text-decoration:line-through; color:var(--text-tertiary); }
    .topic-drag-handle { color:var(--text-tertiary); font-size:.75rem; cursor:grab; padding:0 2px; flex-shrink:0; }
    .topic-drag-handle:active { cursor:grabbing; }
    .topic-row-full.drag-over { border-color:var(--accent); background:var(--accent-glow); }
    .topic-name-full { font-family:var(--font-mono); font-size:.8rem; color:var(--text-primary); flex:1; }
    .topic-arch-btn { background:transparent; border:1px solid var(--border); color:var(--text-tertiary);
                      border-radius:4px; padding:2px 7px; font-family:var(--font-mono);
                      font-size:.58rem; cursor:pointer; flex-shrink:0; }
    .topic-arch-btn:hover { color:var(--accent-text); border-color:rgba(176,120,48,.35); background:var(--accent-glow); }
    .topic-add-row { display:grid; grid-template-columns:1fr auto; gap:8px; }

    .resource-item-full { display:flex; align-items:center; gap:8px; padding:.5rem .85rem;
                           background:var(--bg-card); border:1px solid var(--border);
                           border-radius:var(--r-sm); user-select:none; }
    .resource-item-full:hover { border-color:var(--border-bright); }
    .resource-item-full.drag-over { border-color:var(--accent); background:var(--accent-glow); }
    .res-drag { color:var(--text-tertiary); font-size:.75rem; cursor:grab; padding:0 2px; flex-shrink:0; }
    .res-drag:active { cursor:grabbing; }
    .res-check { width:15px; height:15px; border-radius:3px; border:1px solid var(--border-bright);
                 display:flex; align-items:center; justify-content:center; font-size:8px; flex-shrink:0; cursor:pointer; }
    .res-done .res-check { background:var(--success-bg); border-color:var(--success); color:var(--success); }
    .res-done .res-name   { text-decoration:line-through; color:var(--text-tertiary); }
    .res-group-tag { font-family:var(--font-mono); font-size:.58rem; color:var(--accent-text);
                     background:var(--accent-glow); border:1px solid rgba(176,120,48,.2);
                     border-radius:3px; padding:1px 5px; flex-shrink:0; }
    .res-name { flex:1; font-size:.85rem; color:var(--text-secondary); }
    .res-arch-btn { background:transparent; border:1px solid var(--border); color:var(--text-tertiary);
                    border-radius:4px; padding:2px 7px; font-family:var(--font-mono);
                    font-size:.58rem; cursor:pointer; flex-shrink:0; }
    .res-arch-btn:hover { color:var(--accent-text); border-color:rgba(176,120,48,.35); background:var(--accent-glow); }
    .add-res-row { display:flex; gap:8px; margin-top:8px; }

    .inline-entry-form { background:var(--bg-subtle); border:1px solid var(--border);
                         border-radius:var(--r-md); padding:1rem 1.1rem; margin:.5rem 1.1rem 1rem;
                         display:flex; flex-direction:column; gap:8px; }
    .ief-row  { display:flex; gap:8px; }
    .ief-stack { display:flex; flex-direction:column; gap:3px; }
    .ief-label { font-family:var(--font-mono); font-size:.6rem; letter-spacing:.08em;
                 text-transform:uppercase; color:var(--text-tertiary); }
    .ief-ta   { min-height:58px; resize:vertical; }
    .ief-acts { display:flex; gap:8px; justify-content:flex-end; margin-top:4px; }


    .pe-row { display:flex; align-items:center; justify-content:space-between; gap:8px;
              padding:.45rem 0; border-bottom:1px solid var(--border); }
    .pe-row:last-of-type { border-bottom:none; }
    .pe-drag { color:var(--text-tertiary); font-size:.75rem; cursor:grab; padding:0 4px; }
    .pe-name  { font-family:var(--font-mono); font-size:.78rem; color:var(--text-primary); flex:1; }
    .pe-date  { font-family:var(--font-mono); font-size:.65rem; color:var(--text-tertiary); }
    .pe-del   { background:transparent; border:none; color:var(--text-tertiary); cursor:pointer; font-size:.85rem; padding:0 3px; }
    .pe-del:hover { color:var(--urgent); }
    .pe-add   { display:grid; grid-template-columns:1fr auto auto; gap:8px; margin-top:10px; }

    @media (max-width:700px) {
      .dash-grid { grid-template-columns:1fr; }
    }
    .btn-xs.active { color:var(--accent-text); border-color:rgba(176,120,48,.35); background:var(--accent-glow); }
    .epc-rot-btn.active { color:var(--accent-text) !important; border-color:rgba(176,120,48,.35) !important; background:var(--accent-glow) !important; }

    /* ── HEADER SPOTIFY + POMODORO ── */
    /* Spotify section */
    .hdr-sp-section {
      display:flex; align-items:center; gap:8px;
      padding:5px 10px; background:var(--bg-elevated);
      border:1px solid var(--border); border-radius:var(--r-md);
      height:38px; min-width:240px; max-width:320px;
    }
    .hdr-art { width:26px; height:26px; border-radius:3px; object-fit:cover; flex-shrink:0; background:var(--bg-elevated); }
    .hdr-track-info { flex:1; min-width:0; }
    .hdr-track-name { font-family:var(--font-mono); font-size:.65rem; color:var(--text-primary);
                      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .hdr-artist-name { font-family:var(--font-mono); font-size:.56rem; color:var(--text-tertiary);
                       white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .hdr-sp-dot { width:5px; height:5px; border-radius:50%; background:#1DB954; flex-shrink:0; }
    .hdr-sp-controls { display:flex; gap:2px; align-items:center; flex-shrink:0; }
    .hdr-sp-btn { background:transparent; border:none; color:var(--text-tertiary); cursor:pointer;
                  font-size:.78rem; padding:3px 5px; border-radius:3px; transition:all .12s; line-height:1; }
    .hdr-sp-btn:hover { color:var(--text-primary); background:var(--bg-card); }
    .hdr-sp-btn.play { color:var(--accent-text); }
    .hdr-sp-connect { font-family:var(--font-mono); font-size:.62rem; padding:5px 10px;
                      background:#1DB954; color:#fff; border:none; border-radius:var(--r-sm);
                      cursor:pointer; white-space:nowrap; transition:background .15s; }
    .hdr-sp-connect:hover { background:#1ed760; }

    /* Pomodoro section */
    .hdr-pom-section {
      display:flex; align-items:center; gap:8px;
      padding:5px 10px; background:var(--bg-elevated);
      border:1px solid var(--border); border-radius:var(--r-md);
      height:38px;
    }
    .hdr-pom-inner { text-align:center; min-width:52px; }
    .hdr-pom-time { font-family:var(--font-mono); font-size:.82rem; font-weight:600;
                    color:var(--accent); line-height:1; }
    .hdr-pom-phase { font-family:var(--font-mono); font-size:.52rem; text-transform:uppercase;
                     letter-spacing:.06em; color:var(--text-tertiary); margin-top:1px; }
    .hdr-pom-phase.break { color:#2E7D32; }
    .hdr-pom-btns { display:flex; gap:2px; }
    .hdr-pom-btn { background:transparent; border:none; color:var(--text-tertiary); cursor:pointer;
                   font-size:.82rem; padding:3px 5px; border-radius:3px; transition:all .12s; line-height:1; }
    .hdr-pom-btn:hover { color:var(--text-primary); background:var(--bg-card); }

    /* Pomodoro edit popover */
    .pom-edit-pop {
      position:fixed; z-index:200;
      background:var(--bg-card); border:1px solid var(--border-bright);
      border-radius:var(--r-lg); padding:.85rem 1rem;
      box-shadow:0 8px 24px rgba(0,0,0,.12);
    }
    .pom-set-label { font-family:var(--font-mono); font-size:.58rem; text-transform:uppercase;
                     letter-spacing:.08em; color:var(--text-tertiary); margin-bottom:3px; }

    /* Legacy sp- classes kept for SDK compat */
    .sp-dot { width:6px; height:6px; border-radius:50%; background:#1DB954; flex-shrink:0; }

    /* Focus tab layout */
    .focus-tab-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
    @media (max-width:700px) { .focus-tab-grid { grid-template-columns:1fr; } }

    /* Now Playing card */
    .sp-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-lg); padding:1.25rem; }
    .sp-art-lg { width:100%; aspect-ratio:1; border-radius:var(--r-md); object-fit:cover;
                 background:var(--bg-elevated); margin-bottom:1rem; display:block; }
    .sp-track-lg { font-family:var(--font-display); font-size:1.1rem; font-weight:700;
                   color:var(--text-primary); margin-bottom:.2rem; line-height:1.3; }
    .sp-artist-lg { font-family:var(--font-mono); font-size:.75rem; color:var(--text-tertiary); margin-bottom:.85rem; }
    .sp-progress-wrap { height:3px; background:var(--bg-elevated); border-radius:999px; margin-bottom:.5rem; overflow:hidden; }
    /* NOTE: no CSS transition on progress bar — interpolator drives it smoothly at 1s intervals */
    .sp-progress-bar  { height:100%; background:#1DB954; border-radius:999px; }
    .sp-time-row { display:flex; justify-content:space-between; font-family:var(--font-mono);
                   font-size:.58rem; color:var(--text-tertiary); margin-bottom:1rem; }
    .sp-controls { display:flex; align-items:center; justify-content:center; gap:16px; }
    .sp-ctrl-btn { background:transparent; border:none; cursor:pointer; color:var(--text-secondary);
                   font-size:1.2rem; transition:all .15s; padding:4px; border-radius:50%; }
    .sp-ctrl-btn:hover { color:var(--text-primary); transform:scale(1.1); }
    .sp-ctrl-btn.play { width:44px; height:44px; background:#1DB954; color:#fff; border-radius:50%;
                        font-size:1rem; display:flex; align-items:center; justify-content:center; }
    .sp-ctrl-btn.play:hover { background:#1ed760; transform:scale(1.05); }
    .sp-connect-btn { width:100%; padding:.65rem; background:#1DB954; color:#fff; border:none;
                      border-radius:var(--r-md); font-family:var(--font-mono); font-size:.78rem;
                      font-weight:600; cursor:pointer; transition:background .15s; }
    .sp-connect-btn:hover { background:#1ed760; }
    .sp-idle { font-family:var(--font-mono); font-size:.75rem; color:var(--text-tertiary);
               text-align:center; padding:2rem 1rem; }

    /* Pomodoro + moods card */
    .pom-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-lg); padding:1.25rem; }
    .pom-display { text-align:center; margin:.75rem 0 1rem; }
    .pom-time { font-family:var(--font-display); font-size:3.5rem; font-weight:800;
                color:var(--accent); line-height:1; letter-spacing:-.03em; }
    .pom-phase { font-family:var(--font-mono); font-size:.65rem; text-transform:uppercase;
                 letter-spacing:.1em; color:var(--text-tertiary); margin-top:.3rem; }
    .pom-phase.break { color:#2E7D32; }
    .pom-settings { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:.85rem; }
    .pom-set-label { font-family:var(--font-mono); font-size:.58rem; text-transform:uppercase;
                     letter-spacing:.08em; color:var(--text-tertiary); margin-bottom:3px; }
    .pom-controls { display:flex; gap:8px; justify-content:center; margin-bottom:1.1rem; }
    .pom-btn { font-family:var(--font-mono); font-size:.72rem; padding:.45rem 1.1rem;
               border-radius:var(--r-sm); border:1px solid var(--border);
               background:transparent; color:var(--text-secondary); cursor:pointer; transition:all .15s; }
    .pom-btn:hover { border-color:var(--border-bright); color:var(--text-primary); }
    .pom-btn.primary { background:var(--accent-glow); border-color:rgba(176,120,48,.3); color:var(--accent-text); }
    .pom-btn.primary:hover { background:rgba(176,120,48,.18); border-color:var(--accent); }
    .pom-btn.danger { background:rgba(184,58,32,.08); border-color:rgba(184,58,32,.2); color:#B83A20; }

    .mood-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
    .mood-btn { font-family:var(--font-mono); font-size:.65rem; padding:.5rem .3rem;
                border-radius:var(--r-sm); border:1px solid var(--border);
                background:var(--bg-subtle); color:var(--text-secondary);
                cursor:pointer; transition:all .15s; text-align:center; line-height:1.4; }
    .mood-btn:hover { border-color:var(--border-bright); background:var(--bg-elevated); color:var(--text-primary); }

    /* ── CALENDAR ── */
    .cal-card { padding-bottom:1.2rem; }
    .cal-dow-row { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; margin-bottom:4px; }
    .cal-dow { font-family:var(--font-mono); font-size:.6rem; text-align:center; color:var(--text-tertiary);
               text-transform:uppercase; letter-spacing:.06em; padding:.3rem 0; }
    .cal-weeks { display:flex; flex-direction:column; gap:2px; }
    .cal-week  { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
    .cal-day   { min-height:74px; border:1px solid var(--border); border-radius:var(--r-sm);
                 background:var(--bg-card); padding:4px 5px; cursor:pointer;
                 transition:border-color .12s; position:relative; overflow:hidden; }
    .cal-day:hover { border-color:var(--border-bright); background:var(--bg-subtle); }
    .cal-day.other-month { background:var(--bg-base); }
    .cal-day.other-month .cal-day-num { color:var(--text-tertiary); opacity:.45; }
    .cal-day.is-today { border-color:var(--accent); }
    .cal-day.is-today .cal-day-num { color:var(--accent); font-weight:700; }
    .cal-day-num { font-family:var(--font-mono); font-size:.68rem; color:var(--text-secondary);
                   line-height:1; margin-bottom:3px; }
    .cal-events { display:flex; flex-direction:column; gap:2px; }
    .cal-evt { font-family:var(--font-mono); font-size:.58rem; padding:1px 5px;
               border-radius:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
               cursor:pointer; transition:opacity .12s; line-height:1.5; }
    .cal-evt:hover { opacity:.8; }
    .cal-evt-more { font-family:var(--font-mono); font-size:.55rem; color:var(--text-tertiary);
                    padding:1px 3px; cursor:pointer; }
    .cal-evt-cont-left  { border-radius:0 3px 3px 0; margin-left:-5px; padding-left:3px; }
    .cal-evt-cont-right { border-radius:3px 0 0 3px; margin-right:-5px; padding-right:3px; }
    .cal-evt-cont-mid   { border-radius:0; margin-left:-5px; margin-right:-5px; padding-left:3px; padding-right:3px; }

    /* Event type colors */
    .cal-type-exam     { background:#FCEBEB; color:#A32D2D; border-left:2px solid #E24B4A; }
    .cal-type-study    { background:var(--accent-glow); color:var(--accent-text); border-left:2px solid var(--accent); }
    .cal-type-personal { background:#EEE6F8; color:#6B3FA0; border-left:2px solid #9B6DD6; }
    .cal-type-rotation { background:#E3F2E8; color:#2A6B3A; border-left:2px solid #4CAF6B; }
    .cal-type-exam.locked { opacity:.75; cursor:default; }

    /* Calendar event popover */
    .cal-popover { position:fixed; z-index:150; background:var(--bg-card);
                   border:1px solid var(--border-bright); border-radius:var(--r-lg);
                   box-shadow:0 8px 28px rgba(0,0,0,.14); padding:1rem 1.1rem;
                   width:280px; }
    .cal-pop-title { font-family:var(--font-display); font-size:.95rem; font-weight:700;
                     color:var(--text-primary); margin-bottom:.75rem; }
    .cal-pop-row { display:flex; flex-direction:column; gap:3px; margin-bottom:.6rem; }
    .cal-pop-label { font-family:var(--font-mono); font-size:.58rem; text-transform:uppercase;
                     letter-spacing:.08em; color:var(--text-tertiary); }
    .cal-type-btns { display:flex; gap:4px; flex-wrap:wrap; margin-top:3px; }
    .cal-type-btn { font-family:var(--font-mono); font-size:.62rem; padding:3px 9px;
                    border-radius:3px; border:1px solid var(--border); background:transparent;
                    color:var(--text-tertiary); cursor:pointer; transition:all .12s; }
    .cal-type-btn.active { font-weight:600; }
    .cal-type-btn.exam     { border-color:#E24B4A; }
    .cal-type-btn.exam.active     { background:#FCEBEB; color:#A32D2D; }
    .cal-type-btn.study    { border-color:var(--accent); }
    .cal-type-btn.study.active    { background:var(--accent-glow); color:var(--accent-text); }
    .cal-type-btn.personal { border-color:#9B6DD6; }
    .cal-type-btn.personal.active { background:#EEE6F8; color:#6B3FA0; }
    .cal-type-btn.rotation { border-color:#4CAF6B; }
    .cal-type-btn.rotation.active { background:#E3F2E8; color:#2A6B3A; }
    .cal-pop-acts { display:flex; gap:8px; justify-content:flex-end; margin-top:.75rem; }
  `;
  document.head.appendChild(s);
}

function rebuildDashboardShell() {
  const dash = document.getElementById('tab-dashboard');
  if (!dash) return;
  dash.innerHTML = `
    <div class="dash-grid">
      <div class="dash-card">
        <div class="dash-head">
          <div>
            <div class="dash-title">Step 2 CK</div>
            <div class="dash-meta">Aug 12, 2026</div>
          </div>
          <button class="btn btn-ghost btn-xs" onclick="openPracticeExamModal()">Change</button>
        </div>
        <div class="cd-big" id="step-days">–</div>
        <div class="cd-sub">days remaining</div>
        <div id="practice-exam-list"></div>
      </div>

      <div class="dash-card">
        <div class="dash-head">
          <div class="dash-title">Today's Focus</div>
          <div class="dash-meta" id="focus-date-lbl"></div>
        </div>
        <div id="focus-items"></div>
        <div class="focus-add">
          <textarea class="input focus-textarea" id="focus-text-inp"
            placeholder="Type a focus item…"
            onkeydown="if((event.metaKey||event.ctrlKey)&&event.key==='Enter')addFocusTopic()"></textarea>
          <button class="btn btn-primary btn-sm" onclick="addFocusTopic()">Add</button>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-head">
          <div class="dash-title">Score Trajectory</div>
          <div class="chart-toggle">
            <button class="chart-tog active" id="tog-shelf" onclick="setScoreView('shelf')">Shelf Scores</button>
            <button class="chart-tog"        id="tog-nbme"  onclick="setScoreView('nbme')">NBMEs</button>
          </div>
        </div>
        <div class="score-mini-grid">
          <div class="score-mini"><div class="score-mini-num" id="score-latest">–</div><div class="score-mini-lbl">Latest</div></div>
          <div class="score-mini"><div class="score-mini-num" id="score-avg">–</div><div class="score-mini-lbl">Average</div></div>
          <div class="score-mini"><div class="score-mini-num" id="score-best">–</div><div class="score-mini-lbl">Best</div></div>
        </div>
        <canvas id="shelf-chart"></canvas>
      </div>

      <div class="dash-card">
        <div class="dash-head">
          <div class="dash-title">Weak Spots</div>
          <div class="dash-meta" id="ws-frac">0 / 0</div>
        </div>
        <div class="mini-progress-line"><div class="mini-progress-fill" id="ws-progress-fill"></div></div>
        <div class="ws-filter-row">
          <button class="ws-filter-btn active" id="ws-filter-all"  onclick="setTopicFilter('all')">All</button>
          <button class="ws-filter-btn"        id="ws-filter-open" onclick="setTopicFilter('open')">Open</button>
        </div>
        <div class="ws-list" id="ws-list"></div>
        <div class="ws-add">
          <input class="input" id="ws-inp" placeholder="Add weak spot…" onkeydown="if(event.key==='Enter')addWeakSpot()">
          <button class="btn btn-ghost btn-sm" onclick="addWeakSpot()">Add</button>
        </div>
      </div>
    </div>

    <!-- CALENDAR -->
    <div class="dash-card cal-card" style="margin-top:14px">
      <div class="dash-head">
        <div class="dash-title">Calendar</div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn btn-ghost btn-xs" onclick="calPrevMonth()">‹</button>
          <div class="dash-meta" id="cal-month-lbl" style="font-size:.78rem;color:var(--text-primary);font-family:var(--font-display);font-weight:600;min-width:120px;text-align:center"></div>
          <button class="btn btn-ghost btn-xs" onclick="calNextMonth()">›</button>
          <button class="btn btn-ghost btn-xs" onclick="calGoToday()">Today</button>
        </div>
      </div>
      <div id="cal-grid"></div>
    </div>
  `;
}

function rebuildTopicsTab() {
  const tab = document.getElementById('tab-topics');
  if (!tab) return;
  tab.innerHTML = `
    <div class="progress-bar-card">
      <svg width="58" height="58" viewBox="0 0 58 58" style="flex-shrink:0">
        <circle cx="29" cy="29" r="23" fill="none" stroke="var(--border)" stroke-width="5"/>
        <circle id="ring-arc" cx="29" cy="29" r="23" fill="none" stroke="var(--accent)" stroke-width="5"
          stroke-dasharray="144.5" stroke-dashoffset="144.5" stroke-linecap="round"
          transform="rotate(-90 29 29)" style="transition:stroke-dashoffset .5s ease"/>
      </svg>
      <div class="ring-stats">
        <div class="ring-main" id="ring-frac">0 / 0</div>
        <div class="ring-sub">topics completed</div>
        <div class="ring-pct" id="ring-pct">0% done</div>
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="openTopicArchiveModal()">
        Archived <span id="topic-arch-badge" class="arch-badge" style="display:none;margin-left:4px"></span>
      </button>
    </div>

    <div class="topic-toolbar">
      <input class="input" id="topic-search-inp" placeholder="Search topics…" oninput="renderTopics()">
      <div class="topic-filter-group">
        <button class="topic-filter-btn active" id="topic-filter-all"  onclick="setTopicFilterFull('all')">All</button>
        <button class="topic-filter-btn"        id="topic-filter-open" onclick="setTopicFilterFull('open')">Open</button>
        <button class="topic-filter-btn"        id="topic-filter-done" onclick="setTopicFilterFull('done')">Done</button>
      </div>
    </div>

    <div class="topic-list-full" id="topics-list"></div>

    <div class="topic-add-row">
      <input class="input" id="new-topic-inp" placeholder="Add topic…" onkeydown="if(event.key==='Enter')addTopic()">
      <button class="btn btn-primary btn-sm" onclick="addTopic()">Add</button>
    </div>

    <div class="resources-section">
      <div class="section-label" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <span style="font-family:var(--font-mono);font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-tertiary)">Resources</span>
        <button class="btn btn-ghost btn-xs" onclick="openResourceArchiveModal()">
          Archived <span id="res-arch-badge" class="arch-badge" style="display:none;margin-left:4px"></span>
        </button>
      </div>
      <div id="res-list"></div>
      <div class="add-res-row">
        <input class="input" id="new-res-group-inp" placeholder="Group (e.g. UWorld)" style="max-width:130px">
        <input class="input" id="new-res-inp" placeholder="Resource name…" style="flex:1" onkeydown="if(event.key==='Enter')addResource()">
        <button class="btn btn-ghost btn-sm" onclick="addResource()">Add</button>
      </div>
    </div>
  `;
}

// ── Render All ────────────────────────────────────────────
function renderAll() {
  normalizeState();
  updateCountdown();
  renderPracticeExams();
  renderFocusPanel();
  renderChart();
  renderWeakSpots();
  renderTopics();
  renderResources();
  renderEpcOverview();
  renderEpcBars();
  renderCmsTable();
  renderNBME();
  renderCMS();
  renderMissedSessions();
  renderNotes();
  renderCalendar();
  initSpotify();
  setInterval(updateCountdown, 60000);
}

// ── Navigation ────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + tab);
  const btn   = document.getElementById('btn-' + tab);
  if (panel) panel.classList.add('active');
  if (btn)   btn.classList.add('active');
  // Refresh playlists when Focus tab is opened
  if (tab === 'focus' && spToken) {
    fetchSpotifyPlaylists();
  }
}

function globalKeyDown(e) {
  const isMeta = e.metaKey || e.ctrlKey;
  if (isMeta && !e.shiftKey && !e.altKey) {
    const tabs = ['dashboard','topics','assessments','missed','notes','suggestions'];
    const n = parseInt(e.key) - 1;
    if (n >= 0 && n < tabs.length) { e.preventDefault(); showTab(tabs[n]); return; }
    if (e.key === 'k') { e.preventDefault(); openCmdPalette(); return; }
  }
  if (e.key === 'Escape') { closeCmdPalette(); closeAllModals(); confirmResolve(false); }
}

// ── Countdown ─────────────────────────────────────────────
function daysUntil(dateStr) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tgt   = new Date(dateStr + 'T00:00:00');
  return Math.max(0, Math.ceil((tgt - today) / 86400000));
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
}

function updateCountdown() {
  const d = daysUntil(STEP2_DATE);
  const el = document.getElementById('step-days');
  if (el) el.textContent = d;
}

// ── Practice Exams ────────────────────────────────────────
function renderPracticeExams() {
  const container = document.getElementById('practice-exam-list');
  if (!container) return;
  container.innerHTML = '';

  const upcoming = [...(state.practiceExams || [])]
    .filter(e => !e.locked || e.name !== 'Step 2 CK')
    .sort((a,b) => (a.date||'').localeCompare(b.date||''));

  if (!upcoming.length) {
    container.innerHTML = '<div class="exam-empty">No practice exams added yet</div>';
    return;
  }

  upcoming.slice(0, 5).forEach(exam => {
    const days = exam.date ? daysUntil(exam.date) : null;
    const row  = document.createElement('div');
    row.className = 'exam-row';
    row.innerHTML = `
      <div class="exam-name" title="${escH(exam.name)}">${escH(exam.name)}</div>
      <div class="exam-date">${exam.date ? fmtDate(exam.date) + ' · ' + days + 'd' : ''}</div>
    `;
    container.appendChild(row);
  });
}

// ── Practice Exam Modal ───────────────────────────────────
function openPracticeExamModal() {
  let modal = document.getElementById('pe-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pe-modal';
    modal.className = 'modal-ov';
    modal.onclick = e => { if (e.target === modal) closePracticeExamModal(); };
    modal.innerHTML = `
      <div class="modal-box">
        <div class="modal-hdr">
          <div class="modal-title">Manage Practice Exams</div>
          <button class="modal-close" onclick="closePracticeExamModal()">×</button>
        </div>
        <div class="modal-body">
          <div id="pe-list"></div>
          <div class="pe-add">
            <input class="input" id="pe-name-inp" placeholder="Exam name (e.g. NBME Form 9)…">
            <input class="input" type="date" id="pe-date-inp" style="max-width:145px">
            <button class="btn btn-primary btn-sm" onclick="addPracticeExam()">Add</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  renderPracticeExamModal();
  modal.classList.add('open');
}

function closePracticeExamModal() {
  const m = document.getElementById('pe-modal');
  if (m) m.classList.remove('open');
}

function renderPracticeExamModal() {
  const list = document.getElementById('pe-list');
  if (!list) return;
  list.innerHTML = '';

  const exams = [...(state.practiceExams || [])].sort((a,b) => (a.date||'').localeCompare(b.date||''));

  if (!exams.length) {
    list.innerHTML = '<div class="exam-empty" style="padding:.5rem 0">No exams yet</div>';
    return;
  }

  exams.forEach((exam, i) => {
    const idx = state.practiceExams.indexOf(exam);
    const row = document.createElement('div');
    row.className = 'pe-row';
    row.innerHTML = `
      <span class="pe-drag">⠿</span>
      <div class="pe-name">${escH(exam.name)}${exam.locked ? ' <span class="tag tag-ghost" style="font-size:.5rem">fixed</span>' : ''}</div>
      <div class="pe-date">${exam.date ? fmtDate(exam.date) : ''}</div>
      ${!exam.locked ? `<button class="pe-del" onclick="removePracticeExam(${idx})">×</button>` : '<span style="width:20px"></span>'}
    `;
    makeDraggable(row, i, exams, (newOrder) => {
      state.practiceExams = newOrder;
      renderPracticeExamModal();
      renderPracticeExams();
      scheduleSave();
    });
    list.appendChild(row);
  });
}

function addPracticeExam() {
  const nameInp = document.getElementById('pe-name-inp');
  const dateInp = document.getElementById('pe-date-inp');
  const name = nameInp ? nameInp.value.trim() : '';
  const date = dateInp ? dateInp.value : '';
  if (!name) return;
  state.practiceExams.push({ id:uid(), name, date, locked:false });
  state.practiceExams.sort((a,b) => (a.date||'').localeCompare(b.date||''));
  if (nameInp) nameInp.value = '';
  if (dateInp) dateInp.value = '';
  renderPracticeExamModal();
  renderPracticeExams();
  scheduleSave();
}

async function removePracticeExam(i) {
  const ok = await confirm2('Remove "' + state.practiceExams[i].name + '"?');
  if (!ok) return;
  state.practiceExams.splice(i, 1);
  renderPracticeExamModal();
  renderPracticeExams();
  scheduleSave();
}

// ── Today's Focus ─────────────────────────────────────────
function renderFocusPanel() {
  const today = new Date().toISOString().slice(0,10);
  const lbl   = document.getElementById('focus-date-lbl');
  if (lbl) lbl.textContent = new Date().toLocaleDateString([],{month:'short',day:'numeric'});
  if (!state.todayFocus || state.todayFocus.date !== today)
    state.todayFocus = { date:today, items:[] };

  const container = document.getElementById('focus-items');
  if (!container) return;
  container.innerHTML = '';

  if (!state.todayFocus.items.length) {
    container.innerHTML = '<div class="focus-empty">No focus items yet</div>';
    return;
  }
  state.todayFocus.items.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'focus-item' + (item.done ? ' done' : '');
    div.onclick = () => toggleFocusItem(i);
    div.innerHTML = `
      <div class="f-check">${item.done ? '✓' : ''}</div>
      <div class="f-lbl">${escH(item.topic)}</div>
      <button style="background:transparent;border:none;color:var(--text-tertiary);font-size:.85rem;cursor:pointer;padding:0 3px"
        onclick="event.stopPropagation();removeFocusItem(${i})"
        onmouseover="this.style.color='var(--urgent)'" onmouseout="this.style.color='var(--text-tertiary)'">×</button>
    `;
    container.appendChild(div);
  });
}

function addFocusTopic() {
  const inp   = document.getElementById('focus-text-inp');
  const topic = inp ? inp.value.trim() : '';
  if (!topic) return;
  const today = new Date().toISOString().slice(0,10);
  if (!state.todayFocus || state.todayFocus.date !== today)
    state.todayFocus = { date:today, items:[] };
  state.todayFocus.items.push({ topic, done:false });
  inp.value = '';
  renderFocusPanel();
  scheduleSave();
}

function toggleFocusItem(i) {
  state.todayFocus.items[i].done = !state.todayFocus.items[i].done;
  renderFocusPanel(); scheduleSave();
}

function removeFocusItem(i) {
  state.todayFocus.items.splice(i, 1);
  renderFocusPanel(); scheduleSave();
}

// ── Score Chart ───────────────────────────────────────────
function setScoreView(view) {
  scoreView = view;
  document.getElementById('tog-shelf').classList.toggle('active', view === 'shelf');
  document.getElementById('tog-nbme').classList.toggle('active',  view === 'nbme');
  renderChart();
}

function getChartPoints() {
  if (scoreView === 'nbme') {
    return [...(state.nbmeScores || [])].map(s => ({ date:s.date, label:s.form, score:Number(s.score) }))
      .filter(p => p.date && !isNaN(p.score)).sort((a,b) => new Date(a.date)-new Date(b.date));
  }
  return [
    ...SHELF_SCORES,
    ...(state.cmsScores || []).map(s => ({ date:s.date, label:s.name, score:Number(s.score) }))
  ].filter(p => p.date && !isNaN(Number(p.score))).sort((a,b) => new Date(a.date)-new Date(b.date));
}

function runningAverage(points) {
  let sum = 0;
  return points.map((p,i) => { sum += Number(p.score)||0; return Math.round((sum/(i+1))*10)/10; });
}

function renderChart() {
  const ctx = document.getElementById('shelf-chart');
  if (!ctx) return;
  const pts    = getChartPoints();
  const labels = pts.map(p => p.label);
  const scores = pts.map(p => Number(p.score));
  const colors = scores.map(s => s >= GOAL_SCORE ? '#3A7A3A' : s >= 80 ? '#B07830' : '#B83A20');
  const avgArr = runningAverage(pts);

  setText('score-latest', scores.length ? scores[scores.length-1] : '–');
  setText('score-avg',    scores.length ? Math.round((scores.reduce((a,b)=>a+b,0)/scores.length)*10)/10 : '–');
  setText('score-best',   scores.length ? Math.max(...scores) : '–');

  if (shelfChart) { shelfChart.destroy(); shelfChart = null; }
  Chart.defaults.color = '#9A9089';
  Chart.defaults.font.family = "'JetBrains Mono', monospace";
  Chart.defaults.font.size = 11;

  shelfChart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[
      { label:'Score', data:scores, borderColor:'#B07830', backgroundColor:'transparent',
        pointBackgroundColor:colors, pointBorderColor:colors, pointRadius:5, pointHoverRadius:7,
        borderWidth:1.5, tension:0.2 },
      { label:'Average', data:avgArr, borderColor:'#1A4A82', backgroundColor:'transparent',
        pointBackgroundColor:'#1A4A82', pointBorderColor:'#1A4A82',
        pointRadius:3, pointHoverRadius:5, borderWidth:1.6, tension:0.25 }
    ]},
    options:{
      responsive:true,
      plugins:{
        legend:{ display:false },
        tooltip:{ backgroundColor:'#FFFFFF', borderColor:'#E0D8CC', borderWidth:1,
                  titleColor:'#1C1814', bodyColor:'#5C5249',
                  callbacks:{ label: c => ' '+c.dataset.label+': '+c.parsed.y }}
      },
      scales:{
        x:{ grid:{ color:'#EDE8E0' }, ticks:{ color:'#9A9089', maxRotation:30 }},
        y:{ grid:{ color:'#EDE8E0' }, ticks:{ color:'#9A9089' },
            min: scores.length ? Math.max(0,  Math.min(...scores,...avgArr)-10) : 0,
            max: scores.length ? Math.min(100, Math.max(...scores,...avgArr)+5) : 100 }
      }
    }
  });
}

// ── Weak Spots (dashboard) ────────────────────────────────
function setTopicFilter(filter) {
  activeTopicFilter = filter;
  ['all','open'].forEach(f => {
    const btn = document.getElementById('ws-filter-' + f);
    if (btn) btn.classList.toggle('active', f === filter);
  });
  renderWeakSpots();
}

function renderWeakSpots() {
  const container = document.getElementById('ws-list');
  const frac      = document.getElementById('ws-frac');
  const fill      = document.getElementById('ws-progress-fill');
  if (!container) return;
  container.innerHTML = '';

  const PRIO_ORDER = { high:0, medium:1, low:2, none:3 };
  const all  = [...(state.topics || [])].sort((a,b) =>
    (PRIO_ORDER[a.priority] ?? 3) - (PRIO_ORDER[b.priority] ?? 3)
  );
  const done = all.filter(t => t.done).length;
  const pct  = all.length ? Math.round((done/all.length)*100) : 0;
  if (frac) frac.textContent = done + ' / ' + all.length + ' · ' + pct + '%';
  if (fill) fill.style.width = pct + '%';

  const shown = all.filter(t => activeTopicFilter === 'open' ? !t.done : true);
  if (!shown.length) {
    container.innerHTML = '<div style="font-family:var(--font-mono);font-size:.72rem;color:var(--text-tertiary)">Nothing here</div>';
    return;
  }
  shown.forEach(topic => {
    const prio = topic.priority || 'none';
    const badge = prio === 'high'
      ? '<span style="font-family:var(--font-mono);font-size:.5rem;padding:0 4px;border-radius:3px;background:#FCEBEB;color:#A32D2D;flex-shrink:0">H</span>'
      : prio === 'medium'
      ? '<span style="font-family:var(--font-mono);font-size:.5rem;padding:0 4px;border-radius:3px;background:#FAEEDA;color:#633806;flex-shrink:0">M</span>'
      : prio === 'low'
      ? '<span style="font-family:var(--font-mono);font-size:.5rem;padding:0 4px;border-radius:3px;background:var(--bg-elevated);color:var(--text-tertiary);flex-shrink:0">L</span>'
      : '';
    const row = document.createElement('div');
    row.className = 'ws-row' + (topic.done ? ' done' : '');
    row.onclick = () => toggleTopicDone(topic.id);
    row.innerHTML = `
      <div class="ws-check">${topic.done ? '✓' : ''}</div>
      ${badge}
      <div class="ws-name" title="${escH(topic.name)}">${escH(topic.name)}</div>
      <button class="ws-del" onclick="event.stopPropagation();archiveTopicById('${topic.id}')"
        onmouseover="this.style.color='var(--urgent)'" onmouseout="this.style.color=''">↓</button>
    `;
    container.appendChild(row);
  });
}

function addWeakSpot() {
  const inp = document.getElementById('ws-inp');
  const val = inp ? inp.value.trim() : '';
  if (!val) return;
  if (state.topics.some(t => t.name.toLowerCase() === val.toLowerCase())) { inp.value=''; return; }
  state.topics.push({ id:uid(), name:val, done:false });
  inp.value = '';
  renderWeakSpots();
  renderTopics();
  updateRing();
  scheduleSave();
}

// ── Topics (full tab) ─────────────────────────────────────
let topicFullFilter = 'all';

function setTopicFilterFull(f) {
  topicFullFilter = f;
  ['all','open','done'].forEach(x => {
    const btn = document.getElementById('topic-filter-' + x);
    if (btn) btn.classList.toggle('active', x === f);
  });
  renderTopics();
}

function renderTopics() {
  const container = document.getElementById('topics-list');
  if (!container) return;
  container.innerHTML = '';

  const q = (document.getElementById('topic-search-inp') || {}).value?.trim().toLowerCase() || '';

  const PRIO_ORDER = { high:0, medium:1, low:2, none:3 };
  const all = [...(state.topics || [])].sort((a,b) =>
    (PRIO_ORDER[a.priority] ?? 3) - (PRIO_ORDER[b.priority] ?? 3)
  );

  const shown = all.filter(t => {
    if (topicFullFilter === 'open' && t.done) return false;
    if (topicFullFilter === 'done' && !t.done) return false;
    if (q && !t.name.toLowerCase().includes(q)) return false;
    return true;
  });

  if (!shown.length) {
    container.innerHTML = '<div style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-tertiary);padding:.5rem 0">No topics match</div>';
    updateRing();
    return;
  }

  shown.forEach((topic) => {
    const realIdx = state.topics.indexOf(topic);
    const prio = topic.priority || 'none';
    const prioBadge = prio === 'high'
      ? '<span style="font-family:var(--font-mono);font-size:.55rem;padding:1px 6px;border-radius:10px;background:#FCEBEB;color:#A32D2D;border:1px solid #F09595;flex-shrink:0">HIGH</span>'
      : prio === 'medium'
      ? '<span style="font-family:var(--font-mono);font-size:.55rem;padding:1px 6px;border-radius:10px;background:#FAEEDA;color:#633806;border:1px solid #EF9F27;flex-shrink:0">MED</span>'
      : prio === 'low'
      ? '<span style="font-family:var(--font-mono);font-size:.55rem;padding:1px 6px;border-radius:10px;background:var(--bg-elevated);color:var(--text-tertiary);border:1px solid var(--border);flex-shrink:0">LOW</span>'
      : '';
    const prioTitle = prio === 'none' ? 'Set priority' : prio === 'high' ? 'High → Medium' : prio === 'medium' ? 'Medium → Low' : 'Low → None';
    const prioColor = prio === 'high' ? '#A32D2D' : prio === 'medium' ? '#633806' : prio === 'low' ? 'var(--text-tertiary)' : 'var(--text-tertiary)';

    const row = document.createElement('div');
    row.className = 'topic-row-full' + (topic.done ? ' done' : '');
    row.dataset.id = topic.id;
    row.draggable = true;
    row.innerHTML = `
      <span class="topic-drag-handle" title="Drag to reorder">⠿</span>
      <div class="t-check" onclick="event.stopPropagation();toggleTopicDone('${topic.id}')" style="cursor:pointer;width:18px;height:18px;border-radius:4px;border:1px solid var(--border-bright);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">${topic.done?'✓':''}</div>
      <div class="topic-name-full" onclick="event.stopPropagation();toggleTopicDone('${topic.id}')" style="cursor:pointer">${escH(topic.name)}</div>
      ${prioBadge}
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        <button class="topic-arch-btn" title="${prioTitle}" onclick="event.stopPropagation();cycleTopicPriority('${topic.id}')" style="color:${prioColor};font-size:.7rem;min-width:22px">●</button>
        <button class="topic-arch-btn" onclick="event.stopPropagation();archiveTopicById('${topic.id}')">Archive</button>
      </div>
    `;

    row.addEventListener('dragstart', e => {
      dragSrcIdx  = realIdx;
      dragSrcList = 'topics';
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (dragSrcList !== 'topics' || dragSrcIdx === null) return;
      const destIdx = state.topics.indexOf(topic);
      if (dragSrcIdx === destIdx) return;
      const [moved] = state.topics.splice(dragSrcIdx, 1);
      state.topics.splice(destIdx, 0, moved);
      dragSrcIdx = null;
      renderTopics();
      renderWeakSpots();
      scheduleSave();
    });
    row.addEventListener('dragend', () => {
      document.querySelectorAll('.topic-row-full').forEach(r => r.classList.remove('drag-over'));
    });

    container.appendChild(row);
  });

  const badge = document.getElementById('topic-arch-badge');
  if (badge) {
    const c = (state.archivedTopics||[]).length;
    badge.textContent = c; badge.style.display = c ? 'inline-flex' : 'none';
  }
  updateRing();
}

function toggleTopicDone(id) {
  const t = state.topics.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  renderTopics(); renderWeakSpots(); updateRing(); scheduleSave();
}

function cycleTopicPriority(id) {
  const t = state.topics.find(x => x.id === id);
  if (!t) return;
  const cycle = { none:'high', high:'medium', medium:'low', low:'none' };
  t.priority = cycle[t.priority || 'none'];
  const PRIO_ORDER = { high:0, medium:1, low:2, none:3 };
  state.topics.sort((a,b) => (PRIO_ORDER[a.priority] ?? 3) - (PRIO_ORDER[b.priority] ?? 3));
  renderTopics(); renderWeakSpots(); scheduleSave();
}

function addTopic() {
  const inp = document.getElementById('new-topic-inp');
  const val = inp ? inp.value.trim() : '';
  if (!val) return;
  if (state.topics.some(t => t.name.toLowerCase() === val.toLowerCase())) { inp.value=''; return; }
  state.topics.push({ id:uid(), name:val, done:false });
  inp.value = '';
  renderTopics(); renderWeakSpots(); updateRing(); scheduleSave();
}

async function archiveTopicById(id) {
  const idx = state.topics.findIndex(t => t.id === id);
  if (idx === -1) return;
  const topic = state.topics.splice(idx, 1)[0];
  state.archivedTopics.push({ ...topic, archivedAt: Date.now() });
  renderTopics(); renderWeakSpots(); updateRing(); scheduleSave();
}

function openTopicArchiveModal() {
  const modal = document.getElementById('arch-modal');
  const list  = document.getElementById('arch-list');
  const empty = document.getElementById('arch-empty');
  const title = document.getElementById('arch-modal-title');
  if (!modal) return;
  if (title) title.textContent = 'Archived Topics';
  list.innerHTML = '';
  const arcs = state.archivedTopics || [];
  empty.style.display = arcs.length ? 'none' : 'block';
  arcs.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'arch-note-item';
    div.innerHTML = `
      <div class="arch-note-title">${escH(item.name)}</div>
      <div style="font-size:.78rem;color:var(--text-tertiary);font-family:var(--font-mono);margin-bottom:.3rem">${new Date(item.archivedAt||0).toLocaleDateString()}</div>
      <div class="arch-note-acts">
        <button class="btn btn-ghost btn-xs" onclick="restoreArchivedTopic(${i})">Restore</button>
        <button class="btn btn-danger btn-xs" onclick="deleteArchivedTopic(${i})">Delete</button>
      </div>
    `;
    list.appendChild(div);
  });
  modal.classList.add('open');
}

function restoreArchivedTopic(i) {
  const item = state.archivedTopics.splice(i, 1)[0];
  delete item.archivedAt;
  state.topics.push(item);
  closeArchiveModal(); renderTopics(); renderWeakSpots(); updateRing(); scheduleSave();
}

async function deleteArchivedTopic(i) {
  const ok = await confirm2('Permanently delete "' + state.archivedTopics[i].name + '"? This cannot be undone.');
  if (!ok) return;
  state.archivedTopics.splice(i, 1);
  closeArchiveModal(); openTopicArchiveModal(); scheduleSave();
}

function updateRing() {
  const all  = state.topics || [];
  const done = all.filter(t => t.done).length;
  const pct  = all.length ? done/all.length : 0;
  const circ = 144.5;
  const arc  = document.getElementById('ring-arc');
  const frac = document.getElementById('ring-frac');
  const rpct = document.getElementById('ring-pct');
  if (arc)  arc.setAttribute('stroke-dashoffset', (circ - pct*circ).toFixed(1));
  if (frac) frac.textContent = done + ' / ' + all.length;
  if (rpct) rpct.textContent = Math.round(pct*100) + '% done';
}

// ── Resources ─────────────────────────────────────────────
function renderResources() {
  const container = document.getElementById('res-list');
  if (!container) return;
  container.innerHTML = '';

  (state.resources || []).forEach((res, i) => {
    const div = document.createElement('div');
    div.className = 'resource-item-full' + (res.done ? ' res-done' : '');
    div.draggable = true;
    div.dataset.idx = i;
    div.innerHTML = `
      <span class="res-drag" title="Drag to reorder">⠿</span>
      <div class="res-check" onclick="toggleResource(${i})">${res.done?'✓':''}</div>
      ${res.group ? `<span class="res-group-tag">${escH(res.group)}</span>` : ''}
      <div class="res-name">${escH(res.name||res)}</div>
      <button class="res-arch-btn" onclick="archiveResource(${i})">Archive</button>
    `;

    div.addEventListener('dragstart', e => {
      dragSrcIdx  = i;
      dragSrcList = 'resources';
      e.dataTransfer.effectAllowed = 'move';
    });
    div.addEventListener('dragover', e => { e.preventDefault(); div.classList.add('drag-over'); });
    div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
    div.addEventListener('drop', e => {
      e.preventDefault();
      div.classList.remove('drag-over');
      if (dragSrcList !== 'resources' || dragSrcIdx === null || dragSrcIdx === i) return;
      const [moved] = state.resources.splice(dragSrcIdx, 1);
      state.resources.splice(i, 0, moved);
      dragSrcIdx = null;
      renderResources(); scheduleSave();
    });
    div.addEventListener('dragend', () =>
      document.querySelectorAll('.resource-item-full').forEach(r => r.classList.remove('drag-over')));

    container.appendChild(div);
  });

  const badge = document.getElementById('res-arch-badge');
  if (badge) {
    const c = (state.archivedResources||[]).length;
    badge.textContent = c; badge.style.display = c ? 'inline-flex' : 'none';
  }
}

function toggleResource(i) {
  if (!state.resources[i]) return;
  state.resources[i].done = !state.resources[i].done;
  renderResources(); scheduleSave();
}

function addResource() {
  const nameInp  = document.getElementById('new-res-inp');
  const groupInp = document.getElementById('new-res-group-inp');
  const name  = nameInp  ? nameInp.value.trim()  : '';
  const group = groupInp ? groupInp.value.trim()  : '';
  if (!name) return;
  state.resources.push({ id:uid(), name, group, done:false });
  if (nameInp)  nameInp.value  = '';
  if (groupInp) groupInp.value = '';
  renderResources(); scheduleSave();
}

async function archiveResource(i) {
  const res = state.resources[i];
  if (!res) return;
  state.archivedResources.push({ ...res, archivedAt:Date.now() });
  state.resources.splice(i, 1);
  renderResources(); scheduleSave();
}

function openResourceArchiveModal() {
  const modal = document.getElementById('arch-modal');
  const list  = document.getElementById('arch-list');
  const empty = document.getElementById('arch-empty');
  const title = document.getElementById('arch-modal-title');
  if (!modal) return;
  if (title) title.textContent = 'Archived Resources';
  list.innerHTML = '';
  const arcs = state.archivedResources || [];
  empty.style.display = arcs.length ? 'none' : 'block';
  arcs.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'arch-note-item';
    div.innerHTML = `
      <div class="arch-note-title">${item.group ? `[${escH(item.group)}] ` : ''}${escH(item.name)}</div>
      <div style="font-size:.78rem;color:var(--text-tertiary);font-family:var(--font-mono);margin-bottom:.3rem">${new Date(item.archivedAt||0).toLocaleDateString()}</div>
      <div class="arch-note-acts">
        <button class="btn btn-ghost btn-xs" onclick="restoreArchivedResource(${i})">Restore</button>
        <button class="btn btn-danger btn-xs" onclick="deleteArchivedResource(${i})">Delete</button>
      </div>
    `;
    list.appendChild(div);
  });
  modal.classList.add('open');
}

function restoreArchivedResource(i) {
  const item = state.archivedResources.splice(i, 1)[0];
  delete item.archivedAt;
  state.resources.push(item);
  closeArchiveModal(); renderResources(); scheduleSave();
}

async function deleteArchivedResource(i) {
  const ok = await confirm2('Permanently delete "' + state.archivedResources[i].name + '"? This cannot be undone.');
  if (!ok) return;
  state.archivedResources.splice(i, 1);
  closeArchiveModal(); openResourceArchiveModal(); scheduleSave();
}

// ── Drag helper ───────────────────────────────────────────
function makeDraggable(el, idx, arr, onDrop) {
  el.draggable = true;
  el.addEventListener('dragstart', e => {
    dragSrcIdx = idx; dragSrcList = 'modal';
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragover', e => { e.preventDefault(); el.style.opacity = '.5'; });
  el.addEventListener('dragleave', () => { el.style.opacity = ''; });
  el.addEventListener('drop', e => {
    e.preventDefault(); el.style.opacity = '';
    if (dragSrcList !== 'modal' || dragSrcIdx === null || dragSrcIdx === idx) return;
    const [moved] = arr.splice(dragSrcIdx, 1);
    arr.splice(idx, 0, moved);
    dragSrcIdx = null;
    onDrop(arr);
  });
  el.addEventListener('dragend', () => { el.style.opacity = ''; });
}

// ── EPC Breakdown ─────────────────────────────────────────
function setEpcSort(dir) {
  epcSortDir = dir;
  document.getElementById('epc-sort-asc').classList.toggle('active', dir === 'asc');
  document.getElementById('epc-sort-desc').classList.toggle('active', dir === 'desc');
  renderEpcBars();
}

function setEpcRotation(rot) {
  epcRotation = rot;
  document.querySelectorAll('.epc-rot-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.rot === rot);
  });
  renderEpcBars();
}

function renderEpcOverview() {
  const grid = document.getElementById('epc-overview-grid');
  const btns = document.getElementById('epc-rotation-btns');
  if (!grid || !btns) return;

  grid.innerHTML = '';
  btns.innerHTML = '';

  Object.entries(EPC_DATA).forEach(([name, data]) => {
    const diff = data.epc - data.avg;
    const diffStr = (diff >= 0 ? '+' : '') + diff;
    const diffColor = diff >= 0 ? '#3B6D11' : '#A32D2D';

    const tile = document.createElement('div');
    tile.style.cssText = 'background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--r-sm);padding:.55rem .7rem;cursor:pointer';
    tile.innerHTML = `
      <div style="font-family:var(--font-mono);font-size:.6rem;color:var(--text-tertiary);margin-bottom:3px">${escH(name)}</div>
      <div style="font-family:var(--font-display);font-size:1.3rem;font-weight:800;color:var(--accent);line-height:1">${data.epc}</div>
      <div style="font-family:var(--font-mono);font-size:.6rem;color:${diffColor};margin-top:2px">${diffStr} vs avg</div>
    `;
    tile.onclick = () => setEpcRotation(name);
    grid.appendChild(tile);

    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm epc-rot-btn' + (name === epcRotation ? ' active' : '');
    btn.dataset.rot = name;
    btn.textContent = name;
    btn.onclick = () => setEpcRotation(name);
    btns.appendChild(btn);
  });
}

function renderEpcBars() {
  const container = document.getElementById('epc-bars');
  if (!container) return;
  container.innerHTML = '';

  const data = EPC_DATA[epcRotation];
  if (!data) return;

  let subs = [...data.subscores];
  if (epcSortDir === 'asc') {
    subs.sort((a,b) => a.you - b.you);
  } else {
    subs.sort((a,b) => b.you - a.you);
  }

  subs.forEach(sub => {
    const diff = sub.you - sub.avg;
    const barColor   = diff >= 0 ? '#639922' : '#E24B4A';
    const diffColor  = diff >= 0 ? '#3B6D11' : '#A32D2D';
    const diffBg     = diff >= 0 ? '#EAF3DE' : '#FCEBEB';
    const diffStr    = (diff >= 0 ? '+' : '') + diff;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:7px';
    row.innerHTML = `
      <div style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-secondary);width:195px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escH(sub.label)}">${escH(sub.label)}</div>
      <div style="flex:1;height:11px;background:var(--bg-subtle);border-radius:3px;overflow:hidden;position:relative;min-width:0">
        <div style="height:100%;width:${sub.avg}%;background:#B5D4F4;border-radius:3px;position:absolute;top:0;left:0"></div>
        <div style="height:100%;width:${sub.you}%;background:${barColor};border-radius:3px;position:absolute;top:0;left:0"></div>
      </div>
      <div style="font-family:var(--font-mono);font-size:.7rem;font-weight:600;color:${barColor};width:32px;text-align:right;flex-shrink:0">${sub.you}%</div>
      <div style="font-family:var(--font-mono);font-size:.6rem;width:36px;text-align:center;padding:1px 4px;border-radius:3px;background:${diffBg};color:${diffColor};flex-shrink:0">${diffStr}</div>
    `;
    container.appendChild(row);
  });
}

// ── CMS Performance Table ─────────────────────────────────
function setCmsFilter(f) {
  cmsFilter = f;
  document.getElementById('cms-filter-5plus').classList.toggle('active', f === '5plus');
  document.getElementById('cms-filter-all').classList.toggle('active', f === 'all');
  renderCmsTable();
}

function renderCmsTable() {
  const container = document.getElementById('cms-table');
  if (!container) return;
  container.innerHTML = '';

  let rows = CMS_RAW.map(r => ({
    ...r,
    pct: Math.round(((r.total - r.incorrect) / r.total) * 100)
  }));

  if (cmsFilter === '5plus') {
    rows = rows.filter(r => r.incorrect >= 5);
  }

  rows.sort((a,b) => a.pct - b.pct);

  if (!rows.length) {
    container.innerHTML = '<div style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-tertiary);padding:.5rem 0">No topics match filter</div>';
    return;
  }

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:.82rem';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="text-align:left;font-family:var(--font-mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-tertiary);padding:0 8px 8px 0;border-bottom:1px solid var(--border);width:42%">Topic</th>
        <th style="text-align:right;font-family:var(--font-mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-tertiary);padding:0 8px 8px;border-bottom:1px solid var(--border);width:8%">Qs</th>
        <th style="text-align:right;font-family:var(--font-mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-tertiary);padding:0 8px 8px;border-bottom:1px solid var(--border);width:10%">Wrong</th>
        <th style="text-align:right;font-family:var(--font-mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-tertiary);padding:0 8px 8px 0;border-bottom:1px solid var(--border);width:12%">% Correct</th>
        <th style="padding:0 0 8px;border-bottom:1px solid var(--border);width:28%"></th>
      </tr>
    </thead>
    <tbody id="cms-tbody"></tbody>
  `;
  container.appendChild(table);

  const tbody = document.getElementById('cms-tbody');
  rows.forEach(r => {
    const badgeColor = r.pct < 65 ? '#A32D2D' : r.pct < 80 ? '#633806' : '#27500A';
    const badgeBg    = r.pct < 65 ? '#FCEBEB' : r.pct < 80 ? '#FAEEDA' : '#EAF3DE';
    const barColor   = r.pct < 65 ? '#E24B4A' : r.pct < 80 ? '#EF9F27' : '#639922';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:.6rem 8px .6rem 0;border-bottom:1px solid var(--border);font-family:var(--font-mono);font-size:.72rem;color:var(--text-primary)">${escH(r.topic)}</td>
      <td style="padding:.6rem 8px;border-bottom:1px solid var(--border);font-family:var(--font-mono);font-size:.72rem;color:var(--text-tertiary);text-align:right">${r.total}</td>
      <td style="padding:.6rem 8px;border-bottom:1px solid var(--border);font-family:var(--font-mono);font-size:.72rem;color:var(--text-tertiary);text-align:right">${r.incorrect}</td>
      <td style="padding:.6rem 8px .6rem 0;border-bottom:1px solid var(--border);text-align:right">
        <span style="font-family:var(--font-mono);font-size:.65rem;padding:1px 6px;border-radius:10px;background:${badgeBg};color:${badgeColor}">${r.pct}%</span>
      </td>
      <td style="padding:.6rem 0;border-bottom:1px solid var(--border)">
        <div style="height:6px;border-radius:3px;background:${barColor};width:${r.pct}%;max-width:100%"></div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Assessments ───────────────────────────────────────────
function renderNBME() {
  const container = document.getElementById('nbme-list');
  if (!container) return;
  container.innerHTML = '';
  (state.nbmeScores || []).forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'assess-entry';
    const sc = Number(s.score);
    const cls = sc >= 260 ? 'tag-green' : sc >= 240 ? 'tag-amber' : 'tag-red';
    div.innerHTML = `
      <div class="ae-name">${escH(s.form)}</div>
      <span class="tag ${cls}">${s.score}</span>
      <div class="ae-date">${s.date ? fmtDate(s.date) : ''}</div>
      <button class="ae-del" onclick="removeNBME(${i})">×</button>
    `;
    container.appendChild(div);
  });
}

function addNBMEScore() {
  const form  = document.getElementById('nbme-form-inp').value.trim();
  const score = document.getElementById('nbme-score-inp').value.trim();
  const date  = document.getElementById('nbme-date-inp').value;
  if (!form || !score) return;
  state.nbmeScores.push({ form, score, date });
  state.nbmeScores.sort((a,b) => (a.date||'') < (b.date||'') ? -1 : 1);
  document.getElementById('nbme-form-inp').value  = '';
  document.getElementById('nbme-score-inp').value = '';
  document.getElementById('nbme-date-inp').value  = '';
  renderNBME(); renderChart(); scheduleSave();
}

async function removeNBME(i) {
  const ok = await confirm2('Remove this NBME score?');
  if (!ok) return;
  state.nbmeScores.splice(i, 1); renderNBME(); renderChart(); scheduleSave();
}

function renderCMS() {
  const container = document.getElementById('cms-list');
  if (!container) return;
  container.innerHTML = '';
  (state.cmsScores || []).forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'assess-entry';
    div.innerHTML = `
      <div class="ae-name">${escH(s.name)}</div>
      <div class="ae-score">${s.score}</div>
      <div class="ae-date">${s.date ? fmtDate(s.date) : ''}</div>
      <button class="ae-del" onclick="removeCMS(${i})">×</button>
    `;
    container.appendChild(div);
  });
}

function addCMSScore() {
  const name  = document.getElementById('cms-name-inp').value.trim();
  const score = document.getElementById('cms-score-inp').value.trim();
  const date  = document.getElementById('cms-date-inp').value;
  if (!name || !score) return;
  state.cmsScores.push({ name, score, date });
  document.getElementById('cms-name-inp').value  = '';
  document.getElementById('cms-score-inp').value = '';
  document.getElementById('cms-date-inp').value  = '';
  renderCMS(); renderChart(); scheduleSave();
}

async function removeCMS(i) {
  const ok = await confirm2('Remove this score?');
  if (!ok) return;
  state.cmsScores.splice(i, 1); renderCMS(); renderChart(); scheduleSave();
}

// ── Missed Questions ──────────────────────────────────────
function renderMissedSessions() {
  const container = document.getElementById('sessions-container');
  if (!container) return;
  container.innerHTML = '';
  let total = 0;
  (state.missedSessions || []).forEach((sess, si) => {
    total += (sess.entries || []).length;
    const block = document.createElement('div');
    block.className = 'session-block'; block.id = 'sess-' + si;
    const isOpen = !!sess.open;
    block.innerHTML = `
      <div class="session-hdr ${isOpen?'open':''}" onclick="toggleSession(${si})">
        <div class="sess-title">${escH(sess.title || 'Session '+(si+1))}</div>
        <div class="sess-right">
          <span class="tag tag-ghost">${(sess.entries||[]).length} missed</span>
          <span class="sess-toggle">▾</span>
        </div>
      </div>
      <div class="session-body ${isOpen?'open':''}" id="sess-body-${si}">
        ${renderEntriesHTML(si, sess.entries || [])}
        <div class="mq-add-btn-row" style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="showEntryForm(${si})">+ Add question</button>
          <button class="btn btn-danger btn-sm" onclick="removeSession(${si})">Remove session</button>
        </div>
        <div id="entry-form-${si}" style="display:none"></div>
      </div>
    `;
    container.appendChild(block);
  });
  const lbl = document.getElementById('missed-total-lbl');
  if (lbl) lbl.textContent = total + ' total missed';
}

function renderEntriesHTML(si, entries) {
  if (!entries.length) return '<div style="padding:.6rem 1.1rem;font-family:var(--font-mono);font-size:.72rem;color:var(--text-tertiary)">No entries yet</div>';
  return entries.map((e, ei) => `
    <div class="mq-entry">
      <div class="mq-topic-row">
        <span class="mq-topic">${escH(e.topic||'')}</span>
        ${e.source ? `<span class="tag tag-ghost" style="font-size:.58rem">${escH(e.source)}</span>` : ''}
        <button onclick="removeMissedEntry(${si},${ei})" style="margin-left:auto;background:transparent;border:none;color:var(--text-tertiary);font-size:.8rem;cursor:pointer" onmouseover="this.style.color='var(--urgent)'" onmouseout="this.style.color='var(--text-tertiary)'">×</button>
      </div>
      <div class="mq-field">Why missed</div>
      <div class="mq-val">${e.why ? escH(e.why) : '<em style="color:var(--text-tertiary)">Not filled in</em>'}</div>
      <div class="mq-correct-box">
        <div class="mq-field">Correct thinking</div>
        <div class="mq-val">${e.correct ? escH(e.correct) : '<em style="color:var(--text-tertiary)">Not filled in</em>'}</div>
      </div>
    </div>
  `).join('');
}

function showEntryForm(si) {
  const c = document.getElementById('entry-form-' + si);
  if (!c) return;
  c.style.display = 'block';
  c.innerHTML = `
    <div class="inline-entry-form">
      <div class="ief-row">
        <div class="ief-stack" style="flex:1"><div class="ief-label">Topic</div><input class="input" id="ef-topic-${si}" placeholder="e.g. Thyroid storm"></div>
        <div class="ief-stack" style="flex:1"><div class="ief-label">Source</div><input class="input" id="ef-source-${si}" placeholder="e.g. NBME 14, UWorld"></div>
      </div>
      <div class="ief-stack"><div class="ief-label">Why did you miss it?</div><textarea class="input ief-ta" id="ef-why-${si}" placeholder="Thought it was X…"></textarea></div>
      <div class="ief-stack"><div class="ief-label">Correct thinking</div><textarea class="input ief-ta" id="ef-correct-${si}" placeholder="The key is…"></textarea></div>
      <div class="ief-acts">
        <button class="btn btn-ghost btn-sm" onclick="hideEntryForm(${si})">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="submitEntryForm(${si})">Save</button>
      </div>
    </div>
  `;
  document.getElementById('ef-topic-' + si).focus();
}

function hideEntryForm(si) {
  const c = document.getElementById('entry-form-' + si);
  if (c) { c.style.display='none'; c.innerHTML=''; }
}

function submitEntryForm(si) {
  const topic   = (document.getElementById('ef-topic-'  +si)||{}).value||'';
  const source  = (document.getElementById('ef-source-' +si)||{}).value||'';
  const why     = (document.getElementById('ef-why-'    +si)||{}).value||'';
  const correct = (document.getElementById('ef-correct-'+si)||{}).value||'';
  if (!topic.trim()) return;
  if (!state.missedSessions[si].entries) state.missedSessions[si].entries = [];
  state.missedSessions[si].entries.push({ topic:topic.trim(), source:source.trim(), why:why.trim(), correct:correct.trim() });
  hideEntryForm(si); renderMissedSessions(); scheduleSave();
}

function toggleSession(i) { state.missedSessions[i].open = !state.missedSessions[i].open; renderMissedSessions(); }

function addMissedSession() {
  const title = prompt('Session title (e.g. NBME 16, UWorld Block 3):');
  if (title === null) return;
  state.missedSessions.push({ title: title||'Session', entries:[], open:true });
  renderMissedSessions(); scheduleSave();
}

async function removeSession(i) {
  const ok = await confirm2('Remove session "' + state.missedSessions[i].title + '" and all entries?');
  if (!ok) return;
  state.missedSessions.splice(i, 1); renderMissedSessions(); scheduleSave();
}

async function removeMissedEntry(si, ei) {
  const ok = await confirm2('Remove this entry?');
  if (!ok) return;
  state.missedSessions[si].entries.splice(ei, 1); renderMissedSessions(); scheduleSave();
}

// ── Notes ─────────────────────────────────────────────────
function renderNotes() {
  const container = document.getElementById('notes-container');
  if (!container) return;
  container.innerHTML = '';
  const badge = document.getElementById('arch-badge');
  const c = (state.archivedNotes||[]).length;
  if (badge) { badge.textContent = c; badge.style.display = c ? 'inline-flex' : 'none'; }
  if (!(state.notes||[]).length) {
    container.innerHTML = '<div style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-tertiary);padding:1rem 0">No notes yet. Click + New Note to start.</div>';
    return;
  }
  state.notes.forEach((note, i) => container.appendChild(buildNoteCard(note, i)));
}

function buildNoteCard(note, i) {
  const card = document.createElement('div');
  card.className = 'note-card'; card.id = 'note-' + i;
  card.innerHTML = `
    <div class="note-hdr">
      <div class="note-dot saved" id="ndot-${i}"></div>
      <input class="note-title-inp" placeholder="Note title…" value="${escH(note.title||'')}" oninput="noteFieldChange(${i},'title',this.value)">
      <div class="note-acts">
        <button class="btn btn-ghost btn-xs" onclick="archiveNote(${i})">Archive</button>
        <button class="btn btn-danger btn-xs" onclick="deleteNote(${i})">Delete</button>
      </div>
    </div>
    <div class="note-tb">
      <button class="fmt-btn" onclick="fmtNote(${i},'bold')"><b>B</b></button>
      <button class="fmt-btn" onclick="fmtNote(${i},'italic')"><i>I</i></button>
      <button class="fmt-btn" onclick="fmtNote(${i},'underline')"><u>U</u></button>
      <button class="fmt-btn" onclick="fmtNote(${i},'strikeThrough')"><s>S</s></button>
      <div class="tb-sep"></div>
      <button class="fmt-btn" onclick="fmtNote(${i},'insertUnorderedList')">• List</button>
      <button class="fmt-btn" onclick="fmtNote(${i},'insertOrderedList')"># List</button>
      <div class="tb-sep"></div>
      <div class="clr-dot" style="background:#3D2B1A" onclick="fmtNoteColor(${i},'#3D2B1A')" title="Dark"></div>
      <div class="clr-dot" style="background:#B07830" onclick="fmtNoteColor(${i},'#B07830')" title="Amber"></div>
      <div class="clr-dot" style="background:#1A4A82" onclick="fmtNoteColor(${i},'#1A4A82')" title="Blue"></div>
      <div class="clr-dot" style="background:#2E7D32" onclick="fmtNoteColor(${i},'#2E7D32')" title="Green"></div>
      <div class="clr-dot" style="background:#B83A20" onclick="fmtNoteColor(${i},'#B83A20')" title="Red"></div>
    </div>
    <div class="note-editor" id="editor-${i}" contenteditable="true" placeholder="Start writing…"
      onkeydown="noteKeyDown(event,${i})"
      oninput="noteFieldChange(${i},'body',document.getElementById('editor-${i}').innerHTML)">${note.body||''}</div>
  `;
  return card;
}

function addNote() {
  state.notes.unshift({ title:'', body:'', created:Date.now() });
  renderNotes();
  const inp = document.querySelector('.note-title-inp');
  if (inp) inp.focus();
  scheduleSave();
}

function noteFieldChange(i, field, val) {
  if (!state.notes[i]) return;
  state.notes[i][field] = val;
  const dot = document.getElementById('ndot-'+i);
  if (dot) dot.className = 'note-dot saving';
  scheduleSave();
  setTimeout(() => { const d = document.getElementById('ndot-'+i); if(d) d.className='note-dot saved'; }, 1600);
}

function noteKeyDown(e, i) {
  const isMeta = e.metaKey||e.ctrlKey;
  if (!isMeta) return;
  const cmds = { b:'bold', i:'italic', u:'underline' };
  if (cmds[e.key]) { e.preventDefault(); fmtNote(i, cmds[e.key]); }
}

function fmtNote(i, cmd) {
  const ed = document.getElementById('editor-'+i);
  if (!ed) return;
  ed.focus(); document.execCommand(cmd, false, null);
  noteFieldChange(i, 'body', ed.innerHTML);
}

function fmtNoteColor(i, color) {
  const ed = document.getElementById('editor-'+i);
  if (!ed) return;
  ed.focus(); document.execCommand('foreColor', false, color);
  noteFieldChange(i, 'body', ed.innerHTML);
}

async function deleteNote(i) {
  const ok = await confirm2('Delete this note permanently?');
  if (!ok) return;
  state.notes.splice(i, 1); renderNotes(); scheduleSave();
}

function archiveNote(i) {
  state.archivedNotes.push({ ...state.notes[i], archivedAt:Date.now() });
  state.notes.splice(i, 1); renderNotes(); scheduleSave();
}

function openArchiveModal() {
  const modal = document.getElementById('arch-modal');
  const list  = document.getElementById('arch-list');
  const empty = document.getElementById('arch-empty');
  const title = document.getElementById('arch-modal-title');
  if (!modal) return;
  if (title) title.textContent = 'Archived Notes';
  list.innerHTML = '';
  const arcs = state.archivedNotes || [];
  empty.style.display = arcs.length ? 'none' : 'block';
  arcs.forEach((note, i) => {
    const item = document.createElement('div');
    item.className = 'arch-note-item';
    item.innerHTML = `
      <div class="arch-note-title">${escH(note.title||'Untitled')}</div>
      <div style="font-size:.78rem;color:var(--text-tertiary);font-family:var(--font-mono);margin-bottom:.3rem">${new Date(note.archivedAt||0).toLocaleDateString()}</div>
      <div class="arch-note-acts">
        <button class="btn btn-ghost btn-xs" onclick="restoreNote(${i})">Restore</button>
        <button class="btn btn-danger btn-xs" onclick="deleteArchivedNote(${i})">Delete</button>
      </div>
    `;
    list.appendChild(item);
  });
  modal.classList.add('open');
}

function closeArchiveModal() {
  const m = document.getElementById('arch-modal');
  if (m) m.classList.remove('open');
}

function closeAllModals() {
  closeArchiveModal();
  closePracticeExamModal();
  closeAdvisorModal();
}

function restoreNote(i) {
  const note = state.archivedNotes.splice(i, 1)[0];
  delete note.archivedAt;
  state.notes.unshift(note);
  closeArchiveModal(); renderNotes(); scheduleSave();
}

async function deleteArchivedNote(i) {
  const ok = await confirm2('Permanently delete "' + (state.archivedNotes[i].title||'Untitled') + '"? This cannot be undone.');
  if (!ok) return;
  state.archivedNotes.splice(i, 1);
  closeArchiveModal(); openArchiveModal(); renderNotes(); scheduleSave();
}

// ── Suggestions ───────────────────────────────────────────
// ── Command Palette ───────────────────────────────────────
let cmdSelectedIdx = -1;

function openCmdPalette() {
  const ov = document.getElementById('cmd-ov');
  if (!ov) return;
  ov.classList.add('open');
  const inp = document.getElementById('cmd-input');
  inp.value = ''; inp.focus(); renderCmds('');
}

function closeCmdPalette() {
  const ov = document.getElementById('cmd-ov');
  if (ov) ov.classList.remove('open');
  cmdSelectedIdx = -1;
}

function filterCmds() {
  const inp = document.getElementById('cmd-input');
  renderCmds(inp ? inp.value.trim().toLowerCase() : '');
}

function renderCmds(q) {
  const res = document.getElementById('cmd-results');
  if (!res) return;
  res.innerHTML = ''; cmdSelectedIdx = -1;

  const tabs = [
    { ico:'🏠', lbl:'Dashboard',   meta:'Tab', action:()=>{ showTab('dashboard');   closeCmdPalette(); }},
    { ico:'📋', lbl:'Topic List',  meta:'Tab', action:()=>{ showTab('topics');      closeCmdPalette(); }},
    { ico:'📊', lbl:'Assessments', meta:'Tab', action:()=>{ showTab('assessments'); closeCmdPalette(); }},
    { ico:'❌', lbl:'Missed Qs',   meta:'Tab', action:()=>{ showTab('missed');      closeCmdPalette(); }},
    { ico:'📝', lbl:'Notes',       meta:'Tab', action:()=>{ showTab('notes');       closeCmdPalette(); }},
    { ico:'🧠', lbl:'Suggestions', meta:'Tab', action:()=>{ showTab('suggestions'); closeCmdPalette(); }},
  ];
  const noteItems = (state.notes||[]).map((n,i) => ({
    ico:'📄', lbl: n.title||'Untitled note', meta:'Note',
    action:() => { showTab('notes'); closeCmdPalette(); setTimeout(()=>{ const el=document.getElementById('note-'+i); if(el)el.scrollIntoView({behavior:'smooth'}); },200); }
  }));
  const actions = [
    { ico:'✅', lbl:'+ New Note',           meta:'Action', action:()=>{ showTab('notes');       closeCmdPalette(); addNote(); }},
    { ico:'➕', lbl:'+ New Missed Session', meta:'Action', action:()=>{ showTab('missed');      closeCmdPalette(); addMissedSession(); }},
    { ico:'📅', lbl:'+ Practice Exam',      meta:'Action', action:()=>{ showTab('dashboard');  closeCmdPalette(); openPracticeExamModal(); }},
    { ico:'✦',  lbl:'Open Advisor',         meta:'Action', action:()=>{ closeCmdPalette(); openAdvisorModal(); }},
  ];

  const allItems = [...tabs, ...noteItems, ...actions];
  const filtered = q ? allItems.filter(it => it.lbl.toLowerCase().includes(q)) : allItems;
  if (!filtered.length) { res.innerHTML = '<div id="cmd-empty">No results for "'+escH(q)+'"</div>'; return; }

  const groups = {};
  filtered.forEach(it => { if (!groups[it.meta]) groups[it.meta]=[]; groups[it.meta].push(it); });
  Object.entries(groups).forEach(([grp, items]) => {
    const gl = document.createElement('div'); gl.className='cmd-grp'; gl.textContent=grp; res.appendChild(gl);
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'cmd-res';
      div.innerHTML = `<span class="cmd-res-ico">${it.ico}</span><span class="cmd-res-lbl">${escH(it.lbl)}</span><span class="cmd-res-meta">${it.meta}</span>`;
      div.onclick = it.action;
      div.addEventListener('mouseenter', () => { document.querySelectorAll('.cmd-res').forEach(r=>r.classList.remove('sel')); div.classList.add('sel'); });
      res.appendChild(div);
    });
  });
}

function cmdKey(e) {
  const items = document.querySelectorAll('.cmd-res');
  if (e.key==='ArrowDown') { e.preventDefault(); cmdSelectedIdx=Math.min(cmdSelectedIdx+1,items.length-1); }
  else if (e.key==='ArrowUp') { e.preventDefault(); cmdSelectedIdx=Math.max(cmdSelectedIdx-1,0); }
  else if (e.key==='Enter') { const sel=items[cmdSelectedIdx]||items[0]; if(sel)sel.click(); return; }
  else if (e.key==='Escape') { closeCmdPalette(); return; }
  else return;
  items.forEach((r,i) => r.classList.toggle('sel', i===cmdSelectedIdx));
  if (items[cmdSelectedIdx]) items[cmdSelectedIdx].scrollIntoView({block:'nearest'});
}

// ── Confirm Dialog ────────────────────────────────────────
let confirmResolve = () => {};

function confirm2(msg) {
  return new Promise(resolve => {
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-ov').classList.add('open');
    confirmResolve = (val) => {
      document.getElementById('confirm-ov').classList.remove('open');
      confirmResolve = () => {};
      resolve(val);
    };
  });
}

// ── Helpers ───────────────────────────────────────────────
function escH(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function jsStr(str) { return JSON.stringify(String(str||'')); }
function safeId(str) { return String(str||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function setText(id, value) { const el=document.getElementById(id); if(el) el.textContent=value; }

// ── FOCUS ADVISOR ─────────────────────────────────────────
function injectAdvisor() {
  // ── Floating button ──
  const fab = document.createElement('button');
  fab.id = 'advisor-fab';
  fab.innerHTML = '✦ Advisor';
  fab.onclick = openAdvisorModal;
  document.body.appendChild(fab);

  // ── Modal ──
  const modal = document.createElement('div');
  modal.id = 'advisor-modal';
  modal.className = 'modal-ov';
  modal.onclick = e => { if (e.target === modal) closeAdvisorModal(); };
  modal.innerHTML = `
    <div class="modal-box" style="max-width:680px;max-height:88vh">
      <div class="modal-hdr" style="gap:12px">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          <div class="modal-title" style="font-size:1.05rem">Study Advisor</div>
          <div style="display:flex;gap:3px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--r-sm);padding:3px">
            <button class="advisor-tab-btn active" id="adv-tab-plan" onclick="switchAdvisorTab('plan')">Plan</button>
            <button class="advisor-tab-btn" id="adv-tab-train" onclick="switchAdvisorTab('train')">Train</button>
          </div>
        </div>
        <button class="modal-close" onclick="closeAdvisorModal()">×</button>
      </div>
      <div class="modal-body" style="padding:0">

        <!-- PLAN TAB -->
        <div id="adv-panel-plan" style="padding:1.1rem 1.25rem">
          <div style="font-family:var(--font-mono);font-size:.65rem;color:var(--text-tertiary);margin-bottom:1rem;line-height:1.6">
            Tell me your day and I'll build a schedule from your weak spots, upcoming exams, and past session data.
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div>
              <div class="adv-label">Number of study blocks</div>
              <select class="input adv-select" id="adv-blocks" style="margin-top:4px">
                <option value="1">1 block</option>
                <option value="2" selected>2 blocks</option>
                <option value="3">3 blocks</option>
                <option value="4">4 blocks</option>
              </select>
            </div>
            <div>
              <div class="adv-label">Hours per block</div>
              <select class="input adv-select" id="adv-hours" style="margin-top:4px">
                <option value="1">1 hour</option>
                <option value="1.5">1.5 hours</option>
                <option value="2">2 hours</option>
                <option value="2.5">2.5 hours</option>
                <option value="3" selected>3 hours</option>
                <option value="3.5">3.5 hours</option>
                <option value="4">4 hours</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom:10px">
            <div class="adv-label">Energy level today</div>
            <div style="display:flex;gap:6px;margin-top:4px">
              <button class="adv-energy-btn" id="adv-e-low" onclick="setEnergy('low')">Low</button>
              <button class="adv-energy-btn active" id="adv-e-med" onclick="setEnergy('medium')">Medium</button>
              <button class="adv-energy-btn" id="adv-e-high" onclick="setEnergy('high')">High</button>
            </div>
          </div>

          <div style="margin-bottom:14px">
            <div class="adv-label" style="margin-bottom:4px">Anything to note? <span style="font-style:italic;font-weight:400">(optional)</span></div>
            <textarea class="input" id="adv-extra" placeholder="e.g. focusing on OB today, avoiding surgery, have a half-day…" style="min-height:52px;resize:vertical;font-size:.82rem"></textarea>
          </div>

          <button class="btn btn-primary" id="adv-plan-btn" onclick="runAdvisorPlan()" style="width:100%;justify-content:center;padding:.6rem">
            Build My Day
          </button>

          <!-- Result area -->
          <div id="adv-plan-result" style="display:none;margin-top:1rem"></div>
        </div>

        <!-- TRAIN TAB -->
        <div id="adv-panel-train" style="display:none;padding:1.1rem 1.25rem">
          <div style="font-family:var(--font-mono);font-size:.65rem;color:var(--text-tertiary);margin-bottom:1rem;line-height:1.6">
            Tell me what you studied. Be as casual or detailed as you want — I'll parse it and save it to your log so future plans get smarter.
          </div>

          <div style="margin-bottom:10px">
            <div class="adv-label" style="margin-bottom:4px">What did you do?</div>
            <textarea class="input" id="adv-train-input"
              placeholder="e.g. 40 AMBOSS questions on OB, took about 1.5 hours, felt hard on the labor and delivery stuff but okay on menopause. Also reviewed Mehlman Risk Factors for 30 min."
              style="min-height:100px;resize:vertical;font-size:.85rem;line-height:1.6"></textarea>
          </div>

          <button class="btn btn-primary" id="adv-train-btn" onclick="runAdvisorTrain()" style="width:100%;justify-content:center;padding:.6rem">
            Parse &amp; Save
          </button>

          <!-- Result area -->
          <div id="adv-train-result" style="display:none;margin-top:1rem"></div>

          <!-- Session log -->
          <div id="adv-session-log" style="margin-top:1.25rem"></div>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // ── Styles ──
  const s = document.createElement('style');
  s.textContent = `
    #advisor-fab {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 90;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 50px;
      padding: 11px 20px;
      font-family: var(--font-mono);
      font-size: .78rem;
      font-weight: 600;
      letter-spacing: .04em;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(176,120,48,.40);
      transition: all .18s;
    }
    #advisor-fab:hover {
      background: #9A6520;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(176,120,48,.50);
    }
    #advisor-fab:active { transform: translateY(0); }

    .advisor-tab-btn {
      font-family: var(--font-mono);
      font-size: .68rem;
      padding: 4px 12px;
      border-radius: 4px;
      border: none;
      background: transparent;
      color: var(--text-tertiary);
      cursor: pointer;
      transition: all .15s;
    }
    .advisor-tab-btn.active {
      background: var(--bg-card);
      color: var(--accent-text);
      box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }

    .adv-label {
      font-family: var(--font-mono);
      font-size: .6rem;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--text-tertiary);
      font-weight: 600;
    }

    .adv-energy-btn {
      font-family: var(--font-mono);
      font-size: .68rem;
      padding: 5px 14px;
      border-radius: var(--r-sm);
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-tertiary);
      cursor: pointer;
      transition: all .15s;
      flex: 1;
    }
    .adv-energy-btn.active {
      border-color: rgba(176,120,48,.4);
      background: var(--accent-glow);
      color: var(--accent-text);
    }

    .adv-result-box {
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: 1rem 1.1rem;
    }
    .adv-result-thinking {
      font-family: var(--font-mono);
      font-size: .72rem;
      color: var(--text-tertiary);
      animation: adv-pulse 1.4s ease-in-out infinite;
    }
    @keyframes adv-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }

    .adv-block-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: .85rem 1rem;
      margin-bottom: 8px;
    }
    .adv-block-hdr {
      font-family: var(--font-display);
      font-size: .9rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: .55rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .adv-block-time {
      font-family: var(--font-mono);
      font-size: .6rem;
      color: var(--text-tertiary);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 1px 6px;
    }
    .adv-topic-line {
      font-family: var(--font-mono);
      font-size: .73rem;
      color: var(--text-secondary);
      padding: .28rem 0;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .adv-topic-line:last-child { border-bottom: none; }
    .adv-topic-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: var(--accent); flex-shrink: 0; margin-top: 5px;
    }
    .adv-rationale {
      font-family: var(--font-mono);
      font-size: .65rem;
      color: var(--text-tertiary);
      margin-top: .7rem;
      padding: .6rem .8rem;
      background: var(--bg-elevated);
      border-radius: var(--r-sm);
      line-height: 1.6;
    }
    .adv-actions {
      display: flex;
      gap: 8px;
      margin-top: .85rem;
      justify-content: flex-end;
    }

    .adv-parsed-card {
      background: var(--bg-card);
      border: 1px solid var(--border-bright);
      border-radius: var(--r-md);
      padding: .85rem 1rem;
    }
    .adv-parsed-row {
      display: flex;
      gap: 10px;
      align-items: baseline;
      padding: .3rem 0;
      border-bottom: 1px solid var(--border);
      font-family: var(--font-mono);
      font-size: .72rem;
    }
    .adv-parsed-row:last-child { border-bottom: none; }
    .adv-parsed-key {
      color: var(--text-tertiary);
      width: 90px;
      flex-shrink: 0;
      font-size: .62rem;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    .adv-parsed-val { color: var(--text-primary); }

    .adv-log-entry {
      padding: .65rem .9rem;
      border: 1px solid var(--border);
      border-radius: var(--r-sm);
      margin-bottom: 6px;
      background: var(--bg-subtle);
    }
    .adv-log-date {
      font-family: var(--font-mono);
      font-size: .58rem;
      color: var(--text-tertiary);
      margin-bottom: .3rem;
    }
    .adv-log-summary {
      font-family: var(--font-mono);
      font-size: .72rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .adv-edit-block {
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      border-radius: var(--r-md);
      padding: .85rem 1rem;
      margin-bottom: 8px;
    }
    .adv-edit-block textarea {
      min-height: 58px;
      resize: vertical;
      font-size: .8rem;
      line-height: 1.5;
    }
  `;
  document.head.appendChild(s);
}

let advisorEnergy = 'medium';
let advisorTab    = 'plan';

function openAdvisorModal() {
  const m = document.getElementById('advisor-modal');
  if (m) {
    m.classList.add('open');
    renderAdvisorSessionLog();
  }
}

function closeAdvisorModal() {
  const m = document.getElementById('advisor-modal');
  if (m) m.classList.remove('open');
}

function switchAdvisorTab(tab) {
  advisorTab = tab;
  document.getElementById('adv-panel-plan').style.display  = tab === 'plan'  ? 'block' : 'none';
  document.getElementById('adv-panel-train').style.display = tab === 'train' ? 'block' : 'none';
  document.getElementById('adv-tab-plan').classList.toggle('active',  tab === 'plan');
  document.getElementById('adv-tab-train').classList.toggle('active', tab === 'train');
  if (tab === 'train') renderAdvisorSessionLog();
}

function setEnergy(level) {
  advisorEnergy = level;
  ['low','med','high'].forEach(l => {
    const btn = document.getElementById('adv-e-' + l);
    if (btn) btn.classList.toggle('active', (l === 'med' ? 'medium' : l) === level);
  });
}

// ── PLAN mode ──────────────────────────────────────────────
async function runAdvisorPlan() {
  const btn    = document.getElementById('adv-plan-btn');
  const result = document.getElementById('adv-plan-result');
  if (!btn || !result) return;

  const blocks = parseInt(document.getElementById('adv-blocks').value) || 2;
  const hours  = parseFloat(document.getElementById('adv-hours').value) || 3;
  const extra  = (document.getElementById('adv-extra').value || '').trim();

  btn.disabled = true;
  btn.textContent = 'Thinking…';
  result.style.display = 'block';
  result.innerHTML = `<div class="adv-result-box"><div class="adv-result-thinking">Building your schedule…</div></div>`;

  const today       = new Date().toISOString().slice(0,10);
  const openTopics  = (state.topics || []).filter(t => !t.done);
  const examTimeline = (state.practiceExams || [])
    .filter(e => e.date >= today)
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(0, 8)
    .map(e => `${e.name} on ${e.date} (${daysUntil(e.date)}d away)`);
  const calItems = (state.calendarItems || [])
    .filter(c => c.date >= today)
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(0, 10)
    .map(c => `${c.name} on ${c.date}`);
  const sessionLogs = (state.advisorSessionLog || [])
    .slice(-20)
    .map(s => `[${s.date}] ${s.summary}`);

  const topicList = openTopics.map(t => {
    const prio = t.priority || 'none';
    return `- ${t.name} [${prio} priority]`;
  }).join('\n');

  const prompt = `You are a USMLE Step 2 CK study advisor for Thomas, a medical student with exam on August 12, 2026 (today is ${today}).

OPEN WEAK TOPICS (sorted high→low priority):
${topicList || 'None listed'}

UPCOMING EXAMS:
${examTimeline.join('\n') || 'None'}

CALENDAR / BLOCKED DAYS:
${calItems.join('\n') || 'None'}

PAST SESSION LOG (most recent 20):
${sessionLogs.join('\n') || 'No sessions logged yet'}

TODAY'S REQUEST:
- ${blocks} study block(s)
- ${hours} hours per block
- Energy level: ${advisorEnergy}
- Notes: ${extra || 'none'}

Build a concrete study schedule. Rules:
1. Group related topics together (e.g. all OB topics in one block, all cardio in one block).
2. Prioritize high-priority topics first, then medium, then low.
3. For low energy days, front-load recognition/pattern topics. For high energy, prioritize mechanism/cause questions (Thomas's hardest type).
4. Estimate time per topic cluster based on session log history if available, otherwise reasonable defaults (30–60 min per topic cluster).
5. Build in a 15–20% buffer by simply allocating less time to topics — do NOT add a "Buffer" or "Review" line as a topic.
6. Note if any calendar events or blocked days are relevant this week.
7. Give a 1–2 sentence rationale at the end explaining why you chose this order.
8. Topic names should be clean and concise — no time estimates or priority labels in the name itself.

Respond ONLY with valid JSON in this exact format:
{
  "blocks": [
    {
      "label": "Block 1",
      "totalMinutes": 180,
      "topics": [
        { "name": "OB: Labor & Delivery + Obstetric Complications", "minutes": 90, "note": "Your highest-miss CMS cluster" },
        { "name": "Cardio: Dysrhythmias + Congenital", "minutes": 55, "note": "Medium priority, related content" }
      ]
    }
  ],
  "rationale": "Started with OB because it has the most open high-priority topics and you historically run long on these. Grouped cardio topics to build schema efficiently."
}`;

  try {
    const resp = await fetch('https://fragrant-wind-ad59.thomas31406.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await resp.json();
    const raw  = (data.content || []).map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const plan  = JSON.parse(clean);
    renderAdvisorPlanResult(plan);
  } catch(err) {
    result.innerHTML = `<div class="adv-result-box" style="border-color:rgba(184,58,32,.3)">
      <div style="font-family:var(--font-mono);font-size:.72rem;color:var(--urgent)">Something went wrong. Try again.</div>
      <div style="font-family:var(--font-mono);font-size:.62rem;color:var(--text-tertiary);margin-top:4px">${escH(String(err))}</div>
    </div>`;
  }

  btn.disabled = false;
  btn.textContent = 'Build My Day';
}

function renderAdvisorPlanResult(plan) {
  const result = document.getElementById('adv-plan-result');
  if (!result || !plan || !plan.blocks) return;

  const blocksHTML = plan.blocks.map((block, bi) => {
    const topicsText = block.topics.map(t =>
      `${t.name}${t.minutes ? ' (' + t.minutes + ' min)' : ''}${t.note ? ' — ' + t.note : ''}`
    ).join('\n');
    return `
      <div class="adv-edit-block">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-family:var(--font-display);font-size:.88rem;font-weight:700;color:var(--text-primary)">${escH(block.label)}</div>
          <span class="adv-block-time">${block.totalMinutes} min</span>
        </div>
        <textarea class="input adv-edit-block-ta" id="adv-edit-block-${bi}">${escH(topicsText)}</textarea>
      </div>`;
  }).join('');

  result.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:.62rem;color:var(--text-tertiary);margin-bottom:.7rem;text-transform:uppercase;letter-spacing:.06em">Review &amp; edit before adding to today's focus</div>
    ${blocksHTML}
    ${plan.rationale ? `<div class="adv-rationale">💡 ${escH(plan.rationale)}</div>` : ''}
    <div class="adv-actions">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('adv-plan-result').style.display='none'">Discard</button>
      <button class="btn btn-primary btn-sm" onclick="adoptAdvisorPlan(${plan.blocks.length})">Add to Today's Focus →</button>
    </div>
  `;
}

function adoptAdvisorPlan(blockCount) {
  const today = new Date().toISOString().slice(0,10);
  if (!state.todayFocus || state.todayFocus.date !== today)
    state.todayFocus = { date: today, items: [] };

  for (let bi = 0; bi < blockCount; bi++) {
    const ta = document.getElementById('adv-edit-block-' + bi);
    if (!ta) continue;
    const lines = ta.value.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      if (/^buffer|^review\s*\/|^buffer\s*\/\s*review/i.test(line)) return;
      const clean = line.replace(/\s*\(.*$/, '').replace(/\s*—.*$/, '').trim();
      if (clean) state.todayFocus.items.push({ topic: clean, done: false });
    });
  }

  renderFocusPanel();
  scheduleSave();
  closeAdvisorModal();

  const fab = document.getElementById('advisor-fab');
  if (fab) {
    fab.textContent = '✓ Added!';
    setTimeout(() => { fab.innerHTML = '✦ Advisor'; }, 1800);
  }
}

// ── TRAIN mode ─────────────────────────────────────────────
async function runAdvisorTrain() {
  const btn    = document.getElementById('adv-train-btn');
  const result = document.getElementById('adv-train-result');
  const input  = document.getElementById('adv-train-input');
  if (!btn || !result || !input) return;

  const text = input.value.trim();
  if (!text) return;

  btn.disabled = true;
  btn.textContent = 'Parsing…';
  result.style.display = 'block';
  result.innerHTML = `<div class="adv-result-box"><div class="adv-result-thinking">Parsing your session…</div></div>`;

  const today = new Date().toISOString().slice(0,10);
  const prompt = `Parse this study session log entry from a medical student (Thomas) studying for USMLE Step 2 CK.

Entry: "${text}"

Extract structured data. Respond ONLY with valid JSON:
{
  "date": "${today}",
  "summary": "short 1-line summary of what was done",
  "topics": ["topic1", "topic2"],
  "totalMinutes": 90,
  "difficulty": "easy|medium|hard",
  "notes": "any specific observations about performance or struggles"
}

If time is unclear, estimate conservatively. Topics should match USMLE subject areas when possible.`;

  try {
    const resp = await fetch('https://fragrant-wind-ad59.thomas31406.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data  = await resp.json();
    const raw   = (data.content || []).map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    result.innerHTML = `
      <div class="adv-result-box" style="border-color:var(--border-bright)">
        <div style="font-family:var(--font-mono);font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);margin-bottom:.6rem">Parsed — confirm before saving</div>
        <div class="adv-parsed-card">
          <div class="adv-parsed-row"><span class="adv-parsed-key">Summary</span><span class="adv-parsed-val">${escH(parsed.summary||'')}</span></div>
          <div class="adv-parsed-row"><span class="adv-parsed-key">Topics</span><span class="adv-parsed-val">${escH((parsed.topics||[]).join(', '))}</span></div>
          <div class="adv-parsed-row"><span class="adv-parsed-key">Duration</span><span class="adv-parsed-val">${parsed.totalMinutes ? parsed.totalMinutes + ' min' : '–'}</span></div>
          <div class="adv-parsed-row"><span class="adv-parsed-key">Difficulty</span><span class="adv-parsed-val">${escH(parsed.difficulty||'–')}</span></div>
          ${parsed.notes ? `<div class="adv-parsed-row"><span class="adv-parsed-key">Notes</span><span class="adv-parsed-val">${escH(parsed.notes)}</span></div>` : ''}
        </div>
        <div class="adv-actions">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('adv-train-result').style.display='none'">Discard</button>
          <button class="btn btn-primary btn-sm" id="adv-save-btn">Save to Log</button>
        </div>
      </div>
    `;

    window._pendingAdvisorSession = parsed;
    document.getElementById('adv-save-btn').onclick = () => saveAdvisorSession(window._pendingAdvisorSession);

  } catch(err) {
    result.innerHTML = `<div class="adv-result-box" style="border-color:rgba(184,58,32,.3)">
      <div style="font-family:var(--font-mono);font-size:.72rem;color:var(--urgent)">Parse failed. Try again.</div>
    </div>`;
  }

  btn.disabled = false;
  btn.textContent = 'Parse & Save';
}

function saveAdvisorSession(parsed) {
  if (!state.advisorSessionLog) state.advisorSessionLog = [];
  state.advisorSessionLog.push(parsed);
  if (state.advisorSessionLog.length > 100)
    state.advisorSessionLog = state.advisorSessionLog.slice(-100);

  const input  = document.getElementById('adv-train-input');
  const result = document.getElementById('adv-train-result');
  if (input)  input.value = '';
  if (result) result.style.display = 'none';

  scheduleSave();
  renderAdvisorSessionLog();

  const btn = document.getElementById('adv-train-btn');
  if (btn) {
    btn.textContent = '✓ Saved!';
    setTimeout(() => { btn.textContent = 'Parse & Save'; }, 1800);
  }
}

function renderAdvisorSessionLog() {
  const container = document.getElementById('adv-session-log');
  if (!container) return;
  const logs = (state.advisorSessionLog || []).slice().reverse().slice(0, 15);
  if (!logs.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);margin-bottom:.6rem;padding-top:.85rem;border-top:1px solid var(--border)">
      Recent Sessions (${(state.advisorSessionLog||[]).length} total)
    </div>
    ${logs.map(s => `
      <div class="adv-log-entry">
        <div class="adv-log-date">${s.date || ''}${s.totalMinutes ? ' · ' + s.totalMinutes + ' min' : ''}${s.difficulty ? ' · ' + s.difficulty : ''}</div>
        <div class="adv-log-summary">${escH(s.summary || '')}</div>
        ${s.notes ? `<div style="font-family:var(--font-mono);font-size:.62rem;color:var(--text-tertiary);margin-top:3px">${escH(s.notes)}</div>` : ''}
      </div>
    `).join('')}
  `;
}

// ============================================================
// CALENDAR ENGINE
// ============================================================

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calPopoverEvtId = null;

const CAL_TYPES = ['exam','study','personal','rotation'];
const CAL_TYPE_LABELS = { exam:'Exam', study:'Study', personal:'Personal', rotation:'Rotation' };

function normalizeCalendarItems() {
  if (!Array.isArray(state.calendarItems)) state.calendarItems = [];

  (state.practiceExams || []).forEach(pe => {
    if (!pe.date) return;
    const existing = state.calendarItems.find(c => c.peId === pe.id);
    if (existing) {
      existing.title = pe.name;
      existing.date  = pe.date;
      existing.end   = pe.date;
    } else {
      state.calendarItems.push({
        id: uid(), peId: pe.id, title: pe.name,
        date: pe.date, end: pe.date,
        type: 'exam', locked: pe.locked || false
      });
    }
  });

  const peIds = (state.practiceExams || []).map(p => p.id);
  state.calendarItems = state.calendarItems.filter(c => !c.peId || peIds.includes(c.peId));

  state.calendarItems = state.calendarItems.filter(c => {
    if (!c.date || typeof c.date !== 'string' || c.date.length < 8) return false;
    if (c.title === 'hey') return false;
    return true;
  });

  state.calendarItems.forEach(c => {
    if (!c.id)   c.id   = uid();
    if (!c.type) c.type = 'study';
    if (!c.end || c.end < c.date)  c.end = c.date;
  });
}

function calGoToday() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
}

function calPrevMonth() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}

function calNextMonth() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('cal-grid');
  const lbl  = document.getElementById('cal-month-lbl');
  if (!grid) return;

  normalizeCalendarItems();

  if (lbl) lbl.textContent = new Date(calYear, calMonth, 1)
    .toLocaleDateString([], { month:'long', year:'numeric' });

  const dows = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = `<div class="cal-dow-row">${dows.map(d => `<div class="cal-dow">${d}</div>`).join('')}</div>`;
  html += `<div class="cal-weeks" id="cal-weeks-inner"></div>`;
  grid.innerHTML = html;

  const weeksEl = document.getElementById('cal-weeks-inner');

  const firstDay  = new Date(calYear, calMonth, 1);
  const lastDay   = new Date(calYear, calMonth + 1, 0);
  const startDow  = firstDay.getDay();
  const today     = new Date().toISOString().slice(0,10);

  const days = [];
  for (let i = 0; i < startDow; i++) {
    const d = new Date(calYear, calMonth, 1 - (startDow - i));
    days.push({ date: d.toISOString().slice(0,10), curMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(calYear, calMonth, d);
    days.push({ date: dt.toISOString().slice(0,10), curMonth: true });
  }
  while (days.length % 7 !== 0) {
    const last = new Date(days[days.length-1].date + 'T00:00:00');
    last.setDate(last.getDate() + 1);
    days.push({ date: last.toISOString().slice(0,10), curMonth: false });
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i+7));

  weeks.forEach(week => {
    const weekEl = document.createElement('div');
    weekEl.className = 'cal-week';

    week.forEach(({ date, curMonth }) => {
      const dayEl = document.createElement('div');
      dayEl.className = 'cal-day' +
        (!curMonth ? ' other-month' : '') +
        (date === today ? ' is-today' : '');
      dayEl.dataset.date = date;

      const dayNum = new Date(date + 'T00:00:00').getDate();
      let eventsHTML = '';

      const dayEvts = getEventsForDate(date);
      const shown = dayEvts.slice(0, 3);
      const extra = dayEvts.length - shown.length;

      shown.forEach(evt => {
        const evtEnd  = (evt.end && evt.end >= evt.date) ? evt.end : evt.date;
        const isMulti = evt.date !== evtEnd;
        const isStart = evt.date === date;
        const isEnd   = evtEnd === date;
        let cls = `cal-evt cal-type-${evt.type}`;
        if (evt.locked) cls += ' locked';
        if (isMulti && !isStart && !isEnd) cls += ' cal-evt-cont-mid';
        else if (isMulti && !isStart)      cls += ' cal-evt-cont-left';
        else if (isMulti && !isEnd)        cls += ' cal-evt-cont-right';
        const label = (isStart || !isMulti) ? escH(evt.title) : '&nbsp;';
        eventsHTML += `<div class="${cls}" data-evtid="${evt.id}" onclick="event.stopPropagation();openCalPopover(event,'${evt.id}')">${label}</div>`;
      });

      if (extra > 0) eventsHTML += `<div class="cal-evt-more">+${extra} more</div>`;

      dayEl.innerHTML = `<div class="cal-day-num">${dayNum}</div><div class="cal-events">${eventsHTML}</div>`;
      dayEl.addEventListener('click', () => openCalPopover(null, null, date));
      weekEl.appendChild(dayEl);
    });

    weeksEl.appendChild(weekEl);
  });
}

function getEventsForDate(date) {
  return (state.calendarItems || []).filter(evt => {
    const start = evt.date;
    const end   = evt.end || evt.date;
    return date >= start && date <= end;
  }).sort((a,b) => a.date.localeCompare(b.date));
}

function openCalPopover(mouseEvent, evtId, defaultDate) {
  closeCalPopover();

  const isEdit = !!evtId;
  const evt    = isEdit ? (state.calendarItems || []).find(c => c.id === evtId) : null;
  if (isEdit && !evt) return;
  if (isEdit && evt.locked) return;

  calPopoverEvtId = evtId || null;

  const pop = document.createElement('div');
  pop.id = 'cal-popover';
  pop.className = 'cal-popover';

  const startVal = evt ? evt.date  : (defaultDate || new Date().toISOString().slice(0,10));
  const endVal   = evt ? (evt.end || evt.date) : startVal;
  const typeVal  = evt ? evt.type  : 'study';
  const titleVal = evt ? evt.title : '';

  pop.innerHTML = `
    <div class="cal-pop-title">${isEdit ? 'Edit Event' : 'New Event'}</div>
    <div class="cal-pop-row">
      <div class="cal-pop-label">Title</div>
      <input class="input" id="cal-pop-title" value="${escH(titleVal)}" placeholder="Event name…" style="margin-top:3px" autofocus>
    </div>
    <div class="cal-pop-row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <div class="cal-pop-label">Start</div>
        <input class="input" type="date" id="cal-pop-start" value="${startVal}" style="margin-top:3px">
      </div>
      <div>
        <div class="cal-pop-label">End</div>
        <input class="input" type="date" id="cal-pop-end" value="${endVal}" style="margin-top:3px">
      </div>
    </div>
    <div class="cal-pop-row">
      <div class="cal-pop-label">Type</div>
      <div class="cal-type-btns">
        ${CAL_TYPES.map(t => `<button class="cal-type-btn ${t}${t===typeVal?' active':''}" onclick="calSelectType('${t}')">${CAL_TYPE_LABELS[t]}</button>`).join('')}
      </div>
    </div>
    <div class="cal-pop-acts">
      ${isEdit ? `<button class="btn btn-danger btn-sm" onclick="deleteCalEvent('${evtId}')">Delete</button>` : ''}
      <button class="btn btn-ghost btn-sm" onclick="closeCalPopover()">Cancel</button>
      <button class="btn btn-primary btn-sm" onclick="saveCalEvent()">Save</button>
    </div>
  `;

  document.body.appendChild(pop);

  if (mouseEvent) {
    const x = mouseEvent.clientX;
    const y = mouseEvent.clientY;
    const pw = 280, ph = 320;
    const vw = window.innerWidth, vh = window.innerHeight;
    pop.style.left = Math.min(x + 8, vw - pw - 16) + 'px';
    pop.style.top  = Math.min(y + 8, vh - ph - 16) + 'px';
  } else {
    pop.style.left = '50%';
    pop.style.top  = '50%';
    pop.style.transform = 'translate(-50%,-50%)';
  }

  setTimeout(() => {
    const ti = document.getElementById('cal-pop-title');
    if (ti) { ti.focus(); ti.select(); }
  }, 50);

  setTimeout(() => {
    document.addEventListener('click', calOutsideClick);
  }, 100);

  const titleInp = document.getElementById('cal-pop-title');
  if (titleInp) titleInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveCalEvent();
    if (e.key === 'Escape') closeCalPopover();
  });
}

function calOutsideClick(e) {
  const pop = document.getElementById('cal-popover');
  if (pop && !pop.contains(e.target)) closeCalPopover();
}

function closeCalPopover() {
  const pop = document.getElementById('cal-popover');
  if (pop) pop.remove();
  document.removeEventListener('click', calOutsideClick);
  calPopoverEvtId = null;
}

function calSelectType(type) {
  document.querySelectorAll('.cal-type-btn').forEach(b => {
    b.classList.toggle('active', b.classList.contains(type));
  });
}

function saveCalEvent() {
  const title = (document.getElementById('cal-pop-title')?.value || '').trim();
  const start = document.getElementById('cal-pop-start')?.value || '';
  const end   = document.getElementById('cal-pop-end')?.value   || start;
  const type  = document.querySelector('.cal-type-btn.active')?.classList[1] || 'study';

  if (!title || !start) { closeCalPopover(); return; }

  const endFinal = end < start ? start : end;

  if (!Array.isArray(state.calendarItems)) state.calendarItems = [];

  if (calPopoverEvtId) {
    const evt = state.calendarItems.find(c => c.id === calPopoverEvtId);
    if (evt) { evt.title = title; evt.date = start; evt.end = endFinal; evt.type = type; }
  } else {
    state.calendarItems.push({ id: uid(), title, date: start, end: endFinal, type, locked: false });
  }

  closeCalPopover();
  renderCalendar();
  scheduleSave();
}

async function deleteCalEvent(evtId) {
  const evt = (state.calendarItems || []).find(c => c.id === evtId);
  if (!evt) return;
  const ok = await confirm2(`Delete "${evt.title}"?`);
  if (!ok) return;
  state.calendarItems = state.calendarItems.filter(c => c.id !== evtId);
  closeCalPopover();
  renderCalendar();
  scheduleSave();
}

// ============================================================
// SPOTIFY + FOCUS TAB ENGINE
// ============================================================

const SPOTIFY_CLIENT_ID   = '94cd31c97d794f559cbe307b3b91f919';
const SPOTIFY_REDIRECT    = 'https://thomascostner37.github.io/Step-2-Dashboard/';
const SPOTIFY_SCOPES      = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'streaming',
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

let spToken        = null;
let spPlayer       = null;
let spDeviceId     = null;
let spPollTimer        = null;
let spCurrentTrack     = null;
let spInterpolateTimer = null;
let spLastPollTime     = null;
let spLastProgress     = 0;
let spLastDuration     = 0;
let spIsPlaying        = false;

// ── Expanded quotes ──────────────────────────────────────
const ALL_QUOTES = [
  { text:"The difference between the impossible and the possible lies in a person's determination.", attr:"Tommy Lasorda" },
  { text:"You have to fight to reach your dream. You have to sacrifice and work hard for it.", attr:"Lionel Messi" },
  { text:"Hard work beats talent when talent doesn't work hard.", attr:"Tim Notke" },
  { text:"Champions aren't made in the gyms. Champions are made from something they have deep inside them.", attr:"Muhammad Ali" },
  { text:"Don't wish it were easier. Wish you were better.", attr:"Jim Rohn" },
  { text:"The more I practice, the luckier I get.", attr:"Gary Player" },
  { text:"It's not whether you get knocked down; it's whether you get up.", attr:"Vince Lombardi" },
  { text:"The pain you feel today will be the strength you feel tomorrow.", attr:"Anonymous" },
  { text:"Obsessed is a word the lazy use to describe the dedicated.", attr:"Anonymous" },
  { text:"You don't get what you wish for. You get what you work for.", attr:"Anonymous" },
  { text:"Somewhere someone is working harder than you. Don't let them win.", attr:"Anonymous" },
  { text:"Outwork everyone. Every single day.", attr:"Anonymous" },
  { text:"The best never rest.", attr:"Anonymous" },
  { text:"Success is the sum of small efforts repeated day in and day out.", attr:"Robert Collier" },
  { text:"Excellence is not a destination but a continuous journey that never ends.", attr:"Anonymous" },
  { text:"Every patient you'll ever treat is counting on the version of you that didn't quit.", attr:"Anonymous" },
  { text:"You chose medicine because you wanted to matter. Remember that on the hard days.", attr:"Anonymous" },
  { text:"The exam is just a gate. What you become getting through it is what actually counts.", attr:"Anonymous" },
  { text:"Medicine is hard because it has to be. Patients can't afford for it to be easy.", attr:"Anonymous" },
  { text:"Your future patients don't know your name yet, but they're already counting on you.", attr:"Anonymous" },
  { text:"The road is long, but so is the reward.", attr:"Anonymous" },
  { text:"One more question. One more page. One more day closer.", attr:"Anonymous" },
  { text:"You have power over your mind, not outside events. Realize this, and you will find strength.", attr:"Marcus Aurelius" },
  { text:"Waste no more time arguing what a good man should be. Be one.", attr:"Marcus Aurelius" },
  { text:"It is not the mountain we conquer, but ourselves.", attr:"Edmund Hillary" },
  { text:"The impediment to action advances action. What stands in the way becomes the way.", attr:"Marcus Aurelius" },
  { text:"He who fears death will never do anything worthy of a living man.", attr:"Seneca" },
  { text:"Difficulties strengthen the mind as labor does the body.", attr:"Seneca" },
  { text:"We suffer more in imagination than in reality.", attr:"Seneca" },
  { text:"It does not matter how slowly you go as long as you do not stop.", attr:"Confucius" },
  { text:"I hated every minute of training, but I said: don't quit. Suffer now and live the rest of your life as a champion.", attr:"Muhammad Ali" },
  { text:"If you're not tired, you're not working hard enough.", attr:"Anonymous" },
  { text:"The only person you are destined to become is the person you decide to be.", attr:"Ralph Waldo Emerson" },
  { text:"Do not go where the path may lead; go instead where there is no path and leave a trail.", attr:"Ralph Waldo Emerson" },
  { text:"Talent is cheaper than table salt. What separates the talented individual from the successful one is hard work.", attr:"Stephen King" },
  { text:"Great works are performed not by strength but by perseverance.", attr:"Samuel Johnson" },
  { text:"The secret of getting ahead is getting started.", attr:"Mark Twain" },
  { text:"Don't count the days. Make the days count.", attr:"Muhammad Ali" },
  { text:"Energy and persistence conquer all things.", attr:"Benjamin Franklin" },
  { text:"I am not a product of my circumstances. I am a product of my decisions.", attr:"Stephen Covey" },
];

let focusQuoteIdx = Math.floor(Math.random() * ALL_QUOTES.length);
let focusQuoteTimer = null;
let focusRightMode = 'playlists';

function injectSpotifyTab() {
  const tabBar = document.querySelector('.tab-bar');
  const app    = document.getElementById('app');

  if (tabBar && !document.getElementById('btn-focus')) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn'; btn.id = 'btn-focus';
    btn.onclick = () => showTab('focus');
    btn.innerHTML = 'Focus';
    tabBar.appendChild(btn);
  }

  if (app && !document.getElementById('tab-focus')) {
    const panel = document.createElement('div');
    panel.id = 'tab-focus'; panel.className = 'tab-panel';
    panel.innerHTML = `
      <div class="focus-tab-grid">

        <!-- NOW PLAYING -->
        <div class="sp-card">
          <div class="dash-head" style="margin-bottom:.85rem">
            <div class="dash-title">Now Playing</div>
          </div>
          <div id="sp-main-content">
            <div class="sp-idle">Not connected to Spotify</div>
            <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">
              Connect Spotify
            </button>
          </div>
        </div>

        <!-- RIGHT PANEL: POMODORO (top) + PLAYLISTS/QUOTES (bottom) -->
        <div class="pom-card" style="display:flex;flex-direction:column;gap:0">

          <!-- POMODORO -->
          <div style="margin-bottom:1.1rem">
            <div class="dash-title" style="margin-bottom:.6rem">Pomodoro</div>
            <div class="pom-display" style="margin:.4rem 0 .7rem">
              <div class="pom-time" id="focus-pom-time">45:00</div>
              <div class="pom-phase" id="focus-pom-phase">Work</div>
            </div>
            <div class="pom-controls" style="margin-bottom:0">
              <button class="pom-btn" onclick="pomReset()">Reset</button>
              <button class="pom-btn primary" id="focus-pom-start-btn" onclick="pomToggle()">Start</button>
              <button class="pom-btn" onclick="pomOpenEdit(event)">Edit</button>
            </div>
          </div>

          <div style="height:1px;background:var(--border);margin-bottom:1rem"></div>

          <!-- PLAYLISTS / QUOTES TOGGLE -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.7rem">
            <div class="dash-title" id="focus-right-title">Playlists</div>
            <div style="display:flex;gap:3px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--r-sm);padding:3px">
              <button class="advisor-tab-btn active" id="focus-btn-playlists" onclick="setFocusRight('playlists')">Playlists</button>
              <button class="advisor-tab-btn" id="focus-btn-quotes" onclick="setFocusRight('quotes')">Quotes</button>
            </div>
          </div>

          <!-- Playlists panel -->
          <div id="focus-playlists-panel" style="flex:1;overflow-y:auto;max-height:320px">
            <div id="sp-playlists-list">
              <div class="sp-idle" style="padding:1rem 0">Connect Spotify to see your playlists</div>
            </div>
          </div>

          <!-- Quotes panel — FIXED: vertical centering + centered nav + bigger author -->
          <div id="focus-quotes-panel" style="display:none;flex-direction:column;justify-content:space-between;min-height:200px">
            <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:.5rem 0 1rem">
              <div id="focus-quote-text" style="font-family:var(--font-display);font-style:italic;font-size:1.45rem;color:var(--text-secondary);line-height:1.75;transition:opacity .5s ease;margin-bottom:1rem;text-align:center"></div>
              <div id="focus-quote-attr" style="font-family:var(--font-mono);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-tertiary);transition:opacity .5s ease;text-align:center"></div>
            </div>
            <div style="display:flex;gap:8px;justify-content:center;padding-top:.5rem">
              <button class="btn btn-ghost btn-sm" onclick="prevFocusQuote()">‹ Prev</button>
              <button class="btn btn-ghost btn-sm" onclick="nextFocusQuote()">Next ›</button>
            </div>
          </div>
        </div>

      </div>
    `;
    app.appendChild(panel);
  }

  if (!document.getElementById('pom-work-inp')) {
    const hidden = document.createElement('div');
    hidden.style.display = 'none';
    hidden.innerHTML = `
      <input type="number" id="pom-work-inp"  value="45" min="1" max="180">
      <input type="number" id="pom-break-inp" value="15" min="1" max="60">
    `;
    document.body.appendChild(hidden);
  }
}

// ── Focus right panel toggle ──────────────────────────────
function setFocusRight(mode) {
  focusRightMode = mode;
  document.getElementById('focus-btn-playlists')?.classList.toggle('active', mode === 'playlists');
  document.getElementById('focus-btn-quotes')?.classList.toggle('active', mode === 'quotes');
  const playlistsPanel = document.getElementById('focus-playlists-panel');
  const quotesPanel    = document.getElementById('focus-quotes-panel');
  if (playlistsPanel) playlistsPanel.style.display = mode === 'playlists' ? 'block' : 'none';
  if (quotesPanel)    quotesPanel.style.display    = mode === 'quotes'    ? 'flex'  : 'none';
  document.getElementById('focus-right-title').textContent = mode === 'playlists' ? 'Playlists' : 'Quotes';
  if (mode === 'quotes') startFocusQuotes();
  else stopFocusQuotes();
}

// ── Quotes ────────────────────────────────────────────────
function showFocusQuote(idx) {
  const qt = document.getElementById('focus-quote-text');
  const qa = document.getElementById('focus-quote-attr');
  if (!qt || !qa) return;
  qt.style.opacity = '0'; qa.style.opacity = '0';
  setTimeout(() => {
    const q = ALL_QUOTES[idx];
    qt.textContent = '\u201C' + q.text + '\u201D';
    qa.textContent = q.attr ? '\u2014 ' + q.attr.toUpperCase() : '';
    qt.style.opacity = '1'; qa.style.opacity = '1';
  }, 500);
}

function nextFocusQuote() {
  focusQuoteIdx = (focusQuoteIdx + 1) % ALL_QUOTES.length;
  showFocusQuote(focusQuoteIdx);
  resetFocusQuoteTimer();
}

function prevFocusQuote() {
  focusQuoteIdx = (focusQuoteIdx - 1 + ALL_QUOTES.length) % ALL_QUOTES.length;
  showFocusQuote(focusQuoteIdx);
  resetFocusQuoteTimer();
}

function startFocusQuotes() {
  showFocusQuote(focusQuoteIdx);
  focusQuoteTimer = setInterval(nextFocusQuote, 10000);
}

function stopFocusQuotes() {
  clearInterval(focusQuoteTimer);
  focusQuoteTimer = null;
}

function resetFocusQuoteTimer() {
  clearInterval(focusQuoteTimer);
  focusQuoteTimer = setInterval(nextFocusQuote, 10000);
}

// ── Playlists ─────────────────────────────────────────────
async function fetchSpotifyPlaylists() {
  if (!spToken) return;

  const container = document.getElementById('sp-playlists-list');
  if (!container) return;

  container.innerHTML = '<div class="sp-idle" style="padding:.5rem 0">Loading playlists…</div>';

  try {
    let resp = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
      headers: { Authorization: `Bearer ${spToken}` }
    });

    if (resp.status === 401) {
      const ok = await refreshSpotifyToken();
      if (!ok) {
        container.innerHTML = `
          <div class="sp-idle" style="padding:.8rem 0">
            Spotify session expired.
          </div>
          <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">
            Reconnect Spotify
          </button>
        `;
        return;
      }

      resp = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
        headers: { Authorization: `Bearer ${spToken}` }
      });
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      container.innerHTML = `
        <div class="sp-idle" style="padding:.8rem 0">
          Playlists could not load.<br>
          <span style="font-size:.62rem;color:var(--text-tertiary)">
            Spotify ${resp.status}${errText ? ': ' + escH(errText.slice(0,120)) : ''}
          </span>
        </div>
        <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">
          Reconnect Spotify
        </button>
      `;
      return;
    }

    const data = await resp.json();

    if (!data.items?.length) {
      container.innerHTML = '<div class="sp-idle" style="padding:.5rem 0">No playlists found</div>';
      return;
    }

    container.innerHTML = '';

    data.items.forEach(pl => {
      if (!pl) return;

      const img = pl.images?.[0]?.url || '';
      const div = document.createElement('div');

      div.style.cssText =
        'display:flex;align-items:center;gap:10px;padding:.45rem .5rem;border-radius:var(--r-sm);cursor:pointer;transition:background .12s;border:1px solid transparent';

      div.onmouseenter = () => {
        div.style.background = 'var(--bg-elevated)';
        div.style.borderColor = 'var(--border)';
      };

      div.onmouseleave = () => {
        div.style.background = '';
        div.style.borderColor = 'transparent';
      };

      div.innerHTML = `
        ${
          img
            ? `<img src="${escH(img)}" style="width:38px;height:38px;border-radius:4px;object-fit:cover;flex-shrink:0">`
            : '<div style="width:38px;height:38px;border-radius:4px;background:var(--bg-elevated);flex-shrink:0"></div>'
        }
        <div style="min-width:0">
          <div style="font-family:var(--font-mono);font-size:.75rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escH(pl.name)}
          </div>
          <div style="font-family:var(--font-mono);font-size:.6rem;color:var(--text-tertiary)">
            ${pl.tracks?.total || 0} tracks
          </div>
        </div>
        <div style="margin-left:auto;font-size:.9rem;color:var(--text-tertiary)">▶</div>
      `;

      div.onclick = () => playSpotifyPlaylist(pl.uri, pl.name);
      container.appendChild(div);
    });
  } catch (e) {
    console.warn('Playlists fetch:', e);

    container.innerHTML = `
      <div class="sp-idle" style="padding:.8rem 0">
        Playlists could not load.<br>
        <span style="font-size:.62rem;color:var(--text-tertiary)">
          ${escH(String(e))}
        </span>
      </div>
      <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">
        Reconnect Spotify
      </button>
    `;
  }
}

async function playSpotifyPlaylist(uri, name) {
  if (!spToken) return;
  const body = { context_uri: uri };
  if (spDeviceId) body.device_id = spDeviceId;
  try {
    await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${spToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setTimeout(fetchNowPlaying, 800);
  } catch(e) {
    window.open(`https://open.spotify.com/playlist/${uri.split(':')[2]}`, '_blank');
  }
}

// ── Spotify Auth (PKCE) ───────────────────────────────────
function spotifyLogin() {
  const verifier = generateCodeVerifier(128);
  sessionStorage.setItem('sp_verifier', verifier);
  generateCodeChallenge(verifier).then(challenge => {
    const params = new URLSearchParams({
      client_id:             SPOTIFY_CLIENT_ID,
      response_type:         'code',
      redirect_uri:          SPOTIFY_REDIRECT,
      scope:                 SPOTIFY_SCOPES,
      code_challenge_method: 'S256',
      code_challenge:        challenge,
    });
    window.location = `https://accounts.spotify.com/authorize?${params}`;
  });
}

function generateCodeVerifier(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => possible[b % possible.length]).join('');
}

async function generateCodeChallenge(verifier) {
  const data    = new TextEncoder().encode(verifier);
  const digest  = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function exchangeSpotifyCode(code) {
  const verifier = sessionStorage.getItem('sp_verifier');
  if (!verifier) return;
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     SPOTIFY_CLIENT_ID,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  SPOTIFY_REDIRECT,
      code_verifier: verifier,
    })
  });
  const data = await resp.json();
  if (data.access_token) {
    spToken = data.access_token;
    sessionStorage.setItem('sp_token', spToken);
    if (data.refresh_token) sessionStorage.setItem('sp_refresh', data.refresh_token);
    sessionStorage.removeItem('sp_verifier');
    window.history.replaceState({}, '', window.location.pathname);
    initSpotifyPlayer();
    startSpotifyPoll();
    setTimeout(fetchSpotifyPlaylists, 1500);
  }
}

async function refreshSpotifyToken() {
  const refresh = sessionStorage.getItem('sp_refresh');
  if (!refresh) return false;
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     SPOTIFY_CLIENT_ID,
      grant_type:    'refresh_token',
      refresh_token: refresh,
    })
  });
  const data = await resp.json();
  if (data.access_token) {
    spToken = data.access_token;
    sessionStorage.setItem('sp_token', spToken);
    return true;
  }
  return false;
}

// ── Init ──────────────────────────────────────────────────
function initSpotify() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  if (code) {
    exchangeSpotifyCode(code);
    return;
  }

  const saved = sessionStorage.getItem('sp_token');
  if (saved) {
    spToken = saved;
    initSpotifyPlayer();
    startSpotifyPoll();
    // Playlists will also be fetched by startSpotifyPoll
  }

  if (!window.Spotify && !document.getElementById('sp-sdk')) {
    const script    = document.createElement('script');
    script.id       = 'sp-sdk';
    script.src      = 'https://sdk.scdn.co/spotify-player.js';
    document.head.appendChild(script);
  }
}

// ── Web Playback SDK ──────────────────────────────────────
window.onSpotifyWebPlaybackSDKReady = function() {
  if (!spToken) return;
  initSpotifyPlayer();
};

function initSpotifyPlayer() {
  if (!window.Spotify || !spToken || spPlayer) return;
  spPlayer = new Spotify.Player({
    name: 'Step 2 Dashboard',
    getOAuthToken: cb => cb(spToken),
    volume: 0.8,
  });

  spPlayer.addListener('ready', ({ device_id }) => {
    spDeviceId = device_id;
    console.log('Spotify player ready:', device_id);
  });

  spPlayer.addListener('player_state_changed', state => {
    if (!state) return;
    updateNowPlayingFromSDK(state);
  });

  spPlayer.addListener('authentication_error', async () => {
    const ok = await refreshSpotifyToken();
    if (ok) initSpotifyPlayer();
  });

  spPlayer.connect();
}

// ── Now Playing ───────────────────────────────────────────
function startSpotifyPoll() {
  clearInterval(spPollTimer);
  clearInterval(spInterpolateTimer);
  fetchNowPlaying();
  fetchSpotifyPlaylists();
  spPollTimer = setInterval(fetchNowPlaying, 10000);
  // Interpolate progress every second between polls — drives the bar smoothly
  spInterpolateTimer = setInterval(() => {
    if (!spIsPlaying || !spLastDuration) return;
    const elapsed = Date.now() - spLastPollTime;
    const interpolated = Math.min(spLastProgress + elapsed, spLastDuration);
    const pct = (interpolated / spLastDuration) * 100;
    // Update bar directly — no transition in CSS, so this is already smooth at 1s
    const bar = document.querySelector('.sp-progress-bar');
    if (bar) bar.style.width = pct.toFixed(2) + '%';
    // Update elapsed time display
    const fmt = ms => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
    // Target only the first sp-time-row span (elapsed), not duration
    const timeRows = document.querySelectorAll('.sp-time-row');
    timeRows.forEach(row => {
      const span = row.querySelector('span:first-child');
      if (span) span.textContent = fmt(interpolated);
    });
  }, 1000);
}

// ── FIXED: fetchNowPlaying only re-renders DOM when track changes ──────────
async function fetchNowPlaying() {
  if (!spToken) return;
  try {
    const resp = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${spToken}` }
    });
    if (resp.status === 204) { renderNowPlaying(null); return; }
    if (resp.status === 401) {
      const ok = await refreshSpotifyToken();
      if (ok) fetchNowPlaying();
      return;
    }
    const data = await resp.json();
    const prevUri = spCurrentTrack?.item?.uri;
    spCurrentTrack = data;

    if (data && data.item) {
      const newUri = data.item.uri;
      // Sync internal state variables used by the interpolator
      spLastProgress = data.progress_ms || 0;
      spLastDuration = data.item.duration_ms || 0;
      spLastPollTime = Date.now();
      spIsPlaying    = data.is_playing;

      // Only rebuild the DOM when the track actually changes or on first load.
      // When the same track is playing, the interpolator smoothly handles progress
      // and we just do a lightweight play/pause button sync to avoid any jump.
      if (newUri !== prevUri || prevUri === undefined) {
        renderNowPlaying(data);
      } else {
        updatePlayPauseButtons(spIsPlaying);
      }
    } else {
      spIsPlaying = false;
      renderNowPlaying(data);
    }
  } catch(e) { console.warn('Spotify poll:', e); }
}

// Lightweight: only update play/pause button icon + green dot — no DOM rebuild
function updatePlayPauseButtons(isPlaying) {
  const icon = isPlaying ? '⏸' : '▶';
  const title = isPlaying ? 'Pause' : 'Play';
  const focusPlay = document.querySelector('.sp-ctrl-btn.play');
  if (focusPlay) { focusPlay.textContent = icon; focusPlay.title = title; }
  const hdrPlay = document.querySelector('.hdr-sp-btn.play');
  if (hdrPlay) { hdrPlay.textContent = icon; hdrPlay.title = title; }
  const dot = document.querySelector('.hdr-sp-dot');
  if (dot) dot.style.opacity = isPlaying ? '1' : '0';
}

function updateNowPlayingFromSDK(sdkState) {
  if (!sdkState || !sdkState.track_window) return;
  const track = sdkState.track_window.current_track;
  const prevUri = spCurrentTrack?.item?.uri;
  const newUri  = track.uri;
  spLastProgress = sdkState.position || 0;
  spLastDuration = sdkState.duration || 0;
  spLastPollTime = Date.now();
  spIsPlaying    = !sdkState.paused;

  // Same track: just sync buttons; interpolator handles bar
  if (newUri === prevUri && prevUri !== undefined) {
    updatePlayPauseButtons(spIsPlaying);
    return;
  }

  renderNowPlayingDirect({
    isPlaying:  !sdkState.paused,
    trackName:  track.name,
    artistName: track.artists.map(a => a.name).join(', '),
    albumArt:   track.album.images[0]?.url || '',
    albumName:  track.album.name,
    progress:   sdkState.position,
    duration:   sdkState.duration,
    trackUri:   track.uri,
  });
}

function renderNowPlaying(data) {
  if (!data || !data.item) {
    renderNowPlayingDirect(null);
    return;
  }
  const track = data.item;
  renderNowPlayingDirect({
    isPlaying:  data.is_playing,
    trackName:  track.name,
    artistName: track.artists.map(a => a.name).join(', '),
    albumArt:   track.album.images[0]?.url || '',
    albumName:  track.album.name,
    progress:   data.progress_ms,
    duration:   track.duration_ms,
    trackUri:   track.uri,
  });
}

function renderNowPlayingDirect(info) {
  updateHeaderWidget(info);
  renderFocusTabNowPlaying(info);
}

function renderFocusTabNowPlaying(info) {
  const container = document.getElementById('sp-main-content');
  if (!container) return;

  if (!info) {
    container.innerHTML = `
      <div class="sp-idle">Nothing playing right now</div>
      <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem;background:var(--bg-elevated);color:var(--text-secondary);border:1px solid var(--border)">
        Reconnect Spotify
      </button>
    `;
    return;
  }

  const pct = info.duration ? (info.progress / info.duration) * 100 : 0;
  const fmt = ms => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

  container.innerHTML = `
    <img class="sp-art-lg" src="${escH(info.albumArt)}" alt="${escH(info.albumName)}"
         onerror="this.style.background='var(--bg-elevated)'">
    <div class="sp-track-lg">${escH(info.trackName)}</div>
    <div class="sp-artist-lg">${escH(info.artistName)}</div>
    <div class="sp-progress-wrap">
      <div class="sp-progress-bar" style="width:${pct.toFixed(2)}%"></div>
    </div>
    <div class="sp-time-row">
      <span>${fmt(info.progress)}</span>
      <span>${fmt(info.duration)}</span>
    </div>
    <div class="sp-controls">
      <button class="sp-ctrl-btn" onclick="spPrev()" title="Previous">⏮</button>
      <button class="sp-ctrl-btn play" onclick="spPlayPause()" title="${info.isPlaying?'Pause':'Play'}">
        ${info.isPlaying ? '⏸' : '▶'}
      </button>
      <button class="sp-ctrl-btn" onclick="spNext()" title="Next">⏭</button>
    </div>
  `;
}

// ── Header widget (Spotify + Pomodoro) ───────────────────
function updateHeaderWidget(info) {
  ensureHeaderWidgets(info);
  const spSection = document.getElementById('sp-header-section');
  if (!spSection) return;

  if (!info) {
    spSection.innerHTML = `
      <button class="hdr-sp-connect" onclick="spotifyLogin()">♫ Connect Spotify</button>
    `;
    return;
  }

  const playIcon = info.isPlaying ? '⏸' : '▶';
  spSection.innerHTML = `
    <img class="hdr-art" src="${escH(info.albumArt)}" alt="art" onerror="this.style.opacity='.3'">
    <div class="hdr-track-info">
      <div class="hdr-track-name">${escH(info.trackName)}</div>
      <div class="hdr-artist-name">${escH(info.artistName)}</div>
    </div>
    ${info.isPlaying ? '<div class="hdr-sp-dot"></div>' : ''}
    <div class="hdr-sp-controls">
      <button class="hdr-sp-btn" onclick="spPrev()" title="Previous">⏮</button>
      <button class="hdr-sp-btn play" onclick="spPlayPause()" title="${info.isPlaying?'Pause':'Play'}">${playIcon}</button>
      <button class="hdr-sp-btn" onclick="spNext()" title="Next">⏭</button>
    </div>
  `;
}

function ensureHeaderWidgets(info) {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  if (!document.getElementById('sp-header-section')) {
    const spDiv = document.createElement('div');
    spDiv.id = 'sp-header-section';
    spDiv.className = 'hdr-sp-section';
    const saveStatus = document.getElementById('save-status');
    headerRight.insertBefore(spDiv, saveStatus);
  }

  if (!document.getElementById('pom-header-section')) {
    const pomDiv = document.createElement('div');
    pomDiv.id = 'pom-header-section';
    pomDiv.className = 'hdr-pom-section';
    pomDiv.innerHTML = `
      <div class="hdr-pom-inner">
        <div class="hdr-pom-time" id="hdr-pom-time">45:00</div>
        <div class="hdr-pom-phase" id="hdr-pom-phase">Work</div>
      </div>
      <div class="hdr-pom-btns">
        <button class="hdr-pom-btn" id="hdr-pom-start" onclick="pomToggle()" title="Start/Pause">▶</button>
        <button class="hdr-pom-btn" onclick="pomReset()" title="Reset">↺</button>
        <button class="hdr-pom-btn" onclick="pomOpenEdit(event)" title="Edit">✎</button>
      </div>
    `;
    const saveStatus = document.getElementById('save-status');
    headerRight.insertBefore(pomDiv, saveStatus);
  }

  if (!document.getElementById('pom-edit-pop')) {
    const pop = document.createElement('div');
    pop.id = 'pom-edit-pop';
    pop.className = 'pom-edit-pop';
    pop.style.display = 'none';
    pop.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-end">
        <div>
          <div class="pom-set-label">Work (min)</div>
          <input class="input" type="number" id="pom-work-inp" value="45" min="1" max="180" style="width:70px;text-align:center">
        </div>
        <div>
          <div class="pom-set-label">Break (min)</div>
          <input class="input" type="number" id="pom-break-inp" value="15" min="1" max="60" style="width:70px;text-align:center">
        </div>
        <button class="btn btn-primary btn-sm" onclick="pomSaveEdit()">Set</button>
        <button class="btn btn-ghost btn-sm" onclick="pomCloseEdit()">✕</button>
      </div>
    `;
    document.body.appendChild(pop);
    document.addEventListener('click', e => {
      const pop = document.getElementById('pom-edit-pop');
      const btn = document.getElementById('pom-header-section');
      if (pop && pop.style.display !== 'none' && !pop.contains(e.target) && !btn?.contains(e.target)) {
        pomCloseEdit();
      }
    });
  }
}

function pomOpenEdit(e) {
  ensureHeaderWidgets();

  const pop = document.getElementById('pom-edit-pop');
  if (!pop) return;

  const anchor =
    e?.currentTarget ||
    document.getElementById('pom-header-section') ||
    document.getElementById('focus-pom-start-btn');

  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();

  pop.style.display = 'block';

  const pw = 260;
  const ph = 90;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rect.left;
  let top = rect.bottom + 8;

  if (left + pw > vw - 16) left = vw - pw - 16;
  if (top + ph > vh - 16) top = rect.top - ph - 8;

  pop.style.left = Math.max(16, left) + 'px';
  pop.style.top = Math.max(16, top) + 'px';
  pop.style.right = 'auto';
  pop.style.transform = 'none';
}

function pomCloseEdit() {
  const pop = document.getElementById('pom-edit-pop');
  if (pop) pop.style.display = 'none';
}

function pomSaveEdit() {
  pomCloseEdit();
  pomReset();
}

// ── Playback controls ─────────────────────────────────────
async function spPlayPause() {
  if (!spToken) return;
  if (spPlayer) {
    spPlayer.togglePlay();
    return;
  }
  const state = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { 'Authorization': `Bearer ${spToken}` }
  }).then(r => r.json()).catch(() => null);

  const isPlaying = state?.is_playing;
  const endpoint  = isPlaying ? 'pause' : 'play';
  await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${spToken}` },
    body: spDeviceId ? JSON.stringify({ device_id: spDeviceId }) : undefined,
  });
  setTimeout(fetchNowPlaying, 500);
}

async function spNext() {
  if (!spToken) return;
  if (spPlayer) { spPlayer.nextTrack(); return; }
  await fetch('https://api.spotify.com/v1/me/player/next', {
    method: 'POST', headers: { 'Authorization': `Bearer ${spToken}` }
  });
  // Force full re-render after skip so new track shows immediately
  spCurrentTrack = null;
  setTimeout(fetchNowPlaying, 500);
}

async function spPrev() {
  if (!spToken) return;
  if (spPlayer) { spPlayer.previousTrack(); return; }
  await fetch('https://api.spotify.com/v1/me/player/previous', {
    method: 'POST', headers: { 'Authorization': `Bearer ${spToken}` }
  });
  spCurrentTrack = null;
  setTimeout(fetchNowPlaying, 500);
}

// ── Pomodoro ──────────────────────────────────────────────
let pomInterval  = null;
let pomRunning   = false;
let pomPhase     = 'work';
let pomSecondsLeft = 45 * 60;

function pomGetWork()  { return parseInt(document.getElementById('pom-work-inp')?.value  || 45) * 60; }
function pomGetBreak() { return parseInt(document.getElementById('pom-break-inp')?.value || 15) * 60; }

function pomToggle() {
  if (pomRunning) {
    clearInterval(pomInterval);
    pomRunning = false;
    const startBtn = document.getElementById('pom-start-btn');
    if (startBtn) startBtn.textContent = 'Resume';
  } else {
    if (pomSecondsLeft === 45 * 60 || pomSecondsLeft <= 0) {
      pomSecondsLeft = pomGetWork();
      pomPhase = 'work';
    }
    pomRunning = true;
    const startBtn = document.getElementById('pom-start-btn');
    if (startBtn) startBtn.textContent = 'Pause';
    pomInterval = setInterval(pomTick, 1000);
  }
  pomRender();
}

function pomTick() {
  pomSecondsLeft--;
  if (pomSecondsLeft <= 0) {
    pomPhaseEnd();
  } else {
    pomRender();
  }
}

function pomPhaseEnd() {
  clearInterval(pomInterval);
  pomRunning = false;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = pomPhase === 'work' ? 523 : 440;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.start(); osc.stop(ctx.currentTime + 1.2);
  } catch(e) {}

  pomPhase = pomPhase === 'work' ? 'break' : 'work';
  pomSecondsLeft = pomPhase === 'work' ? pomGetWork() : pomGetBreak();
  const startBtn = document.getElementById('pom-start-btn');
  if (startBtn) startBtn.textContent = pomPhase === 'work' ? 'Start Work' : 'Start Break';
  pomRender();
}

function pomReset() {
  clearInterval(pomInterval);
  pomRunning = false;
  pomPhase = 'work';
  pomSecondsLeft = pomGetWork();
  pomRender();
}

function pomRender() {
  const mins = Math.floor(pomSecondsLeft / 60);
  const secs = pomSecondsLeft % 60;
  const timeStr = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  const phaseStr = pomPhase === 'work' ? 'Work' : 'Break';

  const hdrTime  = document.getElementById('hdr-pom-time');
  const hdrPhase = document.getElementById('hdr-pom-phase');
  const hdrStart = document.getElementById('hdr-pom-start');
  if (hdrTime)  hdrTime.textContent  = timeStr;
  if (hdrPhase) { hdrPhase.textContent = phaseStr; hdrPhase.className = 'hdr-pom-phase' + (pomPhase === 'break' ? ' break' : ''); }
  if (hdrStart) hdrStart.textContent = pomRunning ? '⏸' : '▶';

  const fTime  = document.getElementById('focus-pom-time');
  const fPhase = document.getElementById('focus-pom-phase');
  const fStart = document.getElementById('focus-pom-start-btn');
  const phaseCls = 'pom-phase' + (pomPhase === 'break' ? ' break' : '');
  const btnLabel = pomRunning ? 'Pause' : (pomSecondsLeft < pomGetWork() && pomPhase === 'work' ? 'Resume' : 'Start');
  if (fTime)  fTime.textContent  = timeStr;
  if (fPhase) { fPhase.textContent = phaseStr; fPhase.className = phaseCls; }
  if (fStart) fStart.textContent = btnLabel;

  if (pomRunning) document.title = `${timeStr} · Step 2`;
  else document.title = 'Step 2 — Study Dashboard';
}

function initPomDisplay() {
  pomSecondsLeft = pomGetWork();
  pomRender();
}


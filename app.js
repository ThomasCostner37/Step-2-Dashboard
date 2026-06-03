// ============================================================
// STEP 2 DASHBOARD — APP LOGIC + GOOGLE DRIVE SYNC
// Replacement build: Dashboard + Topics + Suggestions redesign
// ============================================================

const SCOPES = 'https://www.googleapis.com/auth/documents';

const TOPICS = [
  'OB/GYN',
  'Female Reproductive',
  'Respiratory',
  'Cardiology',
  'Endocrine',
  'Multisystem',
  'Heme/Onc',
  'Neurology',
  'GI',
  'Behavioral Health',
  'Biostatistics',
  'MSK'
];

const NBME_FORMS = ['Form 9','Form 10','Form 11','Form 12','Form 13','Form 14','Form 15','Form 16'];

const CSSE_DATE  = '2026-06-12';
const STEP2_DATE = '2026-08-12';
const GOAL_SCORE = 90;

const SHELF_SCORES = [
  { date:'2025-08-12', label:'FM Shelf 1',      score:82 },
  { date:'2025-09-12', label:'FM Shelf 2',      score:87 },
  { date:'2025-10-06', label:'Peds Shelf 1',    score:87 },
  { date:'2025-10-31', label:'Peds Shelf 2',    score:87 },
  { date:'2025-11-12', label:'Surgery Shelf 1', score:75 },
  { date:'2025-12-19', label:'Surgery Shelf 2', score:83 },
  { date:'2026-02-13', label:'Psych Shelf 1',   score:94 },
  { date:'2026-03-20', label:'Psych Shelf 2',   score:94 },
  { date:'2026-04-18', label:'OB/GYN Shelf 1',  score:86 },
  { date:'2026-05-15', label:'IM Shelf 1',      score:88 },
  { date:'2026-06-01', label:'IM Shelf 2',      score:84 },
];

// ── State ─────────────────────────────────────────────────
let state = {
  topics:         Object.fromEntries(TOPICS.map(t => [t, false])),
  customTopics:   [],
  topicNotes:     {},
  resources:      [],
  nbmeScores:     [],
  cmsScores:      [],
  missedSessions: [],
  notes:          [],
  archivedNotes:  [],
  todayFocus:     { date:'', items:[] },
  calendarItems:  [],
  suggestions:    [],
};

let tokenClient;
let saveTimer = null;
let shelfChart = null;
let activeTopicFilter = 'all';

// ── Init ──────────────────────────────────────────────────
window.onload = function () {
  injectAppRefinements();
  setupStaticControls();
  document.addEventListener('keydown', globalKeyDown);

  gapi.load('client', async () => {
    try {
      await gapi.client.init({
        apiKey: typeof API_KEY !== 'undefined' ? API_KEY : '',
        discoveryDocs: ['https://docs.googleapis.com/$discovery/rest?version=v1']
      });
    } catch (e) {
      console.warn('gapi init (non-fatal):', e);
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { console.log('GIS:', resp.error); return; }
        gapi.client.setToken({ access_token: resp.access_token });
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app').classList.add('visible');
        await loadFromDrive();
        normalizeState();
        renderAll();
      }
    });

    setTimeout(() => tokenClient.requestAccessToken({ prompt: 'none' }), 100);
  });
};

function setupStaticControls() {
  const nbmeSel = document.getElementById('nbme-form-sel');
  if (nbmeSel && nbmeSel.options.length <= 1) {
    NBME_FORMS.forEach(f => nbmeSel.appendChild(new Option(f, f)));
  }
}

function handleSignIn() {
  tokenClient.requestAccessToken({ prompt: '' });
}

function handleSignOut() {
  gapi.client.setToken(null);
  document.getElementById('app').classList.remove('visible');
  document.getElementById('auth-screen').style.display = 'flex';
}

// ── Drive Sync ────────────────────────────────────────────
async function loadFromDrive() {
  try {
    const doc = await gapi.client.docs.documents.get({ documentId: DOC_ID });
    let text = '';
    for (const el of (doc.result.body.content || [])) {
      if (el.paragraph) {
        for (const run of (el.paragraph.elements || [])) {
          if (run.textRun) text += run.textRun.content;
        }
      }
    }
    const trimmed = text.trim();
    if (trimmed) {
      const loaded = JSON.parse(trimmed);
      state = Object.assign({}, state, loaded);
    }
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
      (m, el) => el.endIndex ? Math.max(m, el.endIndex) : m, 1
    );
    const requests = [];
    if (lastIndex > 1) {
      requests.push({ deleteContentRange:{ range:{ startIndex:1, endIndex:lastIndex-1 }}});
    }
    requests.push({ insertText:{ location:{ index:1 }, text: JSON.stringify(state) }});
    await gapi.client.docs.documents.batchUpdate({ documentId: DOC_ID, resource:{ requests }});
    setSaveDot('saved');
    const lbl = document.getElementById('save-lbl');
    if (lbl) lbl.textContent = 'Saved ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  } catch(e) {
    console.error('Save error:', e);
    setSaveDot('error');
  }
}

function setSaveDot(st) {
  const dot = document.getElementById('save-dot');
  const lbl = document.getElementById('save-lbl');
  if (!dot) return;
  dot.className = '';

  if (stateName === 'saving') {
    dot.classList.add('saving');
    if (lbl) lbl.textContent = 'Saving…';
  } else if (stateName === 'saved') {
    dot.classList.add('saved');
  }
}

// ── State Normalization ───────────────────────────────────
function normalizeState() {
  if (!state.topics) state.topics = {};
  if (!state.customTopics) state.customTopics = [];
  if (!state.topicNotes) state.topicNotes = {};
  if (!state.resources) state.resources = [];
  if (!state.nbmeScores) state.nbmeScores = [];
  if (!state.cmsScores) state.cmsScores = [];
  if (!state.missedSessions) state.missedSessions = [];
  if (!state.notes) state.notes = [];
  if (!state.archivedNotes) state.archivedNotes = [];
  if (!state.todayFocus) state.todayFocus = { date:'', items:[] };
  if (!state.calendarItems) state.calendarItems = [];
  if (!state.suggestions) state.suggestions = [];

  // Migrate old abbreviated base topics to prettier display labels.
  const oldToNew = {
    ob: 'OB/GYN',
    frepro: 'Female Reproductive',
    resp: 'Respiratory',
    cardio: 'Cardiology',
    endo: 'Endocrine',
    multi: 'Multisystem',
    blood: 'Heme/Onc',
    cns: 'Neurology',
    gi: 'GI',
    beh: 'Behavioral Health',
    bio: 'Biostatistics',
    msk: 'MSK'
  };

  Object.entries(oldToNew).forEach(([oldKey, newKey]) => {
    if (oldKey in state.topics && !(newKey in state.topics)) {
      state.topics[newKey] = !!state.topics[oldKey];
    }
    if (oldKey in state.topicNotes && !(newKey in state.topicNotes)) {
      state.topicNotes[newKey] = state.topicNotes[oldKey];
    }
  });

  Object.keys(oldToNew).forEach(k => {
    delete state.topics[k];
    delete state.topicNotes[k];
    state.customTopics = state.customTopics.filter(t => t !== k);
  });

  const seen = new Set();
  state.customTopics = state.customTopics
    .map(t => String(t || '').trim())
    .filter(t => {
      if (!t) return false;
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      if (TOPICS.some(base => base.toLowerCase() === key)) return false;
      seen.add(key);
      return true;
    });

  getAllTopics().forEach(t => {
    if (!(t in state.topics)) state.topics[t] = false;
    if (!(t in state.topicNotes)) state.topicNotes[t] = '';
  });

  seedCalendarItems();
  seedSuggestions();
}

function getAllTopics() {
  return [...TOPICS, ...(state.customTopics || [])];
}

function seedCalendarItems() {
  if (!state.calendarItems) state.calendarItems = [];

  const fixed = [
    { name:'CSSE', date:CSSE_DATE, locked:true },
    { name:'Step 2 CK', date:STEP2_DATE, locked:true },
  ];

  fixed.forEach(item => {
    const exists = state.calendarItems.some(x => x.locked && x.name === item.name);
    if (!exists) state.calendarItems.push(item);
  });
}

function seedSuggestions() {
  if (!state.suggestions) state.suggestions = [];

  if (state.suggestions.length) return;

  state.suggestions = [
    {
      title: 'Dedicated Block Planner',
      body: 'A future tab that lets me assign AMBOSS/UWorld blocks, NBME review, CMS review, and catch-up work by date.',
      status: 'idea'
    },
    {
      title: 'Weakness Dashboard by Source',
      body: 'Separate weak spots by CMS, UWorld, AMBOSS, shelf, and NBME so repeated misses become obvious.',
      status: 'idea'
    },
    {
      title: 'Step 2 Predictor Inputs',
      body: 'A score-estimate panel that combines UWorld percent, shelf EPCs, NBMEs, Free 120, and timing until exam.',
      status: 'idea'
    }
  ];
}

// ── Runtime UI Injection ──────────────────────────────────
function injectAppRefinements() {
  injectStyles();
  injectSuggestionsTab();
  rebuildDashboardShell();
  rebuildTopicsTab();
}

function injectStyles() {
  const style = document.createElement('style');

  style.textContent = `
    .dash-stack { display:grid; gap:14px; }
    .dash-row { display:grid; grid-template-columns: 1fr 1fr; gap:14px; }
    .dash-row-wide { display:grid; grid-template-columns: 1.15fr .85fr; gap:14px; }
    .dash-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-lg); padding:1.05rem 1.25rem; }
    .dash-card-tight { padding:.95rem 1.05rem; }
    .dash-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:.75rem; }
    .dash-title { font-family:var(--font-display); font-size:.98rem; font-weight:700; color:var(--text-primary); letter-spacing:-.01em; }
    .dash-meta { font-family:var(--font-mono); font-size:.62rem; color:var(--text-tertiary); }

    .countdown-pair { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .countdown-card { min-height:142px; }

    .calendar-list { display:flex; flex-direction:column; gap:6px; margin-bottom:10px; max-height:190px; overflow-y:auto; padding-right:2px; }
    .calendar-row { display:grid; grid-template-columns:1fr auto auto; align-items:center; gap:10px; padding:.48rem .7rem; border:1px solid var(--border); border-radius:var(--r-sm); background:var(--bg-subtle); }
    .calendar-name { font-family:var(--font-mono); font-size:.78rem; color:var(--text-primary); }
    .calendar-date { font-family:var(--font-mono); font-size:.65rem; color:var(--text-tertiary); white-space:nowrap; }
    .calendar-del, .mini-topic-del, .topic-del-btn, .focus-del, .suggestion-del {
      background:transparent; border:none; color:var(--text-tertiary); font-size:.85rem; cursor:pointer; padding:0 3px;
    }
    .calendar-del:hover, .mini-topic-del:hover, .topic-del-btn:hover, .focus-del:hover, .suggestion-del:hover { color:var(--urgent); }
    .calendar-add { display:grid; grid-template-columns:1fr auto auto; gap:8px; align-items:center; }

    .focus-add { display:grid; grid-template-columns:1fr auto; gap:8px; margin-top:.7rem; }
    .focus-textarea { min-height:40px; max-height:110px; resize:vertical; line-height:1.35; }
    .focus-item { min-height:34px; }
    .focus-empty, .topic-empty, .suggestion-empty { font-family:var(--font-mono); font-size:.72rem; color:var(--text-tertiary); padding:.35rem 0; }

    .mini-progress-line { height:5px; background:var(--bg-subtle); border:1px solid var(--border); border-radius:999px; overflow:hidden; margin:.15rem 0 .5rem; }
    .mini-progress-fill { height:100%; background:var(--accent); width:0%; transition:width .35s ease; }
    .mini-topic-toolbar { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:.55rem; }
    .mini-topic-list { display:flex; flex-direction:column; gap:3px; max-height:210px; overflow-y:auto; padding-right:2px; }
    .mini-topic-row { display:flex; align-items:center; gap:8px; padding:.43rem .62rem; border-radius:var(--r-sm); border:1px solid transparent; cursor:pointer; transition:all .15s; }
    .mini-topic-row:hover { background:var(--bg-elevated); border-color:var(--border); }
    .mini-topic-row.done { opacity:.52; }
    .mini-topic-row.done .mini-topic-name { text-decoration:line-through; color:var(--text-tertiary); }
    .mini-topic-check { width:15px; height:15px; border-radius:4px; border:1px solid var(--border-bright); display:flex; align-items:center; justify-content:center; font-size:8px; flex-shrink:0; }
    .mini-topic-row.done .mini-topic-check { background:var(--success-bg); border-color:var(--success); color:#7DB87D; }
    .mini-topic-name { font-family:var(--font-mono); font-size:.72rem; color:var(--text-primary); flex:1; }
    .mini-topic-note-mark { font-family:var(--font-mono); font-size:.55rem; color:var(--accent-text); border:1px solid rgba(201,145,58,.22); background:var(--accent-glow); border-radius:3px; padding:1px 4px; }
    .mini-topic-add { display:grid; grid-template-columns:1fr auto; gap:8px; margin-top:.7rem; }

    .topic-board { display:grid; grid-template-columns:minmax(0,1fr); gap:12px; }
    .topic-toolbar { display:grid; grid-template-columns:1fr auto auto auto; gap:8px; align-items:center; margin-bottom:12px; }
    .topic-filter-group { display:flex; gap:4px; }
    .topic-filter-btn { font-family:var(--font-mono); font-size:.65rem; padding:4px 8px; border-radius:var(--r-sm); border:1px solid var(--border); color:var(--text-tertiary); background:transparent; cursor:pointer; }
    .topic-filter-btn.active { color:var(--accent-text); border-color:rgba(201,145,58,.35); background:var(--accent-glow); }
    .topic-list { gap:7px; }
    .topic-row { display:block; padding:.72rem .85rem; border:1px solid var(--border); background:var(--bg-card); border-radius:var(--r-md); cursor:default; }
    .topic-row:hover { background:var(--bg-card); border-color:var(--border-bright); }
    .topic-row.done { opacity:.66; }
    .topic-main-row { display:flex; align-items:center; gap:10px; width:100%; }
    .topic-name { font-size:.82rem; }
    .topic-main-actions { display:flex; align-items:center; gap:5px; margin-left:auto; }
    .topic-note-toggle { background:transparent; border:1px solid var(--border); color:var(--text-tertiary); border-radius:4px; padding:2px 7px; font-family:var(--font-mono); font-size:.58rem; cursor:pointer; }
    .topic-note-toggle:hover, .topic-note-toggle.active { color:var(--accent-text); border-color:var(--border-bright); background:var(--accent-glow); }
    .topic-note-box { margin:.55rem 0 0 28px; display:none; }
    .topic-row.open .topic-note-box { display:block; }
    .topic-note-input { min-height:76px; resize:vertical; font-size:.8rem; line-height:1.45; }
    .topic-add-row { display:grid; grid-template-columns:1fr auto; gap:8px; margin-top:10px; }

    .score-mini-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:.7rem; }
    .score-mini { border:1px solid var(--border); border-radius:var(--r-sm); background:var(--bg-subtle); padding:.45rem .55rem; }
    .score-mini-num { font-family:var(--font-display); font-weight:800; font-size:1.05rem; color:var(--accent-text); line-height:1; }
    .score-mini-lbl { font-family:var(--font-mono); font-size:.55rem; color:var(--text-tertiary); margin-top:.2rem; }

    .suggestion-grid { display:grid; gap:10px; }
    .suggestion-card { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-lg); padding:1rem 1.1rem; }
    .suggestion-card.done { opacity:.55; }
    .suggestion-head { display:flex; align-items:center; gap:8px; margin-bottom:.55rem; }
    .suggestion-title { flex:1; background:transparent; border:none; outline:none; font-family:var(--font-display); font-size:1rem; font-weight:700; color:var(--text-primary); }
    .suggestion-body { min-height:72px; resize:vertical; line-height:1.5; }
    .suggestion-actions { display:flex; justify-content:space-between; align-items:center; margin-top:.55rem; gap:8px; }
    .suggestion-add { display:grid; grid-template-columns:1fr auto; gap:8px; margin-bottom:14px; }

    @media (max-width: 760px) {
      .dash-row, .dash-row-wide, .countdown-pair { grid-template-columns:1fr; }
      .calendar-add, .topic-toolbar { grid-template-columns:1fr; }
      .score-mini-grid { grid-template-columns:1fr 1fr 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function injectSuggestionsTab() {
  const tabBar = document.querySelector('.tab-bar');
  const app = document.getElementById('app');

  if (tabBar && !document.getElementById('btn-suggestions')) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.id = 'btn-suggestions';
    btn.onclick = () => showTab('suggestions');
    btn.innerHTML = 'Suggestions<span class="tab-shortcut">⌘6</span>';
    tabBar.appendChild(btn);
  }

  if (app && !document.getElementById('tab-suggestions')) {
    const panel = document.createElement('div');
    panel.id = 'tab-suggestions';
    panel.className = 'tab-panel';
    panel.innerHTML = `
      <div class="suggestion-add">
        <input class="input" id="new-suggestion-title" placeholder="Add future idea, overhaul, or feature…" onkeydown="if(event.key==='Enter')addSuggestion()">
        <button class="btn btn-primary btn-sm" onclick="addSuggestion()">Add</button>
      </div>
      <div id="suggestions-list" class="suggestion-grid"></div>
    `;
    app.appendChild(panel);
  }
}

function rebuildDashboardShell() {
  const dash = document.getElementById('tab-dashboard');
  if (!dash) return;

  dash.innerHTML = `
    <div class="dash-stack">
      <div class="dash-row-wide">
        <div class="countdown-pair">
          <div id="csse-card" class="countdown-card">
            <div class="cd-icon">📅</div>
            <div class="cd-num" id="css-days">–</div>
            <div class="cd-lbl">Days until CSSE</div>
          </div>
          <div id="step-card" class="countdown-card">
            <div class="cd-icon">🎯</div>
            <div class="cd-num" id="step-days">–</div>
            <div class="cd-lbl">Days until Step 2</div>
          </div>
        </div>

        <div class="dash-card dash-card-tight">
          <div class="dash-head">
            <div class="dash-title">Study Calendar</div>
            <button class="btn btn-ghost btn-xs" onclick="showTab('assessments')">Scores</button>
          </div>
          <div id="calendar-list" class="calendar-list"></div>
          <div class="calendar-add">
            <input class="input" id="calendar-name-inp" placeholder="Exam, practice test, deadline…" onkeydown="if(event.key==='Enter')addCalendarItem()">
            <input class="input" type="date" id="calendar-date-inp" style="max-width:145px">
            <button class="btn btn-primary btn-sm" onclick="addCalendarItem()">Add</button>
          </div>
        </div>
      </div>

      <div class="dash-row-wide">
        <div class="dash-card">
          <div class="dash-head">
            <div class="dash-title">Today’s Focus</div>
            <div class="dash-meta" id="focus-date-lbl"></div>
          </div>
          <div id="focus-items"></div>
          <div class="focus-add">
            <textarea class="input focus-textarea" id="focus-text-inp" placeholder="Type a focus item…" onkeydown="if((event.metaKey||event.ctrlKey)&&event.key==='Enter')addFocusTopic()"></textarea>
            <button class="btn btn-primary btn-sm" onclick="addFocusTopic()">Add</button>
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-head">
            <div class="dash-title">Weak Spots</div>
            <div class="dash-meta" id="mini-topic-frac">0 / 0</div>
          </div>
          <div class="mini-progress-line"><div class="mini-progress-fill" id="mini-progress-fill"></div></div>
          <div class="mini-topic-toolbar">
            <div class="topic-filter-group">
              <button class="topic-filter-btn active" id="mini-filter-all" onclick="setTopicFilter('all')">All</button>
              <button class="topic-filter-btn" id="mini-filter-open" onclick="setTopicFilter('open')">Open</button>
              <button class="topic-filter-btn" id="mini-filter-notes" onclick="setTopicFilter('notes')">Notes</button>
            </div>
            <button class="btn btn-ghost btn-xs" onclick="showTab('topics')">Full List</button>
          </div>
          <div class="mini-topic-list" id="dashboard-topic-mini"></div>
          <div class="mini-topic-add">
            <input class="input" id="dash-topic-inp" placeholder="Add weak spot…" onkeydown="if(event.key==='Enter')addDashboardTopic()">
            <button class="btn btn-ghost btn-sm" onclick="addDashboardTopic()">Add</button>
          </div>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-head">
          <div class="dash-title">Score Trajectory</div>
          <div class="chart-legend">
            <div class="chart-legend-item"><div class="chart-dot" style="background:#5B8A5B"></div>≥90</div>
            <div class="chart-legend-item"><div class="chart-dot" style="background:#C9913A"></div>≥80</div>
            <div class="chart-legend-item"><div class="chart-dot" style="background:#CC5028"></div>&lt;80</div>
            <div class="chart-legend-item"><div class="chart-dot" style="background:#4779A3"></div>Average</div>
          </div>
        </div>
        <div class="score-mini-grid">
          <div class="score-mini"><div class="score-mini-num" id="score-latest">–</div><div class="score-mini-lbl">Latest</div></div>
          <div class="score-mini"><div class="score-mini-num" id="score-avg">–</div><div class="score-mini-lbl">Average</div></div>
          <div class="score-mini"><div class="score-mini-num" id="score-best">–</div><div class="score-mini-lbl">Best</div></div>
        </div>
        <canvas id="shelf-chart"></canvas>
      </div>
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
    </div>

    <div class="topic-board">
      <div class="topic-toolbar">
        <input class="input" id="topic-search-inp" placeholder="Search topics or notes…" oninput="renderTopics()">
        <div class="topic-filter-group">
          <button class="topic-filter-btn active" id="topic-filter-all" onclick="setTopicFilter('all')">All</button>
          <button class="topic-filter-btn" id="topic-filter-open" onclick="setTopicFilter('open')">Open</button>
          <button class="topic-filter-btn" id="topic-filter-done" onclick="setTopicFilter('done')">Done</button>
          <button class="topic-filter-btn" id="topic-filter-notes" onclick="setTopicFilter('notes')">Notes</button>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="collapseAllTopicNotes()">Collapse</button>
        <button class="btn btn-ghost btn-sm" onclick="expandAllTopicNotes()">Expand</button>
      </div>

      <div class="topic-list" id="topics-list"></div>

      <div class="topic-add-row">
        <input class="input" id="new-topic-inp" placeholder="Add topic or weak spot…" onkeydown="if(event.key==='Enter')addCustomTopic()">
        <button class="btn btn-primary btn-sm" onclick="addCustomTopic()">Add</button>
      </div>
    </div>

    <div class="resources-section">
      <div class="section-label">Resources</div>
      <div id="res-list"></div>
      <div class="add-res-row">
        <input class="input" id="new-res-inp" placeholder="Add resource or link…" style="flex:1" onkeydown="if(event.key==='Enter')addResource()">
        <button class="btn btn-ghost btn-sm" onclick="addResource()">Add</button>
      </div>
    </div>
  `;
}

// ── Render All ────────────────────────────────────────────
function renderAll() {
  normalizeState();
  updateCountdown();
  updateRing();
  renderCalendar();
  renderFocusPanel();
  renderDashboardTopics();
  renderChart();
  renderTopics();
  renderResources();
  renderNBME();
  renderCMS();
  renderMissedSessions();
  renderNotes();
  renderSuggestions();

  setInterval(updateCountdown, 60000);
}

// ── Navigation ────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById('tab-' + tab);
  const btn = document.getElementById('btn-' + tab);

  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
}

function globalKeyDown(e) {
  const isMeta = e.metaKey || e.ctrlKey;
  if (isMeta && !e.shiftKey && !e.altKey) {
    const tabs = ['dashboard','topics','assessments','missed','notes','suggestions'];
    const n = parseInt(e.key) - 1;
    if (n >= 0 && n < tabs.length) { e.preventDefault(); showTab(tabs[n]); return; }
    if (e.key === 'k') { e.preventDefault(); openCmdPalette(); return; }
  }
  if (e.key === 'Escape') {
    closeCmdPalette();
    closeArchiveModal();
    confirmResolve(false);
  }
}

// ── Countdown ─────────────────────────────────────────────
function daysUntil(dateStr) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tgt = new Date(dateStr + 'T00:00:00');
  return Math.max(0, Math.ceil((tgt - today) / 86400000));
}

function updateCountdown() {
  const cssD = daysUntil(CSSE_DATE);
  const stepD = daysUntil(STEP2_DATE);

  const cssEl = document.getElementById('css-days');
  const stepEl = document.getElementById('step-days');
  const cssCard = document.getElementById('csse-card');
  const stepCard = document.getElementById('step-card');

  if (cssEl) cssEl.textContent = cssD;
  if (stepEl) stepEl.textContent = stepD;
  function urgency(card, days) {
    if (!card) return;
    card.classList.remove('warn','urgent');
    if (days < 7) card.classList.add('urgent');
    else if (days < 14) card.classList.add('warn');
  }

  urgency(cssCard, cssD);
  urgency(stepCard, stepD);
}

function renderCalendar() {
  seedCalendarItems();
  const list = document.getElementById('calendar-list');
  if (!list) return;
  list.innerHTML = '';

  const sorted = [...(state.calendarItems || [])].sort((a,b) =>
    (a.date || '').localeCompare(b.date || '')
  );

  items.forEach(item => {
    const idx = state.calendarItems.indexOf(item);
    const days = item.date ? daysUntil(item.date) : null;
    const row = document.createElement('div');

    row.className = 'calendar-row';
    row.innerHTML = `
      <span class="cal-drag" title="Drag to reorder">⠿</span>
      <div class="calendar-name">${escH(item.name || 'Untitled')}</div>
      <div class="calendar-date">${fmtCalDate(item.date)}${days !== null ? ' · ' + days + 'd' : ''}</div>
      ${item.locked
        ? '<span class="tag tag-ghost" style="font-size:.52rem">fixed</span>'
        : `<button class="calendar-del" onclick="removeCalendarItem(${idx})" title="Remove">×</button>`
      }
    `;
    list.appendChild(row);
  });
}

function addCalendarItem() {
  const nameInp = document.getElementById('calendar-name-inp');
  const dateInp = document.getElementById('calendar-date-inp');

  if (!nameInp || !dateInp) return;

  const name = nameInp.value.trim();
  const date = dateInp.value;
  if (!name || !date) return;

  state.calendarItems.push({ name, date, locked:false });

  nameInp.value = '';
  dateInp.value = '';
  renderCalendar();
  scheduleSave();
}

async function removeCalendarItem(i) {
  if (!state.calendarItems || !state.calendarItems[i]) return;
  const ok = await confirm2('Remove "' + state.calendarItems[i].name + '" from the calendar?');
  if (!ok) return;
  state.calendarItems.splice(i, 1);
  renderCalendar();
  scheduleSave();
}

// ── Focus ─────────────────────────────────────────────────
function renderFocusPanel() {
  const today = new Date().toISOString().slice(0,10);
  const lbl = document.getElementById('focus-date-lbl');

  if (lbl) lbl.textContent = new Date().toLocaleDateString([], {month:'short', day:'numeric'});

  if (!state.todayFocus || state.todayFocus.date !== today) {
    state.todayFocus = { date: today, items: [] };
  }
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
      <button class="focus-del" onclick="event.stopPropagation();removeFocusItem(${i})">×</button>
    `;
    container.appendChild(div);
  });
}

function addFocusTopic() {
  const inp   = document.getElementById('focus-text-inp');
  const topic = inp ? inp.value.trim() : '';
  if (!topic) return;
  const today = new Date().toISOString().slice(0,10);
  if (!state.todayFocus || state.todayFocus.date !== today) {
    state.todayFocus = { date: today, items: [] };
  }

  state.todayFocus.items.push({ topic, done:false });
  inp.value = '';
  renderFocusPanel();
  scheduleSave();
}

function toggleFocusItem(i) {
  state.todayFocus.items[i].done = !state.todayFocus.items[i].done;
  renderFocusPanel();
  scheduleSave();
}

function removeFocusItem(i) {
  state.todayFocus.items.splice(i, 1);
  renderFocusPanel();
  scheduleSave();
}

// ── Topics + Weak Spots ───────────────────────────────────
function setTopicFilter(filter) {
  activeTopicFilter = filter;

  document.querySelectorAll('.topic-filter-btn').forEach(btn => btn.classList.remove('active'));

  const ids = [
    'topic-filter-' + filter,
    'mini-filter-' + filter
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  });

  renderTopics();
  renderDashboardTopics();
}

function topicMatchesFilter(topic) {
  if (activeTopicFilter === 'open') return !state.topics[topic];
  if (activeTopicFilter === 'done') return !!state.topics[topic];
  if (activeTopicFilter === 'notes') return !!(state.topicNotes[topic] || '').trim();
  return true;
}

function topicMatchesSearch(topic) {
  const inp = document.getElementById('topic-search-inp');
  const q = inp ? inp.value.trim().toLowerCase() : '';
  if (!q) return true;

  const note = (state.topicNotes[topic] || '').toLowerCase();
  return topic.toLowerCase().includes(q) || note.includes(q);
}

function renderDashboardTopics() {
  const container = document.getElementById('dashboard-topic-mini');
  const frac      = document.getElementById('mini-topic-frac');
  const fill      = document.getElementById('mini-progress-fill');
  if (!container) return;
  container.innerHTML = '';

  const allTopics = getAllTopics();
  const done = allTopics.filter(t => state.topics[t]).length;
  const total = allTopics.length;
  const pct   = total ? Math.round((done / total) * 100) : 0;
  if (frac) frac.textContent = done + ' / ' + total + ' · ' + pct + '%';
  if (fill) fill.style.width = pct + '%';

  if (frac) frac.textContent = done + ' / ' + total + ' · ' + pct + '%';
  if (fill) fill.style.width = pct + '%';

  const shown = allTopics.filter(topicMatchesFilter);

  if (!shown.length) {
    container.innerHTML = '<div class="topic-empty">Nothing here</div>';
    return;
  }

  shown.forEach(topic => {
    const isDone = !!state.topics[topic];
    const isCustom = !TOPICS.includes(topic);
    const hasNote = !!(state.topicNotes[topic] || '').trim();

    const row = document.createElement('div');
    row.className = 'mini-topic-row' + (isDone ? ' done' : '');
    row.onclick = () => toggleTopic(topic);
    row.innerHTML = `
      <div class="mini-topic-check">${isDone ? '✓' : ''}</div>
      <div class="mini-topic-name">${escH(topic)}</div>
      ${hasNote ? '<span class="mini-topic-note-mark">note</span>' : ''}
      ${isCustom ? `<button class="mini-topic-del" onclick="event.stopPropagation();removeCustomTopic(${jsStr(topic)})">×</button>` : ''}
    `;
    container.appendChild(row);
  });
}

function addDashboardTopic() {
  const inp = document.getElementById('dash-topic-inp');
  const val = inp ? inp.value.trim() : '';

  if (!val) return;
  addTopicValue(val);
  inp.value = '';
}

function renderTopics() {
  const container = document.getElementById('topics-list');
  if (!container) return;
  container.innerHTML = '';

  const allTopics = getAllTopics().filter(topicMatchesFilter).filter(topicMatchesSearch);

  if (!allTopics.length) {
    container.innerHTML = '<div class="topic-empty">No matching topics</div>';
    updateRing();
    return;
  }

  allTopics.forEach(topic => {
    const done = !!state.topics[topic];
    const isCustom = !TOPICS.includes(topic);
    const hasNote = !!(state.topicNotes[topic] || '').trim();

    const row = document.createElement('div');

    row.className = 'topic-row' + (done ? ' done' : '');
    row.id = 'topic-row-' + safeId(topic);

    row.innerHTML = `
      <div class="topic-main-row">
        <div class="t-check" onclick="event.stopPropagation();toggleTopic(${jsStr(topic)})">${done ? '✓' : ''}</div>
        <div class="topic-name" onclick="event.stopPropagation();toggleTopic(${jsStr(topic)})">${escH(topic)}</div>
        <div class="topic-main-actions">
          <button class="topic-note-toggle ${hasNote ? 'active' : ''}" onclick="event.stopPropagation();toggleTopicNote(${jsStr(topic)})">${hasNote ? 'Note' : '+ Note'}</button>
          ${isCustom ? `<button class="topic-del-btn" onclick="event.stopPropagation();removeCustomTopic(${jsStr(topic)})">×</button>` : ''}
        </div>
      </div>
      <div class="topic-note-box">
        <textarea class="input topic-note-input" placeholder="Notes for ${escH(topic)}…" oninput="updateTopicNote(${jsStr(topic)}, this.value)">${escH(state.topicNotes[topic] || '')}</textarea>
      </div>
    `;
    container.appendChild(row);
  });

  // Update topic archive badge
  const badge = document.getElementById('topic-arch-badge');
  if (badge) {
    const count = (state.archivedTopics || []).length;
    badge.textContent = count;
    badge.style.display = count ? 'inline-flex' : 'none';
  }

  updateRing();
}

function toggleTopic(topic) {
  state.topics[topic] = !state.topics[topic];
  renderTopics();
  renderDashboardTopics();
  updateRing();
  scheduleSave();
}

function addTopicValue(raw) {
  const topic = String(raw || '').trim();
  if (!topic) return;

  const exists = getAllTopics().some(t => t.toLowerCase() === topic.toLowerCase());
  if (exists) return;

  state.customTopics.push(topic);
  state.topics[topic] = false;
  state.topicNotes[topic] = '';

  renderTopics();
  renderDashboardTopics();
  updateRing();
  scheduleSave();
}

function addCustomTopic() {
  const inp = document.getElementById('new-topic-inp');
  const val = inp ? inp.value.trim() : '';

  if (!val) return;
  addTopicValue(val);
  inp.value = '';
}

async function removeCustomTopic(topic) {
  if (TOPICS.includes(topic)) return;

  const ok = await confirm2('Remove topic "' + topic + '"?');
  if (!ok) return;
  state.archivedTopics = state.archivedTopics || [];
  state.archivedTopics.push({ topic, done: !!state.topics[topic], note: state.topicNotes[topic] || '', archivedAt: Date.now() });
  state.customTopics = state.customTopics.filter(t => t !== topic);
  delete state.topics[topic];
  delete state.topicNotes[topic];
  renderTopics();
  renderDashboardTopics();
  updateRing();
  scheduleSave();
}

async function removeCustomTopic(topic) {
  if (TOPICS.includes(topic)) return;
  const ok = await confirm2('Remove topic "' + topic + '"?');
  if (!ok) return;
  state.customTopics = state.customTopics.filter(t => t !== topic);
  delete state.topics[topic];
  delete state.topicNotes[topic];

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
      <div class="arch-note-title">${escH(item.topic)}</div>
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
  state.customTopics.push(item.topic);
  state.topics[item.topic]     = item.done || false;
  state.topicNotes[item.topic] = item.note || '';
  closeArchiveModal();
  renderTopics();
  renderDashboardTopics();
  updateRing();
  scheduleSave();
}

function toggleTopicNote(topic) {
  const row = document.getElementById('topic-row-' + safeId(topic));
  if (!row) return;

  row.classList.toggle('open');

  if (row.classList.contains('open')) {
    const ta = row.querySelector('textarea');
    if (ta) setTimeout(() => ta.focus(), 30);
  }
}

function updateTopicNote(topic, value) {
  state.topicNotes[topic] = value;
  renderDashboardTopics();
  scheduleSave();
}

function expandAllTopicNotes() {
  document.querySelectorAll('.topic-row').forEach(row => row.classList.add('open'));
}

function collapseAllTopicNotes() {
  document.querySelectorAll('.topic-row').forEach(row => row.classList.remove('open'));
}

function updateRing() {
  const allTopics = getAllTopics();
  const done = allTopics.filter(t => state.topics[t]).length;
  const total = allTopics.length;
  const pct = total ? done / total : 0;
  const circ = 144.5;
  const offset = circ - pct * circ;

  const arc = document.getElementById('ring-arc');
  const frac = document.getElementById('ring-frac');
  const rpct = document.getElementById('ring-pct');

  if (arc) arc.setAttribute('stroke-dashoffset', offset.toFixed(1));
  if (frac) frac.textContent = done + ' / ' + total;
  if (rpct) rpct.textContent = Math.round(pct * 100) + '% done';
}

// ── Chart ─────────────────────────────────────────────────
function getChartPoints() {
  return [
    ...SHELF_SCORES,
    ...(state.nbmeScores || []).map(s => ({ date: s.date, label: s.form, score: s.score })),
    ...(state.cmsScores || []).map(s => ({ date: s.date, label: s.name, score: s.score }))
  ]
    .filter(p => p.date && !isNaN(Number(p.score)))
    .sort((a,b) => new Date(a.date) - new Date(b.date));
}

function runningAverage(points) {
  let sum = 0;

  return points.map((p, i) => {
    sum += Number(p.score) || 0;
    return Math.round((sum / (i + 1)) * 10) / 10;
  });
}

function renderChart() {
  const ctx = document.getElementById('shelf-chart');
  if (!ctx) return;

  const allPoints = getChartPoints();
  const labels = allPoints.map(p => p.label);
  const scores = allPoints.map(p => Number(p.score));
  const colors = scores.map(s => s >= GOAL_SCORE ? '#5B8A5B' : s >= 80 ? '#C9913A' : '#CC5028');
  const avgArr = runningAverage(allPoints);

  const latest = scores.length ? scores[scores.length - 1] : '–';
  const avg = scores.length ? Math.round((scores.reduce((a,b)=>a+b,0) / scores.length) * 10) / 10 : '–';
  const best = scores.length ? Math.max(...scores) : '–';

  setText('score-latest', latest);
  setText('score-avg', avg);
  setText('score-best', best);

  if (shelfChart) {
    shelfChart.destroy();
    shelfChart = null;
  }

  Chart.defaults.color = '#584F3C';
  Chart.defaults.font.family = "'JetBrains Mono', monospace";
  Chart.defaults.font.size = 11;

  shelfChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Score',
          data: scores,
          borderColor: '#C9913A',
          backgroundColor: 'transparent',
          pointBackgroundColor: colors,
          pointBorderColor: colors,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 1.5,
          tension: 0.2,
        },
        {
          label: 'Average',
          data: avgArr,
          borderColor: '#4779A3',
          backgroundColor: 'transparent',
          pointBackgroundColor: '#4779A3',
          pointBorderColor: '#4779A3',
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 1.6,
          tension: 0.25,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1A1710',
          borderColor: '#2C2820',
          borderWidth: 1,
          titleColor: '#EEE6CE',
          bodyColor: '#9B9078',
          callbacks: {
            label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#2C2820', drawBorder: false },
          ticks: { color: '#584F3C', maxRotation: 30 }
        },
        y: {
          grid: { color: '#2C2820', drawBorder: false },
          ticks: { color: '#584F3C' },
          min: scores.length ? Math.max(0, Math.min(...scores, ...avgArr) - 10) : 0,
          max: scores.length ? Math.min(100, Math.max(...scores, ...avgArr) + 5) : 100,
        }
      }
    }
  });
}

// ── Resources ─────────────────────────────────────────────
function renderResources() {
  const container = document.getElementById('res-list');
  if (!container) return;
  container.innerHTML = '';
  (state.resources || []).forEach((res, i) => {
    const div = document.createElement('div');
    div.className = 'resource-item';
    div.innerHTML = `<div class="res-name">${escH(res)}</div><button class="res-del" onclick="removeResource(${i})" title="Remove">×</button>`;
    container.appendChild(div);
  });

  // Badge
  const badge = document.getElementById('res-arch-badge');
  if (badge) {
    const count = (state.archivedResources || []).length;
    badge.textContent = count;
    badge.style.display = count ? 'inline-flex' : 'none';
  }
}

function toggleResource(i) {
  if (!state.resources[i]) return;
  state.resources[i].done = !state.resources[i].done;
  renderResources();
  scheduleSave();
}

function addResource() {
  const inp = document.getElementById('new-res-inp');
  const val = inp ? inp.value.trim() : '';

  if (!val) return;

  state.resources.push(val);
  inp.value = '';

  renderResources();
  scheduleSave();
}

async function removeResource(i) {
  const ok = await confirm2('Remove "' + state.resources[i] + '"?');
  if (!ok) return;
  state.resources.splice(i, 1);
  renderResources();
  scheduleSave();
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
    const scoreClass = sc >= 260 ? 'tag-green' : sc >= 240 ? 'tag-amber' : 'tag-red';
    div.innerHTML = `
      <div class="ae-name">${escH(s.form)}</div>
      <span class="tag ${scoreClass}">${s.score}</span>
      <div class="ae-date">${s.date ? fmtCalDate(s.date) : ''}</div>
      <button class="ae-del" onclick="removeNBME(${i})" title="Remove">×</button>
    `;
    container.appendChild(div);
  });
}

function addNBMEScore() {
  const form = document.getElementById('nbme-form-sel').value;
  const score = parseInt(document.getElementById('nbme-score-inp').value);
  const date = document.getElementById('nbme-date-inp').value;

  if (!form || isNaN(score)) return;

  state.nbmeScores.push({ form, score, date });
  state.nbmeScores.sort((a,b) => (a.date || '') < (b.date || '') ? -1 : 1);
  document.getElementById('nbme-form-inp').value  = '';
  document.getElementById('nbme-score-inp').value = '';
  document.getElementById('nbme-date-inp').value  = '';
  renderNBME();
  renderChart();
  scheduleSave();
}

async function removeNBME(i) {
  const ok = await confirm2('Remove this NBME score?');
  if (!ok) return;
  state.nbmeScores.splice(i, 1);
  renderNBME();
  renderChart();
  scheduleSave();
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
      <div class="ae-date">${s.date ? fmtCalDate(s.date) : ''}</div>
      <button class="ae-del" onclick="removeCMS(${i})" title="Remove">×</button>
    `;
    container.appendChild(div);
  });
}

function addCMSScore() {
  const name = document.getElementById('cms-name-inp').value.trim();
  const score = parseFloat(document.getElementById('cms-score-inp').value);
  const date = document.getElementById('cms-date-inp').value;

  if (!name || isNaN(score)) return;

  state.cmsScores.push({ name, score, date });

  document.getElementById('cms-name-inp').value = '';
  document.getElementById('cms-score-inp').value = '';
  document.getElementById('cms-date-inp').value  = '';
  renderCMS(); renderChart(); scheduleSave();
}

async function removeCMS(i) {
  const ok = await confirm2('Remove this score?');
  if (!ok) return;
  state.cmsScores.splice(i, 1);
  renderCMS();
  renderChart();
  scheduleSave();
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
    block.className = 'session-block';
    block.id = 'sess-' + si;
    const isOpen = !!sess.open;
    block.innerHTML = `
      <div class="session-hdr ${isOpen ? 'open' : ''}" onclick="toggleSession(${si})">
        <div class="sess-title">${escH(sess.title || 'Session ' + (si+1))}</div>
        <div class="sess-right">
          <span class="tag tag-ghost">${(sess.entries||[]).length} missed</span>
          <span class="sess-toggle">▾</span>
        </div>
      </div>
      <div class="session-body ${isOpen ? 'open' : ''}" id="sess-body-${si}">
        ${renderEntriesHTML(si, sess.entries || [])}
        <div class="mq-add-btn-row">
          <button class="btn btn-ghost btn-sm" onclick="addMissedEntry(${si})">+ Add question</button>
          <button class="btn btn-danger btn-sm" style="margin-left:6px" onclick="removeSession(${si})">Remove session</button>
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
        <span class="mq-topic">${escH(e.topic || '')}</span>
        <span class="tag tag-ghost" style="font-size:.58rem">${escH((e.topic || '').toUpperCase())}</span>
        <button onclick="removeMissedEntry(${si},${ei})" style="margin-left:auto;background:transparent;border:none;color:var(--text-tertiary);font-size:.8rem;cursor:pointer">×</button>
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
  const container = document.getElementById('entry-form-' + si);
  if (!container) return;
  container.style.display = 'block';
  container.innerHTML = `
    <div class="inline-entry-form">
      <div class="form-row">
        <div style="flex:1">
          <label>Topic</label>
          <input class="input" id="ef-topic-${si}" placeholder="e.g. Thyroid storm">
        </div>
        <div style="flex:1">
          <label>Source</label>
          <input class="input" id="ef-source-${si}" placeholder="e.g. NBME 14, UWorld">
        </div>
      </div>
      <div class="form-row stack">
        <label>Why did you miss it?</label>
        <textarea class="input" id="ef-why-${si}" placeholder="Thought it was X, didn't recognize Y…"></textarea>
      </div>
      <div class="form-row stack">
        <label>Correct thinking / what to remember</label>
        <textarea class="input" id="ef-correct-${si}" placeholder="The key is…"></textarea>
      </div>
      <div class="form-actions">
        <button class="btn btn-ghost btn-sm" onclick="hideEntryForm(${si})">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="submitEntryForm(${si})">Save</button>
      </div>
    </div>
  `;
  document.getElementById('ef-topic-' + si).focus();
}

function hideEntryForm(si) {
  const container = document.getElementById('entry-form-' + si);
  if (container) { container.style.display = 'none'; container.innerHTML = ''; }
}

function submitEntryForm(si) {
  const topic   = (document.getElementById('ef-topic-'   + si) || {}).value || '';
  const source  = (document.getElementById('ef-source-'  + si) || {}).value || '';
  const why     = (document.getElementById('ef-why-'     + si) || {}).value || '';
  const correct = (document.getElementById('ef-correct-' + si) || {}).value || '';
  if (!topic.trim()) return;
  if (!state.missedSessions[si].entries) state.missedSessions[si].entries = [];
  state.missedSessions[si].entries.push({ topic: topic.trim(), source: source.trim(), why: why.trim(), correct: correct.trim() });
  hideEntryForm(si);
  renderMissedSessions();
  scheduleSave();
}

function toggleSession(i) {
  state.missedSessions[i].open = !state.missedSessions[i].open;
  renderMissedSessions();
}

function addMissedSession() {
  const title = prompt('Session title:');
  if (title === null) return;

  state.missedSessions.push({ title: title || 'Session', entries: [], open: true });
  renderMissedSessions();
  scheduleSave();
}

async function removeSession(i) {
  const ok = await confirm2('Remove session "' + state.missedSessions[i].title + '" and all entries?');
  if (!ok) return;
  state.missedSessions.splice(i, 1);
  renderMissedSessions();
  scheduleSave();
}

function addMissedEntry(si) {
  const topic = prompt('Topic:');
  if (topic === null) return;

  const why = prompt('Why did you miss it?');
  if (why === null) return;

  const correct = prompt('Correct thinking / what to remember:');
  if (correct === null) return;

  if (!state.missedSessions[si].entries) state.missedSessions[si].entries = [];

  state.missedSessions[si].entries.push({ topic: topic.trim(), why, correct });
  renderMissedSessions();
  scheduleSave();
}

async function removeMissedEntry(si, ei) {
  const ok = await confirm2('Remove this missed question entry?');
  if (!ok) return;
  state.missedSessions[si].entries.splice(ei, 1);
  renderMissedSessions();
  scheduleSave();
}

// ── Notes ─────────────────────────────────────────────────
function renderNotes() {
  const container = document.getElementById('notes-container');
  if (!container) return;
  container.innerHTML = '';
  const badge    = document.getElementById('arch-badge');
  const archCount = (state.archivedNotes || []).length;
  if (badge) { badge.textContent = archCount; badge.style.display = archCount ? 'inline-flex' : 'none'; }
  if (!(state.notes || []).length) {
    container.innerHTML = '<div style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-tertiary);padding:1rem 0">No notes yet. Click + New Note to start.</div>';
    return;
  }
  state.notes.forEach((note, i) => container.appendChild(buildNoteCard(note, i)));
}

function buildNoteCard(note, i) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.id = 'note-' + i;
  card.innerHTML = `
    <div class="note-hdr">
      <div class="note-dot saved" id="ndot-${i}"></div>
      <input class="note-title-inp" placeholder="Note title…" value="${escH(note.title || '')}" oninput="noteFieldChange(${i},'title',this.value)">
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
      <button class="fmt-btn" onclick="fmtNote(${i},'insertOrderedList')">1. List</button>
      <div class="tb-sep"></div>
      <div class="clr-dot" style="background:#EEE6CE" onclick="fmtNoteColor(${i},'#EEE6CE')" title="Default"></div>
      <div class="clr-dot" style="background:#E4AA56" onclick="fmtNoteColor(${i},'#E4AA56')" title="Amber"></div>
      <div class="clr-dot" style="background:#6EA8D4" onclick="fmtNoteColor(${i},'#6EA8D4')" title="Blue"></div>
      <div class="clr-dot" style="background:#7DB87D" onclick="fmtNoteColor(${i},'#7DB87D')" title="Green"></div>
      <div class="clr-dot" style="background:#E07060" onclick="fmtNoteColor(${i},'#E07060')" title="Red"></div>
    </div>
    <div class="note-editor" id="editor-${i}" contenteditable="true" placeholder="Start writing…" onkeydown="noteKeyDown(event,${i})" oninput="noteFieldChange(${i},'body',document.getElementById('editor-${i}').innerHTML)">${note.body || ''}</div>
  `;
  return card;
}

function addNote() {
  state.notes.unshift({ title: '', body: '', created: Date.now() });
  renderNotes();
  const firstInp = document.querySelector('.note-title-inp');
  if (firstInp) firstInp.focus();
  scheduleSave();
}

function noteFieldChange(i, field, val) {
  if (!state.notes[i]) return;
  state.notes[i][field] = val;
  const dot = document.getElementById('ndot-' + i);
  if (dot) dot.className = 'note-dot saving';
  scheduleSave();
  setTimeout(() => { const d = document.getElementById('ndot-' + i); if (d) d.className = 'note-dot saved'; }, 1600);
}

function noteKeyDown(e, i) {
  const isMeta = e.metaKey || e.ctrlKey;
  if (!isMeta) return;

  const cmds = { b:'bold', i:'italic', u:'underline' };

  if (cmds[e.key]) {
    e.preventDefault();
    fmtNote(i, cmds[e.key]);
  }
}

function fmtNote(i, cmd) {
  const ed = document.getElementById('editor-' + i);
  if (!ed) return;
  ed.focus();
  document.execCommand(cmd, false, null);
  noteFieldChange(i, 'body', ed.innerHTML);
}

function fmtNoteColor(i, color) {
  const ed = document.getElementById('editor-' + i);
  if (!ed) return;
  ed.focus();
  document.execCommand('foreColor', false, color);
  noteFieldChange(i, 'body', ed.innerHTML);
}

async function deleteNote(i) {
  const ok = await confirm2('Delete this note permanently?');
  if (!ok) return;
  state.notes.splice(i, 1);
  renderNotes();
  scheduleSave();
}

function archiveNote(i) {
  state.archivedNotes.push({ ...state.notes[i], archivedAt: Date.now() });
  state.notes.splice(i, 1);
  renderNotes(); scheduleSave();
}

// ── Archive Modal (shared) ────────────────────────────────
function openArchiveModal() {
  const modal = document.getElementById('arch-modal');
  if (!modal) return;

  const list = document.getElementById('arch-list');
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
      <div class="arch-note-title">${escH(note.title || 'Untitled')}</div>
      <div style="font-size:.78rem;color:var(--text-tertiary);font-family:var(--font-mono);margin-bottom:.3rem">${new Date(note.archivedAt || 0).toLocaleDateString()}</div>
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

function restoreNote(i) {
  const note = state.archivedNotes.splice(i, 1)[0];
  delete note.archivedAt;
  state.notes.unshift(note);
  closeArchiveModal(); renderNotes(); scheduleSave();
}

async function deleteArchivedNote(i) {
  const ok = await confirm2('Permanently delete archived note "' + (state.archivedNotes[i].title || 'Untitled') + '"?');
  if (!ok) return;
  state.archivedNotes.splice(i, 1);
  closeArchiveModal(); openArchiveModal(); renderNotes(); scheduleSave();
}

// ── Suggestions ───────────────────────────────────────────
function renderSuggestions() {
  const container = document.getElementById('suggestions-list');
  if (!container) return;
  container.innerHTML = '';
  if (!(state.suggestions || []).length) {
    container.innerHTML = '<div style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-tertiary)">No suggestions yet</div>';
    return;
  }
  state.suggestions.forEach((s, i) => {
    const card = document.createElement('div');
    card.className = 'suggestion-card' + (s.status === 'done' ? ' done' : '');
    card.innerHTML = `
      <div class="suggestion-head">
        <input class="suggestion-title-inp" value="${escH(s.title||'')}" placeholder="Suggestion title…" oninput="updateSuggestion(${i},'title',this.value)">
        <button class="suggestion-del" onclick="deleteSuggestion(${i})">×</button>
      </div>
      <textarea class="input suggestion-body" placeholder="Details…" oninput="updateSuggestion(${i},'body',this.value)">${escH(s.body||'')}</textarea>
      <div class="suggestion-actions">
        <span class="tag ${s.status==='done'?'tag-green':'tag-blue'}">${s.status||'idea'}</span>
        <button class="btn btn-ghost btn-xs" onclick="toggleSuggestionStatus(${i})">${s.status==='done'?'Reopen':'Mark done'}</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function addSuggestion() {
  const inp   = document.getElementById('new-suggestion-title');
  const title = inp ? inp.value.trim() : '';
  if (!title) return;
  state.suggestions.unshift({ id: uid(), title, body:'', status:'idea' });
  inp.value = '';
  renderSuggestions(); scheduleSave();
}

function updateSuggestion(i, field, value) {
  if (!state.suggestions[i]) return;
  state.suggestions[i][field] = value;
  scheduleSave();
}

// ── Suggestions ───────────────────────────────────────────
function renderSuggestions() {
  const container = document.getElementById('suggestions-list');
  if (!container) return;

  container.innerHTML = '';

  if (!(state.suggestions || []).length) {
    container.innerHTML = '<div class="suggestion-empty">No suggestions yet</div>';
    return;
  }

  state.suggestions.forEach((s, i) => {
    const card = document.createElement('div');

    card.className = 'suggestion-card' + (s.status === 'done' ? ' done' : '');

    card.innerHTML = `
      <div class="suggestion-head">
        <input class="suggestion-title" value="${escH(s.title || '')}" placeholder="Suggestion title…" oninput="updateSuggestion(${i}, 'title', this.value)">
        <button class="suggestion-del" onclick="deleteSuggestion(${i})">×</button>
      </div>
      <textarea class="input suggestion-body" placeholder="Details…" oninput="updateSuggestion(${i}, 'body', this.value)">${escH(s.body || '')}</textarea>
      <div class="suggestion-actions">
        <span class="tag ${s.status === 'done' ? 'tag-green' : 'tag-blue'}">${s.status || 'idea'}</span>
        <button class="btn btn-ghost btn-xs" onclick="toggleSuggestionStatus(${i})">${s.status === 'done' ? 'Reopen' : 'Mark done'}</button>
      </div>
    `;

    container.appendChild(card);
  });
}

function addSuggestion() {
  const inp = document.getElementById('new-suggestion-title');
  const title = inp ? inp.value.trim() : '';

  if (!title) return;

  state.suggestions.unshift({ title, body:'', status:'idea' });
  inp.value = '';

  renderSuggestions();
  scheduleSave();
}

function updateSuggestion(i, field, value) {
  if (!state.suggestions[i]) return;

  state.suggestions[i][field] = value;
  scheduleSave();
}

function toggleSuggestionStatus(i) {
  if (!state.suggestions[i]) return;

  state.suggestions[i].status = state.suggestions[i].status === 'done' ? 'idea' : 'done';

  renderSuggestions();
  scheduleSave();
}

async function deleteSuggestion(i) {
  const ok = await confirm2('Delete this suggestion?');
  if (!ok) return;

  state.suggestions.splice(i, 1);

  renderSuggestions();
  scheduleSave();
}

// ── Command Palette ───────────────────────────────────────
let cmdSelectedIdx = -1;

function openCmdPalette() {
  const ov = document.getElementById('cmd-ov');
  if (!ov) return;
  ov.classList.add('open');
  const inp = document.getElementById('cmd-input');
  inp.value = '';
  inp.focus();
  renderCmds('');
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
  res.innerHTML = '';
  cmdSelectedIdx = -1;

  const tabs = [
    { ico:'🏠', lbl:'Dashboard',   meta:'Tab', action:()=>{ showTab('dashboard'); closeCmdPalette(); }},
    { ico:'📋', lbl:'Topic List',  meta:'Tab', action:()=>{ showTab('topics'); closeCmdPalette(); }},
    { ico:'📊', lbl:'Assessments', meta:'Tab', action:()=>{ showTab('assessments'); closeCmdPalette(); }},
    { ico:'❌', lbl:'Missed Qs',   meta:'Tab', action:()=>{ showTab('missed'); closeCmdPalette(); }},
    { ico:'📝', lbl:'Notes',       meta:'Tab', action:()=>{ showTab('notes'); closeCmdPalette(); }},
    { ico:'🧠', lbl:'Suggestions', meta:'Tab', action:()=>{ showTab('suggestions'); closeCmdPalette(); }},
  ];

  const noteItems = (state.notes||[]).map((n,i) => ({
    ico:'📄', lbl: n.title || 'Untitled note', meta:'Note',
    action: () => {
      showTab('notes');
      closeCmdPalette();
      setTimeout(() => {
        const el = document.getElementById('note-' + i);
        if (el) el.scrollIntoView({behavior:'smooth'});
      }, 200);
    }
  }));

  const actions = [
    { ico:'✅', lbl:'+ New Note',           meta:'Action', action:()=>{ showTab('notes'); closeCmdPalette(); addNote(); }},
    { ico:'➕', lbl:'+ New Missed Session', meta:'Action', action:()=>{ showTab('missed'); closeCmdPalette(); addMissedSession(); }},
    { ico:'📅', lbl:'+ Calendar Item',      meta:'Action', action:()=>{ showTab('dashboard'); closeCmdPalette(); document.getElementById('calendar-name-inp')?.focus(); }},
    { ico:'🎯', lbl:'+ Weak Spot',          meta:'Action', action:()=>{ showTab('dashboard'); closeCmdPalette(); document.getElementById('dash-topic-inp')?.focus(); }},
    { ico:'🧠', lbl:'+ Suggestion',         meta:'Action', action:()=>{ showTab('suggestions'); closeCmdPalette(); document.getElementById('new-suggestion-title')?.focus(); }},
  ];

  const allItems = [...tabs, ...noteItems, ...actions];
  const filtered = q ? allItems.filter(it => it.lbl.toLowerCase().includes(q)) : allItems;

  if (!filtered.length) {
    res.innerHTML = '<div id="cmd-empty">No results for "' + escH(q) + '"</div>';
    return;
  }

  const groups = {};
  filtered.forEach(it => { if (!groups[it.meta]) groups[it.meta] = []; groups[it.meta].push(it); });
  Object.entries(groups).forEach(([grp, items]) => {
    const gl = document.createElement('div');
    gl.className = 'cmd-grp';
    gl.textContent = grp;
    res.appendChild(gl);
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'cmd-res';
      div.innerHTML = `<span class="cmd-res-ico">${it.ico}</span><span class="cmd-res-lbl">${escH(it.lbl)}</span><span class="cmd-res-meta">${it.meta}</span>`;
      div.onclick = it.action;
      div.addEventListener('mouseenter', () => {
        document.querySelectorAll('.cmd-res').forEach(r => r.classList.remove('sel'));
        div.classList.add('sel');
      });
      res.appendChild(div);
    });
  });
}

function cmdKey(e) {
  const items = document.querySelectorAll('.cmd-res');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    cmdSelectedIdx = Math.min(cmdSelectedIdx + 1, items.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    cmdSelectedIdx = Math.max(cmdSelectedIdx - 1, 0);
  } else if (e.key === 'Enter') {
    const sel = items[cmdSelectedIdx] || items[0];
    if (sel) sel.click();
    return;
  } else if (e.key === 'Escape') {
    closeCmdPalette();
    return;
  } else {
    return;
  }

  items.forEach((r,i) => r.classList.toggle('sel', i === cmdSelectedIdx));

  if (items[cmdSelectedIdx]) {
    items[cmdSelectedIdx].scrollIntoView({ block:'nearest' });
  }
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
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function jsStr(str) {
  return JSON.stringify(String(str || ''));
}

function safeId(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}


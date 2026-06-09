// ============================================================
// STEP 2 DASHBOARD — APP LOGIC + GOOGLE DRIVE SYNC
// ============================================================

const SCOPES = 'https://www.googleapis.com/auth/documents';

const TOPICS = []; // All topics are user-managed; seeded from data on first load

// ── Priority badge helper — used by renderTopics and renderWeakSpots ──
function prioBadge(prio, size) {
  const map = {
    high:   ['HIGH', '#FCEBEB', '#A32D2D', '#F09595'],
    medium: ['MED',  '#FAEEDA', '#633806', '#EF9F27'],
    low:    ['LOW',  'var(--bg-elevated)', 'var(--text-tertiary)', 'var(--border)'],
  };
  const m = map[prio];
  if (!m) return '';
  const [label, bg, color, border] = m;
  if (size === 'small') {
    return `<span style="font-family:var(--font-mono);font-size:.5rem;padding:0 4px;border-radius:3px;background:${bg};color:${color};flex-shrink:0">${label[0]}</span>`;
  }
  return `<span style="font-family:var(--font-mono);font-size:.55rem;padding:1px 6px;border-radius:10px;background:${bg};color:${color};border:1px solid ${border};flex-shrink:0">${label}</span>`;
}

function pctToPriority(pct) {

  if (pct <= 60) return 'high';

  if (pct <= 70) return 'medium';

  return 'low';

}

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
let currentToken      = null;  // replaces gapi.client token — set on login/restore
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

  // Check for a saved valid token immediately — before any network calls.
  // If found, show the app right away; gapi.load runs in background for token refresh machinery.
  const savedToken  = localStorage.getItem('goog_token');
  const savedExpiry = parseInt(localStorage.getItem('goog_token_exp') || '0');
  const hasValidToken = savedToken && Date.now() < savedExpiry;

  if (hasValidToken) {
    // Show app instantly — no waiting for gapi or discovery doc
    currentToken = savedToken;
    showApp();
  }

  gapi.load('client', async () => {
    // Skip discoveryDocs — we use fetch() for Docs API calls directly,
    // so we don't need gapi.client.init() to fetch the discovery document.
    // This removes the blocking googleapis.com round-trip on every page load.
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) { console.log('GIS:', resp.error); return; }
        currentToken = resp.access_token;
        localStorage.setItem('goog_token', currentToken);
        localStorage.setItem('goog_token_exp', Date.now() + 55 * 60 * 1000);
        if (!hasValidToken) showApp(); // only call showApp if we didn't already
      }
    });

    if (hasValidToken) {
      // Schedule silent refresh before expiry
      const msLeft = savedExpiry - Date.now();
      setTimeout(() => tokenClient.requestAccessToken({ prompt:'none' }), Math.max(0, msLeft - 2 * 60 * 1000));
    } else {
      // No valid saved token — show sign-in screen
      localStorage.removeItem('goog_token');
      localStorage.removeItem('goog_token_exp');
      document.getElementById('auth-screen').style.display = 'flex';
    }
  });
};

async function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  await loadFromDrive();
  normalizeState();
  renderAll();
  initSpotify(); // run once on load — not inside renderAll
  // Auto-refresh token every 55 min while app is open
  setInterval(() => tokenClient.requestAccessToken({ prompt:'none' }), 55 * 60 * 1000);
  // Init pomodoro header display (needs header widgets injected by renderAll first)
  setTimeout(initPomDisplay, 100);
}

window.handleSignIn = function () {
  if (!tokenClient) {
    console.warn('Google sign-in is not ready yet.');
    return;
  }
  tokenClient.requestAccessToken({ prompt: '' });
};

window.handleSignOut = function () {
  currentToken = null;
  localStorage.removeItem('goog_token');
  localStorage.removeItem('goog_token_exp');
  document.getElementById('app').classList.remove('visible');
  document.getElementById('auth-screen').style.display = 'flex';
};

function wireAuthButtons() {
  document.getElementById('sign-in-btn')?.addEventListener('click', window.handleSignIn);
  document.getElementById('sign-out-btn')?.addEventListener('click', window.handleSignOut);
}

wireAuthButtons();

// ── Drive Sync ────────────────────────────────────────────
async function loadFromDrive() {
  if (!currentToken) return;
  try {
    const resp = await fetch(
      `https://docs.googleapis.com/v1/documents/${DOC_ID}`,
      { headers: { Authorization: `Bearer ${currentToken}` } }
    );
    if (!resp.ok) { console.warn('Load error:', resp.status); return; }
    const doc = await resp.json();
    let text = '';
    for (const el of (doc.body.content || [])) {
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
  if (!currentToken) return;
  try {
    // 1. GET current doc to find last index
    const getResp = await fetch(
      `https://docs.googleapis.com/v1/documents/${DOC_ID}`,
      { headers: { Authorization: `Bearer ${currentToken}` } }
    );
    if (!getResp.ok) { setSaveDot('error'); return; }
    const doc = await getResp.json();
    const lastIndex = (doc.body.content || []).reduce(
      (m, el) => el.endIndex ? Math.max(m, el.endIndex) : m, 1);

    // 2. batchUpdate: delete existing content + insert new
    const requests = [];
    if (lastIndex > 1)
      requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: lastIndex - 1 } } });
    requests.push({ insertText: { location: { index: 1 }, text: JSON.stringify(state) } });

    const saveResp = await fetch(
      `https://docs.googleapis.com/v1/documents/${DOC_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
      }
    );
    if (!saveResp.ok) { setSaveDot('error'); return; }
    setSaveDot('saved');
    const lbl = document.getElementById('save-lbl');
    if (lbl) lbl.textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

// ── Runtime UI Injection ──────────────────────────────────
function injectAppRefinements() {
  injectSpotifyTab();
  injectAdvisor();
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
  // Refresh playlists + pin right-card height when Focus tab is opened
  if (tab === 'focus') {
    if (spToken) fetchSpotifyPlaylists();
    if (typeof syncFocusCardHeights === 'function') {
      requestAnimationFrame(syncFocusCardHeights);
    }
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
  // pe-modal is static in index.html — just populate and open
  renderPracticeExamModal();
  document.getElementById('pe-modal').classList.add('open');
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
    const badge = prioBadge(prio, 'small');
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

  const all = [...(state.topics || [])];

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
    const prioBadgeHtml = prioBadge(prio);
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
      ${prioBadgeHtml}
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
  renderTopics(); renderWeakSpots(); scheduleSave();
}

function sortTopicsByPriority() {
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
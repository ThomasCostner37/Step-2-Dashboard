// ============================================================
// STEP 2 DASHBOARD — APP LOGIC + GOOGLE DRIVE SYNC
// ============================================================

const SCOPES   = 'https://www.googleapis.com/auth/documents';
const TOPICS   = ['ob','frepro','resp','cardio','endo','multi','blood','cns','gi','beh','bio','msk'];
const NBME_FORMS = ['Form 9','Form 10','Form 11','Form 12','Form 13','Form 14','Form 15','Form 16'];
const CSSE_DATE  = '2026-06-12';
const STEP2_DATE = '2026-08-12';
const GOAL_SCORE = 90; // shelf exam goal %

const SHELF_SCORES = [
  { date:'2025-08-12', label:'FM Shelf 1',      score:82 },
  { date:'2025-09-12', label:'FM Shelf 2',      score:87 },
  { date:'2025-10-06', label:'Peds Shelf 1',    score:87 },
  { date:'2025-10-31', label:'Peds Shelf 2',    score:87 },
  { date:'2025-11-12', label:'Surgery Shelf 1', score:75 },
  { date:'2025-12-19', label:'Surgery Shelf 2', score:83 },
  { date:'2026-02-13', label:'Psych Shelf 1',   score:94 },
  { date:'2026-03-20', label:'Psych Shelf 2',   score:94 },
];

// ── State ─────────────────────────────────────────────────
let state = {
  topics:         Object.fromEntries(TOPICS.map(t => [t, false])),
  customTopics:   [],
  resources:      [],
  nbmeScores:     [],
  cmsScores:      [],
  missedSessions: [],
  notes:          [],
  archivedNotes:  [],
  todayFocus:     { date:'', items:[] },
};

// ── Google OAuth & Drive ──────────────────────────────────
// Scripts are loaded synchronously so window.onload guarantees
// both gapi and google.accounts.oauth2 are fully available.
let tokenClient;
let saveTimer = null;

window.onload = function () {
  // UI setup
  const nbmeSel = document.getElementById('nbme-form-sel');
  if (nbmeSel) NBME_FORMS.forEach(f => nbmeSel.appendChild(new Option(f, f)));
  renderFocusSelector();
  document.addEventListener('keydown', globalKeyDown);

  // Init GAPI client (for Docs API)
  gapi.load('client', async () => {
    try {
      await gapi.client.init({
        apiKey: typeof API_KEY !== 'undefined' ? API_KEY : '',
        discoveryDocs: ['https://docs.googleapis.com/$discovery/rest?version=v1']
      });
    } catch (e) {
      console.warn('gapi init (non-fatal):', e);
    }

    // Init Google Identity Services token client
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (resp) => {
        if (resp.error) {
          // Silent attempt failed — show sign-in button, do nothing
          console.log('GIS:', resp.error);
          return;
        }
        gapi.client.setToken({ access_token: resp.access_token });
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app').classList.add('visible');
        await loadFromDrive();
        renderAll();
      }
    });

    // Try silent sign-in first (works if user was signed in before)
    setTimeout(() => tokenClient.requestAccessToken({ prompt: 'none' }), 100);
  });
};

function handleSignIn() {
  tokenClient.requestAccessToken({ prompt: '' });
}

function handleSignOut() {
  gapi.client.setToken(null);
  document.getElementById('app').classList.remove('visible');
  document.getElementById('auth-screen').style.display = 'flex';
}

// ── Drive: Load ───────────────────────────────────────────
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
      // Merge preserving all keys (backward compat)
      state = Object.assign({}, state, loaded);
      // Ensure todayFocus exists
      if (!state.todayFocus) state.todayFocus = { date:'', items:[] };
      // Ensure customTopics exists
      if (!state.customTopics) state.customTopics = [];
      // Merge any new base topics not in saved state
      TOPICS.forEach(t => { if (!(t in state.topics)) state.topics[t] = false; });
    }
  } catch(e) { console.warn('Load error:', e); }
}

// ── Drive: Save ───────────────────────────────────────────
function scheduleSave() {
  setSaveDot('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToDrive, 1400);
}

async function saveToDrive() {
  if (!gapi.client.getToken()) return;
  try {
    const doc = await gapi.client.docs.documents.get({ documentId: DOC_ID });
    const lastIndex = doc.result.body.content.reduce((m, el) => el.endIndex ? Math.max(m, el.endIndex) : m, 1);
    const requests = [];
    if (lastIndex > 1) requests.push({ deleteContentRange:{ range:{ startIndex:1, endIndex:lastIndex-1 }}});
    requests.push({ insertText:{ location:{ index:1 }, text: JSON.stringify(state) }});
    await gapi.client.docs.documents.batchUpdate({ documentId: DOC_ID, resource:{ requests }});
    setSaveDot('saved');
    document.getElementById('save-lbl').textContent = 'Saved ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  } catch(e) {
    console.error('Save error:', e);
    setSaveDot('error');
  }
}

function setSaveDot(state) {
  const dot = document.getElementById('save-dot');
  dot.className = '';
  if (state === 'saving') { dot.classList.add('saving'); document.getElementById('save-lbl').textContent = 'Saving…'; }
  else if (state === 'saved') { dot.classList.add('saved'); }
}

// ── Render All ────────────────────────────────────────────
function renderAll() {
  updateCountdown();
  updateRing();  
  renderFocusPanel();
  renderHeatmap();
  renderChart();
  renderTopics();
  renderResources();
  renderNBME();
  renderCMS();
  renderMissedSessions();
  renderNotes();
  renderFocusSelector();
  setInterval(updateCountdown, 60000);
}

// ── Tab Navigation ─────────────────────────────────────── 
function showTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('btn-' + tab).classList.add('active');
}

// ── Global Key Shortcuts ──────────────────────────────────
function globalKeyDown(e) {
  const isMeta = e.metaKey || e.ctrlKey;
  // ⌘1-5 tab switching
  if (isMeta && !e.shiftKey && !e.altKey) {
    const tabs = ['dashboard','topics','assessments','missed','notes'];
    const n = parseInt(e.key) - 1;
    if (n >= 0 && n < tabs.length) { e.preventDefault(); showTab(tabs[n]); return; }
    // ⌘K command palette
    if (e.key === 'k') { e.preventDefault(); openCmdPalette(); return; }
  }
  // ESC
  if (e.key === 'Escape') {
    closeCmdPalette();
    closeArchiveModal();
    confirmResolve(false);
  }
}

// ── Countdown ─────────────────────────────────────────────
function daysUntil(dateStr) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tgt   = new Date(dateStr + 'T00:00:00');
  return Math.max(0, Math.ceil((tgt - today) / 86400000));
}

function updateCountdown() {
  const cssD  = daysUntil(CSSE_DATE);
  const stepD = daysUntil(STEP2_DATE);

  const cssEl  = document.getElementById('css-days');
  const stepEl = document.getElementById('step-days');
  const cssCard  = document.getElementById('csse-card');
  const stepCard = document.getElementById('step-card');

  if (cssEl)  cssEl.textContent  = cssD;
  if (stepEl) stepEl.textContent = stepD;

  function urgency(card, days) {
    if (!card) return;
    card.classList.remove('warn','urgent');
    if (days < 7)  card.classList.add('urgent');
    else if (days < 14) card.classList.add('warn');
  }
  urgency(cssCard,  cssD);
  urgency(stepCard, stepD);
}

// ── Chart ─────────────────────────────────────────────────
let shelfChart = null;
function renderChart() {
  const ctx = document.getElementById('shelf-chart');
  if (!ctx) return;

  // Combine shelf + NBME scores for chart
  const allPoints = [
    ...SHELF_SCORES,
    ...(state.nbmeScores || []).map(s => ({ date: s.date, label: s.form, score: s.score }))
  ].sort((a,b) => new Date(a.date) - new Date(b.date));

  const labels  = allPoints.map(p => p.label);
  const scores  = allPoints.map(p => p.score);
  const colors  = scores.map(s => s >= GOAL_SCORE ? '#5B8A5B' : s >= 80 ? '#C9913A' : '#CC5028');
  const goalArr = allPoints.map(() => GOAL_SCORE);

  if (shelfChart) { shelfChart.destroy(); shelfChart = null; }

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
          label: 'Goal',
          data: goalArr,
          borderColor: 'rgba(71,121,163,.5)',
          backgroundColor: 'transparent',
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [4, 4],
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
            label: ctx => ' Score: ' + ctx.parsed.y
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
          min: Math.max(0, Math.min(...scores) - 10),
          max: Math.min(100, Math.max(...scores, GOAL_SCORE) + 5),
        }
      }
    }
  });
}

// ── Today's Focus ─────────────────────────────────────────
function renderFocusSelector() {
  const sel = document.getElementById('focus-sel');
  if (!sel) return;
  const current = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  const allTopics = [...TOPICS, ...(state.customTopics || [])];
  allTopics.forEach(t => sel.appendChild(new Option(t, t)));
  sel.value = current;
}

function renderFocusPanel() {
  const today = new Date().toISOString().slice(0,10);
  const lbl   = document.getElementById('focus-date-lbl');
  if (lbl) lbl.textContent = new Date().toLocaleDateString([], {month:'short', day:'numeric'});

  // Auto-reset if new day
  if (state.todayFocus.date !== today) {
    state.todayFocus = { date: today, items: [] };
  }

  const container = document.getElementById('focus-items');
  if (!container) return;
  container.innerHTML = '';

  if (!state.todayFocus.items.length) {
    container.innerHTML = '<div style="font-family:var(--font-mono);font-size:.72rem;color:var(--text-tertiary);padding:.3rem 0">No topics added yet</div>';
    return;
  }

  state.todayFocus.items.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'focus-item' + (item.done ? ' done' : '');
    div.onclick = () => toggleFocusItem(i);
    div.innerHTML = `
      <div class="f-check">${item.done ? '✓' : ''}</div>
      <div class="f-lbl">${item.topic}</div>
      <button onclick="event.stopPropagation();removeFocusItem(${i})" style="background:transparent;border:none;color:var(--text-tertiary);font-size:.8rem;cursor:pointer;padding:0 3px;transition:color .15s" onmouseover="this.style.color='var(--urgent)'" onmouseout="this.style.color='var(--text-tertiary)'">×</button>
    `;
    container.appendChild(div);
  });
}

function addFocusTopic() {
  const sel = document.getElementById('focus-sel');
  const topic = sel.value;
  if (!topic) return;
  const today = new Date().toISOString().slice(0,10);
  if (state.todayFocus.date !== today) state.todayFocus = { date: today, items: [] };
  if (state.todayFocus.items.find(i => i.topic === topic)) { sel.value = ''; return; }
  state.todayFocus.items.push({ topic, done: false });
  sel.value = '';
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

// ── Heatmap ───────────────────────────────────────────────
function renderHeatmap() {
  const container = document.getElementById('heat-pills');
  if (!container) return;
  container.innerHTML = '';

  const allTopics = [...TOPICS, ...(state.customTopics || [])];
  const counts = {};
  allTopics.forEach(t => counts[t] = 0);

  (state.missedSessions || []).forEach(sess => {
    (sess.entries || []).forEach(e => {
      const t = (e.topic || '').toLowerCase().trim();
      if (t in counts) counts[t]++;
      else counts[t] = (counts[t] || 0) + 1;
    });
  });

  allTopics.forEach(topic => {
    const n = counts[topic] || 0;
    const level = n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : 3;
    const pill = document.createElement('div');
    pill.className = 'heat-pill heat-' + level;
    pill.textContent = topic;
    pill.title = n + ' missed question' + (n !== 1 ? 's' : '');
    container.appendChild(pill);
  });
}

// ── Progress Ring ─────────────────────────────────────────
function updateRing() {
  const allTopics = [...TOPICS, ...(state.customTopics || [])];
  const done = allTopics.filter(t => state.topics[t]).length;
  const total = allTopics.length;
  const pct = total ? done / total : 0;
  const circ = 144.5; // 2π × 23
  const offset = circ - pct * circ;

  const arc = document.getElementById('ring-arc');
  const frac = document.getElementById('ring-frac');
  const rpct = document.getElementById('ring-pct');
  if (arc)  arc.setAttribute('stroke-dashoffset', offset.toFixed(1));
  if (frac) frac.textContent = done + ' / ' + total;
  if (rpct) rpct.textContent = Math.round(pct * 100) + '% done';
}

// ── Topics ────────────────────────────────────────────────
function renderTopics() {
  const container = document.getElementById('topics-list');
  if (!container) return;
  container.innerHTML = '';
  const allTopics = [...TOPICS, ...(state.customTopics || [])];
  allTopics.forEach(topic => {
    const done = !!state.topics[topic];
    const row  = document.createElement('div');
    row.className = 'topic-row' + (done ? ' done' : '');
    row.innerHTML = `
      <div class="t-check">${done ? '✓' : ''}</div>
      <div class="topic-name">${topic}</div>
      ${!TOPICS.includes(topic) ? `<button class="topic-del" onclick="event.stopPropagation();removeCustomTopic('${topic}')" title="Remove">×</button>` : ''}
    `;
    row.onclick = () => toggleTopic(topic);
    container.appendChild(row);
  });
  updateRing();
}

function toggleTopic(topic) {
  state.topics[topic] = !state.topics[topic];
  renderTopics();
  renderHeatmap();
  scheduleSave();
}

function addCustomTopic() {
  const inp = document.getElementById('new-topic-inp');
  const val = inp.value.trim().toLowerCase();
  if (!val) return;
  if (!state.customTopics) state.customTopics = [];
  if ([...TOPICS, ...state.customTopics].includes(val)) { inp.value=''; return; }
  state.customTopics.push(val);
  if (!(val in state.topics)) state.topics[val] = false;
  inp.value = '';
  renderTopics();
  renderFocusSelector();
  scheduleSave();
}

async function removeCustomTopic(topic) {
  const ok = await confirm2('Remove topic "' + topic + '"? This cannot be undone.');
  if (!ok) return;
  state.customTopics = state.customTopics.filter(t => t !== topic);
  delete state.topics[topic];
  renderTopics();
  renderFocusSelector();
  scheduleSave();
}

// ── Resources ─────────────────────────────────────────────
function renderResources() {
  const container = document.getElementById('res-list');
  if (!container) return;
  container.innerHTML = '';
  (state.resources || []).forEach((res, i) => {
    const div = document.createElement('div');
    div.className = 'resource-item';
    div.innerHTML = `<div class="res-name">${res}</div><button class="res-del" onclick="removeResource(${i})" title="Remove">×</button>`;
    container.appendChild(div);
  });
}

function addResource() {
  const inp = document.getElementById('new-res-inp');
  const val = inp.value.trim();
  if (!val) return;
  if (!state.resources) state.resources = [];
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

// ── NBME Assessments ──────────────────────────────────────
function renderNBME() {
  const container = document.getElementById('nbme-list');
  if (!container) return;
  container.innerHTML = '';
  (state.nbmeScores || []).forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'assess-entry';
    const scoreClass = s.score >= 260 ? 'tag-green' : s.score >= 240 ? 'tag-amber' : 'tag-red';
    div.innerHTML = `
      <div class="ae-name">${s.form}</div>
      <span class="tag ${scoreClass}">${s.score}</span>
      <div class="ae-date">${s.date || ''}</div>
      <button class="ae-del" onclick="removeNBME(${i})" title="Remove">×</button>
    `;
    container.appendChild(div);
  });
}

function addNBMEScore() {
  const form  = document.getElementById('nbme-form-sel').value;
  const score = parseInt(document.getElementById('nbme-score-inp').value);
  const date  = document.getElementById('nbme-date-inp').value;
  if (!form || isNaN(score)) return;
  if (!state.nbmeScores) state.nbmeScores = [];
  state.nbmeScores.push({ form, score, date });
  state.nbmeScores.sort((a,b) => (a.date || '') < (b.date || '') ? -1 : 1);
  document.getElementById('nbme-form-sel').value = '';
  document.getElementById('nbme-score-inp').value = '';
  document.getElementById('nbme-date-inp').value = '';
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

// ── CMS / Other ────────────────────────────────────────────
function renderCMS() {
  const container = document.getElementById('cms-list');
  if (!container) return;
  container.innerHTML = '';
  (state.cmsScores || []).forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'assess-entry';
    div.innerHTML = `
      <div class="ae-name">${s.name}</div>
      <div class="ae-score">${s.score}</div>
      <div class="ae-date">${s.date || ''}</div>
      <button class="ae-del" onclick="removeCMS(${i})" title="Remove">×</button>
    `;
    container.appendChild(div);
  });
}

function addCMSScore() {
  const name  = document.getElementById('cms-name-inp').value.trim();
  const score = parseFloat(document.getElementById('cms-score-inp').value);
  const date  = document.getElementById('cms-date-inp').value;
  if (!name || isNaN(score)) return;
  if (!state.cmsScores) state.cmsScores = [];
  state.cmsScores.push({ name, score, date });
  document.getElementById('cms-name-inp').value = '';
  document.getElementById('cms-score-inp').value = '';
  document.getElementById('cms-date-inp').value = '';
  renderCMS();
  scheduleSave();
}

async function removeCMS(i) {
  const ok = await confirm2('Remove this score?');
  if (!ok) return;
  state.cmsScores.splice(i, 1);
  renderCMS();
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
      <div class="session-hdr ${isOpen?'open':''}" onclick="toggleSession(${si})">
        <div class="sess-title">${sess.title || 'Session ' + (si+1)}</div>
        <div class="sess-right">
          <span class="tag tag-ghost">${(sess.entries||[]).length} missed</span>
          <span class="sess-toggle">▾</span>
        </div>
      </div>
      <div class="session-body ${isOpen?'open':''}" id="sess-body-${si}">
        ${renderEntriesHTML(si, sess.entries || [])}
        <div class="mq-add-btn-row">
          <button class="btn btn-ghost btn-sm" onclick="addMissedEntry(${si})">+ Add question</button>
          <button class="btn btn-danger btn-sm" style="margin-left:6px" onclick="removeSession(${si})">Remove session</button>
        </div>
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
        <span class="mq-topic">${e.topic || ''}</span>
        <span class="tag tag-ghost" style="font-size:.58rem">${(e.topic||'').toUpperCase()}</span>
        <button onclick="removeMissedEntry(${si},${ei})" style="margin-left:auto;background:transparent;border:none;color:var(--text-tertiary);font-size:.8rem;cursor:pointer;transition:color .15s" onmouseover="this.style.color='var(--urgent)'" onmouseout="this.style.color='var(--text-tertiary)'">×</button>
      </div>
      <div class="mq-field">Why missed</div>
      <div class="mq-val">${e.why || '<em style="color:var(--text-tertiary)">Not filled in</em>'}</div>
      <div class="mq-correct-box">
        <div class="mq-field">Correct thinking</div>
        <div class="mq-val">${e.correct || '<em style="color:var(--text-tertiary)">Not filled in</em>'}</div>
      </div>
    </div>
  `).join('');
}

function toggleSession(i) {
  state.missedSessions[i].open = !state.missedSessions[i].open;
  renderMissedSessions();
}

function addMissedSession() {
  const title = prompt('Session title (e.g. NBME 16, UWorld Block 3):');
  if (title === null) return;
  if (!state.missedSessions) state.missedSessions = [];
  state.missedSessions.push({ title: title || 'Session', entries: [], open: true });
  renderMissedSessions();
  scheduleSave();
}

async function removeSession(i) {
  const ok = await confirm2('Remove session "' + state.missedSessions[i].title + '" and all its entries?');
  if (!ok) return;
  state.missedSessions.splice(i, 1);
  renderMissedSessions();
  renderHeatmap();
  scheduleSave();
}

function addMissedEntry(si) {
  const topic   = prompt('Topic (e.g. cardio, cns):');
  if (topic === null) return;
  const why     = prompt('Why did you miss it?');
  if (why === null) return;
  const correct = prompt('Correct thinking / what to remember:');
  if (correct === null) return;
  if (!state.missedSessions[si].entries) state.missedSessions[si].entries = [];
  state.missedSessions[si].entries.push({ topic: topic.trim(), why, correct });
  renderMissedSessions();
  renderHeatmap();
  scheduleSave();
}

async function removeMissedEntry(si, ei) {
  const ok = await confirm2('Remove this missed question entry?');
  if (!ok) return;
  state.missedSessions[si].entries.splice(ei, 1);
  renderMissedSessions();
  renderHeatmap();
  scheduleSave();
}

// ── Notes ──────────────────────────────────────────────────
function renderNotes() {
  const container = document.getElementById('notes-container');
  if (!container) return;
  container.innerHTML = '';
  const badge = document.getElementById('arch-badge');
  const archCount = (state.archivedNotes || []).length;
  if (badge) { badge.textContent = archCount; badge.style.display = archCount ? 'inline-flex' : 'none'; }
  if (!(state.notes || []).length) {
    container.innerHTML = '<div style="font-family:var(--font-mono);font-size:.78rem;color:var(--text-tertiary);padding:1rem 0">No notes yet. Click + New Note to start.</div>';
    return;
  }
  state.notes.forEach((note, i) => {
    const card = buildNoteCard(note, i);
    container.appendChild(card);
  });
}

function buildNoteCard(note, i) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.id = 'note-' + i;
  card.innerHTML = `
    <div class="note-hdr">
      <div class="note-dot saved" id="ndot-${i}"></div>
      <input class="note-title-inp" placeholder="Note title…" value="${escH(note.title||'')}"
        oninput="noteFieldChange(${i},'title',this.value)">
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
    <div class="note-editor" id="editor-${i}" contenteditable="true" placeholder="Start writing…"
      onkeydown="noteKeyDown(event,${i})"
      oninput="noteFieldChange(${i},'body',document.getElementById('editor-${i}').innerHTML)">${note.body||''}</div>
  `;
  return card;
}

function addNote() {
  if (!state.notes) state.notes = [];
  state.notes.unshift({ title: '', body: '', created: Date.now() });
  renderNotes();
  // Focus title
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
  if (cmds[e.key]) { e.preventDefault(); fmtNote(i, cmds[e.key]); }
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
  if (!state.archivedNotes) state.archivedNotes = [];
  state.archivedNotes.push({ ...state.notes[i], archivedAt: Date.now() });
  state.notes.splice(i, 1);
  renderNotes();
  scheduleSave();
}

// ── Archive Modal ─────────────────────────────────────────
function openArchiveModal() {
  const modal = document.getElementById('arch-modal');
  if (!modal) return;
  const list  = document.getElementById('arch-list');
  const empty = document.getElementById('arch-empty');
  list.innerHTML = '';
  const arcs = state.archivedNotes || [];
  empty.style.display = arcs.length ? 'none' : 'block';
  arcs.forEach((note, i) => {
    const item = document.createElement('div');
    item.className = 'arch-note-item';
    item.innerHTML = `
      <div class="arch-note-title">${escH(note.title || 'Untitled')}</div>
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

function restoreNote(i) {
  if (!state.notes) state.notes = [];
  const note = state.archivedNotes.splice(i, 1)[0];
  delete note.archivedAt;
  state.notes.unshift(note);
  closeArchiveModal();
  renderNotes();
  scheduleSave();
}

async function deleteArchivedNote(i) {
  const ok = await confirm2('Permanently delete archived note "' + (state.archivedNotes[i].title || 'Untitled') + '"?');
  if (!ok) return;
  state.archivedNotes.splice(i, 1);
  closeArchiveModal();
  openArchiveModal();
  renderNotes();
  scheduleSave();
}

// ── Command Palette ────────────────────────────────────────
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
  renderCmds(document.getElementById('cmd-input').value.trim().toLowerCase());
}

function renderCmds(q) {
  const res = document.getElementById('cmd-results');
  if (!res) return;
  res.innerHTML = '';
  cmdSelectedIdx = -1;

  const tabs  = [
    { ico:'🏠', lbl:'Dashboard',  meta:'Tab', action:()=>{ showTab('dashboard'); closeCmdPalette(); }},
    { ico:'📋', lbl:'Topic List', meta:'Tab', action:()=>{ showTab('topics');    closeCmdPalette(); }},
    { ico:'📊', lbl:'Assessments',meta:'Tab', action:()=>{ showTab('assessments');closeCmdPalette();}},
    { ico:'❌', lbl:'Missed Qs',  meta:'Tab', action:()=>{ showTab('missed');    closeCmdPalette(); }},
    { ico:'📝', lbl:'Notes',      meta:'Tab', action:()=>{ showTab('notes');     closeCmdPalette(); }},
  ];

  const noteItems = (state.notes||[]).map((n,i) => ({
    ico:'📄', lbl: n.title || 'Untitled note', meta:'Note',
    action: ()=>{ showTab('notes'); closeCmdPalette(); setTimeout(()=>{ const el=document.getElementById('note-'+i); if(el)el.scrollIntoView({behavior:'smooth'}); },200); }
  }));

  const actions = [
    { ico:'✅', lbl:'+ New Note',             meta:'Action', action:()=>{ showTab('notes'); closeCmdPalette(); addNote(); }},
    { ico:'➕', lbl:'+ New Missed Session',   meta:'Action', action:()=>{ showTab('missed'); closeCmdPalette(); addMissedSession(); }},
  ];

  const allItems = [...tabs, ...noteItems, ...actions];
  const filtered = q ? allItems.filter(it => it.lbl.toLowerCase().includes(q)) : allItems;

  if (!filtered.length) {
    res.innerHTML = '<div id="cmd-empty">No results for "' + escH(q) + '"</div>';
    return;
  }

  // Group by meta
  const groups = {};
  filtered.forEach(it => { if (!groups[it.meta]) groups[it.meta] = []; groups[it.meta].push(it); });
  Object.entries(groups).forEach(([grp, items]) => {
    const gl = document.createElement('div'); gl.className = 'cmd-grp'; gl.textContent = grp;
    res.appendChild(gl);
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'cmd-res';
      div.innerHTML = `<span class="cmd-res-ico">${it.ico}</span><span class="cmd-res-lbl">${escH(it.lbl)}</span><span class="cmd-res-meta">${it.meta}</span>`;
      div.onclick = it.action;
      div.addEventListener('mouseenter', () => {
        document.querySelectorAll('.cmd-res').forEach(r=>r.classList.remove('sel'));
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
    closeCmdPalette(); return;
  } else { return; }
  items.forEach((r,i) => r.classList.toggle('sel', i === cmdSelectedIdx));
  if (items[cmdSelectedIdx]) items[cmdSelectedIdx].scrollIntoView({ block:'nearest' });
}

// ── Confirm Dialog ─────────────────────────────────────────
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
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// ============================================================
// STEP 2 DASHBOARD — APP LOGIC + GOOGLE DRIVE SYNC
// ============================================================

const SCOPES = 'https://www.googleapis.com/auth/documents';
const TOPICS = ['ob','frepro','resp','cardio','endo','multi','blood','cns','gi','beh','bio','msk'];
const NBME_FORMS = ['Form 9','Form 10','Form 11','Form 12','Form 13','Form 14','Form 15','Form 16'];

const SHELF_SCORES = [
  { date: '2025-08-12', label: 'FM Shelf 1',      score: 82 },
  { date: '2025-09-12', label: 'FM Shelf 2',      score: 87 },
  { date: '2025-10-06', label: 'Peds Shelf 1',    score: 87 },
  { date: '2025-10-31', label: 'Peds Shelf 2',    score: 87 },
  { date: '2025-11-12', label: 'Surgery Shelf 1', score: 75 },
  { date: '2025-12-19', label: 'Surgery Shelf 2', score: 83 },
  { date: '2026-02-13', label: 'Psych Shelf 1',   score: 94 },
  { date: '2026-03-20', label: 'OB/GYN Shelf 1',  score: 83 },
  { date: '2026-04-20', label: 'IM Shelf 1',       score: 88 },
  { date: '2026-05-29', label: 'IM Shelf 2',       score: 84 },
];

let accessToken = null;
let saveTimer = null;
let lastSavedState = null;
let shelfChartInstance = null;

// ============================================================
// INIT
// ============================================================
window.onload = () => {
  buildNbmeGrid();
  for (let i = 0; i < 3; i++) addMissedSession();
  updateCountdown();
  initShelfChart();
  renderCustomTopics();

  const saved = localStorage.getItem('step2_access_token');
  if (saved) {
    accessToken = saved;
    showApp();
    loadFromDrive();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }
};

// ============================================================
// AUTH
// ============================================================
function signIn() {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) { alert('Sign in failed: ' + resp.error); return; }
      accessToken = resp.access_token;
      localStorage.setItem('step2_access_token', accessToken);
      showApp();
      loadFromDrive();
    },
  });
  client.requestAccessToken();
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

// ============================================================
// DRIVE: LOAD
// ============================================================
async function loadFromDrive() {
  setSyncBadge('saving', 'Loading…');
  try {
    const res = await fetch(
      `https://docs.googleapis.com/v1/documents/${CONFIG.DOC_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.status === 401) { signOut(); return; }
    const doc = await res.json();
    const text = extractDocText(doc);
    const match = text.match(/DASHBOARD_STATE_JSON_START([\s\S]*?)DASHBOARD_STATE_JSON_END/);
    if (match) {
      try {
        const state = JSON.parse(match[1].trim());
        applyState(state);
        lastSavedState = JSON.stringify(state);
      } catch(e) { console.warn('Could not parse saved state'); }
    }
    setSyncBadge('ok', 'Synced');
  } catch(e) {
    console.error('Load error', e);
    setSyncBadge('err', 'Load failed');
    const local = localStorage.getItem('step2checklist');
    if (local) applyState(JSON.parse(local));
  }
}

// ============================================================
// DRIVE: SAVE
// ============================================================
async function saveToDrive() {
  const state = collectState();
  const stateStr = JSON.stringify(state);
  if (stateStr === lastSavedState) return;
  setSyncBadge('saving', 'Saving…');
  localStorage.setItem('step2checklist', stateStr);
  try {
    const res = await fetch(
      `https://docs.googleapis.com/v1/documents/${CONFIG.DOC_ID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.status === 401) { signOut(); return; }
    const doc = await res.json();
    const text = extractDocText(doc);
    const marker = 'DASHBOARD_STATE_JSON_START';
    const endMarker = 'DASHBOARD_STATE_JSON_END';
    let requests;
    if (text.includes(marker)) {
      const startIdx = findTextIndex(doc, marker);
      const endIdx = findTextIndex(doc, endMarker) + endMarker.length;
      requests = [
        { deleteContentRange: { range: { startIndex: startIdx, endIndex: endIdx } } },
        { insertText: { location: { index: startIdx }, text: `${marker}\n${stateStr}\n${endMarker}` } }
      ];
    } else {
      const endIdx = getDocEndIndex(doc);
      requests = [{ insertText: { location: { index: endIdx - 1 }, text: `\n\n${marker}\n${stateStr}\n${endMarker}` } }];
    }
    const updateRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${CONFIG.DOC_ID}:batchUpdate`,
      { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }) }
    );
    if (updateRes.ok) { lastSavedState = stateStr; setSyncBadge('ok', 'Synced'); }
    else { const err = await updateRes.json(); console.error('Save error', err); setSyncBadge('err', 'Save failed'); }
  } catch(e) {
    console.error('Save error', e);
    setSyncBadge('err', 'Save failed');
  }
}

// ============================================================
// DOC HELPERS
// ============================================================
function extractDocText(doc) {
  let text = '';
  for (const block of doc.body?.content || []) {
    if (block.paragraph) for (const el of block.paragraph.elements || []) text += el.textRun?.content || '';
  }
  return text;
}
function findTextIndex(doc, searchStr) {
  let offset = 0;
  for (const block of doc.body?.content || []) {
    if (block.paragraph) for (const el of block.paragraph.elements || []) {
      const t = el.textRun?.content || '';
      const idx = t.indexOf(searchStr);
      if (idx !== -1) return offset + idx;
      offset += t.length;
    }
  }
  return -1;
}
function getDocEndIndex(doc) {
  const content = doc.body?.content || [];
  return content.length ? (content[content.length - 1].endIndex || 1) : 1;
}

// ============================================================
// STATE
// ============================================================
function collectState() {
  const state = {};
  document.querySelectorAll('input[type=checkbox]').forEach(el => { if (el.id) state[el.id] = el.checked; });
  document.querySelectorAll('input.score-input').forEach(el => { if (el.id) state[el.id] = el.value; });

  // Missed sessions
  state._missedSessions = [];
  document.querySelectorAll('.missed-session').forEach(sess => {
    const title = sess.querySelector('.session-title-input').value;
    const rows = [];
    sess.querySelectorAll('.missed-row').forEach(row => {
      rows.push(Array.from(row.querySelectorAll('input,textarea')).map(i => i.value));
    });
    state._missedSessions.push({ title, rows });
  });

  // Notes
  state._notesSections = [];
  document.querySelectorAll('#notes-sections > .note-card').forEach(card => {
    state._notesSections.push({
      id: card.dataset.id,
      name: card.querySelector('.note-card-title').textContent,
      content: card.querySelector('.note-editor').innerHTML
    });
  });

  // Archives
  state._archivedSections = [];
  document.querySelectorAll('#archive-list > .archive-item').forEach(item => {
    state._archivedSections.push({
      name: item.dataset.name,
      content: item.dataset.content
    });
  });

  // Custom topics
  state._customTopics = [];
  document.querySelectorAll('#custom-topics-list > .custom-topic-item').forEach(item => {
    state._customTopics.push({
      name: item.querySelector('.custom-topic-name').textContent,
      done: item.querySelector('.custom-topic-check').checked,
      revisit: item.querySelector('.custom-topic-revisit').checked,
      where: item.querySelector('.custom-topic-where').value
    });
  });

  // Resources
  state._customResources = [];
  document.querySelectorAll('#custom-resources-list > .resource-custom-item').forEach(item => {
    state._customResources.push({
      text: item.querySelector('.res-label').textContent,
      done: item.querySelector('.res-check').checked
    });
  });

  return state;
}

function applyState(state) {
  Object.keys(state).forEach(k => {
    if (k.startsWith('_')) return;
    const el = document.getElementById(k);
    if (!el) return;
    if (el.type === 'checkbox') { el.checked = state[k]; if (k.startsWith('vis-')) markDone(k.replace('vis-', '')); }
    else el.value = state[k] || '';
  });
  NBME_FORMS.forEach((_, i) => {
    const id = 'nbme-' + i;
    const el = document.getElementById(id);
    if (el && state[id]) { el.checked = true; toggleExam(id); }
  });

  // Missed sessions
  document.getElementById('missed-sessions-container').innerHTML = '';
  const mSessions = state._missedSessions || [];
  if (mSessions.length > 0) mSessions.forEach(s => addMissedSession(s.title, s.rows));
  else for (let i = 0; i < 3; i++) addMissedSession();

  // Notes
  document.getElementById('notes-sections').innerHTML = '';
  const notes = state._notesSections || [];
  if (notes.length > 0) notes.forEach(n => addNoteCard(n.name, n.content, n.id));
  else addNoteCard('General Notes', '');

  // Archives
  document.getElementById('archive-list').innerHTML = '';
  (state._archivedSections || []).forEach(n => addArchiveItem(n.name, n.content));

  // Custom topics
  document.getElementById('custom-topics-list').innerHTML = '';
  (state._customTopics || []).forEach(t => addCustomTopic(t.name, t.done, t.revisit, t.where));

  // Resources
  document.getElementById('custom-resources-list').innerHTML = '';
  (state._customResources || []).forEach(r => addCustomResource(r.text, r.done));

  updateProgress();
  updateMissedCount();
}

function schedSave() {
  clearTimeout(saveTimer);
  setSyncBadge('saving', 'Unsaved…');
  saveTimer = setTimeout(() => saveToDrive(), 1500);
}

function signOut() {
  localStorage.removeItem('step2_access_token');
  accessToken = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

// ============================================================
// TOPIC LIST
// ============================================================
function renderCustomTopics() {
  // already handled by applyState; on first load the list is empty
}

function addCustomTopic(name, done, revisit, where) {
  const inputEl = document.getElementById('new-topic-input');
  const topicName = name || (inputEl ? inputEl.value.trim() : '');
  if (!topicName) return;
  if (inputEl && !name) inputEl.value = '';

  const id = 'ct-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const item = document.createElement('div');
  item.className = 'topic-card custom-topic-item';
  item.style.cssText = 'display:flex;align-items:center;gap:14px;padding:14px 18px;margin-bottom:8px';
  item.innerHTML = `
    <input type="checkbox" class="custom-topic-check topic-check" id="${id}-done" ${done ? 'checked' : ''} onchange="toggleCustomTopicDone(this);schedSave()" style="width:17px;height:17px;accent-color:var(--green);cursor:pointer;flex-shrink:0">
    <label for="${id}-done" class="custom-topic-name" style="flex:1;font-size:14px;font-weight:500;cursor:pointer;${done ? 'text-decoration:line-through;opacity:0.5' : ''}">${topicName}</label>
    <input class="custom-topic-where where-input" placeholder="UW / AMBOSS" value="${where || ''}" oninput="schedSave()" style="width:110px">
    <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;cursor:pointer">
      <input type="checkbox" class="custom-topic-revisit" ${revisit ? 'checked' : ''} onchange="schedSave()" style="width:13px;height:13px;accent-color:var(--gold);cursor:pointer">Revisit
    </label>
    <button onclick="confirmRemoveCustomTopic(this)" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:2px 4px;line-height:1" title="Remove">×</button>
  `;
  document.getElementById('custom-topics-list').appendChild(item);
  schedSave();
}

function toggleCustomTopicDone(cb) {
  const label = cb.closest('.custom-topic-item').querySelector('.custom-topic-name');
  label.style.textDecoration = cb.checked ? 'line-through' : '';
  label.style.opacity = cb.checked ? '0.5' : '1';
}

function confirmRemoveCustomTopic(btn) {
  if (confirm('Remove this topic?')) { btn.closest('.custom-topic-item').remove(); schedSave(); }
}

// ============================================================
// CUSTOM RESOURCES
// ============================================================
function addCustomResource(text, done) {
  const inputEl = document.getElementById('new-resource-input');
  const resText = text || (inputEl ? inputEl.value.trim() : '');
  if (!resText) return;
  if (inputEl && !text) inputEl.value = '';

  const item = document.createElement('div');
  item.className = 'resource-custom-item';
  const id = 'cr-' + Date.now();
  item.innerHTML = `
    <input type="checkbox" class="res-check" id="${id}" ${done ? 'checked' : ''} onchange="schedSave()" style="width:14px;height:14px;accent-color:var(--green);cursor:pointer;flex-shrink:0;accent-color:var(--green)">
    <label for="${id}" class="res-label" style="flex:1;font-size:13px;cursor:pointer;${done ? 'text-decoration:line-through;opacity:0.5' : ''}">${resText}</label>
    <button onclick="confirmRemoveResource(this)" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:15px;padding:0 3px;opacity:0.6" title="Remove">×</button>
  `;
  item.querySelector('.res-check').addEventListener('change', function() {
    item.querySelector('.res-label').style.textDecoration = this.checked ? 'line-through' : '';
    item.querySelector('.res-label').style.opacity = this.checked ? '0.5' : '1';
  });
  document.getElementById('custom-resources-list').appendChild(item);
  schedSave();
}

function confirmRemoveResource(btn) {
  if (confirm('Remove this resource item?')) { btn.closest('.resource-custom-item').remove(); schedSave(); }
}

// ============================================================
// MISSED QUESTIONS
// ============================================================
function addMissedSession(title, rows) {
  const container = document.getElementById('missed-sessions-container');
  const sessId = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const div = document.createElement('div');
  div.className = 'missed-session';
  div.id = sessId;
  div.innerHTML = `
    <div class="missed-session-header">
      <input class="session-title-input" placeholder="Session name (e.g. NBME 9)" value="${title || ''}" oninput="schedSave()">
      <button class="missed-session-toggle" onclick="toggleMissedSession('${sessId}')">▾</button>
      <button class="btn-ghost-red" onclick="confirmRemoveSession('${sessId}')">Remove</button>
    </div>
    <div class="missed-session-body" id="body-${sessId}">
      <div class="missed-rows-container"></div>
      <button class="add-row-btn" style="margin-top:8px" onclick="addMissedRow('${sessId}')">+ Add question</button>
    </div>
  `;
  container.appendChild(div);

  const rowsData = rows || [];
  if (rowsData.length > 0) rowsData.forEach(r => addMissedRow(sessId, r));
  else addMissedRow(sessId);
}

function addMissedRow(sessId, vals) {
  const container = document.querySelector(`#body-${sessId} .missed-rows-container`);
  const row = document.createElement('div');
  row.className = 'missed-row';
  row.innerHTML = `
    <input class="missed-input" placeholder="Topic" value="${vals ? (vals[0] || '') : ''}" oninput="schedSave()">
    <input class="missed-input" placeholder="Why missed" value="${vals ? (vals[1] || '') : ''}" oninput="schedSave()">
    <input class="missed-input" placeholder="Correct thinking" value="${vals ? (vals[2] || '') : ''}" oninput="schedSave()">
    <button onclick="this.closest('.missed-row').remove();schedSave();updateMissedCount()" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:0 4px;flex-shrink:0">×</button>
  `;
  container.appendChild(row);
  updateMissedCount();
}

function toggleMissedSession(sessId) {
  const body = document.getElementById('body-' + sessId);
  const btn = document.querySelector(`#${sessId} .missed-session-toggle`);
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? '▾' : '▸';
}

function confirmRemoveSession(sessId) {
  if (confirm('Remove this entire session and all its questions?')) {
    document.getElementById(sessId).remove();
    schedSave();
    updateMissedCount();
  }
}

function updateMissedCount() {
  const count = document.querySelectorAll('.missed-row').length;
  const el = document.getElementById('missed-count');
  if (el) el.textContent = count + ' question' + (count !== 1 ? 's' : '') + ' logged';
}

// ============================================================
// NOTES
// ============================================================
function addNoteCard(name, content, existingId) {
  const inputEl = document.getElementById('new-note-name');
  const noteName = name || (inputEl ? inputEl.value.trim() : '') || 'New Note';
  if (inputEl && !name) inputEl.value = '';

  const id = existingId || ('note-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  const card = document.createElement('div');
  card.className = 'note-card';
  card.dataset.id = id;

  card.innerHTML = `
    <div class="note-card-header">
      <span class="note-card-title" contenteditable="true" spellcheck="false" onblur="schedSave()">${noteName}</span>
      <div class="note-card-actions">
        <button class="note-action-btn" onclick="archiveNoteCard('${id}')" title="Archive">⊙ Archive</button>
      </div>
    </div>
    <div class="note-toolbar">
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('bold')" title="Bold"><b>B</b></button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('italic')" title="Italic"><i>I</i></button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('underline')" title="Underline"><u>U</u></button>
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('insertUnorderedList')" title="Bullet list">≡</button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('insertOrderedList')" title="Numbered list">№</button>
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('foreColor','false','#C9A84C')" title="Highlight gold" style="color:var(--gold)">A</button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('foreColor','false','#2B6CB0')" title="Highlight blue" style="color:var(--blue)">A</button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('foreColor','false','#276749')" title="Highlight green" style="color:var(--green)">A</button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('foreColor','false','#9B2335')" title="Highlight red" style="color:var(--red)">A</button>
    </div>
    <div class="note-editor" contenteditable="true" spellcheck="true" oninput="schedSave()" placeholder="Start writing…">${content || ''}</div>
  `;
  document.getElementById('notes-sections').appendChild(card);
}

function archiveNoteCard(id) {
  const card = document.querySelector(`.note-card[data-id="${id}"]`);
  if (!card) return;
  const name = card.querySelector('.note-card-title').textContent;
  const content = card.querySelector('.note-editor').innerHTML;
  card.remove();
  addArchiveItem(name, content);
  schedSave();
}

// ============================================================
// ARCHIVES (modal)
// ============================================================
function addArchiveItem(name, content) {
  const list = document.getElementById('archive-list');
  const item = document.createElement('div');
  item.className = 'archive-item';
  item.dataset.name = name;
  item.dataset.content = content;
  const id = 'arch-' + Date.now();
  item.innerHTML = `
    <div class="archive-item-header">
      <span class="archive-item-name">${name}</span>
      <div style="display:flex;gap:8px">
        <button class="btn-ghost-blue" onclick="unarchiveItem(this)">Restore</button>
        <button class="btn-ghost-red" onclick="confirmDeleteArchive(this)">Delete</button>
      </div>
    </div>
    <div class="archive-preview">${content.replace(/<[^>]+>/g, ' ').slice(0, 120)}${content.length > 120 ? '…' : ''}</div>
  `;
  list.appendChild(item);
  updateArchiveCount();
}

function unarchiveItem(btn) {
  const item = btn.closest('.archive-item');
  const name = item.dataset.name;
  const content = item.dataset.content;
  item.remove();
  addNoteCard(name, content);
  updateArchiveCount();
  schedSave();
  closeArchiveModal();
}

function confirmDeleteArchive(btn) {
  if (confirm('Permanently delete this archived note? This cannot be undone.')) {
    btn.closest('.archive-item').remove();
    updateArchiveCount();
    schedSave();
  }
}

function updateArchiveCount() {
  const count = document.querySelectorAll('#archive-list > .archive-item').length;
  const badge = document.getElementById('archive-count-badge');
  if (badge) { badge.textContent = count > 0 ? count : ''; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }
  const modalEmpty = document.getElementById('archive-modal-empty');
  if (modalEmpty) modalEmpty.style.display = count > 0 ? 'none' : 'block';
}

function openArchiveModal() {
  document.getElementById('archive-modal').classList.add('open');
}

function closeArchiveModal() {
  document.getElementById('archive-modal').classList.remove('open');
}

// ============================================================
// SHELF CHART
// ============================================================
function initShelfChart() {
  const now = new Date();
  // Use floor for same-day accuracy (today is June 2, 2026)
  const cssMs = new Date('2026-06-12') - now;
  const stepMs = new Date('2026-08-12') - now;
  document.getElementById('home-css-days').textContent = Math.max(0, Math.ceil(cssMs / 86400000));
  document.getElementById('home-step-days').textContent = Math.max(0, Math.ceil(stepMs / 86400000));

  const labels = SHELF_SCORES.map(s => s.label);
  const scores = SHELF_SCORES.map(s => s.score);
  const avgLine = scores.map((_, i) => {
    const slice = scores.slice(0, i + 1);
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length * 10) / 10;
  });

  const ctx = document.getElementById('shelf-chart').getContext('2d');
  if (shelfChartInstance) shelfChartInstance.destroy();
  shelfChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'EPC Score',
          data: scores,
          borderColor: '#C9A84C',
          backgroundColor: 'rgba(201,168,76,0.1)',
          pointBackgroundColor: '#C9A84C',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 7,
          pointHoverRadius: 10,
          tension: 0.35,
          fill: true,
          order: 2,
        },
        {
          label: 'Running Avg',
          data: avgLine,
          borderColor: 'rgba(255,255,255,0.35)',
          borderDash: [5, 4],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: false,
          order: 1,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { font: { family: "'DM Mono', monospace", size: 11 }, color: 'rgba(255,255,255,0.5)', boxWidth: 24 }
        },
        tooltip: {
          backgroundColor: 'rgba(11,22,40,0.95)',
          titleColor: '#C9A84C',
          bodyColor: 'rgba(255,255,255,0.8)',
          borderColor: 'rgba(201,168,76,0.3)',
          borderWidth: 1,
          callbacks: { label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y}%` }
        }
      },
      scales: {
        y: {
          min: 60, max: 100,
          ticks: { font: { family: "'DM Mono', monospace", size: 11 }, color: 'rgba(255,255,255,0.4)', callback: v => v + '%' },
          grid: { color: 'rgba(255,255,255,0.06)' }
        },
        x: {
          ticks: { font: { family: "'DM Mono', monospace", size: 10 }, color: 'rgba(255,255,255,0.4)', maxRotation: 40 },
          grid: { display: false }
        }
      }
    }
  });
}

// ============================================================
// UI HELPERS
// ============================================================
function setSyncBadge(type, text) {
  const b = document.getElementById('sync-badge');
  b.className = 'sync-status sync-' + type;
  b.textContent = (type === 'ok' ? '● ' : type === 'saving' ? '◌ ' : '✕ ') + text;
}

function showTab(t, el) {
  document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
  document.getElementById('tab-' + t).classList.add('active');
  el.classList.add('active');
}

function updateCountdown() {
  const now = new Date();
  const cssEl = document.getElementById('css-days');
  const stepEl = document.getElementById('step-days');
  if (cssEl) cssEl.textContent = Math.max(0, Math.ceil((new Date('2026-06-12') - now) / 86400000));
  if (stepEl) stepEl.textContent = Math.max(0, Math.ceil((new Date('2026-08-12') - now) / 86400000));
}

function updateProgress() {
  const builtIn = TOPICS.filter(id => document.getElementById('vis-' + id)?.checked).length;
  const customDone = document.querySelectorAll('.custom-topic-check:checked').length;
  const customTotal = document.querySelectorAll('.custom-topic-check').length;
  const done = builtIn + customDone;
  const total = TOPICS.length + customTotal;
  document.getElementById('prog-text').textContent = done + ' / ' + total + ' topics done';
  document.getElementById('prog-fill').style.width = (total ? (done / total * 100) : 0) + '%';
}

function markDone(id) {
  const card = document.getElementById('card-' + id);
  if (card) card.classList.toggle('done', document.getElementById('vis-' + id).checked);
}

function buildNbmeGrid() {
  const grid = document.getElementById('nbme-grid');
  NBME_FORMS.forEach((f, i) => {
    const id = 'nbme-' + i;
    const card = document.createElement('div');
    card.className = 'exam-card';
    card.id = 'ec-' + id;
    card.innerHTML = `<input type="checkbox" id="${id}" onchange="toggleExam('${id}');schedSave()"><label for="${id}">${f}</label>`;
    grid.appendChild(card);
  });
}

function toggleExam(id) {
  document.getElementById('ec-' + id).classList.toggle('done', document.getElementById(id).checked);
}

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
  initShelfChart();

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

  state._missedSessions = [];
  document.querySelectorAll('.missed-session').forEach(sess => {
    const title = sess.querySelector('.session-title-input').value;
    const rows = [];
    sess.querySelectorAll('.missed-row').forEach(row => {
      rows.push(Array.from(row.querySelectorAll('input,textarea')).map(i => i.value));
    });
    state._missedSessions.push({ title, rows });
  });

  state._notesSections = [];
  document.querySelectorAll('#notes-sections > .note-card').forEach(card => {
    state._notesSections.push({
      id: card.dataset.id,
      name: card.querySelector('.note-card-title').textContent,
      content: card.querySelector('.note-editor').innerHTML
    });
  });

  state._archivedSections = [];
  document.querySelectorAll('#archive-list > .archive-item').forEach(item => {
    state._archivedSections.push({ name: item.dataset.name, content: item.dataset.content });
  });

  state._customTopics = [];
  document.querySelectorAll('#custom-topics-list > .custom-topic-item').forEach(item => {
    state._customTopics.push({
      name: item.querySelector('.custom-topic-name').textContent,
      done: item.querySelector('.custom-topic-check').checked,
      revisit: item.querySelector('.custom-topic-revisit').checked,
      where: item.querySelector('.custom-topic-where').value
    });
  });

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

  document.getElementById('missed-sessions-container').innerHTML = '';
  const mSessions = state._missedSessions || [];
  if (mSessions.length > 0) mSessions.forEach(s => addMissedSession(s.title, s.rows));
  else for (let i = 0; i < 3; i++) addMissedSession();

  document.getElementById('notes-sections').innerHTML = '';
  const notes = state._notesSections || [];
  if (notes.length > 0) notes.forEach(n => addNoteCard(n.name, n.content, n.id));
  else addNoteCard('General Notes', '');

  document.getElementById('archive-list').innerHTML = '';
  (state._archivedSections || []).forEach(n => addArchiveItem(n.name, n.content));

  document.getElementById('custom-topics-list').innerHTML = '';
  (state._customTopics || []).forEach(t => addCustomTopic(t.name, t.done, t.revisit, t.where));

  document.getElementById('custom-resources-list').innerHTML = '';
  (state._customResources || []).forEach(r => addCustomResource(r.text, r.done));

  updateProgress();
  updateMissedCount();
  updateArchiveCount();
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
function addCustomTopic(name, done, revisit, where) {
  const inputEl = document.getElementById('new-topic-input');
  const topicName = name || (inputEl ? inputEl.value.trim() : '');
  if (!topicName) return;
  if (inputEl && !name) inputEl.value = '';

  const id = 'ct-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const item = document.createElement('div');
  item.className = 'topic-card custom-topic-item';
  item.innerHTML = `
    <input type="checkbox" class="custom-topic-check" id="${id}-done" ${done ? 'checked' : ''}
      onchange="toggleCustomTopicDone(this);schedSave()"
      style="width:16px;height:16px;accent-color:var(--green);cursor:pointer;flex-shrink:0">
    <label for="${id}-done" class="custom-topic-name"
      style="flex:1;font-size:14px;font-weight:500;cursor:pointer;${done ? 'text-decoration:line-through;opacity:0.45' : ''}">${topicName}</label>
    <input class="custom-topic-where where-input" placeholder="Source" value="${where || ''}" oninput="schedSave()">
    <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);font-family:'DM Mono',monospace;cursor:pointer;white-space:nowrap">
      <input type="checkbox" class="custom-topic-revisit" ${revisit ? 'checked' : ''}
        onchange="schedSave()" style="width:13px;height:13px;accent-color:var(--gold);cursor:pointer">Revisit
    </label>
    <button onclick="confirmRemoveCustomTopic(this)"
      style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;padding:2px 6px;line-height:1;border-radius:4px;transition:all .15s"
      onmouseover="this.style.color='var(--red)';this.style.background='var(--red-light)'"
      onmouseout="this.style.color='var(--muted)';this.style.background='none'"
      title="Remove">×</button>
  `;
  document.getElementById('custom-topics-list').appendChild(item);
  schedSave();
}

function toggleCustomTopicDone(cb) {
  const label = cb.closest('.custom-topic-item').querySelector('.custom-topic-name');
  label.style.textDecoration = cb.checked ? 'line-through' : '';
  label.style.opacity = cb.checked ? '0.45' : '1';
  updateProgress();
}

function confirmRemoveCustomTopic(btn) {
  if (confirm('Remove this topic?')) { btn.closest('.custom-topic-item').remove(); schedSave(); updateProgress(); }
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
  const id = 'cr-' + Date.now() + Math.random().toString(36).slice(2);
  item.innerHTML = `
    <input type="checkbox" class="res-check" id="${id}" ${done ? 'checked' : ''}
      style="width:14px;height:14px;accent-color:var(--green);cursor:pointer;flex-shrink:0">
    <label for="${id}" class="res-label"
      style="flex:1;font-size:13px;cursor:pointer;${done ? 'text-decoration:line-through;opacity:0.45' : ''}">${resText}</label>
    <button onclick="confirmRemoveResource(this)"
      style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:0 4px;border-radius:4px;transition:all .15s"
      onmouseover="this.style.color='var(--red)'"
      onmouseout="this.style.color='var(--muted)'"
      title="Remove">×</button>
  `;
  item.querySelector('.res-check').addEventListener('change', function() {
    const lbl = item.querySelector('.res-label');
    lbl.style.textDecoration = this.checked ? 'line-through' : '';
    lbl.style.opacity = this.checked ? '0.45' : '1';
    schedSave();
  });
  document.getElementById('custom-resources-list').appendChild(item);
  schedSave();
}

function confirmRemoveResource(btn) {
  if (confirm('Remove this item?')) { btn.closest('.resource-custom-item').remove(); schedSave(); }
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
      <div class="session-header-left">
        <button class="missed-session-toggle" onclick="toggleMissedSession('${sessId}')">▾</button>
        <input class="session-title-input" placeholder="Session name (e.g. NBME 9)" value="${title || ''}" oninput="schedSave()">
      </div>
      <button class="btn-ghost-red" onclick="confirmRemoveSession('${sessId}')">Remove</button>
    </div>
    <div class="missed-session-body" id="body-${sessId}">
      <div class="missed-table-header">
        <span>Topic</span><span>Why I Missed It</span><span>Correct Thinking</span><span></span>
      </div>
      <div class="missed-rows-container"></div>
      <button class="add-row-btn" style="margin-top:10px" onclick="addMissedRow('${sessId}')">+ Add question</button>
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
    <input class="missed-input" placeholder="e.g. SIADH vs CSW" value="${vals ? (vals[0] || '') : ''}" oninput="schedSave()">
    <input class="missed-input" placeholder="e.g. Confused Na trend direction" value="${vals ? (vals[1] || '') : ''}" oninput="schedSave()">
    <input class="missed-input" placeholder="e.g. SIADH Na rises with fluids…" value="${vals ? (vals[2] || '') : ''}" oninput="schedSave()">
    <button onclick="this.closest('.missed-row').remove();schedSave();updateMissedCount()"
      style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;padding:0 6px;line-height:1;border-radius:4px;transition:all .15s;flex-shrink:0"
      onmouseover="this.style.color='var(--red)'"
      onmouseout="this.style.color='var(--muted)'">×</button>
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
// NOTES — with keyboard shortcut support
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
        <button class="note-action-btn" onclick="archiveNoteCard('${id}')">⊙ Archive</button>
      </div>
    </div>
    <div class="note-toolbar" id="toolbar-${id}">
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('bold')" title="Bold (⌘B)"><b>B</b></button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('italic')" title="Italic (⌘I)"><i>I</i></button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('underline')" title="Underline (⌘U)"><u>U</u></button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('strikeThrough')" title="Strikethrough" style="text-decoration:line-through">S</button>
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('insertUnorderedList')" title="Bullet list">• List</button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('insertOrderedList')" title="Numbered list">1. List</button>
      <div class="toolbar-sep"></div>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('removeFormat')" title="Clear formatting" style="font-size:10px">Clear</button>
      <div class="toolbar-sep"></div>
      <span style="font-size:10px;color:var(--muted);font-family:'DM Mono',monospace;padding:0 4px;align-self:center">Color:</span>
      <button class="toolbar-color" onmousedown="event.preventDefault();document.execCommand('foreColor','false','#111827')" title="Black" style="background:#111827"></button>
      <button class="toolbar-color" onmousedown="event.preventDefault();document.execCommand('foreColor','false','#D4A84B')" title="Gold" style="background:#D4A84B"></button>
      <button class="toolbar-color" onmousedown="event.preventDefault();document.execCommand('foreColor','false','#3B82F6')" title="Blue" style="background:#3B82F6"></button>
      <button class="toolbar-color" onmousedown="event.preventDefault();document.execCommand('foreColor','false','#059669')" title="Green" style="background:#059669"></button>
      <button class="toolbar-color" onmousedown="event.preventDefault();document.execCommand('foreColor','false','#DC2626')" title="Red" style="background:#DC2626"></button>
    </div>
    <div class="note-editor" contenteditable="true" spellcheck="true" placeholder="Start writing…"
      oninput="schedSave()">${content || ''}</div>
  `;

  // Attach keyboard shortcut handler to the editor
  const editor = card.querySelector('.note-editor');
  editor.addEventListener('keydown', function(e) {
    if (e.metaKey || e.ctrlKey) {
      switch(e.key.toLowerCase()) {
        case 'b': e.preventDefault(); document.execCommand('bold'); break;
        case 'i': e.preventDefault(); document.execCommand('italic'); break;
        case 'u': e.preventDefault(); document.execCommand('underline'); break;
        case 'z': break; // allow undo
        default: break;
      }
    }
    // Tab → indent
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  });

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
  item.innerHTML = `
    <div class="archive-item-header">
      <span class="archive-item-name">${name}</span>
      <div style="display:flex;gap:8px">
        <button class="btn-ghost-blue" onclick="unarchiveItem(this)">Restore</button>
        <button class="btn-ghost-red" onclick="confirmDeleteArchive(this)">Delete</button>
      </div>
    </div>
    <div class="archive-preview">${(content || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 140)}${(content || '').length > 140 ? '…' : ''}</div>
  `;
  list.appendChild(item);
  updateArchiveCount();
}

function unarchiveItem(btn) {
  const item = btn.closest('.archive-item');
  addNoteCard(item.dataset.name, item.dataset.content);
  item.remove();
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

function openArchiveModal() { document.getElementById('archive-modal').classList.add('open'); }
function closeArchiveModal() { document.getElementById('archive-modal').classList.remove('open'); }

// ============================================================
// SHELF CHART + COUNTDOWN
// ============================================================
function initShelfChart() {
  // Timezone-safe countdown: compare midnight-to-midnight local
  const today = new Date(); today.setHours(0,0,0,0);
  const cssTarget = new Date('2026-06-12T00:00:00'); cssTarget.setHours(0,0,0,0);
  const stepTarget = new Date('2026-08-12T00:00:00'); stepTarget.setHours(0,0,0,0);
  const cssDays = Math.max(0, Math.round((cssTarget - today) / 86400000));
  const stepDays = Math.max(0, Math.round((stepTarget - today) / 86400000));

  const cssEl = document.getElementById('home-css-days');
  const stepEl = document.getElementById('home-step-days');
  if (cssEl) cssEl.textContent = cssDays;
  if (stepEl) stepEl.textContent = stepDays;

  // Urgency color on low days
  if (cssEl && cssDays <= 14) cssEl.style.color = cssDays <= 7 ? '#EF4444' : '#F59E0B';
  if (stepEl && stepDays <= 14) stepEl.style.color = stepDays <= 7 ? '#EF4444' : '#F59E0B';

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
          label: 'EPC / % Score',
          data: scores,
          borderColor: '#D4A84B',
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const {ctx: c, chartArea} = chart;
            if (!chartArea) return 'transparent';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(212,168,75,0.25)');
            gradient.addColorStop(1, 'rgba(212,168,75,0)');
            return gradient;
          },
          pointBackgroundColor: scores.map(s => s >= 90 ? '#10B981' : s >= 85 ? '#D4A84B' : s >= 80 ? '#3B82F6' : '#EF4444'),
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 7,
          pointHoverRadius: 11,
          tension: 0.4,
          fill: true,
          order: 2,
        },
        {
          label: 'Running Avg',
          data: avgLine,
          borderColor: 'rgba(255,255,255,0.3)',
          borderDash: [6, 4],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
          order: 1,
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { font: { family: "'DM Mono', monospace", size: 11 }, color: 'rgba(255,255,255,0.45)', boxWidth: 20, padding: 16 }
        },
        tooltip: {
          backgroundColor: 'rgba(10,18,35,0.97)',
          titleColor: '#D4A84B',
          bodyColor: 'rgba(255,255,255,0.85)',
          borderColor: 'rgba(212,168,75,0.25)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y}%`,
            afterLabel: ctx => {
              if (ctx.datasetIndex === 0) {
                const s = ctx.parsed.y;
                return s >= 90 ? '  ✦ Excellent' : s >= 85 ? '  ✓ Strong' : s >= 80 ? '  → On target' : '  ↓ Needs work';
              }
              return '';
            }
          }
        }
      },
      scales: {
        y: {
          min: 65, max: 100,
          ticks: { font: { family: "'DM Mono', monospace", size: 11 }, color: 'rgba(255,255,255,0.35)', callback: v => v + '%', stepSize: 5 },
          grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
        },
        x: {
          ticks: { font: { family: "'DM Mono', monospace", size: 10 }, color: 'rgba(255,255,255,0.35)', maxRotation: 40 },
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

function updateProgress() {
  const builtIn = TOPICS.filter(id => document.getElementById('vis-' + id)?.checked).length;
  const customDone = document.querySelectorAll('.custom-topic-check:checked').length;
  const customTotal = document.querySelectorAll('.custom-topic-check').length;
  const done = builtIn + customDone;
  const total = TOPICS.length + customTotal;
  const pct = total ? Math.round(done / total * 100) : 0;
  const el = document.getElementById('prog-text');
  if (el) el.textContent = done + ' / ' + total + ' topics done · ' + pct + '%';
  const fill = document.getElementById('prog-fill');
  if (fill) fill.style.width = pct + '%';
  // Update dashboard mini-stat if exists
  const dash = document.getElementById('dash-topics-done');
  if (dash) dash.textContent = done + ' / ' + total;
}

function markDone(id) {
  const card = document.getElementById('card-' + id);
  if (card) card.classList.toggle('done', document.getElementById('vis-' + id).checked);
  updateProgress();
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

// ============================================================
// STEP 2 DASHBOARD — APP LOGIC + GOOGLE DRIVE SYNC
// ============================================================

const SCOPES = 'https://www.googleapis.com/auth/documents';
const TOPICS = ['ob','frepro','resp','cardio','endo','multi','blood','cns','gi','beh','bio','msk'];
const NBME_FORMS = ['Form 9','Form 10','Form 11','Form 12','Form 13','Form 14','Form 15','Form 16'];

let accessToken = null;
let saveTimer = null;
let lastSavedState = null;

// ============================================================
// INIT
// ============================================================
window.onload = () => {
  buildNbmeGrid();
  for (let i = 0; i < 5; i++) addSessionRow();
  for (let i = 0; i < 5; i++) addMissedRow();
  updateCountdown();

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
// DRIVE: LOAD STATE FROM DOC
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
      } catch(e) {
        console.warn('Could not parse saved state, starting fresh');
      }
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
// DRIVE: SAVE STATE TO DOC
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
      const newBlock = `${marker}\n${stateStr}\n${endMarker}`;
      requests = [{
        deleteContentRange: { range: { startIndex: startIdx, endIndex: endIdx } }
      }, {
        insertText: { location: { index: startIdx }, text: newBlock }
      }];
    } else {
      const endIdx = getDocEndIndex(doc);
      const newBlock = `\n\nDASHBOARD_STATE_JSON_START\n${stateStr}\n${endMarker}`;
      requests = [{
        insertText: { location: { index: endIdx - 1 }, text: newBlock }
      }];
    }

    const updateRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${CONFIG.DOC_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }
    );

    if (updateRes.ok) {
      lastSavedState = stateStr;
      setSyncBadge('ok', 'Synced');
    } else {
      const err = await updateRes.json();
      console.error('Save error', err);
      setSyncBadge('err', 'Save failed');
    }
  } catch(e) {
    console.error('Save error', e);
    setSyncBadge('err', 'Save failed — check connection');
  }
}

// ============================================================
// DOC HELPERS
// ============================================================
function extractDocText(doc) {
  let text = '';
  const content = doc.body?.content || [];
  for (const block of content) {
    if (block.paragraph) {
      for (const el of block.paragraph.elements || []) {
        text += el.textRun?.content || '';
      }
    }
  }
  return text;
}

function findTextIndex(doc, searchStr) {
  let offset = 0;
  const content = doc.body?.content || [];
  for (const block of content) {
    if (block.paragraph) {
      for (const el of block.paragraph.elements || []) {
        const t = el.textRun?.content || '';
        const idx = t.indexOf(searchStr);
        if (idx !== -1) return offset + idx;
        offset += t.length;
      }
    }
  }
  return -1;
}

function getDocEndIndex(doc) {
  const content = doc.body?.content || [];
  if (content.length === 0) return 1;
  const last = content[content.length - 1];
  return last.endIndex || 1;
}

// ============================================================
// STATE COLLECT / APPLY
// ============================================================
function collectState() {
  const state = {};
  document.querySelectorAll('input[type=checkbox]').forEach(el => {
    if (el.id) state[el.id] = el.checked;
  });
  document.querySelectorAll('input.where-input, input.score-input').forEach(el => {
    if (el.id) state[el.id] = el.value;
  });
  const sessionRows = [];
  document.querySelectorAll('#session-body tr').forEach(tr => {
    sessionRows.push(Array.from(tr.querySelectorAll('input')).map(i => i.value));
  });
  state._sessionRows = sessionRows;
  const missedRows = [];
  document.querySelectorAll('#missed-body tr').forEach(tr => {
    missedRows.push(Array.from(tr.querySelectorAll('input')).map(i => i.value));
  });
  state._missedRows = missedRows;

  // Notes sections
  const notesSections = [];
  document.querySelectorAll('#notes-sections > div[id^="note-"]').forEach(div => {
    notesSections.push({
      name: div.querySelector('.note-title').textContent,
      content: div.querySelector('textarea').value
    });
  });
  state._notesSections = notesSections;

  return state;
}

function applyState(state) {
  Object.keys(state).forEach(k => {
    if (k.startsWith('_')) return;
    const el = document.getElementById(k);
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = state[k];
      if (k.startsWith('vis-')) markDone(k.replace('vis-', ''));
    } else {
      el.value = state[k] || '';
    }
  });
  NBME_FORMS.forEach((_, i) => {
    const id = 'nbme-' + i;
    const el = document.getElementById(id);
    if (el && state[id]) { el.checked = true; toggleExam(id); }
  });
  document.getElementById('session-body').innerHTML = '';
  const sRows = state._sessionRows || [];
  if (sRows.length > 0) sRows.forEach(r => addSessionRow(r));
  else for (let i = 0; i < 5; i++) addSessionRow();
  document.getElementById('missed-body').innerHTML = '';
  const mRows = state._missedRows || [];
  if (mRows.length > 0) mRows.forEach(r => addMissedRow(r));
  else for (let i = 0; i < 5; i++) addMissedRow();

  // Restore notes
  document.getElementById('notes-sections').innerHTML = '';
  const notes = state._notesSections || [];
  if (notes.length > 0) notes.forEach(n => addNotesSection(n.name, n.content));
  else addNotesSection('General Notes', '');

  updateProgress();
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
// NOTES
// ============================================================
function addNotesSection(name, content) {
  const inputEl = document.getElementById('new-section-name');
  const sectionName = name || (inputEl ? inputEl.value.trim() : '') || 'Notes';
  if (inputEl) inputEl.value = '';

  const id = 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const div = document.createElement('div');
  div.id = id;
  div.style.cssText = 'margin-bottom:20px';
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span class="note-title" style="font-size:14px;font-weight:500;color:var(--text)">${sectionName}</span>
      <button onclick="document.getElementById('${id}').remove();schedSave()" style="font-size:11px;color:var(--muted);background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px" onmouseover="this.style.background='var(--gray-light)'" onmouseout="this.style.background='none'">Remove</button>
    </div>
    <textarea oninput="schedSave()" placeholder="Type your notes here..." style="width:100%;min-height:140px;font-family:'DM Sans',sans-serif;font-size:13px;border:1px solid var(--border);border-radius:8px;padding:12px;outline:none;resize:vertical;line-height:1.7;color:var(--text);background:#fff">${content || ''}</textarea>
  `;
  document.getElementById('notes-sections').appendChild(div);
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
  document.getElementById('css-days').textContent = Math.max(0, Math.ceil((new Date('2026-06-12') - now) / 86400000));
  document.getElementById('step-days').textContent = Math.max(0, Math.ceil((new Date('2026-08-12') - now) / 86400000));
}

function updateProgress() {
  const done = TOPICS.filter(id => document.getElementById('vis-' + id)?.checked).length;
  document.getElementById('prog-text').textContent = done + ' / ' + TOPICS.length + ' topics visited';
  document.getElementById('prog-fill').style.width = (done / TOPICS.length * 100) + '%';
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

function addSessionRow(vals) {
  const tbody = document.getElementById('session-body');
  const tr = document.createElement('tr');
  const placeholders = ['Date', 'UW Qs', 'AMBOSS Qs', 'Systems', 'Notes'];
  tr.innerHTML = placeholders.map((p, i) =>
    `<td><input class="log-input" placeholder="${p}" value="${vals ? (vals[i] || '') : ''}" oninput="schedSave()"></td>`
  ).join('');
  tbody.appendChild(tr);
}

function addMissedRow(vals) {
  const tbody = document.getElementById('missed-body');
  const tr = document.createElement('tr');
  const placeholders = ['Topic', 'What you missed', 'UW / AMBOSS', 'Date'];
  tr.innerHTML = placeholders.map((p, i) =>
    `<td><input class="log-input" placeholder="${p}" value="${vals ? (vals[i] || '') : ''}" oninput="schedSave()"></td>`
  ).join('');
  tbody.appendChild(tr);
}

// ============================================================
// STEP 2 DASHBOARD — APP LOGIC + GOOGLE DRIVE SYNC
// ============================================================

const SCOPES = 'https://www.googleapis.com/auth/documents';
const TOPICS = ['ob','frepro','resp','cardio','endo','multi','blood','cns','gi','beh','bio','msk'];
const NBME_FORMS = ['Form 9','Form 10','Form 11','Form 12','Form 13','Form 14','Form 15','Form 16'];

const SHELF_SCORES = [
  { date: '2025-08-12', label: 'FM Shelf 1',      score: 82, type: 'shelf' },
  { date: '2025-09-12', label: 'FM Shelf 2',      score: 87, type: 'shelf' },
  { date: '2025-10-06', label: 'Peds Shelf 1',    score: 87, type: 'shelf' },
  { date: '2025-10-31', label: 'Peds Shelf 2',    score: 87, type: 'shelf' },
  { date: '2025-11-12', label: 'Surgery Shelf 1', score: 75, type: 'shelf' },
  { date: '2025-12-19', label: 'Surgery Shelf 2', score: 83, type: 'shelf' },
  { date: '2026-02-06', label: 'Psych CMS 5',     score: 82, type: 'cms'   },
  { date: '2026-02-08', label: 'Psych CMS 6',     score: 94, type: 'cms'   },
  { date: '2026-02-12', label: 'Psych CMS 7',     score: 84, type: 'cms'   },
  { date: '2026-02-13', label: 'Psych Shelf 1',   score: 94, type: 'shelf' },
  { date: '2026-03-20', label: 'OB/GYN Shelf 1',  score: 83, type: 'shelf' },
  { date: '2026-04-20', label: 'IM Shelf 1',      score: 88, type: 'shelf' },
  { date: '2026-05-29', label: 'IM Shelf 2',      score: 84, type: 'shelf' },
];

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

  // Active notes
  const notesSections = [];
  document.querySelectorAll('#notes-sections > div[id^="note-"]').forEach(div => {
    notesSections.push({
      name: div.querySelector('.note-title').textContent,
      content: div.querySelector('textarea').value
    });
  });
  state._notesSections = notesSections;

  // Archived notes
  const archivedSections = [];
  document.querySelectorAll('#archive-sections > div[id^="note-"]').forEach(div => {
    archivedSections.push({
      name: div.querySelector('.note-title').textContent,
      content: div.querySelector('textarea').value
    });
  });
  state._archivedSections = archivedSections;

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

  // Restore active notes
  document.getElementById('notes-sections').innerHTML = '';
  const notes = state._notesSections || [];
  if (notes.length > 0) notes.forEach(n => addNotesSection(n.name, n.content));
  else addNotesSection('General Notes', '');

  // Restore archived notes
  document.getElementById('archive-sections').innerHTML = '';
  const archived = state._archivedSections || [];
  archived.forEach(n => addArchivedSection(n.name, n.content));
  updateArchiveEmptyState();

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
  if (inputEl && !name) inputEl.value = '';

  const id = 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const div = document.createElement('div');
  div.id = id;
  div.style.cssText = 'margin-bottom:20px';

  const ta = document.createElement('textarea');
  ta.placeholder = 'Type your notes here...';
  ta.value = content || '';
  ta.oninput = () => schedSave();
  ta.style.cssText = "width:100%;min-height:140px;font-family:'DM Sans',sans-serif;font-size:13px;border:1px solid var(--border);border-radius:8px;padding:12px;box-sizing:border-box;outline:none;resize:vertical;line-height:1.7;color:var(--text);background:#fff;display:block";

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px';
  header.innerHTML = `
    <span class="note-title" style="font-size:14px;font-weight:500;color:var(--text)">${sectionName}</span>
    <button onclick="archiveNote('${id}')" style="font-size:11px;color:var(--muted);background:none;border:1px solid var(--border);cursor:pointer;padding:3px 9px;border-radius:4px;font-family:'DM Sans',sans-serif" onmouseover="this.style.background='var(--gold-light)';this.style.borderColor='var(--gold)';this.style.color='#7B5E1A'" onmouseout="this.style.background='none';this.style.borderColor='var(--border)';this.style.color='var(--muted)'">Archive</button>
  `;

  div.appendChild(header);
  div.appendChild(ta);
  document.getElementById('notes-sections').appendChild(div);
}

function archiveNote(id) {
  const div = document.getElementById(id);
  if (!div) return;
  const name = div.querySelector('.note-title').textContent;
  const content = div.querySelector('textarea').value;
  div.remove();
  addArchivedSection(name, content);
  updateArchiveEmptyState();
  schedSave();
}

// ============================================================
// ARCHIVES
// ============================================================
function addArchivedSection(name, content) {
  const emptyEl = document.getElementById('archive-empty');
  if (emptyEl) emptyEl.style.display = 'none';

  const id = 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const div = document.createElement('div');
  div.id = id;
  div.style.cssText = 'margin-bottom:20px';

  const ta = document.createElement('textarea');
  ta.placeholder = 'No content.';
  ta.value = content || '';
  ta.oninput = () => schedSave();
  ta.style.cssText = "width:100%;min-height:140px;font-family:'DM Sans',sans-serif;font-size:13px;border:1px solid var(--border);border-radius:8px;padding:12px;box-sizing:border-box;outline:none;resize:vertical;line-height:1.7;color:var(--text);background:var(--gray-light);display:block";

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px';
  header.innerHTML = `
    <span class="note-title" style="font-size:14px;font-weight:500;color:var(--muted)">${name}</span>
    <button onclick="unarchiveNote('${id}')" style="font-size:11px;color:var(--blue);background:none;border:1px solid var(--border);cursor:pointer;padding:3px 9px;border-radius:4px;font-family:'DM Sans',sans-serif" onmouseover="this.style.background='var(--blue-light)';this.style.borderColor='var(--blue-mid)'" onmouseout="this.style.background='none';this.style.borderColor='var(--border)'">Unarchive</button>
  `;

  div.appendChild(header);
  div.appendChild(ta);
  document.getElementById('archive-sections').appendChild(div);
}

function unarchiveNote(id) {
  const div = document.getElementById(id);
  if (!div) return;
  const name = div.querySelector('.note-title').textContent;
  const content = div.querySelector('textarea').value;
  div.remove();
  addNotesSection(name, content);
  updateArchiveEmptyState();
  schedSave();
}

function updateArchiveEmptyState() {
  const emptyEl = document.getElementById('archive-empty');
  if (!emptyEl) return;
  const hasItems = document.querySelectorAll('#archive-sections > div[id^="note-"]').length > 0;
  emptyEl.style.display = hasItems ? 'none' : 'block';
}

// ============================================================
// SHELF CHART
// ============================================================
function initShelfChart() {
  const now = new Date();
  document.getElementById('home-css-days').textContent =
    Math.max(0, Math.ceil((new Date('2026-06-12') - now) / 86400000));
  document.getElementById('home-step-days').textContent =
    Math.max(0, Math.ceil((new Date('2026-08-12') - now) / 86400000));

  const labels = SHELF_SCORES.map(s => s.label);
  const scores = SHELF_SCORES.map(s => s.score);

  const avgLine = scores.map((_, i) => {
    const slice = scores.slice(0, i + 1);
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10;
  });

  const pointColors = SHELF_SCORES.map(s => s.type === 'cms' ? '#C9A84C' : '#2B6CB0');
  const pointBorderColors = SHELF_SCORES.map(s => s.type === 'cms' ? '#C9A84C' : '#2B6CB0');

  const ctx = document.getElementById('shelf-chart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Score (blue = shelf/EPC, gold = CMS)',
          data: scores,
          borderColor: '#2B6CB0',
          backgroundColor: 'rgba(43,108,176,0.07)',
          pointBackgroundColor: pointColors,
          pointBorderColor: pointBorderColors,
          pointRadius: 7,
          pointHoverRadius: 9,
          tension: 0.3,
          fill: true,
          order: 2,
        },
        {
          label: 'Running Average',
          data: avgLine,
          borderColor: '#C9A84C',
          borderDash: [5, 4],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
          order: 1,
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            font: { family: "'DM Mono', monospace", size: 11 },
            color: '#718096',
            boxWidth: 28,
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label.split('(')[0].trim()}: ${ctx.parsed.y}%`
          }
        }
      },
      scales: {
        y: {
          min: 60,
          max: 100,
          ticks: {
            font: { family: "'DM Mono', monospace", size: 11 },
            color: '#718096',
            callback: v => v + '%'
          },
          grid: { color: '#E2E8F0' }
        },
        x: {
          ticks: {
            font: { family: "'DM Mono', monospace", size: 10 },
            color: '#718096',
            maxRotation: 40,
          },
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

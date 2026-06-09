// ── FOCUS ADVISOR ─────────────────────────────────────────
function injectAdvisor() {
  // Advisor FAB and modal are now static in index.html.
  // Just wire up the backdrop click handler (onclick attr handles it declaratively).
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

  const systemPrompt = `You are a USMLE Step 2 CK study advisor for Thomas, a medical student (exam Aug 12 2026). Build concrete daily study schedules from the data he provides. Rules: group related topics per block; respect HIGH→MEDIUM→LOW priority order; low energy = recognition/diagnosis tasks first, high energy = mechanism/cause questions (his hardest type); leave ~15% buffer by under-filling time (never add a "Buffer" line); output clean topic names only (no time or priority labels inline); end with a 1–2 sentence rationale. Respond ONLY with valid JSON: {"blocks":[{"label":"Block 1","totalMinutes":180,"topics":[{"name":"Topic","minutes":60,"note":"why"}]}],"rationale":"..."}`;

  const userMsg =
`OPEN TOPICS:
${topicList || 'None'}

UPCOMING EXAMS:
${examTimeline.join('\n') || 'None'}

CALENDAR:
${calItems.join('\n') || 'None'}

SESSION LOG (last 20):
${sessionLogs.join('\n') || 'None'}

REQUEST: ${blocks} block(s) × ${hours}h, energy=${advisorEnergy}${extra ? ', notes: ' + extra : ''}`;

  try {
    const resp = await fetch('https://fragrant-wind-ad59.thomas31406.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMsg }]
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
  const trainSystem = `Parse study session logs from Thomas, a USMLE Step 2 CK student. Extract structured data and respond ONLY with valid JSON: {"date":"YYYY-MM-DD","summary":"1-line summary","topics":["topic1"],"totalMinutes":90,"difficulty":"easy|medium|hard","notes":"observations"}. Estimate time conservatively if unclear. Topics should match USMLE subject areas.`;

  const trainMsg = `Date: ${today}\nEntry: "${text}"`;

  try {
    const resp = await fetch('https://fragrant-wind-ad59.thomas31406.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 400,
        system: [{ type: 'text', text: trainSystem, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: trainMsg }]
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
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

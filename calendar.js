
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

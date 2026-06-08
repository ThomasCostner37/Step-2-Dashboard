// ============================================================
// POMODORO ENGINE
// ============================================================

// ── Pomodoro Edit Popover ──────────────────────────────────
function pomOpenEdit(e) {
  ensureHeaderWidgets();

  const pop = document.getElementById('pom-edit-pop');
  if (!pop) return;

  const anchor =
    e?.currentTarget ||
    document.getElementById('pom-header-section') ||
    document.getElementById('focus-pom-start-btn');

  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();

  pop.style.display = 'block';

  const pw = 260;
  const ph = 90;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rect.left;
  let top = rect.bottom + 8;

  if (left + pw > vw - 16) left = vw - pw - 16;
  if (top + ph > vh - 16) top = rect.top - ph - 8;

  pop.style.left = Math.max(16, left) + 'px';
  pop.style.top = Math.max(16, top) + 'px';
  pop.style.right = 'auto';
  pop.style.transform = 'none';
}

function pomCloseEdit() {
  const pop = document.getElementById('pom-edit-pop');
  if (pop) pop.style.display = 'none';
}

function pomSaveEdit() {
  pomCloseEdit();
  pomReset();
}

// ── Pomodoro State ─────────────────────────────────────────
let pomInterval = null;
let pomRunning = false;
let pomPhase = 'work';
let pomSecondsLeft = 45 * 60;

// ── Pomodoro Helpers ───────────────────────────────────────
function pomGetWork() {
  return parseInt(document.getElementById('pom-work-inp')?.value || 45) * 60;
}

function pomGetBreak() {
  return parseInt(document.getElementById('pom-break-inp')?.value || 15) * 60;
}

// ── Pomodoro Controls ──────────────────────────────────────
function pomToggle() {
  if (pomRunning) {
    clearInterval(pomInterval);
    pomRunning = false;
  } else {
    if (pomSecondsLeft === 45 * 60 || pomSecondsLeft <= 0) {
      pomSecondsLeft = pomGetWork();
      pomPhase = 'work';
    }

    pomRunning = true;
    clearInterval(pomInterval);
    pomInterval = setInterval(pomTick, 1000);
  }

  pomRender();
}

function pomTick() {
  pomSecondsLeft--;

  if (pomSecondsLeft <= 0) {
    pomPhaseEnd();
  } else {
    pomRender();
  }
}

function pomPhaseEnd() {
  clearInterval(pomInterval);
  pomRunning = false;

  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = pomPhase === 'work' ? 523 : 440;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch (e) {}

  pomPhase = pomPhase === 'work' ? 'break' : 'work';
  pomSecondsLeft = pomPhase === 'work' ? pomGetWork() : pomGetBreak();

  pomRender();
}

function pomReset() {
  clearInterval(pomInterval);
  pomRunning = false;
  pomPhase = 'work';
  pomSecondsLeft = pomGetWork();
  pomRender();
}

// ── Pomodoro Render ────────────────────────────────────────
function pomRender() {
  const mins = Math.floor(pomSecondsLeft / 60);
  const secs = pomSecondsLeft % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const phaseStr = pomPhase === 'work' ? 'Work' : 'Break';

  const hdrTime = document.getElementById('hdr-pom-time');
  const hdrPhase = document.getElementById('hdr-pom-phase');
  const hdrStart = document.getElementById('hdr-pom-start');

  if (hdrTime) hdrTime.textContent = timeStr;

  if (hdrPhase) {
    hdrPhase.textContent = phaseStr;
    hdrPhase.className = 'hdr-pom-phase' + (pomPhase === 'break' ? ' break' : '');
  }

  if (hdrStart) {
    hdrStart.textContent = pomRunning ? '⏸' : '▶';
  }

  const fTime = document.getElementById('focus-pom-time');
  const fPhase = document.getElementById('focus-pom-phase');
  const fStart = document.getElementById('focus-pom-start-btn');

  const phaseCls = 'pom-phase' + (pomPhase === 'break' ? ' break' : '');
  const btnLabel =
    pomRunning
      ? 'Pause'
      : pomSecondsLeft < pomGetWork() && pomPhase === 'work'
        ? 'Resume'
        : 'Start';

  if (fTime) fTime.textContent = timeStr;

  if (fPhase) {
    fPhase.textContent = phaseStr;
    fPhase.className = phaseCls;
  }

  if (fStart) {
    fStart.textContent = btnLabel;
  }

  document.title = pomRunning ? `${timeStr} · Step 2` : 'Step 2 — Study Dashboard';
}

function initPomDisplay() {
  pomSecondsLeft = pomGetWork();
  pomRender();
}

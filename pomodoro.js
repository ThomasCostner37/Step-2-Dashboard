// POMODORO ENGINE

// -- Pomodoro Edit Popover --
function pomOpenEdit(btn) {
  if (!document.getElementById('pom-edit-pop')) {
    var pop = document.createElement('div');
    pop.id = 'pom-edit-pop';
    pop.className = 'pom-edit-pop';
    pop.style.display = 'none';
    pop.innerHTML =
      '<div style="display:flex;gap:10px;align-items:flex-end">' +
        '<div><div class="pom-set-label">Work (min)</div>' +
        '<input class="input" type="number" id="pom-work-inp" value="45" min="1" max="180" style="width:70px;text-align:center"></div>' +
        '<div><div class="pom-set-label">Break (min)</div>' +
        '<input class="input" type="number" id="pom-break-inp" value="15" min="1" max="60" style="width:70px;text-align:center"></div>' +
        '<button class="btn btn-primary btn-sm" onclick="pomSaveEdit()">Set</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="pomCloseEdit()">X</button>' +
      '</div>';
    document.body.appendChild(pop);
    document.addEventListener('click', function(ev) {
      var p = document.getElementById('pom-edit-pop');
      var t = ev.target;
      if (!p || p.style.display === 'none') return;
      if (p.contains(t)) return;
      if (t && t.id === 'focus-pom-edit-btn') return;
      var hdrBtns = t && typeof t.closest === 'function' ? t.closest('.hdr-pom-btns') : null;
      if (hdrBtns) return;
      pomCloseEdit();
    });
  }

  var pop = document.getElementById('pom-edit-pop');
  var anchor = (btn instanceof Element) ? btn
    : document.getElementById('focus-pom-edit-btn')
    || document.getElementById('pom-header-section');

  pop.style.display = 'block';
  if (!anchor) return;

  var rect = anchor.getBoundingClientRect();
  var pw = 260, ph = 90;
  var vw = window.innerWidth, vh = window.innerHeight;
  var left = rect.left;
  var top  = rect.bottom + 8;
  if (left + pw > vw - 16) left = vw - pw - 16;
  if (top  + ph > vh - 16) top  = rect.top - ph - 8;
  pop.style.left      = Math.max(16, left) + 'px';
  pop.style.top       = Math.max(16, top)  + 'px';
  pop.style.right     = 'auto';
  pop.style.transform = 'none';
}

function pomCloseEdit() {
  var pop = document.getElementById('pom-edit-pop');
  if (pop) pop.style.display = 'none';
}

function pomSaveEdit() {
  pomCloseEdit();
  pomReset();
}

// -- Pomodoro State --
var pomInterval = null;
var pomRunning = false;
var pomPhase = 'work';
var pomSecondsLeft = 45 * 60;

// -- Pomodoro Helpers --
function pomGetWork() {
  var el = document.getElementById('pom-work-inp');
  return parseInt(el ? el.value : '45') * 60;
}

function pomGetBreak() {
  var el = document.getElementById('pom-break-inp');
  return parseInt(el ? el.value : '15') * 60;
}

// -- Pomodoro Controls --
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
    var ctx  = new AudioContext();
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
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

// -- Pomodoro Render --
function pomRender() {
  var mins     = Math.floor(pomSecondsLeft / 60);
  var secs     = pomSecondsLeft % 60;
  var timeStr  = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  var phaseStr = pomPhase === 'work' ? 'Work' : 'Break';

  var hdrTime  = document.getElementById('hdr-pom-time');
  var hdrPhase = document.getElementById('hdr-pom-phase');
  var hdrStart = document.getElementById('hdr-pom-start');

  if (hdrTime)  hdrTime.textContent  = timeStr;
  if (hdrPhase) {
    hdrPhase.textContent = phaseStr;
    hdrPhase.className   = 'hdr-pom-phase' + (pomPhase === 'break' ? ' break' : '');
  }
  if (hdrStart) hdrStart.textContent = pomRunning ? '||' : '>';

  var fTime  = document.getElementById('focus-pom-time');
  var fPhase = document.getElementById('focus-pom-phase');
  var fStart = document.getElementById('focus-pom-start-btn');

  var phaseCls = 'pom-phase' + (pomPhase === 'break' ? ' break' : '');
  var btnLabel = pomRunning ? 'Pause'
    : (pomSecondsLeft < pomGetWork() && pomPhase === 'work') ? 'Resume'
    : 'Start';

  if (fTime)  fTime.textContent  = timeStr;
  if (fPhase) {
    fPhase.textContent = phaseStr;
    fPhase.className   = phaseCls;
  }
  if (fStart) fStart.textContent = btnLabel;

  document.title = pomRunning ? (timeStr + ' - Step 2') : 'Step 2 - Study Dashboard';
}

function initPomDisplay() {
  pomSecondsLeft = pomGetWork();
  pomRender();
}
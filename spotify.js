// ============================================================
// SPOTIFY + FOCUS TAB ENGINE
// ============================================================

const SPOTIFY_CLIENT_ID   = '94cd31c97d794f559cbe307b3b91f919';
const SPOTIFY_REDIRECT    = 'https://thomascostner37.github.io/Step-2-Dashboard/';
const SPOTIFY_SCOPES      = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'streaming',
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-modify',
  'user-library-read',
  'user-read-recently-played',
].join(' ');

// ============================================================
//  STATE  (rebuilt: full integration — remote + in-browser player)
// ============================================================
let spToken          = localStorage.getItem('sp_token') || null;
let spRefresh        = localStorage.getItem('sp_refresh') || null;
let spExpiresAt      = parseInt(localStorage.getItem('sp_expires_at') || '0', 10) || 0;
let spRefreshTimer   = null;

let spPlayer         = null;   // Web Playback SDK instance (this browser as a device)
let spSdkDeviceId    = null;   // device id of the SDK player
let spSdkReady       = false;
let spPremium        = true;   // assume premium until the SDK says otherwise

let spActiveDeviceId = null;   // currently active device (from /me/player)
let spActiveDevice   = null;   // full device object

let spPollTimer      = null;
let spProgressRaf    = null;

let spCurrentTrackUri = null;
let spLastProgress    = 0;
let spLastDuration    = 0;
let spLastPollTime    = Date.now();
let spIsPlaying       = false;
let spShuffleState    = false;
let spRepeatState     = 'off';
let spIsLiked         = false;
let spIsPodcast       = false;
let spAddMode         = false;
let spShowingLastPlayed = false;

let spUserId   = null;
let spUserName = null;
let spVolume   = 60;

const ALL_QUOTES = [
  { text:"The difference between the impossible and the possible lies in a person's determination.", attr:"Tommy Lasorda" },
  { text:"You have to fight to reach your dream. You have to sacrifice and work hard for it.", attr:"Lionel Messi" },
  { text:"Hard work beats talent when talent doesn't work hard.", attr:"Tim Notke" },
  { text:"Champions aren't made in the gyms. Champions are made from something they have deep inside them.", attr:"Muhammad Ali" },
  { text:"Don't wish it were easier. Wish you were better.", attr:"Jim Rohn" },
  { text:"The more I practice, the luckier I get.", attr:"Gary Player" },
  { text:"It's not whether you get knocked down; it's whether you get up.", attr:"Vince Lombardi" },
  { text:"The pain you feel today will be the strength you feel tomorrow.", attr:"Anonymous" },
  { text:"Obsessed is a word the lazy use to describe the dedicated.", attr:"Anonymous" },
  { text:"You don't get what you wish for. You get what you work for.", attr:"Anonymous" },
  { text:"Somewhere someone is working harder than you. Don't let them win.", attr:"Anonymous" },
  { text:"Outwork everyone. Every single day.", attr:"Anonymous" },
  { text:"The best never rest.", attr:"Anonymous" },
  { text:"Success is the sum of small efforts repeated day in and day out.", attr:"Robert Collier" },
  { text:"Excellence is not a destination but a continuous journey that never ends.", attr:"Anonymous" },
  { text:"Every patient you'll ever treat is counting on the version of you that didn't quit.", attr:"Anonymous" },
  { text:"You chose medicine because you wanted to matter. Remember that on the hard days.", attr:"Anonymous" },
  { text:"The exam is just a gate. What you become getting through it is what actually counts.", attr:"Anonymous" },
  { text:"Medicine is hard because it has to be. Patients can't afford for it to be easy.", attr:"Anonymous" },
  { text:"Your future patients don't know your name yet, but they're already counting on you.", attr:"Anonymous" },
  { text:"The road is long, but so is the reward.", attr:"Anonymous" },
  { text:"One more question. One more page. One more day closer.", attr:"Anonymous" },
  { text:"You have power over your mind, not outside events. Realize this, and you will find strength.", attr:"Marcus Aurelius" },
  { text:"Waste no more time arguing what a good man should be. Be one.", attr:"Marcus Aurelius" },
  { text:"It is not the mountain we conquer, but ourselves.", attr:"Edmund Hillary" },
  { text:"The impediment to action advances action. What stands in the way becomes the way.", attr:"Marcus Aurelius" },
  { text:"He who fears death will never do anything worthy of a living man.", attr:"Seneca" },
  { text:"Difficulties strengthen the mind as labor does the body.", attr:"Seneca" },
  { text:"We suffer more in imagination than in reality.", attr:"Seneca" },
  { text:"It does not matter how slowly you go as long as you do not stop.", attr:"Confucius" },
  { text:"I hated every minute of training, but I said: don't quit. Suffer now and live the rest of your life as a champion.", attr:"Muhammad Ali" },
  { text:"The only person you are destined to become is the person you decide to be.", attr:"Ralph Waldo Emerson" },
  { text:"Talent is cheaper than table salt. What separates the talented individual from the successful one is hard work.", attr:"Stephen King" },
  { text:"Great works are performed not by strength but by perseverance.", attr:"Samuel Johnson" },
  { text:"The secret of getting ahead is getting started.", attr:"Mark Twain" },
  { text:"Don't count the days. Make the days count.", attr:"Muhammad Ali" },
  { text:"Energy and persistence conquer all things.", attr:"Benjamin Franklin" },
  { text:"I am not a product of my circumstances. I am a product of my decisions.", attr:"Stephen Covey" },
];

let focusQuoteIdx   = Math.floor(Math.random() * ALL_QUOTES.length);
let focusQuoteTimer = null;
let focusRightMode  = 'playlists';

function svgShuffle(active) {
  const c = active ? '#1DB954' : 'currentColor';
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line></svg>`;
}

function svgRepeat(state) {
  const c = state !== 'off' ? '#1DB954' : 'currentColor';
  const inner = state === 'track'
    ? `<text x="10" y="14" font-size="7" fill="${c}" stroke="none" font-weight="bold">1</text>`
    : '';
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path>${inner}</svg>`;
}

function svgHeart(filled) {
  return filled
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954" stroke="#1DB954" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
}

function svgAddToPlaylist(active) {
  const c = active ? '#1DB954' : 'currentColor';
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="15" y2="6"></line><line x1="3" y1="10" x2="12" y2="10"></line><line x1="3" y1="14" x2="10" y2="14"></line><circle cx="18" cy="16" r="4"></circle><line x1="18" y1="13" x2="18" y2="19"></line><line x1="15" y1="16" x2="21" y2="16"></line></svg>`;
}

// ── Inject tab ────────────────────────────────────────────
function injectSpotifyTab() {
  const tabBar = document.querySelector('.tab-bar');
  const app    = document.getElementById('app');

  if (tabBar && !document.getElementById('btn-focus')) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn'; btn.id = 'btn-focus';
    btn.onclick = () => showTab('focus');
    btn.textContent = 'Focus';
    tabBar.appendChild(btn);
  }

  if (app && !document.getElementById('tab-focus')) {
    const panel = document.createElement('div');
    panel.id = 'tab-focus'; panel.className = 'tab-panel';
    panel.innerHTML = `
      <div class="focus-tab-grid">
        <div class="sp-card" style="height:calc(100vh - 180px);min-height:620px;max-height:760px;display:flex;flex-direction:column;overflow:hidden;padding-top:22px;padding-bottom:28px;padding-left:28px;padding-right:28px">
          <div class="dash-head" style="margin-bottom:10px">
            <div class="dash-title">Now Playing</div>
          </div>
          <div id="sp-main-content" style="flex:1;min-height:0;display:flex;flex-direction:column">
            <div class="sp-idle">Not connected to Spotify</div>
            <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">Connect Spotify</button>
          </div>
        </div>
        <div class="pom-card" style="height:calc(100vh - 180px);min-height:620px;max-height:760px;display:flex;flex-direction:column;overflow:hidden">
          <div style="margin-bottom:1.1rem">
            <div class="dash-title" style="margin-bottom:.6rem">Pomodoro</div>
            <div class="pom-display" style="margin:.4rem 0 .7rem">
              <div class="pom-time" id="focus-pom-time">45:00</div>
              <div class="pom-phase" id="focus-pom-phase">Work</div>
            </div>
            <div class="pom-controls" style="margin-bottom:0">
              <button class="pom-btn" onclick="pomReset()">Reset</button>
              <button class="pom-btn primary" id="focus-pom-start-btn" onclick="pomToggle()">Start</button>
              <button class="pom-btn" id="focus-pom-edit-btn" onclick="pomOpenEdit(this)">Edit</button>
            </div>
          </div>
          <div style="height:1px;background:var(--border);margin-bottom:1rem"></div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.7rem">
            <div class="dash-title" id="focus-right-title">Playlists</div>
            <div style="display:flex;gap:3px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--r-sm);padding:3px">
              <button class="advisor-tab-btn active" id="focus-btn-playlists" onclick="setFocusRight('playlists')">Playlists</button>
              <button class="advisor-tab-btn" id="focus-btn-quotes" onclick="setFocusRight('quotes')">Quotes</button>
            </div>
          </div>
          <div id="focus-playlists-panel" style="flex:1;overflow-y:auto;min-height:0">
            <input id="sp-playlist-search" class="input" placeholder="Search playlists…"
              style="width:100%;margin-bottom:.5rem;font-size:.78rem;padding:.3rem .5rem;box-sizing:border-box"
              oninput="filterPlaylists(this.value)">
            <div id="sp-playlists-list">
              <div class="sp-idle" style="padding:1rem 0">Connect Spotify to see your playlists</div>
            </div>
          </div>
          <div id="focus-quotes-panel" style="display:none;flex-direction:column;flex:1;min-height:0">
            <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:1rem 0">
              <div id="focus-quote-text" style="font-family:var(--font-display);font-style:italic;font-size:1.45rem;color:var(--text-secondary);line-height:1.75;transition:opacity .5s ease;margin-bottom:1rem;text-align:center"></div>
              <div id="focus-quote-attr" style="font-family:var(--font-mono);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-tertiary);transition:opacity .5s ease;text-align:center"></div>
            </div>
            <div class="quote-nav-btns" style="display:flex;gap:8px;justify-content:center;padding-bottom:.5rem">
              <button class="btn btn-ghost btn-sm" onclick="prevFocusQuote()">‹ Prev</button>
              <button class="btn btn-ghost btn-sm" onclick="nextFocusQuote()">Next ›</button>
            </div>
          </div>
        </div>
      </div>`;
    app.appendChild(panel);
  }

  ensureHeaderWidgets();
  observeFocusCardHeight();
}

// ── Card height sync ──────────────────────────────────────
var _focusCardRO = null;
function syncFocusCardHeights() {
  var sp  = document.querySelector('#tab-focus .sp-card');
  var pom = document.querySelector('#tab-focus .pom-card');
  if (!sp || !pom) return;

  if (window.innerWidth <= 700) {
    sp.style.height = '';
    pom.style.height = '';
    return;
  }

  var h = Math.max(620, Math.min(window.innerHeight - 180, 760));
  sp.style.height = h + 'px';
  pom.style.height = h + 'px';
}

function observeFocusCardHeight() {
  var sp = document.querySelector('#tab-focus .sp-card');
  if (!sp) return;
  if (_focusCardRO) _focusCardRO.disconnect();
  if (typeof ResizeObserver !== 'undefined') {
    _focusCardRO = new ResizeObserver(syncFocusCardHeights);
    _focusCardRO.observe(sp);
  }
  window.addEventListener('resize', syncFocusCardHeights);
  requestAnimationFrame(syncFocusCardHeights);
}

// ── Focus right panel + quotes ────────────────────────────
function setFocusRight(mode) {
  focusRightMode = mode;
  document.getElementById('focus-btn-playlists')?.classList.toggle('active', mode === 'playlists');
  document.getElementById('focus-btn-quotes')?.classList.toggle('active', mode === 'quotes');
  const pp = document.getElementById('focus-playlists-panel');
  const qp = document.getElementById('focus-quotes-panel');
  if (pp) pp.style.display = mode === 'playlists' ? 'block' : 'none';
  if (qp) qp.style.display = mode === 'quotes'    ? 'flex'  : 'none';
  document.getElementById('focus-right-title').textContent = mode === 'playlists' ? 'Playlists' : 'Quotes';
  if (mode === 'quotes') startFocusQuotes(); else stopFocusQuotes();
}

// ── Quotes ────────────────────────────────────────────────
function showFocusQuote(idx) {
  const qt = document.getElementById('focus-quote-text');
  const qa = document.getElementById('focus-quote-attr');
  if (!qt || !qa) return;
  qt.style.opacity = '0'; qa.style.opacity = '0';
  setTimeout(() => {
    const q = ALL_QUOTES[idx];
    qt.textContent = '\u201C' + q.text + '\u201D';
    qa.textContent = q.attr ? '\u2014 ' + q.attr.toUpperCase() : '';
    qt.style.opacity = '1'; qa.style.opacity = '1';
  }, 500);
}
function nextFocusQuote() { focusQuoteIdx = (focusQuoteIdx + 1) % ALL_QUOTES.length; showFocusQuote(focusQuoteIdx); resetFocusQuoteTimer(); }
function prevFocusQuote() { focusQuoteIdx = (focusQuoteIdx - 1 + ALL_QUOTES.length) % ALL_QUOTES.length; showFocusQuote(focusQuoteIdx); resetFocusQuoteTimer(); }
function startFocusQuotes() { showFocusQuote(focusQuoteIdx); focusQuoteTimer = setInterval(nextFocusQuote, 10000); }
function stopFocusQuotes()  { clearInterval(focusQuoteTimer); focusQuoteTimer = null; }
function resetFocusQuoteTimer() { clearInterval(focusQuoteTimer); focusQuoteTimer = setInterval(nextFocusQuote, 10000); }

// ── Playlist search ───────────────────────────────────────
let _allPlaylists = [];

function filterPlaylists(q) {
  const container = document.getElementById('sp-playlists-list');
  if (!container || !_allPlaylists.length) return;
  const term = q.trim().toLowerCase();
  renderPlaylistRows(term ? _allPlaylists.filter(pl => pl.name.toLowerCase().includes(term)) : _allPlaylists, container);
}

// ── Playlist rows (with editable flag for add-mode) ───────
function renderPlaylistRows(playlists, container) {
  container.innerHTML = '';
  if (!playlists.length) { container.innerHTML = '<div class="sp-idle" style="padding:.5rem 0">No playlists match</div>'; return; }
  playlists.forEach(function(pl) {
    if (!pl) return;
    let img = '';
    if (pl.images && pl.images[0]) img = pl.images[0].url;
    const ownerId = pl.owner ? pl.owner.id : '';
    const editable = (spUserId && ownerId === spUserId) || pl.collaborative === true;
    const div = document.createElement('div');
    div.className = 'sp-playlist-row';
    div.dataset.uri = pl.uri;
    div.dataset.editable = editable ? '1' : '0';
    div.onmouseenter = function() { div.style.background = 'var(--bg-elevated)'; div.style.borderColor = 'var(--border)'; };
    div.onmouseleave = function() { div.style.background = ''; div.style.borderColor = 'transparent'; };
    const imgHtml = img
      ? '<img src="' + escH(img) + '" style="width:38px;height:38px;border-radius:4px;object-fit:cover;flex-shrink:0">'
      : '<div style="width:38px;height:38px;border-radius:4px;background:var(--bg-elevated);flex-shrink:0"></div>';
    const owner = pl.owner ? (pl.owner.display_name || '') : '';
    div.innerHTML = imgHtml +
      '<div class="sp-playlist-meta"><div class="sp-playlist-name">' + escH(pl.name) + '</div>' +
      '<div class="sp-playlist-count">' + escH(owner) + '</div></div>' +
      '<div class="sp-playlist-play">\u25B6</div>';
    container.appendChild(div);
  });
  rebindPlaylistRows();
}

function rebindPlaylistRows() {
  const rows = document.querySelectorAll('.sp-playlist-row');
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const uri = row.dataset.uri || '';
    const editable = row.dataset.editable === '1';
    const nameEl = row.querySelector('.sp-playlist-name');
    const nm = nameEl ? nameEl.textContent : '';
    if (spAddMode) {
      if (editable) { row.style.opacity = ''; row.onclick = function() { spAddToPlaylist(uri, nm); }; }
      else { row.style.opacity = '.4'; row.onclick = function() { showToast('Read-only playlist \u2014 can\u2019t add here', 2000); }; }
    } else {
      row.style.opacity = '';
      row.onclick = function() { playSpotifyPlaylist(uri, nm); };
    }
  }
}

async function fetchSpotifyPlaylists() {
  if (!spToken) return;
  const container = document.getElementById('sp-playlists-list');
  if (!container) return;
  if (!_allPlaylists.length) container.innerHTML = '<div class="sp-idle" style="padding:.5rem 0">Loading playlists\u2026</div>';
  try {
    const resp = await spFetch('https://api.spotify.com/v1/me/playlists?limit=50', {});
    if (!resp.ok) { container.innerHTML = '<div class="sp-idle">Could not load playlists (' + resp.status + ')</div>'; return; }
    const data = await resp.json();
    _allPlaylists = (data && data.items ? data.items : []).filter(Boolean);
    renderPlaylistRows(_allPlaylists, container);
  } catch(e) { container.innerHTML = '<div class="sp-idle">Could not load playlists</div>'; }
}

// -- Auth (PKCE) --
function spotifyLogin() {
  const verifier = generateCodeVerifier(128);
  localStorage.setItem('sp_verifier', verifier);
  generateCodeChallenge(verifier).then(challenge => {
    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID, response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT, scope: SPOTIFY_SCOPES,
      code_challenge_method: 'S256', code_challenge: challenge,
    });
    window.location = `https://accounts.spotify.com/authorize?${params}`;
  });
}

function generateCodeVerifier(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return Array.from(crypto.getRandomValues(new Uint8Array(length))).map(b => possible[b % possible.length]).join('');
}

async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

// ── Authenticated fetch (auto-refresh on 401) ─────────────
async function spFetch(url, opts, _retried) {
  opts = opts || {};
  const headers = Object.assign({}, opts.headers || {});
  headers['Authorization'] = 'Bearer ' + spToken;
  const finalOpts = Object.assign({}, opts);
  finalOpts.headers = headers;
  let resp;
  try { resp = await fetch(url, finalOpts); }
  catch (e) { return { ok: false, status: 0, json: async function() { return null; } }; }
  if (resp.status === 401 && !_retried) {
    const ok = await refreshSpotifyToken();
    if (ok) return spFetch(url, opts, true);
  }
  return resp;
}

function storeTokens(data) {
  spToken = data.access_token;
  localStorage.setItem('sp_token', spToken);
  if (data.refresh_token) { spRefresh = data.refresh_token; localStorage.setItem('sp_refresh', spRefresh); }
  const ttl = (data.expires_in || 3600) * 1000;
  spExpiresAt = Date.now() + ttl;
  localStorage.setItem('sp_expires_at', String(spExpiresAt));
  scheduleTokenRefresh();
}

function scheduleTokenRefresh() {
  clearTimeout(spRefreshTimer);
  let delay = spExpiresAt - Date.now() - 60000;   // refresh 60s before expiry
  if (delay < 0) delay = 0;
  spRefreshTimer = setTimeout(function() { refreshSpotifyToken(); }, delay);
}

async function refreshSpotifyToken() {
  if (!spRefresh) return false;
  try {
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'refresh_token', refresh_token: spRefresh })
    });
    const data = await resp.json();
    if (data && data.access_token) { storeTokens(data); return true; }
  } catch (e) {}
  return false;
}

async function exchangeSpotifyCode(code) {
  const verifier = localStorage.getItem('sp_verifier');
  if (!verifier) return;
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, grant_type: 'authorization_code', code: code, redirect_uri: SPOTIFY_REDIRECT, code_verifier: verifier })
  });
  const data = await resp.json();
  if (data && data.access_token) {
    storeTokens(data);
    localStorage.removeItem('sp_verifier');
    window.history.replaceState({}, '', window.location.pathname);
    startSpotifyEngine();
  }
}

// ── Init / engine bootstrap ───────────────────────────────
function initSpotify() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) { exchangeSpotifyCode(code); return; }
  if (!spToken) return;
  if (spExpiresAt && spExpiresAt - Date.now() < 60000) {
    refreshSpotifyToken().then(function() { startSpotifyEngine(); });
  } else {
    scheduleTokenRefresh();
    startSpotifyEngine();
  }
}

function startSpotifyEngine() {
  if (!spToken) return;
  loadSpotifySdk();
  fetchSpotifyProfile();
  startSpotifyPoll();
  fetchSpotifyPlaylists();
  wireSpotifyVisibility();
}

function loadSpotifySdk() {
  if (window.Spotify) { initSpotifyPlayer(); return; }
  if (document.getElementById('sp-sdk')) return;
  window.onSpotifyWebPlaybackSDKReady = function() { initSpotifyPlayer(); };
  const s = document.createElement('script');
  s.id = 'sp-sdk'; s.src = 'https://sdk.scdn.co/spotify-player.js';
  document.head.appendChild(s);
}

function initSpotifyPlayer() {
  if (!window.Spotify || !spToken || spPlayer) return;
  spPlayer = new Spotify.Player({
    name: 'Step 2 Dashboard',
    getOAuthToken: function(cb) { cb(spToken); },
    volume: spVolume / 100
  });
  spPlayer.addListener('ready', function(e) { spSdkDeviceId = e.device_id; spSdkReady = true; updateDeviceUi(); });
  spPlayer.addListener('not_ready', function() { spSdkReady = false; });
  spPlayer.addListener('player_state_changed', function(state) { if (state) applySdkState(state); });
  spPlayer.addListener('initialization_error', function() { spPremium = false; });
  spPlayer.addListener('authentication_error', async function() { const ok = await refreshSpotifyToken(); if (ok && spPlayer) spPlayer.connect(); });
  spPlayer.addListener('account_error', function() { spPremium = false; showToast('Spotify Premium is required to play in the browser', 3200); });
  spPlayer.connect();
}

function applySdkState(state) {
  const tw = state.track_window;
  if (!tw || !tw.current_track) return;
  const tr = tw.current_track;
  spLastProgress = state.position || 0;
  spLastDuration = state.duration || 0;
  spLastPollTime = Date.now();
  spIsPlaying    = !state.paused;
  spShuffleState = !!state.shuffle;
  spRepeatState  = state.repeat_mode === 2 ? 'track' : (state.repeat_mode === 1 ? 'context' : 'off');
  const uri = tr.uri;
  const isEp = tr.type === 'episode';
  if (uri !== spCurrentTrackUri) {
    spCurrentTrackUri = uri;
    spIsPodcast = isEp;
    spShowingLastPlayed = false;
    checkSavedState(uri, isEp);
    let art = '';
    if (tr.album && tr.album.images && tr.album.images[0]) art = tr.album.images[0].url;
    let artist = '';
    if (isEp) { artist = (tr.album && tr.album.name) ? tr.album.name : 'Podcast'; }
    else if (tr.artists) { artist = tr.artists.map(function(a){ return a.name; }).join(', '); }
    renderNowPlayingDirect({
      isPlaying: !state.paused, trackName: tr.name, artistName: artist,
      albumArt: art, albumName: (tr.album && tr.album.name) || '',
      progress: state.position, duration: state.duration, trackUri: uri, isPodcast: isEp
    });
  } else {
    updatePlayPauseButtons(spIsPlaying);
    updateShuffleRepeatButtons();
  }
}

async function fetchSpotifyProfile() {
  try {
    const resp = await spFetch('https://api.spotify.com/v1/me', {});
    if (!resp.ok) return;
    const me = await resp.json();
    if (me) { spUserId = me.id; spUserName = me.display_name || me.id; }
  } catch(e) {}
}

// ── Polling (visibility-aware) + smooth progress ──────────
function startSpotifyPoll() {
  clearInterval(spPollTimer);
  cancelAnimationFrame(spProgressRaf);
  fetchNowPlaying();
  spPollTimer = setInterval(fetchNowPlaying, 3000);
  startProgressLoop();
}

function stopSpotifyPoll() {
  clearInterval(spPollTimer); spPollTimer = null;
  cancelAnimationFrame(spProgressRaf); spProgressRaf = null;
}

function wireSpotifyVisibility() {
  if (window._spVisWired) return;
  window._spVisWired = true;
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) { stopSpotifyPoll(); }
    else if (spToken) {
      if (spExpiresAt && spExpiresAt - Date.now() < 60000) refreshSpotifyToken();
      startSpotifyPoll();
    }
  });
  window.addEventListener('online', function() { if (spToken) { refreshSpotifyToken(); startSpotifyPoll(); } });
}

function startProgressLoop() {
  cancelAnimationFrame(spProgressRaf);
  let lastSec = -1;
  const fmt = function(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const stepFn = function() {
    spProgressRaf = requestAnimationFrame(stepFn);
    if (!spIsPlaying || !spLastDuration) return;
    const pos = Math.min(spLastProgress + (Date.now() - spLastPollTime), spLastDuration);
    const bar = document.querySelector('.sp-progress-bar');
    if (bar) bar.style.width = ((pos / spLastDuration) * 100).toFixed(3) + '%';
    const sec = Math.floor(pos / 1000);
    if (sec !== lastSec) {
      lastSec = sec;
      const rows = document.querySelectorAll('.sp-time-row');
      for (let i = 0; i < rows.length; i++) { const sp = rows[i].querySelector('span:first-child'); if (sp) sp.textContent = fmt(pos); }
    }
  };
  spProgressRaf = requestAnimationFrame(stepFn);
}

async function fetchNowPlaying() {
  if (!spToken) return;
  try {
    const resp = await spFetch('https://api.spotify.com/v1/me/player?additional_types=track,episode', {});
    if (resp.status === 204 || resp.status === 0) {
      spActiveDeviceId = null; spActiveDevice = null;
      if (!spShowingLastPlayed) { spShowingLastPlayed = true; fetchLastPlayed(); }
      updateDeviceUi();
      return;
    }
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data || !data.item) {
      spActiveDeviceId = (data && data.device) ? data.device.id : null;
      spActiveDevice   = (data && data.device) ? data.device : null;
      if (!spShowingLastPlayed) { spShowingLastPlayed = true; fetchLastPlayed(); }
      updateDeviceUi();
      return;
    }
    spShowingLastPlayed = false;
    if (data.device) {
      spActiveDeviceId = data.device.id; spActiveDevice = data.device;
      if (typeof data.device.volume_percent === 'number') spVolume = data.device.volume_percent;
    }
    spShuffleState = !!data.shuffle_state;
    spRepeatState  = data.repeat_state || 'off';
    const item = data.item;
    const isEp = data.currently_playing_type === 'episode' || item.type === 'episode';
    const prevUri = spCurrentTrackUri;
    spCurrentTrackUri = item.uri;
    spIsPodcast    = isEp;
    spLastProgress = data.progress_ms || 0;
    spLastDuration = item.duration_ms || 0;
    spLastPollTime = Date.now();
    spIsPlaying    = data.is_playing;
    if (spCurrentTrackUri !== prevUri || prevUri === null) {
      checkSavedState(item.uri, isEp);
      renderNowPlaying(data);
    } else {
      updatePlayPauseButtons(spIsPlaying);
      updateShuffleRepeatButtons();
      updateDeviceUi();
      updateVolumeUi();
    }
  } catch (e) {}
}

// ── Save / like (tracks AND podcast episodes) ─────────────
async function checkSavedState(uri, isEpisode) {
  if (!spToken || !uri) { spIsLiked = false; updateLikeButton(); return; }
  const id = uri.split(':')[2];
  if (!id) return;
  const endpoint = isEpisode ? 'episodes' : 'tracks';
  try {
    const resp = await spFetch('https://api.spotify.com/v1/me/' + endpoint + '/contains?ids=' + id, {});
    if (!resp.ok) return;
    const data = await resp.json();
    spIsLiked = Array.isArray(data) ? !!data[0] : false;
    updateLikeButton();
  } catch(e) {}
}

async function spToggleLike() {
  if (!spToken || !spCurrentTrackUri) return;
  const id = spCurrentTrackUri.split(':')[2];
  if (!id) return;
  const endpoint = spIsPodcast ? 'episodes' : 'tracks';
  const resp = await spFetch('https://api.spotify.com/v1/me/' + endpoint + '?ids=' + id, { method: spIsLiked ? 'DELETE' : 'PUT' });
  if (!resp.ok && resp.status !== 0) { showToast('Could not update \u2014 try again', 2000); return; }
  spIsLiked = !spIsLiked;
  updateLikeButton();
  if (spIsPodcast) showToast(spIsLiked ? 'Saved to Your Episodes' : 'Removed from Your Episodes', 2000);
  else showToast(spIsLiked ? 'Saved to Liked Songs' : 'Removed from Liked Songs', 2000);
}

function updateLikeButton() {
  const btns = document.querySelectorAll('.sp-like-btn');
  for (let i = 0; i < btns.length; i++) {
    const btn = btns[i];
    btn.innerHTML = svgHeart(spIsLiked);
    btn.title = spIsLiked
      ? (spIsPodcast ? 'Remove from Your Episodes' : 'Remove from Liked Songs')
      : (spIsPodcast ? 'Save to Your Episodes' : 'Save to Liked Songs');
    btn.style.color = spIsLiked ? '#1DB954' : '';
  }
}

function spSeek(e) {
  if (!spToken || !spLastDuration) return;
  const wrap = e.currentTarget;
  const rect = wrap.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const posMs = Math.floor(pct * spLastDuration);
  spLastProgress = posMs; spLastPollTime = Date.now();
  const bar = wrap.querySelector('.sp-progress-bar');
  if (bar) bar.style.width = (pct * 100).toFixed(2) + '%';
  fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${posMs}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${spToken}` } }).catch(() => {});
}

function updatePlayPauseButtons(isPlaying) {
  const icon = isPlaying ? '⏸' : '▶'; const title = isPlaying ? 'Pause' : 'Play';
  document.querySelectorAll('.sp-ctrl-btn.play').forEach(b => { b.textContent = icon; b.title = title; });
  document.querySelectorAll('.hdr-sp-btn.play').forEach(b => { b.textContent = icon; b.title = title; });
  const dot = document.querySelector('.hdr-sp-dot');
  if (dot) dot.style.opacity = isPlaying ? '1' : '0';
}

function updateShuffleRepeatButtons() {
  const sh = document.querySelectorAll('.sp-shuffle-btn');
  for (let i = 0; i < sh.length; i++) { sh[i].innerHTML = svgShuffle(spShuffleState); sh[i].classList.toggle('active', spShuffleState); sh[i].title = spShuffleState ? 'Shuffle: On' : 'Shuffle: Off'; }
  const rp = document.querySelectorAll('.sp-repeat-btn');
  for (let j = 0; j < rp.length; j++) { rp[j].innerHTML = svgRepeat(spRepeatState); rp[j].classList.toggle('active', spRepeatState !== 'off'); rp[j].title = spRepeatState === 'track' ? 'Repeat: Track' : (spRepeatState === 'context' ? 'Repeat: All' : 'Repeat: Off'); }
}

// ── Render pipeline ───────────────────────────────────────
function renderNowPlaying(data) {
  if (!data || !data.item) { renderNowPlayingDirect(null); return; }
  const item = data.item;
  const isEp = data.currently_playing_type === 'episode' || item.type === 'episode';
  let art = '';
  if (isEp) {
    if (item.images && item.images[0]) art = item.images[0].url;
    else if (item.show && item.show.images && item.show.images[0]) art = item.show.images[0].url;
  } else if (item.album && item.album.images && item.album.images[0]) art = item.album.images[0].url;
  let artist = '';
  if (isEp) { artist = (item.show && (item.show.name || item.show.publisher)) ? (item.show.name || item.show.publisher) : 'Podcast'; }
  else if (item.artists) { artist = item.artists.map(function(a){ return a.name; }).join(', '); }
  renderNowPlayingDirect({
    isPlaying: data.is_playing, trackName: item.name || 'Unknown', artistName: artist,
    albumArt: art, albumName: isEp ? ((item.show && item.show.name) || '') : ((item.album && item.album.name) || ''),
    progress: data.progress_ms || 0, duration: item.duration_ms || 0, trackUri: item.uri || '', isPodcast: isEp
  });
}

function renderNowPlayingDirect(info) {
  updateHeaderWidget(info);
  renderFocusTabNowPlaying(info);
}

function renderFocusTabNowPlaying(info) {
  const container = document.getElementById('sp-main-content');
  if (!container) return;
  if (!info) {
    if (!spToken) {
      container.innerHTML = '<div class="sp-idle">Not connected to Spotify</div><button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">Connect Spotify</button>';
    }
    return;
  }
  const pct = info.duration ? (info.progress / info.duration) * 100 : 0;
  const fmt = function(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const deviceName = (spActiveDevice && spActiveDevice.name) ? spActiveDevice.name : 'No active device';
  const addBtn = info.isPodcast ? ''
    : '<button class="sp-icon-btn sp-save-btn' + (spAddMode ? ' active' : '') + '" onclick="spToggleAddMode()" title="Add to playlist">' + svgAddToPlaylist(spAddMode) + '</button>';
  container.innerHTML =
    '<div class="sp-art-lg-wrap" style="width:100%;height:435px;background:transparent;padding:0;margin:0;border-radius:14px;overflow:hidden;display:block;flex-shrink:0;box-shadow:0 14px 32px rgba(0,0,0,.16),0 4px 10px rgba(0,0,0,.12);line-height:0;font-size:0">' +
      '<img class="sp-art-lg" src="' + escH(info.albumArt) + '" alt="' + escH(info.albumName) + '" style="width:100%;height:100%;max-height:none;object-fit:cover;object-position:center center;display:block;border-radius:0;margin:0;padding:0;background:transparent" onerror="this.style.background=\'var(--bg-elevated)\'">' +
    '</div>' +
    '<div style="margin-top:15px;margin-bottom:2px;min-width:0">' +
      '<div class="sp-track-lg" style="font-size:1.04rem;line-height:1.12;margin:0 0 2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escH(info.trackName) + '</div>' +
      '<div class="sp-artist-lg" style="font-size:.72rem;line-height:1.25;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escH(info.artistName) + '</div>' +
    '</div>' +
    '<div style="margin-top:auto">' +
      '<div class="sp-progress-wrap" onclick="spSeek(event)" title="Click to seek" style="margin-top:20px;margin-bottom:5px">' +
        '<div class="sp-progress-bar" style="width:' + pct.toFixed(2) + '%"></div>' +
      '</div>' +
      '<div class="sp-time-row" style="margin-bottom:9px"><span>' + fmt(info.progress) + '</span><span>' + fmt(info.duration) + '</span></div>' +
      '<div class="sp-controls" style="flex-direction:column;gap:9px;margin:0">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:16px">' +
          '<button class="sp-ctrl-btn" onclick="spPrev()" title="Previous">\u23EE</button>' +
          '<button class="sp-ctrl-btn play" onclick="spPlayPause()" title="' + (info.isPlaying ? 'Pause' : 'Play') + '">' + (info.isPlaying ? '\u23F8' : '\u25B6') + '</button>' +
          '<button class="sp-ctrl-btn" onclick="spNext()" title="Next">\u23ED</button>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:10px">' +
          '<button class="sp-icon-btn sp-shuffle-btn' + (spShuffleState ? ' active' : '') + '" onclick="spToggleShuffle()" title="Shuffle">' + svgShuffle(spShuffleState) + '</button>' +
          '<button class="sp-icon-btn sp-repeat-btn' + (spRepeatState !== 'off' ? ' active' : '') + '" onclick="spCycleRepeat()" title="Repeat">' + svgRepeat(spRepeatState) + '</button>' +
          '<button class="sp-icon-btn sp-like-btn" onclick="spToggleLike()" title="Save">' + svgHeart(spIsLiked) + '</button>' +
          addBtn +
        '</div>' +
      '</div>' +
      '<div id="sp-device-bar" style="display:flex;align-items:center;gap:8px;margin-top:13px">' +
        '<button id="sp-device-btn" class="sp-text-btn" onclick="spToggleDevices()" style="font-size:.56rem;padding:3px 9px;gap:5px"><span id="sp-device-name">' + escH(deviceName.toUpperCase()) + '</span> \u25BE</button>' +
        '<input id="sp-volume" type="range" min="0" max="100" value="' + spVolume + '" oninput="spSetVolume(this.value)" style="flex:1;height:3px;accent-color:#1DB954;cursor:pointer">' +
      '</div>' +
      '<div id="sp-device-list" style="display:none;margin-top:6px;border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden"></div>' +
    '</div>';
  const wrap = container.querySelector('.sp-progress-wrap');
  if (wrap) {
    wrap.addEventListener('mouseenter', function() { wrap.style.height = '6px'; });
    wrap.addEventListener('mouseleave', function() { wrap.style.height = ''; });
  }
  const art = container.querySelector('.sp-art-lg');
  if (art) art.onload = function() { if (typeof syncFocusCardHeights === 'function') syncFocusCardHeights(); };
  if (typeof syncFocusCardHeights === 'function') requestAnimationFrame(syncFocusCardHeights);
}

// -- Header widget --
function updateHeaderWidget(info) {
  ensureHeaderWidgets();
  const spSection = document.getElementById('sp-header-section');
  if (!spSection) return;
  if (!info) { spSection.innerHTML = `<button class="hdr-sp-connect" onclick="spotifyLogin()">♫ Connect Spotify</button>`; return; }
  const playIcon = info.isPlaying ? '⏸' : '▶';
  spSection.innerHTML = `
    <img class="hdr-art" src="${escH(info.albumArt)}" alt="art" onerror="this.style.opacity='.3'" onclick="showTab('focus')" style="cursor:pointer" title="Open Focus tab">
    <div class="hdr-track-info" onclick="showTab('focus')" style="cursor:pointer" title="Open Focus tab">
      <div class="hdr-track-name">${escH(info.trackName)}</div>
      <div class="hdr-artist-name">${escH(info.artistName)}</div>
    </div>
    ${info.isPlaying ? '<div class="hdr-sp-dot"></div>' : ''}
    <div class="hdr-sp-controls">
      <button class="hdr-sp-btn" onclick="spPrev()" title="Previous">⏮</button>
      <button class="hdr-sp-btn play" onclick="spPlayPause()" title="${info.isPlaying?'Pause':'Play'}">${playIcon}</button>
      <button class="hdr-sp-btn" onclick="spNext()" title="Next">⏭</button>
    </div>`;
}

function ensureHeaderWidgets() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;
  if (!document.getElementById('sp-header-section')) {
    const spDiv = document.createElement('div');
    spDiv.id = 'sp-header-section'; spDiv.className = 'hdr-sp-section';
    headerRight.insertBefore(spDiv, document.getElementById('save-status'));
  }
  if (!document.getElementById('pom-header-section')) {
    const pomDiv = document.createElement('div');
    pomDiv.id = 'pom-header-section'; pomDiv.className = 'hdr-pom-section';
    pomDiv.innerHTML = `<div class="hdr-pom-inner"><div class="hdr-pom-time" id="hdr-pom-time">45:00</div><div class="hdr-pom-phase" id="hdr-pom-phase">Work</div></div><div class="hdr-pom-btns"><button class="hdr-pom-btn" id="hdr-pom-start" onclick="pomToggle()" title="Start/Pause">▶</button><button class="hdr-pom-btn" onclick="pomReset()" title="Reset">↺</button><button class="hdr-pom-btn" onclick="pomOpenEdit(this)" title="Edit">✎</button></div>`;
    headerRight.insertBefore(pomDiv, document.getElementById('save-status'));
  }
}

// ── Playback controls (target the ACTIVE device) ──────────
async function spPlayPause() {
  if (!spToken) return;
  spIsPlaying = !spIsPlaying;                 // optimistic for snappy feel
  updatePlayPauseButtons(spIsPlaying);
  const action = spIsPlaying ? 'play' : 'pause';
  const resp = await spFetch('https://api.spotify.com/v1/me/player/' + action, { method: 'PUT' });
  if (!resp.ok && resp.status !== 0) {
    if (resp.status === 404 && spSdkReady && spSdkDeviceId) { await spTransferTo(spSdkDeviceId); }
    else { spIsPlaying = !spIsPlaying; updatePlayPauseButtons(spIsPlaying); }
  }
  setTimeout(fetchNowPlaying, 350);
}

async function spNext() {
  if (!spToken) return;
  await spFetch('https://api.spotify.com/v1/me/player/next', { method: 'POST' });
  spCurrentTrackUri = null; setTimeout(fetchNowPlaying, 350);
}

async function spPrev() {
  if (!spToken) return;
  await spFetch('https://api.spotify.com/v1/me/player/previous', { method: 'POST' });
  spCurrentTrackUri = null; setTimeout(fetchNowPlaying, 350);
}

async function spToggleShuffle() {
  if (!spToken) return;
  const ns = !spShuffleState;
  spShuffleState = ns; updateShuffleRepeatButtons();
  await spFetch('https://api.spotify.com/v1/me/player/shuffle?state=' + ns, { method: 'PUT' });
}

async function spCycleRepeat() {
  if (!spToken) return;
  const map = { 'off': 'context', 'context': 'track', 'track': 'off' };
  const ns = map[spRepeatState] || 'off';
  spRepeatState = ns; updateShuffleRepeatButtons();
  await spFetch('https://api.spotify.com/v1/me/player/repeat?state=' + ns, { method: 'PUT' });
}

// ── Devices + volume (Spotify Connect picker) ─────────────
async function fetchDevices() {
  try {
    const resp = await spFetch('https://api.spotify.com/v1/me/player/devices', {});
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data && data.devices) ? data.devices : [];
  } catch(e) { return []; }
}

function updateDeviceUi() {
  const nameEl = document.getElementById('sp-device-name');
  if (nameEl) nameEl.textContent = (spActiveDevice && spActiveDevice.name) ? spActiveDevice.name.toUpperCase() : 'NO DEVICE';
}

function updateVolumeUi() {
  const v = document.getElementById('sp-volume');
  if (v && document.activeElement !== v) v.value = String(spVolume);
}

async function spToggleDevices() {
  const list = document.getElementById('sp-device-list');
  if (!list) return;
  if (list.style.display !== 'none') { list.style.display = 'none'; return; }
  list.style.display = 'block';
  list.innerHTML = '<div class="sp-idle" style="padding:.4rem 0">Loading devices\u2026</div>';
  const devices = await fetchDevices();
  if (spSdkReady && spSdkDeviceId) {
    let has = false;
    for (let i = 0; i < devices.length; i++) { if (devices[i].id === spSdkDeviceId) has = true; }
    if (!has) devices.push({ id: spSdkDeviceId, name: 'Step 2 Dashboard (this browser)', is_active: false, type: 'Computer' });
  }
  if (!devices.length) { list.innerHTML = '<div class="sp-idle" style="padding:.4rem 0">No devices found. Open Spotify on a device.</div>'; return; }
  let html = '';
  for (let i = 0; i < devices.length; i++) {
    const d = devices[i];
    const style = d.is_active ? ' style="color:#1DB954"' : '';
    html += '<div class="sp-device-item" onclick="spTransferTo(\'' + d.id + '\')"' + style + '>' + (d.is_active ? '\u25CF ' : '\u25CB ') + escH(d.name) + '</div>';
  }
  list.innerHTML = html;
}

async function spTransferTo(deviceId) {
  if (!spToken || !deviceId) return;
  if (deviceId === spSdkDeviceId && spPlayer && spPlayer.activateElement) { try { await spPlayer.activateElement(); } catch(e) {} }
  const resp = await spFetch('https://api.spotify.com/v1/me/player', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_ids: [deviceId], play: true }) });
  const list = document.getElementById('sp-device-list'); if (list) list.style.display = 'none';
  if (!resp.ok && resp.status !== 0 && resp.status !== 204) { showToast('Could not switch device', 2200); return; }
  showToast('Switched device', 1600);
  setTimeout(fetchNowPlaying, 800);
}

async function spSetVolume(val) {
  spVolume = parseInt(val, 10) || 0;
  if (spActiveDeviceId && spActiveDeviceId === spSdkDeviceId && spPlayer && spPlayer.setVolume) {
    try { await spPlayer.setVolume(spVolume / 100); } catch(e) {}
    return;
  }
  spFetch('https://api.spotify.com/v1/me/player/volume?volume_percent=' + spVolume, { method: 'PUT' });
}

// ── Start playback of a playlist (active device, or here) ─
async function playSpotifyPlaylist(uri, name) {
  if (!spToken) return;
  const deviceId = spActiveDeviceId || spSdkDeviceId;
  if (deviceId && deviceId === spSdkDeviceId && spPlayer && spPlayer.activateElement) { try { await spPlayer.activateElement(); } catch(e) {} }
  let url = 'https://api.spotify.com/v1/me/player/play';
  if (deviceId) url += '?device_id=' + deviceId;
  const resp = await spFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context_uri: uri }) });
  if (!resp.ok && resp.status !== 0 && resp.status !== 204) {
    window.open('https://open.spotify.com/playlist/' + uri.split(':')[2], '_blank');
    return;
  }
  spShowingLastPlayed = false; spCurrentTrackUri = null;
  if (name) showToast('Playing ' + name, 1800);
  setTimeout(fetchNowPlaying, 800);
}

// ── Add-to-playlist mode (no re-login loop) ───────────────
function spToggleAddMode() {
  if (spIsPodcast) { showToast('Episodes can\u2019t be added to playlists', 2200); return; }
  spAddMode = !spAddMode;
  const saveBtns = document.querySelectorAll('.sp-save-btn');
  for (let i = 0; i < saveBtns.length; i++) { saveBtns[i].classList.toggle('active', spAddMode); saveBtns[i].innerHTML = svgAddToPlaylist(spAddMode); }
  setFocusRight('playlists');
  const list = document.getElementById('sp-playlists-list');
  let banner = document.getElementById('sp-add-banner');
  if (spAddMode) {
    if (list && !banner) {
      banner = document.createElement('div');
      banner.id = 'sp-add-banner';
      banner.style.cssText = 'background:var(--accent);color:#fff;font-family:var(--font-mono);font-size:.68rem;padding:.35rem .6rem;border-radius:var(--r-sm);margin-bottom:.4rem;display:flex;align-items:center;justify-content:space-between';
      banner.innerHTML = '<span>Tap a playlist to add this track</span><button onclick="spToggleAddMode()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:.9rem">\u00D7</button>';
      list.insertBefore(banner, list.firstChild);
    }
  } else if (banner) { banner.remove(); }
  rebindPlaylistRows();
}

async function spAddToPlaylist(playlistUri, playlistName) {
  if (!spToken || !spCurrentTrackUri) return;
  if (spIsPodcast) { showToast('Episodes can\u2019t be added to playlists', 2200); return; }
  const pid = playlistUri.split(':')[2];
  if (!pid) return;
  const resp = await spFetch('https://api.spotify.com/v1/playlists/' + pid + '/tracks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uris: [spCurrentTrackUri] })
  });
  if (resp.ok) { showToast('Added to ' + playlistName, 2200); spToggleAddMode(); return; }
  if (resp.status === 403) { showToast('No permission to edit that playlist', 2600); return; }
  showToast('Could not add track (' + resp.status + ')', 2400);
}

// -- Last played fallback --
async function fetchLastPlayed() {
  if (!spToken) return;
  try {
    let resp = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', { headers: { 'Authorization': `Bearer ${spToken}` } });
    if (resp.status === 401) { const ok = await refreshSpotifyToken(); if (!ok) return; resp = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', { headers: { 'Authorization': `Bearer ${spToken}` } }); }
    if (!resp.ok) return;
    const data = await resp.json();
    const item = data.items?.[0]?.track;
    if (!item) return;
    // Only write if still in last-played state (don't clobber a live track)
    if (!spShowingLastPlayed) return;
    const container = document.getElementById('sp-main-content');
    if (!container) return;
    container.innerHTML = `
      <div style="position:relative">
        <div class="sp-art-lg-wrap" style="width:100%;height:435px;background:transparent;padding:0;margin:0;border-radius:14px;overflow:hidden;display:block;flex-shrink:0;box-shadow:0 14px 32px rgba(0,0,0,.16),0 4px 10px rgba(0,0,0,.12);line-height:0;font-size:0">
          <img class="sp-art-lg" src="${escH(item.album?.images?.[0]?.url || '')}" alt="${escH(item.name)}" style="width:100%;height:100%;max-height:none;object-fit:cover;object-position:center center;display:block;border-radius:0;margin:0;padding:0;background:transparent" onerror="this.style.background='var(--bg-elevated)'">
        </div>
        <div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,.55);color:#fff;font-family:var(--font-mono);font-size:.58rem;padding:2px 7px;border-radius:3px;letter-spacing:.04em">LAST PLAYED</div>
      </div>
      <div style="margin-top:15px;margin-bottom:2px;min-width:0">
        <div class="sp-track-lg" style="font-size:1.04rem;line-height:1.12;margin:0 0 2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escH(item.name)}</div>
        <div class="sp-artist-lg" style="font-size:.72rem;line-height:1.25;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escH(item.artists?.map(a => a.name).join(', ') || '')}</div>
      </div>
      <div class="sp-idle" style="margin-top:auto;padding:.8rem 0 .3rem;font-size:.68rem;text-align:center">Nothing playing · click a playlist to start</div>`;
  } catch(e) { console.warn('fetchLastPlayed:', e); }
}

// -- Toast --
function showToast(text, duration) {
  const msg = document.createElement('div');
  msg.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-card);border:1px solid var(--border-bright);color:var(--text-primary);font-family:var(--font-mono);font-size:.75rem;padding:.45rem 1rem;border-radius:999px;z-index:9000;pointer-events:none;opacity:1;transition:opacity .4s;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.15)';
  msg.textContent = text;
  document.body.appendChild(msg);
  setTimeout(() => { msg.style.opacity='0'; setTimeout(()=>msg.remove(), 400); }, duration || 2200);
}
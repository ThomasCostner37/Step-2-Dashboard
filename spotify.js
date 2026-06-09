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
].join(' ');

let spToken        = null;
let spPlayer       = null;
let spDeviceId     = null;
let spPollTimer        = null;
let spCurrentTrack     = null;
let spInterpolateTimer = null;
let spLastPollTime     = null;
let spLastProgress     = 0;
let spLastDuration     = 0;
let spIsPlaying        = false;
let spShuffleState     = false;
let spRepeatState      = 'off';
let spCurrentTrackUri  = null;
let spAddMode          = false;
let spIsLiked          = false;
let spVibeActive       = false;
let spVibeCtx          = null;
let spVibeAnalyser     = null;
let spVibeSource       = null;
let spVibeRaf          = null;

// ── Quotes ────────────────────────────────────────────────
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

// ── SVG icon helpers ──────────────────────────────────────
function svgShuffle(active) {
  const c = active ? '#1DB954' : 'currentColor';
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="16 3 21 3 21 8"></polyline>
    <line x1="4" y1="20" x2="21" y2="3"></line>
    <polyline points="21 16 21 21 16 21"></polyline>
    <line x1="15" y1="15" x2="21" y2="21"></line>
  </svg>`;
}

function svgRepeat(state) {
  const c = state !== 'off' ? '#1DB954' : 'currentColor';
  if (state === 'track') {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="17 1 21 5 17 9"></polyline>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
      <polyline points="7 23 3 19 7 15"></polyline>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
      <text x="10" y="14" font-size="7" fill="${c}" stroke="none" font-weight="bold">1</text>
    </svg>`;
  }
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="17 1 21 5 17 9"></polyline>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
    <polyline points="7 23 3 19 7 15"></polyline>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
  </svg>`;
}

function svgHeart(filled) {
  return filled
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954" stroke="#1DB954" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
       </svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
       </svg>`;
}

// Add to playlist: queue-list + plus badge icon
function svgAddToPlaylist(active) {
  const c = active ? '#1DB954' : 'currentColor';
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="3" y1="6" x2="15" y2="6"></line>
    <line x1="3" y1="10" x2="12" y2="10"></line>
    <line x1="3" y1="14" x2="10" y2="14"></line>
    <circle cx="18" cy="16" r="4"></circle>
    <line x1="18" y1="13" x2="18" y2="19"></line>
    <line x1="15" y1="16" x2="21" y2="16"></line>
  </svg>`;
}

// Vibe: audio waveform bars
function svgVibe(active) {
  const c = active ? '#C9913A' : 'currentColor';
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round">
    <line x1="4" y1="9" x2="4" y2="15"></line>
    <line x1="8" y1="5" x2="8" y2="19"></line>
    <line x1="12" y1="8" x2="12" y2="16"></line>
    <line x1="16" y1="4" x2="16" y2="20"></line>
    <line x1="20" y1="9" x2="20" y2="15"></line>
  </svg>`;
}

// ── Inject tab ────────────────────────────────────────────
function injectSpotifyTab() {
  const tabBar = document.querySelector('.tab-bar');
  const app    = document.getElementById('app');

  if (tabBar && !document.getElementById('btn-focus')) {
    const btn = document.createElement('button');
    btn.className = 'tab-btn'; btn.id = 'btn-focus';
    btn.onclick = () => showTab('focus');
    btn.innerHTML = 'Focus';
    tabBar.appendChild(btn);
  }

  if (app && !document.getElementById('tab-focus')) {
    const panel = document.createElement('div');
    panel.id = 'tab-focus'; panel.className = 'tab-panel';
    panel.innerHTML = `
      <div class="focus-tab-grid">
        <!-- NOW PLAYING -->
        <div class="sp-card">
          <div class="dash-head" style="margin-bottom:.85rem">
            <div class="dash-title">Now Playing</div>
            <button id="sp-vibe-header-btn" class="sp-text-btn" onclick="spToggleVibe()" style="font-size:.58rem;padding:3px 8px">
              ${svgVibe(false)} Vibe
            </button>
          </div>
          <div id="sp-main-content">
            <div class="sp-idle">Not connected to Spotify</div>
            <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">Connect Spotify</button>
          </div>
        </div>

        <!-- RIGHT PANEL -->
        <div class="pom-card">
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
      </div>
      <canvas id="sp-vibe-canvas" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0;transition:opacity 1.2s ease;display:none"></canvas>
    `;
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
  if (window.innerWidth <= 700) { pom.style.height = ''; return; }
  var maxH = window.innerHeight - 216;
  var h    = Math.min(sp.offsetHeight, maxH);
  pom.style.height = h + 'px';
}

function observeFocusCardHeight() {
  var sp = document.querySelector('#tab-focus .sp-card');
  if (!sp) return;
  if (_focusCardRO) _focusCardRO.disconnect();
  if (typeof ResizeObserver !== 'undefined') {
    _focusCardRO = new ResizeObserver(function () { syncFocusCardHeights(); });
    _focusCardRO.observe(sp);
  }
  window.addEventListener('resize', syncFocusCardHeights);
  requestAnimationFrame(syncFocusCardHeights);
}

// ── Focus right panel toggle ──────────────────────────────
function setFocusRight(mode) {
  focusRightMode = mode;
  document.getElementById('focus-btn-playlists')?.classList.toggle('active', mode === 'playlists');
  document.getElementById('focus-btn-quotes')?.classList.toggle('active', mode === 'quotes');
  const playlistsPanel = document.getElementById('focus-playlists-panel');
  const quotesPanel    = document.getElementById('focus-quotes-panel');
  if (playlistsPanel) playlistsPanel.style.display = mode === 'playlists' ? 'block' : 'none';
  if (quotesPanel)    quotesPanel.style.display    = mode === 'quotes'    ? 'flex'  : 'none';
  document.getElementById('focus-right-title').textContent = mode === 'playlists' ? 'Playlists' : 'Quotes';
  if (mode === 'quotes') startFocusQuotes();
  else stopFocusQuotes();
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

function nextFocusQuote() {
  focusQuoteIdx = (focusQuoteIdx + 1) % ALL_QUOTES.length;
  showFocusQuote(focusQuoteIdx);
  resetFocusQuoteTimer();
}

function prevFocusQuote() {
  focusQuoteIdx = (focusQuoteIdx - 1 + ALL_QUOTES.length) % ALL_QUOTES.length;
  showFocusQuote(focusQuoteIdx);
  resetFocusQuoteTimer();
}

function startFocusQuotes() {
  showFocusQuote(focusQuoteIdx);
  focusQuoteTimer = setInterval(nextFocusQuote, 10000);
}

function stopFocusQuotes() {
  clearInterval(focusQuoteTimer);
  focusQuoteTimer = null;
}

function resetFocusQuoteTimer() {
  clearInterval(focusQuoteTimer);
  focusQuoteTimer = setInterval(nextFocusQuote, 10000);
}

// ── Playlist search filter ────────────────────────────────
let _allPlaylists = [];

function filterPlaylists(q) {
  const container = document.getElementById('sp-playlists-list');
  if (!container || !_allPlaylists.length) return;
  const term = q.trim().toLowerCase();
  const filtered = term ? _allPlaylists.filter(pl => pl.name.toLowerCase().includes(term)) : _allPlaylists;
  renderPlaylistRows(filtered, container);
}

function renderPlaylistRows(playlists, container) {
  container.innerHTML = '';
  if (!playlists.length) {
    container.innerHTML = '<div class="sp-idle" style="padding:.5rem 0">No playlists match</div>';
    return;
  }
  playlists.forEach(pl => {
    if (!pl) return;
    const img = pl.images?.[0]?.url || '';
    const div = document.createElement('div');
    div.className = 'sp-playlist-row';
    div.onmouseenter = () => { div.style.background = 'var(--bg-elevated)'; div.style.borderColor = 'var(--border)'; };
    div.onmouseleave = () => { div.style.background = ''; div.style.borderColor = 'transparent'; };
    div.innerHTML = `
      ${img
        ? `<img src="${escH(img)}" style="width:38px;height:38px;border-radius:4px;object-fit:cover;flex-shrink:0">`
        : '<div style="width:38px;height:38px;border-radius:4px;background:var(--bg-elevated);flex-shrink:0"></div>'
      }
      <div class="sp-playlist-meta">
        <div class="sp-playlist-name">${escH(pl.name)}</div>
        <div class="sp-playlist-count">${pl.owner ? pl.owner.display_name || '' : ''}</div>
      </div>
      <div class="sp-playlist-play">▶</div>
    `;
    div.dataset.uri = pl.uri;
    div.onclick = () => playSpotifyPlaylist(pl.uri, pl.name);
    container.appendChild(div);
  });

  if (spAddMode) {
    container.querySelectorAll('.sp-playlist-row').forEach(row => {
      row.onclick = () => {
        spAddToPlaylist(row.dataset.uri || '', row.querySelector('.sp-playlist-name').textContent);
        spToggleAddMode();
      };
    });
  }
}

// ── Playlists fetch ───────────────────────────────────────
async function fetchSpotifyPlaylists() {
  if (!spToken) return;
  const container = document.getElementById('sp-playlists-list');
  if (!container) return;
  container.innerHTML = '<div class="sp-idle" style="padding:.5rem 0">Loading playlists…</div>';

  try {
    let resp = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { Authorization: `Bearer ${spToken}` }
    });

    if (resp.status === 401) {
      const ok = await refreshSpotifyToken();
      if (!ok) {
        container.innerHTML = `<div class="sp-idle">Session expired.</div><button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">Reconnect</button>`;
        return;
      }
      resp = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: { Authorization: `Bearer ${spToken}` }
      });
    }

    if (!resp.ok) {
      container.innerHTML = `<div class="sp-idle">Could not load playlists (${resp.status})</div>`;
      return;
    }

    const data = await resp.json();
    _allPlaylists = (data.items || []).filter(Boolean);
    renderPlaylistRows(_allPlaylists, container);
  } catch(e) {
    console.warn('Playlists fetch:', e);
    container.innerHTML = `<div class="sp-idle">Could not load playlists</div>`;
  }
}

async function playSpotifyPlaylist(uri, name) {
  if (!spToken) return;
  const body = { context_uri: uri };
  if (spDeviceId) body.device_id = spDeviceId;
  try {
    await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${spToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setTimeout(fetchNowPlaying, 800);
  } catch(e) {
    window.open(`https://open.spotify.com/playlist/${uri.split(':')[2]}`, '_blank');
  }
}

// ── Auth (PKCE) ───────────────────────────────────────────
function spotifyLogin() {
  const verifier = generateCodeVerifier(128);
  localStorage.setItem('sp_verifier', verifier);
  generateCodeChallenge(verifier).then(challenge => {
    const params = new URLSearchParams({
      client_id:             SPOTIFY_CLIENT_ID,
      response_type:         'code',
      redirect_uri:          SPOTIFY_REDIRECT,
      scope:                 SPOTIFY_SCOPES,
      code_challenge_method: 'S256',
      code_challenge:        challenge,
    });
    window.location = `https://accounts.spotify.com/authorize?${params}`;
  });
}

function generateCodeVerifier(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(b => possible[b % possible.length]).join('');
}

async function generateCodeChallenge(verifier) {
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function exchangeSpotifyCode(code) {
  const verifier = localStorage.getItem('sp_verifier');
  if (!verifier) return;
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     SPOTIFY_CLIENT_ID,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  SPOTIFY_REDIRECT,
      code_verifier: verifier,
    })
  });
  const data = await resp.json();
  if (data.access_token) {
    spToken = data.access_token;
    localStorage.setItem('sp_token', spToken);
    if (data.refresh_token) localStorage.setItem('sp_refresh', data.refresh_token);
    localStorage.removeItem('sp_verifier');
    window.history.replaceState({}, '', window.location.pathname);
    initSpotifyPlayer();
    startSpotifyPoll();
    setTimeout(fetchSpotifyPlaylists, 1500);

    const pending = localStorage.getItem('sp_pending_add');
    if (pending) {
      localStorage.removeItem('sp_pending_add');
      try {
        const { playlistUri, playlistName, trackUri } = JSON.parse(pending);
        setTimeout(async () => {
          const pid = playlistUri.split(':')[2];
          if (!pid || !trackUri) return;
          const r = await fetch('https://api.spotify.com/v1/playlists/' + pid + '/tracks', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + spToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ uris: [trackUri] })
          });
          showToast(r.ok ? ('Added to ' + playlistName) : 'Could not add track — try again', 2500);
        }, 2000);
      } catch(e) {}
    }
  }
}

async function refreshSpotifyToken() {
  const refresh = localStorage.getItem('sp_refresh');
  if (!refresh) return false;
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     SPOTIFY_CLIENT_ID,
      grant_type:    'refresh_token',
      refresh_token: refresh,
    })
  });
  const data = await resp.json();
  if (data.access_token) {
    spToken = data.access_token;
    localStorage.setItem('sp_token', spToken);
    return true;
  }
  return false;
}

// ── Init ──────────────────────────────────────────────────
function initSpotify() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  if (code) { exchangeSpotifyCode(code); return; }

  const saved = localStorage.getItem('sp_token');
  if (saved) {
    spToken = saved;
    initSpotifyPlayer();
    startSpotifyPoll();
  }

  if (!window.Spotify && !document.getElementById('sp-sdk')) {
    const script  = document.createElement('script');
    script.id     = 'sp-sdk';
    script.src    = 'https://sdk.scdn.co/spotify-player.js';
    document.head.appendChild(script);
  }
}

// ── Web Playback SDK ──────────────────────────────────────
window.onSpotifyWebPlaybackSDKReady = function() {
  if (!spToken) return;
  initSpotifyPlayer();
};

function initSpotifyPlayer() {
  if (!window.Spotify || !spToken || spPlayer) return;
  spPlayer = new Spotify.Player({
    name: 'Step 2 Dashboard',
    getOAuthToken: cb => cb(spToken),
    volume: 0.8,
  });
  spPlayer.addListener('ready', ({ device_id }) => { spDeviceId = device_id; });
  spPlayer.addListener('player_state_changed', state => {
    if (!state) return;
    updateNowPlayingFromSDK(state);
  });
  spPlayer.addListener('authentication_error', async () => {
    const ok = await refreshSpotifyToken();
    if (ok) initSpotifyPlayer();
  });
  spPlayer.connect();
}

// ── Polling ───────────────────────────────────────────────
function startSpotifyPoll() {
  clearInterval(spPollTimer);
  clearInterval(spInterpolateTimer);
  fetchNowPlaying();
  fetchSpotifyPlaylists();
  spPollTimer = setInterval(fetchNowPlaying, 10000);
  spInterpolateTimer = setInterval(() => {
    if (!spIsPlaying || !spLastDuration) return;
    const elapsed      = Date.now() - spLastPollTime;
    const interpolated = Math.min(spLastProgress + elapsed, spLastDuration);
    const pct          = (interpolated / spLastDuration) * 100;
    const bar = document.querySelector('.sp-progress-bar');
    if (bar) bar.style.width = pct.toFixed(2) + '%';
    const fmt = ms => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
    document.querySelectorAll('.sp-time-row').forEach(row => {
      const span = row.querySelector('span:first-child');
      if (span) span.textContent = fmt(interpolated);
    });
  }, 1000);
}

async function fetchNowPlaying() {
  if (!spToken) return;
  try {
    const resp = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { 'Authorization': `Bearer ${spToken}` }
    });
    if (resp.status === 204 || (resp.status === 200 && resp.headers.get('content-length') === '0')) {
      renderNowPlaying(null); return;
    }
    if (resp.status === 401) {
      const ok = await refreshSpotifyToken();
      if (ok) fetchNowPlaying();
      return;
    }
    if (!resp.ok) { renderNowPlaying(null); return; }

    const data = await resp.json();
    if (!data || !data.item) { renderNowPlaying(null); return; }

    const prevShuffle = spShuffleState;
    const prevRepeat  = spRepeatState;
    spShuffleState = data.shuffle_state || false;
    spRepeatState  = data.repeat_state  || 'off';
    if (spShuffleState !== prevShuffle || spRepeatState !== prevRepeat) {
      updateShuffleRepeatButtons();
    }

    const prevUri     = spCurrentTrackUri;
    spCurrentTrack    = data;
    spCurrentTrackUri = data.item.uri;
    spLastProgress    = data.progress_ms || 0;
    spLastDuration    = data.item.duration_ms || 0;
    spLastPollTime    = Date.now();
    spIsPlaying       = data.is_playing;

    if (spCurrentTrackUri !== prevUri || prevUri === null) {
      checkLikedState(data.item.uri);
      renderNowPlaying(data);
    } else {
      updatePlayPauseButtons(spIsPlaying);
    }
  } catch(e) { console.warn('Spotify poll:', e); }
}

// ── Like / Unlike ─────────────────────────────────────────
async function checkLikedState(trackUri) {
  if (!spToken || !trackUri) return;
  const id = trackUri.split(':')[2];
  if (!id) return;
  try {
    const resp = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${id}`, {
      headers: { 'Authorization': `Bearer ${spToken}` }
    });
    if (!resp.ok) return;
    const data = await resp.json();
    spIsLiked = Array.isArray(data) ? data[0] : false;
    updateLikeButton();
  } catch(e) {}
}

async function spToggleLike() {
  if (!spToken || !spCurrentTrackUri) return;
  const id = spCurrentTrackUri.split(':')[2];
  if (!id) return;
  const method = spIsLiked ? 'DELETE' : 'PUT';
  try {
    await fetch(`https://api.spotify.com/v1/me/tracks?ids=${id}`, {
      method,
      headers: { 'Authorization': `Bearer ${spToken}` }
    });
    spIsLiked = !spIsLiked;
    updateLikeButton();
    showToast(spIsLiked ? 'Saved to Liked Songs' : 'Removed from Liked Songs', 2000);
  } catch(e) {}
}

function updateLikeButton() {
  document.querySelectorAll('.sp-like-btn').forEach(btn => {
    btn.innerHTML = svgHeart(spIsLiked);
    btn.title = spIsLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs';
    btn.style.color = spIsLiked ? '#1DB954' : '';
  });
}

// ── Seekable progress bar ─────────────────────────────────
function spSeek(e) {
  if (!spToken || !spLastDuration) return;
  const wrap = e.currentTarget;
  const rect = wrap.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const posMs = Math.floor(pct * spLastDuration);
  spLastProgress = posMs;
  spLastPollTime = Date.now();
  const bar = wrap.querySelector('.sp-progress-bar');
  if (bar) bar.style.width = (pct * 100).toFixed(2) + '%';
  fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${posMs}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${spToken}` }
  }).catch(() => {});
}

// ── Lightweight button updates ────────────────────────────
function updatePlayPauseButtons(isPlaying) {
  const icon  = isPlaying ? '⏸' : '▶';
  const title = isPlaying ? 'Pause' : 'Play';
  document.querySelectorAll('.sp-ctrl-btn.play').forEach(b => { b.textContent = icon; b.title = title; });
  document.querySelectorAll('.hdr-sp-btn.play').forEach(b => { b.textContent = icon; b.title = title; });
  const dot = document.querySelector('.hdr-sp-dot');
  if (dot) dot.style.opacity = isPlaying ? '1' : '0';
}

function updateShuffleRepeatButtons() {
  document.querySelectorAll('.sp-shuffle-btn').forEach(btn => {
    btn.innerHTML = svgShuffle(spShuffleState);
    btn.classList.toggle('active', spShuffleState);
    btn.title = spShuffleState ? 'Shuffle: On' : 'Shuffle: Off';
  });
  document.querySelectorAll('.sp-repeat-btn').forEach(btn => {
    btn.innerHTML = svgRepeat(spRepeatState);
    btn.setAttribute('data-state', spRepeatState);
    btn.classList.toggle('active', spRepeatState !== 'off');
    btn.title = spRepeatState === 'track' ? 'Repeat: Track' : spRepeatState === 'context' ? 'Repeat: All' : 'Repeat: Off';
  });
}

// ── SDK state update ──────────────────────────────────────
function updateNowPlayingFromSDK(sdkState) {
  if (!sdkState || !sdkState.track_window) return;
  const track   = sdkState.track_window.current_track;
  const prevUri = spCurrentTrack?.item?.uri;
  const newUri  = track.uri;
  spLastProgress = sdkState.position || 0;
  spLastDuration = sdkState.duration || 0;
  spLastPollTime = Date.now();
  spIsPlaying    = !sdkState.paused;

  if (newUri === prevUri && prevUri !== undefined) {
    updatePlayPauseButtons(spIsPlaying);
    return;
  }

  checkLikedState(newUri);
  renderNowPlayingDirect({
    isPlaying:  !sdkState.paused,
    trackName:  track.name,
    artistName: track.artists.map(a => a.name).join(', '),
    albumArt:   track.album.images[0]?.url || '',
    albumName:  track.album.name,
    progress:   sdkState.position,
    duration:   sdkState.duration,
    trackUri:   track.uri,
  });
}

// ── Render pipeline ───────────────────────────────────────
// FIX #5: Handle podcasts (currently_playing_type === 'episode')
function renderNowPlaying(data) {
  if (!data || !data.item) { renderNowPlayingDirect(null); return; }
  const item      = data.item;
  const isPodcast = data.currently_playing_type === 'episode';
  renderNowPlayingDirect({
    isPlaying:  data.is_playing,
    trackName:  item.name,
    artistName: isPodcast
      ? (item.show?.name || item.show?.publisher || 'Podcast')
      : (item.artists?.map(a => a.name).join(', ') || ''),
    albumArt: isPodcast
      ? (item.images?.[0]?.url || item.show?.images?.[0]?.url || '')
      : (item.album?.images?.[0]?.url || ''),
    albumName:  isPodcast ? (item.show?.name || '') : (item.album?.name || ''),
    progress:   data.progress_ms,
    duration:   item.duration_ms,
    trackUri:   item.uri,
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
    container.innerHTML = spToken
      ? '<div class="sp-idle" style="padding:1.5rem 0">Nothing playing right now</div><div class="sp-idle" style="padding:0 0 .5rem;font-size:.68rem">Pick a playlist on the right to start</div>'
      : '<div class="sp-idle">Not connected to Spotify</div><button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">Connect Spotify</button>';
    return;
  }

  const pct = info.duration ? (info.progress / info.duration) * 100 : 0;
  const fmt = ms => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

  container.innerHTML = `
    <img class="sp-art-lg" src="${escH(info.albumArt)}" alt="${escH(info.albumName)}"
         onerror="this.style.background='var(--bg-elevated)'">
    <div class="sp-track-lg">${escH(info.trackName)}</div>
    <div class="sp-artist-lg">${escH(info.artistName)}</div>
    <div class="sp-progress-wrap" onclick="spSeek(event)" title="Click to seek">
      <div class="sp-progress-bar" style="width:${pct.toFixed(2)}%"></div>
    </div>
    <div class="sp-time-row">
      <span>${fmt(info.progress)}</span>
      <span>${fmt(info.duration)}</span>
    </div>
    <div class="sp-controls" style="flex-direction:column;gap:8px">
      <div style="display:flex;align-items:center;justify-content:center;gap:16px">
        <button class="sp-ctrl-btn" onclick="spPrev()" title="Previous">⏮</button>
        <button class="sp-ctrl-btn play" onclick="spPlayPause()" title="${info.isPlaying?'Pause':'Play'}">
          ${info.isPlaying ? '⏸' : '▶'}
        </button>
        <button class="sp-ctrl-btn" onclick="spNext()" title="Next">⏭</button>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:2px">
        <button class="sp-icon-btn sp-shuffle-btn${spShuffleState ? ' active' : ''}"
          onclick="spToggleShuffle()" title="${spShuffleState ? 'Shuffle: On' : 'Shuffle: Off'}">
          ${svgShuffle(spShuffleState)}
        </button>
        <button class="sp-icon-btn sp-repeat-btn${spRepeatState !== 'off' ? ' active' : ''}"
          onclick="spCycleRepeat()" data-state="${spRepeatState}"
          title="${spRepeatState === 'track' ? 'Repeat: Track' : spRepeatState === 'context' ? 'Repeat: All' : 'Repeat: Off'}">
          ${svgRepeat(spRepeatState)}
        </button>
        <button class="sp-icon-btn sp-like-btn" onclick="spToggleLike()"
          title="${spIsLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}">
          ${svgHeart(spIsLiked)}
        </button>
        <button class="sp-text-btn sp-save-btn${spAddMode ? ' active' : ''}" onclick="spToggleAddMode()">
          ${svgAddToPlaylist(spAddMode)} + Playlist
        </button>
      </div>
    </div>
  `;

  const wrap = container.querySelector('.sp-progress-wrap');
  if (wrap) {
    wrap.addEventListener('mouseenter', () => { wrap.style.height = '6px'; });
    wrap.addEventListener('mouseleave', () => { wrap.style.height = ''; });
  }

  const art = container.querySelector('.sp-art-lg');
  if (art) art.onload = () => { if (typeof syncFocusCardHeights === 'function') syncFocusCardHeights(); };
}

// ── Vibe Mode ─────────────────────────────────────────────
function spToggleVibe() {
  spVibeActive = !spVibeActive;

  // Sync all vibe buttons (header persistent + any in controls row)
  document.querySelectorAll('.sp-vibe-btn, #sp-vibe-header-btn').forEach(btn => {
    btn.innerHTML = svgVibe(spVibeActive) + ' Vibe';
    btn.classList.toggle('active', spVibeActive);
  });

  const canvas = document.getElementById('sp-vibe-canvas');
  if (!canvas) return;

  if (spVibeActive) {
    canvas.style.display = 'block';
    requestAnimationFrame(() => { canvas.style.opacity = '0.5'; });
    startVibeEngine(canvas);
  } else {
    canvas.style.opacity = '0';
    setTimeout(() => { canvas.style.display = 'none'; }, 1200);
    stopVibeEngine();
  }
}

function startVibeEngine(canvas) {
  stopVibeEngine();
  const ctx2d = canvas.getContext('2d');

  const palette = [
    [201, 113, 58],   // amber
    [29, 185, 84],    // spotify green
    [100, 60, 200],   // purple
    [220, 60, 60],    // red
    [40, 160, 220],   // blue
  ];
  let paletteIdx = 0;
  let frame      = 0;
  let beatPhase  = 0;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function tick() {
    if (!spVibeActive) return;
    spVibeRaf = requestAnimationFrame(tick);
    frame++;

    const bpm       = 120;
    const msPerBeat = 60000 / bpm;
    const elapsed   = Date.now() - spLastPollTime;
    const curPos    = spLastProgress + (spIsPlaying ? elapsed : 0);
    beatPhase = ((curPos % msPerBeat) / msPerBeat);

    // Subtle pulse — gentle attack, slow decay
    const pulse = Math.pow(Math.sin(beatPhase * Math.PI), 0.5) * (spIsPlaying ? 1 : 0.15);

    if (frame % 300 === 0) paletteIdx = (paletteIdx + 1) % palette.length;
    const nextIdx = (paletteIdx + 1) % palette.length;
    const t = (frame % 300) / 300;
    const r = Math.round(palette[paletteIdx][0] + (palette[nextIdx][0] - palette[paletteIdx][0]) * t);
    const g = Math.round(palette[paletteIdx][1] + (palette[nextIdx][1] - palette[paletteIdx][1]) * t);
    const b = Math.round(palette[paletteIdx][2] + (palette[nextIdx][2] - palette[paletteIdx][2]) * t);

    const W = canvas.width;
    const H = canvas.height;

    // Stronger clear = shorter, more subtle trails
    ctx2d.fillStyle = 'rgba(245, 240, 232, 0.4)';
    ctx2d.fillRect(0, 0, W, H);

    // 3 rings, smaller radius, very low alpha
    const rings = 3;
    for (let i = 0; i < rings; i++) {
      const ringPhase = (beatPhase + i / rings) % 1;
      const radius    = ringPhase * Math.max(W, H) * 0.5;
      const alpha     = (1 - ringPhase) * pulse * 0.06;
      ctx2d.beginPath();
      ctx2d.arc(W / 2, H / 2, radius, 0, Math.PI * 2);
      ctx2d.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      ctx2d.lineWidth = 1.5 + (1 - ringPhase) * 2.5;
      ctx2d.stroke();
    }

    // Sparse, very faint particles
    if (frame % 8 === 0 && spIsPlaying) {
      if (!spVibeEngineState.particles) spVibeEngineState.particles = [];
      if (spVibeEngineState.particles.length < 60) {
        spVibeEngineState.particles.push({
          x:     W * 0.15 + Math.random() * W * 0.7,
          y:     H + 10,
          size:  1 + Math.random() * 2.5 * pulse,
          speed: 0.3 + Math.random() * 0.8,
          alpha: 0.04 + Math.random() * 0.08 * pulse,
          drift: (Math.random() - 0.5) * 0.4,
        });
      }
    }

    if (spVibeEngineState.particles) {
      spVibeEngineState.particles = spVibeEngineState.particles.filter(p => p.alpha > 0.005);
      spVibeEngineState.particles.forEach(p => {
        p.y    -= p.speed;
        p.x    += p.drift;
        p.alpha *= 0.994;
        ctx2d.beginPath();
        ctx2d.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx2d.fillStyle = `rgba(${r},${g},${b},${p.alpha.toFixed(3)})`;
        ctx2d.fill();
      });
    }
  }

  tick();
}

const spVibeEngineState = { particles: [] };

function stopVibeEngine() {
  if (spVibeRaf) { cancelAnimationFrame(spVibeRaf); spVibeRaf = null; }
  spVibeEngineState.particles = [];
  const canvas = document.getElementById('sp-vibe-canvas');
  if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

// ── Header widget ─────────────────────────────────────────
function updateHeaderWidget(info) {
  ensureHeaderWidgets(info);
  const spSection = document.getElementById('sp-header-section');
  if (!spSection) return;

  if (!info) {
    spSection.innerHTML = `<button class="hdr-sp-connect" onclick="spotifyLogin()">♫ Connect Spotify</button>`;
    return;
  }

  const playIcon = info.isPlaying ? '⏸' : '▶';
  // FIX #3: art + track info clickable → go to Focus tab
  spSection.innerHTML = `
    <img class="hdr-art" src="${escH(info.albumArt)}" alt="art" onerror="this.style.opacity='.3'"
      onclick="showTab('focus')" style="cursor:pointer" title="Open Focus tab">
    <div class="hdr-track-info" onclick="showTab('focus')" style="cursor:pointer" title="Open Focus tab">
      <div class="hdr-track-name">${escH(info.trackName)}</div>
      <div class="hdr-artist-name">${escH(info.artistName)}</div>
    </div>
    ${info.isPlaying ? '<div class="hdr-sp-dot"></div>' : ''}
    <div class="hdr-sp-controls">
      <button class="hdr-sp-btn" onclick="spPrev()" title="Previous">⏮</button>
      <button class="hdr-sp-btn play" onclick="spPlayPause()" title="${info.isPlaying?'Pause':'Play'}">${playIcon}</button>
      <button class="hdr-sp-btn" onclick="spNext()" title="Next">⏭</button>
    </div>
  `;
}

function ensureHeaderWidgets(info) {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  if (!document.getElementById('sp-header-section')) {
    const spDiv = document.createElement('div');
    spDiv.id = 'sp-header-section';
    spDiv.className = 'hdr-sp-section';
    const saveStatus = document.getElementById('save-status');
    headerRight.insertBefore(spDiv, saveStatus);
  }

  if (!document.getElementById('pom-header-section')) {
    const pomDiv = document.createElement('div');
    pomDiv.id = 'pom-header-section';
    pomDiv.className = 'hdr-pom-section';
    pomDiv.innerHTML = `
      <div class="hdr-pom-inner">
        <div class="hdr-pom-time" id="hdr-pom-time">45:00</div>
        <div class="hdr-pom-phase" id="hdr-pom-phase">Work</div>
      </div>
      <div class="hdr-pom-btns">
        <button class="hdr-pom-btn" id="hdr-pom-start" onclick="pomToggle()" title="Start/Pause">▶</button>
        <button class="hdr-pom-btn" onclick="pomReset()" title="Reset">↺</button>
        <button class="hdr-pom-btn" onclick="pomOpenEdit(this)" title="Edit">✎</button>
      </div>
    `;
    const saveStatus = document.getElementById('save-status');
    headerRight.insertBefore(pomDiv, saveStatus);
  }
}

// ── Playback controls ─────────────────────────────────────
async function spPlayPause() {
  if (!spToken) return;
  if (spPlayer) { spPlayer.togglePlay(); return; }
  const state = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { 'Authorization': `Bearer ${spToken}` }
  }).then(r => r.json()).catch(() => null);
  const endpoint = state?.is_playing ? 'pause' : 'play';
  await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${spToken}` },
    body: spDeviceId ? JSON.stringify({ device_id: spDeviceId }) : undefined,
  });
  setTimeout(fetchNowPlaying, 500);
}

async function spNext() {
  if (!spToken) return;
  if (spPlayer) { spPlayer.nextTrack(); return; }
  await fetch('https://api.spotify.com/v1/me/player/next', {
    method: 'POST', headers: { 'Authorization': `Bearer ${spToken}` }
  });
  spCurrentTrack = null;
  setTimeout(fetchNowPlaying, 500);
}

async function spPrev() {
  if (!spToken) return;
  if (spPlayer) { spPlayer.previousTrack(); return; }
  await fetch('https://api.spotify.com/v1/me/player/previous', {
    method: 'POST', headers: { 'Authorization': `Bearer ${spToken}` }
  });
  spCurrentTrackUri = null;
  setTimeout(fetchNowPlaying, 500);
}

async function spToggleShuffle() {
  if (!spToken) return;
  const newState = !spShuffleState;
  await fetch('https://api.spotify.com/v1/me/player/shuffle?state=' + newState, {
    method: 'PUT', headers: { 'Authorization': `Bearer ${spToken}` }
  });
  spShuffleState = newState;
  updateShuffleRepeatButtons();
}

async function spCycleRepeat() {
  if (!spToken) return;
  const cycle    = { 'off': 'context', 'context': 'track', 'track': 'off' };
  const newState = cycle[spRepeatState] || 'off';
  await fetch('https://api.spotify.com/v1/me/player/repeat?state=' + newState, {
    method: 'PUT', headers: { 'Authorization': `Bearer ${spToken}` }
  });
  spRepeatState = newState;
  updateShuffleRepeatButtons();
}

// ── Add-to-playlist mode ──────────────────────────────────
function spToggleAddMode() {
  spAddMode = !spAddMode;
  document.querySelectorAll('.sp-save-btn').forEach(btn => {
    btn.classList.toggle('active', spAddMode);
    btn.innerHTML = svgAddToPlaylist(spAddMode) + ' + Playlist';
  });
  const panel  = document.getElementById('sp-playlists-list');
  const banner = document.getElementById('sp-add-banner');

  if (spAddMode) {
    if (panel && !banner) {
      const b = document.createElement('div');
      b.id = 'sp-add-banner';
      b.style.cssText = 'background:var(--accent);color:#fff;font-family:var(--font-mono);font-size:.68rem;' +
        'padding:.35rem .6rem;border-radius:var(--r-sm);margin-bottom:.4rem;display:flex;align-items:center;justify-content:space-between';
      b.innerHTML = '<span>Tap a playlist to add this track</span>' +
        '<button onclick="spToggleAddMode()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:.9rem">×</button>';
      panel.insertBefore(b, panel.firstChild);
    }
    document.querySelectorAll('.sp-playlist-row').forEach(row => {
      row.onclick = () => {
        spAddToPlaylist(row.dataset.uri || '', row.querySelector('.sp-playlist-name').textContent);
        spToggleAddMode();
      };
    });
    setFocusRight('playlists');
  } else {
    if (banner) banner.remove();
    document.querySelectorAll('.sp-playlist-row').forEach(row => {
      const uri  = row.dataset.uri;
      const name = row.querySelector('.sp-playlist-name')?.textContent || '';
      row.onclick = () => playSpotifyPlaylist(uri, name);
    });
  }
}

async function spAddToPlaylist(playlistUri, playlistName) {
  if (!spToken || !spCurrentTrackUri) return;
  const playlistId = playlistUri.split(':')[2];
  if (!playlistId) return;
  const resp = await fetch('https://api.spotify.com/v1/playlists/' + playlistId + '/tracks', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + spToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [spCurrentTrackUri] })
  });
  if (resp.status === 401 || resp.status === 403) {
    const refreshed = await refreshSpotifyToken();
    if (refreshed) {
      const retry = await fetch('https://api.spotify.com/v1/playlists/' + playlistId + '/tracks', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + spToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [spCurrentTrackUri] })
      });
      showToast(retry.ok ? ('Added to ' + playlistName) : 'Could not add track — try again', 2200);
      return;
    }
    localStorage.setItem('sp_pending_add', JSON.stringify({ playlistUri, playlistName, trackUri: spCurrentTrackUri }));
    showToast('Re-authorising Spotify…', 2500);
    setTimeout(() => spotifyLogin(), 1200);
    return;
  }
  showToast(resp.ok ? ('Added to ' + playlistName) : 'Could not add track — try again', 2200);
}

// ── Toast ─────────────────────────────────────────────────
function showToast(text, duration) {
  const msg = document.createElement('div');
  msg.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-card);' +
    'border:1px solid var(--border-bright);color:var(--text-primary);font-family:var(--font-mono);font-size:.75rem;' +
    'padding:.45rem 1rem;border-radius:999px;z-index:9000;pointer-events:none;opacity:1;transition:opacity .4s;' +
    'white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.15)';
  msg.textContent = text;
  document.body.appendChild(msg);
  setTimeout(() => { msg.style.opacity='0'; setTimeout(()=>msg.remove(), 400); }, duration || 2200);
}
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

// ── Expanded quotes ──────────────────────────────────────
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
  { text:"If you're not tired, you're not working hard enough.", attr:"Anonymous" },
  { text:"The only person you are destined to become is the person you decide to be.", attr:"Ralph Waldo Emerson" },
  { text:"Do not go where the path may lead; go instead where there is no path and leave a trail.", attr:"Ralph Waldo Emerson" },
  { text:"Talent is cheaper than table salt. What separates the talented individual from the successful one is hard work.", attr:"Stephen King" },
  { text:"Great works are performed not by strength but by perseverance.", attr:"Samuel Johnson" },
  { text:"The secret of getting ahead is getting started.", attr:"Mark Twain" },
  { text:"Don't count the days. Make the days count.", attr:"Muhammad Ali" },
  { text:"Energy and persistence conquer all things.", attr:"Benjamin Franklin" },
  { text:"I am not a product of my circumstances. I am a product of my decisions.", attr:"Stephen Covey" },
];

let focusQuoteIdx = Math.floor(Math.random() * ALL_QUOTES.length);
let focusQuoteTimer = null;
let focusRightMode = 'playlists';

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
          </div>
          <div id="sp-main-content">
            <div class="sp-idle">Not connected to Spotify</div>
            <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">
              Connect Spotify
            </button>
          </div>
        </div>

        <!-- RIGHT PANEL: POMODORO (top) + PLAYLISTS/QUOTES (bottom) -->
        <div class="pom-card">

          <!-- POMODORO -->
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

          <!-- PLAYLISTS / QUOTES TOGGLE -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.7rem">
            <div class="dash-title" id="focus-right-title">Playlists</div>
            <div style="display:flex;gap:3px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--r-sm);padding:3px">
              <button class="advisor-tab-btn active" id="focus-btn-playlists" onclick="setFocusRight('playlists')">Playlists</button>
              <button class="advisor-tab-btn" id="focus-btn-quotes" onclick="setFocusRight('quotes')">Quotes</button>
            </div>
          </div>

          <!-- Playlists panel -->
          <div id="focus-playlists-panel" style="flex:1;overflow-y:auto;min-height:0">
            <div id="sp-playlists-list">
              <div class="sp-idle" style="padding:1rem 0">Connect Spotify to see your playlists</div>
            </div>
          </div>

          <!-- Quotes panel -->
          <div id="focus-quotes-panel" style="display:none;flex-direction:column;flex:1;min-height:0">
            <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:1rem 0">
              <div id="focus-quote-text" style="font-family:var(--font-display);font-style:italic;font-size:1.45rem;color:var(--text-secondary);line-height:1.75;transition:opacity .5s ease;margin-bottom:1rem;text-align:center"></div>
              <div id="focus-quote-attr" style="font-family:var(--font-mono);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-tertiary);transition:opacity .5s ease;text-align:center"></div>
            </div>
            <div class="quote-nav-btns" style="display:flex;gap:8px;justify-content:center;padding-bottom:.5rem;opacity:0;transition:opacity .2s">
              <button class="btn btn-ghost btn-sm" onclick="prevFocusQuote()">‹ Prev</button>
              <button class="btn btn-ghost btn-sm" onclick="nextFocusQuote()">Next ›</button>
            </div>
          </div>
        </div>

      </div>
    `;
    app.appendChild(panel);
  }

  // Ensure pomodoro header + edit popover are always initialized
  // (even before Spotify connects, so the Edit button on the Focus tab works)
  ensureHeaderWidgets();

  // Pin the right card's height to the left card so playlists scroll inside it
  observeFocusCardHeight();
}

// ── Match right (pom) card height to left (now-playing) card ──
var _focusCardRO = null;
function syncFocusCardHeights() {
  var sp  = document.querySelector('#tab-focus .sp-card');
  var pom = document.querySelector('#tab-focus .pom-card');
  if (!sp || !pom) return;
  // Stacked single-column layout (mobile): let it flow naturally
  if (window.innerWidth <= 700) { pom.style.height = ''; return; }
  pom.style.height = sp.offsetHeight + 'px';
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
  // Initial sync (after layout settles)
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

// ── Playlists ─────────────────────────────────────────────
async function fetchSpotifyPlaylists() {
  if (!spToken) return;

  const container = document.getElementById('sp-playlists-list');
  if (!container) return;

  container.innerHTML = '<div class="sp-idle" style="padding:.5rem 0">Loading playlists…</div>';

  try {
    let resp = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
      headers: { Authorization: `Bearer ${spToken}` }
    });

    if (resp.status === 401) {
      const ok = await refreshSpotifyToken();
      if (!ok) {
        container.innerHTML = `
          <div class="sp-idle" style="padding:.8rem 0">
            Spotify session expired.
          </div>
          <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">
            Reconnect Spotify
          </button>
        `;
        return;
      }

      resp = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
        headers: { Authorization: `Bearer ${spToken}` }
      });
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      container.innerHTML = `
        <div class="sp-idle" style="padding:.8rem 0">
          Playlists could not load.<br>
          <span style="font-size:.62rem;color:var(--text-tertiary)">
            Spotify ${resp.status}${errText ? ': ' + escH(errText.slice(0,120)) : ''}
          </span>
        </div>
        <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">
          Reconnect Spotify
        </button>
      `;
      return;
    }

    const data = await resp.json();

    if (!data.items?.length) {
      container.innerHTML = '<div class="sp-idle" style="padding:.5rem 0">No playlists found</div>';
      return;
    }

    container.innerHTML = '';

    data.items.forEach(pl => {
      if (!pl) return;

      const img = pl.images?.[0]?.url || '';
      const div = document.createElement('div');

      div.className = 'sp-playlist-row';

      div.onmouseenter = () => {
        div.style.background = 'var(--bg-elevated)';
        div.style.borderColor = 'var(--border)';
      };

      div.onmouseleave = () => {
        div.style.background = '';
        div.style.borderColor = 'transparent';
      };

      div.innerHTML = `
      ${
      img
      ? `<img src="${escH(img)}" style="width:38px;height:38px;border-radius:4px;object-fit:cover;flex-shrink:0">`
      : '<div style="width:38px;height:38px;border-radius:4px;background:var(--bg-elevated);flex-shrink:0"></div>'
      }
      <div class="sp-playlist-meta">
      <div class="sp-playlist-name">${escH(pl.name)}</div>
      <div class="sp-playlist-count">${pl.tracks?.total || 0} tracks</div>
     </div>
      <div class="sp-playlist-play">▶</div>
      `;

      div.onclick = () => playSpotifyPlaylist(pl.uri, pl.name);
      container.appendChild(div);
    });
  } catch (e) {
    console.warn('Playlists fetch:', e);

    container.innerHTML = `
      <div class="sp-idle" style="padding:.8rem 0">
        Playlists could not load.<br>
        <span style="font-size:.62rem;color:var(--text-tertiary)">
          ${escH(String(e))}
        </span>
      </div>
      <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem">
        Reconnect Spotify
      </button>
    `;
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

// ── Spotify Auth (PKCE) ───────────────────────────────────
function spotifyLogin() {
  const verifier = generateCodeVerifier(128);
  sessionStorage.setItem('sp_verifier', verifier);
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
  const data    = new TextEncoder().encode(verifier);
  const digest  = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function exchangeSpotifyCode(code) {
  const verifier = sessionStorage.getItem('sp_verifier');
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
    sessionStorage.setItem('sp_token', spToken);
    if (data.refresh_token) sessionStorage.setItem('sp_refresh', data.refresh_token);
    sessionStorage.removeItem('sp_verifier');
    window.history.replaceState({}, '', window.location.pathname);
    initSpotifyPlayer();
    startSpotifyPoll();
    setTimeout(fetchSpotifyPlaylists, 1500);
  }
}

async function refreshSpotifyToken() {
  const refresh = sessionStorage.getItem('sp_refresh');
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
    sessionStorage.setItem('sp_token', spToken);
    return true;
  }
  return false;
}

// ── Init ──────────────────────────────────────────────────
function initSpotify() {
  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');
  if (code) {
    exchangeSpotifyCode(code);
    return;
  }

  const saved = sessionStorage.getItem('sp_token');
  if (saved) {
    spToken = saved;
    initSpotifyPlayer();
    startSpotifyPoll();
    // Playlists will also be fetched by startSpotifyPoll
  }

  if (!window.Spotify && !document.getElementById('sp-sdk')) {
    const script    = document.createElement('script');
    script.id       = 'sp-sdk';
    script.src      = 'https://sdk.scdn.co/spotify-player.js';
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

  spPlayer.addListener('ready', ({ device_id }) => {
    spDeviceId = device_id;
    console.log('Spotify player ready:', device_id);
  });

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

// ── Now Playing ───────────────────────────────────────────
function startSpotifyPoll() {
  clearInterval(spPollTimer);
  clearInterval(spInterpolateTimer);
  fetchNowPlaying();
  fetchSpotifyPlaylists();
  spPollTimer = setInterval(fetchNowPlaying, 10000);
  // Interpolate progress every second between polls — drives the bar smoothly
  spInterpolateTimer = setInterval(() => {
    if (!spIsPlaying || !spLastDuration) return;
    const elapsed = Date.now() - spLastPollTime;
    const interpolated = Math.min(spLastProgress + elapsed, spLastDuration);
    const pct = (interpolated / spLastDuration) * 100;
    // Update bar directly — no transition in CSS, so this is already smooth at 1s
    const bar = document.querySelector('.sp-progress-bar');
    if (bar) bar.style.width = pct.toFixed(2) + '%';
    // Update elapsed time display
    const fmt = ms => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
    // Target only the first sp-time-row span (elapsed), not duration
    const timeRows = document.querySelectorAll('.sp-time-row');
    timeRows.forEach(row => {
      const span = row.querySelector('span:first-child');
      if (span) span.textContent = fmt(interpolated);
    });
  }, 1000);
}

// ── FIXED: fetchNowPlaying only re-renders DOM when track changes ──────────
async function fetchNowPlaying() {
  if (!spToken) return;
  try {
    const resp = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': `Bearer ${spToken}` }
    });
    if (resp.status === 204) { renderNowPlaying(null); return; }
    if (resp.status === 401) {
      const ok = await refreshSpotifyToken();
      if (ok) fetchNowPlaying();
      return;
    }
    const data = await resp.json();
    const prevUri = spCurrentTrack?.item?.uri;
    spCurrentTrack = data;

    if (data && data.item) {
      const newUri = data.item.uri;
      // Sync internal state variables used by the interpolator
      spLastProgress = data.progress_ms || 0;
      spLastDuration = data.item.duration_ms || 0;
      spLastPollTime = Date.now();
      spIsPlaying    = data.is_playing;

      // Only rebuild the DOM when the track actually changes or on first load.
      // When the same track is playing, the interpolator smoothly handles progress
      // and we just do a lightweight play/pause button sync to avoid any jump.
      if (newUri !== prevUri || prevUri === undefined) {
        renderNowPlaying(data);
      } else {
        updatePlayPauseButtons(spIsPlaying);
      }
    } else {
      spIsPlaying = false;
      renderNowPlaying(data);
    }
  } catch(e) { console.warn('Spotify poll:', e); }
}

// Lightweight: only update play/pause button icon + green dot — no DOM rebuild
function updatePlayPauseButtons(isPlaying) {
  const icon = isPlaying ? '⏸' : '▶';
  const title = isPlaying ? 'Pause' : 'Play';
  const focusPlay = document.querySelector('.sp-ctrl-btn.play');
  if (focusPlay) { focusPlay.textContent = icon; focusPlay.title = title; }
  const hdrPlay = document.querySelector('.hdr-sp-btn.play');
  if (hdrPlay) { hdrPlay.textContent = icon; hdrPlay.title = title; }
  const dot = document.querySelector('.hdr-sp-dot');
  if (dot) dot.style.opacity = isPlaying ? '1' : '0';
}

function updateNowPlayingFromSDK(sdkState) {
  if (!sdkState || !sdkState.track_window) return;
  const track = sdkState.track_window.current_track;
  const prevUri = spCurrentTrack?.item?.uri;
  const newUri  = track.uri;
  spLastProgress = sdkState.position || 0;
  spLastDuration = sdkState.duration || 0;
  spLastPollTime = Date.now();
  spIsPlaying    = !sdkState.paused;

  // Same track: just sync buttons; interpolator handles bar
  if (newUri === prevUri && prevUri !== undefined) {
    updatePlayPauseButtons(spIsPlaying);
    return;
  }

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

function renderNowPlaying(data) {
  if (!data || !data.item) {
    renderNowPlayingDirect(null);
    return;
  }
  const track = data.item;
  renderNowPlayingDirect({
    isPlaying:  data.is_playing,
    trackName:  track.name,
    artistName: track.artists.map(a => a.name).join(', '),
    albumArt:   track.album.images[0]?.url || '',
    albumName:  track.album.name,
    progress:   data.progress_ms,
    duration:   track.duration_ms,
    trackUri:   track.uri,
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
    container.innerHTML = `
      <div class="sp-idle">Nothing playing right now</div>
      <button class="sp-connect-btn" onclick="spotifyLogin()" style="margin-top:.5rem;background:var(--bg-elevated);color:var(--text-secondary);border:1px solid var(--border)">
        Reconnect Spotify
      </button>
    `;
    return;
  }

  const pct = info.duration ? (info.progress / info.duration) * 100 : 0;
  const fmt = ms => { const s=Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

  container.innerHTML = `
    <img class="sp-art-lg" src="${escH(info.albumArt)}" alt="${escH(info.albumName)}"
         onerror="this.style.background='var(--bg-elevated)'">
    <div class="sp-track-lg">${escH(info.trackName)}</div>
    <div class="sp-artist-lg">${escH(info.artistName)}</div>
    <div class="sp-progress-wrap">
      <div class="sp-progress-bar" style="width:${pct.toFixed(2)}%"></div>
    </div>
    <div class="sp-time-row">
      <span>${fmt(info.progress)}</span>
      <span>${fmt(info.duration)}</span>
    </div>
    <div class="sp-controls">
      <button class="sp-ctrl-btn" onclick="spPrev()" title="Previous">⏮</button>
      <button class="sp-ctrl-btn play" onclick="spPlayPause()" title="${info.isPlaying?'Pause':'Play'}">
        ${info.isPlaying ? '⏸' : '▶'}
      </button>
      <button class="sp-ctrl-btn" onclick="spNext()" title="Next">⏭</button>
    </div>
  `;
}

// ── Header widget (Spotify + Pomodoro) ───────────────────
function updateHeaderWidget(info) {
  ensureHeaderWidgets(info);
  const spSection = document.getElementById('sp-header-section');
  if (!spSection) return;

  if (!info) {
    spSection.innerHTML = `
      <button class="hdr-sp-connect" onclick="spotifyLogin()">♫ Connect Spotify</button>
    `;
    return;
  }

  const playIcon = info.isPlaying ? '⏸' : '▶';
  spSection.innerHTML = `
    <img class="hdr-art" src="${escH(info.albumArt)}" alt="art" onerror="this.style.opacity='.3'">
    <div class="hdr-track-info">
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

  // pom-edit-pop is created on demand inside pomOpenEdit()
}

// ── Playback controls ─────────────────────────────────────
async function spPlayPause() {
  if (!spToken) return;
  if (spPlayer) {
    spPlayer.togglePlay();
    return;
  }
  const state = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { 'Authorization': `Bearer ${spToken}` }
  }).then(r => r.json()).catch(() => null);

  const isPlaying = state?.is_playing;
  const endpoint  = isPlaying ? 'pause' : 'play';
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
  // Force full re-render after skip so new track shows immediately
  spCurrentTrack = null;
  setTimeout(fetchNowPlaying, 500);
}

async function spPrev() {
  if (!spToken) return;
  if (spPlayer) { spPlayer.previousTrack(); return; }
  await fetch('https://api.spotify.com/v1/me/player/previous', {
    method: 'POST', headers: { 'Authorization': `Bearer ${spToken}` }
  });
  spCurrentTrack = null;
  setTimeout(fetchNowPlaying, 500);
}
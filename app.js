'use strict';

/* =========================================================
   Meditazione Timer A.C.D. — logica applicazione
   Vanilla JS, nessuna dipendenza esterna. Tutti i dati
   (pagine, fasi, suoni) sono salvati in localStorage.
   ========================================================= */

const STORAGE_KEY = 'meditazione-acd-state-v1';

const SOUNDS = [
  { id: 'gong', label: 'Gong', emoji: '🔔' },
  { id: 'bell', label: 'Campanella', emoji: '🎐' },
  { id: 'birds', label: 'Cinguettio', emoji: '🐦' },
  { id: 'bowl', label: 'Ciotola tibetana', emoji: '🥣' },
];

// Colori ispirati ai chakra, assegnati in base al nome della fase
// (confronto per prefisso, così "Protezione casa" eredita lo stesso
// colore di "Protezione"). Il fallback è un viola meditativo.
const PHASE_COLOR_RULES = [
  ['rilassamento', '#7dd3fc'],
  ['chi', '#fb923c'],
  ['plesso', '#fbbf24'],
  ['cuore', '#34d399'],
  ['mente', '#818cf8'],
  ['corona', '#c084fc'],
  ['finale', '#f5d0fe'],
  ['taglio', '#fb7185'],
  ['protezione', '#38bdf8'],
];

function colorForPhase(name) {
  const n = String(name || '').trim().toLowerCase();
  for (const [prefix, color] of PHASE_COLOR_RULES) {
    if (n.startsWith(prefix)) return color;
  }
  return '#a78bfa';
}

/* ---------------- suoni sintetizzati (Web Audio API) ----------------
   Nessun file audio da scaricare: ogni suono è generato al volo,
   quindi funziona anche offline ed è leggerissimo. */

const SOUND_PLAYERS = {
  gong(ctx, dest, t0) {
    const dur = 4.2;
    const bufferSize = Math.floor(ctx.sampleRate * 0.15);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 500;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    noise.connect(noiseFilter).connect(noiseGain).connect(dest);
    noise.start(t0);
    noise.stop(t0 + 0.16);

    const partials = [82, 123, 146, 219];
    partials.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const peak = 0.5 / (i + 1);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur - i * 0.3);
      osc.connect(g).connect(dest);
      osc.start(t0);
      osc.stop(t0 + dur + 0.2);
    });
  },

  bell(ctx, dest, t0) {
    const dur = 2.6;
    const fundamental = 740;
    const partials = [1, 2.41, 3.89, 5.12];
    partials.forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = fundamental * mult;
      const g = ctx.createGain();
      const peak = 0.35 / (i + 1);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / (1 + i * 0.6));
      osc.connect(g).connect(dest);
      osc.start(t0);
      osc.stop(t0 + dur + 0.3);
    });
  },

  birds(ctx, dest, t0) {
    let t = t0;
    const chirps = 4;
    for (let i = 0; i < chirps; i++) {
      const base = 2400 + Math.random() * 900;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.08);
      osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.14);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(g).connect(dest);
      osc.start(t);
      osc.stop(t + 0.2);
      t += 0.16 + Math.random() * 0.09;
    }
  },

  bowl(ctx, dest, t0) {
    const dur = 5.5;
    const freqs = [196, 198.5, 392, 588];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const peak = i < 2 ? 0.28 : 0.1;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(dest);
      osc.start(t0);
      osc.stop(t0 + dur + 0.3);
    });
  },
};

let audioCtx = null;
let masterGain = null;

function ensureAudioUnlocked() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = state.settings.volume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(id) {
  ensureAudioUnlocked();
  const player = SOUND_PLAYERS[id] || SOUND_PLAYERS.bell;
  const t0 = audioCtx.currentTime + 0.02;
  player(audioCtx, masterGain, t0);
}

function playPhaseSound(phase) {
  const id = (phase && phase.sound) || state.settings.globalSound;
  playSound(id);
}

/* ---------------- utilità varie ---------------- */

function uid(prefix) {
  return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
}

function ph(name, seconds) {
  return { id: uid('ph'), name, seconds, sound: null };
}

function builtinTemplates() {
  return [
    {
      id: 'home',
      name: 'Meditazione Principale',
      builtin: true,
      phases: [
        ph('Rilassamento', 5 * 60),
        ph('Chi', 7 * 60),
        ph('Plesso', 4 * 60),
        ph('Cuore', 7 * 60),
        ph('Mente', 7 * 60),
        ph('Corona', 3 * 60),
        ph('Finale', 2 * 60),
      ],
    },
    {
      id: 'taglio-protezione',
      name: 'Taglio + Protezione',
      builtin: true,
      phases: [
        ph('Rilassamento', 2 * 60),
        ph('Taglio', 5 * 60),
        ph('Protezione', 5 * 60),
      ],
    },
    {
      id: 'protezione-casa',
      name: 'Protezione Personale + Casa',
      builtin: true,
      phases: [
        ph('Rilassamento', 2 * 60),
        ph('Protezione personale', 5 * 60),
        ph('Protezione casa', 5 * 60),
        ph('Protezione quartiere', 5 * 60),
      ],
    },
  ];
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getPage(id) {
  return state.pages.find((p) => p.id === id);
}

function totalDurationMs(page) {
  return page.phases.reduce((sum, p) => sum + p.seconds * 1000, 0);
}

/* ---------------- date e calendario ---------------- */

const MONTH_NAMES_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const WEEKDAY_SHORT_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const WEEKDAY_LONG_IT = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function todayKey() {
  return dateKey(new Date());
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/* ---------------- musica: brani di partenza ---------------- */

function defaultMusicTracks() {
  return [
    { id: uid('track'), title: '1 Hour Meditation Music — Yellow Brick Cinema', type: 'youtube', embedUrl: 'https://www.youtube-nocookie.com/embed/5PIBMLvcAzc', sourceUrl: 'https://www.youtube.com/watch?v=5PIBMLvcAzc' },
    { id: uid('track'), title: 'Meditation & Relaxing Music — Yellow Brick Cinema', type: 'youtube', embedUrl: 'https://www.youtube-nocookie.com/embed/LpOwzzQyK70', sourceUrl: 'https://www.youtube.com/watch?v=LpOwzzQyK70' },
    { id: uid('track'), title: 'Peaceful Meditation (Spotify)', type: 'spotify', embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWZqd5JICZI0u', sourceUrl: 'https://open.spotify.com/playlist/37i9dQZF1DWZqd5JICZI0u' },
    { id: uid('track'), title: 'Deep Sleep (Spotify)', type: 'spotify', embedUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DWYcDQ1hSjOpY', sourceUrl: 'https://open.spotify.com/playlist/37i9dQZF1DWYcDQ1hSjOpY' },
  ];
}

function parseMusicUrl(url) {
  let u;
  try {
    u = new URL(String(url).trim());
  } catch (e) {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (u.pathname === '/watch') id = u.searchParams.get('v');
    else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2];
    else if (u.pathname.startsWith('/live/')) id = u.pathname.split('/')[2];
    if (id) {
      id = id.split('&')[0].split('?')[0];
      return { type: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, sourceUrl: url };
    }
  }
  if (host === 'open.spotify.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const type = parts[parts.length - 2];
      const id = parts[parts.length - 1];
      if (['track', 'playlist', 'album', 'episode', 'show', 'artist'].includes(type)) {
        return { type: 'spotify', embedUrl: `https://open.spotify.com/embed/${type}/${id}`, sourceUrl: url };
      }
    }
  }
  return null;
}

/* ---------------- persistenza ---------------- */

function loadState() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    raw = null;
  }
  if (!raw || !Array.isArray(raw.pages) || raw.pages.length === 0) {
    return {
      pages: builtinTemplates(),
      settings: { globalSound: 'bell', volume: 0.85 },
      lastPageId: 'home',
      calendar: {},
      music: { tracks: defaultMusicTracks() },
    };
  }
  raw.settings = Object.assign({ globalSound: 'bell', volume: 0.85 }, raw.settings || {});
  if (!raw.lastPageId || !raw.pages.some((p) => p.id === raw.lastPageId)) {
    raw.lastPageId = raw.pages[0].id;
  }
  if (!raw.calendar || typeof raw.calendar !== 'object') raw.calendar = {};
  if (!raw.music || !Array.isArray(raw.music.tracks)) raw.music = { tracks: defaultMusicTracks() };
  return raw;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* storage non disponibile: l'app continua a funzionare in memoria */
  }
}

/* ---------------- stato applicazione ---------------- */

let state = loadState();
let ui = {
  view: 'timer',
  pageId: state.lastPageId,
  editingPageId: null,
  editingDraft: null,
  calendarMonth: { y: new Date().getFullYear(), m: new Date().getMonth() },
  calendarSelectedDate: todayKey(),
  musicExpandedId: null,
};

function idleSession(pageId) {
  return {
    status: 'idle',
    pageId: pageId || ui.pageId,
    phaseIndex: 0,
    remainingMs: 0,
    phaseTotalMs: 0,
    endAt: null,
    timerId: null,
    wakeLock: null,
  };
}

let session = idleSession(ui.pageId);
let domRefs = {};

/* ---------------- wake lock (schermo acceso durante la meditazione) ---------------- */

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      session.wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) {
    /* non critico: l'app funziona comunque */
  }
}

function releaseWakeLock() {
  try {
    if (session && session.wakeLock) session.wakeLock.release();
  } catch (e) { /* ignore */ }
  if (session) session.wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && session && session.status === 'running' && !session.wakeLock) {
    requestWakeLock();
  }
});

/* ---------------- motore del timer ---------------- */

function clearSessionTimer() {
  if (session && session.timerId) {
    clearInterval(session.timerId);
    session.timerId = null;
  }
}

function stopSessionSilently() {
  clearSessionTimer();
  releaseWakeLock();
}

function startSession(pageId) {
  ensureAudioUnlocked();
  const page = getPage(pageId);
  if (!page || !page.phases.length) return;
  stopSessionSilently();
  const firstPhase = page.phases[0];
  session = {
    status: 'running',
    pageId,
    phaseIndex: 0,
    remainingMs: firstPhase.seconds * 1000,
    phaseTotalMs: firstPhase.seconds * 1000,
    endAt: Date.now() + firstPhase.seconds * 1000,
    timerId: null,
    wakeLock: null,
  };
  requestWakeLock();
  session.timerId = setInterval(tickSession, 200);
  renderMain();
}

function pauseSession() {
  if (!session || session.status !== 'running') return;
  session.remainingMs = Math.max(0, session.endAt - Date.now());
  session.status = 'paused';
  clearSessionTimer();
  releaseWakeLock();
  renderMain();
}

function resumeSession() {
  if (!session || session.status !== 'paused') return;
  session.endAt = Date.now() + session.remainingMs;
  session.status = 'running';
  requestWakeLock();
  session.timerId = setInterval(tickSession, 200);
  renderMain();
}

function stopSession() {
  stopSessionSilently();
  session = idleSession(ui.pageId);
  renderMain();
}

function skipPhase() {
  if (!session || (session.status !== 'running' && session.status !== 'paused')) return;
  advancePhase(true);
}

function jumpToPhase(index) {
  const page = getPage(session.pageId);
  if (!page || index < 0 || index >= page.phases.length) return;
  session.phaseIndex = index;
  session.phaseTotalMs = page.phases[index].seconds * 1000;
  session.remainingMs = session.phaseTotalMs;
  if (session.status === 'running') {
    session.endAt = Date.now() + session.remainingMs;
  }
  renderMain();
}

function advancePhase(manual) {
  const page = getPage(session.pageId);
  if (!page) return;
  const finishedPhase = page.phases[session.phaseIndex];
  if (!manual) {
    playPhaseSound(finishedPhase);
    try { navigator.vibrate && navigator.vibrate([80, 60, 80]); } catch (e) { /* ignore */ }
  }
  const nextIndex = session.phaseIndex + 1;
  if (nextIndex >= page.phases.length) {
    stopSessionSilently();
    session.status = 'finished';
    renderMain();
    promptAddToCalendar(page);
    return;
  }
  session.phaseIndex = nextIndex;
  session.phaseTotalMs = page.phases[nextIndex].seconds * 1000;
  session.remainingMs = session.phaseTotalMs;
  if (session.status === 'running') {
    session.endAt = Date.now() + session.remainingMs;
  }
  renderMain();
}

function tickSession() {
  if (!session || session.status !== 'running') return;
  const remaining = session.endAt - Date.now();
  if (remaining <= 0) {
    advancePhase(false);
  } else {
    session.remainingMs = remaining;
    updateTimerDom();
  }
}

function updateTimerDom() {
  if (!domRefs.timeDisplay) return;
  domRefs.timeDisplay.textContent = fmt(session.remainingMs);
  if (domRefs.ringFg) {
    const fraction = session.phaseTotalMs > 0 ? session.remainingMs / session.phaseTotalMs : 0;
    const offset = domRefs.ringCircumference * (1 - fraction);
    domRefs.ringFg.style.strokeDashoffset = String(offset);
  }
}

/* ---------------- toast ---------------- */

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------------- modali ---------------- */

function showConfirm(message, onConfirm, confirmLabel) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card modal-card">
      <p style="margin:0 0 4px; font-size:15px; line-height:1.5;">${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="modalCancel">Annulla</button>
        <button class="btn btn-danger" id="modalConfirm">${escapeHtml(confirmLabel || 'Conferma')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#modalCancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#modalConfirm').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
}

function openNewPageModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card modal-card">
      <h3 class="serif" style="margin-bottom:14px; font-size:22px;">Nuova pagina</h3>
      <div class="field">
        <label>Nome pagina</label>
        <input type="text" id="newPageNameInput" placeholder="Es. Meditazione della sera" />
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="newPageCancel">Annulla</button>
        <button class="btn btn-primary" id="newPageCreate">Crea</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#newPageNameInput');
  setTimeout(() => input.focus(), 30);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#newPageCancel').addEventListener('click', () => overlay.remove());
  const create = () => {
    const name = input.value.trim() || 'Nuova meditazione';
    const newPage = { id: uid('page'), name, builtin: false, phases: [ph('Rilassamento', 2 * 60)] };
    state.pages.push(newPage);
    saveState();
    overlay.remove();
    openEdit(newPage.id);
    showToast('Pagina creata: aggiungi le fasi e salva');
  };
  overlay.querySelector('#newPageCreate').addEventListener('click', create);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
}

function promptAddToCalendar(page) {
  const key = todayKey();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card modal-card">
      <h3 class="serif" style="margin-bottom:10px; font-size:22px;">Aggiungere al calendario?</h3>
      <p style="margin:0 0 4px; font-size:14px; color:var(--ink-soft); line-height:1.5;">Vuoi segnare "${escapeHtml(page.name)}" tra le pratiche di oggi?</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="calSkipBtn">No, grazie</button>
        <button type="button" class="btn btn-primary" id="calYesBtn">Sì, aggiungi</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#calSkipBtn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#calYesBtn').addEventListener('click', () => {
    addPracticeToDay(key, page);
    overlay.remove();
  });
}

/* ---------------- navigazione ---------------- */

function selectPage(id) {
  if (session && (session.status === 'running' || session.status === 'paused') && session.pageId !== id) {
    stopSessionSilently();
    showToast('Sessione precedente interrotta');
  }
  ui.pageId = id;
  ui.view = 'timer';
  ui.editingDraft = null;
  state.lastPageId = id;
  saveState();
  session = idleSession(id);
  renderAll();
}

function openEdit(pageId) {
  const page = getPage(pageId);
  if (!page) return;
  ui.editingPageId = pageId;
  ui.editingDraft = deepClone(page);
  ui.view = 'edit';
  renderAll();
}

function confirmDeletePage(pageId) {
  const page = getPage(pageId);
  if (!page) return;
  if (pageId === 'home') { showToast('La pagina principale non può essere eliminata'); return; }
  showConfirm(`Eliminare la pagina "${page.name}"? L'azione non può essere annullata.`, () => {
    state.pages = state.pages.filter((p) => p.id !== pageId);
    if (state.pages.length === 0) state.pages = builtinTemplates();
    saveState();
    const fallback = state.pages[0].id;
    ui.pageId = fallback;
    state.lastPageId = fallback;
    ui.view = 'timer';
    ui.editingDraft = null;
    saveState();
    session = idleSession(fallback);
    renderAll();
    showToast('Pagina eliminata');
  }, 'Elimina');
}

function resetPageToDefault(pageId) {
  const tmpl = builtinTemplates().find((p) => p.id === pageId);
  if (!tmpl) return;
  ui.editingDraft = tmpl;
  renderMain();
  showToast('Valori predefiniti ripristinati: ricordati di salvare');
}

function saveEditAndClose() {
  const draft = ui.editingDraft;
  if (!draft.name.trim()) { showToast('Il nome della pagina non può essere vuoto'); return; }
  if (draft.phases.length === 0) { showToast('Aggiungi almeno una fase'); return; }
  draft.phases.forEach((p) => {
    p.seconds = Math.max(1, Math.round(p.seconds));
    if (!p.name.trim()) p.name = 'Fase';
  });
  const idx = state.pages.findIndex((p) => p.id === draft.id);
  if (idx >= 0) state.pages[idx] = draft;
  else state.pages.push(draft);
  saveState();
  ui.pageId = draft.id;
  state.lastPageId = draft.id;
  saveState();
  session = idleSession(draft.id);
  ui.view = 'timer';
  ui.editingDraft = null;
  renderAll();
  showToast('Pagina salvata ✓');
}

function confirmResetAll() {
  showConfirm('Ripristinare l’app ai valori predefiniti? Tutte le pagine personalizzate e le modifiche verranno perse.', () => {
    localStorage.removeItem(STORAGE_KEY);
    stopSessionSilently();
    state = loadState();
    ui = {
      view: 'timer',
      pageId: state.pages[0].id,
      editingPageId: null,
      editingDraft: null,
      calendarMonth: { y: new Date().getFullYear(), m: new Date().getMonth() },
      calendarSelectedDate: todayKey(),
      musicExpandedId: null,
    };
    session = idleSession(ui.pageId);
    renderAll();
    renderMusicDock();
    showToast('App ripristinata ai valori predefiniti');
  }, 'Ripristina');
}

/* ---------------- rendering: tabs ---------------- */

function renderTabs() {
  const wrap = document.getElementById('pageTabs');
  wrap.innerHTML = '';
  state.pages.forEach((page) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'page-tab' + (ui.pageId === page.id && (ui.view === 'timer' || ui.view === 'edit') ? ' active' : '');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = page.name;
    btn.appendChild(nameSpan);
    if (page.id !== 'home') {
      const delBtn = document.createElement('span');
      delBtn.className = 'page-tab-del';
      delBtn.textContent = '✕';
      delBtn.title = 'Elimina pagina';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeletePage(page.id);
      });
      btn.appendChild(delBtn);
    }
    btn.addEventListener('click', () => selectPage(page.id));
    wrap.appendChild(btn);
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'page-tab add';
  addBtn.textContent = '+ Nuova pagina';
  addBtn.addEventListener('click', openNewPageModal);
  wrap.appendChild(addBtn);
}

/* ---------------- rendering: timer view ---------------- */

function statusLabel() {
  if (!session) return '';
  if (session.status === 'running') return 'In corso';
  if (session.status === 'paused') return 'In pausa';
  return 'Pronta per iniziare';
}

function pillsMarkup(page, currentIndex) {
  return page.phases.map((p, i) => {
    const color = colorForPhase(p.name);
    let cls = '';
    if (currentIndex >= 0) {
      cls = i < currentIndex ? 'done' : (i === currentIndex ? 'current' : '');
    }
    return `<button class="phase-pill ${cls}" style="--pill-color:${color}" data-phase-index="${i}">
      <span class="dot"></span>
      <span class="p-name">${escapeHtml(p.name)}</span>
      <span class="p-dur">${fmt(p.seconds * 1000)}</span>
    </button>`;
  }).join('');
}

function wirePillClicks(page) {
  document.querySelectorAll('.phase-pill').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.phaseIndex, 10);
      if (session.status === 'idle' || session.status === 'finished') {
        session = idleSession(page.id);
        session.status = 'paused';
        session.phaseIndex = idx;
        session.phaseTotalMs = page.phases[idx].seconds * 1000;
        session.remainingMs = session.phaseTotalMs;
        renderMain();
      } else {
        jumpToPhase(idx);
      }
    });
  });
}

function renderControls(page) {
  const wrap = document.getElementById('controlsWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  const mk = (cls, label, id) => {
    const b = document.createElement('button');
    b.className = 'btn ' + cls;
    b.id = id;
    b.textContent = label;
    return b;
  };

  if (session.status === 'idle') {
    const start = mk('btn-primary', 'Inizia', 'startBtn');
    start.addEventListener('click', () => startSession(page.id));
    const edit = mk('btn-ghost', 'Modifica fasi', 'editFromTimerBtn');
    edit.addEventListener('click', () => openEdit(page.id));
    wrap.append(start, edit);
  } else if (session.status === 'running') {
    const pause = mk('btn-secondary', 'Pausa', 'pauseBtn');
    pause.addEventListener('click', pauseSession);
    const skip = mk('btn-ghost', 'Salta fase', 'skipBtn');
    skip.addEventListener('click', skipPhase);
    const stop = mk('btn-danger', 'Termina', 'stopBtn');
    stop.addEventListener('click', stopSession);
    wrap.append(pause, skip, stop);
  } else if (session.status === 'paused') {
    const resume = mk('btn-primary', 'Riprendi', 'resumeBtn');
    resume.addEventListener('click', resumeSession);
    const skip = mk('btn-ghost', 'Salta fase', 'skipBtn');
    skip.addEventListener('click', skipPhase);
    const stop = mk('btn-danger', 'Termina', 'stopBtn');
    stop.addEventListener('click', stopSession);
    wrap.append(resume, skip, stop);
  }
}

function renderTimerView() {
  const page = getPage(ui.pageId);
  const main = document.getElementById('mainView');
  domRefs = {};
  if (!page) {
    main.innerHTML = '<div class="empty-state">Pagina non trovata.</div>';
    return;
  }

  if (session.status === 'finished') {
    main.innerHTML = `
      <div class="card finished-card">
        <div class="finished-icon">🧘‍♀️✨</div>
        <h2 class="serif">Sessione completata</h2>
        <p class="help-text">Hai meditato per ${fmt(totalDurationMs(page))} su "${escapeHtml(page.name)}".</p>
        <div class="controls">
          <button class="btn btn-primary" id="restartBtn">Ricomincia</button>
          <button class="btn btn-ghost" id="doneBtn">Fatto</button>
        </div>
      </div>`;
    document.getElementById('restartBtn').addEventListener('click', () => startSession(page.id));
    document.getElementById('doneBtn').addEventListener('click', () => { session = idleSession(page.id); renderMain(); });
    return;
  }

  const isIdle = session.status === 'idle';
  const currentPhase = page.phases[session.phaseIndex] || page.phases[0];
  const color = colorForPhase(currentPhase ? currentPhase.name : '');
  const total = isIdle ? (currentPhase ? currentPhase.seconds * 1000 : 0) : session.phaseTotalMs;
  const remaining = isIdle ? total : session.remainingMs;
  const fraction = total > 0 ? remaining / total : 0;
  const r = 130;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - fraction);

  main.innerHTML = `
    <div class="card timer-view">
      <div class="page-name serif">${escapeHtml(page.name)}</div>
      <div class="ring-wrap">
        <svg viewBox="0 0 300 300">
          <circle class="ring-bg" cx="150" cy="150" r="${r}"></circle>
          <circle class="ring-fg" id="ringFg" cx="150" cy="150" r="${r}"
            stroke="${color}"
            stroke-dasharray="${C}"
            stroke-dashoffset="${offset}"></circle>
        </svg>
        <div class="ring-center ${session.status === 'running' ? 'breathing' : ''}">
          <div class="phase-name serif" style="color:${color}">${escapeHtml(currentPhase ? currentPhase.name : '—')}</div>
          <div class="time-display" id="timeDisplayEl">${fmt(remaining)}</div>
          <div class="phase-status">${statusLabel()}</div>
        </div>
      </div>
      <div class="controls" id="controlsWrap"></div>
      <div class="phase-strip">
        <div class="phase-pill-row">${pillsMarkup(page, isIdle ? -1 : session.phaseIndex)}</div>
        <div class="total-time">Durata totale: ${fmt(totalDurationMs(page))}</div>
      </div>
    </div>`;

  renderControls(page);
  wirePillClicks(page);

  domRefs.ringFg = document.getElementById('ringFg');
  domRefs.timeDisplay = document.getElementById('timeDisplayEl');
  domRefs.ringCircumference = C;
}

/* ---------------- rendering: edit view ---------------- */

function renderPhaseEditorList(draft) {
  const list = document.getElementById('phaseEditorList');
  if (!list) return;
  list.innerHTML = draft.phases.map((p, i) => {
    const color = colorForPhase(p.name);
    const mins = Math.floor(p.seconds / 60);
    const secs = p.seconds % 60;
    return `
    <div class="phase-editor-item" data-index="${i}">
      <div class="phase-editor-row">
        <span class="phase-color-dot" style="background:${color}"></span>
        <input type="text" class="name-input phase-name-input" data-index="${i}" value="${escapeHtml(p.name)}" placeholder="Nome fase" />
        <div class="time-inputs">
          <input type="number" min="0" max="180" class="min-input" data-index="${i}" value="${mins}" /><span class="time-unit">min</span>
          <span class="time-sep">:</span>
          <input type="number" min="0" max="59" class="sec-input" data-index="${i}" value="${secs}" /><span class="time-unit">sec</span>
        </div>
      </div>
      <div class="phase-editor-row2">
        <select class="sound-select" data-index="${i}">
          <option value="" ${!p.sound ? 'selected' : ''}>🔊 Suono generale</option>
          ${SOUNDS.map((s) => `<option value="${s.id}" ${p.sound === s.id ? 'selected' : ''}>${s.emoji} ${s.label}</option>`).join('')}
        </select>
        <button type="button" class="mini-btn preview-sound-btn" data-index="${i}" title="Ascolta">▶</button>
        <span style="flex:1"></span>
        <button type="button" class="mini-btn move-up-btn" data-index="${i}" ${i === 0 ? 'disabled' : ''} title="Sposta su">↑</button>
        <button type="button" class="mini-btn move-down-btn" data-index="${i}" ${i === draft.phases.length - 1 ? 'disabled' : ''} title="Sposta giù">↓</button>
        <button type="button" class="mini-btn delete-phase-btn" data-index="${i}" ${draft.phases.length <= 1 ? 'disabled' : ''} title="Elimina fase">🗑</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.phase-name-input').forEach((el) => el.addEventListener('input', (e) => {
    draft.phases[+e.target.dataset.index].name = e.target.value;
    const dot = e.target.closest('.phase-editor-item').querySelector('.phase-color-dot');
    dot.style.background = colorForPhase(e.target.value);
  }));
  list.querySelectorAll('.min-input').forEach((el) => el.addEventListener('input', (e) => {
    const i = +e.target.dataset.index;
    const secs = draft.phases[i].seconds % 60;
    const mins = Math.max(0, parseInt(e.target.value, 10) || 0);
    draft.phases[i].seconds = mins * 60 + secs;
  }));
  list.querySelectorAll('.sec-input').forEach((el) => el.addEventListener('input', (e) => {
    const i = +e.target.dataset.index;
    const mins = Math.floor(draft.phases[i].seconds / 60);
    const secs = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0));
    draft.phases[i].seconds = mins * 60 + secs;
  }));
  list.querySelectorAll('.sound-select').forEach((el) => el.addEventListener('change', (e) => {
    const i = +e.target.dataset.index;
    draft.phases[i].sound = e.target.value || null;
  }));
  list.querySelectorAll('.preview-sound-btn').forEach((el) => el.addEventListener('click', (e) => {
    const i = +e.currentTarget.dataset.index;
    const soundId = draft.phases[i].sound || state.settings.globalSound;
    playSound(soundId);
  }));
  list.querySelectorAll('.move-up-btn').forEach((el) => el.addEventListener('click', (e) => {
    const i = +e.currentTarget.dataset.index;
    if (i > 0) {
      [draft.phases[i - 1], draft.phases[i]] = [draft.phases[i], draft.phases[i - 1]];
      renderPhaseEditorList(draft);
    }
  }));
  list.querySelectorAll('.move-down-btn').forEach((el) => el.addEventListener('click', (e) => {
    const i = +e.currentTarget.dataset.index;
    if (i < draft.phases.length - 1) {
      [draft.phases[i + 1], draft.phases[i]] = [draft.phases[i], draft.phases[i + 1]];
      renderPhaseEditorList(draft);
    }
  }));
  list.querySelectorAll('.delete-phase-btn').forEach((el) => el.addEventListener('click', (e) => {
    const i = +e.currentTarget.dataset.index;
    if (draft.phases.length > 1) {
      draft.phases.splice(i, 1);
      renderPhaseEditorList(draft);
    }
  }));
}

function renderEditView() {
  const draft = ui.editingDraft;
  const main = document.getElementById('mainView');
  if (!draft) {
    main.innerHTML = '<div class="empty-state">Nessuna pagina in modifica.</div>';
    return;
  }

  main.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2 class="serif">Modifica pagina</h2>
        <button class="icon-btn" id="closeEditBtn" title="Chiudi senza salvare">✕</button>
      </div>
      <div class="field">
        <label>Nome pagina</label>
        <input type="text" id="pageNameInput" value="${escapeHtml(draft.name)}" />
      </div>
      <div class="phase-editor-list" id="phaseEditorList"></div>
      <button type="button" class="btn btn-ghost add-phase-btn" id="addPhaseBtn">+ Aggiungi fase</button>
      <div class="edit-actions">
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${draft.builtin ? '<button type="button" class="btn btn-ghost" id="resetPageBtn">Ripristina predefiniti</button>' : ''}
          ${draft.id !== 'home' ? '<button type="button" class="btn btn-danger" id="deletePageBtn">Elimina pagina</button>' : ''}
        </div>
        <button type="button" class="btn btn-primary" id="saveEditBtn">Salva</button>
      </div>
    </div>`;

  renderPhaseEditorList(draft);

  document.getElementById('closeEditBtn').addEventListener('click', () => {
    ui.view = 'timer';
    ui.editingDraft = null;
    renderAll();
  });
  document.getElementById('pageNameInput').addEventListener('input', (e) => { draft.name = e.target.value; });
  document.getElementById('addPhaseBtn').addEventListener('click', () => {
    draft.phases.push(ph('Nuova fase', 5 * 60));
    renderPhaseEditorList(draft);
  });
  document.getElementById('saveEditBtn').addEventListener('click', saveEditAndClose);
  const resetBtn = document.getElementById('resetPageBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => resetPageToDefault(draft.id));
  const deleteBtn = document.getElementById('deletePageBtn');
  if (deleteBtn) deleteBtn.addEventListener('click', () => confirmDeletePage(draft.id));
}

/* ---------------- rendering: settings view ---------------- */

function renderSettingsView() {
  const main = document.getElementById('mainView');
  main.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2 class="serif">Impostazioni</h2>
        <button class="icon-btn" id="closeSettingsBtn" title="Chiudi">✕</button>
      </div>

      <div class="field"><label>Suono generale (usato dalle fasi senza suono personalizzato)</label></div>
      <div id="soundList"></div>

      <hr class="divider" />

      <div class="field">
        <label>Volume</label>
        <input type="range" class="slider" id="volumeSlider" min="0" max="100" value="${Math.round(state.settings.volume * 100)}" />
      </div>
      <p class="help-text">Ogni fase può avere un suono diverso da quello generale: apri "Modifica fasi" su una pagina e scegli il suono per la singola fase.</p>

      <hr class="divider" />
      <button type="button" class="btn btn-danger" id="resetAllBtn">Ripristina app ai valori predefiniti</button>
    </div>`;

  const soundList = document.getElementById('soundList');
  soundList.innerHTML = SOUNDS.map((s) => `
    <div class="sound-row">
      <div class="sound-row-label">
        <span class="sound-swatch">${s.emoji}</span>
        <span>${s.label}</span>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <button type="button" class="mini-btn preview-global-sound" data-id="${s.id}" title="Ascolta">▶</button>
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--ink-soft); cursor:pointer;">
          <input type="radio" name="globalSound" value="${s.id}" ${state.settings.globalSound === s.id ? 'checked' : ''} />
          usa
        </label>
      </div>
    </div>`).join('');

  soundList.querySelectorAll('.preview-global-sound').forEach((btn) => btn.addEventListener('click', () => playSound(btn.dataset.id)));
  soundList.querySelectorAll('input[name="globalSound"]').forEach((radio) => radio.addEventListener('change', (e) => {
    state.settings.globalSound = e.target.value;
    saveState();
    showToast('Suono generale aggiornato');
  }));

  document.getElementById('volumeSlider').addEventListener('input', (e) => {
    state.settings.volume = (+e.target.value) / 100;
    if (masterGain) masterGain.gain.value = state.settings.volume;
    saveState();
  });

  document.getElementById('closeSettingsBtn').addEventListener('click', () => { ui.view = 'timer'; renderAll(); });
  document.getElementById('resetAllBtn').addEventListener('click', confirmResetAll);
}

/* ---------------- calendario: dati ---------------- */

function getDayData(key) {
  return state.calendar[key] || { practices: [], notes: [] };
}

function ensureDayData(key) {
  if (!state.calendar[key]) state.calendar[key] = { practices: [], notes: [] };
  return state.calendar[key];
}

function addPracticeToDay(key, page) {
  const day = ensureDayData(key);
  const entry = day.practices.find((p) => p.pageId === page.id);
  if (entry) entry.count += 1;
  else day.practices.push({ id: uid('prac'), pageId: page.id, label: page.name, count: 1 });
  saveState();
  renderMain();
  showToast('Aggiunto al calendario ✓');
}

function incrementPractice(key, id) {
  const day = ensureDayData(key);
  const entry = day.practices.find((p) => p.id === id);
  if (entry) {
    entry.count += 1;
    saveState();
    renderMain();
  }
}

function removePractice(key, id) {
  const day = ensureDayData(key);
  day.practices = day.practices.filter((p) => p.id !== id);
  saveState();
  renderMain();
}

function addNoteToDay(key, text) {
  const day = ensureDayData(key);
  day.notes.push({ id: uid('note'), text });
  saveState();
  renderMain();
}

function removeNote(key, id) {
  const day = ensureDayData(key);
  day.notes = day.notes.filter((n) => n.id !== id);
  saveState();
  renderMain();
}

/* ---------------- rendering: calendario ---------------- */

function renderCalendarView() {
  const main = document.getElementById('mainView');
  const { y, m } = ui.calendarMonth;
  const firstOfMonth = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const jsDay = firstOfMonth.getDay();
  const leadingBlanks = (jsDay + 6) % 7;

  let cellsHtml = '';
  for (let i = 0; i < leadingBlanks; i++) cellsHtml += '<div class="cal-day cal-day-empty"></div>';
  const todK = todayKey();
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${y}-${pad2(m + 1)}-${pad2(day)}`;
    const data = getDayData(key);
    const dots = data.practices.slice(0, 4).map((p) => `<span class="dot" style="background:${colorForPhase(p.label)}"></span>`).join('');
    const cls = ['cal-day'];
    if (key === todK) cls.push('today');
    if (key === ui.calendarSelectedDate) cls.push('selected');
    cellsHtml += `<button type="button" class="${cls.join(' ')}" data-date="${key}">
      <span class="cal-day-num">${day}</span>
      ${data.practices.length ? `<span class="dots">${dots}</span>` : ''}
    </button>`;
  }

  main.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2 class="serif">Calendario pratiche</h2>
        <button class="icon-btn" id="closeCalendarBtn" title="Chiudi">✕</button>
      </div>
      <div class="cal-nav">
        <button type="button" class="mini-btn" id="calPrevBtn" title="Mese precedente">‹</button>
        <div class="cal-month-label serif">${MONTH_NAMES_IT[m]} ${y}</div>
        <button type="button" class="mini-btn" id="calNextBtn" title="Mese successivo">›</button>
      </div>
      <div class="cal-weekdays">${WEEKDAY_SHORT_IT.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="cal-grid">${cellsHtml}</div>
      <button type="button" class="btn btn-ghost btn-sm" id="calTodayBtn" style="margin-top:14px;">Vai a oggi</button>
      <hr class="divider" />
      <div id="calDayDetail"></div>
    </div>`;

  document.getElementById('closeCalendarBtn').addEventListener('click', () => { ui.view = 'timer'; renderAll(); });
  document.getElementById('calPrevBtn').addEventListener('click', () => {
    ui.calendarMonth = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
    renderMain();
  });
  document.getElementById('calNextBtn').addEventListener('click', () => {
    ui.calendarMonth = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
    renderMain();
  });
  document.getElementById('calTodayBtn').addEventListener('click', () => {
    const now = new Date();
    ui.calendarMonth = { y: now.getFullYear(), m: now.getMonth() };
    ui.calendarSelectedDate = todayKey();
    renderMain();
  });
  main.querySelectorAll('.cal-day[data-date]').forEach((btn) => {
    btn.addEventListener('click', () => { ui.calendarSelectedDate = btn.dataset.date; renderMain(); });
  });

  renderCalDayDetail();
}

function renderCalDayDetail() {
  const wrap = document.getElementById('calDayDetail');
  if (!wrap) return;
  const key = ui.calendarSelectedDate;
  const data = getDayData(key);
  const d = parseDateKey(key);
  const label = `${WEEKDAY_LONG_IT[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTH_NAMES_IT[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;

  wrap.innerHTML = `
    <h3 class="serif" style="font-size:19px; margin-bottom:12px;">${escapeHtml(label)}</h3>
    <div id="calPracticeList" style="margin-bottom:10px;"></div>
    <button type="button" class="btn btn-ghost btn-sm" id="calAddPracticeBtn">+ Aggiungi pratica</button>
    <div id="calPracticePicker"></div>
    <hr class="divider" />
    <div id="calNoteList" style="margin-bottom:6px;"></div>
    <div id="calNoteForm"></div>
  `;

  renderCalPracticeList(key, data);
  renderCalNoteList(key, data);
  renderCalNoteForm(key);

  document.getElementById('calAddPracticeBtn').addEventListener('click', () => togglePracticePicker());
}

function renderCalPracticeList(key, data) {
  const wrap = document.getElementById('calPracticeList');
  if (!wrap) return;
  if (!data.practices.length) {
    wrap.innerHTML = '<p class="help-text">Nessuna pratica registrata per questo giorno.</p>';
    return;
  }
  wrap.innerHTML = data.practices.map((p) => `
    <div class="phase-editor-item" style="padding:10px 14px; margin-bottom:8px;">
      <div class="phase-editor-row" style="justify-content:space-between; flex-wrap:nowrap;">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <span class="phase-color-dot" style="background:${colorForPhase(p.label)}"></span>
          <span style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(p.label)}</span>
          <span class="help-text" style="margin:0; flex:0 0 auto;">× ${p.count}</span>
        </div>
        <div style="display:flex; gap:6px; flex:0 0 auto;">
          <button type="button" class="mini-btn cal-inc-btn" data-id="${p.id}" title="Aggiungi un'altra volta">+</button>
          <button type="button" class="mini-btn cal-del-practice-btn" data-id="${p.id}" title="Rimuovi">🗑</button>
        </div>
      </div>
    </div>`).join('');

  wrap.querySelectorAll('.cal-inc-btn').forEach((b) => b.addEventListener('click', () => incrementPractice(key, b.dataset.id)));
  wrap.querySelectorAll('.cal-del-practice-btn').forEach((b) => b.addEventListener('click', () => removePractice(key, b.dataset.id)));
}

function togglePracticePicker() {
  const wrap = document.getElementById('calPracticePicker');
  if (!wrap) return;
  const key = ui.calendarSelectedDate;
  if (wrap.dataset.open === '1') {
    wrap.innerHTML = '';
    wrap.dataset.open = '0';
    return;
  }
  wrap.dataset.open = '1';
  wrap.innerHTML = `<div class="phase-pill-row" style="margin-top:10px;">${state.pages.map((p) => `
    <button type="button" class="phase-pill" data-page-id="${p.id}" style="--pill-color:${colorForPhase(p.name)}">
      <span class="dot"></span><span class="p-name">${escapeHtml(p.name)}</span>
    </button>`).join('')}</div>`;
  wrap.querySelectorAll('[data-page-id]').forEach((btn) => btn.addEventListener('click', () => {
    const page = getPage(btn.dataset.pageId);
    if (page) addPracticeToDay(key, page);
  }));
}

function renderCalNoteList(key, data) {
  const wrap = document.getElementById('calNoteList');
  if (!wrap) return;
  if (!data.notes.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = data.notes.map((n) => `
    <div class="sound-row" data-id="${n.id}">
      <span style="flex:1; font-size:14px;">${escapeHtml(n.text)}</span>
      <button type="button" class="mini-btn cal-del-note-btn" data-id="${n.id}" title="Rimuovi">🗑</button>
    </div>`).join('');
  wrap.querySelectorAll('.cal-del-note-btn').forEach((b) => b.addEventListener('click', () => removeNote(key, b.dataset.id)));
}

function renderCalNoteForm(key) {
  const wrap = document.getElementById('calNoteForm');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="field" style="margin-top:6px;">
      <label>Aggiungi una nota libera</label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="calNoteInput" placeholder="Es. Camminata consapevole 10 minuti" style="flex:1;" />
        <button type="button" class="btn btn-primary btn-sm" id="calNoteSaveBtn">Aggiungi</button>
      </div>
    </div>`;
  const save = () => {
    const input = document.getElementById('calNoteInput');
    const text = input.value.trim();
    if (!text) return;
    addNoteToDay(key, text);
  };
  document.getElementById('calNoteSaveBtn').addEventListener('click', save);
  document.getElementById('calNoteInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}

/* ---------------- musica: azioni ---------------- */

function addMusicTrack(title, url) {
  const parsed = parseMusicUrl(url);
  if (!parsed) { showToast('Link non riconosciuto: incolla un link YouTube o Spotify'); return false; }
  state.music.tracks.push({ id: uid('track'), title: (title || '').trim() || 'Brano senza titolo', type: parsed.type, embedUrl: parsed.embedUrl, sourceUrl: parsed.sourceUrl });
  saveState();
  return true;
}

function removeMusicTrack(id) {
  state.music.tracks = state.music.tracks.filter((t) => t.id !== id);
  if (ui.musicExpandedId === id) {
    ui.musicExpandedId = null;
    renderMusicDock();
  }
  saveState();
  renderMusicList();
}

/* ---------------- rendering: mini player persistente ----------------
   Vive fuori da #mainView, quindi non viene distrutto quando cambi
   schermata: la musica continua a suonare mentre navighi nell'app. */

function renderMusicDock() {
  const dock = document.getElementById('musicDock');
  const app = document.getElementById('app');
  if (!dock) return;
  const track = ui.musicExpandedId ? state.music.tracks.find((t) => t.id === ui.musicExpandedId) : null;
  if (!track) {
    dock.hidden = true;
    dock.innerHTML = '';
    if (app) app.classList.remove('has-music-dock');
    return;
  }
  const icon = track.type === 'youtube' ? '▶️' : '🎧';
  const playerHtml = track.type === 'youtube'
    ? `<div class="music-dock-player youtube"><iframe src="${track.embedUrl}" title="${escapeHtml(track.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    : `<div class="music-dock-player spotify"><iframe src="${track.embedUrl}" title="${escapeHtml(track.title)}" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe></div>`;

  dock.hidden = false;
  dock.innerHTML = `
    <div class="music-dock-row">
      <span class="sound-swatch" style="width:28px;height:28px;font-size:13px;">${icon}</span>
      <span class="music-dock-title">${escapeHtml(track.title)}</span>
      <button type="button" class="mini-btn" id="musicDockCloseBtn" title="Ferma">✕</button>
    </div>
    ${playerHtml}`;
  document.getElementById('musicDockCloseBtn').addEventListener('click', () => {
    ui.musicExpandedId = null;
    renderMusicDock();
    if (ui.view === 'music') renderMusicList();
  });
  if (app) app.classList.add('has-music-dock');
}

/* ---------------- rendering: musica ---------------- */

function renderMusicView() {
  const main = document.getElementById('mainView');
  main.innerHTML = `
    <div class="card">
      <div class="section-title">
        <h2 class="serif">Musica per la meditazione</h2>
        <button class="icon-btn" id="closeMusicBtn" title="Chiudi">✕</button>
      </div>
      <p class="help-text">Alcuni brani di partenza (puoi rimuoverli), più i tuoi link YouTube o Spotify preferiti.</p>
      <div id="musicList" style="margin:16px 0;"></div>
      <hr class="divider" />
      <div class="field">
        <label>Titolo</label>
        <input type="text" id="musicTitleInput" placeholder="Es. Suoni della foresta" />
      </div>
      <div class="field">
        <label>Link YouTube o Spotify</label>
        <input type="text" id="musicUrlInput" placeholder="https://youtube.com/watch?v=... oppure https://open.spotify.com/playlist/..." />
      </div>
      <button type="button" class="btn btn-primary" id="musicAddBtn">+ Aggiungi brano</button>
    </div>`;

  renderMusicList();

  document.getElementById('closeMusicBtn').addEventListener('click', () => { ui.view = 'timer'; renderAll(); });
  document.getElementById('musicAddBtn').addEventListener('click', () => {
    const titleInput = document.getElementById('musicTitleInput');
    const urlInput = document.getElementById('musicUrlInput');
    if (!urlInput.value.trim()) { showToast('Incolla un link YouTube o Spotify'); return; }
    if (addMusicTrack(titleInput.value, urlInput.value)) {
      renderMusicList();
      titleInput.value = '';
      urlInput.value = '';
      showToast('Brano aggiunto ✓');
    }
  });
}

function renderMusicList() {
  const wrap = document.getElementById('musicList');
  if (!wrap) return;
  if (!state.music.tracks.length) {
    wrap.innerHTML = '<div class="empty-state">Nessun brano ancora: aggiungine uno qui sotto.</div>';
    return;
  }
  wrap.innerHTML = state.music.tracks.map((t) => {
    const isPlaying = ui.musicExpandedId === t.id;
    const icon = t.type === 'youtube' ? '▶️' : '🎧';
    return `
      <div class="phase-editor-item${isPlaying ? ' playing' : ''}" style="margin-bottom:10px;">
        <div class="phase-editor-row" style="justify-content:space-between; flex-wrap:nowrap;">
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            <span class="sound-swatch" style="width:30px;height:30px;font-size:14px;">${icon}</span>
            <span style="font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(t.title)}</span>
          </div>
          <div style="display:flex; gap:6px; flex:0 0 auto;">
            <button type="button" class="mini-btn music-toggle-btn" data-id="${t.id}" title="${isPlaying ? 'In riproduzione' : 'Riproduci'}">${isPlaying ? '⏸' : '▶'}</button>
            <button type="button" class="mini-btn music-del-btn" data-id="${t.id}" title="Rimuovi">🗑</button>
          </div>
        </div>
        ${isPlaying ? '<p class="help-text" style="margin:8px 0 0;">In riproduzione nel mini player: continua anche cambiando schermata.</p>' : ''}
      </div>`;
  }).join('');

  wrap.querySelectorAll('.music-toggle-btn').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.id;
    ui.musicExpandedId = ui.musicExpandedId === id ? null : id;
    renderMusicList();
    renderMusicDock();
  }));
  wrap.querySelectorAll('.music-del-btn').forEach((b) => b.addEventListener('click', () => removeMusicTrack(b.dataset.id)));
}

/* ---------------- render dispatcher ---------------- */

function renderMain() {
  if (ui.view === 'edit') renderEditView();
  else if (ui.view === 'settings') renderSettingsView();
  else if (ui.view === 'calendar') renderCalendarView();
  else if (ui.view === 'music') renderMusicView();
  else renderTimerView();
}

function renderAll() {
  renderTabs();
  renderMain();
}

/* ---------------- avvio ---------------- */

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline non disponibile, non blocca l'app */ });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('settingsBtn').addEventListener('click', () => { ui.view = 'settings'; renderAll(); });
  document.getElementById('calendarBtn').addEventListener('click', () => { ui.view = 'calendar'; renderAll(); });
  document.getElementById('musicBtn').addEventListener('click', () => { ui.view = 'music'; renderAll(); });
  renderAll();
  renderMusicDock();
  registerServiceWorker();
});

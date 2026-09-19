'use strict';

const API_BASE = 'https://3rah.ir/mm/api';
const API_TOKEN = 'change_me_to_a_secure_token';

const IS_LOW_END = document.documentElement.classList.contains('low-end');

const KEY = {
  likes: 'mm_likes',
  pls: 'mm_playlists',
  recent: 'mm_recent',
  downloads: 'mm_downloads',
  plays: 'mm_recently_played',
  following: 'mm_followed',
  settings: 'mm_settings'
};

const SETTINGS_DEFAULT = {
  theme: 'dark',
  accent: 'purple',
  animations: true,
  playbackRate: 1,
  eqPreset: 'flat',
  autoScrollLyrics: true,
  autoRetry: true,
};

const POLL_MS = IS_LOW_END ? 3500 : 2500;
const QUEUE_GRACE_MS = 3000;
const DEFAULT_CRAWL_QUALITY = '320';
const PROGRESS_TICK_MS = IS_LOW_END ? 300 : 100;
const LYRIC_TICK_MS = IS_LOW_END ? 250 : 150;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const MAIN = () => document.getElementById('main');

const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  remove(k) { try { localStorage.removeItem(k); } catch { } }
};

const cleanId = id => id ? String(id).replace(/^it_/, '') : '';
const proxyUrl = u => u ? `${API_BASE}/proxy?url=${encodeURIComponent(u)}` : '';

/* Web/Capacitor Haptics */
const haptic = ms => {
  try {
    if (window.Capacitor?.Plugins?.Haptics) {
      window.Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' });
    } else {
      navigator.vibrate?.(ms);
    }
  } catch { }
};

function fmtTime(sec) {
  sec = Number(sec);
  if (!sec || !isFinite(sec) || sec < 0) return '0:00';
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function fmtSize(b) {
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function safeFileName(s) {
  const out = String(s || 'track')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  return out || 'track';
}

function extFromType(type, url) {
  const t = String(type || '').toLowerCase();
  if (t.includes('mpeg') || t.includes('mp3')) return '.mp3';
  if (t.includes('mp4') || t.includes('m4a')) return '.m4a';
  if (t.includes('aac')) return '.aac';
  if (t.includes('ogg') || t.includes('opus')) return '.ogg';
  if (t.includes('webm')) return '.webm';
  if (t.includes('wav')) return '.wav';
  if (t.includes('flac')) return '.flac';
  const m = String(url || '').split('?')[0].match(/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i);
  return m ? '.' + m[1].toLowerCase() : '.mp3';
}

function fmtAgo(ts) {
  const d = Date.now() - (Number(ts) || 0);
  if (d < 60_000) return 'just now';
  if (d < 3_600_000) return Math.floor(d / 60_000) + 'm ago';
  if (d < 86_400_000) return Math.floor(d / 3_600_000) + 'h ago';
  if (d < 604_800_000) return Math.floor(d / 86_400_000) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS & EQUALIZER
   ══════════════════════════════════════════════════════════════ */
function getSettings() { return { ...SETTINGS_DEFAULT, ...ls.get(KEY.settings, {}) }; }
function setSetting(k, v) { const s = getSettings(); s[k] = v; ls.set(KEY.settings, s); applySettings(); }

let audioCtx = null;
let eqFilterLow = null;
let eqFilterMid = null;
let eqFilterHigh = null;

function setupAudioContext() {
  if (audioCtx) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(audio);

    eqFilterLow = audioCtx.createBiquadFilter();
    eqFilterLow.type = 'lowshelf';
    eqFilterLow.frequency.value = 250;

    eqFilterMid = audioCtx.createBiquadFilter();
    eqFilterMid.type = 'peaking';
    eqFilterMid.frequency.value = 1000;
    eqFilterMid.Q.value = 1.0;

    eqFilterHigh = audioCtx.createBiquadFilter();
    eqFilterHigh.type = 'highshelf';
    eqFilterHigh.frequency.value = 4000;

    source.connect(eqFilterLow);
    eqFilterLow.connect(eqFilterMid);
    eqFilterMid.connect(eqFilterHigh);
    eqFilterHigh.connect(audioCtx.destination);
  } catch (e) {
    console.warn('[MusicMan EQ Init Error]', e);
  }
}

function applyEqualizer(preset) {
  if (!audioCtx) setupAudioContext();
  if (!eqFilterLow || !eqFilterMid || !eqFilterHigh) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  const presets = {
    flat:   { low: 0, mid: 0, high: 0 },
    bass:   { low: 8, mid: -1, high: -3 },
    vocal:  { low: -3, mid: 6, high: 2 },
    treble: { low: -4, mid: 1, high: 8 },
    pop:    { low: 4, mid: 2, high: 5 },
    rock:   { low: 6, mid: -2, high: 6 }
  };
  const p = presets[preset] || presets.flat;
  eqFilterLow.gain.setValueAtTime(p.low, audioCtx.currentTime);
  eqFilterMid.gain.setValueAtTime(p.mid, audioCtx.currentTime);
  eqFilterHigh.gain.setValueAtTime(p.high, audioCtx.currentTime);
}

function applySettings() {
  const s = getSettings();
  document.documentElement.setAttribute('data-bs-theme', s.theme);
  document.documentElement.setAttribute('data-accent', s.accent || 'purple');
  document.body.classList.toggle('no-animations', !s.animations);
  audio.playbackRate = Number(s.playbackRate) || 1;
  applyEqualizer(s.eqPreset || 'flat');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = s.theme === 'dark' ? '#0b0b0d' : '#ffffff';
}

/* ══════════════════════════════════════════════════════════════
   TOAST / SHEETS
   ══════════════════════════════════════════════════════════════ */
let _toast;
function toast(msg, variant = 'dark') {
  const el = $('#toast'); if (!el) return;
  el.className = `toast text-bg-${variant} border-0`;
  $('#toastMsg').textContent = msg;
  _toast = _toast || new bootstrap.Toast(el);
  _toast.show();
}
function sheet(id) { return bootstrap.Offcanvas.getOrCreateInstance($(id)); }
function closeAllSheets() {
  ['#sheetTrack', '#sheetPl', '#sheetPrompt', '#sheetConfirm', '#sheetSleep', '#sheetSettings', '#sheetQuality']
    .forEach(s => {
      const el = $(s); if (!el) return;
      const i = bootstrap.Offcanvas.getInstance(el); if (i) i.hide();
    });
}
let _promptResolve = null;
function askText(title, value = '', placeholder = 'Name') {
  return new Promise(resolve => {
    _promptResolve = resolve;
    $('#promptTitle').textContent = title;
    const inp = $('#promptInput');
    inp.value = value; inp.placeholder = placeholder;
    sheet('#sheetPrompt').show();
    setTimeout(() => inp.focus(), 350);
  });
}
function submitPrompt() {
  const v = $('#promptInput').value.trim();
  sheet('#sheetPrompt').hide();
  if (_promptResolve) { _promptResolve(v || null); _promptResolve = null; }
}
$('#sheetPrompt')?.addEventListener('hidden.bs.offcanvas', () => {
  if (_promptResolve) { _promptResolve(null); _promptResolve = null; }
});
$('#promptInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitPrompt(); });

let _confirmResolve = null;
function askConfirm(title, body, okLabel = 'Delete', tone = 'danger') {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    $('#cfTitle').textContent = title;
    $('#cfBody').textContent = body;
    const ok = $('#cfOkBtn');
    ok.textContent = okLabel;
    ok.style.background = tone === 'primary' ? 'var(--bs-primary)' : 'var(--bs-danger)';
    ok.style.color = '#fff';
    sheet('#sheetConfirm').show();
  });
}
$('#cfOkBtn')?.addEventListener('click', () => {
  sheet('#sheetConfirm').hide();
  if (_confirmResolve) { _confirmResolve(true); _confirmResolve = null; }
});
$('#sheetConfirm')?.addEventListener('hidden.bs.offcanvas', () => {
  if (_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
});

/* ══════════════════════════════════════════════════════════════
   API
   ══════════════════════════════════════════════════════════════ */
async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_TOKEN,
        ...(opts.headers || {})
      }
    });
  } catch { throw new Error('Network error'); }
  const text = await res.text().catch(() => '');
  let data = {};
  if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data;
}
const apiSearch = async term => (await api(`/search?term=${encodeURIComponent(term)}&limit=50&entity=musicArtist,album,song`)).results || [];
const apiFresh = async () => (await api('/fresh')).results || [];
const apiPopular = async (limit = 40) => (await api(`/popular?limit=${limit}&minViews=1`)).results || [];
const apiLookup = async (id, entity) => (await api(`/lookup?id=${cleanId(id)}&entity=${entity}&limit=200`)).results || [];
const apiArtistTracks = async (id, { page = 1, limit = 50, sort = 'album' } = {}) =>
  api(`/artist/tracks?id=${encodeURIComponent(cleanId(id))}&page=${page}&limit=${limit}&sort=${encodeURIComponent(sort)}`);
const apiQueueAdd = (body, quality) => api('/download/add', {
  method: 'POST',
  body: JSON.stringify({ quality: quality || DEFAULT_CRAWL_QUALITY, skipExisting: true, ...body })
});

async function apiCrawlStatus(trackId) {
  let r;
  try { r = await api(`/download/status?trackId=${cleanId(trackId)}`); }
  catch { return { download_status: 'completed', percent: 100, found: false }; }
  if (!r || !r.download) {
    return { download_status: 'completed', percent: 100, found: false };
  }
  return { ...r.download, found: true };
}

/* ══════════════════════════════════════════════════════════════
   SEARCH SUGGEST
   ══════════════════════════════════════════════════════════════ */
const _sgCache = new Map();
const SG_CACHE_MAX = 60;

function _sgHighlight(name, q) {
  if (!q) return esc(name);
  const lower = String(name).toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx < 0) return esc(name);
  return esc(name.slice(0, idx))
    + '<b>' + esc(name.slice(idx, idx + needle.length)) + '</b>'
    + esc(name.slice(idx + needle.length));
}

function initSuggest(input, dropdown) {
  if (!input || !dropdown || input.__sgInit) return;
  input.__sgInit = true;

  let items = [];
  let activeIdx = -1;
  let lastQ = '';
  let debTimer = null;
  let ctrl = null;

  const close = () => {
    dropdown.classList.remove('show');
    dropdown.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    items = []; activeIdx = -1;
  };

  const render = () => {
    if (!items.length) { close(); return; }
    dropdown.innerHTML = items.map((it, i) => {
      const icon = it.type === 'artist' ? 'bi-person'
        : it.type === 'collection' ? 'bi-disc'
          : 'bi-music-note';
      const label = it.type === 'artist' ? 'Artist'
        : it.type === 'collection' ? 'Album'
          : 'Song';
      return `<button type="button" role="option" class="sg-item${i === activeIdx ? ' active' : ''}" data-idx="${i}">
        <i class="bi ${icon} sg-icon"></i>
        <span class="sg-title flex-grow-1 min-w-0">${_sgHighlight(it.name, lastQ)}</span>
        <span class="sg-badge">${label}</span>
      </button>`;
    }).join('');
    dropdown.classList.add('show');
    input.setAttribute('aria-expanded', 'true');
    if (activeIdx >= 0) {
      const el = dropdown.querySelector('.sg-item.active');
      if (el?.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
  };

  const pick = (idx) => {
    const it = items[idx];
    if (!it) return;
    close();
    input.blur();
    const list = ls.get(KEY.recent, []).filter(x => x !== it.name);
    list.unshift(it.name);
    ls.set(KEY.recent, list.slice(0, 10));
    go(`/${it.type}/${it.id}`);
  };

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q === lastQ) return;
    lastQ = q;
    if (debTimer) clearTimeout(debTimer);
    if (q.length < 1) { close(); return; }

    const cached = _sgCache.get(q.toLowerCase());
    if (cached) { items = cached; activeIdx = -1; render(); return; }

    if (!dropdown.classList.contains('show')) {
      dropdown.innerHTML = `<div class="sg-loading"><span class="spinner-border spinner-border-sm" style="width:12px;height:12px;border-width:2px"></span> Searching…</div>`;
      dropdown.classList.add('show');
      input.setAttribute('aria-expanded', 'true');
    }

    debTimer = setTimeout(async () => {
      if (ctrl) ctrl.abort();
      ctrl = new AbortController();
      try {
        const r = await fetch(
          `${API_BASE}/suggest?q=${encodeURIComponent(q)}&limit=8`,
          { headers: { 'Authorization': 'Bearer ' + API_TOKEN }, signal: ctrl.signal }
        );
        if (input.value.trim() !== q) return;
        const data = await r.json();
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        if (_sgCache.size >= SG_CACHE_MAX) {
          const first = _sgCache.keys().next().value;
          _sgCache.delete(first);
        }
        _sgCache.set(q.toLowerCase(), suggestions);
        items = suggestions;
        activeIdx = -1;
        if (!items.length) {
          dropdown.innerHTML = `<div class="sg-empty"><i class="bi bi-search"></i> No matches</div>`;
          dropdown.classList.add('show');
          input.setAttribute('aria-expanded', 'true');
        } else render();
      } catch (e) {
        if (e.name !== 'AbortError') close();
      }
    }, 160);
  });

  input.addEventListener('keydown', e => {
    if (!dropdown.classList.contains('show')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, -1);
      render();
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault();
        e.stopPropagation();
        pick(activeIdx);
      }
    } else if (e.key === 'Escape') {
      close();
      input.blur();
    }
  });

  dropdown.addEventListener('pointerdown', e => {
    const btn = e.target.closest('.sg-item');
    if (btn) e.preventDefault();
  });
  dropdown.addEventListener('click', e => {
    const btn = e.target.closest('.sg-item');
    if (!btn) return;
    e.preventDefault();
    pick(Number(btn.dataset.idx));
  });

  input.addEventListener('blur', () => setTimeout(close, 140));
  input.addEventListener('focus', () => {
    if (items.length && input.value.trim() === lastQ) render();
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) close();
  });
}

/* ══════════════════════════════════════════════════════════════
   ITEM MODEL
   ══════════════════════════════════════════════════════════════ */
const TYPE_MAP = {
  musicArtist: 'artist', artist: 'artist',
  album: 'collection', collection: 'collection',
  song: 'track', track: 'track'
};
const itemType = it => TYPE_MAP[it?.wrapperType] || it?.wrapperType || '';
const itemId = it => it?.trackId || it?.collectionId || it?.artistId || '';

function getArtwork(it, size = 300) {
  const urls = it?.attachments?.artworkUrls;
  if (!Array.isArray(urls) || !urls.length) return it?.artworkUrl || '';
  const best = urls.find(u => String(u.size || '').includes(String(size))) || urls[urls.length - 1];
  const url = best?.url || '';
  return url.replace(/\/(\d+)x(\d+)(bb)?\./, `/${size}x${size}bb.`);
}
function hasAudio(it) {
  const a = it?.attachments?.audioUrls;
  return Array.isArray(a) && a.some(x => x && x.url);
}
function hasPreview(it) {
  const p = it?.attachments?.previewUrls;
  return Array.isArray(p) && p.some(x => x && x.url);
}
function getPreviewUrl(it) {
  const p = it?.attachments?.previewUrls;
  if (!Array.isArray(p) || !p.length) return null;
  for (const x of p) if (x && x.url) return x.url;
  return null;
}
function getAudioOptions(it) {
  const a = it?.attachments?.audioUrls;
  if (!Array.isArray(a)) return [];
  return a.filter(x => x && x.url && x.quality);
}
function pickAudioByQuality(it, preferQuality) {
  const options = getAudioOptions(it);
  if (!options.length) {
    const a = it?.attachments?.audioUrls;
    if (Array.isArray(a) && a.length && a[0]?.url) return a[0].url;
    return getPreviewUrl(it);
  }
  const target = parseInt(preferQuality, 10) || 192;
  const exact = options.find(o => String(o.quality) === String(preferQuality));
  if (exact) return exact.url;
  let closest = options[0], bestDiff = Infinity;
  for (const o of options) {
    const q = parseInt(o.quality, 10);
    if (!isFinite(q)) continue;
    const diff = Math.abs(q - target);
    if (diff < bestDiff) { bestDiff = diff; closest = o; }
  }
  return closest?.url || null;
}
const getPlayable = it => pickAudioByQuality(it, DEFAULT_CRAWL_QUALITY);

function dlActionFor(track) {
  const isDirect = hasAudio(track);
  return {
    isDirect,
    label: isDirect ? 'Download' : 'Crawl',
    icon: isDirect ? 'bi-download' : 'bi-cloud-arrow-down',
    title: isDirect ? 'Download' : 'Crawl',
    retryLabel: isDirect ? 'Retry download' : 'Retry crawl',
    idleTitle: isDirect ? 'Not downloaded' : 'Not crawled',
    idleSub: isDirect
      ? 'Full audio available — download for offline'
      : (hasPreview(track) ? 'Crawl to listen offline · preview available now'
        : 'Crawl to listen offline'),
  };
}

const itemCache = new Map();
function cacheItems(items) {
  for (const it of items || []) {
    const t = itemType(it), id = itemId(it);
    if (t && id) itemCache.set(`${t}:${id}`, it);
  }
}
const getCached = (t, id) => itemCache.get(`${t}:${id}`);

/* ══════════════════════════════════════════════════════════════
   INDEXEDDB
   ══════════════════════════════════════════════════════════════ */
let _dbPromise;
function getDB() {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('mm_audio', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'trackId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return _dbPromise;
}
async function idb(store, mode, fn) {
  const db = await getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req?.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}
const cachePut = (id, blob, meta) => idb('audio', 'readwrite', s => s.put({ trackId: String(id), blob, meta, size: blob.size, at: Date.now() }));
const cacheGet = id => idb('audio', 'readonly', s => s.get(String(id))).then(r => r || null);
const cacheAll = () => idb('audio', 'readonly', s => s.getAll()).then(r => r || []);
const cacheDel = id => idb('audio', 'readwrite', s => s.delete(String(id)));
const cacheClear = () => idb('audio', 'readwrite', s => s.clear());

const cachedIds = new Set();
async function refreshCacheIndex() {
  cachedIds.clear();
  (await cacheAll()).forEach(e => cachedIds.add(String(e.trackId)));
}
const isCached = id => cachedIds.has(String(id));

/* ══════════════════════════════════════════════════════════════
   DOWNLOAD MANAGER
   ══════════════════════════════════════════════════════════════ */
const DL = {
  items: [], listeners: new Set(), timer: null, saving: new Set(),
  load() {
    const raw = ls.get(KEY.downloads, []);
    this.items = raw.map(it => it.status === 'saving'
      ? { ...it, status: 'paused', percent: 0, error: 'Interrupted' }
      : it);
    this.persist();
  },
  persist() { ls.set(KEY.downloads, this.items); },
  all() { return this.items; },
  active() { return this.items.filter(i => ['queued', 'crawling', 'saving'].includes(i.status)); },
  ready() { return this.items.filter(i => i.status === 'ready'); },
  failed() { return this.items.filter(i => ['failed', 'paused'].includes(i.status)); },
  get(id) { return this.items.find(i => String(i.trackId) === String(id)); },
  notify() {
    this.persist();
    updateDownloadBadges();
    this.listeners.forEach(fn => { try { fn(this); } catch (e) { console.warn(e); } });
  },
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  upsert(entry) {
    const idx = this.items.findIndex(i => String(i.trackId) === String(entry.trackId));
    if (idx >= 0) {
      this.items[idx] = { ...this.items[idx], ...entry, updatedAt: Date.now() };
    } else {
      this.items.unshift({
        trackId: String(entry.trackId),
        name: entry.name || 'Track',
        artist: entry.artist || '',
        artistId: entry.artistId || '',
        album: entry.album || '',
        collectionId: entry.collectionId || '',
        artwork: entry.artwork || '',
        type: 'save',
        status: entry.status || 'queued',
        percent: entry.percent || 0,
        error: entry.error || '',
        bytes: 0, totalBytes: 0,
        addedAt: entry.addedAt || Date.now(),
        updatedAt: Date.now()
      });
    }
    this.notify();
  },
  update(id, patch) {
    const it = this.get(id); if (!it) return;
    Object.assign(it, patch, { updatedAt: Date.now() });
    this.notify();
  },
  remove(id) {
    this.items = this.items.filter(i => String(i.trackId) !== String(id));
    this.notify();
  },
  async add(track, _type, quality) {
    if (!track?.trackId) return;
    const id = String(track.trackId);
    if (isCached(id)) { toast('Already offline'); return; }
    const existing = this.get(id);
    if (existing && ['queued', 'crawling', 'saving'].includes(existing.status)) {
      toast('Already in progress', 'warning'); return;
    }
    this.upsert({
      trackId: id,
      name: track.trackName || 'Track',
      artist: track.artistName || '',
      artistId: track.artistId ? String(track.artistId) : '',
      album: track.collectionName || '',
      collectionId: track.collectionId ? String(track.collectionId) : '',
      artwork: getArtwork(track, 100),
      status: 'queued', percent: 0, error: ''
    });
    haptic(12);
    if (hasAudio(track)) {
      this.update(id, { status: 'saving', percent: 0 });
      this._runSave(id, track).catch(e => this.update(id, { status: 'failed', error: e.message }));
      return;
    }
    try {
      await apiQueueAdd({ trackId: cleanId(id) }, quality);
    } catch (e) {
      console.warn('[MusicMan] queue add error (ignored):', e.message);
    }
    this.update(id, { status: 'queued', percent: 0, addedAt: Date.now() });
    this._ensureTimer();
  },
  async retry(id) {
    const it = this.get(id); if (!it) return;
    const track = getCached('track', id) || (await this._fetchTrack(id));
    if (!track) { toast('Track unavailable', 'danger'); return; }
    this.update(id, { status: 'queued', error: '', percent: 0, addedAt: Date.now() });
    if (hasAudio(track)) {
      this.update(id, { status: 'saving' });
      this._runSave(id, track).catch(e => this.update(id, { status: 'failed', error: e.message }));
      return;
    }
    try {
      await apiQueueAdd({ trackId: cleanId(id) });
    } catch (e) {
      console.warn('[MusicMan] queue retry error (ignored):', e.message);
    }
    this.update(id, { status: 'queued' });
    this._ensureTimer();
  },
  async _fetchTrack(id) {
    try {
      const r = await apiLookup(id, 'song');
      const it = r.find(x => itemType(x) === 'track') || r[0];
      if (it) cacheItems([it]);
      return it;
    } catch { return null; }
  },
  async _runSave(id, track) {
    if (this.saving.has(id)) return;
    this.saving.add(id);
    const url = getPlayable(track);
    if (!url) { this.saving.delete(id); throw new Error('No audio URL'); }
    try {
      const res = await fetch(proxyUrl(url));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      const mime = (res.headers.get('content-type') || '').split(';')[0] || 'audio/mpeg';
      const reader = res.body?.getReader?.();
      let blob;
      if (reader) {
        const chunks = []; let received = 0; let lastReport = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value); received += value.length;
          const pct = total ? Math.min(99, Math.round((received / total) * 100)) : 0;
          const now = performance.now();
          if (now - lastReport > 250 || received === total) {
            lastReport = now;
            this.update(id, { percent: pct, bytes: received, totalBytes: total });
          }
        }
        blob = new Blob(chunks);
      } else {
        blob = await res.blob();
      }
      await cachePut(id, blob, {
        name: track.trackName, artist: track.artistName, artistId: track.artistId,
        album: track.collectionName, collectionId: track.collectionId,
        artwork: getArtwork(track, 100), mime, url
      });
      cachedIds.add(String(id));
      this.update(id, {
        status: 'completed', percent: 100,
        bytes: blob.size, totalBytes: blob.size,
        completedAt: Date.now()
      });
      haptic(18);
      toast(`Downloaded · ${fmtSize(blob.size)}`);
      if (isLibraryDlRoute()) renderDownloads();
      if (isTrackRoute()) { const t = getCached('track', id); if (t) renderCrawlCard(t, null); }
      setTimeout(() => { if (this.get(id)?.status === 'completed') this.remove(id); }, 3500);
    } finally { this.saving.delete(id); }
  },
  async _markCompleted(id) {
    const fresh = await this._fetchTrack(id);
    if (!fresh || !hasAudio(fresh)) {
      this.update(id, { status: 'crawling', percent: 100 });
      return;
    }
    this.update(id, { status: 'saving', percent: 0 });
    this._runSave(id, fresh).catch(e => this.update(id, { status: 'failed', error: e.message }));
  },
  _ensureTimer() {
    if (this.timer) return;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const crawls = this.items.filter(i => ['queued', 'crawling'].includes(i.status));
        if (!crawls.length) { clearInterval(this.timer); this.timer = null; return; }
        for (const item of crawls) {
          const id = String(item.trackId);
          const status = await apiCrawlStatus(id);
          const notFound = status.found === false;
          if (notFound && (Date.now() - (item.addedAt || 0)) < QUEUE_GRACE_MS) continue;
          const s = status.download_status;
          const pct = Math.max(0, Math.min(100, Math.round(Number(status.percent) || 0)));
          if (notFound || s === 'completed') {
            await this._markCompleted(id);
          } else if (s === 'failed' || s === 'stopped') {
            if (getSettings().autoRetry && (item.retries || 0) < 3) {
              setTimeout(() => DL.retry(id).catch(() => { }), 3000);
              this.update(id, { status: 'failed', error: (status.error || 'Failed') + ' — retrying…', retries: (item.retries || 0) + 1 });
            } else {
              this.update(id, { status: 'failed', error: status.error || 'Failed' });
            }
          } else {
            this.update(id, { status: 'crawling', percent: pct });
          }
        }
      } finally { running = false; }
    };
    tick();
    this.timer = setInterval(tick, POLL_MS);
  }
};
function resumeDownloadPolling() {
  if (DL.items.some(i => ['queued', 'crawling'].includes(i.status))) DL._ensureTimer();
}
function updateDownloadBadges() {
  const total = DL.active().length + DL.ready().length;
  const ind = $('#dlIndicator'), indCount = $('#dlIndicatorCount');
  if (ind && indCount) { ind.style.display = total ? '' : 'none'; indCount.textContent = total; }
  const badge = $('#libBadge');
  if (badge) { badge.classList.toggle('on', total > 0); badge.textContent = total; }
}

/* ══════════════════════════════════════════════════════════════
   EXPORT OFFLINE AS FILE
   ══════════════════════════════════════════════════════════════ */
async function exportCached(id) {
  let e; try { e = await cacheGet(id); } catch { e = null; }
  if (!e?.blob) { toast('File not available', 'danger'); return; }
  const m = e.meta || {};
  const base = safeFileName([m.artist, m.name].filter(Boolean).join(' - ') || m.name || id);
  const mime = m.mime || 'audio/mpeg';
  const ext = extFromType(mime, m.url || '');
  const blob = new Blob([e.blob], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url; a.download = base + ext; a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    haptic(14);
    toast(`Saved "${base + ext}"`);
  } catch {
    try { window.open(url, '_blank'); } catch { }
    toast('Opened file in a new tab');
  }
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch { } }, 180000);
}
async function exportAllCached() {
  const all = await cacheAll();
  if (!all.length) { toast('Nothing to export', 'warning'); return; }
  const ok = await askConfirm(
    'Export all tracks?',
    `${all.length} file${all.length !== 1 ? 's' : ''} will be saved to your device.`,
    'Export', 'primary'
  );
  if (!ok) return;
  for (let i = 0; i < all.length; i++) {
    await exportCached(all[i].trackId);
    await new Promise(r => setTimeout(r, 650));
  }
  toast('Export finished', 'success');
}

/* ══════════════════════════════════════════════════════════════
   LIKES / FOLLOWING / PLAYLISTS / RECENT
   ══════════════════════════════════════════════════════════════ */
const getLikes = () => ls.get(KEY.likes, []);
const isLiked = id => getLikes().some(t => String(t.trackId) === String(id));
function makeLikeEntry(item) {
  return {
    trackId: String(item.trackId),
    trackName: item.trackName || 'Unknown',
    artistName: item.artistName || '',
    artistId: item.artistId ? String(item.artistId) : '',
    collectionName: item.collectionName || '',
    collectionId: item.collectionId ? String(item.collectionId) : '',
    artworkUrl: getArtwork(item, 100) || item.artworkUrl || '',
    addedAt: Date.now()
  };
}
function toggleLike(item) {
  if (!item?.trackId) return;
  const id = String(item.trackId);
  const likes = getLikes();
  const idx = likes.findIndex(t => String(t.trackId) === id);
  if (idx >= 0) { likes.splice(idx, 1); toast('Removed from Liked'); }
  else { likes.unshift(makeLikeEntry(item)); toast('Added to Liked'); }
  ls.set(KEY.likes, likes);
  haptic(8);
  refreshLikes();
  if (isLibraryLikesRoute()) viewLikes();
}
async function toggleLikeById(id) {
  let it = getCached('track', id);
  if (!it) {
    try {
      const r = await apiLookup(id, 'song');
      it = r.find(x => itemType(x) === 'track') || r[0];
      if (it) cacheItems([it]);
    } catch { }
  }
  if (it) toggleLike(it); else toast('Track not available', 'danger');
}
function refreshLikes() {
  const cur = Player.track ? String(Player.track.trackId) : null;
  const nodes = MAIN().querySelectorAll('[data-like]');
  for (let i = 0; i < nodes.length; i++) {
    const btn = nodes[i];
    const id = btn.dataset.like; if (!id) continue;
    const on = isLiked(id);
    if (on !== btn.classList.contains('liked')) {
      btn.classList.toggle('liked', on);
      const ic = btn.firstElementChild;
      if (ic) ic.className = `bi ${on ? 'bi-heart-fill' : 'bi-heart'}`;
    }
  }
  const fpBtn = $('#fpLikeBtn');
  if (fpBtn) {
    const on = cur ? isLiked(cur) : false;
    fpBtn.classList.toggle('liked', on);
    const i = $('#fpLike');
    if (i) i.className = `bi ${on ? 'bi-heart-fill' : 'bi-heart'}`;
  }
}

const getFollowed = () => ls.get(KEY.following, []);
const isFollowed = id => !!id && getFollowed().some(a => String(a.artistId) === String(id));
function toggleFollow(artistId, artwork) {
  const id = String(artistId);
  if (!id) return;
  const list = getFollowed();
  const idx = list.findIndex(a => String(a.artistId) === id);
  if (idx >= 0) { list.splice(idx, 1); toast('Unfollowed'); }
  else {
    const cached = getCached('artist', id);
    list.unshift({
      artistId: id,
      artistName: cached?.artistName || '',
      primaryGenreName: cached?.primaryGenreName || '',
      artwork: artwork || '',
      followedAt: Date.now()
    });
    toast('Following');
    haptic(10);
  }
  ls.set(KEY.following, list);
  refreshFollowButtons();
  if (isLibraryFollowingRoute()) viewFollowing();
}
function refreshFollowButtons() {
  $$('[data-follow]').forEach(btn => {
    const id = btn.dataset.follow;
    const on = isFollowed(id);
    btn.classList.toggle('following', on);
    btn.classList.toggle('primary', !on);
    const i = btn.querySelector('i');
    if (i) i.className = `bi ${on ? 'bi-check-lg' : 'bi-plus-lg'}`;
    const span = btn.querySelector('span');
    if (span) span.textContent = on ? 'Following' : 'Follow';
  });
}

const getPlaylists = () => ls.get(KEY.pls, []);
const savePlaylists = p => ls.set(KEY.pls, p);
function createPlaylist(name) {
  name = (name || '').trim(); if (!name) return null;
  const pl = {
    id: 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, tracks: [], createdAt: Date.now()
  };
  const all = getPlaylists(); all.push(pl); savePlaylists(all);
  toast(`Created "${name}"`);
  return pl;
}
function removeFromPlaylist(plId, trackId) {
  const all = getPlaylists();
  const pl = all.find(p => p.id === plId); if (!pl) return;
  pl.tracks = pl.tracks.filter(t => String(t.trackId) !== String(trackId));
  savePlaylists(all);
  if (isPlaylistDetailRoute(plId)) renderPlaylistDetail(plId);
}

const getRecentlyPlayed = () => ls.get(KEY.plays, []);
function pushRecentlyPlayed(item) {
  if (!item?.trackId) return;
  const id = String(item.trackId);
  const list = getRecentlyPlayed().filter(x => String(x.trackId) !== id);
  list.unshift({
    trackId: id,
    trackName: item.trackName || 'Track',
    artistName: item.artistName || '',
    artistId: item.artistId ? String(item.artistId) : '',
    collectionName: item.collectionName || '',
    collectionId: item.collectionId ? String(item.collectionId) : '',
    artworkUrl: getArtwork(item, 100) || item.artworkUrl || '',
    at: Date.now()
  });
  ls.set(KEY.plays, list.slice(0, 30));
}

/* ══════════════════════════════════════════════════════════════
   ROUTER (Hash-based for native Capacitor compatibility)
   ══════════════════════════════════════════════════════════════ */
function currentPath() {
  let hash = location.hash || '#/';
  if (hash.startsWith('#')) hash = hash.slice(1);
  if (!hash.startsWith('/')) hash = '/' + hash;
  hash = hash.replace(/\/+$/, '');
  return hash || '/';
}

function parseRoute() {
  let path = currentPath().replace(/^\/+/, '');
  const parts = path ? path.split('/') : [];
  return { parts };
}

function go(path) {
  if (!path) path = '#/';
  if (!path.startsWith('#') && !path.startsWith('/')) path = '#/' + path;
  if (path.startsWith('/')) path = '#' + path;
  location.hash = path;
}

window.addEventListener('hashchange', () => route());

const isLibraryLikesRoute = () => currentPath() === '/library/likes';
const isLibraryFollowingRoute = () => currentPath() === '/library/following';
const isLibraryDlRoute = () => currentPath() === '/library/downloads';
const isLibraryPlRoute = () => currentPath() === '/library/playlists';
const isPlaylistDetailRoute = id => currentPath() === '/library/playlists/' + id;
const isTrackRoute = () => currentPath().startsWith('/track/');
const isAlbumRoute = () => currentPath().startsWith('/album/');
const isArtistRoute = () => currentPath().startsWith('/artist/');

function activeNavFor(parts) {
  const first = parts[0] || '';
  if (first === 'search') return 'search';
  if (first === 'library') return 'library';
  if (first === '') return 'home';
  return '';
}
const NAV_ICONS = {
  home: { on: 'bi-house-door-fill', off: 'bi-house-door' },
  search: { on: 'bi-search', off: 'bi-search' },
  library: { on: 'bi-collection-fill', off: 'bi-collection' }
};
function updateNav(parts) {
  const active = activeNavFor(parts);
  $$('[data-nav]').forEach(el => {
    const key = el.dataset.nav;
    const isOn = key === active;
    el.classList.toggle('active', isOn);
    const i = el.querySelector('i');
    if (i && NAV_ICONS[key]) i.className = `bi ${isOn ? NAV_ICONS[key].on : NAV_ICONS[key].off}`;
  });
  const brandText = $('#brandText');
  const barTitle = $('#barTitle');
  if (parts.length === 0) {
    if (brandText) brandText.parentElement.style.display = '';
    if (barTitle) barTitle.classList.add('d-none');
    if (brandText) brandText.classList.remove('d-none');
  } else {
    if (brandText) brandText.classList.add('d-none');
    if (barTitle) {
      barTitle.classList.remove('d-none');
      barTitle.textContent = titleForRoute(parts);
    }
  }
}
function titleForRoute(parts) {
  if (parts[0] === 'search') return 'Search';
  if (parts[0] === 'library') return 'Library';
  if (parts[0] === 'artist') return 'Artist';
  if (parts[0] === 'album') return 'Album';
  if (parts[0] === 'track') return 'Track';
  return 'MusicMan';
}

async function route() {
  closeAllSheets();
  disconnectArtistTracksObserver();
  if (typeof dlUnsubscribe === 'function' && dlUnsubscribe) { dlUnsubscribe(); dlUnsubscribe = null; }

  const { parts } = parseRoute();
  updateNav(parts);
  closeFullPlayer();
  showSkeleton();

  try {
    switch (parts[0]) {
      case undefined: await viewHome(); break;
      case 'search':
        const searchQ = new URLSearchParams(location.hash.includes('?') ? location.hash.split('?')[1] : '').get('q') || '';
        await viewSearch(searchQ);
        break;
      case 'artist': await viewArtist(parts[1]); break;
      case 'album': await viewAlbum(parts[1]); break;
      case 'track': await viewTrack(parts[1]); break;
      case 'library': {
        if (parts[1] === 'playlists') {
          if (parts[2]) renderPlaylistDetail(parts[2]);
          else viewPlaylists();
        } else if (parts[1] === 'downloads') {
          renderDownloads();
        } else if (parts[1] === 'following') {
          viewFollowing();
        } else {
          viewLikes();
        }
        break;
      }
      default: await viewHome();
    }
  } catch (e) {
    console.error('[MusicMan route]', e);
    MAIN().innerHTML = errorState(e.message);
  }

  refreshLikes();
  refreshFollowButtons();
  MAIN().scrollTop = 0;
}

/* ══════════════════════════════════════════════════════════════
   SHARED UI HELPERS
   ══════════════════════════════════════════════════════════════ */
function showSkeleton() {
  const reps = IS_LOW_END ? 3 : 5;
  MAIN().innerHTML = `
    <div class="px-3 pt-4">
      <div class="sk mb-3" style="height:26px;width:45%"></div>
      <div class="d-flex gap-3 mb-4">
        ${'<div class="sk" style="width:138px;height:138px;border-radius:14px"></div>'.repeat(3)}
      </div>
      <div class="sk mb-3" style="height:18px;width:35%"></div>
      ${Array.from({ length: reps }).map(() => `
        <div class="d-flex align-items-center gap-3 mb-3">
          <div class="sk" style="width:48px;height:48px;border-radius:10px"></div>
          <div class="flex-grow-1">
            <div class="sk mb-2" style="height:13px;width:65%"></div>
            <div class="sk" style="height:11px;width:40%"></div>
          </div>
        </div>`).join('')}
    </div>`;
}
function emptyState(icon, text, sub = '') {
  return `<div class="state">
    <i class="bi bi-${icon}"></i>
    <p class="fw-semibold text-body">${esc(text)}</p>
    ${sub ? `<p class="mt-1" style="font-size:.78rem">${esc(sub)}</p>` : ''}
  </div>`;
}
function errorState(msg) {
  return `<div class="state">
    <i class="bi bi-exclamation-triangle text-danger"></i>
    <p class="fw-semibold text-body">Something went wrong</p>
    <p class="mt-1" style="font-size:.78rem">${esc(msg || 'Unknown error')}</p>
    <button class="pill-btn mt-3" onclick="route()"><i class="bi bi-arrow-clockwise"></i> Retry</button>
  </div>`;
}
function secTitle(text, tight = false) { return `<h6 class="sec-title ${tight ? 'tight' : ''}">${esc(text)}</h6>`; }
function backBtn(target = '#/') {
  return `<div class="px-2 pt-2">
    <a href="${esc(target)}" class="icon-btn" data-link aria-label="Back">
      <i class="bi bi-chevron-left" style="font-size:1.5rem"></i>
    </a>
  </div>`;
}

function cardAlbum(c) {
  const art = getArtwork(c, 300);
  return `<a class="card-item" href="#/album/${esc(c.collectionId)}" data-link>
    ${art ? `<img class="card-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
      : `<div class="card-art card-art-ph"><i class="bi bi-disc"></i></div>`}
    <div class="card-name text-truncate">${esc(c.collectionName || 'Album')}</div>
    <div class="card-sub text-truncate">${esc(c.artistName || '')}</div>
  </a>`;
}
function cardTrack(t) {
  const art = getArtwork(t, 300);
  return `<a class="card-item" href="#/track/${esc(t.trackId)}" data-link>
    ${art ? `<img class="card-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
      : `<div class="card-art card-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="card-name text-truncate">${esc(t.trackName || 'Track')}</div>
    <div class="card-sub text-truncate">${esc(t.artistName || '')}</div>
  </a>`;
}
function cardTrackPopular(t) {
  const art = getArtwork(t, 300);
  const views = Number(t.views) || 0;
  const viewsLabel = views >= 1000 ? (views / 1000).toFixed(views >= 10000 ? 0 : 1) + 'K'
    : String(views);
  const sub = [t.artistName, viewsLabel ? `` : ''].filter(Boolean).join(' · ');
  return `<a class="card-item" href="#/track/${esc(t.trackId)}" data-link>
    ${art ? `<img class="card-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
      : `<div class="card-art card-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="card-name text-truncate">${esc(t.trackName || 'Track')}</div>
    <div class="card-sub text-truncate">${esc(sub)}</div>
  </a>`;
}
function cardArtist(a) {
  const art = getArtwork(a, 300);
  return `<a class="artist-item" href="#/artist/${esc(a.artistId)}" data-link>
    ${art ? `<img class="artist-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
      : `<div class="artist-art artist-art-ph"><i class="bi bi-person-fill"></i></div>`}
    <div class="card-name text-truncate">${esc(a.artistName || 'Artist')}</div>
  </a>`;
}

function trackRow(item, opts = {}) {
  const id = String(item.trackId || '');
  const liked = isLiked(id);
  const cached = isCached(id);
  const dl = DL.get(id);
  const art = getArtwork(item, 100);
  const dur = item.trackTimeMillis ? fmtTime(item.trackTimeMillis / 1000) : '';
  const sub = [item.artistName, dur].filter(Boolean).join(' · ');
  const isCurrent = Player.track && String(Player.track.trackId) === id;
  const fullAudio = hasAudio(item);
  const previewOnly = !fullAudio && hasPreview(item) && !cached;

  let badge = '';
  if (cached) badge = `<span class="badge-chip crawled"><i class="bi bi-cloud-check-fill"></i>Offline</span>`;
  else if (dl && ['queued', 'crawling', 'saving'].includes(dl.status))
    badge = `<span class="badge-chip crawling"><span class="spinner-border"></span>${dl.status === 'saving' ? 'Downloading' : 'Crawling'}</span>`;
  else if (previewOnly)
    badge = `<span class="badge-chip preview"><i class="bi bi-play-circle"></i>Preview</span>`;

  const extraMenu = opts.playlistId ? `,'${esc(opts.playlistId)}'` : '';

  return `
  <div class="row-item ${isCurrent ? 'playing' : ''}" data-track-id="${esc(id)}">
    <button class="row-play ${isCurrent && Player.playing ? 'playing' : ''}"
            data-play-id="${esc(id)}"
            onclick="event.preventDefault();event.stopPropagation();playById('${esc(id)}')" aria-label="Play">
      <i class="bi ${isCurrent && Player.playing ? 'bi-pause-fill' : (previewOnly ? 'bi-play-circle' : 'bi-play-fill')}"></i>
    </button>
    <a class="row-info" href="#/track/${esc(id)}" data-link>
      ${art ? `<img class="row-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
      : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
      <div class="min-w-0 flex-grow-1">
        <div class="row-title text-truncate">${esc(item.trackName || 'Track')}${badge ? ' ' + badge : ''}</div>
        <div class="row-sub text-truncate">${esc(sub)}</div>
      </div>
    </a>
    <button class="icon-btn sm ${liked ? 'liked' : ''}" data-like="${esc(id)}"
            onclick="event.preventDefault();event.stopPropagation();toggleLikeById('${esc(id)}')" aria-label="Like">
      <i class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i>
    </button>
    <button class="icon-btn sm" onclick="event.preventDefault();event.stopPropagation();openTrackMenu('${esc(id)}'${extraMenu})" aria-label="More">
      <i class="bi bi-three-dots-vertical"></i>
    </button>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   HOME
   ══════════════════════════════════════════════════════════════ */
async function viewHome() {
  const [freshItems, popularItems] = await Promise.all([
    apiFresh().catch(() => []),
    apiPopular(40).catch(() => [])
  ]);
  cacheItems(freshItems);
  cacheItems(popularItems);

  const artists = freshItems.filter(i => itemType(i) === 'artist');
  const albums = freshItems.filter(i => itemType(i) === 'collection');
  const tracks = freshItems.filter(i => itemType(i) === 'track');

  const seen = new Set();
  const popular = popularItems
    .filter(i => itemType(i) === 'track')
    .filter(i => { const id = String(i.trackId || ''); if (!id || seen.has(id)) return false; seen.add(id); return true; });

  const recents = getRecentlyPlayed();

  const h = new Date().getHours();
  const greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';

  let html = `<div class="pb-4">`;
  html += `<div class="px-3 pt-4 pb-1">
    <div style="font-size:1.5rem;font-weight:800;letter-spacing:-.02em">${greet}</div>
    <div class="text-secondary" style="font-size:.82rem">Welcome to MusicMan</div>
  </div>`;

  if (recents.length) {
    html += secTitle('Recently Played');
    html += `<div class="hscroll">${recents.slice(0, 10).map(r => cardTrack({
      wrapperType: 'track', trackId: r.trackId, trackName: r.trackName,
      artistName: r.artistName,
      attachments: { artworkUrls: r.artworkUrl ? [{ url: r.artworkUrl }] : [] }
    })).join('')}</div>`;
  }

  if (popular.length) {
    html += secTitle('Popular');
    html += `<div class="hscroll">${popular.slice(0, 20).map(cardTrackPopular).join('')}</div>`;
  }

  if (tracks.length) {
    html += secTitle(recents.length ? 'Fresh Music' : 'Fresh');
    html += `<div class="hscroll">${tracks.map(cardTrack).join('')}</div>`;
  }

  if (artists.length) { html += secTitle('Fresh Artists'); html += `<div class="hscroll">${artists.map(cardArtist).join('')}</div>`; }
  if (albums.length) { html += secTitle('Fresh Albums'); html += `<div class="hscroll">${albums.map(cardAlbum).join('')}</div>`; }
  if (!freshItems.length && !popular.length && !recents.length) html += emptyState('collection', 'Nothing to show yet', 'Try searching for something.');

  html += `</div>`;
  MAIN().innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════
   SEARCH
   ══════════════════════════════════════════════════════════════ */
let searchFilter = 'all';
let searchCache = { term: null, items: null };

function searchBarHtml(term = '') {
  return `<div class="search-wrap">
    <form onsubmit="event.preventDefault();submitSearch()">
      <div class="search-box">
        <i class="bi bi-search"></i>
        <input id="searchInput" type="search" placeholder="Songs, albums, artists…"
               value="${esc(term)}" autocomplete="off" enterkeyhint="search"
               role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="searchSuggest">
        ${term ? `<button type="button" class="icon-btn sm" onclick="clearSearch()" aria-label="Clear"><i class="bi bi-x-circle-fill"></i></button>` : ''}
      </div>
      <div class="search-suggest" id="searchSuggest" role="listbox" aria-label="Search suggestions"></div>
    </form>
    ${term ? `
      <div class="filter-row">
        <button class="chip ${searchFilter === 'all' ? 'on' : ''}"    data-filter="all"    onclick="setSearchFilter('all')">All</button>
        <button class="chip ${searchFilter === 'artist' ? 'on' : ''}" data-filter="artist" onclick="setSearchFilter('artist')">Artists</button>
        <button class="chip ${searchFilter === 'album' ? 'on' : ''}"  data-filter="album"  onclick="setSearchFilter('album')">Albums</button>
        <button class="chip ${searchFilter === 'track' ? 'on' : ''}"  data-filter="track"  onclick="setSearchFilter('track')">Songs</button>
      </div>` : ''}
  </div>`;
}

function wireSearchSuggest(autoFocus) {
  requestAnimationFrame(() => {
    const inp = document.getElementById('searchInput');
    const dd = document.getElementById('searchSuggest');
    if (inp && dd && typeof initSuggest === 'function') initSuggest(inp, dd);
    if (autoFocus && inp && document.activeElement === document.body) inp.focus();
  });
}

function setSearchFilter(f) {
  searchFilter = f;
  if (searchCache.term && searchCache.items) {
    renderSearchResults(searchCache.term, searchCache.items);
    refreshLikes();
  }
}

function submitSearch() {
  const q = ($('#searchInput')?.value || '').trim();
  if (!q) return;
  const list = ls.get(KEY.recent, []).filter(x => x !== q);
  list.unshift(q); ls.set(KEY.recent, list.slice(0, 10));
  searchFilter = 'all';
  go('#/search?q=' + encodeURIComponent(q));
}

function clearSearch() { const i = $('#searchInput'); if (i) { i.value = ''; i.focus(); } }
function clearRecent() { ls.remove(KEY.recent); viewSearch(''); }

async function viewSearch(term) {
  if (!term) {
    const recent = ls.get(KEY.recent, []);
    let html = `<div class="pb-4">${searchBarHtml('')}`;
    if (recent.length) {
      html += `<div class="d-flex align-items-center px-3 pt-4 pb-2">
        <div class="sec-title p-0 flex-grow-1">Recent searches</div>
        <button class="icon-btn sm" onclick="clearRecent()" aria-label="Clear"><i class="bi bi-trash3"></i></button>
      </div>`;
      html += recent.map(r => `
        <button class="sheet-item" onclick="go('#/search?q=${encodeURIComponent(r)}')">
          <i class="bi bi-clock-history"></i><span class="flex-grow-1">${esc(r)}</span>
        </button>`).join('');
    } else {
      html += emptyState('search', 'Find your music', 'Search for songs, albums and artists.');
    }
    html += `</div>`;
    MAIN().innerHTML = html;
    wireSearchSuggest(true);
    return;
  }

  let items;
  if (searchCache.term === term && searchCache.items) {
    items = searchCache.items;
  } else {
    items = await apiSearch(term);
    searchCache = { term, items };
    cacheItems(items);
  }
  renderSearchResults(term, items);
}

function renderSearchResults(term, items) {
  const artists = items.filter(i => itemType(i) === 'artist');
  const albums = items.filter(i => itemType(i) === 'collection');
  const tracks = items.filter(i => itemType(i) === 'track');

  const showTracks = searchFilter === 'all' || searchFilter === 'track';
  const showAlbums = searchFilter === 'all' || searchFilter === 'album';
  const showArtists = searchFilter === 'all' || searchFilter === 'artist';

  let html = `<div class="pb-4">${searchBarHtml(term)}`;

  if (!items.length) {
    html += emptyState('emoji-frown', `No results for "${term}"`, 'Try different keywords.');
  } else {
    let hasSomething = false;

    if (showArtists && artists.length) {
      hasSomething = true;
      html += secTitle(`Artists · ${artists.length}`);
      html += `<div class="hscroll">${artists.map(cardArtist).join('')}</div>`;
    }
    if (showAlbums && albums.length) {
      hasSomething = true;
      html += secTitle(`Albums · ${albums.length}`);
      html += `<div class="hscroll">${albums.map(cardAlbum).join('')}</div>`;
    }
    if (showTracks && tracks.length) {
      hasSomething = true;
      html += secTitle(`Songs · ${tracks.length}`);
      html += tracks.map(t => trackRow(t)).join('');
    }
    if (!hasSomething) {
      html += emptyState('funnel', 'No matches for this filter');
    }
  }

  html += `</div>`;
  MAIN().innerHTML = html;
  wireSearchSuggest(false);
}

/* ─── Artist tracks ─── */
const _artistTracks = {
  artistId: null, sort: 'album', page: 0, limit: 50,
  total: 0, pages: 0, hasMore: false, loading: false, items: []
};
let _artistTracksObserver = null;

function disconnectArtistTracksObserver() {
  if (_artistTracksObserver) { _artistTracksObserver.disconnect(); _artistTracksObserver = null; }
}

async function loadArtistTracks(artistId, { reset = false, sort = null } = {}) {
  if (!artistId) return;
  const st = _artistTracks;

  if (reset || st.artistId !== String(artistId)) {
    st.artistId = String(artistId);
    st.page = 0; st.items = []; st.total = 0; st.pages = 0; st.hasMore = false;
  }
  if (sort) st.sort = sort;
  if (st.loading || (st.page > 0 && !st.hasMore)) return;

  st.loading = true;
  const nextPage = st.page + 1;
  const sentinel = document.getElementById('artistTracksSentinel');
  const listEl = document.getElementById('artistTracksList');

  if (sentinel) {
    sentinel.innerHTML = `<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;
  }

  try {
    const res = await apiArtistTracks(artistId, { page: nextPage, limit: st.limit, sort: st.sort });
    const tracks = (res.results || []).filter(t => itemType(t) === 'track');
    st.page = nextPage;
    st.total = res.total ?? tracks.length;
    st.pages = res.pages ?? 1;
    st.hasMore = !!res.hasMore;
    st.items = st.items.concat(tracks);
    cacheItems(tracks);

    _pageTracks = st.items;

    if (listEl && tracks.length) {
      const html = tracks.map(t => trackRow(t)).join('');
      listEl.insertAdjacentHTML('beforeend', html);
    }

    const countEl = document.getElementById('artistTrackCount');
    if (countEl) countEl.textContent = `${st.items.length} of ${st.total}`;

    const playAllBtn = document.getElementById('artistPlayAllBtn');
    if (playAllBtn) playAllBtn.disabled = st.items.length === 0;

    refreshLikes();
  } catch (e) {
    console.warn('[MusicMan] artist tracks error:', e);
  } finally {
    st.loading = false;
    if (sentinel && !st.hasMore) {
      sentinel.innerHTML = st.items.length
        ? `<div class="text-center py-4 text-secondary" style="font-size:.75rem">All ${st.total} track${st.total !== 1 ? 's' : ''} loaded</div>`
        : '';
    }
  }
}

function attachArtistTracksObserver() {
  disconnectArtistTracksObserver();
  const root = document.getElementById('main');
  const sentinel = document.getElementById('artistTracksSentinel');
  if (!root || !sentinel) return;

  _artistTracksObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      if (_artistTracks.loading || !_artistTracks.hasMore) continue;
      loadArtistTracks(_artistTracks.artistId);
    }
  }, { root, rootMargin: '500px 0px', threshold: 0.01 });

  _artistTracksObserver.observe(sentinel);
}

function setArtistSort(sort) {
  if (_artistTracks.sort === sort) return;
  const listEl = document.getElementById('artistTracksList');
  if (listEl) listEl.innerHTML = '';
  _artistTracks.items = [];
  _artistTracks.page = 0;
  _artistTracks.hasMore = true;
  _artistTracks.sort = sort;
  $$('#artistSort .chip').forEach(b => b.classList.toggle('on', b.dataset.sort === sort));
  loadArtistTracks(_artistTracks.artistId, { reset: true, sort });
}

/* ══════════════════════════════════════════════════════════════
   ARTIST VIEW
   ══════════════════════════════════════════════════════════════ */
async function viewArtist(id) {
  if (!id) { MAIN().innerHTML = emptyState('person', 'Artist not found'); return; }

  _artistTracks.artistId = String(id);
  _artistTracks.sort = 'album';
  _artistTracks.page = 0;
  _artistTracks.items = [];
  _artistTracks.hasMore = true;
  _artistTracks.loading = false;

  let artist = getCached('artist', id);
  if (!artist) {
    const r = await apiLookup(id, 'musicArtist');
    artist = r.find(x => itemType(x) === 'artist') || r[0];
    if (artist) cacheItems([artist]);
  }
  if (!artist) { MAIN().innerHTML = emptyState('person', 'Artist not found'); return; }

  const albumRes = await apiLookup(id, 'album').catch(() => []);
  const albumMap = new Map();
  for (const a of albumRes.filter(x => itemType(x) === 'collection')) {
    const cid = String(a.collectionId || '');
    if (cid && !albumMap.has(cid)) albumMap.set(cid, a);
  }
  const albums = Array.from(albumMap.values());
  cacheItems(albums);
  const fullAlbums = albums.filter(a => (a.trackCount || 0) > 1);

  let artistArt = '';
  for (const a of albums) { const ar = getArtwork(a, 400); if (ar) { artistArt = ar; break; } }

  const followed = isFollowed(id);
  const genre = artist.primaryGenreName || '';

  const subParts = [];
  if (genre) subParts.push(esc(genre));
  if (albums.length) subParts.push(`${albums.length} album${albums.length !== 1 ? 's' : ''}`);
  subParts.push(`<span id="artistTrackCount">0 of —</span>`);

  let html = `<div class="pb-4">`;
  html += backBtn('#/');
  html += `<div class="hero">
    ${artistArt
      ? `<img class="hero-art round" src="${esc(artistArt)}" loading="lazy" decoding="async" alt="">`
      : `<div class="hero-art hero-art-ph round"><i class="bi bi-person-fill"></i></div>`}
    <div class="hero-title">${esc(artist.artistName || 'Artist')}</div>
    <div class="hero-sub">${subParts.join(' · ')}</div>
  </div>`;

  html += `<div class="action-bar scrollable">
    <button class="pill-btn success" id="artistPlayAllBtn" disabled
            onclick="playIds(_pageTracks.map(t => t.trackId).join(','))">
      <i class="bi bi-play-fill"></i> Play all
    </button>
    <button class="pill-btn ${followed ? '' : 'primary'}" data-follow="${esc(id)}"
            onclick="toggleFollow('${esc(id)}', '${esc(artistArt)}')">
      <i class="bi ${followed ? 'bi-check-lg' : 'bi-plus-lg'}"></i>
      <span>${followed ? 'Following' : 'Follow'}</span>
    </button>
    <button class="pill-btn" onclick="crawlAll('artist','${esc(id)}',this)">
      <i class="bi bi-cloud-arrow-down"></i> Crawl artist
    </button>
  </div>`;

  if (fullAlbums.length) {
    html += secTitle(`Albums · ${fullAlbums.length}`);
    html += `<div class="hscroll">${fullAlbums.map(cardAlbum).join('')}</div>`;
  }

  html += `<div class="d-flex align-items-center gap-2 px-3" style="margin-top:8px">
    <div class="sec-title p-0 flex-grow-1" style="padding-top:0">Tracks</div>
  </div>
  <div class="filter-row" id="artistSort" style="padding-top:2px">
    <button class="chip on" data-sort="album"  onclick="setArtistSort('album')">Album</button>
    <button class="chip"    data-sort="recent" onclick="setArtistSort('recent')">Recent</button>
    <button class="chip"    data-sort="name"   onclick="setArtistSort('name')">A–Z</button>
    <button class="chip"    data-sort="views"  onclick="setArtistSort('views')">Popular</button>
  </div>`;

  html += `<div id="artistTracksList"></div>`;
  html += `<div id="artistTracksSentinel"></div>`;

  html += `</div>`;
  MAIN().innerHTML = html;

  await loadArtistTracks(id, { reset: true, sort: 'album' });
  attachArtistTracksObserver();
}

/* ══════════════════════════════════════════════════════════════
   ALBUM VIEW
   ══════════════════════════════════════════════════════════════ */
async function viewAlbum(id) {
  if (!id) { MAIN().innerHTML = emptyState('disc', 'Album not found'); return; }

  let album = getCached('collection', id);
  if (!album) {
    const r = await apiLookup(id, 'album');
    album = r.find(x => itemType(x) === 'collection') || r[0];
    if (album) cacheItems([album]);
  }
  if (!album) { MAIN().innerHTML = emptyState('disc', 'Album not found'); return; }

  const tracks = (await apiLookup(id, 'song')).filter(x => itemType(x) === 'track');
  cacheItems(tracks);

  const art = getArtwork(album, 600);
  const missing = tracks.filter(t => !hasAudio(t) && !isCached(t.trackId)).length;
  const ids = tracks.map(t => String(t.trackId)).join(',');
  const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : '';

  _pageTracks = tracks.map(t => ({
    wrapperType: 'track',
    trackId: t.trackId, trackName: t.trackName,
    artistName: t.artistName, artistId: t.artistId,
    collectionName: t.collectionName, collectionId: t.collectionId,
    trackTimeMillis: t.trackTimeMillis,
    attachments: {
      artworkUrls: t.attachments?.artworkUrls || [],
      previewUrls: t.attachments?.previewUrls || [],
      audioUrls: t.attachments?.audioUrls || []
    }
  }));

  let html = `<div class="pb-4">`;
  html += backBtn(album.artistId ? `#/artist/${album.artistId}` : '#/');
  html += `<div class="hero">
    ${art ? `<img class="hero-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
      : `<div class="hero-art hero-art-ph"><i class="bi bi-disc"></i></div>`}
    <div class="hero-title">${esc(album.collectionName || 'Album')}</div>
    <div class="hero-sub">
      ${album.artistId ? `<a href="#/artist/${esc(album.artistId)}" data-link>${esc(album.artistName || '')}</a>` : esc(album.artistName || '')}
      ${year ? ` · ${year}` : ''}
      ${album.trackCount ? ` · ${album.trackCount} tracks` : ''}
    </div>
  </div>`;

  html += `<div class="action-bar scrollable">
    ${tracks.length ? `<button class="pill-btn success" onclick="playIds('${esc(ids)}')">
      <i class="bi bi-play-fill"></i> Play
    </button>` : ''}
    ${tracks.length && missing > 0 ? `<button class="pill-btn primary" onclick="crawlAll('collection','${esc(id)}',this)">
      <i class="bi bi-cloud-arrow-down"></i> Crawl all (${missing})
    </button>` : ''}
  </div>`;

  html += tracks.length ? tracks.map(t => trackRow(t)).join('') : emptyState('music-note', 'No tracks found');
  html += `</div>`;
  MAIN().innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════
   TRACK PAGE
   ══════════════════════════════════════════════════════════════ */
let trackPoller = null;
function stopTrackPoller() { if (trackPoller) { clearInterval(trackPoller); trackPoller = null; } }
let lyricsTrackId = null;

async function viewTrack(id) {
  if (!id) { MAIN().innerHTML = emptyState('music-note', 'Track not found'); return; }
  stopTrackPoller();
  lyricsTrackId = String(id);

  let track = null;
  try {
    const r = await apiLookup(id, 'song');
    track = r.find(x => itemType(x) === 'track') || r[0];
    if (track) cacheItems([track]);
  } catch { }
  if (!track) track = getCached('track', id);
  if (!track) { MAIN().innerHTML = emptyState('music-note', 'Track not found'); return; }

  renderTrackPage(track);

  const dl = DL.get(id);
  const crawling = dl && ['queued', 'crawling'].includes(dl.status);

  if (crawling || (!hasAudio(track) && !isCached(id))) {
    const status = await apiCrawlStatus(id);
    renderCrawlCard(track, status);
    if (crawling || (status && ['pending', 'downloading'].includes(status.download_status))) {
      startTrackPoller(id);
    }
  } else {
    renderCrawlCard(track, null);
  }
}

function renderTrackPage(track) {
  const id = String(track.trackId);
  const art = getArtwork(track, 600);
  const liked = isLiked(id);
  const cached = isCached(id);
  const crawled = hasAudio(track);
  const previewable = !crawled && hasPreview(track) && !cached;
  const playable = crawled || cached;
  const dur = track.trackTimeMillis ? fmtTime(track.trackTimeMillis / 1000) : '';
  const year = track.releaseDate ? new Date(track.releaseDate).getFullYear() : '';
  const dl = DL.get(id);
  const action = dlActionFor(track);

  let html = `<div class="pb-4">`;
  html += backBtn(track.artistId ? `#/artist/${track.artistId}` : '#/');
  html += `<div class="hero">
    ${art ? `<img class="hero-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">`
      : `<div class="hero-art hero-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="hero-title">${esc(track.trackName || 'Track')}</div>
    <div class="hero-sub">
      ${track.artistId ? `<a href="#/artist/${esc(track.artistId)}" data-link>${esc(track.artistName || '')}</a>` : esc(track.artistName || '')}
      ${track.collectionId ? ` · <a href="#/album/${esc(track.collectionId)}" data-link>${esc(track.collectionName || '')}</a>` : ''}
    </div>
    <div class="hero-sub" style="font-size:.74rem">
      ${[year, dur, track.primaryGenreName].filter(Boolean).join(' · ')}
    </div>
  </div>`;

  let primaryBtn = '';
  if (dl && ['queued', 'crawling', 'saving'].includes(dl.status)) {
    const label = dl.status === 'queued'
      ? 'Queued'
      : dl.status === 'crawling' ? 'Crawling' : 'Downloading';
    primaryBtn = `<button class="pill-btn info" onclick="go('#/library/downloads')">
      <span class="spinner-border spinner-border-sm me-1" style="width:14px;height:14px;border-width:2px"></span>
      ${label}${dl.percent ? ' · ' + dl.percent + '%' : ''}
    </button>`;
  } else if (!playable) {
    if (previewable) {
      primaryBtn = `<button class="pill-btn preview" onclick="playById('${esc(id)}')">
        <i class="bi bi-play-circle"></i> Play preview
      </button>`;
    } else {
      primaryBtn = `<button class="pill-btn primary" onclick="startCrawl('${esc(id)}', this)">
        <i class="bi ${action.icon}"></i> ${action.label}
      </button>`;
    }
  } else {
    primaryBtn = `<button class="pill-btn success" onclick="playById('${esc(id)}')">
      <i class="bi bi-play-fill"></i> ${cached ? 'Play offline' : 'Play'}
    </button>`;
  }

  html += `<div class="action-bar">
    ${primaryBtn}
    <button class="icon-btn ${liked ? 'liked' : ''}" data-like="${esc(id)}"
            onclick="toggleLikeById('${esc(id)}')" aria-label="Like"
            style="background:rgba(var(--bs-body-color-rgb),.09)">
      <i class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i>
    </button>
    <button class="icon-btn" onclick="openTrackMenu('${esc(id)}')" aria-label="More"
            style="background:rgba(var(--bs-body-color-rgb),.09)">
      <i class="bi bi-three-dots"></i>
    </button>
  </div>`;

  html += `<div id="crawlCard"></div>`;

  html += `<div class="lyrics-card">
    <div class="lyrics-head">
      <i class="bi bi-music-note-list"></i>
      <span class="flex-grow-1">Lyrics</span>
      <span class="lyrics-badge" id="lyricsBadge" style="display:none">Synced</span>
    </div>
    <div class="lyrics-body" id="lyricsBody">
      <div class="text-secondary d-flex align-items-center gap-2" style="font-size:.82rem">
        <span class="spinner-border spinner-border-sm"></span> Loading lyrics…
      </div>
    </div>
  </div>`;

  html += `</div>`;
  MAIN().innerHTML = html;
  loadLyrics(id, track);
}

function renderCrawlCard(track, status) {
  const el = $('#crawlCard'); if (!el) return;
  const id = String(track.trackId);
  const cached = isCached(id);
  const dl = DL.get(id);
  const action = dlActionFor(track);
  const previewable = !hasAudio(track) && hasPreview(track) && !cached;

  if (cached) {
    el.innerHTML = `<div class="crawl-card ready">
      <i class="bi bi-cloud-check-fill text-success" style="font-size:1.5rem"></i>
      <div class="cc-body">
        <div class="cc-title">Saved offline</div>
        <div class="cc-sub">Ready to play without internet</div>
      </div>
      <button class="pill-btn primary sm" onclick="exportCached('${esc(id)}')">
        <i class="bi bi-file-earmark-arrow-down"></i> Save file
      </button>
      <button class="icon-btn sm text-danger" onclick="removeCached('${esc(id)}')" aria-label="Remove">
        <i class="bi bi-trash3"></i>
      </button>
    </div>`;
    return;
  }
  if (dl && ['queued', 'crawling', 'saving'].includes(dl.status)) {
    const isSaving = dl.status === 'saving';
    const label = dl.status === 'queued'
      ? (action.isDirect ? 'Queued to download' : 'Queued to crawl')
      : isSaving ? 'Downloading'
        : 'Crawling';
    const pct = dl.percent || 0;
    el.innerHTML = `<div class="crawl-card pending" style="flex-direction:column;align-items:stretch">
      <div class="d-flex align-items-center gap-2">
        <span class="spinner-border spinner-border-sm text-info"></span>
        <span class="cc-title flex-grow-1">${label}…</span>
        <span class="fw-bold text-info" style="font-size:.8rem">${pct}%</span>
      </div>
      <div class="progress mt-2"><div class="progress-bar bg-info" style="width:${pct}%"></div></div>
    </div>`;
    return;
  }
  if (dl && dl.status === 'failed') {
    el.innerHTML = `<div class="crawl-card fail">
      <i class="bi bi-x-circle-fill text-danger" style="font-size:1.5rem"></i>
      <div class="cc-body">
        <div class="cc-title">${action.isDirect ? 'Download' : 'Crawl'} failed</div>
      </div>
      <button class="pill-btn danger sm" onclick="DL.retry('${esc(id)}')">
        <i class="bi bi-arrow-repeat"></i> Retry
      </button>
    </div>`;
    return;
  }
  const cardClass = previewable ? 'preview' : 'idle';
  const iconColor = previewable ? 'var(--mm-preview)' : 'var(--bs-primary)';
  const btnClass = previewable ? 'preview' : 'primary';
  el.innerHTML = `<div class="crawl-card ${cardClass}">
    <i class="bi ${action.icon}" style="color:${iconColor};font-size:1.7rem"></i>
    <div class="cc-body">
      <div class="cc-title">${action.idleTitle}</div>
      <div class="cc-sub">${action.idleSub}</div>
    </div>
    <button class="pill-btn ${btnClass}" onclick="startCrawl('${esc(id)}', this)">
      <i class="bi ${action.icon}"></i> ${action.label}
    </button>
  </div>`;
}

function startTrackPoller(trackId) {
  stopTrackPoller();
  const tid = String(trackId);
  const tick = async () => {
    const cur = currentPath().startsWith('/track/') ? currentPath().split('/')[2] : null;
    if (String(cur) !== tid) { stopTrackPoller(); return; }
    const dl = DL.get(tid);
    const status = await apiCrawlStatus(tid);
    if (!status || status.download_status === 'completed' || (dl && dl.status === 'saving')) {
      try {
        const fresh = await apiLookup(tid, 'song');
        const it = fresh.find(x => itemType(x) === 'track') || fresh[0];
        if (it && hasAudio(it)) {
          cacheItems([it]);
          if (currentPath().startsWith('/track/')) { renderTrackPage(it); refreshLikes(); }
        }
      } catch { }
      if (dl && ['queued', 'crawling', 'saving'].includes(dl.status)) return;
      stopTrackPoller(); return;
    }
    const cached = getCached('track', tid);
    if (cached) renderCrawlCard(cached, status);
  };
  tick();
  trackPoller = setInterval(tick, POLL_MS);
}

/* ══════════════════════════════════════════════════════════════
   LYRICS
   ══════════════════════════════════════════════════════════════ */
let syncedLyricsCache = { trackId: null, lines: null, synced: false, loading: false };

function loadLyrics(trackId, trackItem) {
  const body = $('#lyricsBody');
  const badge = $('#lyricsBadge');
  if (badge) badge.style.display = 'none';

  const idStr = String(trackId);
  const item = trackItem || getCached('track', idStr);

  if (body) {
    body.innerHTML = `<div class="text-secondary" style="font-size:.85rem;padding:8px 0">No lyrics available.</div>`;
  }
}

/* ══════════════════════════════════════════════════════════════
   PLAYER
   ══════════════════════════════════════════════════════════════ */
const audio = new Audio();
audio.preload = 'metadata';
audio.volume = 0.85;

const Player = {
  track: null, queue: [], index: -1, playing: false,
  shuffle: false, repeat: 'off', seeking: false, source: 'MusicMan',
  sleepTimer: null
};

let fpTab = 'now';
function setFpTab(tab) {
  fpTab = tab;
  $$('#fpHeadTabs .fp-head-tab').forEach(b => b.classList.toggle('active', b.dataset.fpTab === tab));
  renderFpTabBody();
}

function renderFpTabBody() {
  const body = $('#fpTabBody'); if (!body) return;
  if (fpTab === 'now') renderFpNow(body);
  else if (fpTab === 'queue') renderFpQueue(body);
  else renderFpLyrics(body);
}

function syncPlayerUI() {
  const t = Player.track;
  const mini = $('#mini'); if (!mini) return;
  if (!t) { mini.classList.add('d-none'); document.title = 'MusicMan'; renderFpTabBody(); return; }
  mini.classList.remove('d-none');
  const art = getArtwork(t, 300) || t.artworkUrl || '';
  const artSmall = getArtwork(t, 100) || t.artworkUrl || art;
  const mi = $('#miniArt');
  if (artSmall) { mi.src = artSmall; mi.style.visibility = 'visible'; }
  else { mi.removeAttribute('src'); mi.style.visibility = 'hidden'; }
  $('#miniTitle').textContent = t.trackName || 'Track';
  $('#miniArtist').textContent = t.artistName || '';
  refreshLikes(); renderFpTabBody(); syncPlayIcons(); syncSaveButton();
}

function syncPlayIcons() {
  const cls = Player.playing ? 'bi-pause-fill' : 'bi-play-fill';
  const m = $('#miniPlayIcon'); if (m) m.className = `bi ${cls}`;
  const f = $('#fpPlayIcon'); if (f) f.className = `bi ${cls}`;
}

function syncSaveButton() {
  const btn = $('#fpSaveBtn'); if (!btn) return;
  const id = Player.track?.trackId;
  if (!id) { btn.innerHTML = '<i class="bi bi-download"></i>'; return; }
  if (isCached(id)) { btn.innerHTML = '<i class="bi bi-cloud-check-fill text-success"></i>'; return; }
  const dl = DL.get(id);
  if (dl && ['queued', 'crawling', 'saving'].includes(dl.status)) {
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:14px;height:14px;border-width:2px"></span>`;
    return;
  }
  const action = dlActionFor(Player.track);
  btn.innerHTML = `<i class="bi ${action.icon}"></i>`;
}

function setSeekUI(pct) {
  const bar = $('#miniBar'); if (bar) bar.style.width = pct + '%';
  const seek = $('#fpSeek');
  if (seek && !Player.seeking) {
    seek.value = Math.round(pct * 10);
    seek.style.setProperty('--p', pct + '%');
  }
}

audio.addEventListener('play', () => {
  Player.playing = true; syncPlayIcons(); syncSaveButton();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
});
audio.addEventListener('pause', () => { Player.playing = false; syncPlayIcons(); });
audio.addEventListener('ended', () => nextTrack(false));

audio.addEventListener('timeupdate', () => {
  const d = audio.duration; if (!d || !isFinite(d)) return;
  const pct = (audio.currentTime / d) * 100;
  setSeekUI(pct);
  const c = $('#fpCur'); if (c) c.textContent = fmtTime(audio.currentTime);
});

async function playItem(item, source = 'MusicMan') {
  if (!item) return;
  Player.source = source;
  const id = String(item.trackId || '');
  if (!id) return;

  if (isCached(id)) return playCachedById(id, item);

  let resolvedItem = item;
  let rawUrl = getPlayable(item);

  if (!rawUrl) {
    const cached = getCached('track', id);
    if (cached) {
      if (isCached(id)) return playCachedById(id, cached);
      const u = getPlayable(cached);
      if (u) { resolvedItem = cached; rawUrl = u; }
    }
  }

  if (!rawUrl) {
    try {
      const r = await apiLookup(id, 'song');
      const fresh = r.find(x => itemType(x) === 'track') || r[0];
      if (fresh) {
        cacheItems([fresh]);
        if (isCached(id)) return playCachedById(id, fresh);
        const u = getPlayable(fresh);
        if (u) { resolvedItem = fresh; rawUrl = u; }
      }
    } catch { }
  }

  if (!rawUrl) {
    toast('Audio not ready — crawl/download it first', 'warning');
    return;
  }

  audio.pause();
  if (audio.dataset.blobUrl) { try { URL.revokeObjectURL(audio.dataset.blobUrl); } catch { } delete audio.dataset.blobUrl; }
  audio.src = proxyUrl(rawUrl);
  audio.load();
  audio.playbackRate = Number(getSettings().playbackRate) || 1;
  audio.play().catch(err => { if (err.name !== 'AbortError') toast('Cannot play', 'danger'); });
  Player.track = resolvedItem;
  pushRecentlyPlayed(resolvedItem);
  setQueueFromItem(resolvedItem, id);
  syncPlayerUI();
}

function setQueueFromItem(item, id) {
  if (!id) return;
  const existing = Player.queue.findIndex(t => String(t.trackId) === id);
  if (existing >= 0) {
    Player.queue[existing] = item;
    Player.index = existing;
  } else {
    Player.queue.push(item);
    Player.index = Player.queue.length - 1;
  }
}

async function playById(id) {
  haptic(6);
  const cached = isCached(id);
  let it = getCached('track', id);
  if (!it) {
    try {
      const r = await apiLookup(id, 'song');
      it = r.find(x => itemType(x) === 'track') || r[0];
      if (it) cacheItems([it]);
    } catch { }
  }
  if (!it && cached) it = { wrapperType: 'track', trackId: String(id), trackName: 'Cached track', artistName: '', attachments: {} };
  if (!it) { toast('Track not found', 'danger'); return; }
  playItem(it);
}

async function playCachedById(id, fallbackMeta) {
  const e = await cacheGet(id);
  if (!e?.blob) { toast('Not available offline', 'danger'); return; }
  const m = e.meta || {};
  const url = URL.createObjectURL(e.blob);
  audio.pause();
  if (audio.dataset.blobUrl) { try { URL.revokeObjectURL(audio.dataset.blobUrl); } catch { } }
  audio.dataset.blobUrl = url;
  audio.src = url;
  audio.playbackRate = Number(getSettings().playbackRate) || 1;
  audio.play().catch(() => { });
  const fake = fallbackMeta && fallbackMeta.trackId ? fallbackMeta : {
    wrapperType: 'track', trackId: String(id),
    trackName: m.name || 'Cached track', artistName: m.artist || '',
    artistId: m.artistId || '', collectionName: m.album || '',
    attachments: { artworkUrls: m.artwork ? [{ url: m.artwork }] : [] }
  };
  Player.track = fake;
  pushRecentlyPlayed(fake);
  setQueueFromItem(fake, String(id));
  syncPlayerUI();
}

function togglePlay() {
  haptic(6);
  if (!audio.src) {
    if (Player.queue.length) playItem(Player.queue[Math.max(0, Player.index)] || Player.queue[0]);
    return;
  }
  if (audio.paused) audio.play().catch(() => { }); else audio.pause();
}

function nextTrack(userInitiated = true) {
  const q = Player.queue; if (!q.length) return;
  let next = Player.index + 1;
  if (next >= q.length) next = 0;
  Player.index = next;
  playItem(q[next], Player.source);
}

function prevTrack() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const q = Player.queue; if (!q.length) return;
  let prev = Player.index - 1;
  if (prev < 0) prev = q.length - 1;
  Player.index = prev;
  playItem(q[prev], Player.source);
}

function openFullPlayer() {
  if (!Player.track) return;
  const el = $('#full');
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
  renderFpTabBody();
}

function closeFullPlayer() {
  const el = $('#full');
  if (!el.classList.contains('show')) return;
  el.classList.remove('show');
  el.setAttribute('aria-hidden', 'true');
}

function renderFpNow(body) {
  const t = Player.track;
  if (!t) {
    body.innerHTML = `<div class="fp-lyrics-empty"><i class="bi bi-music-note"></i>Nothing playing</div>`;
    return;
  }
  const art = getArtwork(t, 600) || t.artworkUrl || '';
  const liked = isLiked(t.trackId);

  body.innerHTML = `
    <div class="fp-body">
      ${art
      ? `<img id="fpArt" class="fp-art" src="${esc(art)}" alt="" decoding="async">`
      : `<div id="fpArt" class="fp-art fp-art-ph"><i class="bi bi-music-note"></i></div>`}
      <div class="fp-meta">
        <div class="fp-title">${esc(t.trackName || 'Track')}</div>
        <div class="fp-artist">${esc(t.artistName || '')}</div>
      </div>
      <div class="fp-controls">
        <button class="icon-btn lg" onclick="prevTrack()" aria-label="Previous"><i class="bi bi-skip-start-fill"></i></button>
        <button class="fp-play" onclick="togglePlay()" aria-label="Play/pause">
          <i id="fpPlayIcon" class="bi ${Player.playing ? 'bi-pause-fill' : 'bi-play-fill'}"></i>
        </button>
        <button class="icon-btn lg" onclick="nextTrack()" aria-label="Next"><i class="bi bi-skip-end-fill"></i></button>
      </div>
    </div>`;
}

function renderFpQueue(body) {
  const q = Player.queue;
  if (!q.length) {
    body.innerHTML = `<div class="fp-lyrics-empty"><i class="bi bi-music-note-list"></i>Queue is empty</div>`;
    return;
  }
  body.innerHTML = q.map((tr, i) => `
    <div class="q-row ${i === Player.index ? 'active' : ''}" onclick="playItem(Player.queue[${i}])">
      <div class="flex-grow-1 min-w-0">
        <div class="row-title text-truncate">${esc(tr.trackName || 'Track')}</div>
        <div class="row-sub text-truncate">${esc(tr.artistName || '')}</div>
      </div>
    </div>`).join('');
}

function renderFpLyrics(body) {
  body.innerHTML = `<div class="fp-lyrics-empty"><i class="bi bi-music-note-list"></i>No lyrics available.</div>`;
}

async function playIds(csv) {
  const ids = String(csv || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return;
  toast('Loading…');
  const items = [];
  for (const id of ids) {
    let it = getCached('track', id);
    if (!it) {
      try {
        const r = await apiLookup(id, 'song');
        it = r.find(x => itemType(x) === 'track') || r[0];
        if (it) cacheItems([it]);
      } catch { }
    }
    if (it) items.push(it);
  }
  if (items.length) {
    Player.queue = items;
    Player.index = 0;
    playItem(items[0]);
  }
}

/* ══════════════════════════════════════════════════════════════
   LIBRARY VIEWS
   ══════════════════════════════════════════════════════════════ */
function libraryTabs(active) {
  const activeDl = DL.active().length + DL.ready().length;
  const followed = getFollowed().length;
  const item = (key, label, badge) => `<a href="#/library/${key}" data-link class="${active === key ? 'active' : ''}">
    ${label}${badge !== undefined ? `<span class="seg-badge ${badge > 0 ? 'on' : ''}">${badge}</span>` : ''}
  </a>`;
  return `<div class="seg">
    ${item('likes', 'Liked')}
    ${item('following', 'Following', followed)}
    ${item('playlists', 'Lists')}
    ${item('downloads', 'Offline', activeDl)}
  </div>`;
}

function viewLikes() {
  const likes = getLikes();
  let html = libraryTabs('likes');
  if (!likes.length) {
    html += emptyState('heart', 'No liked songs yet', 'Tap the heart on any track to save it here.');
  } else {
    const items = likes.map(l => ({
      wrapperType: 'track', trackId: l.trackId, trackName: l.trackName,
      artistName: l.artistName, collectionName: l.collectionName,
      attachments: { artworkUrls: l.artworkUrl ? [{ url: l.artworkUrl }] : [] }
    }));
    _pageTracks = items;
    html += items.map(t => trackRow(t)).join('');
  }
  MAIN().innerHTML = html;
}

function viewFollowing() {
  const list = getFollowed();
  let html = libraryTabs('following');
  if (!list.length) {
    html += emptyState('person-check', 'Not following any artists');
  } else {
    html += list.map(a => `
      <div class="row-item">
        <a class="row-info" href="#/artist/${esc(a.artistId)}" data-link>
          <div class="min-w-0 flex-grow-1">
            <div class="row-title text-truncate">${esc(a.artistName || 'Artist')}</div>
          </div>
        </a>
      </div>`).join('');
  }
  MAIN().innerHTML = html;
}

function viewPlaylists() {
  const pls = getPlaylists();
  let html = libraryTabs('playlists');
  html += `<div class="d-flex align-items-center px-3 pt-4 pb-2">
    <div class="flex-grow-1 fw-bold">Your playlists</div>
    <button class="pill-btn primary" onclick="newPlaylistPrompt()"><i class="bi bi-plus-lg"></i> New</button>
  </div>`;
  if (!pls.length) {
    html += emptyState('music-note-list', 'No playlists yet');
  } else {
    html += pls.map(pl => `
      <a class="row-item" href="#/library/playlists/${esc(pl.id)}" data-link>
        <div class="row-info">
          <div class="min-w-0 flex-grow-1">
            <div class="row-title text-truncate">${esc(pl.name)}</div>
            <div class="row-sub text-truncate">${pl.tracks.length} tracks</div>
          </div>
        </div>
      </a>`).join('');
  }
  MAIN().innerHTML = html;
}

function renderPlaylistDetail(plId) {
  const pl = getPlaylists().find(p => p.id === plId);
  if (!pl) { MAIN().innerHTML = emptyState('music-note-list', 'Playlist not found'); return; }
  let html = `<div class="pb-4">`;
  html += backBtn('#/library/playlists');
  html += `<div class="px-3 pt-1">
    <div style="font-size:1.35rem;font-weight:800">${esc(pl.name)}</div>
  </div>`;
  html += pl.tracks.map(l => trackRow({
    wrapperType: 'track', trackId: l.trackId, trackName: l.trackName, artistName: l.artistName
  })).join('');
  html += `</div>`;
  MAIN().innerHTML = html;
}

function renderDownloads() {
  MAIN().innerHTML = libraryTabs('downloads') + `<div id="dlContent"><div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div></div>`;
  updateDlLists();
}

async function updateDlLists() {
  const wrap = $('#dlContent'); if (!wrap) return;
  const all = await cacheAll();
  let html = '';
  if (!all.length) {
    html = emptyState('download', 'Nothing offline yet');
  } else {
    html = all.map(e => `
      <div class="dl-row">
        <button class="row-play" onclick="playCachedById('${esc(e.trackId)}')"><i class="bi bi-play-fill"></i></button>
        <div class="dl-body">
          <div class="dl-title text-truncate">${esc(e.meta?.name || e.trackId)}</div>
          <div class="dl-sub text-truncate">${esc(e.meta?.artist || '')} · ${fmtSize(e.size || 0)}</div>
        </div>
        <button class="icon-btn sm text-danger" onclick="removeCached('${esc(e.trackId)}')" aria-label="Remove"><i class="bi bi-trash3"></i></button>
      </div>`).join('');
  }
  wrap.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS SHEET & ACTIONS
   ══════════════════════════════════════════════════════════════ */
function openSettings() { sheet('#sheetSettings').show(); updateSettingsSheet(); }
async function updateSettingsSheet() {
  const s = getSettings();
  $$('#setTheme button').forEach(b => b.classList.toggle('on', b.dataset.val === s.theme));
  $$('#setAccent button').forEach(b => b.classList.toggle('on', b.dataset.val === (s.accent || 'purple')));
  const an = $('#setAnimations'); if (an) an.checked = !!s.animations;
  const eq = $('#setEq'); if (eq) eq.value = s.eqPreset || 'flat';
  const rate = $('#setRate');
  if (rate) {
    rate.value = Math.round((Number(s.playbackRate) || 1) * 100);
    rate.style.setProperty('--p', Math.round(((rate.value - 50) / 150) * 100) + '%');
  }
  const rv = $('#setRateVal'); if (rv) rv.textContent = (Number(s.playbackRate) || 1).toFixed(2) + 'x';
}

$('#setTheme')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-val]'); if (!b) return;
  setSetting('theme', b.dataset.val); updateSettingsSheet();
});
$('#setAccent')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-val]'); if (!b) return;
  setSetting('accent', b.dataset.val); updateSettingsSheet();
});
$('#setAnimations')?.addEventListener('change', e => setSetting('animations', e.target.checked));
$('#setEq')?.addEventListener('change', e => setSetting('eqPreset', e.target.value));
$('#setRate')?.addEventListener('input', e => {
  const v = Number(e.target.value) / 100;
  setSetting('playbackRate', v);
  const rv = $('#setRateVal'); if (rv) rv.textContent = v.toFixed(2) + 'x';
  audio.playbackRate = v;
});

async function clearAllCache() {
  await cacheClear();
  cachedIds.clear();
  toast('Offline cache cleared');
  updateSettingsSheet();
  if (isLibraryDlRoute()) renderDownloads();
}

async function resetAppData() {
  Object.values(KEY).forEach(k => ls.remove(k));
  try { await cacheClear(); } catch { }
  cachedIds.clear();
  toast('All data reset');
  sheet('#sheetSettings').hide();
  applySettings();
  go('#/');
}

let _pageTracks = [];

async function startCrawl(trackId, btn) {
  let it = getCached('track', trackId);
  if (!it) {
    try {
      const r = await apiLookup(trackId, 'song');
      it = r.find(x => itemType(x) === 'track') || r[0];
      if (it) cacheItems([it]);
    } catch { }
  }
  if (!it) { toast('Track unavailable', 'danger'); return; }
  await DL.add(it);
}

async function crawlAll(type, id, btn) {
  try {
    const body = {};
    if (type === 'track') body.trackId = cleanId(id);
    else if (type === 'collection') body.albumId = cleanId(id);
    else if (type === 'artist') body.artistId = cleanId(id);
    await apiQueueAdd(body);
    toast('Crawl request queued');
  } catch (e) {
    toast('Crawl failed: ' + e.message, 'danger');
  }
}

async function removeCached(id) {
  await cacheDel(id);
  cachedIds.delete(String(id));
  toast('Removed from offline');
  if (isLibraryDlRoute()) renderDownloads();
}

function openTrackMenu(trackId) {
  const it = getCached('track', trackId);
  if (!it) return;
  const liked = isLiked(trackId);
  $('#sheetTrackBody').innerHTML = `
    <div class="px-3 py-2 fw-bold">${esc(it.trackName || 'Track')}</div>
    <div class="px-2">
      <button class="sheet-item" onclick="closeAllSheets();playById('${esc(trackId)}')"><i class="bi bi-play-fill"></i>Play</button>
      <button class="sheet-item" onclick="closeAllSheets();toggleLikeById('${esc(trackId)}')"><i class="bi bi-heart"></i>${liked ? 'Unlike' : 'Like'}</button>
    </div>`;
  sheet('#sheetTrack').show();
}

/* ══════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════ */
(async function boot() {
  applySettings();
  DL.load();
  resumeDownloadPolling();
  DL.onChange(() => { updateDownloadBadges(); if (isLibraryDlRoute()) updateDlLists(); });
  updateDownloadBadges();
  try { await refreshCacheIndex(); } catch (e) { }
  await route();
})();

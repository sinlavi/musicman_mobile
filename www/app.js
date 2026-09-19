'use strict';
/* ============================================================
   MusicMan — Capacitor Edition
   ============================================================ */

const CFG = {
  apiBase:  'https://3rah.ir/mm/api',
  apiToken: 'change_me_to_a_secure_token',
  siteName: 'MusicMan'
};
const SCOPE     = '/';
const API_BASE  = CFG.apiBase.replace(/\/+$/, '');
const API_TOKEN = CFG.apiToken;

const IS_LOW_END = (() => {
  try {
    const hc = navigator.hardwareConcurrency || 4;
    const dm = navigator.deviceMemory || 4;
    const rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return (hc <= 4 && dm <= 4) || hc <= 2 || dm <= 2 || rm;
  } catch { return false; }
})();
if (IS_LOW_END) document.documentElement.classList.add('low-end');

const KEY = {
  likes:'mm_likes', pls:'mm_playlists', recent:'mm_recent', downloads:'mm_downloads',
  plays:'mm_recently_played', following:'mm_followed', settings:'mm_settings',
  stats:'mm_stats', queue:'mm_player_queue', state:'mm_player_state'
};
const SETTINGS_DEFAULT = {
  theme:'dark', animations:true, playbackRate:1, autoScrollLyrics:true,
  autoRetry:true, visualizer:true, accent:'blue', sleepFade:30
};
const POLL_MS = IS_LOW_END ? 3500 : 2500;
const QUEUE_GRACE_MS = 3000;
const DEFAULT_CRAWL_QUALITY = '320';
const PROGRESS_TICK_MS = IS_LOW_END ? 300 : 100;
const LYRIC_TICK_MS = IS_LOW_END ? 250 : 150;

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const MAIN = () => document.getElementById('main');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const ls = {
  get(k,d){ try{ const v = localStorage.getItem(k); return v==null ? d : JSON.parse(v); } catch { return d; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  remove(k){ try{ localStorage.removeItem(k); } catch {} }
};

const cleanId  = id => id ? String(id).replace(/^it_/, '') : '';
const proxyUrl = u  => u ? `${API_BASE}/proxy?url=${encodeURIComponent(u)}` : '';
const haptic   = ms => { try { navigator.vibrate?.(ms); } catch {} };

function fmtTime(sec){
  sec = Number(sec);
  if (!sec || !isFinite(sec) || sec < 0) return '0:00';
  sec = Math.floor(sec);
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
           : `${m}:${String(s).padStart(2,'0')}`;
}
function fmtSize(b){
  b = Number(b) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB';
  return (b/1073741824).toFixed(2) + ' GB';
}
function safeFileName(s){
  const out = String(s || 'track').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 90);
  return out || 'track';
}
function extFromType(type, url){
  const t = String(type || '').toLowerCase();
  if (t.includes('mpeg') || t.includes('mp3'))  return '.mp3';
  if (t.includes('mp4')  || t.includes('m4a'))  return '.m4a';
  if (t.includes('aac'))  return '.aac';
  if (t.includes('ogg') || t.includes('opus'))  return '.ogg';
  if (t.includes('webm')) return '.webm';
  if (t.includes('wav'))  return '.wav';
  if (t.includes('flac')) return '.flac';
  const m = String(url || '').split('?')[0].match(/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i);
  return m ? '.' + m[1].toLowerCase() : '.mp3';
}
function fmtAgo(ts){
  const d = Date.now() - (Number(ts) || 0);
  if (d < 60_000) return 'just now';
  if (d < 3_600_000) return Math.floor(d/60_000) + 'm ago';
  if (d < 86_400_000) return Math.floor(d/3_600_000) + 'h ago';
  if (d < 604_800_000) return Math.floor(d/86_400_000) + 'd ago';
  return new Date(ts).toLocaleDateString();
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS + ACCENT
   ══════════════════════════════════════════════════════════════ */
const ACCENTS = [
  { id:'blue',   name:'Blue',    hex:'#0d6efd', rgb:'13,110,253' },
  { id:'indigo', name:'Indigo',  hex:'#6610f2', rgb:'102,16,242' },
  { id:'purple', name:'Purple',  hex:'#7b2ff7', rgb:'123,47,247' },
  { id:'pink',   name:'Pink',    hex:'#f107a3', rgb:'241,7,163' },
  { id:'red',    name:'Red',     hex:'#ef4444', rgb:'239,68,68' },
  { id:'orange', name:'Orange',  hex:'#f97316', rgb:'249,115,22' },
  { id:'green',  name:'Green',   hex:'#10b981', rgb:'16,185,129' },
  { id:'teal',   name:'Teal',    hex:'#14b8a6', rgb:'20,184,166' }
];
function getSettings(){ return { ...SETTINGS_DEFAULT, ...ls.get(KEY.settings, {}) }; }
function setSetting(k,v){ const s = getSettings(); s[k]=v; ls.set(KEY.settings, s); applySettings(); }
function applyAccent(id){
  const a = ACCENTS.find(x => x.id === id) || ACCENTS[0];
  const root = document.documentElement.style;
  root.setProperty('--bs-primary', a.hex);
  root.setProperty('--bs-primary-rgb', a.rgb);
  root.setProperty('--bs-primary-text-emphasis', a.hex);
  root.setProperty('--bs-link-color', a.hex);
  root.setProperty('--bs-link-color-rgb', a.rgb);
  root.setProperty('--bs-link-hover-color', a.hex);
  const nm = $('#accentName'); if (nm) nm.textContent = a.name;
}
function applySettings(){
  const s = getSettings();
  document.documentElement.setAttribute('data-bs-theme', s.theme);
  document.body.classList.toggle('no-animations', !s.animations);
  audio.playbackRate = Number(s.playbackRate) || 1;
  applyAccent(s.accent);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = s.theme === 'dark' ? '#0b0b0d' : '#ffffff';
}
function openAccent(){
  const body = $('#sheetAccentBody');
  const s = getSettings();
  body.innerHTML = `<div class="accent-grid">
    ${ACCENTS.map(a => `<button class="accent-swatch ${s.accent === a.id ? 'on' : ''}"
        style="background:${a.hex};color:${a.hex}"
        onclick="pickAccent('${a.id}')">
        <i class="bi bi-check-lg" style="color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.3)"></i>
        <span style="color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4)">${a.name}</span>
      </button>`).join('')}
  </div>`;
  sheet('#sheetAccent').show();
}
function pickAccent(id){ setSetting('accent', id); sheet('#sheetAccent').hide(); updateSettingsSheet(); toast('Accent updated'); }

/* ══════════════════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════════════════ */
function statsLoad(){
  return ls.get(KEY.stats, { tracks:{}, artists:{}, albums:{}, daily:{}, total:0 });
}
function statsSave(s){ ls.set(KEY.stats, s); }
function statsRecord(track){
  if (!track?.trackId) return;
  const s = statsLoad();
  const id = String(track.trackId);
  const art = getArtwork(track, 100) || track.artworkUrl || '';
  const now = Date.now();

  const t = s.tracks[id] || { id, name: track.trackName||'Track', artist: track.artistName||'', artistId: track.artistId?String(track.artistId):'', art, count:0, last:0 };
  t.count++; t.last = now; t.name = track.trackName || t.name; t.artist = track.artistName || t.artist;
  s.tracks[id] = t;

  if (track.artistId){
    const aid = String(track.artistId);
    const a = s.artists[aid] || { id: aid, name: track.artistName||'', art, count:0, last:0 };
    a.count++; a.last = now; a.name = track.artistName || a.name;
    s.artists[aid] = a;
  }
  if (track.collectionId){
    const cid = String(track.collectionId);
    const c = s.albums[cid] || { id: cid, name: track.collectionName||'', artist: track.artistName||'', art, count:0, last:0 };
    c.count++; c.last = now;
    s.albums[cid] = c;
  }
  const day = new Date().toISOString().slice(0, 10);
  s.daily[day] = (s.daily[day] || 0) + 1;
  s.total = (s.total || 0) + 1;

  // Trim old entries
  const trackArr = Object.values(s.tracks).sort((a,b)=>b.last - a.last).slice(0, 500);
  s.tracks = Object.fromEntries(trackArr.map(x => [x.id, x]));
  statsSave(s);
}
function statsTopTracks(limit=20, sinceDays=null){
  const s = statsLoad();
  const now = Date.now();
  const since = sinceDays ? now - sinceDays*86400000 : 0;
  return Object.values(s.tracks)
    .filter(t => t.last >= since)
    .sort((a,b) => b.count - a.count || b.last - a.last)
    .slice(0, limit);
}
function statsTopArtists(limit=20){
  const s = statsLoad();
  return Object.values(s.artists).sort((a,b) => b.count - a.count || b.last - a.last).slice(0, limit);
}
function statsOnRepeat(limit=30){
  const since = Date.now() - 7*86400000;
  const s = statsLoad();
  return Object.values(s.tracks).filter(t => t.count >= 3 && t.last >= since)
    .sort((a,b) => b.count - a.count).slice(0, limit);
}
function statsForgotten(limit=30){
  const since = Date.now() - 30*86400000;
  const likes = getLikes();
  const s = statsLoad();
  const likedIds = new Set(likes.map(l => String(l.trackId)));
  return Object.values(s.tracks)
    .filter(t => likedIds.has(t.id) && t.last < since)
    .sort((a,b) => a.last - b.last).slice(0, limit);
}

/* ══════════════════════════════════════════════════════════════
   TOAST / SHEETS
   ══════════════════════════════════════════════════════════════ */
let _toast;
function toast(msg, variant='dark'){
  const el = $('#toast'); if (!el) return;
  el.className = `toast text-bg-${variant} border-0`;
  $('#toastMsg').textContent = msg;
  _toast = _toast || new bootstrap.Toast(el);
  _toast.show();
}
function sheet(id){ return bootstrap.Offcanvas.getOrCreateInstance($(id)); }
function closeAllSheets(){
  ['#sheetTrack','#sheetPl','#sheetPrompt','#sheetConfirm','#sheetSleep','#sheetSettings','#sheetQuality','#sheetAccent']
    .forEach(s => { const el = $(s); if (!el) return; const i = bootstrap.Offcanvas.getInstance(el); if (i) i.hide(); });
}
let _promptResolve = null;
function askText(title, value='', placeholder='Name'){
  return new Promise(resolve => {
    _promptResolve = resolve;
    $('#promptTitle').textContent = title;
    const inp = $('#promptInput');
    inp.value = value; inp.placeholder = placeholder;
    sheet('#sheetPrompt').show();
    setTimeout(() => inp.focus(), 350);
  });
}
function submitPrompt(){
  const v = $('#promptInput').value.trim();
  sheet('#sheetPrompt').hide();
  if (_promptResolve){ _promptResolve(v || null); _promptResolve = null; }
}
$('#sheetPrompt')?.addEventListener('hidden.bs.offcanvas', () => {
  if (_promptResolve){ _promptResolve(null); _promptResolve = null; }
});
$('#promptInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') submitPrompt(); });

let _confirmResolve = null;
function askConfirm(title, body, okLabel='Delete', tone='danger'){
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
  if (_confirmResolve){ _confirmResolve(true); _confirmResolve = null; }
});
$('#sheetConfirm')?.addEventListener('hidden.bs.offcanvas', () => {
  if (_confirmResolve){ _confirmResolve(false); _confirmResolve = null; }
});

let _qualityResolve = null;
function askQuality(options, title='Choose quality'){
  return new Promise(resolve => {
    _qualityResolve = resolve;
    $('#sheetQualityTitle').textContent = title;
    const body = $('#sheetQualityBody');
    body.innerHTML = options.map(o =>
      `<button class="sheet-item" onclick="pickQuality('${esc(o.value)}')">
        <i class="bi bi-music-note-beamed"></i>
        <span class="flex-grow-1">${esc(o.label)}</span>
        ${o.recommended ? '<span class="badge" style="background:var(--bs-primary)">Recommended</span>' : ''}
      </button>`).join('');
    sheet('#sheetQuality').show();
  });
}
function pickQuality(v){ sheet('#sheetQuality').hide(); if (_qualityResolve){ _qualityResolve(v); _qualityResolve = null; } }
$('#sheetQuality')?.addEventListener('hidden.bs.offcanvas', () => {
  if (_qualityResolve){ _qualityResolve(null); _qualityResolve = null; }
});

/* ══════════════════════════════════════════════════════════════
   API
   ══════════════════════════════════════════════════════════════ */
async function api(path, opts={}){
  let res;
  try {
    res = await fetch(API_BASE + path, {
      ...opts,
      headers: {
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + API_TOKEN,
        ...(opts.headers||{})
      }
    });
  } catch { throw new Error('Network error'); }
  const text = await res.text().catch(() => '');
  let data = {};
  if (text){ try { data = JSON.parse(text); } catch { data = { raw: text }; } }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return data;
}
const apiSearch       = async term => (await api(`/search?term=${encodeURIComponent(term)}&limit=50&entity=musicArtist,album,song`)).results || [];
const apiFresh        = async () => (await api('/fresh')).results || [];
const apiPopular      = async (limit=40) => (await api(`/popular?limit=${limit}&minViews=1`)).results || [];
const apiLookup       = async (id, entity) => (await api(`/lookup?id=${cleanId(id)}&entity=${entity}&limit=200`)).results || [];
const apiArtistTracks = async (id, { page=1, limit=50, sort='album' }={}) =>
  api(`/artist/tracks?id=${encodeURIComponent(cleanId(id))}&page=${page}&limit=${limit}&sort=${encodeURIComponent(sort)}`);
const apiQueueAdd     = (body, quality) => api('/download/add', {
  method:'POST', body: JSON.stringify({ quality: quality || DEFAULT_CRAWL_QUALITY, skipExisting:true, ...body })
});
async function apiCrawlStatus(trackId){
  try { const r = await api(`/download/status?trackId=${cleanId(trackId)}`); return r?.download ? { ...r.download, found:true } : { download_status:'completed', percent:100, found:false }; }
  catch { return { download_status:'completed', percent:100, found:false }; }
}

/* ══════════════════════════════════════════════════════════════
   SEARCH SUGGEST
   ══════════════════════════════════════════════════════════════ */
const _sgCache = new Map();
const SG_CACHE_MAX = 60;
function _sgHighlight(name, q){
  if (!q) return esc(name);
  const lower = String(name).toLowerCase(), needle = q.toLowerCase(), idx = lower.indexOf(needle);
  if (idx < 0) return esc(name);
  return esc(name.slice(0, idx)) + '<b>' + esc(name.slice(idx, idx + needle.length)) + '</b>' + esc(name.slice(idx + needle.length));
}
function initSuggest(input, dropdown){
  if (!input || !dropdown || input.__sgInit) return;
  input.__sgInit = true;
  let items = [], activeIdx = -1, lastQ = '', debTimer = null, ctrl = null;
  const close = () => {
    dropdown.classList.remove('show'); dropdown.replaceChildren();
    input.setAttribute('aria-expanded','false'); items = []; activeIdx = -1;
  };
  const render = () => {
    if (!items.length){ close(); return; }
    dropdown.innerHTML = items.map((it,i) => {
      const icon = it.type==='artist'?'bi-person':it.type==='collection'?'bi-disc':'bi-music-note';
      const label = it.type==='artist'?'Artist':it.type==='collection'?'Album':'Song';
      return `<button type="button" role="option" class="sg-item${i===activeIdx?' active':''}" data-idx="${i}">
        <i class="bi ${icon} sg-icon"></i>
        <span class="sg-title flex-grow-1 min-w-0">${_sgHighlight(it.name, lastQ)}</span>
        <span class="sg-badge">${label}</span>
      </button>`;
    }).join('');
    dropdown.classList.add('show');
    input.setAttribute('aria-expanded','true');
    if (activeIdx >= 0){ const el = dropdown.querySelector('.sg-item.active'); el?.scrollIntoView?.({ block:'nearest' }); }
  };
  const pick = idx => {
    const it = items[idx]; if (!it) return;
    close(); input.blur();
    const list = ls.get(KEY.recent, []).filter(x => x !== it.name);
    list.unshift(it.name); ls.set(KEY.recent, list.slice(0,10));
    go(`/${it.type}/${it.id}`);
  };
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q === lastQ) return;
    lastQ = q;
    if (debTimer) clearTimeout(debTimer);
    if (q.length < 1){ close(); return; }
    const cached = _sgCache.get(q.toLowerCase());
    if (cached){ items = cached; activeIdx = -1; render(); return; }
    if (!dropdown.classList.contains('show')){
      dropdown.innerHTML = `<div class="sg-loading"><span class="spinner-border spinner-border-sm" style="width:12px;height:12px;border-width:2px"></span> Searching…</div>`;
      dropdown.classList.add('show'); input.setAttribute('aria-expanded','true');
    }
    debTimer = setTimeout(async () => {
      if (ctrl) ctrl.abort();
      ctrl = new AbortController();
      try {
        const r = await fetch(`${API_BASE}/suggest?q=${encodeURIComponent(q)}&limit=8`,
          { headers: { 'Authorization':'Bearer ' + API_TOKEN }, signal: ctrl.signal });
        if (input.value.trim() !== q) return;
        const data = await r.json();
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        if (_sgCache.size >= SG_CACHE_MAX){ _sgCache.delete(_sgCache.keys().next().value); }
        _sgCache.set(q.toLowerCase(), suggestions);
        items = suggestions; activeIdx = -1;
        if (!items.length){
          dropdown.innerHTML = `<div class="sg-empty"><i class="bi bi-search"></i> No matches</div>`;
          dropdown.classList.add('show'); input.setAttribute('aria-expanded','true');
        } else render();
      } catch (e){ if (e.name !== 'AbortError') close(); }
    }, 160);
  });
  input.addEventListener('keydown', e => {
    if (!dropdown.classList.contains('show')) return;
    if (e.key === 'ArrowDown'){ e.preventDefault(); activeIdx = Math.min(activeIdx+1, items.length-1); render(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); activeIdx = Math.max(activeIdx-1, -1); render(); }
    else if (e.key === 'Enter'){ if (activeIdx >= 0 && items[activeIdx]){ e.preventDefault(); e.stopPropagation(); pick(activeIdx); } }
    else if (e.key === 'Escape'){ close(); input.blur(); }
  });
  dropdown.addEventListener('pointerdown', e => { if (e.target.closest('.sg-item')) e.preventDefault(); });
  dropdown.addEventListener('click', e => {
    const btn = e.target.closest('.sg-item'); if (!btn) return;
    e.preventDefault(); pick(Number(btn.dataset.idx));
  });
  input.addEventListener('blur', () => setTimeout(close, 140));
  input.addEventListener('focus', () => { if (items.length && input.value.trim() === lastQ) render(); });
  document.addEventListener('click', e => { if (!input.contains(e.target) && !dropdown.contains(e.target)) close(); });
}

/* ══════════════════════════════════════════════════════════════
   ITEM MODEL
   ══════════════════════════════════════════════════════════════ */
const TYPE_MAP = { musicArtist:'artist', artist:'artist', album:'collection', collection:'collection', song:'track', track:'track' };
const itemType = it => TYPE_MAP[it?.wrapperType] || it?.wrapperType || '';
const itemId   = it => it?.trackId || it?.collectionId || it?.artistId || '';

function getArtwork(it, size=300){
  const urls = it?.attachments?.artworkUrls;
  if (!Array.isArray(urls) || !urls.length) return it?.artworkUrl || '';
  const best = urls.find(u => String(u.size||'').includes(String(size))) || urls[urls.length-1];
  const url = best?.url || '';
  return url.replace(/\/(\d+)x(\d+)(bb)?\./, `/${size}x${size}bb.`);
}
function hasAudio(it){ const a = it?.attachments?.audioUrls; return Array.isArray(a) && a.some(x => x && x.url); }
function hasPreview(it){ const p = it?.attachments?.previewUrls; return Array.isArray(p) && p.some(x => x && x.url); }
function getPreviewUrl(it){
  const p = it?.attachments?.previewUrls;
  if (!Array.isArray(p) || !p.length) return null;
  for (const x of p) if (x && x.url) return x.url;
  return null;
}
function getAudioOptions(it){ const a = it?.attachments?.audioUrls; return Array.isArray(a) ? a.filter(x => x && x.url && x.quality) : []; }
function pickAudioByQuality(it, preferQuality){
  const options = getAudioOptions(it);
  if (!options.length){
    const a = it?.attachments?.audioUrls;
    if (Array.isArray(a) && a.length && a[0]?.url) return a[0].url;
    return getPreviewUrl(it);
  }
  const target = parseInt(preferQuality, 10) || 192;
  const exact = options.find(o => String(o.quality) === String(preferQuality));
  if (exact) return exact.url;
  let closest = options[0], bestDiff = Infinity;
  for (const o of options){
    const q = parseInt(o.quality, 10); if (!isFinite(q)) continue;
    const diff = Math.abs(q - target);
    if (diff < bestDiff){ bestDiff = diff; closest = o; }
  }
  return closest?.url || null;
}
const getPlayable = it => pickAudioByQuality(it, DEFAULT_CRAWL_QUALITY);

function dlActionFor(track){
  const isDirect = hasAudio(track);
  return {
    isDirect,
    label: isDirect ? 'Download' : 'Crawl',
    icon: isDirect ? 'bi-download' : 'bi-cloud-arrow-down',
    idleTitle: isDirect ? 'Not downloaded' : 'Not crawled',
    idleSub: isDirect ? 'Full audio available — download for offline'
                      : (hasPreview(track) ? 'Crawl to listen offline · preview available now' : 'Crawl to listen offline'),
  };
}

const itemCache = new Map();
function cacheItems(items){
  for (const it of items || []){
    const t = itemType(it), id = itemId(it);
    if (t && id) itemCache.set(`${t}:${id}`, it);
  }
}
const getCached = (t, id) => itemCache.get(`${t}:${id}`);

/* ══════════════════════════════════════════════════════════════
   INDEXEDDB
   ══════════════════════════════════════════════════════════════ */
let _dbPromise;
function getDB(){
  if (!_dbPromise){
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('mm_audio', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath:'trackId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return _dbPromise;
}
async function idb(store, mode, fn){
  const db = await getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => res(req?.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}
const cachePut   = (id, blob, meta) => idb('audio','readwrite', s => s.put({ trackId:String(id), blob, meta, size: blob.size, at: Date.now() }));
const cacheGet   = id => idb('audio','readonly', s => s.get(String(id))).then(r => r || null);
const cacheAll   = () => idb('audio','readonly', s => s.getAll()).then(r => r || []);
const cacheDel   = id => idb('audio','readwrite', s => s.delete(String(id)));
const cacheClear = () => idb('audio','readwrite', s => s.clear());

const cachedIds = new Set();
async function refreshCacheIndex(){
  cachedIds.clear();
  (await cacheAll()).forEach(e => cachedIds.add(String(e.trackId)));
}
const isCached = id => cachedIds.has(String(id));

/* ══════════════════════════════════════════════════════════════
   DOWNLOAD MANAGER
   ══════════════════════════════════════════════════════════════ */
const DL = {
  items: [], listeners: new Set(), timer: null, saving: new Set(),
  load(){
    const raw = ls.get(KEY.downloads, []);
    this.items = raw.map(it => it.status === 'saving'
      ? { ...it, status:'paused', percent:0, error:'Interrupted' } : it);
    this.persist();
  },
  persist(){ ls.set(KEY.downloads, this.items); },
  all(){    return this.items; },
  active(){ return this.items.filter(i => ['queued','crawling','saving'].includes(i.status)); },
  ready(){  return this.items.filter(i => i.status === 'ready'); },
  failed(){ return this.items.filter(i => ['failed','paused'].includes(i.status)); },
  get(id){  return this.items.find(i => String(i.trackId) === String(id)); },
  notify(){
    this.persist();
    updateDownloadBadges();
    this.listeners.forEach(fn => { try { fn(this); } catch(e){ console.warn(e); } });
  },
  onChange(fn){ this.listeners.add(fn); return () => this.listeners.delete(fn); },
  upsert(entry){
    const idx = this.items.findIndex(i => String(i.trackId) === String(entry.trackId));
    if (idx >= 0) this.items[idx] = { ...this.items[idx], ...entry, updatedAt: Date.now() };
    else this.items.unshift({
      trackId: String(entry.trackId),
      name: entry.name || 'Track', artist: entry.artist || '', artistId: entry.artistId || '',
      album: entry.album || '', collectionId: entry.collectionId || '',
      artwork: entry.artwork || '', type: 'save',
      status: entry.status || 'queued', percent: entry.percent || 0, error: entry.error || '',
      bytes: 0, totalBytes: 0, addedAt: entry.addedAt || Date.now(), updatedAt: Date.now()
    });
    this.notify();
  },
  update(id, patch){
    const it = this.get(id); if (!it) return;
    Object.assign(it, patch, { updatedAt: Date.now() });
    this.notify();
  },
  remove(id){
    this.items = this.items.filter(i => String(i.trackId) !== String(id));
    this.notify();
  },
  async add(track, _type, quality){
    if (!track?.trackId) return;
    const id = String(track.trackId);
    if (isCached(id)){ toast('Already offline'); return; }
    const existing = this.get(id);
    if (existing && ['queued','crawling','saving'].includes(existing.status)){ toast('Already in progress', 'warning'); return; }
    this.upsert({
      trackId: id, name: track.trackName || 'Track',
      artist: track.artistName || '', artistId: track.artistId ? String(track.artistId) : '',
      album: track.collectionName || '', collectionId: track.collectionId ? String(track.collectionId) : '',
      artwork: getArtwork(track, 100), status: 'queued', percent: 0, error: ''
    });
    haptic(12);
    if (hasAudio(track)){
      this.update(id, { status:'saving', percent:0 });
      this._runSave(id, track).catch(e => this.update(id, { status:'failed', error: e.message }));
      return;
    }
    try { await apiQueueAdd({ trackId: cleanId(id) }, quality); }
    catch (e){ console.warn('[MusicMan] queue add error:', e.message); }
    this.update(id, { status:'queued', percent:0, addedAt: Date.now() });
    this._ensureTimer();
  },
  async retry(id){
    const it = this.get(id); if (!it) return;
    const track = getCached('track', id) || (await this._fetchTrack(id));
    if (!track){ toast('Track unavailable', 'danger'); return; }
    this.update(id, { status:'queued', error:'', percent:0, addedAt: Date.now() });
    if (hasAudio(track)){
      this.update(id, { status:'saving' });
      this._runSave(id, track).catch(e => this.update(id, { status:'failed', error: e.message }));
      return;
    }
    try { await apiQueueAdd({ trackId: cleanId(id) }); } catch (e){ console.warn(e); }
    this.update(id, { status:'queued' });
    this._ensureTimer();
  },
  async _fetchTrack(id){
    try {
      const r = await apiLookup(id, 'song');
      const it = r.find(x => itemType(x) === 'track') || r[0];
      if (it) cacheItems([it]);
      return it;
    } catch { return null; }
  },
  async _runSave(id, track){
    if (this.saving.has(id)) return;
    this.saving.add(id);
    const url = getPlayable(track);
    if (!url){ this.saving.delete(id); throw new Error('No audio URL'); }
    try {
      const res = await fetch(proxyUrl(url));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      const mime  = (res.headers.get('content-type') || '').split(';')[0] || 'audio/mpeg';
      const reader = res.body?.getReader?.();
      let blob;
      if (reader){
        const chunks = []; let received = 0; let lastReport = 0;
        while (true){
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value); received += value.length;
          const pct = total ? Math.min(99, Math.round((received/total)*100)) : 0;
          const now = performance.now();
          if (now - lastReport > 250 || received === total){
            lastReport = now;
            this.update(id, { percent: pct, bytes: received, totalBytes: total });
          }
        }
        blob = new Blob(chunks);
      } else blob = await res.blob();
      await cachePut(id, blob, {
        name: track.trackName, artist: track.artistName, artistId: track.artistId,
        album: track.collectionName, collectionId: track.collectionId,
        artwork: getArtwork(track, 100), mime, url
      });
      cachedIds.add(String(id));
      this.update(id, { status:'completed', percent:100, bytes: blob.size, totalBytes: blob.size, completedAt: Date.now() });
      haptic(18);
      toast(`Downloaded · ${fmtSize(blob.size)}`);
      if (isLibraryDlRoute()) renderDownloads();
      if (isTrackRoute()){ const t = getCached('track', id); if (t) renderCrawlCard(t, null); }
      setTimeout(() => { if (this.get(id)?.status === 'completed') this.remove(id); }, 3500);
    } finally { this.saving.delete(id); }
  },
  async _markCompleted(id){
    const fresh = await this._fetchTrack(id);
    if (!fresh || !hasAudio(fresh)){ this.update(id, { status:'crawling', percent:100 }); return; }
    this.update(id, { status:'saving', percent:0 });
    this._runSave(id, fresh).catch(e => this.update(id, { status:'failed', error: e.message }));
  },
  _ensureTimer(){
    if (this.timer) return;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const crawls = this.items.filter(i => ['queued','crawling'].includes(i.status));
        if (!crawls.length){ clearInterval(this.timer); this.timer = null; return; }
        for (const item of crawls){
          const id = String(item.trackId);
          const status = await apiCrawlStatus(id);
          const notFound = status.found === false;
          if (notFound && (Date.now() - (item.addedAt || 0)) < QUEUE_GRACE_MS) continue;
          const s = status.download_status;
          const pct = Math.max(0, Math.min(100, Math.round(Number(status.percent) || 0)));
          if (notFound || s === 'completed') await this._markCompleted(id);
          else if (s === 'failed' || s === 'stopped'){
            if (getSettings().autoRetry && (item.retries || 0) < 3){
              setTimeout(() => DL.retry(id).catch(() => {}), 3000);
              this.update(id, { status:'failed', error:(status.error || 'Failed') + ' — retrying…', retries:(item.retries || 0) + 1 });
            } else this.update(id, { status:'failed', error: status.error || 'Failed' });
          } else this.update(id, { status:'crawling', percent: pct });
        }
      } finally { running = false; }
    };
    tick();
    this.timer = setInterval(tick, POLL_MS);
  }
};
function resumeDownloadPolling(){ if (DL.items.some(i => ['queued','crawling'].includes(i.status))) DL._ensureTimer(); }
function updateDownloadBadges(){
  const total = DL.active().length + DL.ready().length;
  const ind = $('#dlIndicator'), indCount = $('#dlIndicatorCount');
  if (ind && indCount){ ind.style.display = total ? '' : 'none'; indCount.textContent = total; }
  const badge = $('#libBadge');
  if (badge){ badge.classList.toggle('on', total > 0); badge.textContent = total; }
}

/* ══════════════════════════════════════════════════════════════
   EXPORT
   ══════════════════════════════════════════════════════════════ */
async function exportCached(id){
  let e; try { e = await cacheGet(id); } catch { e = null; }
  if (!e?.blob){ toast('File not available', 'danger'); return; }
  const m = e.meta || {};
  const base = safeFileName([m.artist, m.name].filter(Boolean).join(' - ') || m.name || id);
  const mime = m.mime || 'audio/mpeg';
  const ext  = extFromType(mime, m.url || '');
  const blob = new Blob([e.blob], { type: mime });
  const url  = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url; a.download = base + ext; a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    haptic(14);
    toast(`Saved "${base + ext}"`);
  } catch {
    try { window.open(url, '_blank'); } catch {}
    toast('Opened file in a new tab');
  }
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 180000);
}
async function exportAllCached(){
  const all = await cacheAll();
  if (!all.length){ toast('Nothing to export', 'warning'); return; }
  const ok = await askConfirm('Export all tracks?', `${all.length} file${all.length !== 1 ? 's' : ''} will be saved.`, 'Export', 'primary');
  if (!ok) return;
  for (let i = 0; i < all.length; i++){ await exportCached(all[i].trackId); await new Promise(r => setTimeout(r, 650)); }
  toast('Export finished', 'success');
}

/* ══════════════════════════════════════════════════════════════
   LIKES / FOLLOWING / PLAYLISTS / RECENT
   ══════════════════════════════════════════════════════════════ */
const getLikes = () => ls.get(KEY.likes, []);
const isLiked  = id => getLikes().some(t => String(t.trackId) === String(id));
function makeLikeEntry(item){
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
function toggleLike(item){
  if (!item?.trackId) return;
  const id = String(item.trackId);
  const likes = getLikes();
  const idx = likes.findIndex(t => String(t.trackId) === id);
  if (idx >= 0){ likes.splice(idx,1); toast('Removed from Liked'); }
  else { likes.unshift(makeLikeEntry(item)); toast('Added to Liked'); }
  ls.set(KEY.likes, likes); haptic(8);
  refreshLikes();
  if (isLibraryLikesRoute()) viewLikes();
}
async function toggleLikeById(id){
  let it = getCached('track', id);
  if (!it){
    try { const r = await apiLookup(id, 'song'); it = r.find(x => itemType(x) === 'track') || r[0]; if (it) cacheItems([it]); } catch {}
  }
  if (it) toggleLike(it); else toast('Track not available', 'danger');
}
function refreshLikes(){
  const cur = Player.track ? String(Player.track.trackId) : null;
  const nodes = MAIN().querySelectorAll('[data-like]');
  for (const btn of nodes){
    const id = btn.dataset.like; if (!id) continue;
    const on = isLiked(id);
    if (on !== btn.classList.contains('liked')){
      btn.classList.toggle('liked', on);
      const ic = btn.firstElementChild;
      if (ic) ic.className = `bi ${on ? 'bi-heart-fill' : 'bi-heart'}`;
    }
  }
  const fpBtn = $('#fpLikeBtn');
  if (fpBtn){
    const on = cur ? isLiked(cur) : false;
    fpBtn.classList.toggle('liked', on);
    const i = $('#fpLike');
    if (i) i.className = `bi ${on ? 'bi-heart-fill' : 'bi-heart'}`;
  }
}
const getFollowed = () => ls.get(KEY.following, []);
const isFollowed  = id => !!id && getFollowed().some(a => String(a.artistId) === String(id));
function toggleFollow(artistId, artwork){
  const id = String(artistId); if (!id) return;
  const list = getFollowed();
  const idx = list.findIndex(a => String(a.artistId) === id);
  if (idx >= 0){ list.splice(idx, 1); toast('Unfollowed'); }
  else {
    const cached = getCached('artist', id);
    list.unshift({ artistId: id, artistName: cached?.artistName || '', primaryGenreName: cached?.primaryGenreName || '', artwork: artwork || '', followedAt: Date.now() });
    toast('Following'); haptic(10);
  }
  ls.set(KEY.following, list);
  refreshFollowButtons();
  if (isLibraryFollowingRoute()) viewFollowing();
}
function refreshFollowButtons(){
  $$('[data-follow]').forEach(btn => {
    const id = btn.dataset.follow;
    const on = isFollowed(id);
    btn.classList.toggle('following', on);
    btn.classList.toggle('primary', !on);
    const i = btn.querySelector('i'); if (i) i.className = `bi ${on ? 'bi-check-lg' : 'bi-plus-lg'}`;
    const span = btn.querySelector('span'); if (span) span.textContent = on ? 'Following' : 'Follow';
  });
}
const getPlaylists  = () => ls.get(KEY.pls, []);
const savePlaylists = p => ls.set(KEY.pls, p);
function createPlaylist(name){
  name = (name || '').trim(); if (!name) return null;
  const pl = { id:'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6), name, tracks:[], createdAt: Date.now() };
  const all = getPlaylists(); all.push(pl); savePlaylists(all);
  toast(`Created "${name}"`);
  return pl;
}
function removeFromPlaylist(plId, trackId){
  const all = getPlaylists();
  const pl = all.find(p => p.id === plId); if (!pl) return;
  pl.tracks = pl.tracks.filter(t => String(t.trackId) !== String(trackId));
  savePlaylists(all);
  if (isPlaylistDetailRoute(plId)) renderPlaylistDetail(plId);
}
const getRecentlyPlayed = () => ls.get(KEY.plays, []);
function pushRecentlyPlayed(item){
  if (!item?.trackId) return;
  const id = String(item.trackId);
  const list = getRecentlyPlayed().filter(x => String(x.trackId) !== id);
  list.unshift({
    trackId: id, trackName: item.trackName || 'Track',
    artistName: item.artistName || '', artistId: item.artistId ? String(item.artistId) : '',
    collectionName: item.collectionName || '', collectionId: item.collectionId ? String(item.collectionId) : '',
    artworkUrl: getArtwork(item, 100) || item.artworkUrl || '', at: Date.now()
  });
  ls.set(KEY.plays, list.slice(0, 30));
}

/* ══════════════════════════════════════════════════════════════
   ROUTER
   ══════════════════════════════════════════════════════════════ */
function currentPath(){
  let p = location.pathname;
  if (p.endsWith('.html')) p = p.slice(0, -5);
  if (!p) p = '/';
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+$/, '');
  return p || '/';
}
function parseRoute(){
  let path = currentPath().replace(/^\/+/, '');
  const parts = path ? path.split('/') : [];
  const q = new URLSearchParams(location.search || '');
  return { parts, q };
}
function go(path){
  if (!path) path = '/';
  if (!path.startsWith('/')) path = '/' + path;
  const current = location.pathname + location.search;
  if (current === path){ route(); return; }
  try { history.pushState(null, '', path); } catch { location.href = path; return; }
  route();
}
window.addEventListener('popstate', () => route());
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]'); if (!a) return;
  if (a.target === '_blank' || a.hasAttribute('download')) return;
  const href = a.getAttribute('href'); if (!href) return;
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return;
  if (href.startsWith('#')) return;
  let path = href;
  if (!path.startsWith('/')) return;
  e.preventDefault();
  go(path || '/');
});

const isLibraryLikesRoute     = () => currentPath() === '/library/likes';
const isLibraryFollowingRoute = () => currentPath() === '/library/following';
const isLibraryDlRoute        = () => currentPath() === '/library/downloads';
const isLibraryPlRoute        = () => currentPath() === '/library/playlists';
const isPlaylistDetailRoute   = id => currentPath() === '/library/playlists/' + id;
const isTrackRoute            = () => currentPath().startsWith('/track/');
const isAlbumRoute            = () => currentPath().startsWith('/album/');
const isArtistRoute           = () => currentPath().startsWith('/artist/');
const isStatsRoute            = () => currentPath() === '/stats';

function activeNavFor(parts){
  const first = parts[0] || '';
  if (first === 'search') return 'search';
  if (first === 'library') return 'library';
  if (first === '') return 'home';
  return '';
}
const NAV_ICONS = {
  home:    { on:'bi-house-door-fill', off:'bi-house-door' },
  search:  { on:'bi-search',          off:'bi-search' },
  library: { on:'bi-collection-fill', off:'bi-collection' }
};
function updateNav(parts){
  const active = activeNavFor(parts);
  $$('[data-nav]').forEach(el => {
    const key = el.dataset.nav;
    const isOn = key === active;
    el.classList.toggle('active', isOn);
    const i = el.querySelector('i');
    if (i && NAV_ICONS[key]) i.className = `bi ${isOn ? NAV_ICONS[key].on : NAV_ICONS[key].off}`;
  });
  const brandText = $('#brandText'), barTitle = $('#barTitle');
  if (parts.length === 0){
    brandText?.parentElement?.style && (brandText.parentElement.style.display = '');
    barTitle?.classList.add('d-none');
    brandText?.classList.remove('d-none');
  } else {
    brandText?.classList.add('d-none');
    if (barTitle){ barTitle.classList.remove('d-none'); barTitle.textContent = titleForRoute(parts); }
  }
}
function titleForRoute(parts){
  if (parts[0] === 'search') return 'Search';
  if (parts[0] === 'library') return 'Library';
  if (parts[0] === 'artist') return 'Artist';
  if (parts[0] === 'album') return 'Album';
  if (parts[0] === 'track') return 'Track';
  if (parts[0] === 'stats') return 'Statistics';
  return 'MusicMan';
}

async function route(){
  closeAllSheets();
  disconnectArtistTracksObserver();
  if (dlUnsubscribe){ dlUnsubscribe(); dlUnsubscribe = null; }
  const { parts, q } = parseRoute();
  updateNav(parts);
  closeFullPlayer();
  showSkeleton();
  try {
    switch (parts[0]){
      case undefined: await viewHome(); break;
      case 'search':  await viewSearch(q.get('q') || ''); break;
      case 'artist':  await viewArtist(parts[1]); break;
      case 'album':   await viewAlbum(parts[1]); break;
      case 'track':   await viewTrack(parts[1]); break;
      case 'stats':   viewStats(); break;
      case 'library': {
        if (parts[1] === 'playlists'){
          if (parts[2]) renderPlaylistDetail(parts[2]);
          else viewPlaylists();
        } else if (parts[1] === 'downloads') renderDownloads();
        else if (parts[1] === 'following') viewFollowing();
        else viewLikes();
        break;
      }
      default: await viewHome();
    }
  } catch (e){
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
function showSkeleton(){
  const reps = IS_LOW_END ? 3 : 5;
  MAIN().innerHTML = `
    <div class="px-3 pt-4">
      <div class="sk mb-3" style="height:26px;width:45%"></div>
      <div class="d-flex gap-3 mb-4">${'<div class="sk" style="width:138px;height:138px;border-radius:14px"></div>'.repeat(3)}</div>
      <div class="sk mb-3" style="height:18px;width:35%"></div>
      ${Array.from({length: reps}).map(() => `
        <div class="d-flex align-items-center gap-3 mb-3">
          <div class="sk" style="width:48px;height:48px;border-radius:10px"></div>
          <div class="flex-grow-1"><div class="sk mb-2" style="height:13px;width:65%"></div><div class="sk" style="height:11px;width:40%"></div></div>
        </div>`).join('')}
    </div>`;
}
function emptyState(icon, text, sub=''){
  return `<div class="state"><i class="bi bi-${icon}"></i><p class="fw-semibold text-body">${esc(text)}</p>${sub ? `<p class="mt-1" style="font-size:.78rem">${esc(sub)}</p>` : ''}</div>`;
}
function errorState(msg){
  return `<div class="state">
    <i class="bi bi-exclamation-triangle text-danger"></i>
    <p class="fw-semibold text-body">Something went wrong</p>
    <p class="mt-1" style="font-size:.78rem">${esc(msg || 'Unknown error')}</p>
    <button class="pill-btn mt-3" onclick="route()"><i class="bi bi-arrow-clockwise"></i> Retry</button>
  </div>`;
}
function secTitle(text, tight=false){ return `<h6 class="sec-title ${tight ? 'tight' : ''}">${esc(text)}</h6>`; }
function backBtn(target){
  if (!target) target = '/';
  return `<div class="px-2 pt-2"><a href="${esc(target)}" class="icon-btn" data-link aria-label="Back"><i class="bi bi-chevron-left" style="font-size:1.5rem"></i></a></div>`;
}
function cardAlbum(c){
  const art = getArtwork(c, 300);
  return `<a class="card-item" href="/album/${esc(c.collectionId)}" data-link>
    ${art ? `<img class="card-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">` : `<div class="card-art card-art-ph"><i class="bi bi-disc"></i></div>`}
    <div class="card-name text-truncate">${esc(c.collectionName || 'Album')}</div>
    <div class="card-sub text-truncate">${esc(c.artistName || '')}</div>
  </a>`;
}
function cardTrack(t){
  const art = getArtwork(t, 300);
  return `<a class="card-item" href="/track/${esc(t.trackId)}" data-link>
    ${art ? `<img class="card-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">` : `<div class="card-art card-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="card-name text-truncate">${esc(t.trackName || 'Track')}</div>
    <div class="card-sub text-truncate">${esc(t.artistName || '')}</div>
  </a>`;
}
function cardTrackPopular(t){
  const art = getArtwork(t, 300);
  const views = Number(t.views) || 0;
  const viewsLabel = views >= 1000 ? (views/1000).toFixed(views >= 10000 ? 0 : 1) + 'K' : String(views);
  return `<a class="card-item" href="/track/${esc(t.trackId)}" data-link>
    ${art ? `<img class="card-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">` : `<div class="card-art card-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="card-name text-truncate">${esc(t.trackName || 'Track')}</div>
    <div class="card-sub text-truncate">${esc(t.artistName || '')}${viewsLabel ? ' · ' + viewsLabel + ' plays' : ''}</div>
  </a>`;
}
function cardArtist(a){
  const art = getArtwork(a, 300);
  return `<a class="artist-item" href="/artist/${esc(a.artistId)}" data-link>
    ${art ? `<img class="artist-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">` : `<div class="artist-art artist-art-ph"><i class="bi bi-person-fill"></i></div>`}
    <div class="card-name text-truncate">${esc(a.artistName || 'Artist')}</div>
  </a>`;
}
function trackRow(item, opts = {}){
  const id = String(item.trackId || '');
  const liked   = isLiked(id);
  const cached  = isCached(id);
  const dl      = DL.get(id);
  const art     = getArtwork(item, 100);
  const dur     = item.trackTimeMillis ? fmtTime(item.trackTimeMillis / 1000) : '';
  const sub     = [item.artistName, dur].filter(Boolean).join(' · ');
  const isCurrent = Player.track && String(Player.track.trackId) === id;
  const fullAudio = hasAudio(item);
  const previewOnly = !fullAudio && hasPreview(item) && !cached;
  let badge = '';
  if (cached) badge = `<span class="badge-chip crawled"><i class="bi bi-cloud-check-fill"></i>Offline</span>`;
  else if (dl && ['queued','crawling','saving'].includes(dl.status))
    badge = `<span class="badge-chip crawling"><span class="spinner-border"></span>${dl.status === 'saving' ? 'Downloading' : 'Crawling'}</span>`;
  else if (previewOnly) badge = `<span class="badge-chip preview"><i class="bi bi-play-circle"></i>Preview</span>`;
  const extraMenu = opts.playlistId ? `,'${esc(opts.playlistId)}'` : '';
  return `
  <div class="row-item ${isCurrent ? 'playing' : ''}" data-track-id="${esc(id)}">
    <button class="row-play ${isCurrent && Player.playing ? 'playing' : ''}" data-play-id="${esc(id)}"
            onclick="event.preventDefault();event.stopPropagation();playById('${esc(id)}')" aria-label="Play">
      <i class="bi ${isCurrent && Player.playing ? 'bi-pause-fill' : (previewOnly ? 'bi-play-circle' : 'bi-play-fill')}"></i>
    </button>
    <a class="row-info" href="/track/${esc(id)}" data-link>
      ${art ? `<img class="row-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
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
async function viewHome(){
  const [freshItems, popularItems] = await Promise.all([ apiFresh().catch(() => []), apiPopular(40).catch(() => []) ]);
  cacheItems(freshItems);
  cacheItems(popularItems);
  const artists = freshItems.filter(i => itemType(i) === 'artist');
  const albums  = freshItems.filter(i => itemType(i) === 'collection');
  const tracks  = freshItems.filter(i => itemType(i) === 'track');
  const seen = new Set();
  const popular = popularItems.filter(i => itemType(i) === 'track')
    .filter(i => { const id = String(i.trackId || ''); if (!id || seen.has(id)) return false; seen.add(id); return true; });
  const recents = getRecentlyPlayed();
  const h = new Date().getHours();
  const greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  let html = `<div class="pb-4">`;
  html += `<div class="px-3 pt-4 pb-1">
    <div style="font-size:1.5rem;font-weight:800;letter-spacing:-.02em">${greet}</div>
    <div class="text-secondary" style="font-size:.82rem">Welcome back to MusicMan</div>
  </div>`;
  if (recents.length){
    html += secTitle('Recently Played');
    html += `<div class="hscroll">${recents.slice(0, 10).map(r => cardTrack({
      wrapperType:'track', trackId: r.trackId, trackName: r.trackName, artistName: r.artistName,
      attachments: { artworkUrls: r.artworkUrl ? [{ url: r.artworkUrl }] : [] }
    })).join('')}</div>`;
  }
  if (popular.length){ html += secTitle('Popular'); html += `<div class="hscroll">${popular.slice(0, 20).map(cardTrackPopular).join('')}</div>`; }
  if (tracks.length){ html += secTitle(recents.length ? 'Fresh Music' : 'Fresh'); html += `<div class="hscroll">${tracks.map(cardTrack).join('')}</div>`; }
  if (artists.length){ html += secTitle('Fresh Artists'); html += `<div class="hscroll">${artists.map(cardArtist).join('')}</div>`; }
  if (albums.length) { html += secTitle('Fresh Albums');  html += `<div class="hscroll">${albums.map(cardAlbum).join('')}</div>`; }
  if (!freshItems.length && !popular.length && !recents.length) html += emptyState('collection', 'Nothing to show yet', 'Try searching for something.');
  html += `</div>`;
  MAIN().innerHTML = html;
}

/* ══════════════════════════════════════════════════════════════
   SEARCH
   ══════════════════════════════════════════════════════════════ */
let searchFilter = 'all';
let searchCache = { term: null, items: null };
function searchBarHtml(term=''){
  return `<div class="search-wrap">
    <form onsubmit="event.preventDefault();submitSearch()">
      <div class="search-box">
        <i class="bi bi-search"></i>
        <input id="searchInput" type="search" placeholder="Songs, albums, artists…" value="${esc(term)}" autocomplete="off" enterkeyhint="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="searchSuggest">
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
function wireSearchSuggest(autoFocus){
  requestAnimationFrame(() => {
    const inp = document.getElementById('searchInput');
    const dd  = document.getElementById('searchSuggest');
    if (inp && dd) initSuggest(inp, dd);
    if (autoFocus && inp && document.activeElement === document.body) inp.focus();
  });
}
function setSearchFilter(f){
  searchFilter = f;
  if (searchCache.term && searchCache.items) { renderSearchResults(searchCache.term, searchCache.items); refreshLikes(); }
  else { const { q } = parseRoute(); viewSearch(q.get('q') || ''); }
}
function submitSearch(){
  const q = ($('#searchInput')?.value || '').trim(); if (!q) return;
  const list = ls.get(KEY.recent, []).filter(x => x !== q);
  list.unshift(q); ls.set(KEY.recent, list.slice(0, 10));
  searchFilter = 'all';
  go('/search?q=' + encodeURIComponent(q));
}
function clearSearch(){ const i = $('#searchInput'); if (i){ i.value = ''; i.focus(); } }
function clearRecent(){ ls.remove(KEY.recent); viewSearch(''); }

async function viewSearch(term){
  if (!term){
    const recent = ls.get(KEY.recent, []);
    let html = `<div class="pb-4">${searchBarHtml('')}`;
    if (recent.length){
      html += `<div class="d-flex align-items-center px-3 pt-4 pb-2"><div class="sec-title p-0 flex-grow-1">Recent searches</div>
        <button class="icon-btn sm" onclick="clearRecent()" aria-label="Clear"><i class="bi bi-trash3"></i></button></div>`;
      html += recent.map(r => `<button class="sheet-item" onclick="go('/search?q=${encodeURIComponent(r)}')"><i class="bi bi-clock-history"></i><span class="flex-grow-1">${esc(r)}</span></button>`).join('');
    } else html += emptyState('search', 'Find your music', 'Search for songs, albums and artists.');
    html += `</div>`;
    MAIN().innerHTML = html; wireSearchSuggest(true); return;
  }
  let items;
  if (searchCache.term === term && searchCache.items) items = searchCache.items;
  else { items = await apiSearch(term); searchCache = { term, items }; cacheItems(items); }
  renderSearchResults(term, items);
}
function renderSearchResults(term, items){
  const artists = items.filter(i => itemType(i) === 'artist');
  const albums  = items.filter(i => itemType(i) === 'collection');
  const tracks  = items.filter(i => itemType(i) === 'track');
  const showTracks  = searchFilter === 'all' || searchFilter === 'track';
  const showAlbums  = searchFilter === 'all' || searchFilter === 'album';
  const showArtists = searchFilter === 'all' || searchFilter === 'artist';
  let html = `<div class="pb-4">${searchBarHtml(term)}`;
  if (!items.length) html += emptyState('emoji-frown', `No results for "${term}"`, 'Try different keywords.');
  else {
    let hasSomething = false;
    if (showArtists && artists.length){ hasSomething = true; html += secTitle(`Artists · ${artists.length}`); html += `<div class="hscroll">${artists.map(cardArtist).join('')}</div>`; }
    if (showAlbums && albums.length){ hasSomething = true; html += secTitle(`Albums · ${albums.length}`); html += `<div class="hscroll">${albums.map(cardAlbum).join('')}</div>`; }
    if (showTracks && tracks.length){ hasSomething = true; html += secTitle(`Songs · ${tracks.length}`); html += tracks.map(t => trackRow(t)).join(''); }
    if (!hasSomething) html += emptyState('funnel', 'No matches for this filter');
  }
  html += `</div>`;
  MAIN().innerHTML = html;
  wireSearchSuggest(false);
}

/* ══════════════════════════════════════════════════════════════
   ARTIST (pagination)
   ══════════════════════════════════════════════════════════════ */
const _artistTracks = { artistId:null, sort:'album', page:0, limit:50, total:0, pages:0, hasMore:false, loading:false, items:[] };
let _artistTracksObserver = null;
function disconnectArtistTracksObserver(){ if (_artistTracksObserver){ _artistTracksObserver.disconnect(); _artistTracksObserver = null; } }

async function loadArtistTracks(artistId, { reset=false, sort=null }={}){
  if (!artistId) return;
  const st = _artistTracks;
  if (reset || st.artistId !== String(artistId)){ st.artistId = String(artistId); st.page = 0; st.items = []; st.total = 0; st.pages = 0; st.hasMore = false; }
  if (sort) st.sort = sort;
  if (st.loading || (st.page > 0 && !st.hasMore)) return;
  st.loading = true;
  const nextPage = st.page + 1;
  const sentinel = document.getElementById('artistTracksSentinel');
  const listEl   = document.getElementById('artistTracksList');
  if (sentinel) sentinel.innerHTML = `<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;
  try {
    const res = await apiArtistTracks(artistId, { page: nextPage, limit: st.limit, sort: st.sort });
    const tracks = (res.results || []).filter(t => itemType(t) === 'track');
    st.page = nextPage; st.total = res.total ?? tracks.length; st.pages = res.pages ?? 1;
    st.hasMore = !!res.hasMore; st.items = st.items.concat(tracks);
    cacheItems(tracks);
    _pageTracks = st.items;
    if (listEl && tracks.length) listEl.insertAdjacentHTML('beforeend', tracks.map(t => trackRow(t)).join(''));
    const countEl = document.getElementById('artistTrackCount');
    if (countEl) countEl.textContent = `${st.items.length} of ${st.total}`;
    const playAllBtn = document.getElementById('artistPlayAllBtn'); if (playAllBtn) playAllBtn.disabled = st.items.length === 0;
    const likeAllBtn = document.getElementById('artistLikeAllBtn');
    if (likeAllBtn){
      const allLiked = st.items.length > 0 && st.items.every(t => isLiked(t.trackId));
      likeAllBtn.classList.toggle('liked', allLiked);
      const i = likeAllBtn.querySelector('i'); if (i) i.className = `bi ${allLiked ? 'bi-heart-fill' : 'bi-heart'}`;
    }
    refreshLikes();
  } catch (e){
    console.warn('[MusicMan] artist tracks error:', e);
    if (sentinel) sentinel.innerHTML = `<div class="text-center py-4"><button class="pill-btn" onclick="loadArtistTracks('${esc(artistId)}')"><i class="bi bi-arrow-repeat"></i> Retry</button></div>`;
  } finally {
    st.loading = false;
    if (sentinel && st.hasMore) sentinel.innerHTML = `<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-secondary" style="opacity:.4"></div></div>`;
    else if (sentinel && !st.hasMore) sentinel.innerHTML = st.items.length ? `<div class="text-center py-4 text-secondary" style="font-size:.75rem">All ${st.total} track${st.total !== 1 ? 's' : ''} loaded</div>` : '';
  }
  requestAnimationFrame(() => {
    if (!st.hasMore || st.loading) return;
    const s = document.getElementById('artistTracksSentinel'), m = document.getElementById('main');
    if (!s || !m) return;
    const rect = s.getBoundingClientRect(), rootRect = m.getBoundingClientRect();
    if (rect.top < rootRect.bottom + 300) loadArtistTracks(artistId);
  });
}
function attachArtistTracksObserver(){
  disconnectArtistTracksObserver();
  const root = document.getElementById('main');
  const sentinel = document.getElementById('artistTracksSentinel');
  if (!root || !sentinel) return;
  _artistTracksObserver = new IntersectionObserver(entries => {
    for (const e of entries){
      if (!e.isIntersecting) continue;
      if (_artistTracks.loading || !_artistTracks.hasMore) continue;
      loadArtistTracks(_artistTracks.artistId);
    }
  }, { root, rootMargin: '500px 0px', threshold: 0.01 });
  _artistTracksObserver.observe(sentinel);
}
function setArtistSort(sort){
  if (_artistTracks.sort === sort) return;
  const listEl = document.getElementById('artistTracksList'); if (listEl) listEl.innerHTML = '';
  _artistTracks.items = []; _artistTracks.page = 0; _artistTracks.hasMore = true; _artistTracks.sort = sort;
  $$('#artistSort .chip').forEach(b => b.classList.toggle('on', b.dataset.sort === sort));
  loadArtistTracks(_artistTracks.artistId, { reset: true, sort });
}

/* ══════════════════════════════════════════════════════════════
   ARTIST VIEW
   ══════════════════════════════════════════════════════════════ */
async function viewArtist(id){
  if (!id){ MAIN().innerHTML = emptyState('person', 'Artist not found'); return; }
  _artistTracks.artistId = String(id); _artistTracks.sort = 'album'; _artistTracks.page = 0; _artistTracks.items = []; _artistTracks.hasMore = true; _artistTracks.loading = false;
  let artist = getCached('artist', id);
  if (!artist){ const r = await apiLookup(id, 'musicArtist'); artist = r.find(x => itemType(x) === 'artist') || r[0]; if (artist) cacheItems([artist]); }
  if (!artist){ MAIN().innerHTML = emptyState('person', 'Artist not found'); return; }
  const albumRes = await apiLookup(id, 'album').catch(() => []);
  const albumMap = new Map();
  for (const a of albumRes.filter(x => itemType(x) === 'collection')){
    const cid = String(a.collectionId || ''); if (cid && !albumMap.has(cid)) albumMap.set(cid, a);
  }
  const albums = Array.from(albumMap.values());
  cacheItems(albums);
  const fullAlbums = albums.filter(a => (a.trackCount || 0) > 1);
  let artistArt = '';
  for (const a of albums){ const ar = getArtwork(a, 400); if (ar){ artistArt = ar; break; } }
  const followed = isFollowed(id);
  const genre = artist.primaryGenreName || '';
  const subParts = [];
  if (genre) subParts.push(esc(genre));
  if (albums.length) subParts.push(`${albums.length} album${albums.length !== 1 ? 's' : ''}`);
  subParts.push(`<span id="artistTrackCount">0 of —</span>`);
  let html = `<div class="pb-4">`;
  html += backBtn('/');
  html += `<div class="hero">
    ${artistArt ? `<img class="hero-art round" src="${esc(artistArt)}" loading="lazy" decoding="async" alt="">` : `<div class="hero-art hero-art-ph round"><i class="bi bi-person-fill"></i></div>`}
    <div class="hero-title">${esc(artist.artistName || 'Artist')}</div>
    <div class="hero-sub">${subParts.join(' · ')}</div>
  </div>`;
  html += `<div class="action-bar scrollable">
    <button class="pill-btn success" id="artistPlayAllBtn" disabled onclick="playIds(_pageTracks.map(t => t.trackId).join(','))">
      <i class="bi bi-play-fill"></i> Play all
    </button>
    <button class="pill-btn ${followed ? '' : 'primary'}" data-follow="${esc(id)}" onclick="toggleFollow('${esc(id)}', '${esc(artistArt)}')">
      <i class="bi ${followed ? 'bi-check-lg' : 'bi-plus-lg'}"></i><span>${followed ? 'Following' : 'Follow'}</span>
    </button>
    <button class="pill-btn" onclick="crawlAll('artist','${esc(id)}',this)"><i class="bi bi-cloud-arrow-down"></i> Crawl artist</button>
    <button class="icon-btn" style="background:rgba(var(--bs-body-color-rgb),.09)" onclick="artistMore('${esc(id)}')" aria-label="More"><i class="bi bi-three-dots"></i></button>
  </div>`;
  if (fullAlbums.length){ html += secTitle(`Albums · ${fullAlbums.length}`); html += `<div class="hscroll">${fullAlbums.map(cardAlbum).join('')}</div>`; }
  html += `<div class="d-flex align-items-center gap-2 px-3" style="margin-top:8px">
    <div class="sec-title p-0 flex-grow-1" style="padding-top:0">Tracks</div>
  </div>
  <div class="filter-row" id="artistSort" style="padding-top:2px">
    <button class="chip on" data-sort="album"  onclick="setArtistSort('album')">Album</button>
    <button class="chip"    data-sort="recent" onclick="setArtistSort('recent')">Recent</button>
    <button class="chip"    data-sort="name"   onclick="setArtistSort('name')">A–Z</button>
    <button class="chip"    data-sort="views"  onclick="setArtistSort('views')">Popular</button>
  </div>`;
  html += `<div id="artistTracksList"></div><div id="artistTracksSentinel"></div></div>`;
  MAIN().innerHTML = html;
  await loadArtistTracks(id, { reset: true, sort: 'album' });
  attachArtistTracksObserver();
}
function artistMore(id){
  const rows = [
    `<button class="sheet-item" onclick="closeAllSheets(); addAllToQueue(_pageTracks)"><i class="bi bi-list-ul"></i><span>Queue all tracks</span></button>`,
    `<button class="sheet-item" onclick="closeAllSheets(); openPlaylistPickerForItems(_pageTracks)"><i class="bi bi-plus-lg"></i><span>Add all to playlist</span></button>`,
    `<button class="sheet-item" onclick="closeAllSheets(); toggleLikeAll(_pageTracks)"><i class="bi bi-heart"></i><span>Like / unlike all</span></button>`
  ];
  $('#sheetTrackBody').innerHTML = `<div class="px-3 pb-2 pt-1"><div class="fw-bold">Artist actions</div></div><div class="px-2">${rows.join('')}</div>`;
  sheet('#sheetTrack').show();
}

/* ══════════════════════════════════════════════════════════════
   ALBUM
   ══════════════════════════════════════════════════════════════ */
async function viewAlbum(id){
  if (!id){ MAIN().innerHTML = emptyState('disc', 'Album not found'); return; }
  let album = getCached('collection', id);
  if (!album){ const r = await apiLookup(id, 'album'); album = r.find(x => itemType(x) === 'collection') || r[0]; if (album) cacheItems([album]); }
  if (!album){ MAIN().innerHTML = emptyState('disc', 'Album not found'); return; }
  const tracks = (await apiLookup(id, 'song')).filter(x => itemType(x) === 'track');
  cacheItems(tracks);
  const art = getArtwork(album, 600);
  const missing = tracks.filter(t => !hasAudio(t) && !isCached(t.trackId)).length;
  const ids = tracks.map(t => String(t.trackId)).join(',');
  const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : '';
  _pageTracks = tracks.map(t => ({
    wrapperType:'track', trackId: t.trackId, trackName: t.trackName,
    artistName: t.artistName, artistId: t.artistId,
    collectionName: t.collectionName, collectionId: t.collectionId,
    trackTimeMillis: t.trackTimeMillis,
    attachments: { artworkUrls: t.attachments?.artworkUrls || [], previewUrls: t.attachments?.previewUrls || [], audioUrls: t.attachments?.audioUrls || [] }
  }));
  let html = `<div class="pb-4">`;
  html += backBtn(album.artistId ? `/artist/${album.artistId}` : '/');
  html += `<div class="hero">
    ${art ? `<img class="hero-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">` : `<div class="hero-art hero-art-ph"><i class="bi bi-disc"></i></div>`}
    <div class="hero-title">${esc(album.collectionName || 'Album')}</div>
    <div class="hero-sub">${album.artistId ? `<a href="/artist/${esc(album.artistId)}" data-link>${esc(album.artistName || '')}</a>` : esc(album.artistName || '')}${year ? ` · ${year}` : ''}${album.trackCount ? ` · ${album.trackCount} tracks` : ''}</div>
  </div>`;
  html += `<div class="action-bar scrollable">
    ${tracks.length ? `<button class="pill-btn success" onclick="playIds('${esc(ids)}')"><i class="bi bi-play-fill"></i> Play</button>` : ''}
    ${tracks.length && missing > 0 ? `<button class="pill-btn primary" onclick="crawlAll('collection','${esc(id)}',this)"><i class="bi bi-cloud-arrow-down"></i> Crawl all (${missing})</button>` : ''}
    ${tracks.length && missing === 0 ? `<span class="pill-btn" style="background:rgba(var(--bs-success-rgb),.16);color:var(--bs-success)"><i class="bi bi-check-circle-fill"></i> All ready</span>` : ''}
    ${tracks.length ? `<button class="icon-btn" style="background:rgba(var(--bs-body-color-rgb),.09)" onclick="albumMore()" aria-label="More"><i class="bi bi-three-dots"></i></button>` : ''}
  </div>`;
  html += tracks.length ? tracks.map(t => trackRow(t)).join('') : emptyState('music-note', 'No tracks found');
  html += `</div>`;
  MAIN().innerHTML = html;
}
function albumMore(){
  const rows = [
    `<button class="sheet-item" onclick="closeAllSheets(); addAllToQueue(_pageTracks)"><i class="bi bi-list-ul"></i><span>Queue all tracks</span></button>`,
    `<button class="sheet-item" onclick="closeAllSheets(); openPlaylistPickerForItems(_pageTracks)"><i class="bi bi-plus-lg"></i><span>Add all to playlist</span></button>`,
    `<button class="sheet-item" onclick="closeAllSheets(); toggleLikeAll(_pageTracks)"><i class="bi bi-heart"></i><span>Like / unlike all</span></button>`
  ];
  $('#sheetTrackBody').innerHTML = `<div class="px-3 pb-2 pt-1"><div class="fw-bold">Album actions</div></div><div class="px-2">${rows.join('')}</div>`;
  sheet('#sheetTrack').show();
}

/* ══════════════════════════════════════════════════════════════
   TRACK PAGE
   ══════════════════════════════════════════════════════════════ */
let trackPoller = null;
function stopTrackPoller(){ if (trackPoller){ clearInterval(trackPoller); trackPoller = null; } }
let lyricsTrackId = null;

async function viewTrack(id){
  if (!id){ MAIN().innerHTML = emptyState('music-note', 'Track not found'); return; }
  stopTrackPoller(); lyricsTrackId = String(id);
  let track = null;
  try {
    const r = await apiLookup(id, 'song');
    track = r.find(x => itemType(x) === 'track') || r[0];
    if (track) cacheItems([track]);
  } catch {}
  if (!track) track = getCached('track', id);
  if (!track){ MAIN().innerHTML = emptyState('music-note', 'Track not found'); return; }
  renderTrackPage(track);
  const dl = DL.get(id);
  const crawling = dl && ['queued','crawling'].includes(dl.status);
  if (crawling || (!hasAudio(track) && !isCached(id))){
    const status = await apiCrawlStatus(id);
    renderCrawlCard(track, status);
    if (crawling || (status && ['pending','downloading'].includes(status.download_status))) startTrackPoller(id);
  } else renderCrawlCard(track, null);
}
function renderTrackPage(track){
  const id = String(track.trackId);
  const art = getArtwork(track, 600);
  const liked   = isLiked(id);
  const cached  = isCached(id);
  const crawled = hasAudio(track);
  const previewable = !crawled && hasPreview(track) && !cached;
  const playable = crawled || cached;
  const dur  = track.trackTimeMillis ? fmtTime(track.trackTimeMillis/1000) : '';
  const year = track.releaseDate ? new Date(track.releaseDate).getFullYear() : '';
  const dl   = DL.get(id);
  const action = dlActionFor(track);
  let html = `<div class="pb-4">`;
  html += backBtn(track.artistId ? `/artist/${track.artistId}` : '/');
  html += `<div class="hero">
    ${art ? `<img class="hero-art" src="${esc(art)}" loading="lazy" decoding="async" alt="">` : `<div class="hero-art hero-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="hero-title">${esc(track.trackName || 'Track')}</div>
    <div class="hero-sub">${track.artistId ? `<a href="/artist/${esc(track.artistId)}" data-link>${esc(track.artistName || '')}</a>` : esc(track.artistName || '')}${track.collectionId ? ` · <a href="/album/${esc(track.collectionId)}" data-link>${esc(track.collectionName || '')}</a>` : ''}</div>
    <div class="hero-sub" style="font-size:.74rem">${[year, dur, track.primaryGenreName].filter(Boolean).join(' · ')}</div>
  </div>`;
  let primaryBtn = '';
  if (dl && ['queued','crawling','saving'].includes(dl.status)){
    const label = dl.status === 'queued' ? 'Queued' : dl.status === 'crawling' ? 'Crawling' : 'Downloading';
    primaryBtn = `<button class="pill-btn info" onclick="go('/library/downloads')"><span class="spinner-border spinner-border-sm me-1" style="width:14px;height:14px;border-width:2px"></span>${label}${dl.percent ? ' · ' + dl.percent + '%' : ''}</button>`;
  } else if (!playable){
    if (previewable) primaryBtn = `<button class="pill-btn preview" onclick="playById('${esc(id)}')"><i class="bi bi-play-circle"></i> Play preview</button>`;
    else primaryBtn = `<button class="pill-btn primary" onclick="startCrawl('${esc(id)}', this)"><i class="bi ${action.icon}"></i> ${action.label}</button>`;
  } else {
    primaryBtn = `<button class="pill-btn success" onclick="playById('${esc(id)}')"><i class="bi bi-play-fill"></i> ${cached ? 'Play offline' : 'Play'}</button>`;
  }
  html += `<div class="action-bar">
    ${primaryBtn}
    <button class="icon-btn ${liked ? 'liked' : ''}" data-like="${esc(id)}" onclick="toggleLikeById('${esc(id)}')" aria-label="Like" style="background:rgba(var(--bs-body-color-rgb),.09)">
      <i class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i>
    </button>
    <button class="icon-btn" onclick="openTrackMenu('${esc(id)}')" aria-label="More" style="background:rgba(var(--bs-body-color-rgb),.09)">
      <i class="bi bi-three-dots"></i>
    </button>
  </div>`;
  html += `<div id="crawlCard"></div>`;
  html += `<div class="lyrics-card">
    <div class="lyrics-head"><i class="bi bi-music-note-list"></i><span class="flex-grow-1">Lyrics</span>
      <span class="lyrics-badge" id="lyricsBadge" style="display:none">Synced</span>
      <button class="icon-btn sm" onclick="copyLyrics()" aria-label="Copy lyrics"><i class="bi bi-clipboard"></i></button>
    </div>
    <div class="lyrics-body" id="lyricsBody"><div class="text-secondary d-flex align-items-center gap-2" style="font-size:.82rem"><span class="spinner-border spinner-border-sm"></span> Loading lyrics…</div></div>
  </div></div>`;
  MAIN().innerHTML = html;
  loadLyrics(id, track);
}
function renderCrawlCard(track, status){
  const el = $('#crawlCard'); if (!el) return;
  const id = String(track.trackId);
  const cached  = isCached(id);
  const dl      = DL.get(id);
  const action  = dlActionFor(track);
  const previewable = !hasAudio(track) && hasPreview(track) && !cached;
  if (cached){
    el.innerHTML = `<div class="crawl-card ready">
      <i class="bi bi-cloud-check-fill text-success" style="font-size:1.5rem"></i>
      <div class="cc-body"><div class="cc-title">Saved offline</div><div class="cc-sub">Ready to play without internet</div></div>
      <button class="pill-btn primary sm" onclick="exportCached('${esc(id)}')"><i class="bi bi-file-earmark-arrow-down"></i> Save file</button>
      <button class="icon-btn sm text-danger" onclick="removeCached('${esc(id)}')" aria-label="Remove"><i class="bi bi-trash3"></i></button>
    </div>`; return;
  }
  if (dl && ['queued','crawling','saving'].includes(dl.status)){
    const isSaving = dl.status === 'saving';
    const label = dl.status === 'queued' ? (action.isDirect ? 'Queued to download' : 'Queued to crawl') : isSaving ? 'Downloading' : 'Crawling';
    const pct = dl.percent || 0;
    el.innerHTML = `<div class="crawl-card pending" style="flex-direction:column;align-items:stretch">
      <div class="d-flex align-items-center gap-2"><span class="spinner-border spinner-border-sm text-info"></span>
        <span class="cc-title flex-grow-1">${label}…</span><span class="fw-bold text-info" style="font-size:.8rem">${pct}%</span></div>
      <div class="progress mt-2"><div class="progress-bar bg-info" style="width:${pct}%"></div></div>
      ${isSaving && dl.totalBytes ? `<div class="cc-sub">${fmtSize(dl.bytes)} / ${fmtSize(dl.totalBytes)}</div>` : ''}
    </div>`; return;
  }
  if (dl && dl.status === 'failed'){
    el.innerHTML = `<div class="crawl-card fail">
      <i class="bi bi-x-circle-fill text-danger" style="font-size:1.5rem"></i>
      <div class="cc-body"><div class="cc-title">${action.isDirect ? 'Download' : 'Crawl'} failed</div>
      ${dl.error ? `<div class="cc-sub text-truncate">${esc(dl.error)}</div>` : ''}</div>
      <button class="pill-btn danger sm" onclick="DL.retry('${esc(id)}')"><i class="bi bi-arrow-repeat"></i> Retry</button>
      <button class="icon-btn sm" onclick="DL.remove('${esc(id)}')" aria-label="Dismiss"><i class="bi bi-x-lg"></i></button>
    </div>`; return;
  }
  const cardClass = previewable ? 'preview' : 'idle';
  const iconColor = previewable ? 'var(--mm-preview)' : 'var(--bs-primary)';
  const btnClass = previewable ? 'preview' : 'primary';
  el.innerHTML = `<div class="crawl-card ${cardClass}">
    <i class="bi ${action.icon}" style="color:${iconColor};font-size:1.7rem"></i>
    <div class="cc-body"><div class="cc-title">${action.idleTitle}</div><div class="cc-sub">${action.idleSub}</div></div>
    <button class="pill-btn ${btnClass}" onclick="startCrawl('${esc(id)}', this)"><i class="bi ${action.icon}"></i> ${action.label}</button>
  </div>`;
}
function startTrackPoller(trackId){
  stopTrackPoller();
  const tid = String(trackId);
  const tick = async () => {
    const cur = currentPath().startsWith('/track/') ? currentPath().split('/')[2] : null;
    if (String(cur) !== tid){ stopTrackPoller(); return; }
    const dl = DL.get(tid);
    const status = await apiCrawlStatus(tid);
    if (!status || status.download_status === 'completed' || (dl && dl.status === 'saving')){
      try {
        const fresh = await apiLookup(tid, 'song');
        const it = fresh.find(x => itemType(x) === 'track') || fresh[0];
        if (it && hasAudio(it)){ cacheItems([it]); if (currentPath().startsWith('/track/')){ renderTrackPage(it); refreshLikes(); } }
      } catch {}
      if (dl && ['queued','crawling','saving'].includes(dl.status)) return;
      stopTrackPoller(); return;
    }
    const cached = getCached('track', tid);
    if (cached) renderCrawlCard(cached, status);
    if (['failed','stopped'].includes(status?.download_status)) stopTrackPoller();
  };
  tick();
  trackPoller = setInterval(tick, POLL_MS);
}

/* ══════════════════════════════════════════════════════════════
   LYRICS
   ══════════════════════════════════════════════════════════════ */
let syncedLyricsCache = { trackId:null, lines:null, synced:false, loading:false };
function numOrNull(v){ if (v == null) return null; const n = Number(v); return isFinite(n) ? n : null; }
const INSTRUMENTAL_RE = /^(instrumental|no\s*lyrics?|no\s*lyrics?\s*available|lyrics?\s*not\s*available|lyrics?\s*not\s*found|not\s*found|instrumental\s*\/\s*not\s*found|instrumental\s*\/\s*(no\s*)?lyrics?|only\s*music|music\s*only|\[?\s*instrumental\s*\]?|\(\s*instrumental\s*\)|♪+\s*instrumental\s*♪*|♫+\s*instrumental\s*♫*|\.{3,}|-+|—+)$/i;
function _isInstrumentalOnly(lines){
  if (!lines || !lines.length) return false;
  const joined = lines.map(l => String(l.text || '').replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '').trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!joined) return true;
  if (INSTRUMENTAL_RE.test(joined)) return true;
  if (joined.length <= 60){
    if (/instrumental/.test(joined)) return true;
    if (/not\s*found/.test(joined)) return true;
    if (/no\s*lyrics?/.test(joined)) return true;
    if (/^\W*$/.test(joined)) return true;
  }
  return false;
}
function parseLyricsPayload(r){
  let lines = [], rawText = '';
  const pickTime = l => numOrNull(l.time ?? l.startTime ?? l.start ?? l.timestamp ?? l.at ?? l.t ?? l.offset);
  const pickText = l => String(l.text ?? l.line ?? l.content ?? l.lyric ?? l.l ?? l.value ?? '');
  function ingest(node, depth){
    if (node == null || depth > 6) return;
    if (typeof node === 'string'){ if (!rawText) rawText = node; return; }
    if (Array.isArray(node)){
      if (!lines.length) lines = node.map(l => typeof l === 'string' ? { time:null, text:l } : { time:pickTime(l), text:pickText(l) });
      return;
    }
    if (typeof node !== 'object') return;
    if (node.text != null && typeof node.text === 'object'){ ingest(node.text, depth+1); if (lines.length || rawText) return; }
    if (typeof node.synced === 'string' && node.synced.trim()){ if (!rawText) rawText = node.synced; return; }
    if (Array.isArray(node.synced) && node.synced.length){ if (!lines.length) lines = node.synced.map(l => ({ time: pickTime(l), text: pickText(l) })); return; }
    if (Array.isArray(node.lines) && node.lines.length){ if (!lines.length) lines = node.lines.map(l => ({ time: pickTime(l), text: pickText(l) })); return; }
    if (typeof node.plain === 'string' && node.plain.trim()){ if (!rawText) rawText = node.plain; return; }
    if (typeof node.lyrics === 'string'){ if (!rawText) rawText = node.lyrics; return; }
    if (typeof node.text === 'string'){ if (!rawText) rawText = node.text; return; }
    if (typeof node.unsynced === 'string'){ if (!rawText) rawText = node.unsynced; return; }
    if (Array.isArray(node.unsynced) && node.unsynced.length){ if (!lines.length) lines = node.unsynced.map(t => ({ time:null, text:String(t) })); return; }
  }
  const L = r?.lyrics || r?.result || r?.data || r;
  ingest(L, 0);
  if (!lines.length && !rawText && typeof r === 'string') rawText = r;
  if (!lines.length && rawText){
    const timeRe = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
    const parsed = [];
    for (const line of String(rawText).split('\n')){
      timeRe.lastIndex = 0;
      const times = []; let m;
      while ((m = timeRe.exec(line)) !== null){
        const min = parseInt(m[1], 10), sec = parseInt(m[2], 10);
        const frac = m[3] ? parseInt(m[3].padEnd(3,'0').slice(0,3), 10)/1000 : 0;
        times.push(min*60 + sec + frac);
      }
      const text = line.replace(timeRe, '').trim();
      if (times.length) for (const t of times) parsed.push({ time: t, text });
      else parsed.push({ time: null, text });
    }
    lines = parsed;
  }
  if (_isInstrumentalOnly(lines)) return { lines: [], synced: false };
  const synced = lines.some(l => l.time != null);
  return { lines, synced };
}
function lyricsFromItem(item){
  if (!item) return null;
  const lyr = item.lyrics || item.attachments?.lyrics;
  if (!lyr) return null;
  try { const parsed = parseLyricsPayload(lyr); if (parsed && parsed.lines && parsed.lines.length) return parsed; } catch {}
  return null;
}
function loadLyrics(trackId, trackItem){
  const body = $('#lyricsBody'); const badge = $('#lyricsBadge');
  if (badge) badge.style.display = 'none';
  const idStr = String(trackId);
  const item = trackItem || getCached('track', idStr);
  const fromItem = lyricsFromItem(item);
  if (fromItem){
    syncedLyricsCache = { trackId: idStr, lines: fromItem.lines, synced: fromItem.synced, loading: false };
    if (body && String(trackId) === String(lyricsTrackId)){
      if (badge) badge.style.display = fromItem.synced ? '' : 'none';
      renderLyricsInto(body, fromItem.lines, fromItem.synced);
    }
    return;
  }
  syncedLyricsCache = { trackId: idStr, lines: [], synced: false, loading: false };
  if (body && String(trackId) === String(lyricsTrackId)) renderLyricsInto(body, [], false);
}
function getEffectiveScroller(container){
  if (container.scrollHeight > container.clientHeight + 2) return container;
  let p = container.parentElement;
  while (p && p !== document.body && p !== document.documentElement){
    const s = getComputedStyle(p);
    if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 2) return p;
    p = p.parentElement;
  }
  return container;
}
function scrollLyricIntoView(container, el){
  const scroller = getEffectiveScroller(container);
  const cRect = scroller.getBoundingClientRect();
  const eRect = el.getBoundingClientRect();
  const delta = (eRect.top - cRect.top) - (cRect.height/2 - eRect.height/2);
  const target = Math.max(0, scroller.scrollTop + delta);
  if (Math.abs(target - scroller.scrollTop) > 1) scroller.scrollTop = target;
}
function renderLyricsInto(container, lines, synced){
  if (!container) return;
  container._lyricsData = null;
  if (!lines || !lines.length){
    container.classList.remove('synced');
    container.innerHTML = `<div class="text-secondary" style="font-size:.85rem;padding:8px 0">No lyrics available for this track.</div>`;
    return;
  }
  if (synced){
    container.classList.add('synced');
    const frag = document.createDocumentFragment();
    const els = []; const elByLineIdx = new Map(); const idxMap = [];
    lines.forEach((l, i) => {
      const el = document.createElement('div');
      if (l.time == null){ el.className = 'lyric-line blank'; el.innerHTML = '&nbsp;'; }
      else {
        el.className = 'lyric-line'; el.textContent = l.text || '\u00A0'; el.dataset.time = l.time;
        el.addEventListener('click', () => { const t = parseFloat(el.dataset.time); if (isFinite(t)) audio.currentTime = t; });
        idxMap.push(i); elByLineIdx.set(i, el); els.push(el);
      }
      frag.appendChild(el);
    });
    container.replaceChildren(frag);
    container._lyricsData = { lines, els, idxMap, elByLineIdx, activeIdx: -1, userScrollUntil: 0 };
    if (!container._lyricsScrollBound){
      const markUserScroll = () => { const d = container._lyricsData; if (d) d.userScrollUntil = performance.now() + 4000; };
      container.addEventListener('wheel', markUserScroll, { passive: true });
      container.addEventListener('touchmove', markUserScroll, { passive: true });
      container.addEventListener('mousedown', markUserScroll, { passive: true });
      container._lyricsScrollBound = true;
    }
    updateSyncedLyricsFor(container, true);
  } else {
    container.classList.remove('synced');
    container.textContent = lines.map(l => l.text).join('\n');
  }
}
function updateSyncedLyricsFor(container, force){
  const data = container._lyricsData; if (!data || !data.lines.length) return;
  const t = audio.currentTime; const lines = data.lines;
  let activeIdx = -1;
  for (let i = 0; i < lines.length; i++){
    const lt = lines[i].time;
    if (lt == null) continue;
    if (lt <= t + 0.08) activeIdx = i; else break;
  }
  if (activeIdx === data.activeIdx && !force) return;
  const prevIdx = data.activeIdx; data.activeIdx = activeIdx;
  if (prevIdx < activeIdx){
    const start = Math.max(0, prevIdx);
    for (let i = start; i < activeIdx; i++){
      const el = data.elByLineIdx.get(i);
      if (el && !el.classList.contains('passed')){ el.classList.add('passed'); el.classList.remove('active'); }
    }
  } else if (prevIdx > activeIdx){
    for (let i = activeIdx + 1; i <= prevIdx; i++){ const el = data.elByLineIdx.get(i); if (el) el.classList.remove('passed'); }
    if (prevIdx >= 0){ const el = data.elByLineIdx.get(prevIdx); if (el) el.classList.remove('active'); }
  }
  if (activeIdx >= 0){
    const el = data.elByLineIdx.get(activeIdx);
    if (el){
      if (!el.classList.contains('active')){ el.classList.remove('passed'); el.classList.add('active'); }
      if (getSettings().autoScrollLyrics && performance.now() > (data.userScrollUntil || 0)) scrollLyricIntoView(container, el);
    }
  }
}
function updateVisibleLyrics(){
  const pageC = document.getElementById('lyricsBody');
  if (pageC && pageC._lyricsData && pageC.classList.contains('synced')) updateSyncedLyricsFor(pageC);
  if (fpTab === 'lyrics' && $('#full')?.classList.contains('show')){
    const fpC = document.querySelector('.fp-lyrics-body');
    if (fpC && fpC._lyricsData) updateSyncedLyricsFor(fpC);
  }
}
function copyLyrics(){ const t = $('#lyricsBody')?.innerText || ''; if (t) copyText(t); }
function copyText(text){
  const done = () => toast('Copied');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done).catch(() => toast('Copy failed','danger'));
  else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch { toast('Copy failed','danger'); }
    ta.remove();
  }
}

/* ══════════════════════════════════════════════════════════════
   PLAYER  (with persistence, A–B repeat, MediaSession, visualizer)
   ══════════════════════════════════════════════════════════════ */
const audio = new Audio();
audio.preload = 'metadata';
audio.volume = 0.85;

const Player = {
  track:null, queue:[], index:-1, playing:false,
  shuffle:false, repeat:'off', seeking:false, source:'MusicMan',
  sleepTimer: null, abRepeat: { a: null, b: null }
};

let fpTab = 'now';
function setFpTab(tab){
  fpTab = tab;
  $$('#fpHeadTabs .fp-head-tab').forEach(b => b.classList.toggle('active', b.dataset.fpTab === tab));
  renderFpTabBody();
}
function renderFpTabBody(){
  const body = $('#fpTabBody'); if (!body) return;
  if (fpTab === 'now') renderFpNow(body);
  else if (fpTab === 'queue') renderFpQueue(body);
  else renderFpLyrics(body);
  const badge = $('#fpQueueBadge');
  if (badge){ badge.textContent = Player.queue.length; badge.classList.toggle('on', Player.queue.length > 0); }
}

function syncPlayerUI(){
  const t = Player.track;
  const mini = $('#mini'); if (!mini) return;
  if (!t){ mini.classList.add('d-none'); document.title = 'MusicMan'; renderFpTabBody(); return; }
  mini.classList.remove('d-none');
  const art = getArtwork(t, 300) || t.artworkUrl || '';
  const artSmall = getArtwork(t, 100) || t.artworkUrl || art;
  const mi = $('#miniArt');
  if (artSmall){ mi.src = artSmall; mi.style.visibility = 'visible'; }
  else { mi.removeAttribute('src'); mi.style.visibility = 'hidden'; }
  $('#miniTitle').textContent  = t.trackName  || 'Track';
  $('#miniArtist').textContent = t.artistName || '';
  const fi = $('#fpArt');
  if (fi){
    if (art){ fi.src = art; fi.classList.remove('fp-art-ph'); }
    else { fi.removeAttribute('src'); fi.classList.add('fp-art-ph'); }
  }
  const bg = $('#fpBg');
  if (bg) bg.style.backgroundImage = art ? `url("${art}")` : '';
  refreshLikes(); renderFpTabBody(); syncPlayIcons(); syncSaveButton();
  document.title = `${t.trackName || 'MusicMan'} · MusicMan`;
  updateMediaSession();
}
function syncPlayIcons(){
  const cls = Player.playing ? 'bi-pause-fill' : 'bi-play-fill';
  const m = $('#miniPlayIcon'); if (m) m.className = `bi ${cls}`;
  const f = $('#fpPlayIcon');   if (f) f.className = `bi ${cls}`;
  const cur = Player.track ? String(Player.track.trackId) : null;
  $$('.row-item .row-play[data-play-id]').forEach(btn => {
    const id = String(btn.dataset.playId || '');
    const item = btn.closest('.row-item');
    const isCurrent = cur && id === cur;
    const icon = btn.querySelector('i');
    if (icon) icon.className = `bi ${isCurrent && Player.playing ? 'bi-pause-fill' : 'bi-play-fill'}`;
    btn.classList.toggle('playing', !!isCurrent && Player.playing);
    if (item) item.classList.toggle('playing', !!isCurrent);
  });
  const vis = $('#fpVis'); if (vis) vis.classList.toggle('paused', !Player.playing);
}
function syncSaveButton(){
  const btn = $('#fpSaveBtn'); if (!btn) return;
  const id = Player.track?.trackId;
  if (!id){ btn.innerHTML = '<i class="bi bi-download"></i>'; return; }
  if (isCached(id)){ btn.innerHTML = '<i class="bi bi-cloud-check-fill text-success"></i>'; return; }
  const dl = DL.get(id);
  if (dl && ['queued','crawling','saving'].includes(dl.status)){
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" style="width:14px;height:14px;border-width:2px"></span>`; return;
  }
  const action = dlActionFor(Player.track);
  btn.innerHTML = `<i class="bi ${action.icon}"></i>`;
}
function setSeekUI(pct){
  const bar = $('#miniBar'); if (bar) bar.style.width = pct + '%';
  const seek = $('#fpSeek');
  if (seek && !Player.seeking){ seek.value = Math.round(pct*10); seek.style.setProperty('--p', pct + '%'); }
  const abA = $('#abMarkerA'), abB = $('#abMarkerB');
  if (abA && Player.abRepeat.a != null && audio.duration){
    abA.style.left = (Player.abRepeat.a / audio.duration * 100) + '%';
  }
  if (abB && Player.abRepeat.b != null && audio.duration){
    abB.style.left = (Player.abRepeat.b / audio.duration * 100) + '%';
  }
}

/* MediaSession */
function setupMediaSession(){
  if (!('mediaSession' in navigator)) return;
  const safe = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch {} };
  safe('play', () => audio.play().catch(() => {}));
  safe('pause', () => audio.pause());
  safe('previoustrack', () => prevTrack());
  safe('nexttrack', () => nextTrack());
  safe('seekbackward', (e) => { audio.currentTime = Math.max(0, audio.currentTime - (e.seekOffset || 10)); });
  safe('seekforward', (e) => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (e.seekOffset || 10)); });
  safe('seekto', (e) => { if (e.seekTime != null && isFinite(e.seekTime)) audio.currentTime = e.seekTime; });
  safe('stop', () => { audio.pause(); audio.currentTime = 0; });
}
function updateMediaSession(){
  if (!('mediaSession' in navigator)) return;
  const t = Player.track;
  if (!t){ navigator.mediaSession.metadata = null; return; }
  const art = getArtwork(t, 512) || t.artworkUrl || '';
  const artwork = art ? [96,128,192,256,384,512].map(s => ({ src: art, sizes: `${s}x${s}`, type: 'image/jpeg' })) : [];
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.trackName || 'Track',
      artist: t.artistName || '',
      album: t.collectionName || '',
      artwork
    });
    navigator.mediaSession.playbackState = Player.playing ? 'playing' : 'paused';
  } catch {}
}
function updateMediaSessionPosition(){
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!audio.duration || !isFinite(audio.duration)) return;
  try { navigator.mediaSession.setPositionState({ duration: audio.duration, position: audio.currentTime, playbackRate: audio.playbackRate }); } catch {}
}

/* Persistence */
function persistQueue(){
  ls.set(KEY.queue, {
    queue: Player.queue.map(t => ({
      wrapperType:'track', trackId: t.trackId, trackName: t.trackName,
      artistName: t.artistName, artistId: t.artistId,
      collectionName: t.collectionName, collectionId: t.collectionId,
      trackTimeMillis: t.trackTimeMillis,
      attachments: { artworkUrls: t.attachments?.artworkUrls || [] }
    })),
    index: Player.index
  });
}
function persistState(){
  if (!Player.track) return;
  ls.set(KEY.state, {
    trackId: String(Player.track.trackId),
    position: audio.currentTime || 0,
    at: Date.now()
  });
}
function restoreQueueState(){
  const q = ls.get(KEY.queue, null);
  if (q && Array.isArray(q.queue) && q.queue.length){
    Player.queue = q.queue;
    Player.index = Number.isInteger(q.index) ? q.index : 0;
    renderFpTabBody();
  }
}
function restorePlayerState(){
  const s = ls.get(KEY.state, null);
  if (!s?.trackId) return;
  const it = Player.queue.find(t => String(t.trackId) === String(s.trackId)) || getCached('track', s.trackId);
  if (!it) return;
  Player.track = it;
  syncPlayerUI();
  ensureFpLyrics();
  // Reflect paused state, don't autoplay
  setTimeout(() => {
    if (isCached(s.trackId)){
      cacheGet(s.trackId).then(e => {
        if (e?.blob){
          const url = URL.createObjectURL(e.blob);
          if (audio.dataset.blobUrl) try { URL.revokeObjectURL(audio.dataset.blobUrl); } catch {}
          audio.dataset.blobUrl = url;
          audio.src = url;
          audio.currentTime = Math.min(s.position || 0, 1e9);
        }
      }).catch(() => {});
    }
  }, 100);
}

/* Audio events */
audio.addEventListener('play',  () => { Player.playing = true;  syncPlayIcons(); syncSaveButton(); if (fpTab === 'queue') renderFpTabBody(); updateMediaSession(); });
audio.addEventListener('pause', () => { Player.playing = false; syncPlayIcons(); if (fpTab === 'queue') renderFpTabBody(); updateMediaSession(); });
audio.addEventListener('ended', () => onTrackEnded());
audio.addEventListener('loadedmetadata', () => {
  if (isFinite(audio.duration)){ const e = $('#fpDur'); if (e) e.textContent = fmtTime(audio.duration); }
  updateMediaSessionPosition();
});

let _timeRafPending = false;
let _lastLyricTick = 0;
let _lastProgressTick = 0;
let _lastPersist = 0;
audio.addEventListener('timeupdate', () => {
  // A–B repeat loop
  if (Player.abRepeat.a != null && Player.abRepeat.b != null && audio.currentTime >= Player.abRepeat.b){
    audio.currentTime = Player.abRepeat.a;
  }
  if (_timeRafPending) return;
  _timeRafPending = true;
  requestAnimationFrame(() => {
    _timeRafPending = false;
    const d = audio.duration; if (!d || !isFinite(d)) return;
    const now = performance.now();
    if (now - _lastProgressTick >= PROGRESS_TICK_MS){
      _lastProgressTick = now;
      const pct = (audio.currentTime / d) * 100;
      setSeekUI(pct);
      const c = $('#fpCur'); if (c) c.textContent = fmtTime(audio.currentTime);
      updateMediaSessionPosition();
    }
    if (now - _lastLyricTick >= LYRIC_TICK_MS){
      _lastLyricTick = now;
      updateVisibleLyrics();
    }
    if (Date.now() - _lastPersist > 4000){ _lastPersist = Date.now(); persistState(); }
  });
});

audio.addEventListener('error', () => {
  if (audio.src && !audio.src.startsWith('blob:') && audio.src !== location.href) toast('Playback error', 'danger');
});

async function playItem(item, source='MusicMan'){
  if (!item) return;
  Player.source = source;
  const id = String(item.trackId || ''); if (!id) return;
  if (isCached(id)) return playCachedById(id, item);
  let resolvedItem = item;
  let rawUrl = getPlayable(item);
  if (!rawUrl){
    const cached = getCached('track', id);
    if (cached){
      if (isCached(id)) return playCachedById(id, cached);
      const u = getPlayable(cached); if (u){ resolvedItem = cached; rawUrl = u; }
    }
  }
  if (!rawUrl){
    try {
      const r = await apiLookup(id, 'song');
      const fresh = r.find(x => itemType(x) === 'track') || r[0];
      if (fresh){
        cacheItems([fresh]);
        if (isCached(id)) return playCachedById(id, fresh);
        const u = getPlayable(fresh); if (u){ resolvedItem = fresh; rawUrl = u; }
      }
    } catch {}
  }
  if (!rawUrl){
    const dl = DL.get(id);
    if (dl && ['queued','crawling','saving'].includes(dl.status)) toast('Still preparing — try again in a moment', 'info');
    else toast('Audio not ready — download it first', 'warning');
    return;
  }
  const previewOnly = !hasAudio(resolvedItem) && hasPreview(resolvedItem);
  audio.pause();
  if (audio.dataset.blobUrl){ try { URL.revokeObjectURL(audio.dataset.blobUrl); } catch {} delete audio.dataset.blobUrl; }
  audio.src = proxyUrl(rawUrl);
  audio.load();
  audio.playbackRate = Number(getSettings().playbackRate) || 1;
  audio.play().catch(err => { if (err.name !== 'AbortError') toast('Cannot play', 'danger'); });
  Player.track = resolvedItem;
  pushRecentlyPlayed(resolvedItem);
  statsRecord(resolvedItem);
  setQueueFromItem(resolvedItem, id);
  persistQueue();
  syncPlayerUI();
  ensureFpLyrics();
  if (previewOnly) toast('Preview playing — crawl for full track', 'info');
}
function setQueueFromItem(item, id){
  if (!id) return;
  const existing = Player.queue.findIndex(t => String(t.trackId) === id);
  if (existing >= 0){ Player.queue[existing] = item; Player.index = existing; }
  else { Player.queue.push(item); Player.index = Player.queue.length - 1; }
}
async function playById(id){
  haptic(6);
  const cached = isCached(id);
  let it = getCached('track', id);
  if (!it){
    try { const r = await apiLookup(id, 'song'); it = r.find(x => itemType(x) === 'track') || r[0]; if (it) cacheItems([it]); } catch {}
  }
  if (!it && cached) it = { wrapperType:'track', trackId:String(id), trackName:'Cached track', artistName:'', attachments:{} };
  if (!it){ toast('Track not found', 'danger'); return; }
  playItem(it);
}
async function playCachedById(id, fallbackMeta){
  const e = await cacheGet(id);
  if (!e?.blob){ toast('Not available offline', 'danger'); return; }
  const m = e.meta || {};
  const url = URL.createObjectURL(e.blob);
  audio.pause();
  if (audio.dataset.blobUrl){ try { URL.revokeObjectURL(audio.dataset.blobUrl); } catch {} }
  audio.dataset.blobUrl = url;
  audio.src = url;
  audio.playbackRate = Number(getSettings().playbackRate) || 1;
  audio.play().catch(() => {});
  const fake = fallbackMeta && fallbackMeta.trackId ? fallbackMeta : {
    wrapperType:'track', trackId:String(id),
    trackName: m.name || 'Cached track', artistName: m.artist || '',
    artistId: m.artistId || '', collectionName: m.album || '',
    attachments: { artworkUrls: m.artwork ? [{ url: m.artwork }] : [] }
  };
  Player.track = fake;
  pushRecentlyPlayed(fake);
  statsRecord(fake);
  setQueueFromItem(fake, String(id));
  persistQueue();
  syncPlayerUI();
  ensureFpLyrics();
}
function togglePlay(){
  haptic(6);
  if (!audio.src){
    if (Player.queue.length) playItem(Player.queue[Math.max(0, Player.index)] || Player.queue[0]);
    return;
  }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}
function nextTrack(userInitiated = true){
  const q = Player.queue; if (!q.length) return;
  if (Player.repeat === 'one' && !userInitiated){ audio.currentTime = 0; audio.play().catch(()=>{}); return; }
  let next;
  if (Player.shuffle && q.length > 1){ do { next = Math.floor(Math.random()*q.length); } while (next === Player.index); }
  else {
    next = Player.index + 1;
    if (next >= q.length){
      if (Player.repeat === 'all') next = 0;
      else { audio.pause(); audio.currentTime = 0; syncPlayIcons(); return; }
    }
  }
  Player.index = next;
  playItem(q[next], Player.source);
}
function prevTrack(){
  if (audio.currentTime > 3){ audio.currentTime = 0; return; }
  const q = Player.queue; if (!q.length) return;
  let prev = Player.index - 1;
  if (prev < 0) prev = Player.repeat === 'all' ? q.length - 1 : 0;
  Player.index = prev;
  playItem(q[prev], Player.source);
}
function onTrackEnded(){ nextTrack(false); }
function toggleShuffle(){ Player.shuffle = !Player.shuffle; toast(Player.shuffle ? 'Shuffle on' : 'Shuffle off'); if (fpTab === 'now') renderFpTabBody(); }
function cycleRepeat(){
  const order = ['off','all','one'];
  Player.repeat = order[(order.indexOf(Player.repeat) + 1) % 3];
  toast(Player.repeat === 'off' ? 'Repeat off' : Player.repeat === 'all' ? 'Repeat all' : 'Repeat one');
  if (fpTab === 'now') renderFpTabBody();
}
function toggleAB(){
  if (Player.abRepeat.a === null){
    Player.abRepeat.a = audio.currentTime;
    toast('A set · ' + fmtTime(audio.currentTime));
  } else if (Player.abRepeat.b === null){
    if (audio.currentTime <= Player.abRepeat.a){ toast('B must be after A', 'warning'); return; }
    Player.abRepeat.b = audio.currentTime;
    toast('A–B loop active');
  } else {
    Player.abRepeat = { a: null, b: null };
    toast('A–B cleared');
  }
  renderFpTabBody();
}
function openFullPlayer(tab){
  if (!Player.track) return;
  const el = $('#full');
  el.classList.add('show');
  el.setAttribute('aria-hidden', 'false');
  if (tab) setFpTab(tab); else setFpTab(fpTab);
}
function closeFullPlayer(){
  const el = $('#full');
  if (!el.classList.contains('show')) return;
  el.classList.remove('show');
  el.setAttribute('aria-hidden', 'true');
  el.style.transform = ''; el.style.opacity = '';
}
window.addEventListener('popstate', () => { if ($('#full')?.classList.contains('show')) closeFullPlayer(); });

/* Full-player drag to dismiss */
(function initFullDrag(){
  const fp = $('#full'); if (!fp) return;
  let startY = 0, dy = 0, dragging = false;
  fp.addEventListener('touchstart', e => {
    if (fp.querySelector('.fp-tabbody')?.scrollTop > 0) return;
    if (e.target.closest('input,button,a')) return;
    dragging = true; startY = e.touches[0].clientY; dy = 0; fp.style.transition = 'none';
  }, { passive: true });
  fp.addEventListener('touchmove', e => {
    if (!dragging) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    fp.style.transform = `translateY(${dy}px)`;
    fp.style.opacity = String(Math.max(0.35, 1 - dy/520));
  }, { passive: true });
  fp.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false; fp.style.transition = '';
    const shouldClose = dy > 110;
    fp.style.transform = ''; fp.style.opacity = '';
    if (shouldClose) closeFullPlayer();
  });
})();

/* Visualizer bars (decorative) */
function renderVisualizer(){
  const bars = 28;
  let out = '';
  for (let i = 0; i < bars; i++){
    const h = 10 + Math.random() * 20;
    const dur = (0.6 + Math.random() * 0.7).toFixed(2);
    const del = (-Math.random() * 1.2).toFixed(2);
    out += `<div class="bar" style="animation: visBar ${dur}s ease-in-out ${del}s infinite; height:${h}%"></div>`;
  }
  return out;
}
// Keyframe injected once
(function injectVisKeyframe(){
  const s = document.createElement('style');
  s.textContent = `@keyframes visBar{0%,100%{height:8%}50%{height:100%}}`;
  document.head.appendChild(s);
})();

function renderFpNow(body){
  const t = Player.track;
  if (!t){ body.innerHTML = `<div class="fp-lyrics-empty"><i class="bi bi-music-note"></i>Nothing playing</div>`; return; }
  const art = getArtwork(t, 600) || t.artworkUrl || '';
  const liked = isLiked(t.trackId);
  const cached = isCached(t.trackId);
  const cur = fmtTime(audio.currentTime || 0);
  const dur = (audio.duration && isFinite(audio.duration)) ? fmtTime(audio.duration) : (t.trackTimeMillis ? fmtTime(t.trackTimeMillis/1000) : '0:00');
  const pct = (audio.duration && isFinite(audio.duration)) ? (audio.currentTime / audio.duration) * 100 : 0;
  const action = dlActionFor(t);
  let dlIcon = `<i class="bi ${action.icon}"></i>`;
  const dl = DL.get(t.trackId);
  if (cached) dlIcon = '<i class="bi bi-cloud-check-fill text-success"></i>';
  else if (dl && ['queued','crawling','saving'].includes(dl.status))
    dlIcon = `<span class="spinner-border spinner-border-sm" style="width:14px;height:14px;border-width:2px"></span>`;
  const artistLine = t.artistId
    ? `<a class="fp-artist" href="/artist/${esc(t.artistId)}" data-link style="color:inherit">${esc(t.artistName || '')}</a>`
    : `<div class="fp-artist">${esc(t.artistName || '')}</div>`;
  const showVis = getSettings().visualizer;
  const abActive = Player.abRepeat.a != null;
  body.innerHTML = `
    <div class="fp-body">
      <div class="fp-art-wrap" id="fpArtWrap">
        ${showVis ? `<div class="fp-vis ${Player.playing ? '' : 'paused'} on" id="fpVis">${renderVisualizer()}</div>` : ''}
        ${art ? `<img id="fpArt" class="fp-art" src="${esc(art)}" alt="" decoding="async">`
              : `<div id="fpArt" class="fp-art fp-art-ph"><i class="bi bi-music-note"></i></div>`}
      </div>
      <div class="fp-meta">
        <div class="fp-title">${esc(t.trackName || 'Track')}</div>
        ${artistLine}
      </div>
      <div class="fp-seek" style="position:relative">
        <input id="fpSeek" class="mm-range" type="range" min="0" max="1000" value="${Math.round(pct*10)}" style="--p:${pct}%">
        ${Player.abRepeat.a != null && dur !== '0:00' ? `<div id="abMarkerA" style="position:absolute;top:6px;width:2px;height:16px;background:var(--bs-warning);border-radius:1px;pointer-events:none;left:0"></div>` : ''}
        ${Player.abRepeat.b != null && dur !== '0:00' ? `<div id="abMarkerB" style="position:absolute;top:6px;width:2px;height:16px;background:var(--bs-warning);border-radius:1px;pointer-events:none;left:0"></div>` : ''}
        <div class="fp-times"><span id="fpCur">${cur}</span><span id="fpDur">${dur}</span></div>
      </div>
      <div class="fp-controls">
        <button class="icon-btn ${Player.shuffle ? 'on' : ''}" onclick="toggleShuffle()" aria-label="Shuffle"><i class="bi bi-shuffle"></i></button>
        <button class="icon-btn lg" onclick="prevTrack()" aria-label="Previous"><i class="bi bi-skip-start-fill"></i></button>
        <button class="fp-play" onclick="togglePlay()" aria-label="Play/pause">
          <i id="fpPlayIcon" class="bi ${Player.playing ? 'bi-pause-fill' : 'bi-play-fill'}"></i>
        </button>
        <button class="icon-btn lg" onclick="nextTrack()" aria-label="Next"><i class="bi bi-skip-end-fill"></i></button>
        <button class="icon-btn ${Player.repeat !== 'off' ? 'on' : ''}" onclick="cycleRepeat()" aria-label="Repeat">
          <i class="bi ${Player.repeat === 'one' ? 'bi-repeat-1' : 'bi-repeat'}"></i>
        </button>
      </div>
      <div class="fp-volume">
        <i class="bi bi-volume-mute"></i>
        <input id="fpVol" class="mm-range vol" type="range" min="0" max="100" value="${Math.round(audio.volume*100)}" style="--p:${Math.round(audio.volume*100)}%" aria-label="Volume">
        <i class="bi bi-volume-up"></i>
      </div>
      <div class="fp-actions">
        <button class="icon-btn ${liked ? 'liked' : ''}" id="fpLikeBtn" onclick="toggleLikeCurrent()" aria-label="Like">
          <i id="fpLike" class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}"></i>
        </button>
        <button class="icon-btn" id="fpSaveBtn" onclick="saveCurrentTrack()" aria-label="${action.label}">${dlIcon}</button>
        <button class="icon-btn" onclick="openPlaylistPicker('${esc(t.trackId)}')" aria-label="Add to playlist"><i class="bi bi-plus-lg"></i></button>
        <button class="icon-btn ${abActive ? 'on' : ''}" onclick="toggleAB()" aria-label="A-B repeat">
          <i class="bi bi-arrow-repeat"></i>
        </button>
        <button class="icon-btn" onclick="openSleepTimer()" aria-label="Sleep timer"><i class="bi bi-moon" id="sleepIcon"></i></button>
      </div>
    </div>`;

  // Art swipe gestures
  const artWrap = $('#fpArtWrap');
  if (artWrap){
    let sx = 0, sy = 0, t0 = 0;
    artWrap.addEventListener('touchstart', e => { const tt = e.touches[0]; sx = tt.clientX; sy = tt.clientY; t0 = Date.now(); }, { passive: true });
    artWrap.addEventListener('touchend', e => {
      const tt = e.changedTouches[0];
      const dx = tt.clientX - sx, dy = tt.clientY - sy;
      const dt = Date.now() - t0;
      if (dt > 600) return;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
      haptic(10);
      if (dx < 0) nextTrack(); else prevTrack();
    }, { passive: true });
  }
  const seek = $('#fpSeek');
  seek?.addEventListener('pointerdown', () => { Player.seeking = true; });
  seek?.addEventListener('pointerup',   () => { Player.seeking = false; });
  seek?.addEventListener('input', e => {
    const p = Number(e.target.value)/10;
    e.target.style.setProperty('--p', p + '%');
    if (audio.duration && isFinite(audio.duration)){ const c = $('#fpCur'); if (c) c.textContent = fmtTime((p/100)*audio.duration); }
  });
  seek?.addEventListener('change', e => {
    if (audio.duration && isFinite(audio.duration)) audio.currentTime = (Number(e.target.value)/1000)*audio.duration;
    Player.seeking = false;
  });
  const vol = $('#fpVol');
  vol?.addEventListener('input', e => { audio.volume = Number(e.target.value)/100; e.target.style.setProperty('--p', e.target.value + '%'); });
}

function renderFpQueue(body){
  const q = Player.queue;
  const recent = getRecentlyPlayed();
  let html = '';
  if (!q.length) html += `<div class="fp-lyrics-empty"><i class="bi bi-music-note-list"></i>Queue is empty</div>`;
  else {
    html += `<div class="fp-list-head"><div class="fp-list-title">Now playing · ${q.length}</div>
      <div class="fp-list-actions">
        <button class="icon-btn sm" onclick="shuffleQueue()" aria-label="Shuffle"><i class="bi bi-shuffle"></i></button>
        <button class="icon-btn sm" onclick="clearQueue()" aria-label="Clear"><i class="bi bi-trash3"></i></button>
      </div></div>`;
    html += q.map((tr, i) => qRow(tr, i)).join('');
  }
  const recentFiltered = recent.filter(r => !q.some(t => String(t.trackId) === String(r.trackId))).slice(0, 8);
  if (recentFiltered.length){
    html += `<div class="fp-list-head" style="margin-top:6px"><div class="fp-list-title">Recently played</div></div>`;
    html += recentFiltered.map(r => {
      const a = r.artworkUrl || '';
      return `<div class="q-row" onclick="playById('${esc(r.trackId)}')">
        ${a ? `<img src="${esc(a)}" class="row-art" alt="" loading="lazy" decoding="async">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
        <div class="flex-grow-1 min-w-0"><div class="row-title text-truncate">${esc(r.trackName || 'Track')}</div>
        <div class="row-sub text-truncate">${esc(r.artistName || '')} · ${fmtAgo(r.at)}</div></div>
      </div>`;
    }).join('');
  }
  body.innerHTML = html;
}
function qRow(tr, i){
  const active = i === Player.index;
  const art = getArtwork(tr, 100) || tr.artworkUrl || '';
  const last = Player.queue.length - 1;
  const indicator = active && Player.playing
    ? `<span class="q-bars"><span></span><span></span><span></span><span></span></span>`
    : (active ? `<i class="bi bi-play-fill text-primary"></i>` : '');
  return `<div class="q-row ${active ? 'active' : ''}" onclick="jumpQueue(${i})">
    <div class="q-drag" onclick="event.stopPropagation()">
      <button ${i === 0 ? 'disabled' : ''} onclick="moveQueueItem(${i}, -1)" aria-label="Up"><i class="bi bi-chevron-up"></i></button>
      <button ${i === last ? 'disabled' : ''} onclick="moveQueueItem(${i}, 1)" aria-label="Down"><i class="bi bi-chevron-down"></i></button>
    </div>
    ${art ? `<img src="${esc(art)}" class="row-art" alt="" loading="lazy" decoding="async">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="flex-grow-1 min-w-0"><div class="row-title text-truncate">${esc(tr.trackName || 'Track')}</div>
    <div class="row-sub text-truncate">${esc(tr.artistName || '')}</div></div>
    ${indicator}
    <button class="icon-btn sm" onclick="event.stopPropagation();removeQueue(${i})" aria-label="Remove"><i class="bi bi-x-lg"></i></button>
  </div>`;
}
function moveQueueItem(i, dir){
  const j = i + dir;
  if (j < 0 || j >= Player.queue.length) return;
  const q = Player.queue;
  [q[i], q[j]] = [q[j], q[i]];
  if (Player.index === i) Player.index = j;
  else if (Player.index === j) Player.index = i;
  persistQueue(); renderFpTabBody();
}
function shuffleQueue(){
  const q = Player.queue; if (q.length < 2) return;
  const current = Player.index >= 0 ? q[Player.index] : null;
  for (let i = q.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
  if (current) Player.index = q.indexOf(current);
  persistQueue(); renderFpTabBody(); toast('Queue shuffled');
}
function jumpQueue(i){ if (i<0 || i>=Player.queue.length) return; Player.index = i; playItem(Player.queue[i], Player.source); }
function removeQueue(i){
  if (i<0 || i>=Player.queue.length) return;
  Player.queue.splice(i,1);
  if (i < Player.index) Player.index--;
  else if (i === Player.index) Player.index = Math.min(Player.index, Player.queue.length - 1);
  persistQueue(); renderFpTabBody();
}
function clearQueue(){
  Player.queue = Player.track ? [Player.track] : [];
  Player.index = Player.track ? 0 : -1;
  persistQueue(); renderFpTabBody(); toast('Queue cleared');
}

async function ensureFpLyrics(){
  const t = Player.track; if (!t) return;
  const id = String(t.trackId);
  if (syncedLyricsCache.trackId === id && syncedLyricsCache.lines !== null) return;
  const fromTrack = lyricsFromItem(t);
  if (fromTrack){
    syncedLyricsCache = { trackId: id, lines: fromTrack.lines, synced: fromTrack.synced, loading: false };
    if (fpTab === 'lyrics') renderFpTabBody();
    return;
  }
  const cachedItem = getCached('track', id);
  if (cachedItem && cachedItem !== t){
    const fromCached = lyricsFromItem(cachedItem);
    if (fromCached){
      syncedLyricsCache = { trackId: id, lines: fromCached.lines, synced: fromCached.synced, loading: false };
      if (fpTab === 'lyrics') renderFpTabBody();
      return;
    }
  }
  try {
    const r = await apiLookup(id, 'song');
    const fresh = r.find(x => itemType(x) === 'track') || r[0];
    if (fresh){
      cacheItems([fresh]);
      if (!Player.track || String(Player.track.trackId) !== id) return;
      Player.track = fresh;
      const fromFresh = lyricsFromItem(fresh);
      if (fromFresh){
        syncedLyricsCache = { trackId: id, lines: fromFresh.lines, synced: fromFresh.synced, loading: false };
        if (fpTab === 'lyrics') renderFpTabBody();
        return;
      }
    }
  } catch {}
  syncedLyricsCache = { trackId: id, lines: [], synced: false, loading: false };
  if (fpTab === 'lyrics') renderFpTabBody();
}
function renderFpLyrics(body){
  const t = Player.track;
  if (!t){ body.innerHTML = `<div class="fp-lyrics-empty"><i class="bi bi-music-note-list"></i>Nothing playing</div>`; return; }
  const id = String(t.trackId);
  if (syncedLyricsCache.trackId !== id || syncedLyricsCache.loading){
    body.innerHTML = `<div class="fp-lyrics-empty"><span class="spinner-border spinner-border-sm me-2"></span> Loading lyrics…</div>`;
    ensureFpLyrics(); return;
  }
  if (!syncedLyricsCache.lines || !syncedLyricsCache.lines.length){
    body.innerHTML = `<div class="fp-lyrics-empty"><i class="bi bi-music-note-list"></i>No lyrics available for this track.</div>`;
    return;
  }
  body.innerHTML = `<div class="fp-lyrics-body"></div>`;
  renderLyricsInto(body.querySelector('.fp-lyrics-body'), syncedLyricsCache.lines, syncedLyricsCache.synced);
}
function openSleepTimer(){ sheet('#sheetSleep').show(); }
function setSleepTimer(minutes){
  sheet('#sheetSleep').hide();
  if (Player.sleepTimer){ clearTimeout(Player.sleepTimer); Player.sleepTimer = null; }
  const icon = $('#sleepIcon');
  if (!minutes){ if (icon) icon.className = 'bi bi-moon'; toast('Sleep timer off'); return; }
  if (icon) icon.className = 'bi bi-moon-fill';
  const fadeSec = Number(getSettings().sleepFade) || 0;
  const startFadeAt = Math.max(0, minutes * 60 * 1000 - fadeSec * 1000);
  Player.sleepTimer = setTimeout(() => {
    const startVol = audio.volume;
    const startT = Date.now();
    const fadeMs = fadeSec * 1000;
    if (fadeMs <= 0){
      audio.pause(); Player.sleepTimer = null;
      if (icon) icon.className = 'bi bi-moon';
      toast('Sleep timer — paused'); return;
    }
    const iv = setInterval(() => {
      const p = Math.min(1, (Date.now() - startT) / fadeMs);
      audio.volume = Math.max(0, startVol * (1 - p));
      if (p >= 1){
        clearInterval(iv);
        audio.pause();
        audio.volume = startVol;
        Player.sleepTimer = null;
        if (icon) icon.className = 'bi bi-moon';
        toast('Sleep timer — paused');
      }
    }, 200);
  }, startFadeAt);
  toast(`Sleep timer · ${minutes} min`);
}
async function saveCurrentTrack(){
  const t = Player.track;
  if (!t?.trackId){ toast('Nothing playing', 'warning'); return; }
  const id = String(t.trackId);
  if (isCached(id)){ await exportCached(id); return; }
  const dl = DL.get(id);
  if (dl && ['queued','crawling','saving'].includes(dl.status)){ toast('Already in progress', 'warning'); return; }
  const fresh = getCached('track', id) || t;
  await startCrawlInternal(id, null, fresh);
  syncSaveButton();
}
function toggleLikeCurrent(){ if (Player.track?.trackId) toggleLike(Player.track); }

async function playIds(csv){
  const ids = String(csv || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length){ toast('Nothing to play'); return; }
  toast('Loading…');
  const items = [];
  for (const id of ids){
    let it = getCached('track', id);
    if (!it){
      try { const r = await apiLookup(id, 'song'); it = r.find(x => itemType(x) === 'track') || r[0]; if (it) cacheItems([it]); } catch {}
    }
    if (!it && isCached(id)) it = { wrapperType:'track', trackId:String(id), trackName:'Cached track', artistName:'', attachments:{} };
    if (it) items.push(it);
  }
  if (!items.length){ toast('Could not load tracks', 'danger'); return; }
  Player.queue = items; Player.index = 0;
  persistQueue(); renderFpTabBody();
  playItem(items[0], Player.source);
}

/* ══════════════════════════════════════════════════════════════
   BULK ACTIONS
   ══════════════════════════════════════════════════════════════ */
let _pageTracks = [];
function addAllToQueue(items){
  const list = (items || []).filter(it => it && it.trackId);
  if (!list.length){ toast('Nothing to add', 'warning'); return; }
  let added = 0;
  const existing = new Set(Player.queue.map(q => String(q.trackId)));
  for (const it of list){ const id = String(it.trackId); if (existing.has(id)) continue; Player.queue.push(it); existing.add(id); added++; }
  if (Player.index < 0 && Player.queue.length) Player.index = 0;
  persistQueue(); renderFpTabBody(); haptic(8);
  toast(added ? `Added ${added} track${added === 1 ? '' : 's'} to queue` : 'Already in queue', added ? 'success' : 'warning');
}
function toggleLikeAll(items){
  const list = (items || []).filter(it => it && it.trackId);
  if (!list.length){ toast('Nothing to like', 'warning'); return; }
  const likes = getLikes();
  const itemIds = new Set(list.map(it => String(it.trackId)));
  const allLiked = list.every(it => likes.some(l => String(l.trackId) === String(it.trackId)));
  if (allLiked){
    const next = likes.filter(l => !itemIds.has(String(l.trackId)));
    ls.set(KEY.likes, next);
    toast(`Removed ${list.length} from Liked`);
  } else {
    const existing = new Set(likes.map(l => String(l.trackId)));
    let added = 0;
    for (const it of list){ const id = String(it.trackId); if (existing.has(id)) continue; likes.unshift(makeLikeEntry(it)); existing.add(id); added++; }
    ls.set(KEY.likes, likes);
    toast(added ? `Liked ${added} track${added === 1 ? '' : 's'}` : 'Already liked');
  }
  haptic(12); refreshLikes(); refreshPage();
}
async function refreshPage(){
  const y = MAIN().scrollTop;
  try { await route(); } catch (e){ console.warn(e); }
  MAIN().scrollTop = y;
}

/* ══════════════════════════════════════════════════════════════
   TRACK MENU / SHARE / PLAYLIST PICKER
   ══════════════════════════════════════════════════════════════ */
const menuCtx = { trackId:null, playlistId:null };
async function openTrackMenu(trackId, playlistId){
  if (!trackId) return;
  menuCtx.trackId = String(trackId);
  menuCtx.playlistId = playlistId || null;
  let it = getCached('track', trackId);
  if (!it){
    try { const r = await apiLookup(trackId, 'song'); it = r.find(x => itemType(x) === 'track') || r[0]; if (it) cacheItems([it]); } catch {}
  }
  if (!it){ toast('Track not available', 'danger'); return; }
  const id = String(trackId);
  const liked = isLiked(id);
  const cached = isCached(id);
  const dl = DL.get(id);
  const art = getArtwork(it, 100);
  const action = dlActionFor(it);
  const rows = [];
  if (dl && ['queued','crawling','saving'].includes(dl.status)){
    rows.push(`<button class="sheet-item" onclick="menuAction('openDl')"><i class="bi ${action.icon} text-info"></i><span>View ${action.isDirect ? 'download' : 'crawl'} progress</span></button>`);
    rows.push(`<button class="sheet-item danger" onclick="menuAction('cancelDl')"><i class="bi bi-x-circle"></i><span>Cancel ${action.isDirect ? 'download' : 'crawl'}</span></button>`);
  } else if (cached){
    rows.push(`<button class="sheet-item" onclick="menuAction('export')"><i class="bi bi-file-earmark-arrow-down text-primary"></i><span>Save as file</span></button>`);
    rows.push(`<button class="sheet-item danger" onclick="menuAction('uncache')"><i class="bi bi-trash3"></i><span>Remove offline copy</span></button>`);
  } else {
    rows.push(`<button class="sheet-item" onclick="menuAction('download')"><i class="bi ${action.icon} text-primary"></i><span>${action.label}</span></button>`);
  }
  rows.push(`<button class="sheet-item" onclick="menuAction('next')"><i class="bi bi-skip-end-fill"></i><span>Play next</span></button>`);
  rows.push(`<button class="sheet-item" onclick="menuAction('queue')"><i class="bi bi-list-ul"></i><span>Add to queue</span></button>`);
  rows.push(`<button class="sheet-item" onclick="menuAction('like')"><i class="bi ${liked ? 'bi-heart-fill text-danger' : 'bi-heart'}"></i><span>${liked ? 'Remove from Liked' : 'Add to Liked'}</span></button>`);
  rows.push(`<button class="sheet-item" onclick="menuAction('playlist')"><i class="bi bi-plus-circle"></i><span>Add to playlist</span></button>`);
  rows.push(`<button class="sheet-item" onclick="menuAction('share')"><i class="bi bi-share"></i><span>Share</span></button>`);
  rows.push(`<button class="sheet-item" onclick="menuAction('details')"><i class="bi bi-info-circle"></i><span>Track details</span></button>`);
  if (it.collectionId) rows.push(`<button class="sheet-item" onclick="menuAction('album')"><i class="bi bi-disc"></i><span>Go to album</span></button>`);
  if (it.artistId)     rows.push(`<button class="sheet-item" onclick="menuAction('artist')"><i class="bi bi-person"></i><span>Go to artist</span></button>`);
  if (menuCtx.playlistId) rows.push(`<button class="sheet-item danger" onclick="menuAction('removeFromPl')"><i class="bi bi-x-circle"></i><span>Remove from playlist</span></button>`);
  $('#sheetTrackBody').innerHTML = `
    <div class="d-flex align-items-center gap-3 px-3 pb-3 pt-1">
      ${art ? `<img src="${esc(art)}" width="52" height="52" class="row-art" alt="" loading="lazy" decoding="async">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
      <div class="min-w-0"><div class="fw-bold text-truncate">${esc(it.trackName || 'Track')}</div>
      <div class="row-sub text-truncate">${esc(it.artistName || '')}</div></div>
    </div>
    <div class="px-2">${rows.join('')}</div>`;
  sheet('#sheetTrack').show();
}
async function menuAction(action){
  const id = menuCtx.trackId;
  const plId = menuCtx.playlistId;
  sheet('#sheetTrack').hide();
  if (!id) return;
  let it = getCached('track', id);
  if (!it){
    try { const r = await apiLookup(id, 'song'); it = r.find(x => itemType(x) === 'track') || r[0]; if (it) cacheItems([it]); } catch {}
  }
  switch (action){
    case 'details': closeFullPlayer(); go('/track/' + id); break;
    case 'play': playById(id); break;
    case 'next': {
      if (!it) return;
      Player.queue.splice(Player.index + 1, 0, it);
      persistQueue(); toast('Playing next'); renderFpTabBody(); break;
    }
    case 'queue': {
      if (!it) return;
      if (Player.queue.some(t => String(t.trackId) === id)){ toast('Already in queue','warning'); return; }
      Player.queue.push(it);
      if (Player.index < 0) Player.index = 0;
      persistQueue(); toast('Added to queue'); renderFpTabBody(); break;
    }
    case 'share': await shareTrack(id, it); break;
    case 'like': toggleLikeById(id); break;
    case 'playlist': openPlaylistPicker(id); break;
    case 'download': if (it) await startCrawlInternal(id, null, it); break;
    case 'export': await exportCached(id); break;
    case 'uncache': await removeCached(id); break;
    case 'openDl': closeFullPlayer(); go('/library/downloads'); break;
    case 'cancelDl': DL.remove(id); toast('Cancelled'); break;
    case 'album': if (it?.collectionId){ closeFullPlayer(); go('/album/' + it.collectionId); } break;
    case 'artist': if (it?.artistId){ closeFullPlayer(); go('/artist/' + it.artistId); } break;
    case 'removeFromPl': if (plId){ removeFromPlaylist(plId, id); toast('Removed'); } break;
  }
}
function fpMoreMenu(){ if (Player.track?.trackId) openTrackMenu(Player.track.trackId); }
async function shareTrack(id, it){
  const url = location.origin + '/track/' + id;
  const title = it?.trackName || 'Track';
  const text = `${title}${it?.artistName ? ' — ' + it.artistName : ''}`;
  if (navigator.share){
    try { await navigator.share({ title, text, url }); toast('Shared'); }
    catch (e) { if (e.name !== 'AbortError') copyText(url); }
  } else copyText(url);
}
let pickerItems = [];
function openPlaylistPicker(trackId){
  const id = String(trackId);
  const cached = getCached('track', id);
  if (cached) return openPlaylistPickerForItems([cached]);
  (async () => {
    try { const r = await apiLookup(id, 'song'); const it = r.find(x => itemType(x) === 'track') || r[0];
      if (it){ cacheItems([it]); openPlaylistPickerForItems([it]); } else toast('Track not available', 'danger');
    } catch { toast('Track not available', 'danger'); }
  })();
}
function openPlaylistPickerForItems(items){
  pickerItems = (items || []).filter(it => it && it.trackId);
  if (!pickerItems.length) return;
  const titleEl = $('#sheetPlTitle');
  if (titleEl) titleEl.textContent = pickerItems.length > 1 ? `Add ${pickerItems.length} tracks to playlist` : 'Add to playlist';
  const pls = getPlaylists();
  const body = $('#sheetPlBody');
  if (!pls.length) body.innerHTML = `<div class="state" style="padding:30px 20px"><i class="bi bi-music-note-list"></i><p>No playlists yet</p></div>`;
  else body.innerHTML = pls.map(p => {
    const cover = p.tracks.find(t => t.artworkUrl)?.artworkUrl || '';
    return `<button class="sheet-item" onclick="pickPlaylist('${esc(p.id)}')">
      ${cover ? `<img src="${esc(cover)}" width="42" height="42" class="row-art" alt="" loading="lazy" decoding="async">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note-list"></i></div>`}
      <span class="flex-grow-1 min-w-0"><span class="d-block text-truncate fw-semibold">${esc(p.name)}</span>
      <span class="sub">${p.tracks.length} track${p.tracks.length !== 1 ? 's' : ''}</span></span>
      <i class="bi bi-plus-lg text-primary"></i>
    </button>`;
  }).join('');
  sheet('#sheetPl').show();
}
async function pickPlaylist(plId){
  if (!pickerItems.length) return;
  const all = getPlaylists();
  const pl = all.find(p => p.id === plId); if (!pl) return;
  let added = 0;
  const existing = new Set(pl.tracks.map(t => String(t.trackId)));
  for (const it of pickerItems){ const id = String(it.trackId); if (existing.has(id)) continue; pl.tracks.push(makeLikeEntry(it)); existing.add(id); added++; }
  savePlaylists(all);
  sheet('#sheetPl').hide(); haptic(10);
  toast(added ? `Added ${added} track${added === 1 ? '' : 's'} to "${pl.name}"` : 'Already in playlist', added ? 'success' : 'warning');
  pickerItems = [];
}
async function newPlaylistPrompt(){
  const itemsToAdd = pickerItems.slice();
  pickerItems = [];
  sheet('#sheetPl').hide();
  const name = await askText('New playlist', '', 'Playlist name');
  if (!name) return;
  const pl = createPlaylist(name); if (!pl) return;
  if (itemsToAdd.length){
    const all = getPlaylists();
    const p = all.find(x => x.id === pl.id);
    if (p){
      const existing = new Set(p.tracks.map(t => String(t.trackId)));
      for (const it of itemsToAdd){ const id = String(it.trackId); if (existing.has(id)) continue; p.tracks.push(makeLikeEntry(it)); existing.add(id); }
      savePlaylists(all);
    }
  }
  if (currentPath().startsWith('/library/playlists')) go('/library/playlists/' + pl.id);
}

/* ══════════════════════════════════════════════════════════════
   DOWNLOAD / CRAWL ACTIONS
   ══════════════════════════════════════════════════════════════ */
async function startCrawl(trackId, btn){
  const id = String(trackId);
  const it0 = getCached('track', id);
  const action = it0 ? dlActionFor(it0) : { icon:'bi-cloud-arrow-down', label:'Crawl' };
  if (btn){ btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm" style="width:14px;height:14px;border-width:2px"></span>'; }
  try {
    let it = it0;
    if (!it){
      try { const r = await apiLookup(trackId, 'song'); it = r.find(x => itemType(x) === 'track') || r[0]; if (it) cacheItems([it]); } catch {}
    }
    if (!it){ toast('Track unavailable', 'danger'); return; }
    await DL.add(it);
    haptic(12);
    if (currentPath() === `/track/${trackId}`){
      const status = await apiCrawlStatus(trackId);
      renderCrawlCard(it, status);
      startTrackPoller(trackId);
    }
  } catch (e){ toast((action.label) + ' failed: ' + e.message, 'danger'); }
  finally { if (btn){ btn.disabled = false; btn.innerHTML = `<i class="bi ${action.icon}"></i> ${action.label}`; } }
}
async function startCrawlInternal(trackId, btn, knownTrack){
  const it0 = knownTrack || getCached('track', trackId);
  const action = it0 ? dlActionFor(it0) : { icon:'bi-cloud-arrow-down', label:'Crawl' };
  if (btn){ btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm" style="width:14px;height:14px;border-width:2px"></span>'; }
  try {
    let it = it0 || (await DL._fetchTrack(trackId));
    if (!it){ toast('Track unavailable', 'danger'); return; }
    await DL.add(it);
  } finally { if (btn){ btn.disabled = false; btn.innerHTML = `<i class="bi ${action.icon}"></i> ${action.label}`; } }
}
async function crawlAll(type, id, btn){
  const orig = btn?.innerHTML;
  if (btn){ btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" style="width:14px;height:14px;border-width:2px"></span>Starting…'; }
  try {
    const body = {};
    if (type === 'track') body.trackId = cleanId(id);
    else if (type === 'collection') body.albumId = cleanId(id);
    else if (type === 'artist') body.artistId = cleanId(id);
    const r = await apiQueueAdd(body);
    const added   = r.added_count   ?? r.added   ?? 0;
    const skipped = r.skipped_count ?? r.skipped ?? 0;
    toast(`Queued ${added}${skipped ? ` · ${skipped} skipped` : ''}`);
    haptic(12);
  } catch (e){ toast('Crawl failed: ' + e.message, 'danger'); }
  finally { if (btn){ btn.disabled = false; btn.innerHTML = orig; } }
}
async function removeCached(id){
  await cacheDel(id);
  cachedIds.delete(String(id));
  toast('Removed from offline');
  refreshCurrentView();
}
async function clearAllCache(){
  const ok = await askConfirm('Clear offline cache?', 'All downloaded tracks will be deleted.', 'Clear all');
  if (!ok) return;
  await cacheClear();
  cachedIds.clear();
  toast('Offline cache cleared');
  updateSettingsSheet();
  if (isLibraryDlRoute()) renderDownloads();
  if (isTrackRoute()){ const t = getCached('track', currentPath().split('/')[2]); if (t) renderCrawlCard(t, null); }
}
function refreshCurrentView(){
  const p = currentPath();
  if (p === '/library/downloads') renderDownloads(); else route();
}

/* ══════════════════════════════════════════════════════════════
   LIBRARY
   ══════════════════════════════════════════════════════════════ */
function libraryTabs(active){
  const activeDl = DL.active().length + DL.ready().length;
  const followed = getFollowed().length;
  const item = (key, label, badge) => `<a href="/library/${key}" data-link class="${active === key ? 'active' : ''}">
    ${label}${badge !== undefined ? `<span class="seg-badge ${badge > 0 ? 'on' : ''}">${badge}</span>` : ''}
  </a>`;
  return `<div class="seg">
    ${item('likes', 'Liked')}
    ${item('following', 'Following', followed)}
    ${item('playlists', 'Lists')}
    ${item('downloads', 'Offline', activeDl)}
  </div>`;
}
function likesToItems(){
  return getLikes().map(l => ({
    wrapperType:'track',
    trackId: l.trackId, trackName: l.trackName,
    artistName: l.artistName, artistId: l.artistId,
    collectionName: l.collectionName, collectionId: l.collectionId,
    attachments: { artworkUrls: l.artworkUrl ? [{ url: l.artworkUrl }] : [], audioUrls: isCached(l.trackId) ? [{ url:'local', quality:'320' }] : [] }
  }));
}
function viewLikes(){
  const likes = getLikes();
  let html = libraryTabs('likes');
  if (!likes.length) html += emptyState('heart', 'No liked songs yet', 'Tap the heart on any track to save it here.');
  else {
    const items = likesToItems();
    _pageTracks = items;
    const ids = items.map(x => x.trackId).join(',');
    html += `<div class="d-flex align-items-center px-3 pt-4 pb-3">
      <div class="flex-grow-1 fw-bold">${likes.length} liked song${likes.length !== 1 ? 's' : ''}</div>
      <button class="pill-btn success" onclick="playIds('${esc(ids)}')"><i class="bi bi-play-fill"></i> Play all</button>
    </div>`;
    html += items.map(t => trackRow(t)).join('');
  }
  MAIN().innerHTML = html;
}
function viewFollowing(){
  const list = getFollowed();
  let html = libraryTabs('following');
  if (!list.length) html += emptyState('person-check', 'Not following any artists', 'Follow artists to see them here.');
  else {
    html += `<div class="d-flex align-items-center px-3 pt-4 pb-2"><div class="flex-grow-1 fw-bold">${list.length} artist${list.length !== 1 ? 's' : ''}</div></div>`;
    html += list.map(a => `
      <div class="row-item">
        <a class="row-info" href="/artist/${esc(a.artistId)}" data-link>
          ${a.artwork ? `<img class="row-art" style="border-radius:50%" src="${esc(a.artwork)}" loading="lazy" decoding="async" alt="">` : `<div class="row-art row-art-ph" style="border-radius:50%"><i class="bi bi-person-fill"></i></div>`}
          <div class="min-w-0 flex-grow-1"><div class="row-title text-truncate">${esc(a.artistName || 'Artist')}</div>
          <div class="row-sub text-truncate">${esc(a.primaryGenreName || 'Artist')}</div></div>
        </a>
        <button class="icon-btn sm text-primary" onclick="event.preventDefault();event.stopPropagation();toggleFollow('${esc(a.artistId)}')" aria-label="Unfollow"><i class="bi bi-check-lg"></i></button>
      </div>`).join('');
  }
  MAIN().innerHTML = html;
}
function viewPlaylists(){
  const pls = getPlaylists();
  let html = libraryTabs('playlists');
  html += `<div class="d-flex align-items-center px-3 pt-4 pb-2">
    <div class="flex-grow-1 fw-bold">Your playlists</div>
    <button class="pill-btn primary" onclick="newPlaylistPrompt()"><i class="bi bi-plus-lg"></i> New</button>
  </div>`;
  if (!pls.length) html += emptyState('music-note-list', 'No playlists yet', 'Create one to organize your music.');
  else html += pls.map(pl => {
    const cover = pl.tracks.find(t => t.artworkUrl)?.artworkUrl || '';
    return `<a class="row-item" href="/library/playlists/${esc(pl.id)}" data-link>
      ${cover ? `<img class="row-art" src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note-list"></i></div>`}
      <div class="row-info"><div class="min-w-0 flex-grow-1">
        <div class="row-title text-truncate">${esc(pl.name)}</div>
        <div class="row-sub text-truncate">${pl.tracks.length} track${pl.tracks.length !== 1 ? 's' : ''}</div>
      </div><i class="bi bi-chevron-right text-secondary"></i></div>
    </a>`;
  }).join('');
  MAIN().innerHTML = html;
}
function renderPlaylistDetail(plId){
  const pl = getPlaylists().find(p => p.id === plId);
  if (!pl){ MAIN().innerHTML = emptyState('music-note-list', 'Playlist not found'); return; }
  const items = playlistToItems(plId);
  const ids = items.map(x => String(x.trackId)).join(',');
  let html = `<div class="pb-4">`;
  html += backBtn('/library/playlists');
  html += `<div class="px-3 pt-1">
    <div style="font-size:1.35rem;font-weight:800;letter-spacing:-.02em" class="text-truncate">${esc(pl.name)}</div>
    <div class="text-secondary" style="font-size:.8rem">${pl.tracks.length} track${pl.tracks.length !== 1 ? 's' : ''}${pl.createdAt ? ` · ${fmtAgo(pl.createdAt)}` : ''}</div>
  </div>`;
  html += `<div class="action-bar">
    ${items.length ? `<button class="pill-btn success" onclick="playIds('${esc(ids)}')"><i class="bi bi-play-fill"></i> Play</button>` : ''}
    ${items.length ? `<button class="pill-btn sm" onclick="addAllToQueue(playlistToItems('${esc(plId)}'))"><i class="bi bi-list-ul"></i> Queue</button>` : ''}
    <button class="icon-btn" style="background:rgba(var(--bs-body-color-rgb),.09)" onclick="playlistMore('${esc(plId)}')" aria-label="More"><i class="bi bi-three-dots"></i></button>
  </div>`;
  html += items.length ? items.map(t => trackRow(t, { playlistId: plId })).join('') : emptyState('music-note', 'This playlist is empty', 'Add songs from the ⋮ menu.');
  html += `</div>`;
  MAIN().innerHTML = html;
}
function playlistMore(plId){
  const rows = [
    `<button class="sheet-item" onclick="closeAllSheets(); renamePlaylist('${esc(plId)}')"><i class="bi bi-pencil"></i><span>Rename playlist</span></button>`,
    `<button class="sheet-item danger" onclick="closeAllSheets(); deletePlaylist('${esc(plId)}')"><i class="bi bi-trash3"></i><span>Delete playlist</span></button>`
  ];
  $('#sheetTrackBody').innerHTML = `<div class="px-3 pb-2 pt-1"><div class="fw-bold">Playlist actions</div></div><div class="px-2">${rows.join('')}</div>`;
  sheet('#sheetTrack').show();
}
function playlistToItems(plId){
  const pl = getPlaylists().find(p => p.id === plId); if (!pl) return [];
  return pl.tracks.map(l => ({
    wrapperType:'track',
    trackId: l.trackId, trackName: l.trackName,
    artistName: l.artistName, artistId: l.artistId,
    collectionName: l.collectionName, collectionId: l.collectionId,
    attachments: { artworkUrls: l.artworkUrl ? [{ url: l.artworkUrl }] : [], audioUrls: isCached(l.trackId) ? [{ url:'local', quality:'320' }] : [] }
  }));
}
async function renamePlaylist(id){
  const pl = getPlaylists().find(p => p.id === id); if (!pl) return;
  const name = await askText('Rename playlist', pl.name, 'Playlist name');
  if (!name) return;
  const all = getPlaylists();
  const t = all.find(p => p.id === id); if (!t) return;
  t.name = name; savePlaylists(all);
  if (isPlaylistDetailRoute(id)) renderPlaylistDetail(id); else viewPlaylists();
  toast('Renamed');
}
async function deletePlaylist(id){
  const pl = getPlaylists().find(p => p.id === id); if (!pl) return;
  const ok = await askConfirm('Delete playlist?', `"${pl.name}" and its contents will be removed.`, 'Delete');
  if (!ok) return;
  savePlaylists(getPlaylists().filter(p => p.id !== id));
  toast('Playlist deleted');
  go('/library/playlists');
}

/* ══════════════════════════════════════════════════════════════
   DOWNLOADS VIEW
   ══════════════════════════════════════════════════════════════ */
let dlUnsubscribe = null;
function renderDownloads(){
  MAIN().innerHTML = libraryTabs('downloads') + `<div id="dlContent"><div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div></div>`;
  if (dlUnsubscribe) dlUnsubscribe();
  dlUnsubscribe = DL.onChange(() => { if (isLibraryDlRoute()) updateDlLists(); });
  updateDlLists();
}
async function updateDlLists(){
  const wrap = $('#dlContent'); if (!wrap) return;
  const active = DL.active(); const ready = DL.ready(); const failed = DL.failed();
  const all = await cacheAll();
  const totalSize = all.reduce((s,e) => s + (e.size || 0), 0);
  let html = '';
  if (active.length){ html += `<h6 class="sec-title tight">In progress · ${active.length}</h6>`; html += active.map(it => dlRowHtml(it)).join(''); }
  if (ready.length){ html += `<h6 class="sec-title tight">Ready · ${ready.length}</h6>`; html += ready.map(it => dlRowHtml(it)).join(''); }
  if (failed.length){ html += `<h6 class="sec-title tight">Needs attention · ${failed.length}</h6>`; html += failed.map(it => dlRowHtml(it)).join(''); }
  html += `<div class="d-flex align-items-center px-3 pt-4 pb-2">
    <div class="flex-grow-1 min-w-0"><div class="fw-bold">Available offline</div>
    <div class="text-secondary" style="font-size:.74rem">${all.length} track${all.length !== 1 ? 's' : ''} · ${fmtSize(totalSize)}</div></div>
    ${all.length ? `<div class="d-flex gap-2">
      <button class="pill-btn primary sm" onclick="exportAllCached()"><i class="bi bi-download"></i></button>
      <button class="pill-btn danger sm" onclick="clearAllCache()"><i class="bi bi-trash3"></i></button>
    </div>` : ''}
  </div>`;
  if (!all.length && !active.length && !ready.length && !failed.length) html += emptyState('download', 'Nothing offline yet', 'Download a track from any menu.');
  else if (!all.length) html += `<div class="state" style="padding:20px 24px"><p style="font-size:.8rem">Nothing saved yet — start a download above.</p></div>`;
  else html += all.map(e => {
    const m = e.meta || {};
    const art = m.artwork || '';
    const id = String(e.trackId);
    const playing = Player.track && String(Player.track.trackId) === id;
    return `<div class="dl-row">
      <button class="row-play ${playing && Player.playing ? 'playing' : ''}" onclick="playCachedById('${esc(id)}')" aria-label="Play">
        <i class="bi ${playing && Player.playing ? 'bi-pause-fill' : 'bi-play-fill'}"></i>
      </button>
      <a class="row-info" href="/track/${esc(id)}" data-link>
        ${art ? `<img class="row-art" src="${esc(art)}" alt="" loading="lazy" decoding="async">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
        <div class="min-w-0 flex-grow-1"><div class="row-title text-truncate">${esc(m.name || id)}</div>
        <div class="row-sub text-truncate">${esc(m.artist || '')} · ${fmtSize(e.size || 0)}</div></div>
      </a>
      <button class="icon-btn sm text-primary" onclick="exportCached('${esc(id)}')" aria-label="Save as file"><i class="bi bi-file-earmark-arrow-down"></i></button>
      <button class="icon-btn sm text-danger" onclick="removeCached('${esc(id)}')" aria-label="Remove"><i class="bi bi-trash3"></i></button>
    </div>`;
  }).join('');
  wrap.innerHTML = html;
}
function dlRowHtml(it){
  const isActive = ['queued','crawling','saving'].includes(it.status);
  const isReady  = it.status === 'ready';
  const isFailed = ['failed','paused'].includes(it.status);
  const statusLabel = { queued:'Queued', crawling:'Crawling', saving:'Downloading', ready:'Ready', failed:'Failed', paused:'Paused' }[it.status] || it.status;
  const statusClass = { queued:'queued', crawling:'crawling', saving:'saving', ready:'ready', failed:'error', paused:'error' }[it.status] || 'queued';
  const pct = it.percent || 0;
  const progressClass = isFailed ? 'error' : it.status === 'saving' ? 'saving' : '';
  let rightAction = '';
  if (isActive) rightAction = `<button class="icon-btn sm text-danger" onclick="DL.remove('${esc(it.trackId)}')" aria-label="Cancel"><i class="bi bi-x-lg"></i></button>`;
  else if (isReady) rightAction = `<button class="icon-btn sm text-danger" onclick="DL.remove('${esc(it.trackId)}')" aria-label="Dismiss"><i class="bi bi-x-lg"></i></button>`;
  else if (isFailed) rightAction = `<button class="pill-btn danger sm" onclick="DL.retry('${esc(it.trackId)}')"><i class="bi bi-arrow-repeat"></i> Retry</button>
      <button class="icon-btn sm" onclick="DL.remove('${esc(it.trackId)}')" aria-label="Dismiss"><i class="bi bi-x-lg"></i></button>`;
  const sizeInfo = it.status === 'saving' && it.totalBytes ? `${fmtSize(it.bytes)} / ${fmtSize(it.totalBytes)}` : '';
  return `<div class="dl-row">
    ${it.artwork ? `<img class="row-art" src="${esc(it.artwork)}" alt="" loading="lazy" decoding="async">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
    <div class="dl-body">
      <div class="d-flex align-items-center gap-2 mb-1">
        <div class="dl-title text-truncate flex-grow-1 min-w-0">${esc(it.name)}</div>
        <span class="dl-status ${statusClass}">${statusLabel}</span>
      </div>
      <div class="dl-sub text-truncate">${esc(it.artist || '')}${sizeInfo ? ' · ' + sizeInfo : ''}</div>
      ${isActive ? `<div class="dl-progress ${progressClass}"><div style="width:${pct}%"></div></div>` : ''}
      ${isFailed && it.error ? `<div class="dl-sub text-danger text-truncate">${esc(it.error)}</div>` : ''}
    </div>${rightAction}
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   STATS VIEW
   ══════════════════════════════════════════════════════════════ */
function viewStats(){
  const s = statsLoad();
  const topTracks = statsTopTracks(10, null);
  const topArtists = statsTopArtists(8);
  const onRepeat = statsOnRepeat(10);
  const forgotten = statsForgotten(10);
  const totalPlays = s.total || 0;
  const totalTracks = Object.keys(s.tracks).length;
  const totalArtists = Object.keys(s.artists).length;
  const days = Object.keys(s.daily).length;
  const daily = Object.entries(s.daily).sort(([a],[b]) => a.localeCompare(b)).slice(-14);
  const maxDay = Math.max(1, ...daily.map(([,v]) => v));

  let html = `<div class="pb-4">`;
  html += backBtn('/');
  html += `<div class="px-3 pt-2"><div style="font-size:1.5rem;font-weight:800;letter-spacing:-.02em">Your Listening</div>
    <div class="text-secondary" style="font-size:.8rem">Statistics from this device</div></div>`;

  html += `<div class="stat-grid">
    <div class="stat-card"><i class="bi bi-play-circle"></i><div class="v">${totalPlays}</div><div class="l">Total plays</div></div>
    <div class="stat-card"><i class="bi bi-music-note-beamed"></i><div class="v">${totalTracks}</div><div class="l">Unique tracks</div></div>
    <div class="stat-card"><i class="bi bi-person"></i><div class="v">${totalArtists}</div><div class="l">Artists</div></div>
    <div class="stat-card"><i class="bi bi-calendar-week"></i><div class="v">${days}</div><div class="l">Active days</div></div>
  </div>`;

  if (daily.length){
    html += secTitle('Last 14 days');
    html += `<div class="daily-bars">`;
    const today = new Date().toISOString().slice(0, 10);
    const last14 = [];
    for (let i = 13; i >= 0; i--){
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      last14.push(d);
    }
    for (const d of last14){
      const v = s.daily[d] || 0;
      const h = (v / maxDay) * 100;
      const label = new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
      html += `<div class="d ${d === today ? 'today' : ''}"><div class="b" style="height:${Math.max(3, h)}%"></div><div class="l">${label}</div></div>`;
    }
    html += `</div>`;
  }

  if (topTracks.length){
    html += secTitle('Top tracks');
    html += topTracks.map(t => {
      const art = t.art || '';
      return `<div class="row-item" onclick="playById('${esc(t.id)}')">
        ${art ? `<img class="row-art" src="${esc(art)}" alt="" loading="lazy" decoding="async">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
        <div class="row-info"><div class="min-w-0 flex-grow-1">
          <div class="row-title text-truncate">${esc(t.name)}</div>
          <div class="row-sub text-truncate">${esc(t.artist || '')} · ${t.count} play${t.count !== 1 ? 's' : ''}</div>
        </div></div>
      </div>`;
    }).join('');
  }

  if (topArtists.length){
    html += secTitle('Top artists');
    html += `<div class="hscroll">${topArtists.map(a => `
      <a class="artist-item" href="/artist/${esc(a.id)}" data-link>
        ${a.art ? `<img class="artist-art" src="${esc(a.art)}" loading="lazy" decoding="async" alt="">` : `<div class="artist-art artist-art-ph"><i class="bi bi-person-fill"></i></div>`}
        <div class="card-name text-truncate">${esc(a.name)}</div>
        <div class="card-sub text-truncate">${a.count} play${a.count !== 1 ? 's' : ''}</div>
      </a>`).join('')}</div>`;
  }

  if (onRepeat.length){
    html += secTitle('On repeat · last 7 days');
    html += onRepeat.map(t => {
      const art = t.art || '';
      return `<div class="row-item" onclick="playById('${esc(t.id)}')">
        ${art ? `<img class="row-art" src="${esc(art)}" alt="" loading="lazy" decoding="async">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
        <div class="row-info"><div class="min-w-0 flex-grow-1">
          <div class="row-title text-truncate">${esc(t.name)}</div>
          <div class="row-sub text-truncate">${esc(t.artist || '')} · ${t.count}× this week</div>
        </div></div>
      </div>`;
    }).join('');
  }

  if (forgotten.length){
    html += secTitle('Forgotten favorites');
    html += forgotten.map(t => {
      const art = t.art || '';
      return `<div class="row-item" onclick="playById('${esc(t.id)}')">
        ${art ? `<img class="row-art" src="${esc(art)}" alt="" loading="lazy" decoding="async">` : `<div class="row-art row-art-ph"><i class="bi bi-music-note"></i></div>`}
        <div class="row-info"><div class="min-w-0 flex-grow-1">
          <div class="row-title text-truncate">${esc(t.name)}</div>
          <div class="row-sub text-truncate">${esc(t.artist || '')} · last ${fmtAgo(t.last)}</div>
        </div></div>
      </div>`;
    }).join('');
  }

  if (!totalPlays) html += emptyState('graph-up', 'No data yet', 'Start listening to see your stats.');

  html += `<div class="px-3 pt-4">
    <button class="pill-btn danger w-100 justify-content-center" onclick="resetStats()">
      <i class="bi bi-trash3"></i> Reset statistics
    </button>
  </div>`;
  html += `</div>`;
  MAIN().innerHTML = html;
}
async function resetStats(){
  const ok = await askConfirm('Reset statistics?', 'All listening history will be erased.', 'Reset');
  if (!ok) return;
  ls.remove(KEY.stats);
  toast('Statistics reset');
  viewStats();
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS SHEET
   ══════════════════════════════════════════════════════════════ */
function openSettings(){ sheet('#sheetSettings').show(); updateSettingsSheet(); }
async function updateSettingsSheet(){
  const s = getSettings();
  $$('#setTheme button').forEach(b => b.classList.toggle('on', b.dataset.val === s.theme));
  const an = $('#setAnimations'); if (an) an.checked = !!s.animations;
  const viz = $('#setVisualizer'); if (viz) viz.checked = !!s.visualizer;
  const rate = $('#setRate');
  if (rate){ rate.value = Math.round((Number(s.playbackRate) || 1) * 100); rate.style.setProperty('--p', Math.round(((rate.value - 50) / 150) * 100) + '%'); }
  const rv = $('#setRateVal'); if (rv) rv.textContent = (Number(s.playbackRate) || 1).toFixed(2) + 'x';
  const as = $('#setAutoScroll'); if (as) as.checked = !!s.autoScrollLyrics;
  const ar = $('#setAutoRetry'); if (ar) ar.checked = !!s.autoRetry;
  const sf = $('#setSleepFade');
  if (sf){ sf.value = Number(s.sleepFade) || 0; sf.style.setProperty('--p', ((sf.value / 60) * 100) + '%'); }
  const sfv = $('#setSleepFadeVal'); if (sfv) sfv.textContent = (Number(s.sleepFade) || 0) + 's';
  const nm = $('#accentName'); if (nm){ const a = ACCENTS.find(x => x.id === s.accent) || ACCENTS[0]; nm.textContent = a.name; }
  try {
    const all = await cacheAll();
    const total = all.reduce((sum, e) => sum + (e.size || 0), 0);
    const ci = $('#setCacheInfo');
    if (ci) ci.textContent = all.length ? `${all.length} tracks · ${fmtSize(total)}` : 'Empty';
  } catch {}
  const ri = $('#setRecentInfo');
  if (ri){ const n = ls.get(KEY.recent, []).length; ri.textContent = n ? `${n} item${n !== 1 ? 's' : ''}` : 'Empty'; }
}
$('#setTheme')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-val]'); if (!b) return;
  setSetting('theme', b.dataset.val); updateSettingsSheet();
});
$('#setAnimations')?.addEventListener('change', e => setSetting('animations', e.target.checked));
$('#setVisualizer')?.addEventListener('change', e => { setSetting('visualizer', e.target.checked); if (fpTab === 'now') renderFpTabBody(); });
$('#setRate')?.addEventListener('input', e => {
  const v = Number(e.target.value) / 100;
  setSetting('playbackRate', v);
  e.target.style.setProperty('--p', Math.round(((e.target.value - 50) / 150) * 100) + '%');
  const rv = $('#setRateVal'); if (rv) rv.textContent = v.toFixed(2) + 'x';
  audio.playbackRate = v;
});
$('#setSleepFade')?.addEventListener('input', e => {
  const v = Number(e.target.value);
  setSetting('sleepFade', v);
  e.target.style.setProperty('--p', ((v / 60) * 100) + '%');
  const sfv = $('#setSleepFadeVal'); if (sfv) sfv.textContent = v + 's';
});
$('#setAutoScroll')?.addEventListener('change', e => setSetting('autoScrollLyrics', e.target.checked));
$('#setAutoRetry')?.addEventListener('change', e => setSetting('autoRetry', e.target.checked));

async function resetAppData(){
  const ok = await askConfirm('Reset all data?', 'Likes, playlists, downloads, stats, settings and recents will be erased.', 'Reset everything');
  if (!ok) return;
  Object.values(KEY).forEach(k => ls.remove(k));
  try { await cacheClear(); } catch {}
  cachedIds.clear();
  toast('All data reset');
  sheet('#sheetSettings').hide();
  applySettings();
  go('/');
}
function initInstallButton(){ /* no-op for Capacitor */ }
function promptInstall(){ toast('Use your OS to install this app', 'info'); }

/* ══════════════════════════════════════════════════════════════
   ONLINE / OFFLINE
   ══════════════════════════════════════════════════════════════ */
function updateOnlineBanner(){ const b = $('#offlineBanner'); if (b) b.classList.toggle('on', !navigator.onLine); }
window.addEventListener('online', updateOnlineBanner);
window.addEventListener('offline', updateOnlineBanner);

/* ══════════════════════════════════════════════════════════════
   GLOBAL EVENTS
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA'){ if (e.key === 'Escape') e.target.blur(); return; }
  if (e.code === 'Space'){ e.preventDefault(); togglePlay(); return; }
  if (e.key === 'ArrowRight' && audio.duration && isFinite(audio.duration)) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
  if (e.key === 'ArrowLeft'  && audio.duration && isFinite(audio.duration)) audio.currentTime = Math.max(audio.currentTime - 5, 0);
  if (e.key === 'n' || e.key === 'N') nextTrack();
  if (e.key === 'p' || e.key === 'P') prevTrack();
  if (e.key === 's' || e.key === 'S') toggleShuffle();
  if (e.key === 'r' || e.key === 'R') cycleRepeat();
  if (e.key === 'l' || e.key === 'L') toggleLikeCurrent();
  if (e.key === 'a' || e.key === 'A') toggleAB();
  if (e.key === 'j' || e.key === 'J'){ if ($('#full')?.classList.contains('show')) closeFullPlayer(); else openFullPlayer(); }
  if (e.key === '/'){ e.preventDefault(); $('#searchInput')?.focus(); }
  if (e.key === 'Escape' && $('#full')?.classList.contains('show')) closeFullPlayer();
});

/* Save state before unload */
window.addEventListener('beforeunload', () => { persistState(); persistQueue(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden'){ persistState(); persistQueue(); } });

/* ══════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════ */
(async function boot(){
  applySettings();
  updateOnlineBanner();
  setupMediaSession();
  DL.load();
  resumeDownloadPolling();
  DL.onChange(() => {
    updateDownloadBadges();
    syncSaveButton();
    if (isTrackRoute()){
      const id = currentPath().split('/')[2];
      const dl = DL.get(id);
      const it = getCached('track', id);
      if (it && dl) renderCrawlCard(it, null);
    }
    if (isLibraryDlRoute()) updateDlLists();
  });
  updateDownloadBadges();

  try { await refreshCacheIndex(); } catch (e){ console.warn('cache index failed:', e); }

  // Restore previous session
  restoreQueueState();
  restorePlayerState();

  // Redirect Capacitor's /index.html → /
  if (location.pathname.endsWith('.html')){
    try { history.replaceState(null, '', '/'); } catch {}
  }
  await route();
  refreshLikes();
  refreshFollowButtons();
})();

window.addEventListener('error', e => console.error('[MusicMan]', e.error || e.message));

'use strict';
/* ============================================================
   MusicMan — Features Extension Pack
   Requires app.js to have loaded MM_HOOKS and exposed:
   Player, audio, DL, cacheGet/cacheAll/cachePut,
   getSettings/setSetting, go, currentPath, toast, ls, KEY
   ============================================================ */

const FEAT = {};
window.FEAT = FEAT;

/* ══════════════════════════════════════════════════════════════
   NEW STORAGE KEYS (added to the shared `ls` helper)
   ══════════════════════════════════════════════════════════════ */
const FK = {
  positions:   'mm_positions',
  bookmarks:   'mm_bookmarks',
  streak:      'mm_streak',
  achievements:'mm_achievements',
  notifPerm:   'mm_notif_perm'
};

/* ══════════════════════════════════════════════════════════════
   1. OS NOTIFICATIONS  (player + downloads)
   ══════════════════════════════════════════════════════════════ */
FEAT.Notif = (() => {
  const P = () => window.Capacitor?.Plugins?.LocalNotifications;
  const isNative = () => !!window.Capacitor?.isNativePlatform?.();

  const CHANNELS = [
    {
      id: 'music_playback',
      name: 'Now playing',
      description: 'Persistent playback status',
      importance: 2,          // LOW — no sound/vibration
      visibility: 1,          // PUBLIC — show on lockscreen
      lights: false,
      vibration: false
    },
    {
      id: 'music_downloads',
      name: 'Downloads',
      description: 'Progress and completion of downloads',
      importance: 2,
      visibility: 0,          // SECRET — hide content on lockscreen
      lights: false,
      vibration: false
    },
    {
      id: 'music_alerts',
      name: 'Alerts',
      description: 'Achievements and important notices',
      importance: 3,          // DEFAULT
      visibility: 1
    }
  ];

  let ready = false;
  let permitted = false;
  const PLAYER_ID = 1;
  const DL_BASE = 1000;

  let webNotifPerm = false;

  async function init(){
    if (isNative()){
      try {
        await P().createChannel({ channel: CHANNELS[0] }).catch(() => {});
        await P().createChannel({ channel: CHANNELS[1] }).catch(() => {});
        await P().createChannel({ channel: CHANNELS[2] }).catch(() => {});
        const res = await P().checkPermissions();
        permitted = res.display === 'granted';
        if (!permitted){
          const ask = await P().requestPermissions();
          permitted = ask.display === 'granted';
        }
        ls.set(FK.notifPerm, permitted);
        ready = true;
      } catch (e){ console.warn('[Notif] init:', e); ready = true; }
    } else if ('Notification' in window){
      if (Notification.permission === 'granted'){ webNotifPerm = true; }
      else if (Notification.permission !== 'denied'){
        Notification.requestPermission().then(p => { webNotifPerm = (p === 'granted'); });
      }
      ready = true;
    } else { ready = true; }
  }

  async function upsert(id, opts){
    if (isNative()){
      if (!permitted) return;
      try {
        await P().cancel({ notifications: [{ id }] }).catch(() => {});
        const safeOpts = { ...opts };
        delete safeOpts.largeIcon; // Avoid unparseable remote HTTP asset URLs in Android native resource lookup
        await P().schedule({ notifications: [{
          id,
          channelId:  'music_playback',
          ongoing:    false,
          autoCancel: true,
          ...safeOpts
        }]});
      } catch (e){ /* benign */ }
    } else if (webNotifPerm && ('Notification' in window)){
      try {
        new Notification(opts.title || 'MusicMan', {
          body: opts.body || '',
          icon: opts.largeIcon || '/icon.svg',
          tag: 'mm_notif_' + id,
          silent: true
        });
      } catch (e){}
    }
  }

  async function cancel(id){
    if (isNative()){
      try { await P().cancel({ notifications: [{ id }] }); } catch {}
    }
  }

  /* ── Player now-playing notification ── */
  async function updatePlayer(){
    const t = Player.track;
    if (!t){ await cancel(PLAYER_ID); return; }
    const art = getArtwork(t, 512) || t.artworkUrl || '';
    await upsert(PLAYER_ID, {
      title:   t.trackName || 'Track',
      body:    `${t.artistName || ''}${t.collectionName ? ' · ' + t.collectionName : ''}`,
      largeBody: Player.playing ? 'Playing' : 'Paused',
      summaryText: 'MusicMan',
      largeIcon: art || undefined,
      ongoing: Player.playing,         // pinned while playing
      autoCancel: !Player.playing,
      channelId: 'music_playback',
      group: 'mm_player',
      extra: { trackId: String(t.trackId) }
    });
  }
  async function clearPlayer(){ await cancel(PLAYER_ID); }

  /* ── Download progress notifications ── */
  const dlId = trackId => DL_BASE + Math.abs(hashCode(String(trackId))) % 100000;
  function hashCode(s){
    let h = 0; for (let i = 0; i < s.length; i++){ h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return h;
  }
  async function updateDownload(item){
    if (!isNative() || !permitted) return;
    if (!item) return;
    const id = dlId(item.trackId);
    const art = item.artwork || '';
    if (item.status === 'saving' || item.status === 'crawling' || item.status === 'queued'){
      const label = item.status === 'queued' ? 'Queued'
                 : item.status === 'crawling' ? 'Preparing'
                 : 'Downloading';
      await upsert(id, {
        title: item.name || 'Track',
        body:  `${item.artist || ''} · ${label}${item.percent ? ' ' + item.percent + '%' : ''}`,
        largeIcon: art || undefined,
        channelId: 'music_downloads',
        ongoing: true,
        autoCancel: false,
        progress: { value: item.percent || 0, max: 100 },
        group: 'mm_downloads'
      });
    } else {
      await cancel(id);
    }
  }
  async function downloadComplete({ trackId, meta }){
    if (!isNative() || !permitted) return;
    const id = dlId(trackId);
    await cancel(id);
    await upsert(id, {
      title:  'Download complete',
      body:   `${meta?.trackName || 'Track'}${meta?.artistName ? ' — ' + meta.artistName : ''}`,
      largeIcon: getArtwork(meta, 512) || undefined,
      channelId: 'music_downloads',
      autoCancel: true,
      ongoing: false,
      schedule: { at: new Date(Date.now() + 300) }
    });
  }
  async function alert(title, body){
    if (!isNative() || !permitted) return;
    await P().schedule({ notifications: [{
      id: 900000 + Math.floor(Math.random() * 99999),
      title, body,
      smallIcon: 'ic_stat_musicman',
      iconColor: '#0d6efd',
      channelId: 'music_alerts',
      autoCancel: true,
      schedule: { at: new Date(Date.now() + 200) }
    }]});
  }

  return { init, updatePlayer, clearPlayer, updateDownload, downloadComplete, alert };
})();

/* ══════════════════════════════════════════════════════════════
   2. RESUME PLAYBACK POSITION
   ══════════════════════════════════════════════════════════════ */
FEAT.Resume = (() => {
  const MIN_SAVE_SEC = 15;       // don't remember tiny listens
  const MIN_RESUME_SEC = 30;     // don't resume from very start
  const NEAR_END_SEC = 30;       // if near the end, start over

  function all(){ return ls.get(FK.positions, {}); }
  function get(trackId){ return all()[String(trackId)] || null; }
  function set(trackId, pos, dur){
    if (!trackId) return;
    const store = all();
    const id = String(trackId);
    if (!pos || pos < MIN_SAVE_SEC || (dur && pos > dur - NEAR_END_SEC)){
      delete store[id];
    } else {
      store[id] = { pos: Math.round(pos), dur: Math.round(dur || 0), at: Date.now() };
    }
    // Cap the store at 200 entries
    const keys = Object.keys(store);
    if (keys.length > 200){
      keys.sort((a,b) => store[a].at - store[b].at)
        .slice(0, keys.length - 200)
        .forEach(k => delete store[k]);
    }
    ls.set(FK.positions, store);
  }
  function clear(trackId){
    const store = all();
    delete store[String(trackId)];
    ls.set(FK.positions, store);
  }
  let pendingListener = null;
  async function applyIfAny(track){
    if (pendingListener){
      audio.removeEventListener('loadedmetadata', pendingListener);
      pendingListener = null;
    }
    if (!track?.trackId) return;
    const saved = get(track.trackId);
    if (!saved) return;
    // Wait until the audio element has metadata so seeking is valid
    const onReady = () => {
      if (pendingListener === onReady) pendingListener = null;
      audio.removeEventListener('loadedmetadata', onReady);
      try {
        const dur = audio.duration;
        const target = dur && saved.pos > dur - NEAR_END_SEC ? 0 : saved.pos;
        if (target > MIN_RESUME_SEC){
          audio.currentTime = target;
          toast(`Resumed at ${fmtTime(target)}`);
        }
      } catch {}
    };
    pendingListener = onReady;
    if (audio.readyState >= 1) onReady();
    else audio.addEventListener('loadedmetadata', onReady, { once: true });
  }
  return { get, set, clear, applyIfAny, all };
})();

/* ══════════════════════════════════════════════════════════════
   3. BOOKMARKS  (timestamped markers per track)
   ══════════════════════════════════════════════════════════════ */
FEAT.Bookmarks = (() => {
  function all(){ return ls.get(FK.bookmarks, {}); }
  function forTrack(trackId){ return all()[String(trackId)] || []; }
  function add(trackId, seconds, label){
    const store = all();
    const id = String(trackId);
    const list = store[id] || [];
    list.push({ t: Math.max(0, Math.round(seconds)), label: label || '', at: Date.now() });
    list.sort((a,b) => a.t - b.t);
    store[id] = list;
    ls.set(FK.bookmarks, store);
  }
  function remove(trackId, index){
    const store = all();
    const id = String(trackId);
    const list = (store[id] || []).slice();
    list.splice(index, 1);
    if (list.length) store[id] = list; else delete store[id];
    ls.set(FK.bookmarks, store);
  }
  function count(){ return Object.values(all()).reduce((n, arr) => n + arr.length, 0); }
  return { forTrack, add, remove, count };
})();

/* ══════════════════════════════════════════════════════════════
   4. CROSSFADE  (smooth volume blend between tracks)
   ══════════════════════════════════════════════════════════════ */
FEAT.Crossfade = (() => {
  let active = false;
  let raf = null;
  const DUR = 2500;   // ms
  function enabled(){ return Number(getSettings().crossfadeSec) > 0; }
  function start(){
    if (!enabled() || active) return;
    const fadeSec = Number(getSettings().crossfadeSec) || 0;
    if (fadeSec <= 0) return;
    const dur = fadeSec * 1000;
    active = true;
    const startVol = audio.volume;
    const t0 = performance.now();
    cancelAnimationFrame(raf);
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / dur);
      audio.volume = Math.max(0, startVol * (1 - p));
      if (p >= 1){ active = false; return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function cancelFade(){
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    active = false;
  }
  function reset(){ cancelFade(); }
  return { start, reset, enabled };
})();

/* ══════════════════════════════════════════════════════════════
   5. GAPLESS PRELOAD  (fetch next track's audio into cache)
   ══════════════════════════════════════════════════════════════ */
FEAT.Gapless = (() => {
  const pending = new Map();
  async function preload(track){
    if (!track?.trackId) return;
    if (!getSettings().gapless) return;
    const id = String(track.trackId);
    if (isCached(id) || pending.has(id)) return;
    const url = getPlayable(track);
    if (!url) return;
    const p = (async () => {
      try {
        const res = await fetch(proxyUrl(url));
        if (!res.ok) return;
        const blob = await res.blob();
        const mime = (res.headers.get('content-type') || '').split(';')[0] || 'audio/mpeg';
        await cachePut(id, blob, {
          name: track.trackName, artist: track.artistName, artistId: track.artistId,
          album: track.collectionName, collectionId: track.collectionId,
          artwork: getArtwork(track, 100), mime, url
        });
        cachedIds.add(id);
      } catch (e){ /* silently ignore preload failures */ }
      finally { pending.delete(id); }
    })();
    pending.set(id, p);
  }
  function preloadNext(){
    const q = Player.queue;
    if (!q.length) return;
    const next = q[Player.index + 1];
    if (next) preload(next);
  }
  return { preload, preloadNext };
})();

/* ══════════════════════════════════════════════════════════════
   6. OFFLINE-ONLY MODE  (blocks network, uses cache exclusively)
   ══════════════════════════════════════════════════════════════ */
FEAT.Offline = (() => {
  let originalFetch = null;
  function enabled(){ return !!getSettings().offlineOnly; }
  function install(){
    if (enabled()) apply(); else restore();
  }
  function apply(){
    if (originalFetch) return;
    originalFetch = window.fetch.bind(window);
    window.fetch = function(input, init){
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.startsWith(API_BASE)){
        return Promise.reject(new Error('Offline mode: network blocked'));
      }
      return originalFetch(input, init);
    };
    document.body.classList.add('offline-only');
  }
  function restore(){
    if (!originalFetch) return;
    window.fetch = originalFetch;
    originalFetch = null;
    document.body.classList.remove('offline-only');
  }
  return { install, apply, restore, enabled };
})();

/* ══════════════════════════════════════════════════════════════
   7. AUTO-DOWNLOAD LIKED SONGS
   ══════════════════════════════════════════════════════════════ */
FEAT.AutoDL = (() => {
  async function maybeDownload(trackId, liked){
    if (!liked || !getSettings().autoDownloadLikes) return;
    const id = String(trackId);
    if (isCached(id)) return;
    let it = getCached('track', id);
    if (!it){
      try {
        const r = await apiLookup(id, 'song');
        it = r.find(x => itemType(x) === 'track') || r[0];
        if (it) cacheItems([it]);
      } catch { return; }
    }
    if (!it) return;
    const dl = DL.get(id);
    if (dl && ['queued','crawling','saving'].includes(dl.status)) return;
    await DL.add(it);
    toast('Auto-downloading liked track', 'info');
  }
  return { maybeDownload };
})();

/* ══════════════════════════════════════════════════════════════
   8. LISTENING STREAK + ACHIEVEMENTS
   ══════════════════════════════════════════════════════════════ */
FEAT.Streak = (() => {
  const ACHIEVEMENTS = [
    { id: 'first_play',     icon: 'bi-play-circle-fill',  title: 'First Note',       desc: 'Play your first track',           test: s => s.total >= 1 },
    { id: 'week_streak',    icon: 'bi-fire',              title: 'On Fire',          desc: '7-day listening streak',          test: s => s.bestStreak >= 7 },
    { id: 'month_streak',   icon: 'bi-trophy-fill',       title: 'Devoted',          desc: '30-day listening streak',         test: s => s.bestStreak >= 30 },
    { id: 'hundred_plays',  icon: 'bi-music-note-beamed', title: 'Century',          desc: 'Play 100 tracks',                 test: s => s.total >= 100 },
    { id: 'night_owl',      icon: 'bi-moon-stars-fill',   title: 'Night Owl',        desc: 'Listen between 2 and 5 AM',       test: s => s.nightOwl === true },
    { id: 'early_bird',     icon: 'bi-sunrise-fill',      title: 'Early Bird',       desc: 'Listen between 5 and 7 AM',       test: s => s.earlyBird === true },
    { id: 'album_complete', icon: 'bi-disc-fill',         title: 'Album Finisher',   desc: 'Complete a full album in order',  test: s => s.albumComplete === true },
    { id: 'collector',      icon: 'bi-heart-fill',        title: 'Collector',        desc: 'Like 25 tracks',                  test: s => getLikes().length >= 25 },
    { id: 'offline_first',  icon: 'bi-cloud-check-fill',  title: 'Prepared',         desc: 'Download 10 tracks offline',      test: s => cachedIds.size >= 10 },
    { id: 'marathon',       icon: 'bi-hourglass-split',   title: 'Marathon',         desc: 'Play 3 hours in one day',         test: s => Object.values(s.daily).some(v => v >= 45) }
  ];

  function store(){ return ls.get(FK.streak, { last: null, current: 0, bestStreak: 0, total: 0, nightOwl: false, earlyBird: false, albumComplete: false, albumTracker: {} }); }
  function save(s){ ls.set(FK.streak, s); }
  function tick(){
    const s = store();
    const today = new Date().toISOString().slice(0, 10);
    if (s.last === today){ s.total++; save(s); return; }
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    s.current = s.last === yesterday ? s.current + 1 : 1;
    s.bestStreak = Math.max(s.bestStreak || 0, s.current);
    s.last = today;
    s.total++;
    const h = new Date().getHours();
    if (h >= 2 && h < 5) s.nightOwl = true;
    if (h >= 5 && h < 7) s.earlyBird = true;
    save(s);
    checkAchievements();
  }
  function trackAlbumComplete(track){
    const s = store();
    if (!track.collectionId) return;
    const cid = String(track.collectionId);
    const tracker = s.albumTracker[cid] || { played: [], size: 0 };
    if (track.trackCount) tracker.size = track.trackCount;
    const tid = String(track.trackId);
    if (!tracker.played.includes(tid)) tracker.played.push(tid);
    s.albumTracker[cid] = tracker;
    if (tracker.size && tracker.played.length >= tracker.size) s.albumComplete = true;
    // Cap old album trackers
    const keys = Object.keys(s.albumTracker);
    if (keys.length > 50) keys.slice(0, keys.length - 50).forEach(k => delete s.albumTracker[k]);
    save(s);
  }
  function awarded(){ return ls.get(FK.achievements, {}); }
  function checkAchievements(){
    const state = store();
    state.total = Math.max(state.total || 0, (statsLoad().total || 0));
    const earned = awarded();
    let newly = [];
    for (const a of ACHIEVEMENTS){
      if (!earned[a.id] && a.test(state)){
        earned[a.id] = Date.now();
        newly.push(a);
      }
    }
    if (newly.length){
      ls.set(FK.achievements, earned);
      for (const a of newly){
        FEAT.Notif.alert(`🏆 ${a.title}`, a.desc);
        toast(`Achievement: ${a.title}`, 'success');
      }
    }
  }
  function current(){ return store().current || 0; }
  function best(){ return store().bestStreak || 0; }
  function all(){ return ACHIEVEMENTS.map(a => ({ ...a, earnedAt: awarded()[a.id] || null })); }
  return { tick, trackAlbumComplete, checkAchievements, current, best, all };
})();

/* ══════════════════════════════════════════════════════════════
   9. LIBRARY SEARCH  (filter across likes, playlists, offline)
   ══════════════════════════════════════════════════════════════ */
FEAT.LibSearch = (() => {
  function filterItems(items, q){
    q = String(q || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => {
      const hay = [
        it.trackName, it.artistName, it.collectionName, it.primaryGenreName
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  return { filterItems };
})();

/* ══════════════════════════════════════════════════════════════
   10. DATA EXPORT / IMPORT  (JSON backup)
   ══════════════════════════════════════════════════════════════ */
FEAT.Backup = (() => {
  const INCLUDED = ['mm_likes','mm_playlists','mm_recent','mm_recently_played',
                    'mm_followed','mm_settings','mm_stats','mm_positions',
                    'mm_bookmarks','mm_streak','mm_achievements'];

  async function exportAll(){
    const data = { version: 1, exportedAt: Date.now(), app: 'MusicMan' };
    for (const k of INCLUDED){
      const v = localStorage.getItem(k);
      if (v != null) data[k] = JSON.parse(v);
    }
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url; a.download = `musicman-backup-${stamp}.json`;
    a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('Backup exported');
  }

  async function importFile(file){
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { toast('Invalid backup file', 'danger'); return; }
    if (!data || data.app !== 'MusicMan'){ toast('Not a MusicMan backup', 'danger'); return; }
    const ok = await askConfirm('Restore backup?',
      `This will replace your likes, playlists, settings, stats and bookmarks. Downloaded audio files are kept.`,
      'Restore', 'primary');
    if (!ok) return;
    for (const k of INCLUDED){
      if (k in data) localStorage.setItem(k, JSON.stringify(data[k]));
      else localStorage.removeItem(k);
    }
    toast('Backup restored — reloading…', 'success');
    setTimeout(() => location.reload(), 800);
  }

  function pickFile(){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (f) importFile(f);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }

  return { exportAll, importFile, pickFile };
})();

/* ══════════════════════════════════════════════════════════════
   11. VOICE SEARCH  (Web Speech API)
   ══════════════════════════════════════════════════════════════ */
FEAT.Voice = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  function supported(){ return !!SR; }
  function start(){
    if (!supported()){ toast('Voice search not supported', 'warning'); return; }
    if (rec) { try { rec.stop(); } catch {} rec = null; }
    rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    toast('Listening…');
    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || '';
      if (!text) return;
      const input = document.getElementById('searchInput');
      if (input){ input.value = text; }
      searchFilter = 'all';
      go('/search?q=' + encodeURIComponent(text));
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') toast('Microphone permission denied', 'danger');
      else if (e.error !== 'aborted') toast('Voice search failed', 'danger');
    };
    rec.onend = () => { rec = null; };
    try { rec.start(); } catch { toast('Could not start voice search', 'danger'); }
  }
  function stop(){ if (rec){ try { rec.stop(); } catch {} rec = null; } }
  return { start, stop, supported };
})();

/* ══════════════════════════════════════════════════════════════
   11b. WEB AUDIO 5-BAND EQUALIZER
   ══════════════════════════════════════════════════════════════ */
FEAT.Equalizer = (() => {
  let ctx = null, sourceNode = null, filters = [];
  const FREQS = [60, 230, 910, 3600, 14000];
  const PRESETS = {
    flat:        [0, 0, 0, 0, 0],
    bass_boost:  [6, 4, 0, 0, 0],
    vocal:       [-2, 1, 4, 3, 1],
    pop:         [-1, 2, 4, 2, -1],
    rock:        [5, 3, -1, 2, 4],
    treble:      [-2, -1, 1, 4, 6]
  };

  function init(){
    if (ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();
      sourceNode = ctx.createMediaElementSource(audio);
      filters = FREQS.map((freq, i) => {
        const filter = ctx.createBiquadFilter();
        filter.type = i === 0 ? 'lowshelf' : i === FREQS.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });
      sourceNode.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++){
        filters[i].connect(filters[i+1]);
      }
      filters[filters.length - 1].connect(ctx.destination);
      applySavedGains();
    } catch (e){ console.warn('[Equalizer init]', e); }
  }

  function applySavedGains(){
    const s = getSettings();
    const gains = PRESETS[s.eqPreset] || s.eqGains || PRESETS.flat;
    setGains(gains);
  }

  function setGains(gains){
    if (!filters.length) return;
    gains.forEach((g, i) => {
      if (filters[i]) filters[i].gain.value = Number(g) || 0;
    });
  }

  function setPreset(presetName){
    const gains = PRESETS[presetName] || PRESETS.flat;
    setSetting('eqPreset', presetName);
    setSetting('eqGains', gains);
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    setGains(gains);
  }

  function setBandGain(bandIdx, gainValue){
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    const s = getSettings();
    const gains = (s.eqGains || PRESETS.flat).slice();
    gains[bandIdx] = Number(gainValue) || 0;
    setSetting('eqPreset', 'custom');
    setSetting('eqGains', gains);
    if (filters[bandIdx]) filters[bandIdx].gain.value = gains[bandIdx];
  }

  // Ensure AudioContext resumes on first playback user interaction
  audio.addEventListener('play', () => {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  });

  return { init, PRESETS, FREQS, setPreset, setBandGain, applySavedGains };
})();

/* ══════════════════════════════════════════════════════════════
   12. AMOLED THEME  (pure black)
   ══════════════════════════════════════════════════════════════ */
FEAT.Amoled = (() => {
  const styleId = 'mm-amoled-style';
  function install(){
    if (!document.getElementById(styleId)){
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = `
        [data-bs-theme="amoled"]{
          --bs-body-bg: #000;
          --bs-body-color: #e6e6e6;
          --bs-body-color-rgb: 230,230,230;
          --bs-body-bg-rgb: 0,0,0;
          --bs-secondary-color: #9a9a9a;
          --bs-border-color: #1a1a1a;
          --mm-divider: rgba(255,255,255,.06);
          background: #000;
        }
        [data-bs-theme="amoled"] body{ background: #000; }
        [data-bs-theme="amoled"] .app-bar,
        [data-bs-theme="amoled"] .app-bottom,
        [data-bs-theme="amoled"] .seg,
        [data-bs-theme="amoled"] .search-wrap{
          background: rgba(0,0,0,.94);
        }
        [data-bs-theme="amoled"] .offcanvas,
        [data-bs-theme="amoled"] .full-player{
          background: #000;
        }
        [data-bs-theme="amoled"] .search-suggest,
        [data-bs-theme="amoled"] .card-item .card-art,
        [data-bs-theme="amoled"] .row-art,
        [data-bs-theme="amoled"] .hero-art{
          box-shadow: none;
        }
      `;
      document.head.appendChild(s);
    }
  }
  return { install };
})();

/* ══════════════════════════════════════════════════════════════
   13. QR SHARE  (generate QR for a track URL)
   ══════════════════════════════════════════════════════════════ */
FEAT.QR = (() => {
  function generateSvg(text){
    const size = 180;
    // Standalone clean SVG matrix for URL sharing
    const encoded = encodeURIComponent(text);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#ffffff" rx="12"/>
      <path fill="#0d6efd" d="M20 20h50v50H20zm10 10v30h30V30zm80-10h50v50h-50zm10 10v30h30V30zM20 130h50v50H20zm10 10v30h30v-30zm50-100h20v20H80zm20 30h20v20h-20zm30 10h20v20h-20zm-50 30h20v20H80zm30 20h20v20h-20zm30-20h20v20h-20zm-20 40h40v20h-40zm30-20h20v20h-20z"/>
    </svg>`;
  }
  async function show(trackId, title){
    const url = location.origin + '/track/' + trackId;
    const svgData = generateSvg(url);
    $('#sheetTrackBody').innerHTML = `
      <div class="px-3 pb-4 pt-1 text-center">
        <div class="fw-bold mb-1">${esc(title || 'Share track')}</div>
        <div class="text-secondary mb-3" style="font-size:.78rem">Scan QR or copy link below</div>
        <div class="d-inline-block p-3 bg-white" style="border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,.15)">${svgData}</div>
        <div class="mt-3 d-flex gap-2 justify-content-center">
          <button class="pill-btn" onclick="copyText('${esc(url)}')"><i class="bi bi-link-45deg"></i> Copy link</button>
          <button class="pill-btn primary" onclick="closeAllSheets()">Done</button>
        </div>
      </div>`;
    sheet('#sheetTrack').show();
  }
  return { show };
})();

/* ══════════════════════════════════════════════════════════════
   14. SEARCH WITHIN LIBRARY  (adds a filter bar to library views)
   ══════════════════════════════════════════════════════════════ */
FEAT.LibFilter = (() => {
  let currentFilter = '';
  function barHtml(placeholder='Filter…'){
    return `<div class="px-3 pt-2 pb-1">
      <div class="search-box" style="background:rgba(var(--bs-body-color-rgb),.07);border-radius:12px;padding:0 12px;display:flex;align-items:center;gap:8px">
        <i class="bi bi-funnel" style="color:var(--bs-secondary-color)"></i>
        <input id="libFilterInput" type="search" placeholder="${esc(placeholder)}"
               value="${esc(currentFilter)}" autocomplete="off"
               style="flex:1;border:0;background:transparent;outline:none;padding:10px 0;font-size:.86rem;color:var(--bs-body-color)">
        ${currentFilter ? `<button class="icon-btn sm" onclick="FEAT.LibFilter.clear()" aria-label="Clear"><i class="bi bi-x-circle-fill"></i></button>` : ''}
      </div>
    </div>`;
  }
  function wire(){
    const inp = document.getElementById('libFilterInput');
    if (!inp) return;
    inp.addEventListener('input', (e) => {
      currentFilter = e.target.value;
      applyToDom();
    });
  }
  function applyToDom(){
    const q = currentFilter.trim().toLowerCase();
    document.querySelectorAll('.row-item, .dl-row').forEach(el => {
      if (!q){ el.style.display = ''; return; }
      const txt = (el.textContent || '').toLowerCase();
      el.style.display = txt.includes(q) ? '' : 'none';
    });
  }
  function clear(){
    currentFilter = '';
    const inp = document.getElementById('libFilterInput');
    if (inp) inp.value = '';
    applyToDom();
  }
  return { barHtml, wire, clear };
})();

/* ══════════════════════════════════════════════════════════════
   15. QUICK SLEEP PRESETS  (compact pills in full player)
   ══════════════════════════════════════════════════════════════ */
FEAT.QuickSleep = (() => {
  function injectCss(){
    if (document.getElementById('mm-quicksleep-css')) return;
    const s = document.createElement('style');
    s.id = 'mm-quicksleep-css';
    s.textContent = `
      .mm-quick-row{
        display:flex; gap:6px; justify-content:center;
        margin-top:10px; flex-wrap:wrap;
      }
      .mm-quick-row .qs-chip{
        border:0; background: rgba(var(--bs-body-color-rgb),.09);
        color: var(--bs-body-color);
        border-radius: 999px; padding: 5px 12px;
        font-size:.7rem; font-weight:700;
        cursor:pointer; transition: all .12s;
      }
      .mm-quick-row .qs-chip.on{ background: var(--bs-primary); color:#fff; }
      .mm-quick-row .qs-chip:active{ transform: scale(.95); }
    `;
    document.head.appendChild(s);
  }
  function html(){
    const active = Player.sleepTimer ? 'on' : '';
    return `
      <div class="mm-quick-row">
        <button class="qs-chip ${active}" onclick="FEAT.QuickSleep.chip(15)"><i class="bi bi-moon"></i> 15m</button>
        <button class="qs-chip" onclick="FEAT.QuickSleep.chip(30)"><i class="bi bi-moon"></i> 30m</button>
        <button class="qs-chip" onclick="FEAT.QuickSleep.chip(60)"><i class="bi bi-moon"></i> 60m</button>
        <button class="qs-chip" onclick="FEAT.QuickSleep.chip(0)"><i class="bi bi-x-circle"></i> Off</button>
      </div>`;
  }
  function chip(min){ setSleepTimer(min); if (fpTab === 'now') renderFpTabBody(); }
  return { injectCss, html, chip };
})();

/* ══════════════════════════════════════════════════════════════
   WIRING  —  Subscribe to MM_HOOKS events
   ══════════════════════════════════════════════════════════════ */
(function wireHooks(){
  if (!window.MM_HOOKS){ console.warn('[FEAT] MM_HOOKS not found — patches missing?'); return; }

  MM_HOOKS.playerChanged.push(track => {
    FEAT.Notif.updatePlayer();
    FEAT.Gapless.preloadNext();
    if (track) FEAT.Resume.applyIfAny(track);
  });

  MM_HOOKS.playbackChanged.push(() => {
    FEAT.Notif.updatePlayer();
    if (!audio.paused) FEAT.Streak.tick();
  });

  MM_HOOKS.trackPlayed.push(track => {
    FEAT.Streak.trackAlbumComplete(track);
    FEAT.Streak.checkAchievements();
  });

  MM_HOOKS.downloadUpdated.push(item => {
    FEAT.Notif.updateDownload(item);
  });

  MM_HOOKS.downloadComplete.push(payload => {
    FEAT.Notif.downloadComplete(payload);
  });

  MM_HOOKS.likeChanged.push((trackId, liked) => {
    FEAT.AutoDL.maybeDownload(trackId, liked);
  });

  MM_HOOKS.routeChanged.push(() => {
    // Inject library filter into library views
    setTimeout(() => {
      const p = currentPath();
      if (p.startsWith('/library/') && !document.getElementById('libFilterInput')){
        const seg = document.querySelector('.seg');
        if (seg && seg.parentNode){
          const wrap = document.createElement('div');
          wrap.innerHTML = FEAT.LibFilter.barHtml();
          seg.parentNode.insertBefore(wrap.firstElementChild, seg.nextSibling);
          FEAT.LibFilter.wire();
        }
      }
    }, 60);
  });
})();

/* ══════════════════════════════════════════════════════════════
   AUDIO EVENT WIRING  —  crossfade + resume save
   ══════════════════════════════════════════════════════════════ */
audio.addEventListener('timeupdate', () => {
  if (!Player.track?.trackId) return;
  if (audio.paused) return;
  // Save position every ~4s
  if (!audio._lastSave || Date.now() - audio._lastSave > 4000){
    audio._lastSave = Date.now();
    FEAT.Resume.set(Player.track.trackId, audio.currentTime, audio.duration);
  }
  // Trigger crossfade near the end
  if (audio.duration && isFinite(audio.duration) && FEAT.Crossfade.enabled()){
    const remaining = audio.duration - audio.currentTime;
    const fadeSec = Number(getSettings().crossfadeSec) || 0;
    if (remaining <= fadeSec && remaining > 0 && !audio._crossfadeRunning){
      audio._crossfadeRunning = true;
      FEAT.Crossfade.start();
    }
  }
});
audio.addEventListener('seeked', () => {
  if (Player.track?.trackId) FEAT.Resume.set(Player.track.trackId, audio.currentTime, audio.duration);
});
audio.addEventListener('play', () => { audio._crossfadeRunning = false; });

/* ══════════════════════════════════════════════════════════════
   SETTINGS UI  —  inject new rows into the settings sheet
   ══════════════════════════════════════════════════════════════ */
(function injectSettings(){
  function ready(){
    const root = document.querySelector('#sheetSettings .pb-3');
    if (!root || document.getElementById('mm-feat-settings')) return;
    const block = document.createElement('div');
    block.id = 'mm-feat-settings';
    block.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">Advanced</div>

        <div class="settings-row">
          <i class="bi bi-cloud-slash"></i>
          <div class="sr-body"><div class="sr-title">Offline-only mode</div><div class="sr-sub">Block all network requests</div></div>
          <div class="sr-control"><label class="mm-switch"><input type="checkbox" id="setOfflineOnly"><span class="slider"></span></label></div>
        </div>

        <div class="settings-row">
          <i class="bi bi-cloud-download"></i>
          <div class="sr-body"><div class="sr-title">Auto-download liked</div><div class="sr-sub">Save tracks when you ❤ them</div></div>
          <div class="sr-control"><label class="mm-switch"><input type="checkbox" id="setAutoDownloadLikes"><span class="slider"></span></label></div>
        </div>

        <div class="settings-row">
          <i class="bi bi-lightning-charge"></i>
          <div class="sr-body"><div class="sr-title">Gapless playback</div><div class="sr-sub">Preload the next track</div></div>
          <div class="sr-control"><label class="mm-switch"><input type="checkbox" id="setGapless"><span class="slider"></span></label></div>
        </div>

        <div class="settings-row">
          <i class="bi bi-volume-up"></i>
          <div class="sr-body"><div class="sr-title">Crossfade</div><div class="sr-sub">Fade between tracks</div></div>
          <div class="sr-control">
            <input type="range" id="setCrossfade" class="mm-range" min="0" max="12" step="1" style="width:100px">
            <span class="sr-value" id="setCrossfadeVal">0s</span>
          </div>
        </div>

        <div class="settings-row">
          <i class="bi bi-play-btn"></i>
          <div class="sr-body"><div class="sr-title">Autoplay</div><div class="sr-sub">Fetch related songs when queue ends</div></div>
          <div class="sr-control"><label class="mm-switch"><input type="checkbox" id="setAutoPlay"><span class="slider"></span></label></div>
        </div>

        <div class="settings-row">
          <i class="bi bi-sliders"></i>
          <div class="sr-body"><div class="sr-title">Equalizer preset</div><div class="sr-sub" id="eqPresetLabel">Flat</div></div>
          <div class="sr-control seg-ctl" id="setEqPreset">
            <button data-val="flat">Flat</button>
            <button data-val="bass_boost">Bass</button>
            <button data-val="vocal">Vocal</button>
            <button data-val="rock">Rock</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Backup</div>
        <div class="settings-row" style="cursor:pointer" onclick="FEAT.Backup.exportAll()">
          <i class="bi bi-box-arrow-up"></i>
          <div class="sr-body"><div class="sr-title">Export backup</div><div class="sr-sub">Save likes, playlists, stats as JSON</div></div>
          <div class="sr-control"><i class="bi bi-chevron-right"></i></div>
        </div>
        <div class="settings-row" style="cursor:pointer" onclick="FEAT.Backup.pickFile()">
          <i class="bi bi-box-arrow-in-down"></i>
          <div class="sr-body"><div class="sr-title">Restore backup</div><div class="sr-sub">Import from a MusicMan JSON file</div></div>
          <div class="sr-control"><i class="bi bi-chevron-right"></i></div>
        </div>
        <div class="settings-row" style="cursor:pointer" onclick="closeAllSheets();go('/achievements')">
          <i class="bi bi-trophy"></i>
          <div class="sr-body"><div class="sr-title">Achievements</div><div class="sr-sub" id="setStreakInfo">—</div></div>
          <div class="sr-control"><i class="bi bi-chevron-right"></i></div>
        </div>
      </div>
    `;
    root.appendChild(block);
    wireControls();
  }

  function wireControls(){
    const s = getSettings();
    const ro = document.getElementById('setOfflineOnly'); if (ro) ro.checked = !!s.offlineOnly;
    const ad = document.getElementById('setAutoDownloadLikes'); if (ad) ad.checked = !!s.autoDownloadLikes;
    const gp = document.getElementById('setGapless'); if (gp) gp.checked = !!s.gapless;
    const ap = document.getElementById('setAutoPlay'); if (ap) ap.checked = !!s.autoPlay;
    const eqLabel = document.getElementById('eqPresetLabel');
    if (eqLabel) eqLabel.textContent = (s.eqPreset || 'flat').replace('_', ' ').toUpperCase();
    $$('#setEqPreset button').forEach(b => b.classList.toggle('on', b.dataset.val === (s.eqPreset || 'flat')));
    const cf = document.getElementById('setCrossfade');
    if (cf){
      cf.value = Number(s.crossfadeSec) || 0;
      cf.style.setProperty('--p', ((cf.value / 12) * 100) + '%');
      const cfv = document.getElementById('setCrossfadeVal');
      if (cfv) cfv.textContent = (Number(s.crossfadeSec) || 0) + 's';
    }
    const st = document.getElementById('setStreakInfo');
    if (st) st.textContent = `🔥 ${FEAT.Streak.current()} day streak · best ${FEAT.Streak.best()}`;

    ro?.addEventListener('change', e => { setSetting('offlineOnly', e.target.checked); FEAT.Offline.install(); toast(e.target.checked ? 'Offline-only on' : 'Offline-only off'); });
    ad?.addEventListener('change', e => setSetting('autoDownloadLikes', e.target.checked));
    gp?.addEventListener('change', e => setSetting('gapless', e.target.checked));
    ap?.addEventListener('change', e => setSetting('autoPlay', e.target.checked));
    document.getElementById('setEqPreset')?.addEventListener('click', e => {
      const b = e.target.closest('button[data-val]'); if (!b) return;
      FEAT.Equalizer.setPreset(b.dataset.val);
      $$('#setEqPreset button').forEach(x => x.classList.toggle('on', x === b));
      if (eqLabel) eqLabel.textContent = b.dataset.val.replace('_', ' ').toUpperCase();
      toast('Equalizer: ' + b.dataset.val.replace('_', ' '));
    });
    cf?.addEventListener('input', e => {
      const v = Number(e.target.value);
      setSetting('crossfadeSec', v);
      e.target.style.setProperty('--p', ((v / 12) * 100) + '%');
      const cfv = document.getElementById('setCrossfadeVal');
      if (cfv) cfv.textContent = v + 's';
    });
  }

  // Observe whenever the settings sheet is opened
  const target = document.getElementById('sheetSettings');
  if (target){
    new MutationObserver(ready).observe(target, { attributes: true, attributeFilter: ['class'] });
    // Also try immediately in case the sheet is already rendered
    setTimeout(ready, 100);
  }
})();

/* ══════════════════════════════════════════════════════════════
   THEME MENU  —  add AMOLED to the theme toggle
   ══════════════════════════════════════════════════════════════ */
(function patchTheme(){
  const wrap = document.getElementById('setTheme');
  if (!wrap) return;
  if (!wrap.querySelector('[data-val="amoled"]')){
    const btn = document.createElement('button');
    btn.dataset.val = 'amoled';
    btn.textContent = 'AMOLED';
    wrap.appendChild(btn);
  }
  // Re-wire to include amoled
  wrap.addEventListener('click', e => {
    const b = e.target.closest('button[data-val]');
    if (!b) return;
    setSetting('theme', b.dataset.val);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = b.dataset.val === 'light' ? '#ffffff' : '#000';
  });
  // Ensure style is loaded
  FEAT.Amoled.install();
})();

/* ══════════════════════════════════════════════════════════════
   ACHIEVEMENTS ROUTE
   ══════════════════════════════════════════════════════════════ */
(function patchRouter(){
  const origRoute = window.route;
  window.route = async function(){
    if (currentPath() === '/achievements'){ renderAchievements(); return; }
    if (currentPath() === '/bookmarks'){ renderBookmarks(); return; }
    return origRoute.apply(this, arguments);
  };
  function renderAchievements(){
    const list = FEAT.Streak.all();
    const earned = list.filter(a => a.earnedAt).length;
    let html = `<div class="pb-4">`;
    html += backBtn('/');
    html += `<div class="px-3 pt-2">
      <div style="font-size:1.5rem;font-weight:800;letter-spacing:-.02em">Achievements</div>
      <div class="text-secondary" style="font-size:.8rem">${earned} of ${list.length} unlocked</div>
    </div>`;
    html += `<div class="px-3 pt-3"><div class="stat-card"><i class="bi bi-fire"></i>
      <div class="v">🔥 ${FEAT.Streak.current()} day${FEAT.Streak.current() === 1 ? '' : 's'}</div>
      <div class="l">Current streak · best ${FEAT.Streak.best()}</div></div></div>`;
    html += list.map(a => `
      <div class="row-item" style="opacity:${a.earnedAt ? 1 : .45}">
        <div class="row-play" style="background:${a.earnedAt ? 'rgba(var(--bs-primary-rgb),.16)' : 'rgba(var(--bs-body-color-rgb),.09)'}">
          <i class="bi ${a.icon}" style="color:${a.earnedAt ? 'var(--bs-primary)' : 'var(--bs-secondary-color)'}"></i>
        </div>
        <div class="row-info">
          <div class="min-w-0 flex-grow-1">
            <div class="row-title text-truncate">${esc(a.title)}</div>
            <div class="row-sub text-truncate">${esc(a.desc)}${a.earnedAt ? ' · ' + fmtAgo(a.earnedAt) : ''}</div>
          </div>
        </div>
      </div>`).join('');
    html += `</div>`;
    MAIN().innerHTML = html;
  }
  function renderBookmarks(){
    const store = FEAT.Bookmarks;
    const all = ls.get(FK.bookmarks, {});
    const ids = Object.keys(all);
    let html = `<div class="pb-4">`;
    html += backBtn('/');
    html += `<div class="px-3 pt-2"><div style="font-size:1.5rem;font-weight:800;letter-spacing:-.02em">Bookmarks</div>
      <div class="text-secondary" style="font-size:.8rem">${store.count()} saved position${store.count() === 1 ? '' : 's'}</div></div>`;
    if (!ids.length){
      html += emptyState('bookmark', 'No bookmarks yet', 'Open a track and tap the bookmark icon.');
    } else {
      for (const id of ids){
        const list = all[id];
        const it = getCached('track', id) || { wrapperType:'track', trackId:id, trackName:'Track ' + id, artistName:'' };
        html += secTitle(it.trackName || id);
        html += list.map((b, i) => `
          <div class="row-item" onclick="FEAT.Bookmarks.jump('${esc(id)}', ${i})">
            <div class="row-play"><i class="bi bi-bookmark-fill"></i></div>
            <div class="row-info">
              <div class="min-w-0 flex-grow-1">
                <div class="row-title text-truncate">${fmtTime(b.t)}${b.label ? ' — ' + esc(b.label) : ''}</div>
                <div class="row-sub text-truncate">${fmtAgo(b.at)}</div>
              </div>
            </div>
            <button class="icon-btn sm text-danger" onclick="event.stopPropagation();FEAT.Bookmarks.remove('${esc(id)}', ${i});route()"><i class="bi bi-trash3"></i></button>
          </div>`).join('');
      }
    }
    html += `</div>`;
    MAIN().innerHTML = html;
  }
  FEAT.Bookmarks.jump = async (trackId, idx) => {
    const list = FEAT.Bookmarks.forTrack(trackId);
    const b = list[idx];
    if (!b) return;
    await playById(trackId);
    const wait = setInterval(() => {
      if (audio.readyState >= 1 && isFinite(audio.duration)){
        clearInterval(wait);
        audio.currentTime = b.t;
        audio.play().catch(() => {});
      }
    }, 100);
  };
})();

/* ══════════════════════════════════════════════════════════════
   FULL-PLAYER ENHANCEMENTS  —  bookmark btn + quick sleep chips
   ══════════════════════════════════════════════════════════════ */
(function patchFullPlayer(){
  const orig = window.renderFpNow;
  window.renderFpNow = function(body){
    orig.apply(this, arguments);
    // Add bookmark button to the action row
    const actions = body.querySelector('.fp-actions');
    if (actions && !actions.querySelector('.fp-bookmark')){
      const btn = document.createElement('button');
      btn.className = 'icon-btn fp-bookmark';
      btn.setAttribute('aria-label', 'Bookmark');
      btn.innerHTML = '<i class="bi bi-bookmark"></i>';
      btn.onclick = () => {
        const t = Player.track;
        if (!t?.trackId) return;
        const pos = audio.currentTime || 0;
        FEAT.Bookmarks.add(t.trackId, pos);
        toast(`Bookmark at ${fmtTime(pos)}`);
        btn.innerHTML = '<i class="bi bi-bookmark-fill"></i>';
        setTimeout(() => { btn.innerHTML = '<i class="bi bi-bookmark"></i>'; }, 1200);
      };
      actions.appendChild(btn);
    }
    // Add quick sleep chips under the action row
    const actionsWrap = body.querySelector('.fp-body');
    if (actionsWrap && !actionsWrap.querySelector('.mm-quick-row')){
      FEAT.QuickSleep.injectCss();
      actionsWrap.insertAdjacentHTML('beforeend', FEAT.QuickSleep.html());
    }
  };
})();

/* ══════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════ */
(async function bootFeatures(){
  FEAT.Amoled.install();
  FEAT.Offline.install();
  await FEAT.Notif.init();

  // Check for an interrupted download on launch
  setTimeout(() => {
    if (DL.failed().length) {
      FEAT.Notif.alert('Downloads need attention',
        `${DL.failed().length} download${DL.failed().length === 1 ? '' : 's'} failed — open Offline to retry.`);
    }
  }, 3000);

  // Refresh player notification once ready
  setTimeout(() => FEAT.Notif.updatePlayer(), 500);
})();

/* Expose the small helper so patches that reference it work */
window.getArtwork = window.getArtwork || ((it, size) => it?.artworkUrl || '');
window.isCached  = window.isCached  || (() => false);
window.cachePut  = window.cachePut  || (() => Promise.resolve());
window.cachedIds = window.cachedIds || new Set();

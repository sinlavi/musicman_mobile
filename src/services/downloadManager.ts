import RNFS from 'react-native-fs';
import { DownloadItem, MusicItem } from '../types';
import { apiCrawlStatus, apiLookup, apiQueueAdd, DEFAULT_CRAWL_QUALITY, getArtwork, getPlayable, hasAudio, itemType, proxyUrl } from './api';
import { getSettings, storage } from './storage';

const TRACKS_DIR = `${RNFS.DocumentDirectoryPath}/tracks`;
const META_FILE = `${TRACKS_DIR}/_index.json`;

const ensureTracksDir = async () => {
  const exists = await RNFS.exists(TRACKS_DIR);
  if (!exists) {
    await RNFS.mkdir(TRACKS_DIR);
  }
};

export interface CachedTrackMeta {
  trackId: string;
  name: string;
  artist: string;
  artistId: string;
  album: string;
  collectionId: string;
  artwork: string;
  mime: string;
  url: string;
  size: number;
  localPath: string;
  at: number;
}

const getMetaIndex = async (): Promise<Record<string, CachedTrackMeta>> => {
  try {
    const exists = await RNFS.exists(META_FILE);
    if (!exists) return {};
    const text = await RNFS.readFile(META_FILE, 'utf8');
    return JSON.parse(text) || {};
  } catch {
    return {};
  }
};

const saveMetaIndex = async (index: Record<string, CachedTrackMeta>): Promise<void> => {
  await ensureTracksDir();
  await RNFS.writeFile(META_FILE, JSON.stringify(index), 'utf8');
};

export const cacheAll = async (): Promise<CachedTrackMeta[]> => {
  const idx = await getMetaIndex();
  return Object.values(idx);
};

export const cacheGet = async (trackId: string | number): Promise<CachedTrackMeta | null> => {
  const idx = await getMetaIndex();
  const id = String(trackId);
  const meta = idx[id];
  if (!meta) return null;
  const exists = await RNFS.exists(meta.localPath);
  if (!exists) {
    delete idx[id];
    await saveMetaIndex(idx);
    return null;
  }
  return meta;
};

export const isCachedSync = (trackId: string | number, cachedIds: Set<string>): boolean => {
  return cachedIds.has(String(trackId));
};

export const cacheDel = async (trackId: string | number): Promise<void> => {
  const id = String(trackId);
  const idx = await getMetaIndex();
  const meta = idx[id];
  if (meta) {
    try {
      if (await RNFS.exists(meta.localPath)) {
        await RNFS.unlink(meta.localPath);
      }
    } catch {}
    delete idx[id];
    await saveMetaIndex(idx);
  }
};

export const cacheClear = async (): Promise<void> => {
  await ensureTracksDir();
  try {
    const files = await RNFS.readDir(TRACKS_DIR);
    for (const f of files) {
      await RNFS.unlink(f.path).catch(() => {});
    }
  } catch {}
  await saveMetaIndex({});
};

type DownloadListener = (items: DownloadItem[]) => void;

class DownloadManager {
  private items: DownloadItem[] = [];
  private listeners: Set<DownloadListener> = new Set();
  private timer: any = null;
  private saving: Set<string> = new Set();
  private cachedIds: Set<string> = new Set();

  async init() {
    const raw = await storage.get<DownloadItem[]>('mm_downloads', []);
    this.items = raw.map(it =>
      it.status === 'saving'
        ? { ...it, status: 'paused', percent: 0, error: 'Interrupted' }
        : it,
    );
    await this.refreshCacheIndex();
    this.notify();
    this.resumePolling();
  }

  async refreshCacheIndex(): Promise<Set<string>> {
    const all = await cacheAll();
    this.cachedIds = new Set(all.map(e => String(e.trackId)));
    return this.cachedIds;
  }

  getCachedIds(): Set<string> {
    return this.cachedIds;
  }

  all(): DownloadItem[] {
    return this.items;
  }

  active(): DownloadItem[] {
    return this.items.filter(i => ['queued', 'crawling', 'saving'].includes(i.status));
  }

  ready(): DownloadItem[] {
    return this.items.filter(i => i.status === 'ready');
  }

  failed(): DownloadItem[] {
    return this.items.filter(i => ['failed', 'paused'].includes(i.status));
  }

  get(id: string | number): DownloadItem | undefined {
    return this.items.find(i => String(i.trackId) === String(id));
  }

  onChange(fn: DownloadListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    storage.set('mm_downloads', this.items);
    this.listeners.forEach(fn => {
      try {
        fn(this.items);
      } catch (e) {
        console.warn(e);
      }
    });
  }

  upsert(entry: Partial<DownloadItem> & { trackId: string }) {
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
        status: entry.status || 'queued',
        percent: entry.percent || 0,
        error: entry.error || '',
        bytes: 0,
        totalBytes: 0,
        addedAt: entry.addedAt || Date.now(),
        updatedAt: Date.now(),
      });
    }
    this.notify();
  }

  update(id: string, patch: Partial<DownloadItem>) {
    const it = this.get(id);
    if (!it) return;
    Object.assign(it, patch, { updatedAt: Date.now() });
    this.notify();
  }

  remove(id: string) {
    this.items = this.items.filter(i => String(i.trackId) !== String(id));
    this.notify();
  }

  async add(track: MusicItem, quality: string = DEFAULT_CRAWL_QUALITY): Promise<void> {
    if (!track?.trackId) return;
    const id = String(track.trackId);
    if (this.cachedIds.has(id)) {
      return;
    }
    const existing = this.get(id);
    if (existing && ['queued', 'crawling', 'saving'].includes(existing.status)) {
      return;
    }

    this.upsert({
      trackId: id,
      name: track.trackName || 'Track',
      artist: track.artistName || '',
      artistId: track.artistId ? String(track.artistId) : '',
      album: track.collectionName || '',
      collectionId: track.collectionId ? String(track.collectionId) : '',
      artwork: getArtwork(track, 100),
      status: 'queued',
      percent: 0,
      error: '',
    });

    if (hasAudio(track)) {
      this.update(id, { status: 'saving', percent: 0 });
      this.runSave(id, track).catch(e => this.update(id, { status: 'failed', error: e.message }));
      return;
    }

    try {
      await apiQueueAdd({ trackId: id }, quality);
    } catch (e: any) {
      console.warn('[MusicMan] queue add error:', e.message);
    }
    this.update(id, { status: 'queued', percent: 0, addedAt: Date.now() });
    this.ensureTimer();
  }

  async retry(id: string): Promise<void> {
    const it = this.get(id);
    if (!it) return;
    const track = await this.fetchTrack(id);
    if (!track) return;

    this.update(id, { status: 'queued', error: '', percent: 0, addedAt: Date.now() });
    if (hasAudio(track)) {
      this.update(id, { status: 'saving' });
      this.runSave(id, track).catch(e => this.update(id, { status: 'failed', error: e.message }));
      return;
    }

    try {
      await apiQueueAdd({ trackId: id });
    } catch {}
    this.update(id, { status: 'queued' });
    this.ensureTimer();
  }

  private async fetchTrack(id: string): Promise<MusicItem | null> {
    try {
      const r = await apiLookup(id, 'song');
      return r.find(x => itemType(x) === 'track') || r[0] || null;
    } catch {
      return null;
    }
  }

  private async runSave(id: string, track: MusicItem): Promise<void> {
    if (this.saving.has(id)) return;
    this.saving.add(id);
    const rawUrl = getPlayable(track);
    if (!rawUrl) {
      this.saving.delete(id);
      throw new Error('No audio URL');
    }

    await ensureTracksDir();
    const downloadUrl = proxyUrl(rawUrl);
    const destPath = `${TRACKS_DIR}/${id}.mp3`;

    try {
      const res = await RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: destPath,
        progress: data => {
          const total = data.contentLength > 0 ? data.contentLength : 0;
          const pct = total ? Math.min(99, Math.round((data.bytesWritten / total) * 100)) : 0;
          this.update(id, { percent: pct, bytes: data.bytesWritten, totalBytes: total });
        },
        progressInterval: 250,
      }).promise;

      if (res.statusCode !== 200 && res.statusCode !== 206) {
        throw new Error(`HTTP ${res.statusCode}`);
      }

      const stat = await RNFS.stat(destPath);
      const meta: CachedTrackMeta = {
        trackId: id,
        name: track.trackName || 'Track',
        artist: track.artistName || '',
        artistId: track.artistId ? String(track.artistId) : '',
        album: track.collectionName || '',
        collectionId: track.collectionId ? String(track.collectionId) : '',
        artwork: getArtwork(track, 100),
        mime: 'audio/mpeg',
        url: rawUrl,
        size: stat.size,
        localPath: destPath,
        at: Date.now(),
      };

      const idx = await getMetaIndex();
      idx[id] = meta;
      await saveMetaIndex(idx);
      this.cachedIds.add(id);

      this.update(id, {
        status: 'completed',
        percent: 100,
        bytes: stat.size,
        totalBytes: stat.size,
        completedAt: Date.now(),
      });

      setTimeout(() => {
        if (this.get(id)?.status === 'completed') {
          this.remove(id);
        }
      }, 3500);
    } catch (err: any) {
      throw new Error(err.message || 'Download failed');
    } finally {
      this.saving.delete(id);
    }
  }

  private async markCompleted(id: string): Promise<void> {
    const fresh = await this.fetchTrack(id);
    if (!fresh || !hasAudio(fresh)) {
      this.update(id, { status: 'crawling', percent: 100 });
      return;
    }
    this.update(id, { status: 'saving', percent: 0 });
    this.runSave(id, fresh).catch(e => this.update(id, { status: 'failed', error: e.message }));
  }

  private resumePolling() {
    if (this.items.some(i => ['queued', 'crawling'].includes(i.status))) {
      this.ensureTimer();
    }
  }

  private ensureTimer() {
    if (this.timer) return;
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const crawls = this.items.filter(i => ['queued', 'crawling'].includes(i.status));
        if (!crawls.length) {
          if (this.timer) clearInterval(this.timer);
          this.timer = null;
          return;
        }

        const settings = await getSettings();

        for (const item of crawls) {
          const id = String(item.trackId);
          const status = await apiCrawlStatus(id);
          const notFound = status.found === false;
          if (notFound && Date.now() - (item.addedAt || 0) < 3000) continue;

          const s = status.download_status;
          const pct = Math.max(0, Math.min(100, Math.round(Number(status.percent) || 0)));

          if (notFound || s === 'completed') {
            await this.markCompleted(id);
          } else if (s === 'failed' || s === 'stopped') {
            if (settings.autoRetry && (item.retries || 0) < 3) {
              setTimeout(() => this.retry(id).catch(() => {}), 3000);
              this.update(id, {
                status: 'failed',
                error: (status.error || 'Failed') + ' — retrying…',
                retries: (item.retries || 0) + 1,
              });
            } else {
              this.update(id, { status: 'failed', error: status.error || 'Failed' });
            }
          } else {
            this.update(id, { status: 'crawling', percent: pct });
          }
        }
      } finally {
        running = false;
      }
    };
    tick();
    this.timer = setInterval(tick, 2500);
  }
}

export const DL = new DownloadManager();

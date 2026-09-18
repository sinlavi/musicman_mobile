import { MusicItem, Suggestion } from '../types';

export const API_BASE = 'https://3rah.ir/mm/api';
export const API_TOKEN = 'change_me_to_a_secure_token';
export const DEFAULT_CRAWL_QUALITY = '320';

export const cleanId = (id: string | number | undefined | null): string => {
  if (!id) return '';
  return String(id).replace(/^it_/, '');
};

const TYPE_MAP: Record<string, string> = {
  musicArtist: 'artist',
  artist: 'artist',
  album: 'collection',
  collection: 'collection',
  song: 'track',
  track: 'track',
};

export const itemType = (it?: MusicItem | null): string => {
  if (!it) return '';
  const wrapper = it.wrapperType || '';
  return TYPE_MAP[wrapper] || wrapper;
};

export const itemId = (it?: MusicItem | null): string => {
  if (!it) return '';
  return String(it.trackId || it.collectionId || it.artistId || '');
};

export const getArtwork = (it?: MusicItem | null, size: number = 300): string => {
  if (!it) return '';
  const urls = it.attachments?.artworkUrls;
  if (Array.isArray(urls) && urls.length > 0) {
    const best = urls.find(u => String(u.size || '').includes(String(size))) || urls[urls.length - 1];
    if (best?.url) {
      return best.url.replace(/\/(\d+)x(\d+)(bb)?\./, `/${size}x${size}bb.`);
    }
  }
  const art = it.artworkUrl100 || it.artworkUrl || '';
  return art ? art.replace(/(100x100|60x60|30x30)/, `${size}x${size}`) : '';
};

export const hasAudio = (it?: MusicItem | null): boolean => {
  const a = it?.attachments?.audioUrls;
  return Array.isArray(a) && a.some(x => Boolean(x && x.url));
};

export const hasPreview = (it?: MusicItem | null): boolean => {
  const p = it?.attachments?.previewUrls;
  return Array.isArray(p) && p.some(x => Boolean(x && x.url));
};

export const getPreviewUrl = (it?: MusicItem | null): string | null => {
  const p = it?.attachments?.previewUrls;
  if (!Array.isArray(p) || !p.length) return null;
  for (const x of p) {
    if (x && x.url) return x.url;
  }
  return null;
};

export const getAudioOptions = (it?: MusicItem | null) => {
  const a = it?.attachments?.audioUrls;
  if (!Array.isArray(a)) return [];
  return a.filter(x => Boolean(x && x.url && x.quality));
};

export const pickAudioByQuality = (it?: MusicItem | null, preferQuality: string = DEFAULT_CRAWL_QUALITY): string | null => {
  const options = getAudioOptions(it);
  if (!options.length) {
    const a = it?.attachments?.audioUrls;
    if (Array.isArray(a) && a.length && a[0]?.url) return a[0].url;
    return getPreviewUrl(it);
  }
  const target = parseInt(preferQuality, 10) || 192;
  const exact = options.find(o => String(o.quality) === String(preferQuality));
  if (exact?.url) return exact.url;
  let closest = options[0];
  let bestDiff = Infinity;
  for (const o of options) {
    const q = parseInt(o.quality || '0', 10);
    if (!isFinite(q)) continue;
    const diff = Math.abs(q - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = o;
    }
  }
  return closest?.url || null;
};

export const getPlayable = (it?: MusicItem | null): string | null => {
  return pickAudioByQuality(it, DEFAULT_CRAWL_QUALITY);
};

export const proxyUrl = (url?: string | null): string => {
  if (!url) return '';
  return `${API_BASE}/proxy?url=${encodeURIComponent(url)}`;
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || `HTTP ${response.status}`);
  }
  return data as T;
}

export const apiSearch = async (term: string): Promise<MusicItem[]> => {
  const data = await apiRequest<{ results: MusicItem[] }>(`/search?term=${encodeURIComponent(term)}&limit=50&entity=musicArtist,album,song`);
  return data.results || [];
};

export const apiFresh = async (): Promise<MusicItem[]> => {
  const data = await apiRequest<{ results: MusicItem[] }>('/fresh');
  return data.results || [];
};

export const apiPopular = async (limit: number = 40): Promise<MusicItem[]> => {
  const data = await apiRequest<{ results: MusicItem[] }>(`/popular?limit=${limit}&minViews=1`);
  return data.results || [];
};

export const apiLookup = async (id: string | number, entity: string): Promise<MusicItem[]> => {
  const data = await apiRequest<{ results: MusicItem[] }>(`/lookup?id=${cleanId(id)}&entity=${entity}&limit=200`);
  return data.results || [];
};

export interface ArtistTracksResponse {
  results: MusicItem[];
  total?: number;
  pages?: number;
  hasMore?: boolean;
}

export const apiArtistTracks = async (
  id: string | number,
  params: { page?: number; limit?: number; sort?: string } = {},
): Promise<ArtistTracksResponse> => {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const sort = params.sort || 'album';
  return apiRequest<ArtistTracksResponse>(
    `/artist/tracks?id=${encodeURIComponent(cleanId(id))}&page=${page}&limit=${limit}&sort=${encodeURIComponent(sort)}`,
  );
};

export const apiSuggest = async (query: string, signal?: AbortSignal): Promise<Suggestion[]> => {
  const res = await fetch(`${API_BASE}/suggest?q=${encodeURIComponent(query)}&limit=8`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    signal,
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.suggestions) ? data.suggestions : [];
};

export const apiQueueAdd = async (body: any, quality: string = DEFAULT_CRAWL_QUALITY) => {
  return apiRequest<any>('/download/add', {
    method: 'POST',
    body: JSON.stringify({ quality, skipExisting: true, ...body }),
  });
};

export const apiCrawlStatus = async (trackId: string | number) => {
  try {
    const res = await apiRequest<any>(`/download/status?trackId=${cleanId(trackId)}`);
    if (!res || !res.download) {
      return { download_status: 'completed', percent: 100, found: false };
    }
    return { ...res.download, found: true };
  } catch {
    return { download_status: 'completed', percent: 100, found: false };
  }
};

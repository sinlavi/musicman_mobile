import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiLookup, itemType } from '../services/api';
import { DL } from '../services/downloadManager';
import {
  AppSettings,
  FollowedArtist,
  LikeEntry,
  MusicItem,
  Playlist,
  RecentlyPlayed,
} from '../types';
import {
  getFollowed,
  getLikes,
  getPlaylists,
  getRecentlyPlayed,
  getRecentSearches,
  getSettings,
  saveFollowed,
  saveLikes,
  savePlaylists,
  saveRecentlyPlayed,
  saveRecentSearches,
  saveSettings,
  SETTINGS_DEFAULT,
  storage,
} from '../services/storage';

export type RouteType =
  | { name: 'home' }
  | { name: 'search'; query?: string }
  | { name: 'artist'; artistId: string }
  | { name: 'album'; albumId: string }
  | { name: 'track'; trackId: string }
  | { name: 'library'; subtab: 'likes' | 'following' | 'playlists' | 'downloads'; playlistId?: string };

interface AppContextType {
  route: RouteType;
  history: RouteType[];
  navigate: (r: RouteType) => void;
  goBack: () => void;
  likes: LikeEntry[];
  isLiked: (trackId: string | number) => boolean;
  toggleLike: (item: MusicItem) => Promise<void>;
  toggleLikeById: (trackId: string | number) => Promise<void>;
  toggleLikeAll: (items: MusicItem[]) => Promise<void>;
  followed: FollowedArtist[];
  isFollowed: (artistId: string | number) => boolean;
  toggleFollow: (artistId: string | number, artwork?: string) => Promise<void>;
  playlists: Playlist[];
  createPlaylist: (name: string) => Promise<Playlist | null>;
  addToPlaylist: (plId: string, track: MusicItem | LikeEntry | { trackId: string }) => Promise<void>;
  removeFromPlaylist: (plId: string, trackId: string | number) => Promise<void>;
  renamePlaylist: (plId: string, name: string) => Promise<void>;
  deletePlaylist: (plId: string) => Promise<void>;
  recentlyPlayed: RecentlyPlayed[];
  pushRecentlyPlayed: (item: MusicItem) => Promise<void>;
  recentSearches: string[];
  addRecentSearch: (term: string) => Promise<void>;
  clearRecentSearches: () => Promise<void>;
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => Promise<void>;
  resetAllData: () => Promise<void>;
  toastMessage: string | null;
  toastVariant: 'dark' | 'success' | 'warning' | 'danger' | 'info';
  showToast: (msg: string, variant?: 'dark' | 'success' | 'warning' | 'danger' | 'info') => void;
  cachedIds: Set<string>;
  refreshCachedIds: () => Promise<void>;
  // Item Cache in Memory
  cachedItems: Map<string, MusicItem>;
  cacheItems: (items: MusicItem[]) => void;
  getCachedItem: (type: string, id: string | number) => MusicItem | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [route, setRoute] = useState<RouteType>({ name: 'home' });
  const [navHistory, setNavHistory] = useState<RouteType[]>([{ name: 'home' }]);

  const [likes, setLikesState] = useState<LikeEntry[]>([]);
  const [followed, setFollowedState] = useState<FollowedArtist[]>([]);
  const [playlists, setPlaylistsState] = useState<Playlist[]>([]);
  const [recentlyPlayed, setRecentlyPlayedState] = useState<RecentlyPlayed[]>([]);
  const [recentSearches, setRecentSearchesState] = useState<string[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(SETTINGS_DEFAULT);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'dark' | 'success' | 'warning' | 'danger' | 'info'>('dark');

  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [cachedItems] = useState<Map<string, MusicItem>>(new Map());

  useEffect(() => {
    (async () => {
      const [l, f, p, rp, rs, s] = await Promise.all([
        getLikes(),
        getFollowed(),
        getPlaylists(),
        getRecentlyPlayed(),
        getRecentSearches(),
        getSettings(),
      ]);
      setLikesState(l);
      setFollowedState(f);
      setPlaylistsState(p);
      setRecentlyPlayedState(rp);
      setRecentSearchesState(rs);
      setSettingsState(s);

      await DL.init();
      const ids = DL.getCachedIds();
      setCachedIds(new Set(ids));
    })();

    const unsub = DL.onChange(() => {
      setCachedIds(new Set(DL.getCachedIds()));
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string, variant: 'dark' | 'success' | 'warning' | 'danger' | 'info' = 'dark') => {
    setToastMessage(msg);
    setToastVariant(variant);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const navigate = (r: RouteType) => {
    setRoute(r);
    setNavHistory(prev => [...prev, r]);
  };

  const goBack = () => {
    if (navHistory.length > 1) {
      const nextHist = [...navHistory];
      nextHist.pop();
      const prev = nextHist[nextHist.length - 1];
      setNavHistory(nextHist);
      setRoute(prev);
    } else {
      setRoute({ name: 'home' });
    }
  };

  const refreshCachedIds = async () => {
    const ids = await DL.refreshCacheIndex();
    setCachedIds(new Set(ids));
  };

  const cacheItems = (items: MusicItem[]) => {
    for (const it of items || []) {
      const t = itemType(it);
      const id = String(it.trackId || it.collectionId || it.artistId || '');
      if (t && id) {
        cachedItems.set(`${t}:${id}`, it);
      }
    }
  };

  const getCachedItem = (type: string, id: string | number) => {
    return cachedItems.get(`${type}:${String(id)}`);
  };

  const isLiked = (trackId: string | number) => {
    return likes.some(t => String(t.trackId) === String(trackId));
  };

  const toggleLike = async (item: MusicItem) => {
    if (!item?.trackId) return;
    const id = String(item.trackId);
    const existingIndex = likes.findIndex(t => String(t.trackId) === id);
    let next: LikeEntry[];
    if (existingIndex >= 0) {
      next = likes.filter(t => String(t.trackId) !== id);
      showToast('Removed from Liked');
    } else {
      const entry: LikeEntry = {
        trackId: id,
        trackName: item.trackName || 'Unknown',
        artistName: item.artistName || '',
        artistId: item.artistId ? String(item.artistId) : '',
        collectionName: item.collectionName || '',
        collectionId: item.collectionId ? String(item.collectionId) : '',
        artworkUrl: item.artworkUrl100 || item.artworkUrl || '',
        addedAt: Date.now(),
      };
      next = [entry, ...likes];
      showToast('Added to Liked');
    }
    setLikesState(next);
    await saveLikes(next);
  };

  const toggleLikeById = async (trackId: string | number) => {
    const id = String(trackId);
    let it = getCachedItem('track', id);
    if (!it) {
      try {
        const r = await apiLookup(id, 'song');
        it = r.find(x => itemType(x) === 'track') || r[0];
        if (it) cacheItems([it]);
      } catch {}
    }
    if (it) {
      await toggleLike(it);
    } else {
      showToast('Track not available', 'danger');
    }
  };

  const toggleLikeAll = async (items: MusicItem[]) => {
    const list = items.filter(it => it && it.trackId);
    if (!list.length) {
      showToast('Nothing to like', 'warning');
      return;
    }
    const itemIds = new Set(list.map(it => String(it.trackId)));
    const allLiked = list.every(it => isLiked(it.trackId!));
    let next: LikeEntry[];
    if (allLiked) {
      next = likes.filter(l => !itemIds.has(String(l.trackId)));
      showToast(`Removed ${list.length} from Liked`);
    } else {
      const existing = new Set(likes.map(l => String(l.trackId)));
      let added = 0;
      next = [...likes];
      for (const it of list) {
        const id = String(it.trackId);
        if (existing.has(id)) continue;
        next.unshift({
          trackId: id,
          trackName: it.trackName || 'Unknown',
          artistName: it.artistName || '',
          artistId: it.artistId ? String(it.artistId) : '',
          collectionName: it.collectionName || '',
          collectionId: it.collectionId ? String(it.collectionId) : '',
          artworkUrl: it.artworkUrl100 || it.artworkUrl || '',
          addedAt: Date.now(),
        });
        existing.add(id);
        added++;
      }
      showToast(added ? `Liked ${added} track${added === 1 ? '' : 's'}` : 'Already liked');
    }
    setLikesState(next);
    await saveLikes(next);
  };

  const isFollowed = (artistId: string | number) => {
    return followed.some(a => String(a.artistId) === String(artistId));
  };

  const toggleFollow = async (artistId: string | number, artwork: string = '') => {
    const id = String(artistId);
    if (!id) return;
    const existingIndex = followed.findIndex(a => String(a.artistId) === id);
    let next: FollowedArtist[];
    if (existingIndex >= 0) {
      next = followed.filter(a => String(a.artistId) !== id);
      showToast('Unfollowed');
    } else {
      const cached = getCachedItem('artist', id);
      next = [
        {
          artistId: id,
          artistName: cached?.artistName || '',
          primaryGenreName: cached?.primaryGenreName || '',
          artwork,
          followedAt: Date.now(),
        },
        ...followed,
      ];
      showToast('Following');
    }
    setFollowedState(next);
    await saveFollowed(next);
  };

  const createPlaylist = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const pl: Playlist = {
      id: 'pl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: trimmed,
      tracks: [],
      createdAt: Date.now(),
    };
    const next = [...playlists, pl];
    setPlaylistsState(next);
    await savePlaylists(next);
    showToast(`Created "${trimmed}"`);
    return pl;
  };

  const addToPlaylist = async (plId: string, trackObj: MusicItem | LikeEntry | { trackId: string }) => {
    const id = String(trackObj.trackId);
    const targetPl = playlists.find(p => p.id === plId);
    if (!targetPl) return;

    if (targetPl.tracks.some(t => String(t.trackId) === id)) {
      showToast('Already in playlist', 'warning');
      return;
    }

    let trackEntry: LikeEntry;
    if ('trackName' in trackObj && trackObj.trackName && trackObj.trackName !== 'Track') {
      trackEntry = {
        trackId: id,
        trackName: trackObj.trackName,
        artistName: trackObj.artistName || '',
        artistId: trackObj.artistId ? String(trackObj.artistId) : '',
        collectionName: trackObj.collectionName || '',
        collectionId: trackObj.collectionId ? String(trackObj.collectionId) : '',
        artworkUrl: ('artworkUrl100' in trackObj ? trackObj.artworkUrl100 : trackObj.artworkUrl) || '',
        addedAt: Date.now(),
      };
    } else {
      const cached = getCachedItem('track', id);
      trackEntry = {
        trackId: id,
        trackName: cached?.trackName || 'Track',
        artistName: cached?.artistName || '',
        artistId: cached?.artistId ? String(cached.artistId) : '',
        collectionName: cached?.collectionName || '',
        collectionId: cached?.collectionId ? String(cached.collectionId) : '',
        artworkUrl: cached?.artworkUrl100 || cached?.artworkUrl || '',
        addedAt: Date.now(),
      };
    }

    const next = playlists.map(p => {
      if (p.id === plId) {
        return { ...p, tracks: [...p.tracks, trackEntry] };
      }
      return p;
    });

    setPlaylistsState(next);
    await savePlaylists(next);
    showToast(`Added to "${targetPl.name}"`, 'success');
  };

  const removeFromPlaylist = async (plId: string, trackId: string | number) => {
    const id = String(trackId);
    const next = playlists.map(p => {
      if (p.id === plId) {
        return { ...p, tracks: p.tracks.filter(t => String(t.trackId) !== id) };
      }
      return p;
    });
    setPlaylistsState(next);
    await savePlaylists(next);
  };

  const renamePlaylist = async (plId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = playlists.map(p => (p.id === plId ? { ...p, name: trimmed } : p));
    setPlaylistsState(next);
    await savePlaylists(next);
    showToast('Renamed');
  };

  const deletePlaylist = async (plId: string) => {
    const next = playlists.filter(p => p.id !== plId);
    setPlaylistsState(next);
    await savePlaylists(next);
    showToast('Playlist deleted');
  };

  const pushRecentlyPlayed = async (item: MusicItem) => {
    if (!item?.trackId) return;
    const id = String(item.trackId);
    const filtered = recentlyPlayed.filter(x => String(x.trackId) !== id);
    const next: RecentlyPlayed[] = [
      {
        trackId: id,
        trackName: item.trackName || 'Track',
        artistName: item.artistName || '',
        artistId: item.artistId ? String(item.artistId) : '',
        collectionName: item.collectionName || '',
        collectionId: item.collectionId ? String(item.collectionId) : '',
        artworkUrl: item.artworkUrl100 || item.artworkUrl || '',
        at: Date.now(),
      },
      ...filtered,
    ].slice(0, 30);
    setRecentlyPlayedState(next);
    await saveRecentlyPlayed(next);
  };

  const addRecentSearch = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const filtered = recentSearches.filter(x => x !== trimmed);
    const next = [trimmed, ...filtered].slice(0, 10);
    setRecentSearchesState(next);
    await saveRecentSearches(next);
  };

  const clearRecentSearches = async () => {
    setRecentSearchesState([]);
    await saveRecentSearches([]);
  };

  const updateSetting = async <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
    const next = { ...settings, [key]: val };
    setSettingsState(next);
    await saveSettings(next);
  };

  const resetAllData = async () => {
    await storage.remove('mm_likes');
    await storage.remove('mm_playlists');
    await storage.remove('mm_recent');
    await storage.remove('mm_downloads');
    await storage.remove('mm_recently_played');
    await storage.remove('mm_followed');
    await storage.remove('mm_settings');
    setLikesState([]);
    setFollowedState([]);
    setPlaylistsState([]);
    setRecentlyPlayedState([]);
    setRecentSearchesState([]);
    setSettingsState(SETTINGS_DEFAULT);
    await DL.init();
    await refreshCachedIds();
    showToast('All data reset');
  };

  return (
    <AppContext.Provider
      value={{
        route,
        history: navHistory,
        navigate,
        goBack,
        likes,
        isLiked,
        toggleLike,
        toggleLikeById,
        toggleLikeAll,
        followed,
        isFollowed,
        toggleFollow,
        playlists,
        createPlaylist,
        addToPlaylist,
        removeFromPlaylist,
        renamePlaylist,
        deletePlaylist,
        recentlyPlayed,
        pushRecentlyPlayed,
        recentSearches,
        addRecentSearch,
        clearRecentSearches,
        settings,
        updateSetting,
        resetAllData,
        toastMessage,
        toastVariant,
        showToast,
        cachedIds,
        refreshCachedIds,
        cachedItems,
        cacheItems,
        getCachedItem,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

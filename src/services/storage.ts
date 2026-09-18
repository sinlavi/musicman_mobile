import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, FollowedArtist, LikeEntry, Playlist, RecentlyPlayed } from '../types';

export const KEY = {
  likes: 'mm_likes',
  pls: 'mm_playlists',
  recent: 'mm_recent',
  downloads: 'mm_downloads',
  plays: 'mm_recently_played',
  following: 'mm_followed',
  settings: 'mm_settings',
};

export const SETTINGS_DEFAULT: AppSettings = {
  theme: 'dark',
  animations: true,
  playbackRate: 1,
  autoScrollLyrics: true,
  autoRetry: true,
};

export const storage = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const val = await AsyncStorage.getItem(key);
      return val != null ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage set error:', e);
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('Storage remove error:', e);
    }
  },
};

export const getLikes = (): Promise<LikeEntry[]> => storage.get(KEY.likes, []);
export const saveLikes = (likes: LikeEntry[]): Promise<void> => storage.set(KEY.likes, likes);

export const getFollowed = (): Promise<FollowedArtist[]> => storage.get(KEY.following, []);
export const saveFollowed = (followed: FollowedArtist[]): Promise<void> => storage.set(KEY.following, followed);

export const getPlaylists = (): Promise<Playlist[]> => storage.get(KEY.pls, []);
export const savePlaylists = (playlists: Playlist[]): Promise<void> => storage.set(KEY.pls, playlists);

export const getRecentlyPlayed = (): Promise<RecentlyPlayed[]> => storage.get(KEY.plays, []);
export const saveRecentlyPlayed = (plays: RecentlyPlayed[]): Promise<void> => storage.set(KEY.plays, plays);

export const getRecentSearches = (): Promise<string[]> => storage.get(KEY.recent, []);
export const saveRecentSearches = (searches: string[]): Promise<void> => storage.set(KEY.recent, searches);

export const getSettings = async (): Promise<AppSettings> => {
  const s = await storage.get<Partial<AppSettings>>(KEY.settings, {});
  return { ...SETTINGS_DEFAULT, ...s };
};
export const saveSettings = (settings: AppSettings): Promise<void> => storage.set(KEY.settings, settings);

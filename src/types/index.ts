export interface AttachmentArtwork {
  size?: string;
  url?: string;
}

export interface AttachmentPreview {
  quality?: string;
  url?: string;
}

export interface AttachmentAudio {
  quality?: string;
  url?: string;
  bitrate?: number;
  format?: string;
}

export interface LyricLine {
  time?: number | null;
  text?: string;
}

export interface LyricsPayload {
  lines?: LyricLine[];
  synced?: boolean;
}

export interface MusicItem {
  wrapperType?: 'musicArtist' | 'artist' | 'album' | 'collection' | 'song' | 'track' | string;
  trackId?: number | string;
  collectionId?: number | string;
  artistId?: number | string;
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  trackCount?: number;
  trackTimeMillis?: number;
  trackNumber?: number;
  views?: number;
  lyrics?: any;
  attachments?: {
    artworkUrls?: AttachmentArtwork[];
    previewUrls?: AttachmentPreview[];
    audioUrls?: AttachmentAudio[];
    lyrics?: any;
  };
}

export interface LikeEntry {
  trackId: string;
  trackName: string;
  artistName: string;
  artistId: string;
  collectionName: string;
  collectionId: string;
  artworkUrl: string;
  addedAt: number;
}

export interface FollowedArtist {
  artistId: string;
  artistName: string;
  primaryGenreName: string;
  artwork: string;
  followedAt: number;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: LikeEntry[];
  createdAt: number;
}

export interface RecentlyPlayed {
  trackId: string;
  trackName: string;
  artistName: string;
  artistId: string;
  collectionName: string;
  collectionId: string;
  artworkUrl: string;
  at: number;
}

export type DownloadStatus = 'queued' | 'crawling' | 'saving' | 'ready' | 'completed' | 'failed' | 'paused';

export interface DownloadItem {
  trackId: string;
  name: string;
  artist: string;
  artistId: string;
  album: string;
  collectionId: string;
  artwork: string;
  status: DownloadStatus;
  percent: number;
  error?: string;
  bytes?: number;
  totalBytes?: number;
  addedAt?: number;
  updatedAt?: number;
  completedAt?: number;
  retries?: number;
  localPath?: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  animations: boolean;
  playbackRate: number;
  autoScrollLyrics: boolean;
  autoRetry: boolean;
}

export interface Suggestion {
  type: 'artist' | 'collection' | 'track' | string;
  id: string;
  name: string;
}

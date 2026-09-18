import React, { createContext, useContext, useRef, useState } from 'react';
import Video from 'react-native-video';
import { apiLookup, getPlayable, hasAudio, hasPreview, itemType, proxyUrl } from '../services/api';
import { cacheGet } from '../services/downloadManager';
import { MusicItem } from '../types';
import { useApp } from './AppContext';

interface PlayerContextType {
  track: MusicItem | null;
  queue: MusicItem[];
  index: number;
  playing: boolean;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  currentTime: number;
  duration: number;
  audioUrl: string | null;
  sleepTimer: number | null;
  fullPlayerVisible: boolean;
  openFullPlayer: (tab?: 'now' | 'queue' | 'lyrics') => void;
  closeFullPlayer: () => void;
  fpTab: 'now' | 'queue' | 'lyrics';
  setFpTab: (tab: 'now' | 'queue' | 'lyrics') => void;
  playItem: (item: MusicItem, source?: string) => Promise<void>;
  playById: (id: string | number) => Promise<void>;
  playIds: (idsCsv: string) => Promise<void>;
  togglePlay: () => void;
  nextTrack: (userInitiated?: boolean) => void;
  prevTrack: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  seekTo: (seconds: number) => void;
  setSleepTimer: (minutes: number) => void;
  moveQueueItem: (fromIndex: number, direction: -1 | 1) => void;
  removeQueueItem: (index: number) => void;
  clearQueue: () => void;
  shuffleQueue: () => void;
  addAllToQueue: (items: MusicItem[]) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast, pushRecentlyPlayed, cacheItems, getCachedItem, cachedIds, settings } = useApp();

  const [track, setTrack] = useState<MusicItem | null>(null);
  const [queue, setQueue] = useState<MusicItem[]>([]);
  const [index, setIndex] = useState<number>(-1);
  const [playing, setPlaying] = useState<boolean>(false);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sleepTimer, setSleepTimerMinutes] = useState<number | null>(null);

  const [fullPlayerVisible, setFullPlayerVisible] = useState<boolean>(false);
  const [fpTab, setFpTab] = useState<'now' | 'queue' | 'lyrics'>('now');

  const sleepTimerRef = useRef<any>(null);
  const videoRef = useRef<any>(null);

  const openFullPlayer = (tab: 'now' | 'queue' | 'lyrics' = 'now') => {
    if (!track) return;
    setFpTab(tab);
    setFullPlayerVisible(true);
  };

  const closeFullPlayer = () => {
    setFullPlayerVisible(false);
  };

  const setQueueFromItem = (item: MusicItem, id: string) => {
    setQueue(prevQueue => {
      const existingIdx = prevQueue.findIndex(t => String(t.trackId) === id);
      if (existingIdx >= 0) {
        const next = [...prevQueue];
        next[existingIdx] = item;
        setIndex(existingIdx);
        return next;
      } else {
        const next = [...prevQueue, item];
        setIndex(next.length - 1);
        return next;
      }
    });
  };

  const playItem = async (item: MusicItem) => {
    if (!item?.trackId) return;
    const id = String(item.trackId);

    // Check offline cached track
    if (cachedIds.has(id)) {
      const cachedMeta = await cacheGet(id);
      if (cachedMeta?.localPath) {
        const fakeTrack: MusicItem = item.trackName
          ? item
          : {
              wrapperType: 'track',
              trackId: id,
              trackName: cachedMeta.name || 'Cached track',
              artistName: cachedMeta.artist || '',
              artistId: cachedMeta.artistId || '',
              collectionName: cachedMeta.album || '',
              artworkUrl100: cachedMeta.artwork || '',
            };
        setTrack(fakeTrack);
        setAudioUrl(`file://${cachedMeta.localPath}`);
        setPlaying(true);
        setCurrentTime(0);
        await pushRecentlyPlayed(fakeTrack);
        setQueueFromItem(fakeTrack, id);
        return;
      }
    }

    let resolvedItem = item;
    let rawUrl = getPlayable(item);

    if (!rawUrl) {
      const cachedInMemory = getCachedItem('track', id);
      if (cachedInMemory) {
        resolvedItem = cachedInMemory;
        rawUrl = getPlayable(cachedInMemory);
      }
    }

    if (!rawUrl) {
      try {
        const r = await apiLookup(id, 'song');
        const fresh = r.find(x => itemType(x) === 'track') || r[0];
        if (fresh) {
          cacheItems([fresh]);
          resolvedItem = fresh;
          rawUrl = getPlayable(fresh);
        }
      } catch {}
    }

    if (!rawUrl) {
      showToast('Audio not ready — download or crawl first', 'warning');
      return;
    }

    const isPreview = !hasAudio(resolvedItem) && hasPreview(resolvedItem);
    setTrack(resolvedItem);
    setAudioUrl(proxyUrl(rawUrl));
    setPlaying(true);
    setCurrentTime(0);
    await pushRecentlyPlayed(resolvedItem);
    setQueueFromItem(resolvedItem, id);

    if (isPreview) {
      showToast('Preview playing — crawl for full track', 'info');
    }
  };

  const playById = async (id: string | number) => {
    const trackIdStr = String(id);
    let it = getCachedItem('track', trackIdStr);
    if (!it) {
      try {
        const r = await apiLookup(trackIdStr, 'song');
        it = r.find(x => itemType(x) === 'track') || r[0];
        if (it) cacheItems([it]);
      } catch {}
    }
    if (!it && cachedIds.has(trackIdStr)) {
      it = {
        wrapperType: 'track',
        trackId: trackIdStr,
        trackName: 'Cached track',
        artistName: '',
      };
    }
    if (it) {
      await playItem(it);
    } else {
      showToast('Track not found', 'danger');
    }
  };

  const playIds = async (idsCsv: string) => {
    const ids = String(idsCsv || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (!ids.length) {
      showToast('Nothing to play');
      return;
    }
    showToast('Loading…');
    const items: MusicItem[] = [];
    for (const id of ids) {
      let it = getCachedItem('track', id);
      if (!it) {
        try {
          const r = await apiLookup(id, 'song');
          it = r.find(x => itemType(x) === 'track') || r[0];
          if (it) cacheItems([it]);
        } catch {}
      }
      if (!it && cachedIds.has(id)) {
        it = {
          wrapperType: 'track',
          trackId: id,
          trackName: 'Cached track',
          artistName: '',
        };
      }
      if (it) items.push(it);
    }
    if (!items.length) {
      showToast('Could not load tracks', 'danger');
      return;
    }
    setQueue(items);
    setIndex(0);
    await playItem(items[0]);
  };

  const togglePlay = () => {
    if (!audioUrl) {
      if (queue.length > 0) {
        playItem(queue[Math.max(0, index)] || queue[0]);
      }
      return;
    }
    setPlaying(!playing);
  };

  const nextTrack = (userInitiated: boolean = true) => {
    if (!queue.length) return;
    if (repeat === 'one' && !userInitiated) {
      seekTo(0);
      setPlaying(true);
      return;
    }
    let nextIdx: number;
    if (shuffle && queue.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * queue.length);
      } while (nextIdx === index);
    } else {
      nextIdx = index + 1;
      if (nextIdx >= queue.length) {
        if (repeat === 'all') nextIdx = 0;
        else {
          setPlaying(false);
          setCurrentTime(0);
          return;
        }
      }
    }
    setIndex(nextIdx);
    playItem(queue[nextIdx]);
  };

  const prevTrack = () => {
    if (currentTime > 3) {
      seekTo(0);
      return;
    }
    if (!queue.length) return;
    let prevIdx = index - 1;
    if (prevIdx < 0) {
      prevIdx = repeat === 'all' ? queue.length - 1 : 0;
    }
    setIndex(prevIdx);
    playItem(queue[prevIdx]);
  };

  const toggleShuffle = () => {
    const next = !shuffle;
    setShuffle(next);
    showToast(next ? 'Shuffle on' : 'Shuffle off');
  };

  const cycleRepeat = () => {
    const order: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const next = order[(order.indexOf(repeat) + 1) % 3];
    setRepeat(next);
    showToast(next === 'off' ? 'Repeat off' : next === 'all' ? 'Repeat all' : 'Repeat one');
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.seek(seconds);
      setCurrentTime(seconds);
    }
  };

  const setSleepTimer = (minutes: number) => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    if (!minutes) {
      setSleepTimerMinutes(null);
      showToast('Sleep timer off');
      return;
    }
    setSleepTimerMinutes(minutes);
    showToast(`Sleep timer · ${minutes} min`);
    sleepTimerRef.current = setTimeout(() => {
      setPlaying(false);
      setSleepTimerMinutes(null);
      showToast('Sleep timer — paused');
    }, minutes * 60 * 1000);
  };

  const moveQueueItem = (fromIndex: number, direction: -1 | 1) => {
    const target = fromIndex + direction;
    if (target < 0 || target >= queue.length) return;
    const nextQueue = [...queue];
    const temp = nextQueue[fromIndex];
    nextQueue[fromIndex] = nextQueue[target];
    nextQueue[target] = temp;

    let nextIndex = index;
    if (index === fromIndex) nextIndex = target;
    else if (index === target) nextIndex = fromIndex;

    setQueue(nextQueue);
    setIndex(nextIndex);
  };

  const removeQueueItem = (i: number) => {
    if (i < 0 || i >= queue.length) return;
    const nextQueue = queue.filter((_, idx) => idx !== i);
    let nextIndex = index;
    if (i < index) nextIndex--;
    else if (i === index) nextIndex = Math.min(index, nextQueue.length - 1);

    setQueue(nextQueue);
    setIndex(nextIndex);
  };

  const clearQueue = () => {
    const nextQueue = track ? [track] : [];
    setQueue(nextQueue);
    setIndex(track ? 0 : -1);
    showToast('Queue cleared');
  };

  const shuffleQueue = () => {
    if (queue.length < 2) return;
    const currentTrack = index >= 0 ? queue[index] : null;
    const shuffled = [...queue];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }
    const newIdx = currentTrack ? shuffled.findIndex(t => String(t.trackId) === String(currentTrack.trackId)) : 0;
    setQueue(shuffled);
    setIndex(newIdx >= 0 ? newIdx : 0);
    showToast('Queue shuffled');
  };

  const addAllToQueue = (items: MusicItem[]) => {
    const list = items.filter(it => it && it.trackId);
    if (!list.length) {
      showToast('Nothing to add', 'warning');
      return;
    }
    const existingIds = new Set(queue.map(q => String(q.trackId)));
    let added = 0;
    const nextQueue = [...queue];
    for (const it of list) {
      const id = String(it.trackId);
      if (existingIds.has(id)) continue;
      nextQueue.push(it);
      existingIds.add(id);
      added++;
    }
    setQueue(nextQueue);
    if (index < 0 && nextQueue.length > 0) setIndex(0);
    showToast(added ? `Added ${added} track${added === 1 ? '' : 's'} to queue` : 'Already in queue', added ? 'success' : 'warning');
  };

  return (
    <PlayerContext.Provider
      value={{
        track,
        queue,
        index,
        playing,
        shuffle,
        repeat,
        currentTime,
        duration,
        audioUrl,
        sleepTimer,
        fullPlayerVisible,
        openFullPlayer,
        closeFullPlayer,
        fpTab,
        setFpTab,
        playItem,
        playById,
        playIds,
        togglePlay,
        nextTrack,
        prevTrack,
        toggleShuffle,
        cycleRepeat,
        seekTo,
        setSleepTimer,
        moveQueueItem,
        removeQueueItem,
        clearQueue,
        shuffleQueue,
        addAllToQueue,
      }}
    >
      <>
        {children}
        {audioUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: audioUrl }}
            paused={!playing}
            rate={settings.playbackRate}
            playInBackground={true}
            playWhenInactive={true}
            ignoreSilentSwitch="ignore"
            onProgress={data => {
              setCurrentTime(data.currentTime);
            }}
            onLoad={data => {
              setDuration(data.duration);
            }}
            onEnd={() => nextTrack(false)}
            onError={e => {
              console.warn('Video playback error:', e);
              showToast('Playback error', 'danger');
            }}
            style={{ width: 0, height: 0, position: 'absolute' }}
          />
        ) : null}
      </>
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
};

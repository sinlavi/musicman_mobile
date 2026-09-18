import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { usePlayer } from '../context/PlayerContext';
import { getArtwork, hasAudio, hasPreview } from '../services/api';
import { DL } from '../services/downloadManager';
import { MusicItem } from '../types';

interface TrackRowProps {
  item: MusicItem;
  playlistId?: string;
  onOpenMenu: (trackId: string, playlistId?: string) => void;
}

export const TrackRow: React.FC<TrackRowProps> = ({ item, playlistId, onOpenMenu }) => {
  const { navigate, isLiked, toggleLikeById, cachedIds } = useApp();
  const { track, playing, playById } = usePlayer();

  const id = String(item.trackId || '');
  const liked = isLiked(id);
  const isCurrent = track && String(track.trackId) === id;
  const isPlayingCurrent = isCurrent && playing;

  const cached = cachedIds.has(id);
  const fullAudio = hasAudio(item);
  const previewOnly = !fullAudio && hasPreview(item) && !cached;

  const [dlStatus, setDlStatus] = useState<string | null>(null);

  useEffect(() => {
    const updateStatus = () => {
      const dl = DL.get(id);
      if (dl && ['queued', 'crawling', 'saving'].includes(dl.status)) {
        setDlStatus(dl.status === 'saving' ? 'Downloading' : 'Crawling');
      } else {
        setDlStatus(null);
      }
    };
    updateStatus();
    const unsub = DL.onChange(updateStatus);
    return () => unsub();
  }, [id]);

  const art = getArtwork(item, 100);
  const fmtTime = (millis?: number) => {
    if (!millis) return '';
    const sec = Math.floor(millis / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const dur = item.trackTimeMillis ? fmtTime(item.trackTimeMillis) : '';
  const sub = [item.artistName, dur].filter(Boolean).join(' · ');

  return (
    <View style={[styles.container, isCurrent && styles.playingRow]}>
      <TouchableOpacity
        style={[styles.playBtn, isPlayingCurrent && styles.playingPlayBtn]}
        onPress={() => playById(id)}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name={isPlayingCurrent ? 'pause' : previewOnly ? 'play-circle-outline' : 'play-arrow'}
          size={24}
          color={isPlayingCurrent ? '#ffffff' : previewOnly ? '#38bdf8' : '#ffffff'}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.info}
        onPress={() => navigate({ name: 'track', trackId: id })}
        activeOpacity={0.7}
      >
        {art ? (
          <Image source={{ uri: art }} style={styles.art} />
        ) : (
          <View style={[styles.art, styles.artPh]}>
            <MaterialIcons name="music-note" size={20} color="#8e8e93" />
          </View>
        )}

        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, isCurrent && styles.playingTitle]}
              numberOfLines={1}
            >
              {item.trackName || 'Track'}
            </Text>

            {cached ? (
              <View style={[styles.badge, styles.badgeOffline]}>
                <Text style={[styles.badgeText, { color: '#198754' }]}>OFFLINE</Text>
              </View>
            ) : dlStatus ? (
              <View style={[styles.badge, styles.badgeCrawling]}>
                <Text style={[styles.badgeText, { color: '#0dcaf0' }]}>{dlStatus.toUpperCase()}</Text>
              </View>
            ) : previewOnly ? (
              <View style={[styles.badge, styles.badgePreview]}>
                <Text style={[styles.badgeText, { color: '#38bdf8' }]}>PREVIEW</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => toggleLikeById(id)}
        activeOpacity={0.7}
      >
        <MaterialIcons
          name={liked ? 'favorite' : 'favorite-border'}
          size={20}
          color={liked ? '#dc3545' : '#8e8e93'}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => onOpenMenu(id, playlistId)}
        activeOpacity={0.7}
      >
        <MaterialIcons name="more-vert" size={20} color="#8e8e93" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  playingRow: {
    backgroundColor: 'rgba(123, 47, 247, 0.12)',
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  playingPlayBtn: {
    backgroundColor: '#7b2ff7',
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  art: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  artPh: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
    marginLeft: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  playingTitle: {
    color: '#7b2ff7',
  },
  sub: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
  iconBtn: {
    padding: 8,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 6,
  },
  badgeOffline: {
    backgroundColor: 'rgba(25, 135, 84, 0.16)',
  },
  badgeCrawling: {
    backgroundColor: 'rgba(13, 202, 240, 0.16)',
  },
  badgePreview: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
});

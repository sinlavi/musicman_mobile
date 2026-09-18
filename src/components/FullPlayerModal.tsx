import React from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { usePlayer } from '../context/PlayerContext';
import { getArtwork, hasAudio } from '../services/api';
import { DL } from '../services/downloadManager';

interface FullPlayerModalProps {
  onOpenTrackMenu: (trackId: string) => void;
  onOpenPlaylistPicker: (trackId: string) => void;
  onOpenSleepTimer: () => void;
}

export const FullPlayerModal: React.FC<FullPlayerModalProps> = ({
  onOpenTrackMenu,
  onOpenPlaylistPicker,
  onOpenSleepTimer,
}) => {
  const {
    fullPlayerVisible,
    closeFullPlayer,
    fpTab,
    setFpTab,
    track,
    queue,
    index,
    playing,
    shuffle,
    repeat,
    currentTime,
    duration,
    togglePlay,
    nextTrack,
    prevTrack,
    toggleShuffle,
    cycleRepeat,
    seekTo,
    moveQueueItem,
    removeQueueItem,
    clearQueue,
    shuffleQueue,
    sleepTimer,
    playById,
  } = usePlayer();

  const { isLiked, toggleLikeById, navigate, cachedIds, showToast, recentlyPlayed } = useApp();

  if (!track) return null;

  const id = String(track.trackId || '');
  const liked = isLiked(id);
  const isOffline = cachedIds.has(id);
  const art = getArtwork(track, 600);

  const fmtTime = (sec: number) => {
    if (!sec || !isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const startDownload = async () => {
    try {
      await DL.add(track);
      showToast('Download started');
    } catch {
      showToast('Download failed', 'danger');
    }
  };

  const lyricsText =
    track.lyrics?.text ||
    track.lyrics?.plain ||
    (typeof track.lyrics === 'string' ? track.lyrics : null) ||
    'No lyrics available for this track.';

  return (
    <Modal
      visible={fullPlayerVisible}
      animationType="slide"
      onRequestClose={closeFullPlayer}
      transparent={false}
    >
      <View style={styles.container}>
        {/* Modal Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={closeFullPlayer} style={styles.iconBtn}>
            <MaterialIcons name="keyboard-arrow-down" size={32} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, fpTab === 'now' && styles.tabActive]}
              onPress={() => setFpTab('now')}
            >
              <Text style={[styles.tabText, fpTab === 'now' && styles.tabTextActive]}>Playing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, fpTab === 'queue' && styles.tabActive]}
              onPress={() => setFpTab('queue')}
            >
              <Text style={[styles.tabText, fpTab === 'queue' && styles.tabTextActive]}>
                Queue ({queue.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, fpTab === 'lyrics' && styles.tabActive]}
              onPress={() => setFpTab('lyrics')}
            >
              <Text style={[styles.tabText, fpTab === 'lyrics' && styles.tabTextActive]}>Lyrics</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => onOpenTrackMenu(id)} style={styles.iconBtn}>
            <MaterialIcons name="more-vert" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Tab Body */}
        {fpTab === 'now' ? (
          <ScrollView contentContainerStyle={styles.nowBody}>
            {art ? (
              <Image source={{ uri: art }} style={styles.art} />
            ) : (
              <View style={[styles.art, styles.artPh]}>
                <MaterialIcons name="music-note" size={80} color="#8e8e93" />
              </View>
            )}

            <View style={styles.metaBox}>
              <Text style={styles.title} numberOfLines={1}>
                {track.trackName || 'Track'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  closeFullPlayer();
                  if (track.artistId) navigate({ name: 'artist', artistId: String(track.artistId) });
                }}
              >
                <Text style={styles.artist} numberOfLines={1}>
                  {track.artistName || ''}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Seek bar */}
            <View style={styles.seekWrap}>
              <TouchableOpacity
                style={styles.seekBg}
                activeOpacity={1}
                onPress={e => {
                  if (duration > 0) {
                    const clickX = e.nativeEvent.locationX;
                    // Seek proportional approximation
                    const seekRatio = Math.max(0, Math.min(1, clickX / 300));
                    seekTo(seekRatio * duration);
                  }
                }}
              >
                <View style={[styles.seekFill, { width: `${pct}%` }]} />
              </TouchableOpacity>
              <View style={styles.timesRow}>
                <Text style={styles.timeText}>{fmtTime(currentTime)}</Text>
                <Text style={styles.timeText}>{fmtTime(duration)}</Text>
              </View>
            </View>

            {/* Player Controls */}
            <View style={styles.controlsRow}>
              <TouchableOpacity onPress={toggleShuffle}>
                <MaterialIcons name="shuffle" size={24} color={shuffle ? '#7b2ff7' : '#8e8e93'} />
              </TouchableOpacity>

              <TouchableOpacity onPress={prevTrack}>
                <MaterialIcons name="skip-previous" size={38} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
                <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={42} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => nextTrack()}>
                <MaterialIcons name="skip-next" size={38} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={cycleRepeat}>
                <MaterialIcons
                  name={repeat === 'one' ? 'repeat-one' : 'repeat'}
                  size={24}
                  color={repeat !== 'off' ? '#7b2ff7' : '#8e8e93'}
                />
              </TouchableOpacity>
            </View>

            {/* Action Bar */}
            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={() => toggleLikeById(id)}>
                <MaterialIcons
                  name={liked ? 'favorite' : 'favorite-border'}
                  size={24}
                  color={liked ? '#dc3545' : '#ffffff'}
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={startDownload}>
                <MaterialIcons
                  name={isOffline ? 'cloud-done' : 'cloud-download'}
                  size={24}
                  color={isOffline ? '#198754' : '#ffffff'}
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => onOpenPlaylistPicker(id)}>
                <MaterialIcons name="playlist-add" size={26} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity onPress={onOpenSleepTimer}>
                <MaterialIcons
                  name="brightness-3"
                  size={22}
                  color={sleepTimer ? '#7b2ff7' : '#ffffff'}
                />
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : null}

        {fpTab === 'queue' ? (
          <ScrollView style={styles.queueBody} contentContainerStyle={{ paddingBottom: 32 }}>
            <View style={styles.queueHeader}>
              <Text style={styles.queueTitle}>NOW PLAYING · {queue.length}</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={shuffleQueue}>
                  <MaterialIcons name="shuffle" size={22} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={clearQueue}>
                  <MaterialIcons name="delete-outline" size={22} color="#dc3545" />
                </TouchableOpacity>
              </View>
            </View>

            {queue.map((tr, i) => {
              const active = i === index;
              const trArt = getArtwork(tr, 100);
              return (
                <View key={i} style={[styles.qRow, active && styles.qRowActive]}>
                  <View style={styles.qDrag}>
                    <TouchableOpacity
                      disabled={i === 0}
                      onPress={() => moveQueueItem(i, -1)}
                    >
                      <MaterialIcons name="keyboard-arrow-up" size={20} color={i === 0 ? '#444' : '#8e8e93'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={i === queue.length - 1}
                      onPress={() => moveQueueItem(i, 1)}
                    >
                      <MaterialIcons name="keyboard-arrow-down" size={20} color={i === queue.length - 1 ? '#444' : '#8e8e93'} />
                    </TouchableOpacity>
                  </View>

                  {trArt ? (
                    <Image source={{ uri: trArt }} style={styles.qArt} />
                  ) : (
                    <View style={[styles.qArt, styles.artPh]}>
                      <MaterialIcons name="music-note" size={18} color="#8e8e93" />
                    </View>
                  )}

                  <TouchableOpacity
                    style={{ flex: 1, marginLeft: 10 }}
                    onPress={() => playById(tr.trackId!)}
                  >
                    <Text style={[styles.qTitle, active && styles.qTitleActive]} numberOfLines={1}>
                      {tr.trackName || 'Track'}
                    </Text>
                    <Text style={styles.qSub} numberOfLines={1}>
                      {tr.artistName || ''}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => removeQueueItem(i)}>
                    <MaterialIcons name="close" size={20} color="#8e8e93" />
                  </TouchableOpacity>
                </View>
              );
            })}

            {recentlyPlayed.length > 0 ? (
              <View style={{ marginTop: 20 }}>
                <Text style={styles.queueTitle}>RECENTLY PLAYED</Text>
                {recentlyPlayed.slice(0, 8).map((r, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.qRow}
                    onPress={() => playById(r.trackId)}
                  >
                    {r.artworkUrl ? (
                      <Image source={{ uri: r.artworkUrl }} style={styles.qArt} />
                    ) : (
                      <View style={[styles.qArt, styles.artPh]}>
                        <MaterialIcons name="music-note" size={18} color="#8e8e93" />
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.qTitle} numberOfLines={1}>{r.trackName}</Text>
                      <Text style={styles.qSub} numberOfLines={1}>{r.artistName}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {fpTab === 'lyrics' ? (
          <ScrollView style={styles.lyricsBody} contentContainerStyle={{ paddingBottom: 32 }}>
            <Text style={styles.lyricsText}>{lyricsText}</Text>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0d',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  iconBtn: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#1f1f24',
  },
  tabText: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  nowBody: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  art: {
    width: 280,
    height: 280,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  artPh: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaBox: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  artist: {
    color: '#8e8e93',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  seekWrap: {
    width: '100%',
    marginTop: 24,
  },
  seekBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  seekFill: {
    height: '100%',
    backgroundColor: '#7b2ff7',
  },
  timesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    color: '#8e8e93',
    fontSize: 11,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7b2ff7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 28,
  },
  queueBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  queueTitle: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  qRowActive: {
    backgroundColor: 'rgba(123, 47, 247, 0.15)',
  },
  qDrag: {
    marginRight: 6,
  },
  qArt: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  qTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  qTitleActive: {
    color: '#7b2ff7',
    fontWeight: '800',
  },
  qSub: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
  lyricsBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  lyricsText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 24,
  },
});

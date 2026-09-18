import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { TrackRow } from '../components/TrackRow';
import { useApp } from '../context/AppContext';
import { usePlayer } from '../context/PlayerContext';
import {
  cacheAll,
  cacheClear,
  cacheDel,
  CachedTrackMeta,
  DL,
} from '../services/downloadManager';
import { DownloadItem, MusicItem } from '../types';

interface LibraryViewProps {
  onOpenMenu: (trackId: string, playlistId?: string) => void;
  onNewPlaylist: () => void;
  onOpenPlaylist: (plId: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  onOpenMenu,
  onNewPlaylist,
  onOpenPlaylist,
}) => {
  const {
    route,
    navigate,
    likes,
    followed,
    playlists,
    toggleFollow,
    showToast,
    refreshCachedIds,
  } = useApp();
  const { playIds, playById, track, playing } = usePlayer();

  const subtab = route.name === 'library' ? route.subtab || 'likes' : 'likes';

  const [activeDl, setActiveDl] = useState<DownloadItem[]>([]);
  const [offlineFiles, setOfflineFiles] = useState<CachedTrackMeta[]>([]);

  const refreshOffline = async () => {
    const all = await cacheAll();
    setOfflineFiles(all);
    setActiveDl([...DL.active(), ...DL.ready(), ...DL.failed()]);
  };

  useEffect(() => {
    refreshOffline();
    const unsub = DL.onChange(refreshOffline);
    return () => unsub();
  }, []);

  const clearAllOffline = async () => {
    await cacheClear();
    await refreshCachedIds();
    await refreshOffline();
    showToast('Offline cache cleared');
  };

  const likesAsItems: MusicItem[] = likes.map(l => ({
    wrapperType: 'track',
    trackId: l.trackId,
    trackName: l.trackName,
    artistName: l.artistName,
    artistId: l.artistId,
    collectionName: l.collectionName,
    collectionId: l.collectionId,
    artworkUrl100: l.artworkUrl,
  }));

  const playAllLikes = () => {
    const ids = likes.map(l => l.trackId).join(',');
    playIds(ids);
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      {/* Segmented Bar */}
      <View style={styles.segBar}>
        <TouchableOpacity
          style={[styles.segTab, subtab === 'likes' && styles.segTabActive]}
          onPress={() => navigate({ name: 'library', subtab: 'likes' })}
        >
          <Text style={[styles.segText, subtab === 'likes' && styles.segTextActive]}>
            Liked
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segTab, subtab === 'following' && styles.segTabActive]}
          onPress={() => navigate({ name: 'library', subtab: 'following' })}
        >
          <Text style={[styles.segText, subtab === 'following' && styles.segTextActive]}>
            Following
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segTab, subtab === 'playlists' && styles.segTabActive]}
          onPress={() => navigate({ name: 'library', subtab: 'playlists' })}
        >
          <Text style={[styles.segText, subtab === 'playlists' && styles.segTextActive]}>
            Lists
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segTab, subtab === 'downloads' && styles.segTabActive]}
          onPress={() => navigate({ name: 'library', subtab: 'downloads' })}
        >
          <Text style={[styles.segText, subtab === 'downloads' && styles.segTextActive]}>
            Offline
          </Text>
          {activeDl.length > 0 ? (
            <View style={styles.segBadge}>
              <Text style={styles.segBadgeText}>{activeDl.length}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }}>
        {subtab === 'likes' ? (
          <View style={styles.section}>
            {likes.length > 0 ? (
              <>
                <View style={styles.topRow}>
                  <Text style={styles.countText}>{likes.length} liked songs</Text>
                  <TouchableOpacity style={styles.playAllBtn} onPress={playAllLikes}>
                    <MaterialIcons name="play-arrow" size={20} color="#ffffff" />
                    <Text style={styles.playAllText}>Play all</Text>
                  </TouchableOpacity>
                </View>
                {likesAsItems.map(item => (
                  <TrackRow key={item.trackId} item={item} onOpenMenu={onOpenMenu} />
                ))}
              </>
            ) : (
              <View style={styles.empty}>
                <MaterialIcons name="favorite-border" size={48} color="#8e8e93" />
                <Text style={styles.emptyText}>No liked songs yet</Text>
                <Text style={styles.emptySub}>Tap the heart on any track to save it here.</Text>
              </View>
            )}
          </View>
        ) : null}

        {subtab === 'following' ? (
          <View style={styles.section}>
            {followed.length > 0 ? (
              <>
                <Text style={styles.secTitle}>{followed.length} ARTISTS</Text>
                {followed.map(a => (
                  <TouchableOpacity
                    key={a.artistId}
                    style={styles.rowItem}
                    onPress={() => navigate({ name: 'artist', artistId: a.artistId })}
                  >
                    {a.artwork ? (
                      <Image source={{ uri: a.artwork }} style={styles.artistArt} />
                    ) : (
                      <View style={[styles.artistArt, styles.artPh]}>
                        <MaterialIcons name="person" size={24} color="#7b2ff7" />
                      </View>
                    )}
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{a.artistName || 'Artist'}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>{a.primaryGenreName || 'Musician'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleFollow(a.artistId)}>
                      <MaterialIcons name="check" size={22} color="#7b2ff7" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <View style={styles.empty}>
                <MaterialIcons name="person-add" size={48} color="#8e8e93" />
                <Text style={styles.emptyText}>Not following any artists</Text>
                <Text style={styles.emptySub}>Follow artists to see them here.</Text>
              </View>
            )}
          </View>
        ) : null}

        {subtab === 'playlists' ? (
          <View style={styles.section}>
            <View style={styles.topRow}>
              <Text style={styles.countText}>Your playlists</Text>
              <TouchableOpacity style={styles.newPlBtn} onPress={onNewPlaylist}>
                <MaterialIcons name="add" size={18} color="#ffffff" />
                <Text style={styles.newPlText}>New</Text>
              </TouchableOpacity>
            </View>

            {playlists.length > 0 ? (
              playlists.map(pl => {
                const cover = pl.tracks.find(t => t.artworkUrl)?.artworkUrl || '';
                return (
                  <TouchableOpacity
                    key={pl.id}
                    style={styles.rowItem}
                    onPress={() => onOpenPlaylist(pl.id)}
                  >
                    {cover ? (
                      <Image source={{ uri: cover }} style={styles.plArt} />
                    ) : (
                      <View style={[styles.plArt, styles.artPh]}>
                        <MaterialIcons name="playlist-play" size={24} color="#8e8e93" />
                      </View>
                    )}
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{pl.name}</Text>
                      <Text style={styles.rowSub}>{pl.tracks.length} tracks</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#8e8e93" />
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.empty}>
                <MaterialIcons name="playlist-add" size={48} color="#8e8e93" />
                <Text style={styles.emptyText}>No playlists yet</Text>
                <Text style={styles.emptySub}>Create one to organize your music.</Text>
              </View>
            )}
          </View>
        ) : null}

        {subtab === 'downloads' ? (
          <View style={styles.section}>
            {activeDl.length > 0 ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.secTitle}>IN PROGRESS ({activeDl.length})</Text>
                {activeDl.map(it => (
                  <View key={it.trackId} style={styles.dlRow}>
                    <View style={styles.dlBody}>
                      <Text style={styles.dlTitle} numberOfLines={1}>{it.name}</Text>
                      <Text style={styles.dlSub} numberOfLines={1}>
                        {it.status.toUpperCase()} · {it.percent}%
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => DL.remove(it.trackId)}>
                      <MaterialIcons name="close" size={20} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.topRow}>
              <View>
                <Text style={styles.countText}>Available offline</Text>
                <Text style={styles.rowSub}>{offlineFiles.length} tracks</Text>
              </View>
              {offlineFiles.length > 0 ? (
                <TouchableOpacity style={styles.clearBtn} onPress={clearAllOffline}>
                  <MaterialIcons name="delete-sweep" size={18} color="#dc3545" />
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {offlineFiles.length > 0 ? (
              offlineFiles.map(e => {
                const isPlayingThis = track && String(track.trackId) === String(e.trackId);
                return (
                  <View key={e.trackId} style={styles.rowItem}>
                    <TouchableOpacity
                      style={styles.playBtn}
                      onPress={() => playById(e.trackId)}
                    >
                      <MaterialIcons
                        name={isPlayingThis && playing ? 'pause' : 'play-arrow'}
                        size={22}
                        color="#ffffff"
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rowInfo}
                      onPress={() => navigate({ name: 'track', trackId: e.trackId })}
                    >
                      {e.artwork ? (
                        <Image source={{ uri: e.artwork }} style={styles.plArt} />
                      ) : (
                        <View style={[styles.plArt, styles.artPh]}>
                          <MaterialIcons name="music-note" size={22} color="#8e8e93" />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{e.name}</Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {e.artist} · {fmtSize(e.size)}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={async () => {
                        await cacheDel(e.trackId);
                        await refreshCachedIds();
                        await refreshOffline();
                        showToast('Removed from offline');
                      }}
                    >
                      <MaterialIcons name="delete" size={20} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <View style={styles.empty}>
                <MaterialIcons name="cloud-download" size={48} color="#8e8e93" />
                <Text style={styles.emptyText}>Nothing offline yet</Text>
                <Text style={styles.emptySub}>Download tracks to listen without internet.</Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0d',
  },
  segBar: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#0b0b0d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  segTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 3,
    flexDirection: 'row',
  },
  segTabActive: {
    backgroundColor: '#7b2ff7',
  },
  segText: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '700',
  },
  segTextActive: {
    color: '#ffffff',
  },
  segBadge: {
    backgroundColor: '#0dcaf0',
    borderRadius: 8,
    paddingHorizontal: 4,
    marginLeft: 4,
  },
  segBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
  section: {
    paddingTop: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  countText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#198754',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  playAllText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  newPlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7b2ff7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  newPlText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 53, 69, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  clearBtnText: {
    color: '#dc3545',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  secTitle: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  artistArt: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  plArt: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  artPh: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowInfo: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  rowSub: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
  dlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 6,
  },
  dlBody: {
    flex: 1,
  },
  dlTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  dlSub: {
    color: '#0dcaf0',
    fontSize: 11,
    marginTop: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7b2ff7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    color: '#8e8e93',
    fontSize: 13,
    marginTop: 4,
  },
});

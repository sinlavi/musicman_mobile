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
import { Skeleton } from '../components/Skeleton';
import { TrackRow } from '../components/TrackRow';
import { useApp } from '../context/AppContext';
import { usePlayer } from '../context/PlayerContext';
import { apiLookup, getArtwork, hasAudio, itemType } from '../services/api';
import { DL } from '../services/downloadManager';
import { MusicItem } from '../types';

interface AlbumViewProps {
  albumId: string;
  onOpenMenu: (trackId: string) => void;
  onOpenAlbumMenu: (items: MusicItem[]) => void;
}

export const AlbumView: React.FC<AlbumViewProps> = ({
  albumId,
  onOpenMenu,
  onOpenAlbumMenu,
}) => {
  const { navigate, cacheItems, showToast, cachedIds } = useApp();
  const { playIds } = usePlayer();

  const [loading, setLoading] = useState<boolean>(true);
  const [album, setAlbum] = useState<MusicItem | null>(null);
  const [tracks, setTracks] = useState<MusicItem[]>([]);

  useEffect(() => {
    fetchAlbum();
  }, [albumId]);

  const fetchAlbum = async () => {
    setLoading(true);
    try {
      const albRes = await apiLookup(albumId, 'album');
      const albObj = albRes.find(x => itemType(x) === 'collection') || albRes[0];
      setAlbum(albObj || null);

      const trackRes = await apiLookup(albumId, 'song');
      const trackList = trackRes.filter(x => itemType(x) === 'track');
      setTracks(trackList);
      cacheItems(trackList);
    } catch (e) {
      console.warn('Album fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const crawlAlbum = async () => {
    try {
      await DL.add({ collectionId: albumId } as any);
      showToast('Crawl queued');
    } catch {
      showToast('Crawl failed', 'danger');
    }
  };

  if (loading) return <Skeleton />;
  if (!album) {
    return (
      <View style={styles.centerState}>
        <MaterialIcons name="album" size={48} color="#8e8e93" />
        <Text style={styles.stateText}>Album not found</Text>
      </View>
    );
  }

  const art = getArtwork(album, 600);
  const year = album.releaseDate ? new Date(album.releaseDate).getFullYear() : '';
  const missing = tracks.filter(t => !hasAudio(t) && !cachedIds.has(String(t.trackId))).length;
  const ids = tracks.map(t => String(t.trackId)).join(',');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.hero}>
        {art ? (
          <Image source={{ uri: art }} style={styles.heroArt} />
        ) : (
          <View style={[styles.heroArt, styles.heroArtPh]}>
            <MaterialIcons name="album" size={64} color="#8e8e93" />
          </View>
        )}
        <Text style={styles.heroTitle}>{album.collectionName || 'Album'}</Text>
        <TouchableOpacity
          onPress={() => album.artistId && navigate({ name: 'artist', artistId: String(album.artistId) })}
        >
          <Text style={styles.heroSubLink}>{album.artistName || ''}</Text>
        </TouchableOpacity>
        <Text style={styles.heroSubMeta}>
          {[year, `${tracks.length} tracks`].filter(Boolean).join(' · ')}
        </Text>

        {/* Action Bar */}
        <View style={styles.actionBar}>
          {tracks.length > 0 ? (
            <TouchableOpacity style={styles.btnSuccess} onPress={() => playIds(ids)}>
              <MaterialIcons name="play-arrow" size={20} color="#ffffff" />
              <Text style={styles.btnText}>Play</Text>
            </TouchableOpacity>
          ) : null}

          {tracks.length > 0 && missing > 0 ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={crawlAlbum}>
              <MaterialIcons name="cloud-download" size={18} color="#ffffff" />
              <Text style={styles.btnText}>Crawl all ({missing})</Text>
            </TouchableOpacity>
          ) : null}

          {tracks.length > 0 ? (
            <TouchableOpacity style={styles.btnIcon} onPress={() => onOpenAlbumMenu(tracks)}>
              <MaterialIcons name="more-horiz" size={22} color="#ffffff" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.secTitle}>TRACKS</Text>
        {tracks.map(item => (
          <TrackRow key={item.trackId} item={item} onOpenMenu={onOpenMenu} />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0d',
  },
  hero: {
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  heroArt: {
    width: 200,
    height: 200,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroArtPh: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
    textAlign: 'center',
  },
  heroSubLink: {
    color: '#7b2ff7',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  heroSubMeta: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 4,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  btnSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#198754',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7b2ff7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  btnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.09)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  section: {
    marginTop: 16,
  },
  secTitle: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
});

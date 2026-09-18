import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CardAlbum } from '../components/Cards';
import { Skeleton } from '../components/Skeleton';
import { TrackRow } from '../components/TrackRow';
import { useApp } from '../context/AppContext';
import { usePlayer } from '../context/PlayerContext';
import {
  apiArtistTracks,
  apiLookup,
  getArtwork,
  itemType,
} from '../services/api';
import { DL } from '../services/downloadManager';
import { MusicItem } from '../types';

interface ArtistViewProps {
  artistId: string;
  onOpenMenu: (trackId: string) => void;
  onOpenArtistMenu: (items: MusicItem[]) => void;
}

export const ArtistView: React.FC<ArtistViewProps> = ({
  artistId,
  onOpenMenu,
  onOpenArtistMenu,
}) => {
  const { navigate, isFollowed, toggleFollow, cacheItems, showToast } = useApp();
  const { playIds } = usePlayer();

  const [loading, setLoading] = useState<boolean>(true);
  const [artist, setArtist] = useState<MusicItem | null>(null);
  const [albums, setAlbums] = useState<MusicItem[]>([]);
  const [tracks, setTracks] = useState<MusicItem[]>([]);

  const [sort, setSort] = useState<'album' | 'recent' | 'name' | 'views'>('album');
  const [page, setPage] = useState<number>(1);
  const [totalTracks, setTotalTracks] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  useEffect(() => {
    fetchInitial();
  }, [artistId]);

  const fetchInitial = async () => {
    setLoading(true);
    try {
      const r = await apiLookup(artistId, 'musicArtist');
      const artObj = r.find(x => itemType(x) === 'artist') || r[0];
      setArtist(artObj || null);

      const albumRes = await apiLookup(artistId, 'album').catch(() => []);
      const albMap = new Map<string, MusicItem>();
      for (const a of albumRes.filter(x => itemType(x) === 'collection')) {
        const cid = String(a.collectionId || '');
        if (cid && !albMap.has(cid)) albMap.set(cid, a);
      }
      const albumList = Array.from(albMap.values());
      setAlbums(albumList);
      cacheItems(albumList);

      const tracksRes = await apiArtistTracks(artistId, { page: 1, limit: 50, sort });
      const trackList = (tracksRes.results || []).filter(t => itemType(t) === 'track');
      setTracks(trackList);
      setTotalTracks(tracksRes.total || trackList.length);
      setHasMore(Boolean(tracksRes.hasMore));
      setPage(1);
      cacheItems(trackList);
    } catch (e) {
      console.warn('Artist fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const changeSort = async (newSort: 'album' | 'recent' | 'name' | 'views') => {
    if (newSort === sort) return;
    setSort(newSort);
    setLoadingMore(true);
    try {
      const tracksRes = await apiArtistTracks(artistId, { page: 1, limit: 50, sort: newSort });
      const trackList = (tracksRes.results || []).filter(t => itemType(t) === 'track');
      setTracks(trackList);
      setTotalTracks(tracksRes.total || trackList.length);
      setHasMore(Boolean(tracksRes.hasMore));
      setPage(1);
      cacheItems(trackList);
    } catch {}
    finally {
      setLoadingMore(false);
    }
  };

  const loadMoreTracks = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const tracksRes = await apiArtistTracks(artistId, { page: nextPage, limit: 50, sort });
      const newTracks = (tracksRes.results || []).filter(t => itemType(t) === 'track');
      setTracks(prev => [...prev, ...newTracks]);
      setHasMore(Boolean(tracksRes.hasMore));
      setPage(nextPage);
      cacheItems(newTracks);
    } catch {}
    finally {
      setLoadingMore(false);
    }
  };

  const crawlArtist = async () => {
    try {
      await DL.add({ trackId: artistId } as any);
      showToast('Crawl queued');
    } catch {
      showToast('Crawl failed', 'danger');
    }
  };

  if (loading) return <Skeleton />;
  if (!artist) {
    return (
      <View style={styles.centerState}>
        <MaterialIcons name="person" size={48} color="#8e8e93" />
        <Text style={styles.stateText}>Artist not found</Text>
      </View>
    );
  }

  let artistArt = '';
  for (const a of albums) {
    const ar = getArtwork(a, 400);
    if (ar) {
      artistArt = ar;
      break;
    }
  }

  const followed = isFollowed(artistId);
  const fullAlbums = albums.filter(a => (a.trackCount || 0) > 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      onScroll={({ nativeEvent }) => {
        const isCloseToBottom =
          nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
          nativeEvent.contentSize.height - 400;
        if (isCloseToBottom) loadMoreTracks();
      }}
      scrollEventThrottle={200}
    >
      <View style={styles.hero}>
        {artistArt ? (
          <Image source={{ uri: artistArt }} style={styles.heroArt} />
        ) : (
          <View style={[styles.heroArt, styles.heroArtPh]}>
            <MaterialIcons name="person" size={56} color="#7b2ff7" />
          </View>
        )}
        <Text style={styles.heroTitle}>{artist.artistName || 'Artist'}</Text>
        <Text style={styles.heroSub}>
          {[
            artist.primaryGenreName,
            albums.length ? `${albums.length} albums` : '',
            `${tracks.length} of ${totalTracks} tracks`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>

        {/* Action Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionBar}>
          <TouchableOpacity
            style={styles.btnSuccess}
            onPress={() => playIds(tracks.map(t => String(t.trackId)).join(','))}
          >
            <MaterialIcons name="play-arrow" size={20} color="#ffffff" />
            <Text style={styles.btnText}>Play all</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPill, followed && styles.btnFollowed]}
            onPress={() => toggleFollow(artistId, artistArt)}
          >
            <MaterialIcons name={followed ? 'check' : 'add'} size={18} color="#ffffff" />
            <Text style={styles.btnText}>{followed ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnPill} onPress={crawlArtist}>
            <MaterialIcons name="cloud-download" size={18} color="#ffffff" />
            <Text style={styles.btnText}>Crawl artist</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnIcon} onPress={() => onOpenArtistMenu(tracks)}>
            <MaterialIcons name="more-horiz" size={22} color="#ffffff" />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {fullAlbums.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.secTitle}>ALBUMS · {fullAlbums.length}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16 }}>
            {fullAlbums.map(item => (
              <CardAlbum key={item.collectionId} item={item} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.secTitle}>TRACKS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.chip, sort === 'album' && styles.chipOn]}
            onPress={() => changeSort('album')}
          >
            <Text style={[styles.chipText, sort === 'album' && styles.chipTextOn]}>Album</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, sort === 'recent' && styles.chipOn]}
            onPress={() => changeSort('recent')}
          >
            <Text style={[styles.chipText, sort === 'recent' && styles.chipTextOn]}>Recent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, sort === 'name' && styles.chipOn]}
            onPress={() => changeSort('name')}
          >
            <Text style={[styles.chipText, sort === 'name' && styles.chipTextOn]}>A–Z</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, sort === 'views' && styles.chipOn]}
            onPress={() => changeSort('views')}
          >
            <Text style={[styles.chipText, sort === 'views' && styles.chipTextOn]}>Popular</Text>
          </TouchableOpacity>
        </ScrollView>

        {tracks.map(item => (
          <TrackRow key={item.trackId} item={item} onOpenMenu={onOpenMenu} />
        ))}

        {loadingMore ? (
          <View style={{ paddingVertical: 20 }}>
            <ActivityIndicator size="small" color="#7b2ff7" />
          </View>
        ) : null}
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
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(123,47,247,0.15)',
  },
  heroArtPh: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
  },
  heroSub: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 4,
  },
  actionBar: {
    flexDirection: 'row',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  btnSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#198754',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
  },
  btnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7b2ff7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
  },
  btnFollowed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
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
  filterRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginRight: 6,
  },
  chipOn: {
    backgroundColor: '#7b2ff7',
  },
  chipText: {
    color: '#8e8e93',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextOn: {
    color: '#ffffff',
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

import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CardAlbum, CardArtist, CardTrack, CardTrackPopular } from '../components/Cards';
import { Skeleton } from '../components/Skeleton';
import { useApp } from '../context/AppContext';
import { apiFresh, apiPopular, itemType } from '../services/api';
import { MusicItem } from '../types';

export const HomeView: React.FC = () => {
  const { recentlyPlayed, cacheItems } = useApp();
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [freshItems, setFreshItems] = useState<MusicItem[]>([]);
  const [popularItems, setPopularItems] = useState<MusicItem[]>([]);

  const fetchData = async () => {
    try {
      const [fresh, popular] = await Promise.all([
        apiFresh().catch(() => []),
        apiPopular(40).catch(() => []),
      ]);
      setFreshItems(fresh);
      setPopularItems(popular);
      cacheItems([...fresh, ...popular]);
    } catch (e) {
      console.warn('Home fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) return <Skeleton />;

  const artists = freshItems.filter(i => itemType(i) === 'artist');
  const albums = freshItems.filter(i => itemType(i) === 'collection');
  const tracks = freshItems.filter(i => itemType(i) === 'track');

  const seen = new Set<string>();
  const popular = popularItems
    .filter(i => itemType(i) === 'track')
    .filter(i => {
      const id = String(i.trackId || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? 'Good night'
      : hour < 12
      ? 'Good morning'
      : hour < 18
      ? 'Good afternoon'
      : 'Good evening';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7b2ff7" />}
    >
      <View style={styles.headerBox}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.subGreeting}>Welcome back to MusicMan</Text>
      </View>

      {recentlyPlayed.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.secTitle}>RECENTLY PLAYED</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
            {recentlyPlayed.slice(0, 10).map(r => (
              <CardTrack
                key={r.trackId}
                item={{
                  wrapperType: 'track',
                  trackId: r.trackId,
                  trackName: r.trackName,
                  artistName: r.artistName,
                  artworkUrl100: r.artworkUrl,
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {popular.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.secTitle}>POPULAR</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
            {popular.slice(0, 20).map(item => (
              <CardTrackPopular key={item.trackId} item={item} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {tracks.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.secTitle}>{recentlyPlayed.length ? 'FRESH MUSIC' : 'FRESH'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
            {tracks.map(item => (
              <CardTrack key={item.trackId} item={item} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {artists.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.secTitle}>FRESH ARTISTS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
            {artists.map(item => (
              <CardArtist key={item.artistId} item={item} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {albums.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.secTitle}>FRESH ALBUMS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
            {albums.map(item => (
              <CardAlbum key={item.collectionId} item={item} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!tracks.length && !popular.length && !recentlyPlayed.length ? (
        <View style={styles.empty}>
          <MaterialIcons name="library-music" size={48} color="#8e8e93" />
          <Text style={styles.emptyText}>Nothing to show yet</Text>
          <Text style={styles.emptySub}>Try searching for music above.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0d',
  },
  content: {
    paddingBottom: 32,
  },
  headerBox: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subGreeting: {
    color: '#8e8e93',
    fontSize: 13,
    marginTop: 2,
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
    marginBottom: 10,
  },
  hscroll: {
    paddingLeft: 16,
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

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { CardAlbum, CardArtist } from '../components/Cards';
import { TrackRow } from '../components/TrackRow';
import { useApp } from '../context/AppContext';
import { apiSearch, apiSuggest, itemType } from '../services/api';
import { MusicItem, Suggestion } from '../types';

interface SearchViewProps {
  onOpenMenu: (trackId: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onOpenMenu }) => {
  const {
    route,
    navigate,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    cacheItems,
  } = useApp();

  const queryParam = route.name === 'search' ? route.query || '' : '';

  const [term, setTerm] = useState<string>(queryParam);
  const [filter, setFilter] = useState<'all' | 'artist' | 'album' | 'track'>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<MusicItem[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const suggestTimer = useRef<any>(null);

  useEffect(() => {
    if (queryParam) {
      setTerm(queryParam);
      performSearch(queryParam);
    }
  }, [queryParam]);

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setShowSuggestions(false);
    try {
      const items = await apiSearch(searchTerm);
      setResults(items);
      cacheItems(items);
      await addRecentSearch(searchTerm);
    } catch (e) {
      console.warn('Search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onTermChange = (text: string) => {
    setTerm(text);
    if (!text.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      try {
        const list = await apiSuggest(text);
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch {}
    }, 200);
  };

  const onSubmit = () => {
    if (!term.trim()) return;
    performSearch(term.trim());
  };

  const pickSuggestion = (s: Suggestion) => {
    setShowSuggestions(false);
    addRecentSearch(s.name);
    navigate({
      name: s.type === 'artist' ? 'artist' : s.type === 'collection' ? 'album' : 'track',
      ...(s.type === 'artist'
        ? { artistId: s.id }
        : s.type === 'collection'
        ? { albumId: s.id }
        : { trackId: s.id }),
    } as any);
  };

  const artists = results.filter(i => itemType(i) === 'artist');
  const albums = results.filter(i => itemType(i) === 'collection');
  const tracks = results.filter(i => itemType(i) === 'track');

  const showTracks = filter === 'all' || filter === 'track';
  const showAlbums = filter === 'all' || filter === 'album';
  const showArtists = filter === 'all' || filter === 'artist';

  return (
    <View style={styles.container}>
      <View style={styles.searchHeader}>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color="#8e8e93" />
          <TextInput
            style={styles.input}
            placeholder="Songs, albums, artists…"
            placeholderTextColor="#8e8e93"
            value={term}
            onChangeText={onTermChange}
            onSubmitEditing={onSubmit}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {term ? (
            <TouchableOpacity onPress={() => { setTerm(''); setResults([]); setSuggestions([]); setShowSuggestions(false); }}>
              <MaterialIcons name="cancel" size={18} color="#8e8e93" />
            </TouchableOpacity>
          ) : null}
        </View>

        {term ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <TouchableOpacity style={[styles.chip, filter === 'all' && styles.chipOn]} onPress={() => setFilter('all')}>
              <Text style={[styles.chipText, filter === 'all' && styles.chipTextOn]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, filter === 'artist' && styles.chipOn]} onPress={() => setFilter('artist')}>
              <Text style={[styles.chipText, filter === 'artist' && styles.chipTextOn]}>Artists</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, filter === 'album' && styles.chipOn]} onPress={() => setFilter('album')}>
              <Text style={[styles.chipText, filter === 'album' && styles.chipTextOn]}>Albums</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chip, filter === 'track' && styles.chipOn]} onPress={() => setFilter('track')}>
              <Text style={[styles.chipText, filter === 'track' && styles.chipTextOn]}>Songs</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}
      </View>

      {/* Suggestion Dropdown Overlay */}
      {showSuggestions && suggestions.length > 0 ? (
        <View style={styles.suggestOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {suggestions.map((s, idx) => (
              <TouchableOpacity key={idx} style={styles.sgItem} onPress={() => pickSuggestion(s)}>
                <MaterialIcons
                  name={s.type === 'artist' ? 'person' : s.type === 'collection' ? 'album' : 'music-note'}
                  size={18}
                  color="#8e8e93"
                />
                <Text style={styles.sgTitle} numberOfLines={1}>{s.name}</Text>
                <View style={styles.sgBadge}>
                  <Text style={styles.sgBadgeText}>
                    {s.type === 'artist' ? 'ARTIST' : s.type === 'collection' ? 'ALBUM' : 'SONG'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }}>
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#7b2ff7" />
          </View>
        ) : !term ? (
          <View style={styles.recentSection}>
            {recentSearches.length > 0 ? (
              <>
                <View style={styles.recentHeader}>
                  <Text style={styles.secTitle}>RECENT SEARCHES</Text>
                  <TouchableOpacity onPress={clearRecentSearches}>
                    <MaterialIcons name="delete-outline" size={20} color="#8e8e93" />
                  </TouchableOpacity>
                </View>
                {recentSearches.map((r, i) => (
                  <TouchableOpacity key={i} style={styles.recentItem} onPress={() => { setTerm(r); performSearch(r); }}>
                    <MaterialIcons name="history" size={20} color="#8e8e93" />
                    <Text style={styles.recentText}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <View style={styles.empty}>
                <MaterialIcons name="search" size={48} color="#8e8e93" />
                <Text style={styles.emptyText}>Find your music</Text>
                <Text style={styles.emptySub}>Search for songs, albums, and artists.</Text>
              </View>
            )}
          </View>
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="sentiment-dissatisfied" size={48} color="#8e8e93" />
            <Text style={styles.emptyText}>No results for "{term}"</Text>
            <Text style={styles.emptySub}>Try different keywords.</Text>
          </View>
        ) : (
          <View>
            {showArtists && artists.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.secTitle}>ARTISTS · {artists.length}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16 }}>
                  {artists.map(item => (
                    <CardArtist key={item.artistId} item={item} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {showAlbums && albums.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.secTitle}>ALBUMS · {albums.length}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16 }}>
                  {albums.map(item => (
                    <CardAlbum key={item.collectionId} item={item} />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {showTracks && tracks.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.secTitle}>SONGS · {tracks.length}</Text>
                {tracks.map(item => (
                  <TrackRow key={item.trackId} item={item} onOpenMenu={onOpenMenu} />
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0d',
  },
  searchHeader: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#0b0b0d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    marginLeft: 8,
    paddingVertical: 0,
  },
  filterRow: {
    marginTop: 8,
    flexDirection: 'row',
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
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextOn: {
    color: '#ffffff',
  },
  suggestOverlay: {
    position: 'absolute',
    top: 60,
    left: 12,
    right: 12,
    backgroundColor: '#18181c',
    borderRadius: 14,
    maxHeight: 300,
    zIndex: 100,
    elevation: 10,
    paddingVertical: 6,
  },
  sgItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sgTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginLeft: 10,
  },
  sgBadge: {
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sgBadgeText: {
    color: '#8e8e93',
    fontSize: 9,
    fontWeight: '800',
  },
  body: {
    flex: 1,
  },
  centerLoading: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  recentSection: {
    paddingTop: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  recentText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
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

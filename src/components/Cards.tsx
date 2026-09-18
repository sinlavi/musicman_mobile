import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useApp } from '../context/AppContext';
import { getArtwork } from '../services/api';
import { MusicItem } from '../types';

export const CardTrack: React.FC<{ item: MusicItem }> = ({ item }) => {
  const { navigate } = useApp();
  const art = getArtwork(item, 300);

  return (
    <TouchableOpacity
      style={styles.cardItem}
      onPress={() => navigate({ name: 'track', trackId: String(item.trackId) })}
      activeOpacity={0.8}
    >
      {art ? (
        <Image source={{ uri: art }} style={styles.cardArt} />
      ) : (
        <View style={[styles.cardArt, styles.cardArtPh]}>
          <MaterialIcons name="music-note" size={40} color="#8e8e93" />
        </View>
      )}
      <Text style={styles.cardName} numberOfLines={1}>
        {item.trackName || 'Track'}
      </Text>
      <Text style={styles.cardSub} numberOfLines={1}>
        {item.artistName || ''}
      </Text>
    </TouchableOpacity>
  );
};

export const CardAlbum: React.FC<{ item: MusicItem }> = ({ item }) => {
  const { navigate } = useApp();
  const art = getArtwork(item, 300);

  return (
    <TouchableOpacity
      style={styles.cardItem}
      onPress={() => navigate({ name: 'album', albumId: String(item.collectionId) })}
      activeOpacity={0.8}
    >
      {art ? (
        <Image source={{ uri: art }} style={styles.cardArt} />
      ) : (
        <View style={[styles.cardArt, styles.cardArtPh]}>
          <MaterialIcons name="album" size={40} color="#8e8e93" />
        </View>
      )}
      <Text style={styles.cardName} numberOfLines={1}>
        {item.collectionName || 'Album'}
      </Text>
      <Text style={styles.cardSub} numberOfLines={1}>
        {item.artistName || ''}
      </Text>
    </TouchableOpacity>
  );
};

export const CardArtist: React.FC<{ item: MusicItem }> = ({ item }) => {
  const { navigate } = useApp();
  const art = getArtwork(item, 300);

  return (
    <TouchableOpacity
      style={styles.artistItem}
      onPress={() => navigate({ name: 'artist', artistId: String(item.artistId) })}
      activeOpacity={0.8}
    >
      {art ? (
        <Image source={{ uri: art }} style={styles.artistArt} />
      ) : (
        <View style={[styles.artistArt, styles.artistArtPh]}>
          <MaterialIcons name="person" size={40} color="#7b2ff7" />
        </View>
      )}
      <Text style={[styles.cardName, { textAlign: 'center' }]} numberOfLines={1}>
        {item.artistName || 'Artist'}
      </Text>
    </TouchableOpacity>
  );
};

export const CardTrackPopular: React.FC<{ item: MusicItem }> = ({ item }) => {
  const { navigate } = useApp();
  const art = getArtwork(item, 300);
  const views = Number(item.views) || 0;
  const viewsLabel =
    views >= 1000 ? (views / 1000).toFixed(views >= 10000 ? 0 : 1) + 'K' : String(views);

  return (
    <TouchableOpacity
      style={styles.cardItem}
      onPress={() => navigate({ name: 'track', trackId: String(item.trackId) })}
      activeOpacity={0.8}
    >
      {art ? (
        <Image source={{ uri: art }} style={styles.cardArt} />
      ) : (
        <View style={[styles.cardArt, styles.cardArtPh]}>
          <MaterialIcons name="music-note" size={40} color="#8e8e93" />
        </View>
      )}
      <Text style={styles.cardName} numberOfLines={1}>
        {item.trackName || 'Track'}
      </Text>
      <Text style={styles.cardSub} numberOfLines={1}>
        {[item.artistName, viewsLabel ? `${viewsLabel} plays` : ''].filter(Boolean).join(' · ')}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardItem: {
    width: 138,
    marginRight: 12,
  },
  cardArt: {
    width: 138,
    height: 138,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  cardArtPh: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  cardSub: {
    color: '#8e8e93',
    fontSize: 11,
    marginTop: 2,
  },
  artistItem: {
    width: 104,
    marginRight: 12,
    alignItems: 'center',
  },
  artistArt: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(123, 47, 247, 0.15)',
  },
  artistArtPh: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

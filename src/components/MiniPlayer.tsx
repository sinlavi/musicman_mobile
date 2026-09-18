import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { usePlayer } from '../context/PlayerContext';
import { getArtwork } from '../services/api';

export const MiniPlayer: React.FC = () => {
  const { track, playing, togglePlay, nextTrack, openFullPlayer, currentTime, duration } = usePlayer();

  if (!track) return null;

  const art = getArtwork(track, 100);
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <View style={styles.container}>
      {/* Progress Line */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.infoTouch}
          onPress={() => openFullPlayer('now')}
          activeOpacity={0.8}
        >
          {art ? (
            <Image source={{ uri: art }} style={styles.art} />
          ) : (
            <View style={[styles.art, styles.artPh]}>
              <MaterialIcons name="music-note" size={20} color="#8e8e93" />
            </View>
          )}

          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {track.trackName || 'Track'}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {track.artistName || ''}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={togglePlay} activeOpacity={0.7}>
          <MaterialIcons name={playing ? 'pause' : 'play-arrow'} size={26} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconBtn} onPress={() => nextTrack()} activeOpacity={0.7}>
          <MaterialIcons name="skip-next" size={26} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141418',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  progressBg: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7b2ff7',
  },
  row: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  infoTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  art: {
    width: 40,
    height: 40,
    borderRadius: 8,
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
  title: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  artist: {
    color: '#8e8e93',
    fontSize: 11,
    marginTop: 2,
  },
  iconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

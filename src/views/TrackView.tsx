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
import { Skeleton } from '../components/Skeleton';
import { useApp } from '../context/AppContext';
import { usePlayer } from '../context/PlayerContext';
import { apiCrawlStatus, apiLookup, getArtwork, hasAudio, hasPreview, itemType } from '../services/api';
import { cacheDel, cacheGet, DL } from '../services/downloadManager';
import { DownloadItem, MusicItem } from '../types';

interface TrackViewProps {
  trackId: string;
  onOpenMenu: (trackId: string) => void;
}

export const TrackView: React.FC<TrackViewProps> = ({ trackId, onOpenMenu }) => {
  const { navigate, isLiked, toggleLikeById, cachedIds, showToast, refreshCachedIds } = useApp();
  const { playById } = usePlayer();

  const [loading, setLoading] = useState<boolean>(true);
  const [trackObj, setTrackObj] = useState<MusicItem | null>(null);
  const [dlItem, setDlItem] = useState<DownloadItem | null>(null);
  const [serverStatus, setServerStatus] = useState<any>(null);

  useEffect(() => {
    fetchTrack();
    const updateDl = () => {
      setDlItem(DL.get(trackId) || null);
    };
    updateDl();
    const unsub = DL.onChange(updateDl);
    return () => unsub();
  }, [trackId]);

  const fetchTrack = async () => {
    setLoading(true);
    try {
      const r = await apiLookup(trackId, 'song');
      const item = r.find(x => itemType(x) === 'track') || r[0];
      setTrackObj(item || null);

      if (item && !hasAudio(item) && !cachedIds.has(trackId)) {
        const status = await apiCrawlStatus(trackId);
        setServerStatus(status);
      }
    } catch (e) {
      console.warn('Track fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const startCrawlTrack = async () => {
    if (!trackObj) return;
    try {
      await DL.add(trackObj);
      showToast('Download started');
    } catch {
      showToast('Download failed', 'danger');
    }
  };

  if (loading) return <Skeleton />;
  if (!trackObj) {
    return (
      <View style={styles.centerState}>
        <MaterialIcons name="music-note" size={48} color="#8e8e93" />
        <Text style={styles.stateText}>Track not found</Text>
      </View>
    );
  }

  const art = getArtwork(trackObj, 600);
  const liked = isLiked(trackId);
  const isOffline = cachedIds.has(trackId);
  const crawled = hasAudio(trackObj);
  const previewable = !crawled && hasPreview(trackObj) && !isOffline;

  const year = trackObj.releaseDate ? new Date(trackObj.releaseDate).getFullYear() : '';
  const fmtTime = (millis?: number) => {
    if (!millis) return '';
    const sec = Math.floor(millis / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  const dur = trackObj.trackTimeMillis ? fmtTime(trackObj.trackTimeMillis) : '';

  const lyricsText =
    trackObj.lyrics?.text ||
    trackObj.lyrics?.plain ||
    (typeof trackObj.lyrics === 'string' ? trackObj.lyrics : null) ||
    'No lyrics available for this track.';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.hero}>
        {art ? (
          <Image source={{ uri: art }} style={styles.heroArt} />
        ) : (
          <View style={[styles.heroArt, styles.heroArtPh]}>
            <MaterialIcons name="music-note" size={64} color="#8e8e93" />
          </View>
        )}
        <Text style={styles.heroTitle}>{trackObj.trackName || 'Track'}</Text>
        <TouchableOpacity
          onPress={() => trackObj.artistId && navigate({ name: 'artist', artistId: String(trackObj.artistId) })}
        >
          <Text style={styles.heroSubLink}>{trackObj.artistName || ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => trackObj.collectionId && navigate({ name: 'album', albumId: String(trackObj.collectionId) })}
        >
          <Text style={styles.heroAlbumLink}>{trackObj.collectionName || ''}</Text>
        </TouchableOpacity>
        <Text style={styles.heroSubMeta}>
          {[year, dur, trackObj.primaryGenreName].filter(Boolean).join(' · ')}
        </Text>

        {/* Primary Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.btnSuccess} onPress={() => playById(trackId)}>
            <MaterialIcons name="play-arrow" size={20} color="#ffffff" />
            <Text style={styles.btnText}>{isOffline ? 'Play offline' : 'Play'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnIcon} onPress={() => toggleLikeById(trackId)}>
            <MaterialIcons
              name={liked ? 'favorite' : 'favorite-border'}
              size={22}
              color={liked ? '#dc3545' : '#ffffff'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnIcon} onPress={() => onOpenMenu(trackId)}>
            <MaterialIcons name="more-horiz" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Download / Crawl Card */}
      <View style={styles.cardSection}>
        {isOffline ? (
          <View style={[styles.crawlCard, styles.cardReady]}>
            <MaterialIcons name="cloud-done" size={28} color="#198754" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.ccTitle}>Saved offline</Text>
              <Text style={styles.ccSub}>Ready to play without internet</Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                await cacheDel(trackId);
                await refreshCachedIds();
                showToast('Removed from offline');
              }}
            >
              <MaterialIcons name="delete" size={22} color="#dc3545" />
            </TouchableOpacity>
          </View>
        ) : dlItem && ['queued', 'crawling', 'saving'].includes(dlItem.status) ? (
          <View style={[styles.crawlCard, styles.cardPending]}>
            <ActivityIndicator size="small" color="#0dcaf0" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ccTitle}>
                {dlItem.status === 'saving' ? 'Downloading…' : 'Crawling…'}
              </Text>
              <Text style={styles.ccSub}>{dlItem.percent}% complete</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.crawlCard, styles.cardIdle]}>
            <MaterialIcons name="cloud-download" size={28} color="#7b2ff7" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.ccTitle}>
                {crawled ? 'Available for download' : 'Not crawled'}
              </Text>
              <Text style={styles.ccSub}>
                {crawled ? 'Download full track for offline' : 'Crawl to listen offline'}
              </Text>
            </View>
            <TouchableOpacity style={styles.btnPrimarySm} onPress={startCrawlTrack}>
              <Text style={styles.btnTextSm}>Download</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Lyrics Card */}
      <View style={styles.lyricsCard}>
        <View style={styles.lyricsHeader}>
          <MaterialIcons name="queue-music" size={20} color="#7b2ff7" />
          <Text style={styles.lyricsTitle}>Lyrics</Text>
        </View>
        <Text style={styles.lyricsBody}>{lyricsText}</Text>
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
    width: 220,
    height: 220,
    borderRadius: 20,
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
  heroAlbumLink: {
    color: '#8e8e93',
    fontSize: 13,
    marginTop: 2,
  },
  heroSubMeta: {
    color: '#8e8e93',
    fontSize: 11,
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
    paddingHorizontal: 20,
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
  cardSection: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  crawlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
  },
  cardReady: {
    backgroundColor: 'rgba(25, 135, 84, 0.12)',
  },
  cardPending: {
    backgroundColor: 'rgba(13, 202, 240, 0.12)',
  },
  cardIdle: {
    backgroundColor: 'rgba(123, 47, 247, 0.12)',
  },
  ccTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  ccSub: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
  btnPrimarySm: {
    backgroundColor: '#7b2ff7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  btnTextSm: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  lyricsCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: 16,
    padding: 16,
  },
  lyricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  lyricsTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  lyricsBody: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 22,
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

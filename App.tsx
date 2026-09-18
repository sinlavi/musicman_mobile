import React, { useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { AppBar } from './src/components/AppBar';
import { BottomSheetModal } from './src/components/BottomSheetModal';
import { FullPlayerModal } from './src/components/FullPlayerModal';
import { MiniPlayer } from './src/components/MiniPlayer';
import { SettingsModal } from './src/components/SettingsModal';
import { TabBar } from './src/components/TabBar';
import { Toast } from './src/components/Toast';
import { AppProvider, useApp } from './src/context/AppContext';
import { PlayerProvider, usePlayer } from './src/context/PlayerContext';
import { DL } from './src/services/downloadManager';
import { MusicItem } from './src/types';
import { AlbumView } from './src/views/AlbumView';
import { ArtistView } from './src/views/ArtistView';
import { HomeView } from './src/views/HomeView';
import { LibraryView } from './src/views/LibraryView';
import { SearchView } from './src/views/SearchView';
import { TrackView } from './src/views/TrackView';

const MainContent: React.FC = () => {
  const {
    route,
    navigate,
    isLiked,
    toggleLikeById,
    toggleLikeAll,
    playlists,
    createPlaylist,
    addToPlaylist,
    removeFromPlaylist,
    deletePlaylist,
    renamePlaylist,
    showToast,
  } = useApp();

  const { playById, playItem, addAllToQueue, openFullPlayer, setSleepTimer } = usePlayer();

  const [settingsVisible, setSettingsVisible] = useState<boolean>(false);
  const [trackMenuVisible, setTrackMenuVisible] = useState<boolean>(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  const [playlistPickerVisible, setPlaylistPickerVisible] = useState<boolean>(false);
  const [newPlPromptVisible, setNewPlPromptVisible] = useState<boolean>(false);
  const [newPlName, setNewPlName] = useState<string>('');

  const [sleepTimerVisible, setSleepTimerVisible] = useState<boolean>(false);

  const [bulkItems, setBulkItems] = useState<MusicItem[]>([]);
  const [bulkMenuVisible, setBulkMenuVisible] = useState<boolean>(false);

  const openTrackMenu = (trackId: string, plId?: string) => {
    setSelectedTrackId(trackId);
    setSelectedPlaylistId(plId || null);
    setTrackMenuVisible(true);
  };

  const openPlaylistPicker = (trackId: string) => {
    setSelectedTrackId(trackId);
    setPlaylistPickerVisible(true);
  };

  const handlePickPlaylist = async (plId: string) => {
    setPlaylistPickerVisible(false);
    if (!selectedTrackId) return;
    await addToPlaylist(plId, { trackId: selectedTrackId });
  };

  const handleCreateNewPlaylist = async () => {
    if (!newPlName.trim()) return;
    const pl = await createPlaylist(newPlName);
    setNewPlName('');
    setNewPlPromptVisible(false);
    if (pl && selectedTrackId) {
      await handlePickPlaylist(pl.id);
    }
  };

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="light-content" />
      <AppBar onOpenSettings={() => setSettingsVisible(true)} />

      <View style={styles.mainView}>
        {route.name === 'home' ? <HomeView /> : null}
        {route.name === 'search' ? <SearchView onOpenMenu={openTrackMenu} /> : null}
        {route.name === 'library' ? (
          <LibraryView
            onOpenMenu={openTrackMenu}
            onNewPlaylist={() => setNewPlPromptVisible(true)}
            onOpenPlaylist={plId => navigate({ name: 'library', subtab: 'playlists', playlistId: plId })}
          />
        ) : null}
        {route.name === 'artist' ? (
          <ArtistView
            artistId={route.artistId}
            onOpenMenu={openTrackMenu}
            onOpenArtistMenu={items => {
              setBulkItems(items);
              setBulkMenuVisible(true);
            }}
          />
        ) : null}
        {route.name === 'album' ? (
          <AlbumView
            albumId={route.albumId}
            onOpenMenu={openTrackMenu}
            onOpenAlbumMenu={items => {
              setBulkItems(items);
              setBulkMenuVisible(true);
            }}
          />
        ) : null}
        {route.name === 'track' ? (
          <TrackView trackId={route.trackId} onOpenMenu={openTrackMenu} />
        ) : null}
      </View>

      <MiniPlayer />
      <TabBar />

      <FullPlayerModal
        onOpenTrackMenu={openTrackMenu}
        onOpenPlaylistPicker={openPlaylistPicker}
        onOpenSleepTimer={() => setSleepTimerVisible(true)}
      />

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />

      {/* Track Action Menu */}
      <BottomSheetModal
        visible={trackMenuVisible}
        onClose={() => setTrackMenuVisible(false)}
        title="Track Options"
      >
        <TouchableOpacity
          style={styles.sheetItem}
          onPress={() => {
            setTrackMenuVisible(false);
            if (selectedTrackId) playById(selectedTrackId);
          }}
        >
          <MaterialIcons name="play-arrow" size={22} color="#7b2ff7" />
          <Text style={styles.sheetText}>Play track</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sheetItem}
          onPress={() => {
            setTrackMenuVisible(false);
            if (selectedTrackId) toggleLikeById(selectedTrackId);
          }}
        >
          <MaterialIcons name="favorite" size={22} color="#dc3545" />
          <Text style={styles.sheetText}>
            {selectedTrackId && isLiked(selectedTrackId) ? 'Remove from Liked' : 'Add to Liked'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sheetItem}
          onPress={() => {
            setTrackMenuVisible(false);
            if (selectedTrackId) openPlaylistPicker(selectedTrackId);
          }}
        >
          <MaterialIcons name="playlist-add" size={22} color="#ffffff" />
          <Text style={styles.sheetText}>Add to playlist</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sheetItem}
          onPress={async () => {
            setTrackMenuVisible(false);
            if (selectedTrackId) {
              await DL.add({ trackId: selectedTrackId } as any);
              showToast('Download started');
            }
          }}
        >
          <MaterialIcons name="cloud-download" size={22} color="#0dcaf0" />
          <Text style={styles.sheetText}>Download offline</Text>
        </TouchableOpacity>

        {selectedPlaylistId && selectedTrackId ? (
          <TouchableOpacity
            style={styles.sheetItem}
            onPress={() => {
              setTrackMenuVisible(false);
              removeFromPlaylist(selectedPlaylistId, selectedTrackId);
              showToast('Removed from playlist');
            }}
          >
            <MaterialIcons name="close" size={22} color="#dc3545" />
            <Text style={[styles.sheetText, { color: '#dc3545' }]}>Remove from playlist</Text>
          </TouchableOpacity>
        ) : null}
      </BottomSheetModal>

      {/* Playlist Picker Sheet */}
      <BottomSheetModal
        visible={playlistPickerVisible}
        onClose={() => setPlaylistPickerVisible(false)}
        title="Add to Playlist"
      >
        <TouchableOpacity
          style={[styles.sheetItem, { backgroundColor: '#7b2ff7', borderRadius: 10, marginVertical: 6 }]}
          onPress={() => {
            setPlaylistPickerVisible(false);
            setNewPlPromptVisible(true);
          }}
        >
          <MaterialIcons name="add" size={22} color="#ffffff" />
          <Text style={[styles.sheetText, { fontWeight: '800' }]}>New playlist</Text>
        </TouchableOpacity>

        {playlists.map(p => (
          <TouchableOpacity
            key={p.id}
            style={styles.sheetItem}
            onPress={() => handlePickPlaylist(p.id)}
          >
            <MaterialIcons name="playlist-play" size={22} color="#8e8e93" />
            <Text style={styles.sheetText}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </BottomSheetModal>

      {/* New Playlist Prompt Modal */}
      <BottomSheetModal
        visible={newPlPromptVisible}
        onClose={() => setNewPlPromptVisible(false)}
        title="New Playlist"
      >
        <TextInput
          style={styles.input}
          placeholder="Playlist name"
          placeholderTextColor="#8e8e93"
          value={newPlName}
          onChangeText={setNewPlName}
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
            onPress={() => setNewPlPromptVisible(false)}
          >
            <Text style={styles.modalBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#7b2ff7' }]} onPress={handleCreateNewPlaylist}>
            <Text style={styles.modalBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      {/* Sleep Timer Sheet */}
      <BottomSheetModal
        visible={sleepTimerVisible}
        onClose={() => setSleepTimerVisible(false)}
        title="Sleep Timer"
      >
        <TouchableOpacity style={styles.sheetItem} onPress={() => { setSleepTimer(15); setSleepTimerVisible(false); }}>
          <MaterialIcons name="access-time" size={22} color="#ffffff" />
          <Text style={styles.sheetText}>15 minutes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetItem} onPress={() => { setSleepTimer(30); setSleepTimerVisible(false); }}>
          <MaterialIcons name="access-time" size={22} color="#ffffff" />
          <Text style={styles.sheetText}>30 minutes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetItem} onPress={() => { setSleepTimer(60); setSleepTimerVisible(false); }}>
          <MaterialIcons name="access-time" size={22} color="#ffffff" />
          <Text style={styles.sheetText}>60 minutes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetItem} onPress={() => { setSleepTimer(0); setSleepTimerVisible(false); }}>
          <MaterialIcons name="cancel" size={22} color="#dc3545" />
          <Text style={[styles.sheetText, { color: '#dc3545' }]}>Cancel timer</Text>
        </TouchableOpacity>
      </BottomSheetModal>

      {/* Bulk Action Menu Sheet */}
      <BottomSheetModal
        visible={bulkMenuVisible}
        onClose={() => setBulkMenuVisible(false)}
        title="Collection Actions"
      >
        <TouchableOpacity
          style={styles.sheetItem}
          onPress={() => {
            setBulkMenuVisible(false);
            addAllToQueue(bulkItems);
          }}
        >
          <MaterialIcons name="queue-music" size={22} color="#ffffff" />
          <Text style={styles.sheetText}>Queue all tracks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sheetItem}
          onPress={() => {
            setBulkMenuVisible(false);
            toggleLikeAll(bulkItems);
          }}
        >
          <MaterialIcons name="favorite" size={22} color="#dc3545" />
          <Text style={styles.sheetText}>Like / unlike all</Text>
        </TouchableOpacity>
      </BottomSheetModal>

      <Toast />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <AppProvider>
      <PlayerProvider>
        <MainContent />
      </PlayerProvider>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#0b0b0d',
  },
  mainView: {
    flex: 1,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sheetText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 14,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/music_item.dart';
import '../providers/player_provider.dart';
import '../services/download_service.dart';
import '../services/storage_service.dart';
import '../widgets/track_row.dart';

class LibraryView extends StatefulWidget {
  final Function(String, String) onNavigate;

  const LibraryView({super.key, required this.onNavigate});

  @override
  State<LibraryView> createState() => _LibraryViewState();
}

class _LibraryViewState extends State<LibraryView>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final storage = context.watch<StorageService>();
    final download = context.watch<DownloadService>();
    final player = context.watch<PlayerProvider>();

    return Column(
      children: [
        // Tab Header
        Container(
          color: Theme.of(context).colorScheme.surface,
          child: TabBar(
            controller: _tabController,
            isScrollable: true,
            labelStyle: const TextStyle(fontWeight: FontWeight.bold),
            tabs: [
              Tab(text: 'Liked (${storage.likes.length})'),
              Tab(text: 'Following (${storage.followed.length})'),
              Tab(text: 'Playlists (${storage.playlists.length})'),
              Tab(text: 'Downloads (${download.downloads.length})'),
            ],
          ),
        ),

        // Tab Views
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildLikedTab(storage, player, download),
              _buildFollowingTab(storage),
              _buildPlaylistsTab(storage),
              _buildDownloadsTab(download, player),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLikedTab(
      StorageService storage, PlayerProvider player, DownloadService download) {
    final likes = storage.likes;
    if (likes.isEmpty) {
      return const Center(child: Text('No liked tracks yet'));
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: likes.length,
      itemBuilder: (context, index) {
        final track = likes[index];
        final isCurrent = player.currentTrack?.id == track.id;
        final isCached = download.getItem(track.id)?.status == 'completed';

        return TrackRow(
          itemMap: track.toJson(),
          isPlaying: isCurrent && player.isPlaying,
          isLiked: true,
          isCached: isCached,
          onPlay: () => player.playItem(track, sourceQueue: likes),
          onLike: () => storage.toggleLike(track),
          onMore: () {},
          onTap: () => widget.onNavigate('track', track.id),
        );
      },
    );
  }

  Widget _buildFollowingTab(StorageService storage) {
    final followed = storage.followed;
    if (followed.isEmpty) {
      return const Center(child: Text('Not following any artists'));
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: followed.length,
      itemBuilder: (context, index) {
        final artist = followed[index];
        final id = artist['artistId']?.toString() ?? '';
        final name = artist['artistName']?.toString() ?? 'Artist';
        final artwork = artist['artwork']?.toString() ?? '';

        return ListTile(
          leading: CircleAvatar(
            backgroundImage: artwork.isNotEmpty ? NetworkImage(artwork) : null,
            child: artwork.isEmpty ? const Icon(Icons.person) : null,
          ),
          title: Text(name),
          subtitle: const Text('Artist'),
          trailing: IconButton(
            icon: const Icon(Icons.check, color: Colors.blue),
            onPressed: () => storage.toggleFollow(id, name, artwork, ''),
          ),
          onTap: () => widget.onNavigate('artist', id),
        );
      },
    );
  }

  Widget _buildPlaylistsTab(StorageService storage) {
    final playlists = storage.playlists;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: ElevatedButton.icon(
            onPressed: () => _showNewPlaylistDialog(context, storage),
            icon: const Icon(Icons.add),
            label: const Text('Create New Playlist'),
          ),
        ),
        Expanded(
          child: playlists.isEmpty
              ? const Center(child: Text('No playlists yet'))
              : ListView.builder(
                  itemCount: playlists.length,
                  itemBuilder: (context, index) {
                    final pl = playlists[index];
                    return ListTile(
                      leading: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: Colors.white10,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.playlist_play),
                      ),
                      title: Text(pl.name),
                      subtitle: Text('${pl.tracks.length} tracks'),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () => storage.deletePlaylist(pl.id),
                      ),
                      onTap: () => _showPlaylistTracksSheet(context, pl, storage),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildDownloadsTab(DownloadService download, PlayerProvider player) {
    final downloads = download.downloads;
    if (downloads.isEmpty) {
      return const Center(child: Text('No downloaded tracks'));
    }

    return ListView.builder(
      itemCount: downloads.length,
      itemBuilder: (context, index) {
        final item = downloads[index];

        return ListTile(
          leading: Icon(
            item.status == 'completed'
                ? Icons.offline_pin
                : item.status == 'saving'
                    ? Icons.downloading
                    : Icons.cloud_queue,
            color: item.status == 'completed' ? Colors.green : Colors.blue,
          ),
          title: Text(item.name),
          subtitle: Text('${item.artist} · ${item.status} (${item.percent}%)'),
          trailing: IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: () => download.removeDownload(item.trackId),
          ),
          onTap: () {
            if (item.status == 'completed') {
              final musicItem = MusicItem(
                wrapperType: 'track',
                trackId: item.trackId,
                trackName: item.name,
                artistName: item.artist,
                collectionName: item.album,
              );
              player.playItem(musicItem);
            }
          },
        );
      },
    );
  }

  void _showNewPlaylistDialog(BuildContext context, StorageService storage) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Playlist'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'Playlist Name'),
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                storage.createPlaylist(controller.text.trim());
                Navigator.pop(ctx);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showPlaylistTracksSheet(
      BuildContext context, dynamic playlist, StorageService storage) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        builder: (_, scrollController) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                playlist.name,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            Expanded(
              child: ListView.builder(
                controller: scrollController,
                itemCount: playlist.tracks.length,
                itemBuilder: (context, idx) {
                  final tMap = playlist.tracks[idx] as Map<String, dynamic>;
                  return ListTile(
                    title: Text(tMap['trackName']?.toString() ?? 'Track'),
                    subtitle: Text(tMap['artistName']?.toString() ?? ''),
                    trailing: IconButton(
                      icon: const Icon(Icons.remove_circle_outline),
                      onPressed: () {
                        storage.removeFromPlaylist(
                            playlist.id, tMap['trackId']?.toString() ?? '');
                        Navigator.pop(ctx);
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

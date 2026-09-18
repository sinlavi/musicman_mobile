import 'package:flutter/material.dart';
import '../models/music_item.dart';
import '../services/audio_player_service.dart';
import '../services/download_manager.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

class LibraryView extends StatefulWidget {
  final Function(MusicItem) onNavigateToItem;

  const LibraryView({super.key, required this.onNavigateToItem});

  @override
  State<LibraryView> createState() => _LibraryViewState();
}

class _LibraryViewState extends State<LibraryView> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final DownloadManager _downloadManager = DownloadManager();

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
    return Column(
      children: [
        TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.primaryGradientStart,
          labelColor: AppTheme.primaryGradientStart,
          unselectedLabelColor: AppTheme.textSecondary,
          tabs: const [
            Tab(text: 'Liked'),
            Tab(text: 'Following'),
            Tab(text: 'Playlists'),
            Tab(text: 'Offline'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildLikedTab(),
              _buildFollowingTab(),
              _buildPlaylistsTab(),
              _buildOfflineTab(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLikedTab() {
    final likes = StorageService.getLikes();

    if (likes.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.favorite_border, size: 64, color: Colors.white24),
            SizedBox(height: 12),
            Text('No liked songs yet', style: TextStyle(color: AppTheme.textSecondary)),
          ],
        ),
      );
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${likes.length} liked songs', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryGradientStart,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                onPressed: () {
                  AudioPlayerService().playItem(likes.first, newQueue: likes, initialIndex: 0);
                },
                icon: const Icon(Icons.play_arrow),
                label: const Text('Play All'),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: likes.length,
            itemBuilder: (context, index) {
              final track = likes[index];
              return TrackTile(
                item: track,
                onTap: () => AudioPlayerService().playItem(track, newQueue: likes, initialIndex: index),
                onMoreTap: () => widget.onNavigateToItem(track),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFollowingTab() {
    final followed = StorageService.getFollowed();

    if (followed.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.person_outline, size: 64, color: Colors.white24),
            SizedBox(height: 12),
            Text('Not following any artists', style: TextStyle(color: AppTheme.textSecondary)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: followed.length,
      itemBuilder: (context, index) {
        final artist = followed[index];
        final musicItem = MusicItem(
          wrapperType: 'artist',
          artistId: artist.artistId,
          artistName: artist.artistName,
          primaryGenreName: artist.primaryGenreName,
          artworkUrl100: artist.artwork,
        );

        return ListTile(
          leading: ArtworkImage(
            url: artist.artwork,
            size: 46,
            borderRadius: 23,
            placeholderIcon: Icons.person,
          ),
          title: Text(artist.artistName, maxLines: 1, overflow: TextOverflow.ellipsis),
          subtitle: Text(artist.primaryGenreName, maxLines: 1, overflow: TextOverflow.ellipsis),
          trailing: IconButton(
            icon: const Icon(Icons.check_circle, color: AppTheme.primaryGradientStart),
            onPressed: () async {
              await StorageService.toggleFollow(artist);
              setState(() {});
            },
          ),
          onTap: () => widget.onNavigateToItem(musicItem),
        );
      },
    );
  }

  Widget _buildPlaylistsTab() {
    final playlists = StorageService.getPlaylists();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Playlists (${playlists.length})', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryGradientStart,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                onPressed: () => _showNewPlaylistDialog(context),
                icon: const Icon(Icons.add),
                label: const Text('New'),
              ),
            ],
          ),
        ),
        Expanded(
          child: playlists.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.queue_music, size: 64, color: Colors.white24),
                      SizedBox(height: 12),
                      Text('No playlists yet', style: TextStyle(color: AppTheme.textSecondary)),
                    ],
                  ),
                )
              : ListView.builder(
                  itemCount: playlists.length,
                  itemBuilder: (context, index) {
                    final pl = playlists[index];
                    return ListTile(
                      leading: const CircleAvatar(
                        backgroundColor: Colors.white10,
                        child: Icon(Icons.queue_music, color: AppTheme.primaryGradientStart),
                      ),
                      title: Text(pl.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text('${pl.tracks.length} tracks'),
                      trailing: PopupMenuButton<String>(
                        onSelected: (val) async {
                          if (val == 'delete') {
                            await StorageService.deletePlaylist(pl.id);
                            setState(() {});
                          }
                        },
                        itemBuilder: (context) => [
                          const PopupMenuItem(value: 'delete', child: Text('Delete Playlist')),
                        ],
                      ),
                      onTap: () {
                        _showPlaylistDetailModal(context, pl);
                      },
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildOfflineTab() {
    return StreamBuilder<List<DownloadItem>>(
      stream: _downloadManager.stream,
      initialData: _downloadManager.allItems,
      builder: (context, snapshot) {
        final items = snapshot.data ?? [];

        return FutureBuilder<List<dynamic>>(
          future: _downloadManager.getOfflineFiles(),
          builder: (context, filesSnap) {
            final files = filesSnap.data ?? [];

            if (items.isEmpty && files.isEmpty) {
              return const Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.cloud_off, size: 64, color: Colors.white24),
                    SizedBox(height: 12),
                    Text('No offline downloads yet', style: TextStyle(color: AppTheme.textSecondary)),
                  ],
                ),
              );
            }

            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${files.length} tracks saved offline', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
                      TextButton.icon(
                        onPressed: () async {
                          await _downloadManager.clearOfflineCache();
                          setState(() {});
                        },
                        icon: const Icon(Icons.delete_sweep, color: Colors.red),
                        label: const Text('Clear All', style: TextStyle(color: Colors.red)),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return ListTile(
                        leading: ArtworkImage(url: item.artwork, size: 46),
                        title: Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.artist, maxLines: 1, overflow: TextOverflow.ellipsis),
                            if (item.status == DownloadStatus.crawling || item.status == DownloadStatus.saving)
                              LinearProgressIndicator(value: item.percent / 100.0),
                          ],
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.red),
                          onPressed: () async {
                            await _downloadManager.removeDownload(item.trackId);
                            setState(() {});
                          },
                        ),
                        onTap: () {
                          if (item.musicItem != null) {
                            AudioPlayerService().playItem(item.musicItem!);
                          }
                        },
                      );
                    },
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showNewPlaylistDialog(BuildContext context) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('New Playlist'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'Playlist Name'),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              if (controller.text.trim().isNotEmpty) {
                await StorageService.createPlaylist(controller.text.trim());
                if (context.mounted) {
                  Navigator.pop(context);
                  setState(() {});
                }
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  void _showPlaylistDetailModal(BuildContext context, CustomPlaylist playlist) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          expand: false,
          builder: (context, scrollController) {
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(playlist.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      if (playlist.tracks.isNotEmpty)
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primaryGradientStart,
                            foregroundColor: Colors.white,
                          ),
                          onPressed: () {
                            AudioPlayerService().playItem(playlist.tracks.first, newQueue: playlist.tracks, initialIndex: 0);
                          },
                          icon: const Icon(Icons.play_arrow),
                          label: const Text('Play All'),
                        ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: playlist.tracks.isEmpty
                      ? const Center(child: Text('Playlist is empty', style: TextStyle(color: AppTheme.textSecondary)))
                      : ListView.builder(
                          controller: scrollController,
                          itemCount: playlist.tracks.length,
                          itemBuilder: (context, index) {
                            final track = playlist.tracks[index];
                            return TrackTile(
                              item: track,
                              onTap: () => AudioPlayerService().playItem(track, newQueue: playlist.tracks, initialIndex: index),
                              onMoreTap: () => widget.onNavigateToItem(track),
                            );
                          },
                        ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

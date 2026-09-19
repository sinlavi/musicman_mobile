import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/music_item.dart';
import '../providers/player_provider.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/download_service.dart';
import '../widgets/track_row.dart';

class DetailView extends StatefulWidget {
  final String type; // artist, album, track
  final String id;
  final Function(String, String) onNavigate;

  const DetailView({
    super.key,
    required this.type,
    required this.id,
    required this.onNavigate,
  });

  @override
  State<DetailView> createState() => _DetailViewState();
}

class _DetailViewState extends State<DetailView> {
  bool _isLoading = true;
  String? _error;

  MusicItem? _mainItem;
  List<MusicItem> _tracks = [];
  List<MusicItem> _albums = [];

  @override
  void initState() {
    super.initState();
    _loadDetails();
  }

  Future<void> _loadDetails() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      if (widget.type == 'artist') {
        final res = await ApiService.lookup(widget.id, 'musicArtist');
        _mainItem = res.firstWhere((x) => x.itemType == 'artist', orElse: () => res.first);

        final albumRes = await ApiService.lookup(widget.id, 'album');
        _albums = albumRes.where((x) => x.itemType == 'collection').toList();

        final trackData = await ApiService.fetchArtistTracks(widget.id);
        _tracks = (trackData['results'] as List).cast<MusicItem>();
      } else if (widget.type == 'album') {
        final res = await ApiService.lookup(widget.id, 'album');
        _mainItem = res.firstWhere((x) => x.itemType == 'collection', orElse: () => res.first);

        final songRes = await ApiService.lookup(widget.id, 'song');
        _tracks = songRes.where((x) => x.itemType == 'track').toList();
      } else if (widget.type == 'track') {
        final res = await ApiService.lookup(widget.id, 'song');
        _mainItem = res.firstWhere((x) => x.itemType == 'track', orElse: () => res.first);
        _tracks = [_mainItem!];
      }

      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final storage = context.watch<StorageService>();
    final player = context.watch<PlayerProvider>();
    final download = context.watch<DownloadService>();

    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null || _mainItem == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text('Failed to load: ${_error ?? 'Not found'}'),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _loadDetails,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    final title = _mainItem!.trackName ?? _mainItem!.collectionName ?? _mainItem!.artistName ?? '';
    final sub = _mainItem!.artistName ?? '';
    final artwork = _mainItem!.getArtwork(600);

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header Card
          Center(
            child: Column(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(widget.type == 'artist' ? 100 : 16),
                  child: artwork.isNotEmpty
                      ? Image.network(
                          artwork,
                          width: 180,
                          height: 180,
                          fit: BoxFit.cover,
                          errorBuilder: (ctx, err, stack) => _artPlaceholder(),
                        )
                      : _artPlaceholder(),
                ),
                const SizedBox(height: 16),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                if (sub.isNotEmpty && widget.type != 'artist') ...[
                  const SizedBox(height: 4),
                  Text(
                    sub,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white54, fontSize: 14),
                  ),
                ],
                const SizedBox(height: 16),

                // Bulk Action Buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (_tracks.isNotEmpty) ...[
                      ElevatedButton.icon(
                        onPressed: () => player.playList(_tracks),
                        icon: const Icon(Icons.play_arrow),
                        label: const Text('Play All'),
                      ),
                      const SizedBox(width: 12),
                      OutlinedButton.icon(
                        onPressed: () => player.addToQueue(_tracks),
                        icon: const Icon(Icons.queue_music),
                        label: const Text('Queue All'),
                      ),
                    ],
                    if (widget.type == 'artist') ...[
                      const SizedBox(width: 12),
                      IconButton(
                        icon: Icon(
                          storage.isFollowed(_mainItem!.id) ? Icons.check_circle : Icons.person_add,
                          color: storage.isFollowed(_mainItem!.id) ? Colors.blue : null,
                        ),
                        onPressed: () => storage.toggleFollow(
                          _mainItem!.id,
                          _mainItem!.artistName ?? '',
                          artwork,
                          _mainItem!.primaryGenreName ?? '',
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Artist Albums
          if (widget.type == 'artist' && _albums.isNotEmpty) ...[
            const Text(
              'ALBUMS',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white54),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 160,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: _albums.length,
                itemBuilder: (context, idx) {
                  final album = _albums[idx];
                  return GestureDetector(
                    onTap: () => widget.onNavigate('album', album.id),
                    child: Container(
                      width: 110,
                      margin: const EdgeInsets.only(right: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              album.getArtwork(300),
                              width: 110,
                              height: 110,
                              fit: BoxFit.cover,
                              errorBuilder: (ctx, err, stack) => Container(
                                width: 110,
                                height: 110,
                                color: Colors.white10,
                                child: const Icon(Icons.album),
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            album.collectionName ?? 'Album',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 24),
          ],

          // Track List
          if (_tracks.isNotEmpty) ...[
            const Text(
              'TRACKS',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white54),
            ),
            const SizedBox(height: 8),
            ..._tracks.map((track) {
              final isCurrent = player.currentTrack?.id == track.id;
              final isLiked = storage.isLiked(track.id);
              final isCached = download.getItem(track.id)?.status == 'completed';

              return TrackRow(
                itemMap: track.toJson(),
                isPlaying: isCurrent && player.isPlaying,
                isLiked: isLiked,
                isCached: isCached,
                onPlay: () => player.playItem(track, sourceQueue: _tracks),
                onLike: () => storage.toggleLike(track),
                onMore: () {},
                onTap: () => widget.onNavigate('track', track.id),
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _artPlaceholder() {
    return Container(
      width: 180,
      height: 180,
      color: Colors.white10,
      child: const Icon(Icons.music_note, size: 60, color: Colors.white38),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/music_item.dart';
import '../providers/player_provider.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/download_service.dart';
import '../widgets/track_row.dart';

class HomeView extends StatefulWidget {
  final Function(String, String) onNavigate;

  const HomeView({super.key, required this.onNavigate});

  @override
  State<HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends State<HomeView> {
  bool _isLoading = true;
  String? _error;

  List<MusicItem> _freshItems = [];
  List<MusicItem> _popularItems = [];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final fresh = await ApiService.fetchFresh();
      final popular = await ApiService.fetchPopular(20);

      setState(() {
        _freshItems = fresh;
        _popularItems = popular;
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

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 12),
            Text('Failed to load content: $_error'),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _fetchData,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    final greeting = _greetingMessage();

    final recents = storage.recentlyPlayed;
    final popularTracks = _popularItems.where((i) => i.itemType == 'track').toList();
    final freshTracks = _freshItems.where((i) => i.itemType == 'track').toList();
    final freshArtists = _freshItems.where((i) => i.itemType == 'artist').toList();
    final freshAlbums = _freshItems.where((i) => i.itemType == 'collection').toList();

    return RefreshIndicator(
      onRefresh: _fetchData,
      child: ListView(
        padding: const EdgeInsets.symmetric(vertical: 16),
        children: [
          // Greeting Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  greeting,
                  style: const TextStyle(
                      fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const Text(
                  'Welcome to MusicMan',
                  style: TextStyle(color: Colors.white54, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Recently Played
          if (recents.isNotEmpty) ...[
            _sectionTitle('Recently Played'),
            _buildHorizontalCards(recents, isTrack: true),
            const SizedBox(height: 16),
          ],

          // Popular Tracks
          if (popularTracks.isNotEmpty) ...[
            _sectionTitle('Popular Hits'),
            _buildHorizontalCards(popularTracks, isTrack: true),
            const SizedBox(height: 16),
          ],

          // Fresh Tracks List
          if (freshTracks.isNotEmpty) ...[
            _sectionTitle('Fresh Tracks'),
            ...freshTracks.take(10).map((track) {
              final isCurrent = player.currentTrack?.id == track.id;
              final isLiked = storage.isLiked(track.id);
              final isCached = download.getItem(track.id)?.status == 'completed';

              return TrackRow(
                itemMap: track.toJson(),
                isPlaying: isCurrent && player.isPlaying,
                isLiked: isLiked,
                isCached: isCached,
                onPlay: () => player.playItem(track, sourceQueue: freshTracks),
                onLike: () => storage.toggleLike(track),
                onMore: () => _showTrackOptions(context, track, storage, download, player),
                onTap: () => widget.onNavigate('track', track.id),
              );
            }),
            const SizedBox(height: 16),
          ],

          // Fresh Artists
          if (freshArtists.isNotEmpty) ...[
            _sectionTitle('Popular Artists'),
            _buildArtistCards(freshArtists),
            const SizedBox(height: 16),
          ],

          // Fresh Albums
          if (freshAlbums.isNotEmpty) ...[
            _sectionTitle('New Albums'),
            _buildHorizontalCards(freshAlbums, isTrack: false),
          ],
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.2,
          color: Colors.white54,
        ),
      ),
    );
  }

  Widget _buildHorizontalCards(List<MusicItem> items, {required bool isTrack}) {
    return SizedBox(
      height: 170,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          final art = item.getArtwork(300);
          final title = item.trackName ?? item.collectionName ?? 'Music';
          final sub = item.artistName ?? '';

          return GestureDetector(
            onTap: () {
              if (isTrack) {
                widget.onNavigate('track', item.id);
              } else {
                widget.onNavigate('album', item.id);
              }
            },
            child: Container(
              width: 120,
              margin: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: art.isNotEmpty
                        ? Image.network(
                            art,
                            width: 120,
                            height: 120,
                            fit: BoxFit.cover,
                            errorBuilder: (ctx, err, stack) => _cardArtPlaceholder(),
                          )
                        : _cardArtPlaceholder(),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                  Text(
                    sub,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildArtistCards(List<MusicItem> artists) {
    return SizedBox(
      height: 140,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: artists.length,
        itemBuilder: (context, index) {
          final artist = artists[index];
          final art = artist.getArtwork(300);

          return GestureDetector(
            onTap: () => widget.onNavigate('artist', artist.id),
            child: Container(
              width: 96,
              margin: const EdgeInsets.symmetric(horizontal: 6),
              child: Column(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(48),
                    child: art.isNotEmpty
                        ? Image.network(
                            art,
                            width: 96,
                            height: 96,
                            fit: BoxFit.cover,
                            errorBuilder: (ctx, err, stack) => _artistArtPlaceholder(),
                          )
                        : _artistArtPlaceholder(),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    artist.artistName ?? 'Artist',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _cardArtPlaceholder() {
    return Container(
      width: 120,
      height: 120,
      color: Colors.white10,
      child: const Icon(Icons.music_note, color: Colors.white38, size: 40),
    );
  }

  Widget _artistArtPlaceholder() {
    return Container(
      width: 96,
      height: 96,
      color: Colors.white10,
      child: const Icon(Icons.person, color: Colors.white38, size: 40),
    );
  }

  String _greetingMessage() {
    final hour = DateTime.now().hour;
    if (hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  void _showTrackOptions(
    BuildContext context,
    MusicItem track,
    StorageService storage,
    DownloadService download,
    PlayerProvider player,
  ) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.play_arrow),
            title: const Text('Play Next'),
            onTap: () {
              player.addToQueue([track]);
              Navigator.pop(ctx);
            },
          ),
          ListTile(
            leading: Icon(
              storage.isLiked(track.id) ? Icons.favorite : Icons.favorite_border,
              color: storage.isLiked(track.id) ? Colors.red : null,
            ),
            title: Text(storage.isLiked(track.id)
                ? 'Remove from Liked'
                : 'Add to Liked'),
            onTap: () {
              storage.toggleLike(track);
              Navigator.pop(ctx);
            },
          ),
          ListTile(
            leading: const Icon(Icons.download),
            title: const Text('Download Offline'),
            onTap: () {
              download.addDownload(track);
              Navigator.pop(ctx);
            },
          ),
        ],
      ),
    );
  }
}

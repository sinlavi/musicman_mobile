import 'package:flutter/material.dart';
import '../models/music_item.dart';
import '../services/api_service.dart';
import '../services/audio_player_service.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

class HomeView extends StatefulWidget {
  final Function(MusicItem) onNavigateToItem;

  const HomeView({super.key, required this.onNavigateToItem});

  @override
  State<HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends State<HomeView> {
  bool _isLoading = true;
  String? _error;
  List<MusicItem> _freshItems = [];
  List<MusicItem> _popularItems = [];
  List<MusicItem> _recentlyPlayed = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        ApiService.getFresh().catchError((_) => <MusicItem>[]),
        ApiService.getPopular().catchError((_) => <MusicItem>[]),
      ]);

      if (mounted) {
        setState(() {
          _freshItems = results[0];
          _popularItems = results[1];
          _recentlyPlayed = StorageService.getRecentlyPlayed();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.warning_amber, size: 48, color: Colors.amber),
            const SizedBox(height: 12),
            const Text('Could not load home data'),
            TextButton(onPressed: _loadData, child: const Text('Retry')),
          ],
        ),
      );
    }

    final tracks = _freshItems.where((e) => e.type == 'track').toList();
    final albums = _freshItems.where((e) => e.type == 'collection').toList();
    final artists = _freshItems.where((e) => e.type == 'artist').toList();
    final popularTracks = _popularItems.where((e) => e.type == 'track').toList();

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          // Greeting Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _getGreeting(),
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const Text(
                  'Welcome back to MusicMan',
                  style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ),

          // Recently Played
          if (_recentlyPlayed.isNotEmpty) ...[
            _buildSectionTitle('Recently Played'),
            SizedBox(
              height: 180,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: _recentlyPlayed.length,
                itemBuilder: (context, index) {
                  final item = _recentlyPlayed[index];
                  return AlbumCard(
                    item: item,
                    onTap: () {
                      if (item.type == 'track') {
                        AudioPlayerService().playItem(item);
                      } else {
                        widget.onNavigateToItem(item);
                      }
                    },
                  );
                },
              ),
            ),
          ],

          // Popular Tracks
          if (popularTracks.isNotEmpty) ...[
            _buildSectionTitle('Popular'),
            SizedBox(
              height: 180,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: popularTracks.length,
                itemBuilder: (context, index) {
                  final item = popularTracks[index];
                  return AlbumCard(
                    item: item,
                    onTap: () => AudioPlayerService().playItem(item, newQueue: popularTracks, initialIndex: index),
                  );
                },
              ),
            ),
          ],

          // Fresh Music
          if (tracks.isNotEmpty) ...[
            _buildSectionTitle('Fresh Music'),
            SizedBox(
              height: 180,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: tracks.length,
                itemBuilder: (context, index) {
                  final item = tracks[index];
                  return AlbumCard(
                    item: item,
                    onTap: () => AudioPlayerService().playItem(item, newQueue: tracks, initialIndex: index),
                  );
                },
              ),
            ),
          ],

          // Fresh Artists
          if (artists.isNotEmpty) ...[
            _buildSectionTitle('Fresh Artists'),
            SizedBox(
              height: 140,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: artists.length,
                itemBuilder: (context, index) {
                  final item = artists[index];
                  return ArtistCard(
                    item: item,
                    onTap: () => widget.onNavigateToItem(item),
                  );
                },
              ),
            ),
          ],

          // Fresh Albums
          if (albums.isNotEmpty) ...[
            _buildSectionTitle('Fresh Albums'),
            SizedBox(
              height: 180,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: albums.length,
                itemBuilder: (context, index) {
                  final item = albums[index];
                  return AlbumCard(
                    item: item,
                    onTap: () => widget.onNavigateToItem(item),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
          color: AppTheme.textSecondary,
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../models/music_item.dart';
import '../services/api_service.dart';
import '../services/audio_player_service.dart';
import '../services/download_manager.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

class ArtistView extends StatefulWidget {
  final MusicItem artist;
  final Function(MusicItem) onNavigateToItem;

  const ArtistView({
    super.key,
    required this.artist,
    required this.onNavigateToItem,
  });

  @override
  State<ArtistView> createState() => _ArtistViewState();
}

class _ArtistViewState extends State<ArtistView> {
  final ScrollController _scrollController = ScrollController();
  final DownloadManager _downloadManager = DownloadManager();

  bool _isLoading = true;
  bool _isLoadingMore = false;
  String _sort = 'album';
  int _page = 1;
  bool _hasMore = false;

  List<MusicItem> _albums = [];
  List<MusicItem> _tracks = [];
  int _totalTracks = 0;

  @override
  void initState() {
    super.initState();
    _loadArtistData();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      if (!_isLoadingMore && _hasMore) {
        _loadMoreTracks();
      }
    }
  }

  Future<void> _loadArtistData() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final results = await Future.wait([
        ApiService.lookup(widget.artist.id, 'album').catchError((_) => <MusicItem>[]),
        ApiService.getArtistTracks(widget.artist.id, page: 1, sort: _sort).catchError((_) => <String, dynamic>{}),
      ]);

      final albumList = (results[0] as List<MusicItem>).where((e) => e.type == 'collection').toList();
      final trackData = results[1] as Map<String, dynamic>;

      if (mounted) {
        setState(() {
          _albums = albumList;
          _tracks = trackData['results'] as List<MusicItem>? ?? [];
          _totalTracks = trackData['total'] as int? ?? _tracks.length;
          _hasMore = trackData['hasMore'] as bool? ?? false;
          _page = 1;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadMoreTracks() async {
    setState(() {
      _isLoadingMore = true;
    });

    try {
      final nextPage = _page + 1;
      final trackData = await ApiService.getArtistTracks(widget.artist.id, page: nextPage, sort: _sort);
      final newTracks = trackData['results'] as List<MusicItem>? ?? [];

      if (mounted) {
        setState(() {
          _tracks.addAll(newTracks);
          _page = nextPage;
          _hasMore = trackData['hasMore'] as bool? ?? false;
          _isLoadingMore = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoadingMore = false;
        });
      }
    }
  }

  void _changeSort(String newSort) {
    if (_sort == newSort) return;
    setState(() {
      _sort = newSort;
    });
    _loadArtistData();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.artist.name)),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final isFollowed = StorageService.isFollowed(widget.artist.id);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.artist.name),
      ),
      body: ListView(
        controller: _scrollController,
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          // Hero Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                ArtworkImage(
                  url: widget.artist.getArtwork(preferPx: 400),
                  size: 160,
                  borderRadius: 80,
                  placeholderIcon: Icons.person,
                ),
                const SizedBox(height: 12),
                Text(
                  widget.artist.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                ),
                Text(
                  [
                    if (widget.artist.primaryGenreName != null) widget.artist.primaryGenreName,
                    '$_totalTracks tracks',
                    '${_albums.length} albums',
                  ].join(' · '),
                  style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                ),
                const SizedBox(height: 16),

                // Action Buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryGradientStart,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      ),
                      onPressed: () {
                        if (_tracks.isNotEmpty) {
                          AudioPlayerService().playItem(_tracks.first, newQueue: _tracks, initialIndex: 0);
                        }
                      },
                      icon: const Icon(Icons.play_arrow),
                      label: const Text('Play All'),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: isFollowed ? Colors.white : AppTheme.primaryGradientStart,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      ),
                      onPressed: () async {
                        await StorageService.toggleFollow(
                          FollowedArtist(
                            artistId: widget.artist.id,
                            artistName: widget.artist.name,
                            primaryGenreName: widget.artist.primaryGenreName ?? '',
                            artwork: widget.artist.getArtwork(preferPx: 300),
                          ),
                        );
                        setState(() {});
                      },
                      icon: Icon(isFollowed ? Icons.check : Icons.add),
                      label: Text(isFollowed ? 'Following' : 'Follow'),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Albums Carousel
          if (_albums.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Text(
                'ALBUMS (${_albums.length})',
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
              ),
            ),
            SizedBox(
              height: 180,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: _albums.length,
                itemBuilder: (context, index) {
                  final album = _albums[index];
                  return AlbumCard(
                    item: album,
                    onTap: () => widget.onNavigateToItem(album),
                  );
                },
              ),
            ),
          ],

          // Sort Chips & Tracks Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('TRACKS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
                Row(
                  children: [
                    _buildSortChip('album', 'Album'),
                    const SizedBox(width: 4),
                    _buildSortChip('recent', 'Recent'),
                    const SizedBox(width: 4),
                    _buildSortChip('name', 'A-Z'),
                  ],
                ),
              ],
            ),
          ),

          // Tracks List
          ..._tracks.map((track) => TrackTile(
                item: track,
                onTap: () => AudioPlayerService().playItem(track, newQueue: _tracks),
                onMoreTap: () => widget.onNavigateToItem(track),
              )),

          if (_isLoadingMore)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    );
  }

  Widget _buildSortChip(String key, String label) {
    final isSelected = _sort == key;
    return ChoiceChip(
      selected: isSelected,
      label: Text(label, style: const TextStyle(fontSize: 10)),
      selectedColor: AppTheme.primaryGradientStart,
      backgroundColor: Colors.white10,
      onSelected: (_) => _changeSort(key),
    );
  }
}

class AlbumView extends StatefulWidget {
  final MusicItem album;
  final Function(MusicItem) onNavigateToItem;

  const AlbumView({
    super.key,
    required this.album,
    required this.onNavigateToItem,
  });

  @override
  State<AlbumView> createState() => _AlbumViewState();
}

class _AlbumViewState extends State<AlbumView> {
  final DownloadManager _downloadManager = DownloadManager();

  bool _isLoading = true;
  List<MusicItem> _tracks = [];

  @override
  void initState() {
    super.initState();
    _loadAlbumTracks();
  }

  Future<void> _loadAlbumTracks() async {
    try {
      final items = await ApiService.lookup(widget.album.id, 'song');
      final trackList = items.where((e) => e.type == 'track').toList();
      if (mounted) {
        setState(() {
          _tracks = trackList;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.album.name)),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.album.name),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          // Album Details Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                ArtworkImage(
                  url: widget.album.getArtwork(preferPx: 600),
                  size: 200,
                  borderRadius: 16,
                  placeholderIcon: Icons.album,
                ),
                const SizedBox(height: 16),
                Text(
                  widget.album.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.album.artistName ?? '',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
                ),
                const SizedBox(height: 16),

                // Action Bar
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryGradientStart,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      ),
                      onPressed: () {
                        if (_tracks.isNotEmpty) {
                          AudioPlayerService().playItem(_tracks.first, newQueue: _tracks, initialIndex: 0);
                        }
                      },
                      icon: const Icon(Icons.play_arrow),
                      label: const Text('Play Album'),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      ),
                      onPressed: () async {
                        for (final t in _tracks) {
                          await _downloadManager.addDownload(t);
                        }
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Downloading album tracks...')),
                          );
                        }
                      },
                      icon: const Icon(Icons.cloud_download),
                      label: const Text('Crawl All'),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Track List
          ..._tracks.map((track) => TrackTile(
                item: track,
                onTap: () => AudioPlayerService().playItem(track, newQueue: _tracks),
                onMoreTap: () => widget.onNavigateToItem(track),
              )),
        ],
      ),
    );
  }
}

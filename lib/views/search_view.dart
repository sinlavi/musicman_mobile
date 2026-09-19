import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/music_item.dart';
import '../providers/player_provider.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/download_service.dart';
import '../widgets/track_row.dart';

class SearchView extends StatefulWidget {
  final Function(String, String) onNavigate;

  const SearchView({super.key, required this.onNavigate});

  @override
  State<SearchView> createState() => _SearchViewState();
}

class _SearchViewState extends State<SearchView> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounceTimer;

  bool _isSearching = false;
  List<MusicItem> _results = [];
  List<Map<String, dynamic>> _suggestions = [];
  String _filter = 'all'; // all, artist, album, track

  @override
  void dispose() {
    _searchController.dispose();
    _debounceTimer?.cancel();
    super.dispose();
  }

  void _onQueryChanged(String query) {
    _debounceTimer?.cancel();
    if (query.trim().isEmpty) {
      setState(() {
        _suggestions.clear();
        _results.clear();
        _isSearching = false;
      });
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 300), () async {
      final sugs = await ApiService.fetchSuggestions(query);
      setState(() {
        _suggestions = sugs;
      });
    });
  }

  Future<void> _performSearch(String term) async {
    if (term.trim().isEmpty) return;

    final storage = context.read<StorageService>();
    storage.addRecentSearch(term);

    setState(() {
      _isSearching = true;
      _suggestions.clear();
    });

    try {
      final items = await ApiService.search(term);
      setState(() {
        _results = items;
        _isSearching = false;
      });
    } catch (_) {
      setState(() {
        _isSearching = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final storage = context.watch<StorageService>();
    final player = context.watch<PlayerProvider>();
    final download = context.watch<DownloadService>();

    final filteredResults = _results.where((item) {
      if (_filter == 'artist') return item.itemType == 'artist';
      if (_filter == 'album') return item.itemType == 'collection';
      if (_filter == 'track') return item.itemType == 'track';
      return true;
    }).toList();

    return Column(
      children: [
        // Search Input Bar
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _searchController,
            onChanged: _onQueryChanged,
            onSubmitted: _performSearch,
            decoration: InputDecoration(
              hintText: 'Search songs, albums, artists...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searchController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _searchController.clear();
                        _onQueryChanged('');
                      },
                    )
                  : null,
              filled: true,
              fillColor: Colors.white10,
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),

        // Search Filter Chips
        if (_results.isNotEmpty)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                _filterChip('All', 'all'),
                const SizedBox(width: 8),
                _filterChip('Artists', 'artist'),
                const SizedBox(width: 8),
                _filterChip('Albums', 'album'),
                const SizedBox(width: 8),
                _filterChip('Songs', 'track'),
              ],
            ),
          ),

        // Content Area
        Expanded(
          child: _isSearching
              ? const Center(child: CircularProgressIndicator())
              : _suggestions.isNotEmpty
                  ? _buildSuggestionsList()
                  : _results.isNotEmpty
                      ? _buildResultsList(filteredResults, player, storage, download)
                      : _buildRecentSearches(storage),
        ),
      ],
    );
  }

  Widget _filterChip(String label, String value) {
    final isSelected = _filter == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          setState(() => _filter = value);
        }
      },
    );
  }

  Widget _buildSuggestionsList() {
    return ListView.builder(
      itemCount: _suggestions.length,
      itemBuilder: (context, index) {
        final sug = _suggestions[index];
        final name = sug['name']?.toString() ?? '';
        final type = sug['type']?.toString() ?? '';
        final id = sug['id']?.toString() ?? '';

        return ListTile(
          leading: Icon(
            type == 'artist'
                ? Icons.person
                : type == 'collection'
                    ? Icons.album
                    : Icons.music_note,
            color: Colors.white54,
          ),
          title: Text(name),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white10,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(type.toUpperCase(),
                style: const TextStyle(fontSize: 10, color: Colors.white54)),
          ),
          onTap: () {
            _searchController.text = name;
            _performSearch(name);
            if (id.isNotEmpty && type.isNotEmpty) {
              widget.onNavigate(type == 'collection' ? 'album' : type, id);
            }
          },
        );
      },
    );
  }

  Widget _buildResultsList(
    List<MusicItem> items,
    PlayerProvider player,
    StorageService storage,
    DownloadService download,
  ) {
    if (items.isEmpty) {
      return const Center(child: Text('No results found'));
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];

        if (item.itemType == 'artist') {
          return ListTile(
            leading: CircleAvatar(
              backgroundImage: NetworkImage(item.getArtwork(100)),
              child: item.getArtwork(100).isEmpty
                  ? const Icon(Icons.person)
                  : null,
            ),
            title: Text(item.artistName ?? 'Artist'),
            subtitle: const Text('Artist'),
            onTap: () => widget.onNavigate('artist', item.id),
          );
        }

        if (item.itemType == 'collection') {
          return ListTile(
            leading: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                item.getArtwork(100),
                width: 48,
                height: 48,
                fit: BoxFit.cover,
                errorBuilder: (ctx, err, stack) => Container(
                  width: 48,
                  height: 48,
                  color: Colors.white10,
                  child: const Icon(Icons.album),
                ),
              ),
            ),
            title: Text(item.collectionName ?? 'Album'),
            subtitle: Text(item.artistName ?? ''),
            onTap: () => widget.onNavigate('album', item.id),
          );
        }

        // Track
        final isCurrent = player.currentTrack?.id == item.id;
        final isLiked = storage.isLiked(item.id);
        final isCached = download.getItem(item.id)?.status == 'completed';

        return TrackRow(
          itemMap: item.toJson(),
          isPlaying: isCurrent && player.isPlaying,
          isLiked: isLiked,
          isCached: isCached,
          onPlay: () => player.playItem(item, sourceQueue: items.where((x) => x.itemType == 'track').toList()),
          onLike: () => storage.toggleLike(item),
          onMore: () {},
          onTap: () => widget.onNavigate('track', item.id),
        );
      },
    );
  }

  Widget _buildRecentSearches(StorageService storage) {
    final recents = storage.recentSearches;
    if (recents.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search, size: 64, color: Colors.white24),
            SizedBox(height: 12),
            Text('Search songs, artists, or albums',
                style: TextStyle(color: Colors.white38)),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('RECENT SEARCHES',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.white54)),
              IconButton(
                icon: const Icon(Icons.delete_outline, size: 18),
                onPressed: () => storage.clearRecentSearches(),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: recents.length,
            itemBuilder: (context, index) {
              final term = recents[index];
              return ListTile(
                leading: const Icon(Icons.history, color: Colors.white38),
                title: Text(term),
                onTap: () {
                  _searchController.text = term;
                  _performSearch(term);
                },
              );
            },
          ),
        ),
      ],
    );
  }
}

import 'dart:async';
import 'package:flutter/material.dart';
import '../models/music_item.dart';
import '../services/api_service.dart';
import '../services/audio_player_service.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

class SearchView extends StatefulWidget {
  final Function(MusicItem) onNavigateToItem;

  const SearchView({super.key, required this.onNavigateToItem});

  @override
  State<SearchView> createState() => _SearchViewState();
}

class _SearchViewState extends State<SearchView> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounceTimer;

  String _filter = 'all'; // 'all', 'artist', 'album', 'track'
  bool _isLoading = false;
  List<SearchSuggestion> _suggestions = [];
  List<MusicItem> _searchResults = [];
  List<String> _recentSearches = [];

  @override
  void initState() {
    super.initState();
    _recentSearches = StorageService.getRecentSearches();
    _searchController.addListener(_onSearchInput);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounceTimer?.cancel();
    super.dispose();
  }

  void _onSearchInput() {
    final query = _searchController.text.trim();
    _debounceTimer?.cancel();

    if (query.isEmpty) {
      setState(() {
        _suggestions = [];
        _searchResults = [];
        _isLoading = false;
      });
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 200), () async {
      final sugs = await ApiService.suggest(query);
      if (mounted) {
        setState(() {
          _suggestions = sugs;
        });
      }
    });
  }

  void _performSearch(String term) async {
    final query = term.trim();
    if (query.isEmpty) return;

    _searchController.text = query;
    FocusScope.of(context).unfocus();

    await StorageService.addRecentSearch(query);

    setState(() {
      _isLoading = true;
      _suggestions = [];
      _recentSearches = StorageService.getRecentSearches();
    });

    try {
      final results = await ApiService.search(query);
      if (mounted) {
        setState(() {
          _searchResults = results;
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
    return Column(
      children: [
        // Search Input Box
        Padding(
          padding: const EdgeInsets.all(12),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white10,
              borderRadius: BorderRadius.circular(12),
            ),
            child: TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              onSubmitted: _performSearch,
              decoration: InputDecoration(
                hintText: 'Songs, albums, artists…',
                prefixIcon: const Icon(Icons.search, color: AppTheme.textSecondary),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: AppTheme.textSecondary),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {
                            _suggestions = [];
                            _searchResults = [];
                          });
                        },
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ),

        // Filter Chips (when search results exist)
        if (_searchResults.isNotEmpty)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Row(
              children: [
                _buildFilterChip('all', 'All'),
                _buildFilterChip('artist', 'Artists'),
                _buildFilterChip('album', 'Albums'),
                _buildFilterChip('track', 'Songs'),
              ],
            ),
          ),

        // Body Content
        Expanded(
          child: _buildBody(),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _filter == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        selected: isSelected,
        label: Text(label),
        selectedColor: AppTheme.primaryGradientStart,
        backgroundColor: Colors.white10,
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : AppTheme.textSecondary,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
        onSelected: (_) {
          setState(() {
            _filter = key;
          });
        },
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    // Auto-suggestions overlay
    if (_suggestions.isNotEmpty && _searchController.text.isNotEmpty) {
      return ListView.builder(
        itemCount: _suggestions.length,
        itemBuilder: (context, index) {
          final sug = _suggestions[index];
          return ListTile(
            leading: Icon(
              sug.type == 'artist'
                  ? Icons.person
                  : sug.type == 'collection'
                      ? Icons.album
                      : Icons.music_note,
              color: AppTheme.textSecondary,
            ),
            title: Text(sug.name),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white10,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                sug.type.toUpperCase(),
                style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
              ),
            ),
            onTap: () {
              _performSearch(sug.name);
            },
          );
        },
      );
    }

    // Search results list
    if (_searchResults.isNotEmpty) {
      final filtered = _searchResults.where((e) {
        if (_filter == 'all') return true;
        return e.type == _filter;
      }).toList();

      if (filtered.isEmpty) {
        return const Center(child: Text('No matches for this filter', style: TextStyle(color: AppTheme.textSecondary)));
      }

      return ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: filtered.length,
        itemBuilder: (context, index) {
          final item = filtered[index];
          if (item.type == 'track') {
            return TrackTile(
              item: item,
              onTap: () => AudioPlayerService().playItem(
                item,
                newQueue: filtered.where((e) => e.type == 'track').toList(),
              ),
              onMoreTap: () => widget.onNavigateToItem(item),
            );
          } else {
            return ListTile(
              leading: ArtworkImage(url: item.getArtwork(preferPx: 100), size: 46),
              title: Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text(item.artistName ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
              trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
              onTap: () => widget.onNavigateToItem(item),
            );
          }
        },
      );
    }

    // Recent search terms
    if (_recentSearches.isNotEmpty) {
      return ListView(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('RECENT SEARCHES', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 20, color: AppTheme.textSecondary),
                  onPressed: () async {
                    await StorageService.clearRecentSearches();
                    setState(() {
                      _recentSearches = [];
                    });
                  },
                ),
              ],
            ),
          ),
          ..._recentSearches.map((term) => ListTile(
                leading: const Icon(Icons.history, color: AppTheme.textSecondary),
                title: Text(term),
                onTap: () => _performSearch(term),
              )),
        ],
      );
    }

    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search, size: 64, color: Colors.white24),
          SizedBox(height: 12),
          Text('Find your music', style: TextStyle(color: AppTheme.textSecondary)),
        ],
      ),
    );
  }
}

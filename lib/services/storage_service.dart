import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/music_item.dart';
import '../models/playlist_item.dart';

class StorageService extends ChangeNotifier {
  static const String _keyLikes = 'mm_likes';
  static const String _keyPlaylists = 'mm_playlists';
  static const String _keyFollowed = 'mm_followed';
  static const String _keyRecentSearches = 'mm_recent';
  static const String _keyRecentlyPlayed = 'mm_recently_played';
  static const String _keySettings = 'mm_settings';

  SharedPreferences? _prefs;

  List<MusicItem> _likes = [];
  List<PlaylistItem> _playlists = [];
  List<Map<String, dynamic>> _followed = [];
  List<String> _recentSearches = [];
  List<MusicItem> _recentlyPlayed = [];
  Map<String, dynamic> _settings = {
    'theme': 'dark',
    'playbackRate': 1.0,
    'equalizerPreset': 'Normal',
    'autoScrollLyrics': true,
    'autoRetry': true,
  };

  List<MusicItem> get likes => List.unmodifiable(_likes);
  List<PlaylistItem> get playlists => List.unmodifiable(_playlists);
  List<Map<String, dynamic>> get followed => List.unmodifiable(_followed);
  List<String> get recentSearches => List.unmodifiable(_recentSearches);
  List<MusicItem> get recentlyPlayed => List.unmodifiable(_recentlyPlayed);
  Map<String, dynamic> get settings => Map.unmodifiable(_settings);

  String get theme => _settings['theme'] as String? ?? 'dark';
  double get playbackRate => (_settings['playbackRate'] as num?)?.toDouble() ?? 1.0;
  String get equalizerPreset => _settings['equalizerPreset'] as String? ?? 'Normal';

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _loadAll();
  }

  void _loadAll() {
    if (_prefs == null) return;

    // Likes
    final rawLikes = _prefs!.getString(_keyLikes);
    if (rawLikes != null) {
      try {
        final list = jsonDecode(rawLikes) as List;
        _likes = list.map((e) => MusicItem.fromJson(e as Map<String, dynamic>)).toList();
      } catch (_) {}
    }

    // Playlists
    final rawPls = _prefs!.getString(_keyPlaylists);
    if (rawPls != null) {
      try {
        final list = jsonDecode(rawPls) as List;
        _playlists = list.map((e) => PlaylistItem.fromJson(e as Map<String, dynamic>)).toList();
      } catch (_) {}
    }

    // Followed
    final rawFol = _prefs!.getString(_keyFollowed);
    if (rawFol != null) {
      try {
        final list = jsonDecode(rawFol) as List;
        _followed = list.cast<Map<String, dynamic>>();
      } catch (_) {}
    }

    // Recent Searches
    final rawSearch = _prefs!.getString(_keyRecentSearches);
    if (rawSearch != null) {
      try {
        final list = jsonDecode(rawSearch) as List;
        _recentSearches = list.cast<String>();
      } catch (_) {}
    }

    // Recently Played
    final rawPlays = _prefs!.getString(_keyRecentlyPlayed);
    if (rawPlays != null) {
      try {
        final list = jsonDecode(rawPlays) as List;
        _recentlyPlayed = list.map((e) => MusicItem.fromJson(e as Map<String, dynamic>)).toList();
      } catch (_) {}
    }

    // Settings
    final rawSet = _prefs!.getString(_keySettings);
    if (rawSet != null) {
      try {
        final map = jsonDecode(rawSet) as Map<String, dynamic>;
        _settings = {..._settings, ...map};
      } catch (_) {}
    }

    notifyListeners();
  }

  // --- Likes ---
  bool isLiked(String? trackId) {
    if (trackId == null) return false;
    final clean = trackId.replaceAll(RegExp(r'^it_'), '');
    return _likes.any((t) => t.id == clean || t.trackId == clean || t.trackId == trackId);
  }

  Future<void> toggleLike(MusicItem item) async {
    final id = item.id;
    if (id.isEmpty) return;
    if (isLiked(id)) {
      _likes.removeWhere((t) => t.id == id || t.trackId == id);
    } else {
      _likes.insert(0, item);
    }
    await _prefs?.setString(_keyLikes, jsonEncode(_likes.map((e) => e.toJson()).toList()));
    notifyListeners();
  }

  // --- Followed Artists ---
  bool isFollowed(String? artistId) {
    if (artistId == null) return false;
    final clean = artistId.replaceAll(RegExp(r'^it_'), '');
    return _followed.any((a) => a['artistId']?.toString() == clean || a['artistId']?.toString() == artistId);
  }

  Future<void> toggleFollow(String artistId, String name, String artwork, String genre) async {
    final clean = artistId.replaceAll(RegExp(r'^it_'), '');
    if (isFollowed(clean)) {
      _followed.removeWhere((a) => a['artistId']?.toString() == clean);
    } else {
      _followed.insert(0, {
        'artistId': clean,
        'artistName': name,
        'artwork': artwork,
        'primaryGenreName': genre,
        'followedAt': DateTime.now().millisecondsSinceEpoch,
      });
    }
    await _prefs?.setString(_keyFollowed, jsonEncode(_followed));
    notifyListeners();
  }

  // --- Playlists ---
  Future<PlaylistItem> createPlaylist(String name) async {
    final pl = PlaylistItem(
      id: 'pl_${DateTime.now().millisecondsSinceEpoch}',
      name: name.trim(),
      tracks: [],
      createdAt: DateTime.now().millisecondsSinceEpoch,
    );
    _playlists.add(pl);
    await _savePlaylists();
    notifyListeners();
    return pl;
  }

  Future<void> addToPlaylist(String playlistId, List<MusicItem> items) async {
    final idx = _playlists.indexWhere((p) => p.id == playlistId);
    if (idx == -1) return;
    final pl = _playlists[idx];
    final existingIds = pl.tracks.map((t) => t['trackId']?.toString()).toSet();

    for (final item in items) {
      if (!existingIds.contains(item.id)) {
        pl.tracks.add(item.toJson());
      }
    }
    await _savePlaylists();
    notifyListeners();
  }

  Future<void> removeFromPlaylist(String playlistId, String trackId) async {
    final idx = _playlists.indexWhere((p) => p.id == playlistId);
    if (idx == -1) return;
    final pl = _playlists[idx];
    pl.tracks.removeWhere((t) => t['trackId']?.toString() == trackId || t['id']?.toString() == trackId);
    await _savePlaylists();
    notifyListeners();
  }

  Future<void> deletePlaylist(String playlistId) async {
    _playlists.removeWhere((p) => p.id == playlistId);
    await _savePlaylists();
    notifyListeners();
  }

  Future<void> renamePlaylist(String playlistId, String newName) async {
    final idx = _playlists.indexWhere((p) => p.id == playlistId);
    if (idx == -1) return;
    _playlists[idx] = PlaylistItem(
      id: _playlists[idx].id,
      name: newName.trim(),
      tracks: _playlists[idx].tracks,
      createdAt: _playlists[idx].createdAt,
    );
    await _savePlaylists();
    notifyListeners();
  }

  Future<void> _savePlaylists() async {
    await _prefs?.setString(_keyPlaylists, jsonEncode(_playlists.map((e) => e.toJson()).toList()));
  }

  // --- Recent Searches ---
  Future<void> addRecentSearch(String term) async {
    final q = term.trim();
    if (q.isEmpty) return;
    _recentSearches.remove(q);
    _recentSearches.insert(0, q);
    if (_recentSearches.length > 15) _recentSearches = _recentSearches.sublist(0, 15);
    await _prefs?.setString(_keyRecentSearches, jsonEncode(_recentSearches));
    notifyListeners();
  }

  Future<void> clearRecentSearches() async {
    _recentSearches.clear();
    await _prefs?.remove(_keyRecentSearches);
    notifyListeners();
  }

  // --- Recently Played ---
  Future<void> addRecentlyPlayed(MusicItem item) async {
    _recentlyPlayed.removeWhere((t) => t.id == item.id);
    _recentlyPlayed.insert(0, item);
    if (_recentlyPlayed.length > 30) _recentlyPlayed = _recentlyPlayed.sublist(0, 30);
    await _prefs?.setString(_keyRecentlyPlayed, jsonEncode(_recentlyPlayed.map((e) => e.toJson()).toList()));
    notifyListeners();
  }

  // --- Settings ---
  Future<void> updateSetting(String key, dynamic value) async {
    _settings[key] = value;
    await _prefs?.setString(_keySettings, jsonEncode(_settings));
    notifyListeners();
  }

  Future<void> resetAll() async {
    _likes.clear();
    _playlists.clear();
    _followed.clear();
    _recentSearches.clear();
    _recentlyPlayed.clear();
    _settings = {
      'theme': 'dark',
      'playbackRate': 1.0,
      'equalizerPreset': 'Normal',
      'autoScrollLyrics': true,
      'autoRetry': true,
    };
    await _prefs?.clear();
    notifyListeners();
  }
}

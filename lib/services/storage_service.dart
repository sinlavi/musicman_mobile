import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/music_item.dart';

class CustomPlaylist {
  final String id;
  String name;
  List<MusicItem> tracks;
  final int createdAt;

  CustomPlaylist({
    required this.id,
    required this.name,
    List<MusicItem>? tracks,
    int? createdAt,
  })  : tracks = tracks ?? [],
        createdAt = createdAt ?? DateTime.now().millisecondsSinceEpoch;

  factory CustomPlaylist.fromJson(Map<String, dynamic> json) {
    return CustomPlaylist(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Playlist',
      tracks: (json['tracks'] as List? ?? [])
          .map((e) => MusicItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: json['createdAt'] != null ? int.tryParse(json['createdAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'tracks': tracks.map((e) => e.toJson()).toList(),
        'createdAt': createdAt,
      };
}

class FollowedArtist {
  final String artistId;
  final String artistName;
  final String primaryGenreName;
  final String artwork;
  final int followedAt;

  FollowedArtist({
    required this.artistId,
    required this.artistName,
    required this.primaryGenreName,
    required this.artwork,
    int? followedAt,
  }) : followedAt = followedAt ?? DateTime.now().millisecondsSinceEpoch;

  factory FollowedArtist.fromJson(Map<String, dynamic> json) {
    return FollowedArtist(
      artistId: json['artistId']?.toString() ?? '',
      artistName: json['artistName']?.toString() ?? '',
      primaryGenreName: json['primaryGenreName']?.toString() ?? '',
      artwork: json['artwork']?.toString() ?? '',
      followedAt: json['followedAt'] != null ? int.tryParse(json['followedAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'artistId': artistId,
        'artistName': artistName,
        'primaryGenreName': primaryGenreName,
        'artwork': artwork,
        'followedAt': followedAt,
      };
}

class AppSettings {
  String theme; // 'dark' or 'light'
  bool animations;
  double playbackRate;
  bool autoScrollLyrics;
  bool autoRetry;

  AppSettings({
    this.theme = 'dark',
    this.animations = true,
    this.playbackRate = 1.0,
    this.autoScrollLyrics = true,
    this.autoRetry = true,
  });

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    return AppSettings(
      theme: json['theme']?.toString() ?? 'dark',
      animations: json['animations'] as bool? ?? true,
      playbackRate: (double.tryParse(json['playbackRate']?.toString() ?? '1.0') ?? 1.0).clamp(0.5, 2.0),
      autoScrollLyrics: json['autoScrollLyrics'] as bool? ?? true,
      autoRetry: json['autoRetry'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'theme': theme,
        'animations': animations,
        'playbackRate': playbackRate,
        'autoScrollLyrics': autoScrollLyrics,
        'autoRetry': autoRetry,
      };
}

class StorageService {
  static const String keyLikes = 'mm_likes';
  static const String keyPlaylists = 'mm_playlists';
  static const String keyRecent = 'mm_recent';
  static const String keyDownloads = 'mm_downloads';
  static const String keyPlayed = 'mm_recently_played';
  static const String keyFollowing = 'mm_followed';
  static const String keySettings = 'mm_settings';

  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  // --- Likes ---
  static List<MusicItem> getLikes() {
    final raw = _prefs?.getString(keyLikes);
    if (raw == null) return [];
    try {
      final list = json.decode(raw) as List;
      return list.map((e) => MusicItem.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  static bool isLiked(dynamic trackId) {
    final id = trackId?.toString() ?? '';
    if (id.isEmpty) return false;
    return getLikes().any((item) => item.id == id);
  }

  static Future<bool> toggleLike(MusicItem item) async {
    final likes = getLikes();
    final idx = likes.indexWhere((element) => element.id == item.id);
    bool added = false;
    if (idx >= 0) {
      likes.removeAt(idx);
    } else {
      likes.insert(0, item);
      added = true;
    }
    await _prefs?.setString(keyLikes, json.encode(likes.map((e) => e.toJson()).toList()));
    return added;
  }

  // --- Followed Artists ---
  static List<FollowedArtist> getFollowed() {
    final raw = _prefs?.getString(keyFollowing);
    if (raw == null) return [];
    try {
      final list = json.decode(raw) as List;
      return list.map((e) => FollowedArtist.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  static bool isFollowed(dynamic artistId) {
    final id = artistId?.toString() ?? '';
    if (id.isEmpty) return false;
    return getFollowed().any((element) => element.artistId == id);
  }

  static Future<bool> toggleFollow(FollowedArtist artist) async {
    final list = getFollowed();
    final idx = list.indexWhere((e) => e.artistId == artist.artistId);
    bool followed = false;
    if (idx >= 0) {
      list.removeAt(idx);
    } else {
      list.insert(0, artist);
      followed = true;
    }
    await _prefs?.setString(keyFollowing, json.encode(list.map((e) => e.toJson()).toList()));
    return followed;
  }

  // --- Playlists ---
  static List<CustomPlaylist> getPlaylists() {
    final raw = _prefs?.getString(keyPlaylists);
    if (raw == null) return [];
    try {
      final list = json.decode(raw) as List;
      return list.map((e) => CustomPlaylist.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> savePlaylists(List<CustomPlaylist> playlists) async {
    await _prefs?.setString(keyPlaylists, json.encode(playlists.map((e) => e.toJson()).toList()));
  }

  static Future<CustomPlaylist> createPlaylist(String name) async {
    final playlists = getPlaylists();
    final pl = CustomPlaylist(
      id: 'pl_${DateTime.now().millisecondsSinceEpoch}',
      name: name.trim().isEmpty ? 'Playlist' : name.trim(),
    );
    playlists.add(pl);
    await savePlaylists(playlists);
    return pl;
  }

  static Future<void> deletePlaylist(String playlistId) async {
    final playlists = getPlaylists();
    playlists.removeWhere((p) => p.id == playlistId);
    await savePlaylists(playlists);
  }

  // --- Search History ---
  static List<String> getRecentSearches() {
    return _prefs?.getStringList(keyRecent) ?? [];
  }

  static Future<void> addRecentSearch(String term) async {
    final trimmed = term.trim();
    if (trimmed.isEmpty) return;
    final list = getRecentSearches().where((element) => element != trimmed).toList();
    list.insert(0, trimmed);
    await _prefs?.setStringList(keyRecent, list.take(10).toList());
  }

  static Future<void> clearRecentSearches() async {
    await _prefs?.remove(keyRecent);
  }

  // --- Downloads State ---
  static List<Map<String, dynamic>> getDownloads() {
    final raw = _prefs?.getString(keyDownloads);
    if (raw == null) return [];
    try {
      final list = json.decode(raw) as List;
      return list.map((e) => e as Map<String, dynamic>).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> saveDownloads(List<Map<String, dynamic>> items) async {
    await _prefs?.setString(keyDownloads, json.encode(items));
  }

  // --- Recently Played ---
  static List<MusicItem> getRecentlyPlayed() {
    final raw = _prefs?.getString(keyPlayed);
    if (raw == null) return [];
    try {
      final list = json.decode(raw) as List;
      return list.map((e) => MusicItem.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> addRecentlyPlayed(MusicItem item) async {
    if (item.id.isEmpty) return;
    final list = getRecentlyPlayed().where((element) => element.id != item.id).toList();
    list.insert(0, item);
    await _prefs?.setString(keyPlayed, json.encode(list.take(30).map((e) => e.toJson()).toList()));
  }

  // --- Settings ---
  static AppSettings getSettings() {
    final raw = _prefs?.getString(keySettings);
    if (raw == null) return AppSettings();
    try {
      return AppSettings.fromJson(json.decode(raw) as Map<String, dynamic>);
    } catch (_) {
      return AppSettings();
    }
  }

  static Future<void> saveSettings(AppSettings settings) async {
    await _prefs?.setString(keySettings, json.encode(settings.toJson()));
  }

  static Future<void> resetAllData() async {
    await _prefs?.clear();
  }
}

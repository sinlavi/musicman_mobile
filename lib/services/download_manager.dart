import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import '../models/music_item.dart';
import 'api_service.dart';
import 'storage_service.dart';

enum DownloadStatus { queued, crawling, saving, ready, completed, failed, paused }

class DownloadItem {
  final String trackId;
  final String name;
  final String artist;
  final String artistId;
  final String album;
  final String collectionId;
  final String artwork;
  DownloadStatus status;
  double percent;
  String? error;
  int bytes;
  int totalBytes;
  int addedAt;
  MusicItem? musicItem;

  DownloadItem({
    required this.trackId,
    required this.name,
    this.artist = '',
    this.artistId = '',
    this.album = '',
    this.collectionId = '',
    this.artwork = '',
    this.status = DownloadStatus.queued,
    this.percent = 0.0,
    this.error,
    this.bytes = 0,
    this.totalBytes = 0,
    int? addedAt,
    this.musicItem,
  }) : addedAt = addedAt ?? DateTime.now().millisecondsSinceEpoch;

  Map<String, dynamic> toJson() => {
        'trackId': trackId,
        'name': name,
        'artist': artist,
        'artistId': artistId,
        'album': album,
        'collectionId': collectionId,
        'artwork': artwork,
        'status': status.name,
        'percent': percent,
        'error': error,
        'bytes': bytes,
        'totalBytes': totalBytes,
        'addedAt': addedAt,
        if (musicItem != null) 'musicItem': musicItem!.toJson(),
      };

  factory DownloadItem.fromJson(Map<String, dynamic> json) {
    return DownloadItem(
      trackId: json['trackId']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Track',
      artist: json['artist']?.toString() ?? '',
      artistId: json['artistId']?.toString() ?? '',
      album: json['album']?.toString() ?? '',
      collectionId: json['collectionId']?.toString() ?? '',
      artwork: json['artwork']?.toString() ?? '',
      status: DownloadStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => DownloadStatus.queued,
      ),
      percent: (double.tryParse(json['percent']?.toString() ?? '0') ?? 0.0).clamp(0.0, 100.0),
      error: json['error']?.toString(),
      bytes: int.tryParse(json['bytes']?.toString() ?? '0') ?? 0,
      totalBytes: int.tryParse(json['totalBytes']?.toString() ?? '0') ?? 0,
      addedAt: json['addedAt'] != null ? int.tryParse(json['addedAt'].toString()) : null,
      musicItem: json['musicItem'] is Map<String, dynamic>
          ? MusicItem.fromJson(json['musicItem'])
          : null,
    );
  }
}

class DownloadManager {
  static final DownloadManager _instance = DownloadManager._internal();
  factory DownloadManager() => _instance;
  DownloadManager._internal();

  final List<DownloadItem> _items = [];
  final StreamController<List<DownloadItem>> _streamController = StreamController.broadcast();
  Timer? _pollTimer;
  Directory? _audioDir;

  Stream<List<DownloadItem>> get stream => _streamController.stream;
  List<DownloadItem> get allItems => List.unmodifiable(_items);

  Future<void> init() async {
    final docDir = await getApplicationDocumentsDirectory();
    _audioDir = Directory('${docDir.path}/offline_audio');
    if (!await _audioDir!.exists()) {
      await _audioDir!.create(recursive: true);
    }
    _loadFromStorage();
  }

  void _loadFromStorage() {
    final rawList = StorageService.getDownloads();
    _items.clear();
    for (final jsonMap in rawList) {
      final item = DownloadItem.fromJson(jsonMap);
      if (item.status == DownloadStatus.saving) {
        item.status = DownloadStatus.paused;
        item.percent = 0;
        item.error = 'Interrupted';
      }
      _items.add(item);
    }
    _notify();
  }

  void _persist() {
    StorageService.saveDownloads(_items.map((e) => e.toJson()).toList());
  }

  Future<File> _getLocalFile(String trackId) async {
    return File('${_audioDir!.path}/track_$trackId.mp3');
  }

  Future<bool> isOfflineCached(dynamic trackId) async {
    final id = trackId?.toString() ?? '';
    if (id.isEmpty || _audioDir == null) return false;
    final f = await _getLocalFile(id);
    return await f.exists();
  }

  Future<String?> getOfflineFilePath(dynamic trackId) async {
    final id = trackId?.toString() ?? '';
    if (id.isEmpty || _audioDir == null) return null;
    final f = await _getLocalFile(id);
    if (await f.exists()) return f.path;
    return null;
  }

  void _notify() {
    _persist();
    _streamController.add(List.unmodifiable(_items));
  }

  DownloadItem? getItem(dynamic trackId) {
    final id = trackId?.toString() ?? '';
    return _items.firstWhere((element) => element.trackId == id, orElse: () => DownloadItem(trackId: '', name: ''));
  }

  Future<void> addDownload(MusicItem item, {String quality = '320'}) async {
    final id = item.id;
    if (id.isEmpty) return;

    final existingIdx = _items.indexWhere((e) => e.trackId == id);
    final newItem = DownloadItem(
      trackId: id,
      name: item.name,
      artist: item.artistName ?? '',
      artistId: item.artistId?.toString() ?? '',
      album: item.collectionName ?? '',
      collectionId: item.collectionId?.toString() ?? '',
      artwork: item.getArtwork(preferPx: 100),
      status: DownloadStatus.queued,
      percent: 0.0,
      musicItem: item,
    );

    if (existingIdx >= 0) {
      _items[existingIdx] = newItem;
    } else {
      _items.insert(0, newItem);
    }
    _notify();

    if (item.hasAudio) {
      _downloadDirect(newItem, item);
    } else {
      try {
        await ApiService.queueDownload(trackId: id, quality: quality);
      } catch (_) {}
      _ensurePolling();
    }
  }

  Future<void> _downloadDirect(DownloadItem dlItem, MusicItem item) async {
    dlItem.status = DownloadStatus.saving;
    _notify();

    final playableUrl = item.getPlayableUrl();
    if (playableUrl == null || playableUrl.isEmpty) {
      dlItem.status = DownloadStatus.failed;
      dlItem.error = 'No audio stream URL available';
      _notify();
      return;
    }

    try {
      final proxied = ApiService.proxyUrl(playableUrl);
      final request = http.Request('GET', Uri.parse(proxied));
      final response = await http.Client().send(request);

      if (response.statusCode == 200) {
        final total = response.contentLength ?? 0;
        dlItem.totalBytes = total;
        final file = await _getLocalFile(item.id);
        final sink = file.openWrite();

        int downloaded = 0;
        await response.stream.forEach((chunk) {
          downloaded += chunk.length;
          sink.add(chunk);
          dlItem.bytes = downloaded;
          if (total > 0) {
            dlItem.percent = ((downloaded / total) * 100).clamp(0.0, 99.0);
          }
          _notify();
        });

        await sink.flush();
        await sink.close();

        dlItem.status = DownloadStatus.completed;
        dlItem.percent = 100.0;
        _notify();
      } else {
        dlItem.status = DownloadStatus.failed;
        dlItem.error = 'HTTP ${response.statusCode}';
        _notify();
      }
    } catch (e) {
      dlItem.status = DownloadStatus.failed;
      dlItem.error = e.toString();
      _notify();
    }
  }

  void _ensurePolling() {
    if (_pollTimer != null && _pollTimer!.isActive) return;
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (timer) async {
      final inProgress = _items.where((e) => e.status == DownloadStatus.queued || e.status == DownloadStatus.crawling).toList();
      if (inProgress.isEmpty) {
        timer.cancel();
        _pollTimer = null;
        return;
      }

      for (final item in inProgress) {
        final status = await ApiService.getCrawlStatus(item.trackId);
        if (status.downloadStatus == 'completed' || !status.found) {
          final fresh = await ApiService.lookup(item.trackId, 'song');
          final freshTrack = fresh.firstWhere((element) => element.type == 'track', orElse: () => MusicItem());
          if (freshTrack.hasAudio) {
            item.musicItem = freshTrack;
            _downloadDirect(item, freshTrack);
          } else {
            item.status = DownloadStatus.crawling;
            item.percent = 99.0;
            _notify();
          }
        } else if (status.downloadStatus == 'failed' || status.downloadStatus == 'stopped') {
          item.status = DownloadStatus.failed;
          item.error = status.error ?? 'Crawl failed';
          _notify();
        } else {
          item.status = DownloadStatus.crawling;
          item.percent = status.percent;
          _notify();
        }
      }
    });
  }

  Future<void> removeDownload(String trackId) async {
    _items.removeWhere((e) => e.trackId == trackId);
    final file = await _getLocalFile(trackId);
    if (await file.exists()) {
      await file.delete();
    }
    _notify();
  }

  Future<void> clearOfflineCache() async {
    _items.clear();
    if (_audioDir != null && await _audioDir!.exists()) {
      final entities = await _audioDir!.list().toList();
      for (final e in entities) {
        if (e is File) await e.delete();
      }
    }
    _notify();
  }

  Future<List<File>> getOfflineFiles() async {
    if (_audioDir == null || !await _audioDir!.exists()) return [];
    final list = await _audioDir!.list().toList();
    return list.whereType<File>().toList();
  }
}

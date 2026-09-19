import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import '../models/download_item.dart';
import '../models/music_item.dart';
import 'api_service.dart';

class DownloadService extends ChangeNotifier {
  final List<DownloadItem> _downloads = [];
  Timer? _pollingTimer;
  final Set<String> _savingIds = {};

  List<DownloadItem> get downloads => List.unmodifiable(_downloads);

  List<DownloadItem> get activeDownloads =>
      _downloads.where((i) => ['queued', 'crawling', 'saving'].contains(i.status)).toList();

  List<DownloadItem> get readyDownloads =>
      _downloads.where((i) => i.status == 'ready').toList();

  List<DownloadItem> get failedDownloads =>
      _downloads.where((i) => ['failed', 'paused'].contains(i.status)).toList();

  Future<void> init() async {
    await _loadDownloads();
    _resumePollingIfNeeded();
  }

  Future<Directory> get _downloadDir async {
    final docs = await getApplicationDocumentsDirectory();
    final dir = Directory('${docs.path}/musicman_downloads');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  Future<File> getFileForTrack(String trackId) async {
    final clean = trackId.replaceAll(RegExp(r'^it_'), '');
    final dir = await _downloadDir;
    return File('${dir.path}/$clean.mp3');
  }

  Future<bool> isTrackDownloaded(String trackId) async {
    final file = await getFileForTrack(trackId);
    return await file.exists();
  }

  Future<void> _loadDownloads() async {
    final dir = await _downloadDir;
    final jsonFile = File('${dir.path}/downloads.json');
    if (await jsonFile.exists()) {
      try {
        final content = await jsonFile.readAsString();
        final list = jsonDecode(content) as List;
        _downloads.clear();
        _downloads.addAll(list.map((e) {
          final item = DownloadItem.fromJson(e as Map<String, dynamic>);
          if (item.status == 'saving') {
            return item.copyWith(status: 'paused', percent: 0, error: 'Interrupted');
          }
          return item;
        }));
      } catch (_) {}
    }
  }

  Future<void> _persist() async {
    final dir = await _downloadDir;
    final jsonFile = File('${dir.path}/downloads.json');
    await jsonFile.writeAsString(jsonEncode(_downloads.map((e) => e.toJson()).toList()));
    notifyListeners();
  }

  DownloadItem? getItem(String trackId) {
    final clean = trackId.replaceAll(RegExp(r'^it_'), '');
    final idx = _downloads.indexWhere((i) => i.trackId == clean || i.trackId == trackId);
    return idx != -1 ? _downloads[idx] : null;
  }

  Future<void> addDownload(MusicItem track, {String quality = '320'}) async {
    final id = track.id;
    if (await isTrackDownloaded(id)) return;

    final existing = getItem(id);
    if (existing != null && ['queued', 'crawling', 'saving'].contains(existing.status)) {
      return;
    }

    final item = DownloadItem(
      trackId: id,
      name: track.trackName ?? 'Track',
      artist: track.artistName ?? '',
      artistId: track.artistId ?? '',
      album: track.collectionName ?? '',
      collectionId: track.collectionId ?? '',
      artwork: track.getArtwork(100),
      status: 'queued',
      percent: 0,
      addedAt: DateTime.now().millisecondsSinceEpoch,
    );

    _upsert(item);

    if (track.hasAudio) {
      _updateStatus(id, status: 'saving', percent: 0);
      _runDirectSave(track).catchError((e) {
        _updateStatus(id, status: 'failed', error: e.toString());
      });
      return;
    }

    try {
      await ApiService.addQueue({'trackId': id}, quality);
    } catch (_) {}

    _updateStatus(id, status: 'queued', percent: 0);
    _ensurePolling();
  }

  Future<void> retryDownload(String trackId) async {
    final item = getItem(trackId);
    if (item == null) return;

    _updateStatus(trackId, status: 'queued', error: '', percent: 0);

    try {
      final res = await ApiService.lookup(trackId, 'song');
      final track = res.firstWhere((x) => x.itemType == 'track', orElse: () => res.first);

      if (track.hasAudio) {
        _updateStatus(trackId, status: 'saving');
        _runDirectSave(track).catchError((e) {
          _updateStatus(trackId, status: 'failed', error: e.toString());
        });
        return;
      }
    } catch (_) {}

    try {
      await ApiService.addQueue({'trackId': trackId});
    } catch (_) {}

    _ensurePolling();
  }

  Future<void> removeDownload(String trackId) async {
    final clean = trackId.replaceAll(RegExp(r'^it_'), '');
    _downloads.removeWhere((i) => i.trackId == clean || i.trackId == trackId);
    final file = await getFileForTrack(clean);
    if (await file.exists()) {
      await file.delete();
    }
    await _persist();
  }

  Future<void> clearAllDownloads() async {
    _downloads.clear();
    final dir = await _downloadDir;
    if (await dir.exists()) {
      await dir.delete(recursive: true);
    }
    await _persist();
  }

  void _upsert(DownloadItem item) {
    final idx = _downloads.indexWhere((i) => i.trackId == item.trackId);
    if (idx != -1) {
      _downloads[idx] = item;
    } else {
      _downloads.insert(0, item);
    }
    _persist();
  }

  void _updateStatus(
    String trackId, {
    String? status,
    int? percent,
    String? error,
    int? bytes,
    int? totalBytes,
  }) {
    final idx = _downloads.indexWhere((i) => i.trackId == trackId);
    if (idx == -1) return;
    _downloads[idx] = _downloads[idx].copyWith(
      status: status,
      percent: percent,
      error: error,
      bytes: bytes,
      totalBytes: totalBytes,
    );
    _persist();
  }

  Future<void> _runDirectSave(MusicItem track) async {
    final id = track.id;
    if (_savingIds.contains(id)) return;
    _savingIds.add(id);

    final playableUrl = track.getPlayableUrl();
    if (playableUrl == null) {
      _savingIds.remove(id);
      _updateStatus(id, status: 'failed', error: 'No audio URL available');
      return;
    }

    try {
      final proxied = ApiService.proxyUrl(playableUrl);
      final request = http.Request('GET', Uri.parse(proxied));
      final response = await http.Client().send(request);

      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}');
      }

      final total = response.contentLength ?? 0;
      final file = await getFileForTrack(id);
      final sink = file.openWrite();

      int received = 0;
      await response.stream.forEach((chunk) {
        sink.add(chunk);
        received += chunk.length;
        final pct = total > 0 ? ((received / total) * 100).clamp(0, 99).toInt() : 0;
        _updateStatus(id, percent: pct, bytes: received, totalBytes: total);
      });

      await sink.close();
      _updateStatus(id, status: 'completed', percent: 100, bytes: received, totalBytes: total);
    } catch (e) {
      _updateStatus(id, status: 'failed', error: e.toString());
    } finally {
      _savingIds.remove(id);
    }
  }

  void _ensurePolling() {
    if (_pollingTimer != null) return;
    _pollingTimer = Timer.periodic(const Duration(milliseconds: 2500), (_) async {
      final pending = _downloads.where((i) => ['queued', 'crawling'].contains(i.status)).toList();
      if (pending.isEmpty) {
        _pollingTimer?.cancel();
        _pollingTimer = null;
        return;
      }

      for (final item in pending) {
        final status = await ApiService.crawlStatus(item.trackId);
        final s = status['download_status']?.toString();
        final pct = (status['percent'] as num?)?.toInt() ?? 0;

        if (s == 'completed' || status['found'] == false) {
          try {
            final res = await ApiService.lookup(item.trackId, 'song');
            final fresh = res.firstWhere((x) => x.itemType == 'track', orElse: () => res.first);
            if (fresh.hasAudio) {
              _updateStatus(item.trackId, status: 'saving', percent: 0);
              await _runDirectSave(fresh);
            }
          } catch (_) {
            _updateStatus(item.trackId, status: 'crawling', percent: 100);
          }
        } else if (s == 'failed' || s == 'stopped') {
          _updateStatus(item.trackId, status: 'failed', error: status['error']?.toString() ?? 'Failed');
        } else {
          _updateStatus(item.trackId, status: 'crawling', percent: pct);
        }
      }
    });
  }

  void _resumePollingIfNeeded() {
    if (_downloads.any((i) => ['queued', 'crawling'].contains(i.status))) {
      _ensurePolling();
    }
  }
}

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import '../models/music_item.dart';
import 'api_service.dart';
import 'download_manager.dart';
import 'storage_service.dart';

enum RepeatMode { off, all, one }

class AudioPlayerService extends ChangeNotifier {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;
  AudioPlayerService._internal() {
    _init();
  }

  final AudioPlayer _player = AudioPlayer();
  final DownloadManager _downloadManager = DownloadManager();

  MusicItem? _currentTrack;
  List<MusicItem> _queue = [];
  int _currentIndex = -1;
  bool _isShuffle = false;
  RepeatMode _repeatMode = RepeatMode.off;
  Timer? _sleepTimer;
  DateTime? _sleepTimerEndTime;

  MusicItem? get currentTrack => _currentTrack;
  List<MusicItem> get queue => List.unmodifiable(_queue);
  int get currentIndex => _currentIndex;
  bool get isPlaying => _player.playing;
  bool get isShuffle => _isShuffle;
  RepeatMode get repeatMode => _repeatMode;
  DateTime? get sleepTimerEndTime => _sleepTimerEndTime;

  Duration get position => _player.position;
  Duration get duration => _player.duration ?? Duration.zero;
  Stream<Duration> get positionStream => _player.positionStream;
  Stream<Duration?> get durationStream => _player.durationStream;
  Stream<PlayerState> get playerStateStream => _player.playerStateStream;

  void _init() {
    _player.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        _onTrackEnded();
      }
      notifyListeners();
    });

    _player.positionStream.listen((_) {
      notifyListeners();
    });
  }

  Future<void> playItem(MusicItem item, {List<MusicItem>? newQueue, int? initialIndex}) async {
    _currentTrack = item;
    if (newQueue != null && newQueue.isNotEmpty) {
      _queue = List.from(newQueue);
      _currentIndex = initialIndex ?? _queue.indexWhere((e) => e.id == item.id);
      if (_currentIndex < 0) _currentIndex = 0;
    } else {
      final existingIdx = _queue.indexWhere((e) => e.id == item.id);
      if (existingIdx >= 0) {
        _currentIndex = existingIdx;
      } else {
        _queue.add(item);
        _currentIndex = _queue.length - 1;
      }
    }

    StorageService.addRecentlyPlayed(item);
    notifyListeners();

    // Check offline cached
    final offlinePath = await _downloadManager.getOfflineFilePath(item.id);
    if (offlinePath != null) {
      try {
        await _player.setFilePath(offlinePath);
        final settings = StorageService.getSettings();
        await _player.setSpeed(settings.playbackRate);
        await _player.play();
        return;
      } catch (_) {}
    }

    // Direct / proxy URL playback
    String? rawUrl = item.getPlayableUrl();
    if (rawUrl == null || rawUrl.isEmpty) {
      // Lookup fresh
      try {
        final fresh = await ApiService.lookup(item.id, 'song');
        final freshTrack = fresh.firstWhere((e) => e.type == 'track', orElse: () => MusicItem());
        if (freshTrack.id.isNotEmpty) {
          rawUrl = freshTrack.getPlayableUrl();
          _currentTrack = freshTrack;
        }
      } catch (_) {}
    }

    if (rawUrl == null || rawUrl.isEmpty) {
      notifyListeners();
      return;
    }

    try {
      final proxied = ApiService.proxyUrl(rawUrl);
      await _player.setUrl(proxied);
      final settings = StorageService.getSettings();
      await _player.setSpeed(settings.playbackRate);
      await _player.play();
    } catch (e) {
      debugPrint('Error playing track: $e');
    }
  }

  Future<void> togglePlay() async {
    if (_player.playing) {
      await _player.pause();
    } else {
      if (_currentTrack != null) {
        await _player.play();
      } else if (_queue.isNotEmpty) {
        playItem(_queue[0]);
      }
    }
    notifyListeners();
  }

  Future<void> seek(Duration pos) async {
    await _player.seek(pos);
  }

  Future<void> setVolume(double vol) async {
    await _player.setVolume(vol.clamp(0.0, 1.0));
    notifyListeners();
  }

  Future<void> setPlaybackRate(double rate) async {
    await _player.setSpeed(rate.clamp(0.5, 2.0));
    notifyListeners();
  }

  void _onTrackEnded() {
    if (_repeatMode == RepeatMode.one) {
      _player.seek(Duration.zero);
      _player.play();
      return;
    }
    nextTrack(userInitiated: false);
  }

  void nextTrack({bool userInitiated = true}) {
    if (_queue.isEmpty) return;

    if (_repeatMode == RepeatMode.one && !userInitiated) {
      _player.seek(Duration.zero);
      _player.play();
      return;
    }

    int nextIdx;
    if (_isShuffle && _queue.length > 1) {
      do {
        nextIdx = (DateTime.now().millisecondsSinceEpoch % _queue.length);
      } while (nextIdx == _currentIndex);
    } else {
      nextIdx = _currentIndex + 1;
      if (nextIdx >= _queue.length) {
        if (_repeatMode == RepeatMode.all) {
          nextIdx = 0;
        } else {
          _player.pause();
          _player.seek(Duration.zero);
          notifyListeners();
          return;
        }
      }
    }

    _currentIndex = nextIdx;
    playItem(_queue[_currentIndex]);
  }

  void prevTrack() {
    if (position.inSeconds > 3) {
      seek(Duration.zero);
      return;
    }
    if (_queue.isEmpty) return;

    int prevIdx = _currentIndex - 1;
    if (prevIdx < 0) {
      prevIdx = _repeatMode == RepeatMode.all ? _queue.length - 1 : 0;
    }

    _currentIndex = prevIdx;
    playItem(_queue[_currentIndex]);
  }

  void toggleShuffle() {
    _isShuffle = !_isShuffle;
    notifyListeners();
  }

  void cycleRepeatMode() {
    switch (_repeatMode) {
      case RepeatMode.off:
        _repeatMode = RepeatMode.all;
        break;
      case RepeatMode.all:
        _repeatMode = RepeatMode.one;
        break;
      case RepeatMode.one:
        _repeatMode = RepeatMode.off;
        break;
    }
    notifyListeners();
  }

  void addToQueue(MusicItem item) {
    if (!_queue.any((e) => e.id == item.id)) {
      _queue.add(item);
      if (_currentIndex < 0) _currentIndex = 0;
      notifyListeners();
    }
  }

  void addAllToQueue(List<MusicItem> items) {
    int added = 0;
    for (final item in items) {
      if (!_queue.any((e) => e.id == item.id)) {
        _queue.add(item);
        added++;
      }
    }
    if (_currentIndex < 0 && _queue.isNotEmpty) _currentIndex = 0;
    if (added > 0) notifyListeners();
  }

  void removeFromQueue(int index) {
    if (index < 0 || index >= _queue.length) return;
    _queue.removeAt(index);
    if (index < _currentIndex) {
      _currentIndex--;
    } else if (index == _currentIndex) {
      if (_queue.isNotEmpty) {
        _currentIndex = _currentIndex.clamp(0, _queue.length - 1);
        playItem(_queue[_currentIndex]);
      } else {
        _currentIndex = -1;
        _currentTrack = null;
        _player.stop();
      }
    }
    notifyListeners();
  }

  void reorderQueue(int oldIndex, int newIndex) {
    if (oldIndex < newIndex) {
      newIndex -= 1;
    }
    final item = _queue.removeAt(oldIndex);
    _queue.insert(newIndex, item);

    if (_currentIndex == oldIndex) {
      _currentIndex = newIndex;
    } else if (oldIndex < _currentIndex && newIndex >= _currentIndex) {
      _currentIndex--;
    } else if (oldIndex > _currentIndex && newIndex <= _currentIndex) {
      _currentIndex++;
    }
    notifyListeners();
  }

  void clearQueue() {
    _queue.clear();
    _currentIndex = -1;
    if (_currentTrack != null) {
      _queue.add(_currentTrack!);
      _currentIndex = 0;
    }
    notifyListeners();
  }

  void setSleepTimer(int minutes) {
    _sleepTimer?.cancel();
    if (minutes <= 0) {
      _sleepTimerEndTime = null;
      notifyListeners();
      return;
    }

    _sleepTimerEndTime = DateTime.now().add(Duration(minutes: minutes));
    _sleepTimer = Timer(Duration(minutes: minutes), () {
      _player.pause();
      _sleepTimerEndTime = null;
      notifyListeners();
    });
    notifyListeners();
  }

  @override
  void dispose() {
    _sleepTimer?.cancel();
    _player.dispose();
    super.dispose();
  }
}

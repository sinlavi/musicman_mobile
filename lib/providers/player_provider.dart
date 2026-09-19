import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import '../models/lyrics.dart';
import '../models/music_item.dart';
import '../services/api_service.dart';
import '../services/download_service.dart';
import '../services/storage_service.dart';

enum RepeatMode { off, all, one }

class PlayerProvider extends ChangeNotifier {
  final AudioPlayer _player = AudioPlayer();
  final StorageService storageService;
  final DownloadService downloadService;

  MusicItem? _currentTrack;
  List<MusicItem> _queue = [];
  int _queueIndex = -1;
  bool _isPlaying = false;
  bool _isShuffle = false;
  RepeatMode _repeatMode = RepeatMode.off;

  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  LyricsData? _lyricsData;
  int _activeLyricIndex = -1;

  Timer? _sleepTimer;
  int? _sleepTimerMinutes;

  String _equalizerPreset = 'Normal';

  PlayerProvider({
    required this.storageService,
    required this.downloadService,
  }) {
    _initAudioListeners();
  }

  MusicItem? get currentTrack => _currentTrack;
  List<MusicItem> get queue => List.unmodifiable(_queue);
  int get queueIndex => _queueIndex;
  bool get isPlaying => _isPlaying;
  bool get isShuffle => _isShuffle;
  RepeatMode get repeatMode => _repeatMode;
  Duration get position => _position;
  Duration get duration => _duration;
  LyricsData? get lyricsData => _lyricsData;
  int get activeLyricIndex => _activeLyricIndex;
  int? get sleepTimerMinutes => _sleepTimerMinutes;
  String get equalizerPreset => _equalizerPreset;

  void _initAudioListeners() {
    _player.onPlayerStateChanged.listen((state) {
      _isPlaying = state == PlayerState.playing;
      notifyListeners();
    });

    _player.onPositionChanged.listen((pos) {
      _position = pos;
      _updateActiveLyric();
      notifyListeners();
    });

    _player.onDurationChanged.listen((dur) {
      _duration = dur;
      notifyListeners();
    });

    _player.onPlayerComplete.listen((_) {
      _onTrackEnded();
    });
  }

  void _updateActiveLyric() {
    if (_lyricsData == null || _lyricsData!.lines.isEmpty || !_lyricsData!.synced) {
      if (_activeLyricIndex != -1) {
        _activeLyricIndex = -1;
        notifyListeners();
      }
      return;
    }

    final curSec = _position.inMilliseconds / 1000.0;
    int newIndex = -1;
    for (int i = 0; i < _lyricsData!.lines.length; i++) {
      final t = _lyricsData!.lines[i].time;
      if (t != null && t <= curSec + 0.1) {
        newIndex = i;
      } else if (t != null && t > curSec) {
        break;
      }
    }

    if (newIndex != _activeLyricIndex) {
      _activeLyricIndex = newIndex;
      notifyListeners();
    }
  }

  Future<void> playItem(MusicItem item, {List<MusicItem>? sourceQueue}) async {
    _currentTrack = item;
    storageService.addRecentlyPlayed(item);

    if (sourceQueue != null && sourceQueue.isNotEmpty) {
      _queue = List.from(sourceQueue);
      _queueIndex = _queue.indexWhere((t) => t.id == item.id);
      if (_queueIndex == -1) {
        _queue.insert(0, item);
        _queueIndex = 0;
      }
    } else if (_queue.isEmpty || !_queue.any((t) => t.id == item.id)) {
      _queue.add(item);
      _queueIndex = _queue.length - 1;
    } else {
      _queueIndex = _queue.indexWhere((t) => t.id == item.id);
    }

    notifyListeners();

    // Load Lyrics
    _loadLyrics(item);

    final isOffline = await downloadService.isTrackDownloaded(item.id);
    if (isOffline) {
      final file = await downloadService.getFileForTrack(item.id);
      await _player.stop();
      await _player.play(DeviceFileSource(file.path));
    } else {
      final playableUrl = item.getPlayableUrl();
      if (playableUrl != null) {
        await _player.stop();
        await _player.play(UrlSource(ApiService.proxyUrl(playableUrl)));
      }
    }

    await setPlaybackRate(storageService.playbackRate);
  }

  Future<void> playList(List<MusicItem> items, {int initialIndex = 0}) async {
    if (items.isEmpty) return;
    final startIndex = initialIndex.clamp(0, items.length - 1);
    await playItem(items[startIndex], sourceQueue: items);
  }

  Future<void> togglePlay() async {
    if (_currentTrack == null) {
      if (_queue.isNotEmpty) {
        await playItem(_queue[0]);
      }
      return;
    }
    if (_isPlaying) {
      await _player.pause();
    } else {
      await _player.resume();
    }
  }

  Future<void> seek(Duration pos) async {
    await _player.seek(pos);
  }

  Future<void> nextTrack({bool userInitiated = true}) async {
    if (_queue.isEmpty) return;

    if (_repeatMode == RepeatMode.one && !userInitiated) {
      await _player.seek(Duration.zero);
      await _player.resume();
      return;
    }

    int nextIndex;
    if (_isShuffle && _queue.length > 1) {
      final available = List<int>.generate(_queue.length, (i) => i)..remove(_queueIndex);
      nextIndex = (available..shuffle()).first;
    } else {
      nextIndex = _queueIndex + 1;
      if (nextIndex >= _queue.length) {
        if (_repeatMode == RepeatMode.all) {
          nextIndex = 0;
        } else {
          await _player.stop();
          _isPlaying = false;
          notifyListeners();
          return;
        }
      }
    }

    _queueIndex = nextIndex;
    await playItem(_queue[_queueIndex]);
  }

  Future<void> previousTrack() async {
    if (_position.inSeconds > 3) {
      await seek(Duration.zero);
      return;
    }
    if (_queue.isEmpty) return;

    int prevIndex = _queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = _repeatMode == RepeatMode.all ? _queue.length - 1 : 0;
    }
    _queueIndex = prevIndex;
    await playItem(_queue[_queueIndex]);
  }

  void _onTrackEnded() {
    nextTrack(userInitiated: false);
  }

  void toggleShuffle() {
    _isShuffle = !_isShuffle;
    notifyListeners();
  }

  void cycleRepeatMode() {
    if (_repeatMode == RepeatMode.off) {
      _repeatMode = RepeatMode.all;
    } else if (_repeatMode == RepeatMode.all) {
      _repeatMode = RepeatMode.one;
    } else {
      _repeatMode = RepeatMode.off;
    }
    notifyListeners();
  }

  Future<void> setPlaybackRate(double rate) async {
    await _player.setPlaybackRate(rate);
    await storageService.updateSetting('playbackRate', rate);
    notifyListeners();
  }

  void setEqualizerPreset(String preset) {
    _equalizerPreset = preset;
    storageService.updateSetting('equalizerPreset', preset);
    notifyListeners();
  }

  void setSleepTimer(int? minutes) {
    _sleepTimer?.cancel();
    _sleepTimerMinutes = minutes;

    if (minutes != null && minutes > 0) {
      _sleepTimer = Timer(Duration(minutes: minutes), () {
        _player.pause();
        _sleepTimerMinutes = null;
        notifyListeners();
      });
    } else {
      _sleepTimerMinutes = null;
    }
    notifyListeners();
  }

  void addToQueue(List<MusicItem> items) {
    for (final item in items) {
      if (!_queue.any((t) => t.id == item.id)) {
        _queue.add(item);
      }
    }
    if (_queueIndex == -1 && _queue.isNotEmpty) {
      _queueIndex = 0;
    }
    notifyListeners();
  }

  void removeFromQueue(int index) {
    if (index < 0 || index >= _queue.length) return;
    _queue.removeAt(index);
    if (index < _queueIndex) {
      _queueIndex--;
    } else if (index == _queueIndex) {
      _queueIndex = _queueIndex.clamp(0, _queue.isNotEmpty ? _queue.length - 1 : -1);
      if (_queue.isNotEmpty) {
        playItem(_queue[_queueIndex]);
      } else {
        _currentTrack = null;
        _player.stop();
      }
    }
    notifyListeners();
  }

  void clearQueue() {
    _queue.clear();
    _queueIndex = -1;
    notifyListeners();
  }

  void reorderQueue(int oldIndex, int newIndex) {
    if (oldIndex < newIndex) {
      newIndex -= 1;
    }
    final item = _queue.removeAt(oldIndex);
    _queue.insert(newIndex, item);

    if (_queueIndex == oldIndex) {
      _queueIndex = newIndex;
    } else if (oldIndex < _queueIndex && newIndex >= _queueIndex) {
      _queueIndex--;
    } else if (oldIndex > _queueIndex && newIndex <= _queueIndex) {
      _queueIndex++;
    }
    notifyListeners();
  }

  Future<void> _loadLyrics(MusicItem item) async {
    _lyricsData = null;
    _activeLyricIndex = -1;
    notifyListeners();

    if (item.lyrics != null) {
      _lyricsData = LyricsData.parse(item.lyrics);
      notifyListeners();
      return;
    }

    try {
      final res = await ApiService.lookup(item.id, 'song');
      final fresh = res.firstWhere((x) => x.itemType == 'track', orElse: () => res.first);
      if (fresh.lyrics != null) {
        _lyricsData = LyricsData.parse(fresh.lyrics);
        notifyListeners();
      }
    } catch (_) {}
  }
}

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import '../models/music_item.dart';
import '../services/api_service.dart';
import '../services/audio_player_service.dart' hide RepeatMode;
import '../services/audio_player_service.dart' as audio_svc show RepeatMode;
import '../services/download_manager.dart';
import '../services/lyrics_service.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import 'common_widgets.dart';

class MiniPlayer extends StatelessWidget {
  final VoidCallback onTap;

  const MiniPlayer({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final audioService = AudioPlayerService();

    return ListenableBuilder(
      listenable: audioService,
      builder: (context, _) {
        final track = audioService.currentTrack;
        if (track == null) return const SizedBox.shrink();

        return StreamBuilder<Duration>(
          stream: audioService.positionStream,
          builder: (context, snapshot) {
            final position = snapshot.data ?? Duration.zero;
            final duration = audioService.duration;
            final progress = (duration.inMilliseconds > 0)
                ? (position.inMilliseconds / duration.inMilliseconds).clamp(0.0, 1.0)
                : 0.0;

            return GestureDetector(
              onTap: onTap,
              child: Container(
                color: AppTheme.surface,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Progress bar
                    LinearProgressIndicator(
                      value: progress,
                      minHeight: 2,
                      backgroundColor: Colors.white10,
                      valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primaryGradientStart),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      child: Row(
                        children: [
                          ArtworkImage(
                            url: track.getArtwork(preferPx: 100),
                            size: 44,
                            borderRadius: 10,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  track.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                                Text(
                                  track.artistName ?? '',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () => audioService.togglePlay(),
                            icon: Icon(
                              audioService.isPlaying ? Icons.pause : Icons.play_arrow,
                              size: 28,
                            ),
                          ),
                          IconButton(
                            onPressed: () => audioService.nextTrack(),
                            icon: const Icon(Icons.skip_next, size: 28),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class FullPlayerSheet extends StatefulWidget {
  const FullPlayerSheet({super.key});

  @override
  State<FullPlayerSheet> createState() => _FullPlayerSheetState();
}

class _FullPlayerSheetState extends State<FullPlayerSheet> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final AudioPlayerService _audioService = AudioPlayerService();
  final DownloadManager _downloadManager = DownloadManager();

  ParsedLyrics? _parsedLyrics;
  bool _isLoadingLyrics = false;
  String _lyricsTrackId = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (_tabController.index == 2 && _parsedLyrics == null) {
        _loadLyrics();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _loadLyrics() async {
    final track = _audioService.currentTrack;
    if (track == null) return;
    if (_lyricsTrackId == track.id && _parsedLyrics != null) return;

    setState(() {
      _isLoadingLyrics = true;
      _lyricsTrackId = track.id;
    });

    dynamic rawLyrics = track.effectiveLyrics;
    if (rawLyrics == null) {
      try {
        final fresh = await ApiService.lookup(track.id, 'song');
        final freshTrack = fresh.firstWhere((e) => e.type == 'track', orElse: () => MusicItem());
        rawLyrics = freshTrack.effectiveLyrics;
      } catch (_) {}
    }

    if (mounted) {
      setState(() {
        _parsedLyrics = LyricsParser.parse(rawLyrics);
        _isLoadingLyrics = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _audioService,
      builder: (context, _) {
        final track = _audioService.currentTrack;
        if (track == null) {
          return const Scaffold(
            backgroundColor: AppTheme.background,
            body: Center(child: Text('Nothing playing')),
          );
        }

        return Scaffold(
          backgroundColor: AppTheme.background,
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(Icons.keyboard_arrow_down, size: 30),
              onPressed: () => Navigator.of(context).pop(),
            ),
            title: Container(
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white10,
                borderRadius: BorderRadius.circular(10),
              ),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(
                  color: AppTheme.primaryGradientStart,
                  borderRadius: BorderRadius.circular(10),
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                labelColor: Colors.white,
                unselectedLabelColor: AppTheme.textSecondary,
                tabs: [
                  const Tab(text: 'Playing'),
                  Tab(text: 'Queue (${_audioService.queue.length})'),
                  const Tab(text: 'Lyrics'),
                ],
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.more_horiz),
                onPressed: () => _showTrackOptionsModal(context, track),
              ),
            ],
          ),
          body: TabBarView(
            controller: _tabController,
            children: [
              _buildNowPlayingTab(track),
              _buildQueueTab(),
              _buildLyricsTab(track),
            ],
          ),
        );
      },
    );
  }

  Widget _buildNowPlayingTab(MusicItem track) {
    final isLiked = StorageService.isLiked(track.id);

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        children: [
          const SizedBox(height: 16),
          // Artwork
          ArtworkImage(
            url: track.getArtwork(preferPx: 600),
            size: MediaQuery.of(context).size.width - 64,
            borderRadius: 20,
            placeholderIcon: Icons.music_note,
          ),
          const SizedBox(height: 24),

          // Title & Artist
          Text(
            track.name,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            track.artistName ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 24),

          // Seek Slider & Times
          StreamBuilder<Duration>(
            stream: _audioService.positionStream,
            builder: (context, snapshot) {
              final position = snapshot.data ?? Duration.zero;
              final duration = _audioService.duration;
              final maxMs = duration.inMilliseconds > 0 ? duration.inMilliseconds.toDouble() : 1.0;
              final posMs = position.inMilliseconds.toDouble().clamp(0.0, maxMs);

              return Column(
                children: [
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                      overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
                      activeTrackColor: AppTheme.primaryGradientStart,
                      inactiveTrackColor: Colors.white10,
                      thumbColor: Colors.white,
                    ),
                    child: Slider(
                      value: posMs,
                      max: maxMs,
                      onChanged: (val) {
                        _audioService.seek(Duration(milliseconds: val.toInt()));
                      },
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_formatDuration(position), style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                        Text(_formatDuration(duration), style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 16),

          // Playback Controls
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              IconButton(
                icon: Icon(
                  Icons.shuffle,
                  color: _audioService.isShuffle ? AppTheme.primaryGradientStart : AppTheme.textSecondary,
                ),
                onPressed: () => _audioService.toggleShuffle(),
              ),
              IconButton(
                icon: const Icon(Icons.skip_previous, size: 36),
                onPressed: () => _audioService.prevTrack(),
              ),
              GestureDetector(
                onTap: () => _audioService.togglePlay(),
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppTheme.primaryGradient,
                  ),
                  child: Icon(
                    _audioService.isPlaying ? Icons.pause : Icons.play_arrow,
                    size: 36,
                    color: Colors.white,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.skip_next, size: 36),
                onPressed: () => _audioService.nextTrack(),
              ),
              IconButton(
                icon: Icon(
                  _audioService.repeatMode == audio_svc.RepeatMode.one
                      ? Icons.repeat_one
                      : Icons.repeat,
                  color: _audioService.repeatMode != audio_svc.RepeatMode.off ? AppTheme.primaryGradientStart : AppTheme.textSecondary,
                ),
                onPressed: () => _audioService.cycleRepeatMode(),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Action buttons: Like, Download, Playlist, Sleep Timer
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              IconButton(
                icon: Icon(
                  isLiked ? Icons.favorite : Icons.favorite_border,
                  color: isLiked ? Colors.red : Colors.white,
                ),
                onPressed: () async {
                  await StorageService.toggleLike(track);
                  setState(() {});
                },
              ),
              FutureBuilder<bool>(
                future: _downloadManager.isOfflineCached(track.id),
                builder: (context, snapshot) {
                  final isCached = snapshot.data ?? false;
                  return IconButton(
                    icon: Icon(
                      isCached ? Icons.cloud_done : Icons.cloud_download,
                      color: isCached ? Colors.green : Colors.white,
                    ),
                    onPressed: () async {
                      if (!isCached) {
                        await _downloadManager.addDownload(track);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Download started')),
                          );
                        }
                      }
                    },
                  );
                },
              ),
              IconButton(
                icon: const Icon(Icons.playlist_add),
                onPressed: () => _showPlaylistPickerModal(context, track),
              ),
              IconButton(
                icon: Icon(
                  Icons.bedtime,
                  color: _audioService.sleepTimerEndTime != null ? AppTheme.primaryGradientStart : Colors.white,
                ),
                onPressed: () => _showSleepTimerModal(context),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQueueTab() {
    final queue = _audioService.queue;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Now playing · ${queue.length}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
              Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.shuffle, size: 20),
                    onPressed: () => _audioService.toggleShuffle(),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20),
                    onPressed: () => _audioService.clearQueue(),
                  ),
                ],
              ),
            ],
          ),
        ),
        Expanded(
          child: ReorderableListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 4),
            itemCount: queue.length,
            onReorder: (oldIndex, newIndex) {
              _audioService.reorderQueue(oldIndex, newIndex);
            },
            itemBuilder: (context, index) {
              final item = queue[index];
              final isCurrent = index == _audioService.currentIndex;

              return ListTile(
                key: ValueKey('${item.id}_$index'),
                selected: isCurrent,
                selectedTileColor: AppTheme.primaryGradientStart.withValues(alpha: 0.12),
                leading: ArtworkImage(url: item.getArtwork(preferPx: 100), size: 40),
                title: Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: isCurrent ? AppTheme.primaryGradientStart : Colors.white, fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal)),
                subtitle: Text(item.artistName ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isCurrent)
                      const Icon(Icons.graphic_eq, color: AppTheme.primaryGradientStart),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => _audioService.removeFromQueue(index),
                    ),
                  ],
                ),
                onTap: () => _audioService.playItem(item),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildLyricsTab(MusicItem track) {
    if (_isLoadingLyrics) {
      return const Center(child: CircularProgressIndicator());
    }

    final lyrics = _parsedLyrics;
    if (lyrics == null || lyrics.lines.isEmpty) {
      return const Center(
        child: Text(
          'No lyrics available for this track',
          style: TextStyle(color: AppTheme.textSecondary),
        ),
      );
    }

    return StreamBuilder<Duration>(
      stream: _audioService.positionStream,
      builder: (context, snapshot) {
        final currentSec = (snapshot.data ?? Duration.zero).inMilliseconds / 1000.0;

        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          itemCount: lyrics.lines.length,
          itemBuilder: (context, index) {
            final line = lyrics.lines[index];
            bool isActive = false;

            if (lyrics.isSynced && line.time != null) {
              final nextTime = (index + 1 < lyrics.lines.length)
                  ? lyrics.lines[index + 1].time
                  : double.infinity;
              if (currentSec >= line.time! && currentSec < (nextTime ?? double.infinity)) {
                isActive = true;
              }
            }

            return Container(
              margin: const EdgeInsets.symmetric(vertical: 4),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                border: Border(
                  left: BorderSide(
                    color: isActive ? AppTheme.primaryGradientStart : Colors.transparent,
                    width: 3,
                  ),
                ),
                color: isActive ? AppTheme.primaryGradientStart.withValues(alpha: 0.12) : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
              ),
              child: GestureDetector(
                onTap: () {
                  if (line.time != null) {
                    _audioService.seek(Duration(milliseconds: (line.time! * 1000).toInt()));
                  }
                },
                child: Text(
                  line.text.isEmpty ? '♪' : line.text,
                  style: TextStyle(
                    fontSize: isActive ? 17 : 14,
                    fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                    color: isActive ? Colors.white : Colors.white60,
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showTrackOptionsModal(BuildContext context, MusicItem track) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.share),
                title: const Text('Share Track'),
                onTap: () {
                  Navigator.pop(context);
                  SharePlus.instance.share(
                    ShareParams(text: 'Check out ${track.name} by ${track.artistName ?? "MusicMan"}!'),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.playlist_add),
                title: const Text('Add to Playlist'),
                onTap: () {
                  Navigator.pop(context);
                  _showPlaylistPickerModal(context, track);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showPlaylistPickerModal(BuildContext context, MusicItem track) {
    final playlists = StorageService.getPlaylists();

    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Add to Playlist', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
              if (playlists.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('No playlists created yet.', style: TextStyle(color: AppTheme.textSecondary)),
                ),
              ...playlists.map((pl) => ListTile(
                    leading: const Icon(Icons.queue_music),
                    title: Text(pl.name),
                    subtitle: Text('${pl.tracks.length} tracks'),
                    onTap: () async {
                      if (!pl.tracks.any((e) => e.id == track.id)) {
                        pl.tracks.add(track);
                        await StorageService.savePlaylists(playlists);
                      }
                      if (context.mounted) {
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Added to ${pl.name}')),
                        );
                      }
                    },
                  )),
              ListTile(
                leading: const Icon(Icons.add, color: AppTheme.primaryGradientStart),
                title: const Text('Create New Playlist', style: TextStyle(color: AppTheme.primaryGradientStart)),
                onTap: () {
                  Navigator.pop(context);
                  _showNewPlaylistDialog(context, track);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showNewPlaylistDialog(BuildContext context, MusicItem track) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('New Playlist'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'Playlist Name'),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              if (controller.text.trim().isNotEmpty) {
                final pl = await StorageService.createPlaylist(controller.text.trim());
                pl.tracks.add(track);
                final all = StorageService.getPlaylists();
                await StorageService.savePlaylists(all);
                if (context.mounted) Navigator.pop(context);
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  void _showSleepTimerModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Sleep Timer', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
              ListTile(
                leading: const Icon(Icons.timer),
                title: const Text('15 Minutes'),
                onTap: () {
                  _audioService.setSleepTimer(15);
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Icon(Icons.timer),
                title: const Text('30 Minutes'),
                onTap: () {
                  _audioService.setSleepTimer(30);
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Icon(Icons.timer),
                title: const Text('60 Minutes'),
                onTap: () {
                  _audioService.setSleepTimer(60);
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Icon(Icons.timer_off, color: Colors.red),
                title: const Text('Cancel Timer', style: TextStyle(color: Colors.red)),
                onTap: () {
                  _audioService.setSleepTimer(0);
                  Navigator.pop(context);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatDuration(Duration duration) {
    final m = duration.inMinutes;
    final s = duration.inSeconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }
}

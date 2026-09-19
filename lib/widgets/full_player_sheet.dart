import 'package:flutter/material.dart' hide RepeatMode;
import 'package:provider/provider.dart';
import '../models/music_item.dart';
import '../providers/player_provider.dart';
import '../services/download_service.dart';
import '../services/storage_service.dart';

class FullPlayerSheet extends StatefulWidget {
  const FullPlayerSheet({super.key});

  @override
  State<FullPlayerSheet> createState() => _FullPlayerSheetState();
}

class _FullPlayerSheetState extends State<FullPlayerSheet>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final storage = context.watch<StorageService>();
    final download = context.watch<DownloadService>();

    final track = player.currentTrack;
    if (track == null) return const SizedBox.shrink();

    final isLiked = storage.isLiked(track.id);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
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
              color: Theme.of(context).colorScheme.primary,
              borderRadius: BorderRadius.circular(8),
            ),
            indicatorSize: TabBarIndicatorSize.tab,
            dividerColor: Colors.transparent,
            labelPadding: EdgeInsets.zero,
            labelStyle:
                const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            unselectedLabelStyle: const TextStyle(fontSize: 12),
            tabs: [
              const Tab(text: 'Playing'),
              Tab(text: 'Queue (${player.queue.length})'),
              const Tab(text: 'Lyrics'),
            ],
          ),
        ),
        centerTitle: true,
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildPlayingTab(context, player, storage, download, track, isLiked),
          _buildQueueTab(context, player),
          _buildLyricsTab(context, player),
        ],
      ),
    );
  }

  Widget _buildPlayingTab(
    BuildContext context,
    PlayerProvider player,
    StorageService storage,
    DownloadService download,
    MusicItem track,
    bool isLiked,
  ) {
    final artwork = track.getArtwork(600);
    final pos = player.position;
    final dur = player.duration;
    final totalSec = dur.inSeconds > 0
        ? dur.inSeconds
        : (track.trackTimeMillis != null
            ? (track.trackTimeMillis! / 1000).round()
            : 1);

    final onSurfaceColor = Theme.of(context).colorScheme.onSurface;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          // Artwork
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: AspectRatio(
              aspectRatio: 1,
              child: artwork.isNotEmpty
                  ? Image.network(
                      artwork,
                      fit: BoxFit.cover,
                      errorBuilder: (ctx, err, stack) => _artPlaceholder(),
                    )
                  : _artPlaceholder(),
            ),
          ),

          // Title & Artist
          Column(
            children: [
              Text(
                track.trackName ?? 'Track',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Text(
                track.artistName ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: onSurfaceColor.withAlpha((0.7 * 255).round()),
                ),
              ),
            ],
          ),

          // Seek Bar
          Column(
            children: [
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  thumbShape:
                      const RoundSliderThumbShape(enabledThumbRadius: 6),
                  trackHeight: 3,
                ),
                child: Slider(
                  value: pos.inSeconds.toDouble().clamp(0.0, totalSec.toDouble()),
                  max: totalSec.toDouble(),
                  onChanged: (val) {
                    player.seek(Duration(seconds: val.round()));
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(_fmtTime(pos.inSeconds),
                        style: const TextStyle(fontSize: 11, color: Colors.white54)),
                    Text(_fmtTime(totalSec),
                        style: const TextStyle(fontSize: 11, color: Colors.white54)),
                  ],
                ),
              ),
            ],
          ),

          // Controls
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              IconButton(
                icon: Icon(
                  Icons.shuffle,
                  color: player.isShuffle
                      ? Theme.of(context).colorScheme.primary
                      : Colors.white54,
                ),
                onPressed: () => player.toggleShuffle(),
              ),
              IconButton(
                icon: const Icon(Icons.skip_previous, size: 36),
                onPressed: () => player.previousTrack(),
              ),
              FloatingActionButton(
                shape: const CircleBorder(),
                elevation: 4,
                onPressed: () => player.togglePlay(),
                child: Icon(
                  player.isPlaying ? Icons.pause : Icons.play_arrow,
                  size: 36,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.skip_next, size: 36),
                onPressed: () => player.nextTrack(),
              ),
              IconButton(
                icon: Icon(
                  player.repeatMode == RepeatMode.one
                      ? Icons.repeat_one
                      : Icons.repeat,
                  color: player.repeatMode != RepeatMode.off
                      ? Theme.of(context).colorScheme.primary
                      : Colors.white54,
                ),
                onPressed: () => player.cycleRepeatMode(),
              ),
            ],
          ),

          // Extra Action Row (Like, Download, Equalizer, Sleep Timer)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              IconButton(
                icon: Icon(
                  isLiked ? Icons.favorite : Icons.favorite_border,
                  color: isLiked ? Colors.red : Colors.white70,
                ),
                onPressed: () => storage.toggleLike(track),
              ),
              IconButton(
                icon: const Icon(Icons.download, color: Colors.white70),
                onPressed: () {
                  download.addDownload(track);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Added to downloads')),
                  );
                },
              ),
              IconButton(
                icon: const Icon(Icons.equalizer, color: Colors.white70),
                onPressed: () => _showEqualizerDialog(context, player),
              ),
              IconButton(
                icon: Icon(
                  player.sleepTimerMinutes != null
                      ? Icons.bedtime
                      : Icons.bedtime_outlined,
                  color: player.sleepTimerMinutes != null
                      ? Theme.of(context).colorScheme.primary
                      : Colors.white70,
                ),
                onPressed: () => _showSleepTimerDialog(context, player),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQueueTab(BuildContext context, PlayerProvider player) {
    final queue = player.queue;
    if (queue.isEmpty) {
      return const Center(child: Text('Queue is empty'));
    }

    return ReorderableListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 12),
      itemCount: queue.length,
      // ignore: deprecated_member_use
      onReorder: (oldIdx, newIdx) => player.reorderQueue(oldIdx, newIdx),
      itemBuilder: (context, index) {
        final item = queue[index];
        final isCurrent = index == player.queueIndex;

        return ListTile(
          key: ValueKey('${item.id}_$index'),
          leading: Icon(
            isCurrent ? Icons.volume_up : Icons.music_note,
            color: isCurrent ? Theme.of(context).colorScheme.primary : null,
          ),
          title: Text(
            item.trackName ?? 'Track',
            style: TextStyle(
              fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
              color: isCurrent ? Theme.of(context).colorScheme.primary : null,
            ),
          ),
          subtitle: Text(item.artistName ?? ''),
          trailing: IconButton(
            icon: const Icon(Icons.close, size: 18),
            onPressed: () => player.removeFromQueue(index),
          ),
          onTap: () => player.playItem(item),
        );
      },
    );
  }

  Widget _buildLyricsTab(BuildContext context, PlayerProvider player) {
    final lyrics = player.lyricsData;
    if (lyrics == null || lyrics.lines.isEmpty) {
      return const Center(child: Text('No lyrics available for this track'));
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      itemCount: lyrics.lines.length,
      itemBuilder: (context, index) {
        final line = lyrics.lines[index];
        final isActive = index == player.activeLyricIndex;

        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 250),
            style: TextStyle(
              fontSize: isActive ? 18 : 14,
              fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
              color: isActive
                  ? Theme.of(context).colorScheme.primary
                  : Colors.white38,
            ),
            child: Text(
              line.text,
              textAlign: TextAlign.center,
            ),
          ),
        );
      },
    );
  }

  Widget _artPlaceholder() {
    return Container(
      color: Colors.white10,
      child: const Center(
        child: Icon(Icons.music_note, size: 80, color: Colors.white38),
      ),
    );
  }

  void _showEqualizerDialog(BuildContext context, PlayerProvider player) {
    final presets = ['Normal', 'Bass Boost', 'Treble Boost', 'Vocal', 'Rock', 'Pop'];
    showDialog(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Equalizer Presets'),
        children: presets
            .map((preset) => SimpleDialogOption(
                  onPressed: () {
                    player.setEqualizerPreset(preset);
                    Navigator.pop(ctx);
                  },
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(preset),
                      if (player.equalizerPreset == preset)
                        Icon(Icons.check,
                            color: Theme.of(context).colorScheme.primary),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }

  void _showSleepTimerDialog(BuildContext context, PlayerProvider player) {
    final options = [15, 30, 45, 60];
    showDialog(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Sleep Timer'),
        children: [
          ...options.map((mins) => SimpleDialogOption(
                onPressed: () {
                  player.setSleepTimer(mins);
                  Navigator.pop(ctx);
                },
                child: Text('$mins minutes'),
              )),
          if (player.sleepTimerMinutes != null)
            SimpleDialogOption(
              onPressed: () {
                player.setSleepTimer(null);
                Navigator.pop(ctx);
              },
              child: const Text('Cancel Timer',
                  style: TextStyle(color: Colors.red)),
            ),
        ],
      ),
    );
  }

  String _fmtTime(int sec) {
    if (sec <= 0) return '0:00';
    final m = (sec / 60).floor();
    final s = (sec % 60).floor().toString().padLeft(2, '0');
    return '$m:$s';
  }
}

import 'package:flutter/material.dart';

class MiniPlayer extends StatelessWidget {
  final Map<String, dynamic>? trackMap;
  final bool isPlaying;
  final double progress; // 0.0 to 1.0
  final VoidCallback onTap;
  final VoidCallback onTogglePlay;
  final VoidCallback onNext;

  const MiniPlayer({
    super.key,
    required this.trackMap,
    required this.isPlaying,
    required this.progress,
    required this.onTap,
    required this.onTogglePlay,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    if (trackMap == null) return const SizedBox.shrink();

    final title = trackMap!['trackName']?.toString() ?? 'Track';
    final artist = trackMap!['artistName']?.toString() ?? '';

    final attachments = trackMap!['attachments'] as Map<String, dynamic>? ?? {};
    final artworkUrls = attachments['artworkUrls'] as List? ?? [];
    String artwork = '';
    if (artworkUrls.isNotEmpty && artworkUrls.last is Map) {
      artwork = artworkUrls.last['url']?.toString() ?? '';
    }
    if (artwork.isEmpty) {
      artwork = trackMap!['artworkUrl100']?.toString() ?? '';
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 64,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHigh,
          border: const Border(
            top: BorderSide(color: Colors.white12, width: 0.5),
          ),
        ),
        child: Column(
          children: [
            LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              minHeight: 2,
              backgroundColor: Colors.white10,
              valueColor: AlwaysStoppedAnimation<Color>(
                Theme.of(context).colorScheme.primary,
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: artwork.isNotEmpty
                          ? Image.network(
                              artwork,
                              width: 44,
                              height: 44,
                              fit: BoxFit.cover,
                              errorBuilder: (ctx, err, stack) => _artPlaceholder(),
                            )
                          : _artPlaceholder(),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          Text(
                            artist,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.6),
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: onTogglePlay,
                      icon: Icon(
                        isPlaying ? Icons.pause : Icons.play_arrow,
                        size: 28,
                      ),
                    ),
                    IconButton(
                      onPressed: onNext,
                      icon: const Icon(Icons.skip_next, size: 28),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _artPlaceholder() {
    return Container(
      width: 44,
      height: 44,
      color: Colors.white10,
      child: const Icon(Icons.music_note, color: Colors.white38),
    );
  }
}

import 'package:flutter/material.dart';

class TrackRow extends StatelessWidget {
  final Map<String, dynamic> itemMap;
  final VoidCallback onPlay;
  final VoidCallback onLike;
  final VoidCallback onMore;
  final VoidCallback? onTap;
  final bool isPlaying;
  final bool isLiked;
  final bool isCached;
  final String? downloadStatus;

  const TrackRow({
    super.key,
    required this.itemMap,
    required this.onPlay,
    required this.onLike,
    required this.onMore,
    this.onTap,
    this.isPlaying = false,
    this.isLiked = false,
    this.isCached = false,
    this.downloadStatus,
  });

  @override
  Widget build(BuildContext context) {
    final title = itemMap['trackName']?.toString() ?? 'Track';
    final artist = itemMap['artistName']?.toString() ?? '';
    final dur = itemMap['trackTimeMillis'] != null
        ? _fmtTime((itemMap['trackTimeMillis'] as num) / 1000)
        : '';
    final sub = [artist, dur].where((s) => s.isNotEmpty).join(' · ');

    final attachments = itemMap['attachments'] as Map<String, dynamic>? ?? {};
    final artworkUrls = attachments['artworkUrls'] as List? ?? [];
    String artwork = '';
    if (artworkUrls.isNotEmpty && artworkUrls.last is Map) {
      artwork = artworkUrls.last['url']?.toString() ?? '';
    }
    if (artwork.isEmpty) {
      artwork = itemMap['artworkUrl100']?.toString() ?? '';
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isPlaying
              ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.12)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            IconButton(
              onPressed: onPlay,
              icon: Icon(
                isPlaying ? Icons.pause_circle_filled : Icons.play_circle_fill,
                color: isPlaying
                    ? Theme.of(context).colorScheme.primary
                    : const Color(0xFF38BDF8),
                size: 38,
              ),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: artwork.isNotEmpty
                  ? Image.network(
                      artwork,
                      width: 44,
                      height: 44,
                      fit: BoxFit.cover,
                      errorBuilder: (ctx, err, stack) => _placeholderArt(),
                    )
                  : _placeholderArt(),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: isPlaying
                                ? Theme.of(context).colorScheme.primary
                                : null,
                          ),
                        ),
                      ),
                      if (isCached) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.cloud_done,
                                  size: 10, color: Colors.green),
                              SizedBox(width: 2),
                              Text('Offline',
                                  style: TextStyle(
                                      fontSize: 9,
                                      color: Colors.green,
                                      fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ),
                      ] else if (downloadStatus != null) ...[
                        const SizedBox(width: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.blue.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            downloadStatus!,
                            style: const TextStyle(
                                fontSize: 9,
                                color: Colors.blue,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    sub,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.6)),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: onLike,
              icon: Icon(
                isLiked ? Icons.favorite : Icons.favorite_border,
                color: isLiked ? Colors.red : null,
                size: 20,
              ),
            ),
            IconButton(
              onPressed: onMore,
              icon: const Icon(Icons.more_vert, size: 20),
            ),
          ],
        ),
      ),
    );
  }

  Widget _placeholderArt() {
    return Container(
      width: 44,
      height: 44,
      color: Colors.white10,
      child: const Icon(Icons.music_note, color: Colors.white38),
    );
  }

  static String _fmtTime(num sec) {
    if (sec <= 0) return '0:00';
    final m = (sec / 60).floor();
    final s = (sec % 60).floor().toString().padLeft(2, '0');
    return '$m:$s';
  }
}

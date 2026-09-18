import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../models/music_item.dart';
import '../services/audio_player_service.dart';
import '../services/download_manager.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';

class ArtworkImage extends StatelessWidget {
  final String url;
  final double size;
  final double borderRadius;
  final IconData placeholderIcon;

  const ArtworkImage({
    super.key,
    required this.url,
    required this.size,
    this.borderRadius = 8,
    this.placeholderIcon = Icons.music_note,
  });

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(borderRadius),
        ),
        child: Icon(placeholderIcon, color: AppTheme.textSecondary, size: size * 0.4),
      );
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: CachedNetworkImage(
        imageUrl: url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        placeholder: (context, url) => Container(
          width: size,
          height: size,
          color: Colors.white.withValues(alpha: 0.07),
          child: Icon(placeholderIcon, color: AppTheme.textSecondary, size: size * 0.4),
        ),
        errorWidget: (context, url, error) => Container(
          width: size,
          height: size,
          color: Colors.white.withValues(alpha: 0.07),
          child: Icon(placeholderIcon, color: AppTheme.textSecondary, size: size * 0.4),
        ),
      ),
    );
  }
}

class TrackTile extends StatelessWidget {
  final MusicItem item;
  final VoidCallback onTap;
  final VoidCallback? onMoreTap;

  const TrackTile({
    super.key,
    required this.item,
    required this.onTap,
    this.onMoreTap,
  });

  @override
  Widget build(BuildContext context) {
    final audioService = AudioPlayerService();
    final downloadManager = DownloadManager();

    return ListenableBuilder(
      listenable: audioService,
      builder: (context, _) {
        final isCurrent = audioService.currentTrack?.id == item.id;
        final isPlaying = isCurrent && audioService.isPlaying;
        final isLiked = StorageService.isLiked(item.id);

        return FutureBuilder<bool>(
          future: downloadManager.isOfflineCached(item.id),
          builder: (context, snapshot) {
            final isOffline = snapshot.data ?? false;
            final dlItem = downloadManager.getItem(item.id);
            final hasAudio = item.hasAudio || isOffline;
            final isPreviewOnly = !hasAudio && item.hasPreview;

            Widget? badge;
            if (isOffline) {
              badge = Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.cloud_done, size: 10, color: Colors.green),
                    SizedBox(width: 2),
                    Text('OFFLINE', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Colors.green)),
                  ],
                ),
              );
            } else if (dlItem != null && (dlItem.status == DownloadStatus.queued || dlItem.status == DownloadStatus.crawling || dlItem.status == DownloadStatus.saving)) {
              badge = Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.cyan.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(width: 8, height: 8, child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.cyan)),
                    const SizedBox(width: 4),
                    Text(
                      dlItem.status == DownloadStatus.saving ? 'DOWNLOADING' : 'CRAWLING',
                      style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Colors.cyan),
                    ),
                  ],
                ),
              );
            } else if (isPreviewOnly) {
              badge = Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.previewColor.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.play_circle_outline, size: 10, color: AppTheme.previewColor),
                    SizedBox(width: 2),
                    Text('PREVIEW', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: AppTheme.previewColor)),
                  ],
                ),
              );
            }

            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: isCurrent ? AppTheme.primaryGradientStart.withValues(alpha: 0.09) : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Row(
                  children: [
                    // Play Button (42x42 round)
                    GestureDetector(
                      onTap: onTap,
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isCurrent && isPlaying
                              ? AppTheme.primaryGradientStart
                              : (isPreviewOnly ? AppTheme.previewColor.withValues(alpha: 0.16) : Colors.white.withValues(alpha: 0.09)),
                        ),
                        child: Icon(
                          isPlaying ? Icons.pause : (isPreviewOnly ? Icons.play_circle_outline : Icons.play_arrow),
                          color: isCurrent && isPlaying ? Colors.white : (isPreviewOnly ? AppTheme.previewColor : Colors.white),
                          size: 24,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Artwork & Details
                    Expanded(
                      child: GestureDetector(
                        onTap: onTap,
                        child: Row(
                          children: [
                            ArtworkImage(
                              url: item.getArtwork(preferPx: 100),
                              size: 46,
                              borderRadius: 10,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          item.name,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                            color: isCurrent ? AppTheme.primaryGradientStart : Colors.white,
                                          ),
                                        ),
                                      ),
                                      if (badge != null) ...[
                                        const SizedBox(width: 4),
                                        badge,
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    [
                                      if (item.artistName != null && item.artistName!.isNotEmpty) item.artistName,
                                      if (item.trackTimeMillis != null) _formatDuration(item.trackTimeMillis! ~/ 1000),
                                    ].join(' · '),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Like button
                    IconButton(
                      iconSize: 20,
                      onPressed: () async {
                        await StorageService.toggleLike(item);
                        (context as Element).markNeedsBuild();
                      },
                      icon: Icon(
                        isLiked ? Icons.favorite : Icons.favorite_border,
                        color: isLiked ? Colors.red : AppTheme.textSecondary,
                      ),
                    ),

                    // More options
                    if (onMoreTap != null)
                      IconButton(
                        iconSize: 20,
                        onPressed: onMoreTap,
                        icon: const Icon(Icons.more_vert, color: AppTheme.textSecondary),
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

  String _formatDuration(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '$m:${s.toString().padLeft(2, '0')}';
  }
}

class AlbumCard extends StatelessWidget {
  final MusicItem item;
  final VoidCallback onTap;

  const AlbumCard({
    super.key,
    required this.item,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 138,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ArtworkImage(
              url: item.getArtwork(preferPx: 300),
              size: 138,
              borderRadius: 14,
              placeholderIcon: Icons.album,
            ),
            const SizedBox(height: 8),
            Text(
              item.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            if (item.artistName != null)
              Text(
                item.artistName!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
              ),
          ],
        ),
      ),
    );
  }
}

class ArtistCard extends StatelessWidget {
  final MusicItem item;
  final VoidCallback onTap;

  const ArtistCard({
    super.key,
    required this.item,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 104,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          children: [
            ArtworkImage(
              url: item.getArtwork(preferPx: 300),
              size: 104,
              borderRadius: 52,
              placeholderIcon: Icons.person,
            ),
            const SizedBox(height: 8),
            Text(
              item.name,
              maxLines: 1,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

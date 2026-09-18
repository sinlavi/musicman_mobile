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
          color: Colors.white10,
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
          color: Colors.white10,
          child: Icon(placeholderIcon, color: AppTheme.textSecondary, size: size * 0.4),
        ),
        errorWidget: (context, url, error) => Container(
          width: size,
          height: size,
          color: Colors.white10,
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
            final hasAudio = item.hasAudio || isOffline;
            final isPreviewOnly = !hasAudio && item.hasPreview;

            return Material(
              color: isCurrent ? AppTheme.primaryGradientStart.withOpacity(0.12) : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: onTap,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      // Play button
                      IconButton(
                        onPressed: onTap,
                        icon: Icon(
                          isPlaying ? Icons.pause_circle_filled : (isPreviewOnly ? Icons.play_circle_outline : Icons.play_circle_fill),
                          color: isPreviewOnly ? AppTheme.previewColor : AppTheme.primaryGradientStart,
                          size: 36,
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Artwork
                      ArtworkImage(
                        url: item.getArtwork(preferPx: 100),
                        size: 46,
                        borderRadius: 8,
                      ),
                      const SizedBox(width: 12),

                      // Metadata
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
                                      fontSize: 14,
                                      color: isCurrent ? AppTheme.primaryGradientStart : null,
                                    ),
                                  ),
                                ),
                                if (isOffline) ...[
                                  const SizedBox(width: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.green.withOpacity(0.2),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      'Offline',
                                      style: TextStyle(fontSize: 9, color: Colors.green, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ] else if (isPreviewOnly) ...[
                                  const SizedBox(width: 4),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppTheme.previewColor.withOpacity(0.2),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      'Preview',
                                      style: TextStyle(fontSize: 9, color: AppTheme.previewColor, fontWeight: FontWeight.bold),
                                    ),
                                  ),
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
                              style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      ),

                      // Like button
                      IconButton(
                        onPressed: () async {
                          await StorageService.toggleLike(item);
                          (context as Element).markNeedsBuild();
                        },
                        icon: Icon(
                          isLiked ? Icons.favorite : Icons.favorite_border,
                          color: isLiked ? Colors.red : AppTheme.textSecondary,
                          size: 20,
                        ),
                      ),

                      // More options
                      if (onMoreTap != null)
                        IconButton(
                          onPressed: onMoreTap,
                          icon: const Icon(Icons.more_vert, color: AppTheme.textSecondary, size: 20),
                        ),
                    ],
                  ),
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

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../models/music_item.dart';
import '../services/api_service.dart';
import '../services/audio_player_service.dart';
import '../services/download_manager.dart';
import '../services/lyrics_service.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';

class TrackDetailView extends StatefulWidget {
  final MusicItem track;

  const TrackDetailView({super.key, required this.track});

  @override
  State<TrackDetailView> createState() => _TrackDetailViewState();
}

class _TrackDetailViewState extends State<TrackDetailView> {
  final DownloadManager _downloadManager = DownloadManager();
  final AudioPlayerService _audioService = AudioPlayerService();

  MusicItem? _fullTrack;
  ParsedLyrics? _parsedLyrics;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadTrackDetails();
  }

  Future<void> _loadTrackDetails() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final results = await ApiService.lookup(widget.track.id, 'song');
      final fresh = results.firstWhere((e) => e.type == 'track', orElse: () => widget.track);
      final lyrics = LyricsParser.parse(fresh.effectiveLyrics);

      if (mounted) {
        setState(() {
          _fullTrack = fresh;
          _parsedLyrics = lyrics;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _fullTrack = widget.track;
          _parsedLyrics = LyricsParser.parse(widget.track.effectiveLyrics);
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final track = _fullTrack ?? widget.track;
    final isLiked = StorageService.isLiked(track.id);

    return Scaffold(
      appBar: AppBar(
        title: Text(track.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: () {
              Share.share('Check out ${track.name} by ${track.artistName ?? "MusicMan"}!');
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Hero Artwork
          Center(
            child: ArtworkImage(
              url: track.getArtwork(preferPx: 600),
              size: 240,
              borderRadius: 20,
            ),
          ),
          const SizedBox(height: 20),

          // Metadata
          Text(
            track.name,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            track.artistName ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 15, color: AppTheme.textSecondary),
          ),
          if (track.collectionName != null) ...[
            const SizedBox(height: 2),
            Text(
              track.collectionName!,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
            ),
          ],
          const SizedBox(height: 20),

          // Action Buttons
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryGradientStart,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                onPressed: () => _audioService.playItem(track),
                icon: const Icon(Icons.play_arrow),
                label: const Text('Play'),
              ),
              const SizedBox(width: 12),
              IconButton(
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white10,
                ),
                icon: Icon(
                  isLiked ? Icons.favorite : Icons.favorite_border,
                  color: isLiked ? Colors.red : Colors.white,
                ),
                onPressed: () async {
                  await StorageService.toggleLike(track);
                  setState(() {});
                },
              ),
              const SizedBox(width: 8),
              FutureBuilder<bool>(
                future: _downloadManager.isOfflineCached(track.id),
                builder: (context, snapshot) {
                  final isCached = snapshot.data ?? false;
                  return IconButton(
                    style: IconButton.styleFrom(backgroundColor: Colors.white10),
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
            ],
          ),
          const SizedBox(height: 24),

          // Crawl Card Section
          _buildCrawlCard(track),
          const SizedBox(height: 16),

          // Lyrics Section
          Card(
            color: AppTheme.surface,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.music_note, color: AppTheme.primaryGradientStart),
                          const SizedBox(width: 8),
                          const Text('Lyrics', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          if (_parsedLyrics != null && _parsedLyrics!.isSynced) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppTheme.primaryGradientStart.withValues(alpha: 0.16),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text('SYNCED', style: TextStyle(fontSize: 9, color: AppTheme.primaryGradientStart, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ],
                      ),
                      if (_parsedLyrics != null && _parsedLyrics!.lines.isNotEmpty)
                        IconButton(
                          icon: const Icon(Icons.copy, size: 20, color: AppTheme.textSecondary),
                          onPressed: () {
                            final fullText = _parsedLyrics!.lines.map((e) => e.text).join('\n');
                            Clipboard.setData(ClipboardData(text: fullText));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Lyrics copied to clipboard')),
                            );
                          },
                        ),
                    ],
                  ),
                  const Divider(color: Colors.white10),
                  const SizedBox(height: 8),

                  if (_isLoading)
                    const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
                  else if (_parsedLyrics == null || _parsedLyrics!.lines.isEmpty)
                    const Text(
                      'No lyrics available for this track.',
                      style: TextStyle(color: AppTheme.textSecondary),
                    )
                  else
                    ..._parsedLyrics!.lines.map((line) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Text(
                            line.text.isEmpty ? '♪' : line.text,
                            style: const TextStyle(fontSize: 14, height: 1.5),
                          ),
                        )),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCrawlCard(MusicItem track) {
    return FutureBuilder<bool>(
      future: _downloadManager.isOfflineCached(track.id),
      builder: (context, snapshot) {
        final isCached = snapshot.data ?? false;
        final dlItem = _downloadManager.getItem(track.id);

        if (isCached) {
          return Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(Icons.cloud_done, color: Colors.green, size: 28),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Saved offline', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      Text('Ready to play without internet', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                  onPressed: () async {
                    await _downloadManager.removeDownload(track.id);
                    setState(() {});
                  },
                ),
              ],
            ),
          );
        }

        if (dlItem != null && (dlItem.status == DownloadStatus.queued || dlItem.status == DownloadStatus.crawling || dlItem.status == DownloadStatus.saving)) {
          return Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.cyan.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.cyan)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        dlItem.status == DownloadStatus.saving ? 'Downloading...' : 'Crawling...',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.cyan),
                      ),
                    ),
                    Text('${dlItem.percent.toStringAsFixed(0)}%', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.cyan)),
                  ],
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(value: dlItem.percent / 100.0, color: Colors.cyan, backgroundColor: Colors.white10),
              ],
            ),
          );
        }

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppTheme.primaryGradientStart.withValues(alpha: 0.11),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              const Icon(Icons.cloud_download, color: AppTheme.primaryGradientStart, size: 28),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Not downloaded', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    Text('Crawl to listen offline', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                  ],
                ),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryGradientStart,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                ),
                onPressed: () async {
                  await _downloadManager.addDownload(track);
                  setState(() {});
                },
                child: const Text('Crawl'),
              ),
            ],
          ),
        );
      },
    );
  }
}

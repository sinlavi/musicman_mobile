class DownloadItem {
  final String trackId;
  final String name;
  final String artist;
  final String artistId;
  final String album;
  final String collectionId;
  final String artwork;
  final String status;
  final int percent;
  final String error;
  final int bytes;
  final int totalBytes;
  final int addedAt;

  DownloadItem({
    required this.trackId,
    required this.name,
    this.artist = '',
    this.artistId = '',
    this.album = '',
    this.collectionId = '',
    this.artwork = '',
    this.status = 'queued',
    this.percent = 0,
    this.error = '',
    this.bytes = 0,
    this.totalBytes = 0,
    required this.addedAt,
  });

  DownloadItem copyWith({
    String? status,
    int? percent,
    String? error,
    int? bytes,
    int? totalBytes,
  }) {
    return DownloadItem(
      trackId: trackId,
      name: name,
      artist: artist,
      artistId: artistId,
      album: album,
      collectionId: collectionId,
      artwork: artwork,
      status: status ?? this.status,
      percent: percent ?? this.percent,
      error: error ?? this.error,
      bytes: bytes ?? this.bytes,
      totalBytes: totalBytes ?? this.totalBytes,
      addedAt: addedAt,
    );
  }

  factory DownloadItem.fromJson(Map<String, dynamic> json) {
    return DownloadItem(
      trackId: json['trackId']?.toString() ?? '',
      name: json['name'] as String? ?? 'Track',
      artist: json['artist'] as String? ?? '',
      artistId: json['artistId']?.toString() ?? '',
      album: json['album'] as String? ?? '',
      collectionId: json['collectionId']?.toString() ?? '',
      artwork: json['artwork'] as String? ?? '',
      status: json['status'] as String? ?? 'queued',
      percent: json['percent'] as int? ?? 0,
      error: json['error'] as String? ?? '',
      bytes: json['bytes'] as int? ?? 0,
      totalBytes: json['totalBytes'] as int? ?? 0,
      addedAt: json['addedAt'] as int? ?? DateTime.now().millisecondsSinceEpoch,
    );
  }

  Map<String, dynamic> toJson() => {
        'trackId': trackId,
        'name': name,
        'artist': artist,
        'artistId': artistId,
        'album': album,
        'collectionId': collectionId,
        'artwork': artwork,
        'status': status,
        'percent': percent,
        'error': error,
        'bytes': bytes,
        'totalBytes': totalBytes,
        'addedAt': addedAt,
      };
}

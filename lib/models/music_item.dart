class AttachmentUrl {
  final String url;
  final String? size;
  final String? quality;

  AttachmentUrl({
    required this.url,
    this.size,
    this.quality,
  });

  factory AttachmentUrl.fromJson(Map<String, dynamic> json) {
    return AttachmentUrl(
      url: json['url']?.toString() ?? '',
      size: json['size']?.toString(),
      quality: json['quality']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'url': url,
        if (size != null) 'size': size,
        if (quality != null) 'quality': quality,
      };
}

class Attachments {
  final List<AttachmentUrl> artworkUrls;
  final List<AttachmentUrl> previewUrls;
  final List<AttachmentUrl> audioUrls;
  final dynamic lyrics;

  Attachments({
    this.artworkUrls = const [],
    this.previewUrls = const [],
    this.audioUrls = const [],
    this.lyrics,
  });

  factory Attachments.fromJson(Map<String, dynamic> json) {
    List<AttachmentUrl> parseList(dynamic val) {
      if (val is! List) return [];
      return val
          .map((e) => e is Map<String, dynamic> ? AttachmentUrl.fromJson(e) : null)
          .whereType<AttachmentUrl>()
          .toList();
    }

    return Attachments(
      artworkUrls: parseList(json['artworkUrls']),
      previewUrls: parseList(json['previewUrls']),
      audioUrls: parseList(json['audioUrls']),
      lyrics: json['lyrics'],
    );
  }

  Map<String, dynamic> toJson() => {
        'artworkUrls': artworkUrls.map((e) => e.toJson()).toList(),
        'previewUrls': previewUrls.map((e) => e.toJson()).toList(),
        'audioUrls': audioUrls.map((e) => e.toJson()).toList(),
        if (lyrics != null) 'lyrics': lyrics,
      };
}

class MusicItem {
  final String? wrapperType;
  final dynamic trackId;
  final dynamic collectionId;
  final dynamic artistId;
  final String? trackName;
  final String? collectionName;
  final String? artistName;
  final String? artworkUrl100;
  final String? primaryGenreName;
  final String? releaseDate;
  final int? trackCount;
  final int? trackTimeMillis;
  final int? trackNumber;
  final dynamic lyrics;
  final Attachments attachments;
  final int? views;

  MusicItem({
    this.wrapperType,
    this.trackId,
    this.collectionId,
    this.artistId,
    this.trackName,
    this.collectionName,
    this.artistName,
    this.artworkUrl100,
    this.primaryGenreName,
    this.releaseDate,
    this.trackCount,
    this.trackTimeMillis,
    this.trackNumber,
    this.lyrics,
    Attachments? attachments,
    this.views,
  }) : attachments = attachments ?? Attachments();

  String get type {
    final w = wrapperType?.toLowerCase() ?? '';
    if (w == 'musicartist' || w == 'artist') return 'artist';
    if (w == 'album' || w == 'collection') return 'collection';
    if (w == 'song' || w == 'track') return 'track';
    return w;
  }

  String get id {
    final tid = trackId?.toString() ?? '';
    if (tid.isNotEmpty) return tid;
    final cid = collectionId?.toString() ?? '';
    if (cid.isNotEmpty) return cid;
    final aid = artistId?.toString() ?? '';
    return aid;
  }

  String get name {
    if (type == 'artist') return artistName ?? 'Artist';
    if (type == 'collection') return collectionName ?? 'Album';
    return trackName ?? 'Track';
  }

  String getArtwork({int preferPx = 600}) {
    if (attachments.artworkUrls.isNotEmpty) {
      String? bestUrl;
      int bestPx = -1;
      for (final a in attachments.artworkUrls) {
        if (a.url.isEmpty) continue;
        final px = int.tryParse(a.size?.replaceAll(RegExp(r'\D'), '') ?? '0') ?? 0;
        if (px > bestPx) {
          bestPx = px;
          bestUrl = a.url;
        }
      }
      if (bestUrl != null && bestUrl.isNotEmpty) {
        return bestUrl.replaceAll(RegExp(r'/\d+x\d+(bb)?\.'), '/${preferPx}x${preferPx}bb.');
      }
    }
    final art = artworkUrl100 ?? '';
    if (art.isNotEmpty) {
      return art.replaceAll('100x100', '${preferPx}x$preferPx')
                .replaceAll('60x60', '${preferPx}x$preferPx')
                .replaceAll('30x30', '${preferPx}x$preferPx');
    }
    return '';
  }

  bool get hasAudio => attachments.audioUrls.any((a) => a.url.isNotEmpty);
  bool get hasPreview => attachments.previewUrls.any((a) => a.url.isNotEmpty);

  String? getPreviewUrl() {
    for (final a in attachments.previewUrls) {
      if (a.url.isNotEmpty) return a.url;
    }
    return null;
  }

  String? getPlayableUrl({String preferQuality = '320'}) {
    final validAudios = attachments.audioUrls.where((a) => a.url.isNotEmpty).toList();
    if (validAudios.isNotEmpty) {
      final exact = validAudios.firstWhere((a) => a.quality == preferQuality, orElse: () => validAudios.first);
      return exact.url;
    }
    return getPreviewUrl();
  }

  dynamic get effectiveLyrics => lyrics ?? attachments.lyrics;

  factory MusicItem.fromJson(Map<String, dynamic> json) {
    return MusicItem(
      wrapperType: json['wrapperType']?.toString(),
      trackId: json['trackId'],
      collectionId: json['collectionId'],
      artistId: json['artistId'],
      trackName: json['trackName']?.toString(),
      collectionName: json['collectionName']?.toString(),
      artistName: json['artistName']?.toString(),
      artworkUrl100: json['artworkUrl100']?.toString(),
      primaryGenreName: json['primaryGenreName']?.toString(),
      releaseDate: json['releaseDate']?.toString(),
      trackCount: json['trackCount'] != null ? int.tryParse(json['trackCount'].toString()) : null,
      trackTimeMillis: json['trackTimeMillis'] != null ? int.tryParse(json['trackTimeMillis'].toString()) : null,
      trackNumber: json['trackNumber'] != null ? int.tryParse(json['trackNumber'].toString()) : null,
      lyrics: json['lyrics'],
      attachments: json['attachments'] is Map<String, dynamic>
          ? Attachments.fromJson(json['attachments'])
          : null,
      views: json['views'] != null ? int.tryParse(json['views'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
        if (wrapperType != null) 'wrapperType': wrapperType,
        if (trackId != null) 'trackId': trackId,
        if (collectionId != null) 'collectionId': collectionId,
        if (artistId != null) 'artistId': artistId,
        if (trackName != null) 'trackName': trackName,
        if (collectionName != null) 'collectionName': collectionName,
        if (artistName != null) 'artistName': artistName,
        if (artworkUrl100 != null) 'artworkUrl100': artworkUrl100,
        if (primaryGenreName != null) 'primaryGenreName': primaryGenreName,
        if (releaseDate != null) 'releaseDate': releaseDate,
        if (trackCount != null) 'trackCount': trackCount,
        if (trackTimeMillis != null) 'trackTimeMillis': trackTimeMillis,
        if (trackNumber != null) 'trackNumber': trackNumber,
        if (lyrics != null) 'lyrics': lyrics,
        'attachments': attachments.toJson(),
        if (views != null) 'views': views,
      };
}

class SearchSuggestion {
  final String id;
  final String type;
  final String name;

  SearchSuggestion({
    required this.id,
    required this.type,
    required this.name,
  });

  factory SearchSuggestion.fromJson(Map<String, dynamic> json) {
    return SearchSuggestion(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
    );
  }
}

class CrawlStatus {
  final String downloadStatus;
  final double percent;
  final bool found;
  final String? error;

  CrawlStatus({
    required this.downloadStatus,
    required this.percent,
    required this.found,
    this.error,
  });

  factory CrawlStatus.fromJson(Map<String, dynamic> json) {
    final dl = json['download'];
    if (dl is! Map<String, dynamic>) {
      return CrawlStatus(
        downloadStatus: 'completed',
        percent: 100.0,
        found: false,
      );
    }
    return CrawlStatus(
      downloadStatus: dl['download_status']?.toString() ?? 'completed',
      percent: (double.tryParse(dl['percent']?.toString() ?? '0') ?? 0.0).clamp(0.0, 100.0),
      found: true,
      error: dl['error']?.toString(),
    );
  }
}

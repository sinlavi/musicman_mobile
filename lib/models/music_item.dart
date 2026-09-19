class AudioOption {
  final String? url;
  final String? quality;

  AudioOption({this.url, this.quality});

  factory AudioOption.fromJson(Map<String, dynamic> json) {
    return AudioOption(
      url: json['url'] as String?,
      quality: json['quality']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'url': url,
        'quality': quality,
      };
}

class ArtworkOption {
  final String? url;
  final String? size;

  ArtworkOption({this.url, this.size});

  factory ArtworkOption.fromJson(Map<String, dynamic> json) {
    return ArtworkOption(
      url: json['url'] as String?,
      size: json['size']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'url': url,
        'size': size,
      };
}

class MusicItem {
  final String? wrapperType;
  final String? trackId;
  final String? collectionId;
  final String? artistId;
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
  final int? views;
  final List<ArtworkOption> artworkUrls;
  final List<AudioOption> previewUrls;
  final List<AudioOption> audioUrls;

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
    this.views,
    this.artworkUrls = const [],
    this.previewUrls = const [],
    this.audioUrls = const [],
  });

  String get itemType {
    final w = wrapperType?.toLowerCase() ?? '';
    if (w == 'musicartist' || w == 'artist') return 'artist';
    if (w == 'album' || w == 'collection') return 'collection';
    if (w == 'song' || w == 'track') return 'track';
    return w;
  }

  String get id {
    final t = itemType;
    if (t == 'artist') return artistId?.replaceAll(RegExp(r'^it_'), '') ?? '';
    if (t == 'collection') return collectionId?.replaceAll(RegExp(r'^it_'), '') ?? '';
    return trackId?.replaceAll(RegExp(r'^it_'), '') ?? '';
  }

  String getArtwork([int size = 300]) {
    if (artworkUrls.isNotEmpty) {
      final sizeStr = size.toString();
      final best = artworkUrls.firstWhere(
        (a) => (a.size ?? '').contains(sizeStr),
        orElse: () => artworkUrls.last,
      );
      if (best.url != null && best.url!.isNotEmpty) {
        return best.url!.replaceAll(RegExp(r'/\d+x\d+(bb)?\.'), '/${size}x${size}bb.');
      }
    }
    if (artworkUrl100 != null && artworkUrl100!.isNotEmpty) {
      return artworkUrl100!
          .replaceAll('100x100', '${size}x$size')
          .replaceAll('60x60', '${size}x$size')
          .replaceAll('30x30', '${size}x$size');
    }
    return '';
  }

  bool get hasAudio => audioUrls.any((a) => a.url != null && a.url!.isNotEmpty);
  bool get hasPreview => previewUrls.any((p) => p.url != null && p.url!.isNotEmpty);

  String? get previewUrl {
    for (final p in previewUrls) {
      if (p.url != null && p.url!.isNotEmpty) return p.url;
    }
    return null;
  }

  String? getPlayableUrl([String preferQuality = '320']) {
    if (hasAudio) {
      final valid = audioUrls.where((a) => a.url != null && a.url!.isNotEmpty).toList();
      final exact = valid.firstWhere(
        (a) => a.quality == preferQuality,
        orElse: () => valid.first,
      );
      return exact.url;
    }
    return previewUrl;
  }

  factory MusicItem.fromJson(Map<String, dynamic> json) {
    final attachments = json['attachments'] as Map<String, dynamic>? ?? {};

    List<ArtworkOption> artList = [];
    if (attachments['artworkUrls'] is List) {
      artList = (attachments['artworkUrls'] as List)
          .map((e) => ArtworkOption.fromJson(e as Map<String, dynamic>))
          .toList();
    }

    List<AudioOption> prevList = [];
    if (attachments['previewUrls'] is List) {
      prevList = (attachments['previewUrls'] as List)
          .map((e) => AudioOption.fromJson(e as Map<String, dynamic>))
          .toList();
    }

    List<AudioOption> audioList = [];
    if (attachments['audioUrls'] is List) {
      audioList = (attachments['audioUrls'] as List)
          .map((e) => AudioOption.fromJson(e as Map<String, dynamic>))
          .toList();
    }

    return MusicItem(
      wrapperType: json['wrapperType'] as String?,
      trackId: json['trackId']?.toString(),
      collectionId: json['collectionId']?.toString(),
      artistId: json['artistId']?.toString(),
      trackName: json['trackName'] as String?,
      collectionName: json['collectionName'] as String?,
      artistName: json['artistName'] as String?,
      artworkUrl100: json['artworkUrl100'] as String?,
      primaryGenreName: json['primaryGenreName'] as String?,
      releaseDate: json['releaseDate'] as String?,
      trackCount: json['trackCount'] as int?,
      trackTimeMillis: json['trackTimeMillis'] as int?,
      trackNumber: json['trackNumber'] as int?,
      lyrics: json['lyrics'] ?? attachments['lyrics'],
      views: json['views'] as int?,
      artworkUrls: artList,
      previewUrls: prevList,
      audioUrls: audioList,
    );
  }

  Map<String, dynamic> toJson() => {
        'wrapperType': wrapperType,
        'trackId': trackId,
        'collectionId': collectionId,
        'artistId': artistId,
        'trackName': trackName,
        'collectionName': collectionName,
        'artistName': artistName,
        'artworkUrl100': artworkUrl100,
        'primaryGenreName': primaryGenreName,
        'releaseDate': releaseDate,
        'trackCount': trackCount,
        'trackTimeMillis': trackTimeMillis,
        'trackNumber': trackNumber,
        'lyrics': lyrics,
        'views': views,
        'attachments': {
          'artworkUrls': artworkUrls.map((e) => e.toJson()).toList(),
          'previewUrls': previewUrls.map((e) => e.toJson()).toList(),
          'audioUrls': audioUrls.map((e) => e.toJson()).toList(),
        },
      };
}

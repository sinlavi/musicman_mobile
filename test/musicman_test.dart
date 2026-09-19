import 'package:flutter_test/flutter_test.dart';
import 'package:musicman/models/music_item.dart';
import 'package:musicman/models/download_item.dart';
import 'package:musicman/models/playlist_item.dart';
import 'package:musicman/models/lyrics.dart';

void main() {
  test('MusicItem parsing & helpers', () {
    final item = MusicItem.fromJson({
      'wrapperType': 'track',
      'trackId': '101',
      'trackName': 'Song 1',
      'artistName': 'Artist 1',
      'artworkUrl100': 'http://example.com/100x100.jpg',
      'attachments': {
        'audioUrls': [
          {'url': 'http://example.com/audio.mp3', 'quality': '320'}
        ]
      }
    });

    expect(item.id, '101');
    expect(item.trackName, 'Song 1');
    expect(item.hasAudio, isTrue);
    expect(item.getPlayableUrl(), 'http://example.com/audio.mp3');
  });

  test('DownloadItem & PlaylistItem serialization', () {
    final dl = DownloadItem(
      trackId: '101',
      name: 'Song 1',
      addedAt: 1234567,
    );
    expect(dl.copyWith(percent: 50).percent, 50);

    final pl = PlaylistItem(
      id: 'pl_1',
      name: 'My List',
      tracks: [],
      createdAt: 1000,
    );
    expect(PlaylistItem.fromJson(pl.toJson()).name, 'My List');
  });

  test('Lyrics parsing', () {
    final lyrics = LyricsData.parse('[00:10.00]Hello world');
    expect(lyrics.synced, isTrue);
    expect(lyrics.lines.first.text, 'Hello world');
  });
}

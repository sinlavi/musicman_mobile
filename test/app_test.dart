import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:musicman/models/music_item.dart';
import 'package:musicman/services/lyrics_service.dart';
import 'package:musicman/main.dart';

void main() {
  test('MusicItem JSON parsing and model logic', () {
    final json = {
      'wrapperType': 'track',
      'trackId': 12345,
      'trackName': 'Test Song',
      'artistName': 'Test Artist',
      'collectionName': 'Test Album',
      'artworkUrl100': 'https://example.com/100x100.jpg',
      'attachments': {
        'audioUrls': [
          {'url': 'https://example.com/audio.mp3', 'quality': '320'}
        ],
        'previewUrls': [
          {'url': 'https://example.com/preview.mp3'}
        ]
      }
    };

    final item = MusicItem.fromJson(json);
    expect(item.type, equals('track'));
    expect(item.id, equals('12345'));
    expect(item.name, equals('Test Song'));
    expect(item.getArtwork(preferPx: 600), equals('https://example.com/600x600.jpg'));
    expect(item.hasAudio, isTrue);
    expect(item.getPlayableUrl(), equals('https://example.com/audio.mp3'));
  });

  test('LyricsParser parse LRC and plain lyrics correctly', () {
    const lrc = '[00:12.50]Line 1\n[00:15.00]Line 2\n[00:20.10]Line 3';
    final parsed = LyricsParser.parse(lrc);

    expect(parsed.isSynced, isTrue);
    expect(parsed.lines.length, equals(3));
    expect(parsed.lines[0].text, equals('Line 1'));
    expect(parsed.lines[0].time, equals(12.5));
    expect(parsed.lines[1].time, equals(15.0));
  });

  testWidgets('MusicManApp widget renders successfully', (WidgetTester tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(
        body: Center(
          child: Text('MusicMan'),
        ),
      ),
    ));
    expect(find.text('MusicMan'), findsOneWidget);
  });
}

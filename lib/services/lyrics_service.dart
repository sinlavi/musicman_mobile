class LyricLine {
  final double? time; // in seconds
  final String text;

  LyricLine({this.time, required this.text});

  bool get isBlank => text.trim().isEmpty;
}

class ParsedLyrics {
  final List<LyricLine> lines;
  final bool isSynced;
  final bool isInstrumental;

  ParsedLyrics({
    required this.lines,
    required this.isSynced,
    this.isInstrumental = false,
  });

  factory ParsedLyrics.empty() => ParsedLyrics(lines: [], isSynced: false);
}

class LyricsParser {
  static final RegExp _instrumentalRe = RegExp(
    r'^(instrumental|no\s*lyrics?|no\s*lyrics?\s*available|lyrics?\s*not\s*available|lyrics?\s*not\s*found|not\s*found|instrumental\s*\/\s*not\s*found|only\s*music|music\s*only|\[?\s*instrumental\s*\]?|\(\s*instrumental\s*\)|♪+\s*instrumental\s*♪*|♫+\s*instrumental\s*♫*|\.{3,}|-+|—+)$',
    caseSensitive: false,
  );

  static double? _parseTime(dynamic val) {
    if (val == null) return null;
    if (val is num) return val.toDouble();
    final s = val.toString();
    return double.tryParse(s);
  }

  static String _parseText(dynamic val) {
    if (val == null) return '';
    return val.toString();
  }

  static ParsedLyrics parse(dynamic rawLyrics) {
    if (rawLyrics == null) return ParsedLyrics.empty();

    List<LyricLine> lines = [];
    String rawText = '';

    void ingest(dynamic node, int depth) {
      if (node == null || depth > 6) return;
      if (node is String) {
        if (rawText.isEmpty) rawText = node;
        return;
      }
      if (node is List) {
        if (lines.isEmpty) {
          lines = node.map((l) {
            if (l is String) return LyricLine(time: null, text: l);
            if (l is Map) {
              final t = _parseTime(l['time'] ?? l['startTime'] ?? l['start'] ?? l['t']);
              final txt = _parseText(l['text'] ?? l['line'] ?? l['lyric'] ?? l['l']);
              return LyricLine(time: t, text: txt);
            }
            return LyricLine(time: null, text: '');
          }).toList();
        }
        return;
      }
      if (node is Map) {
        if (node['synced'] is String && (node['synced'] as String).trim().isNotEmpty) {
          if (rawText.isEmpty) rawText = node['synced'];
          return;
        }
        if (node['synced'] is List && (node['synced'] as List).isNotEmpty) {
          if (lines.isEmpty) {
            lines = (node['synced'] as List).map((l) {
              if (l is Map) {
                final t = _parseTime(l['time'] ?? l['startTime'] ?? l['start'] ?? l['t']);
                final txt = _parseText(l['text'] ?? l['line'] ?? l['lyric'] ?? l['l']);
                return LyricLine(time: t, text: txt);
              }
              return LyricLine(time: null, text: l.toString());
            }).toList();
          }
          return;
        }
        if (node['lines'] is List && (node['lines'] as List).isNotEmpty) {
          if (lines.isEmpty) {
            lines = (node['lines'] as List).map((l) {
              if (l is Map) {
                final t = _parseTime(l['time'] ?? l['startTime'] ?? l['start'] ?? l['t']);
                final txt = _parseText(l['text'] ?? l['line'] ?? l['lyric'] ?? l['l']);
                return LyricLine(time: t, text: txt);
              }
              return LyricLine(time: null, text: l.toString());
            }).toList();
          }
          return;
        }
        if (node['plain'] is String && (node['plain'] as String).trim().isNotEmpty) {
          if (rawText.isEmpty) rawText = node['plain'];
          return;
        }
        if (node['lyrics'] is String) {
          if (rawText.isEmpty) rawText = node['lyrics'];
          return;
        }
      }
    }

    ingest(rawLyrics, 0);

    if (lines.isEmpty && rawText.isNotEmpty) {
      final timeRe = RegExp(r'\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]');
      final parsed = <LyricLine>[];
      final rawLines = rawText.split('\n');

      for (final line in rawLines) {
        final matches = timeRe.allMatches(line).toList();
        final text = line.replaceAll(timeRe, '').trim();

        if (matches.isNotEmpty) {
          for (final m in matches) {
            final min = int.tryParse(m.group(1) ?? '0') ?? 0;
            final sec = int.tryParse(m.group(2) ?? '0') ?? 0;
            final msStr = m.group(3) ?? '0';
            final ms = (int.tryParse(msStr.padRight(3, '0').substring(0, 3)) ?? 0) / 1000.0;
            parsed.add(LyricLine(time: min * 60 + sec + ms, text: text));
          }
        } else {
          parsed.add(LyricLine(time: null, text: text));
        }
      }
      lines = parsed;
    }

    // Check if instrumental
    final joined = lines
        .map((e) => e.text.replaceAll(RegExp(r'\[.*?\]|\(.*?\)', dotAll: true), '').trim())
        .where((e) => e.isNotEmpty)
        .join(' ')
        .trim();

    if (joined.isEmpty || _instrumentalRe.hasMatch(joined.toLowerCase())) {
      return ParsedLyrics(lines: [], isSynced: false, isInstrumental: true);
    }

    final isSynced = lines.any((l) => l.time != null);
    return ParsedLyrics(lines: lines, isSynced: isSynced);
  }
}

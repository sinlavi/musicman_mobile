class LyricsLine {
  final double? time;
  final String text;

  LyricsLine({this.time, required this.text});

  factory LyricsLine.fromJson(Map<String, dynamic> json) {
    double? parsedTime;
    final t = json['time'] ?? json['startTime'] ?? json['start'] ?? json['timestamp'] ?? json['at'] ?? json['t'];
    if (t != null) {
      parsedTime = double.tryParse(t.toString());
    }
    return LyricsLine(
      time: parsedTime,
      text: (json['text'] ?? json['line'] ?? json['content'] ?? json['lyric'] ?? json['l'] ?? json['value'] ?? '').toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'time': time,
        'text': text,
      };
}

class LyricsData {
  final List<LyricsLine> lines;
  final bool synced;

  LyricsData({required this.lines, required this.synced});

  static LyricsData parse(dynamic raw) {
    if (raw == null) return LyricsData(lines: [], synced: false);

    List<LyricsLine> lines = [];
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
            if (l is String) return LyricsLine(time: null, text: l);
            if (l is Map) return LyricsLine.fromJson(Map<String, dynamic>.from(l));
            return LyricsLine(time: null, text: l.toString());
          }).toList();
        }
        return;
      }
      if (node is Map) {
        if (node['text'] != null && node['text'] is Map) {
          ingest(node['text'], depth + 1);
          if (lines.isNotEmpty || rawText.isNotEmpty) return;
        }
        if (node['synced'] is String && (node['synced'] as String).trim().isNotEmpty) {
          if (rawText.isEmpty) rawText = node['synced'] as String;
          return;
        }
        if (node['synced'] is List && (node['synced'] as List).isNotEmpty) {
          if (lines.isEmpty) {
            lines = (node['synced'] as List)
                .map((l) => l is Map ? LyricsLine.fromJson(Map<String, dynamic>.from(l)) : LyricsLine(time: null, text: l.toString()))
                .toList();
          }
          return;
        }
        if (node['lines'] is List && (node['lines'] as List).isNotEmpty) {
          if (lines.isEmpty) {
            lines = (node['lines'] as List)
                .map((l) => l is Map ? LyricsLine.fromJson(Map<String, dynamic>.from(l)) : LyricsLine(time: null, text: l.toString()))
                .toList();
          }
          return;
        }
        if (node['plain'] is String && (node['plain'] as String).trim().isNotEmpty) {
          if (rawText.isEmpty) rawText = node['plain'] as String;
          return;
        }
        if (node['lyrics'] is String) {
          if (rawText.isEmpty) rawText = node['lyrics'] as String;
          return;
        }
        if (node['text'] is String) {
          if (rawText.isEmpty) rawText = node['text'] as String;
          return;
        }
      }
    }

    ingest(raw, 0);

    if (lines.isEmpty && rawText.isNotEmpty) {
      final timeRe = RegExp(r'\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]');
      final parsed = <LyricsLine>[];
      for (final line in rawText.split('\n')) {
        final matches = timeRe.allMatches(line);
        final times = <double>[];
        for (final m in matches) {
          final min = int.parse(m.group(1)!);
          final sec = int.parse(m.group(2)!);
          final frac = m.group(3) != null ? int.parse(m.group(3)!.padRight(3, '0').substring(0, 3)) / 1000.0 : 0.0;
          times.add(min * 60 + sec + frac);
        }
        final text = line.replaceAll(timeRe, '').trim();
        if (times.isNotEmpty) {
          for (final t in times) {
            parsed.add(LyricsLine(time: t, text: text));
          }
        } else {
          parsed.add(LyricsLine(time: null, text: text));
        }
      }
      lines = parsed;
    }

    final isSynced = lines.any((l) => l.time != null);
    return LyricsData(lines: lines, synced: isSynced);
  }
}

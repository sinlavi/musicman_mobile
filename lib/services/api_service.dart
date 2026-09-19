import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/music_item.dart';

class ApiService {
  static const String baseUrl = 'https://3rah.ir/mm/api';
  static const String apiToken = 'change_me_to_a_secure_token';

  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $apiToken',
      };

  static Future<dynamic> _get(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.get(uri, headers: _headers);
    if (response.statusCode != 200) {
      throw Exception('HTTP ${response.statusCode}: ${response.body}');
    }
    return jsonDecode(response.body);
  }

  static Future<dynamic> _post(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('$baseUrl$path');
    final response = await http.post(
      uri,
      headers: _headers,
      body: jsonEncode(body),
    );
    if (response.statusCode != 200) {
      throw Exception('HTTP ${response.statusCode}: ${response.body}');
    }
    return jsonDecode(response.body);
  }

  static String proxyUrl(String? targetUrl) {
    if (targetUrl == null || targetUrl.isEmpty) return '';
    return '$baseUrl/proxy?url=${Uri.encodeComponent(targetUrl)}';
  }

  static Future<List<MusicItem>> search(String term) async {
    if (term.trim().isEmpty) return [];
    final res = await _get('/search?term=${Uri.encodeComponent(term)}&limit=50&entity=musicArtist,album,song');
    final results = res['results'] as List? ?? [];
    return results.map((e) => MusicItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<MusicItem>> fetchFresh() async {
    final res = await _get('/fresh');
    final results = res['results'] as List? ?? [];
    return results.map((e) => MusicItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<MusicItem>> fetchPopular([int limit = 40]) async {
    final res = await _get('/popular?limit=$limit&minViews=1');
    final results = res['results'] as List? ?? [];
    return results.map((e) => MusicItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<MusicItem>> lookup(String id, String entity) async {
    final cleanId = id.replaceAll(RegExp(r'^it_'), '');
    final res = await _get('/lookup?id=$cleanId&entity=$entity&limit=200');
    final results = res['results'] as List? ?? [];
    return results.map((e) => MusicItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<Map<String, dynamic>> fetchArtistTracks(
    String id, {
    int page = 1,
    int limit = 50,
    String sort = 'album',
  }) async {
    final cleanId = id.replaceAll(RegExp(r'^it_'), '');
    final res = await _get('/artist/tracks?id=$cleanId&page=$page&limit=$limit&sort=${Uri.encodeComponent(sort)}');
    final results = (res['results'] as List? ?? []).map((e) => MusicItem.fromJson(e as Map<String, dynamic>)).toList();
    return {
      'results': results,
      'total': res['total'] ?? results.length,
      'pages': res['pages'] ?? 1,
      'hasMore': res['hasMore'] ?? false,
    };
  }

  static Future<List<Map<String, dynamic>>> fetchSuggestions(String q) async {
    if (q.trim().isEmpty) return [];
    final res = await _get('/suggest?q=${Uri.encodeComponent(q)}&limit=8');
    final suggestions = res['suggestions'] as List? ?? [];
    return suggestions.cast<Map<String, dynamic>>();
  }

  static Future<Map<String, dynamic>> crawlStatus(String trackId) async {
    final cleanId = trackId.replaceAll(RegExp(r'^it_'), '');
    try {
      final res = await _get('/download/status?trackId=$cleanId');
      if (res['download'] != null) {
        return Map<String, dynamic>.from(res['download'])..['found'] = true;
      }
      return {'download_status': 'completed', 'percent': 100, 'found': false};
    } catch (_) {
      return {'download_status': 'completed', 'percent': 100, 'found': false};
    }
  }

  static Future<Map<String, dynamic>> addQueue(Map<String, dynamic> body, [String quality = '320']) async {
    final payload = {
      'quality': quality,
      'skipExisting': true,
      ...body,
    };
    return await _post('/download/add', payload);
  }
}

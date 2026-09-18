import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/music_item.dart';

class ApiService {
  static const String baseUrl = 'https://3rah.ir/mm/api';
  static const String bearerToken = 'change_me_to_a_secure_token';

  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer $bearerToken',
        'User-Agent': 'MusicMan-Flutter/1.0',
      };

  static String cleanId(dynamic id) {
    if (id == null) return '';
    return id.toString().replaceAll(RegExp(r'^it_'), '');
  }

  static String proxyUrl(String url) {
    if (url.isEmpty) return '';
    return '$baseUrl/proxy?url=${Uri.encodeComponent(url)}';
  }

  static Future<List<MusicItem>> getFresh() async {
    final response = await http.get(Uri.parse('$baseUrl/fresh'), headers: _headers);
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final results = data['results'] as List? ?? [];
      return results.map((e) => MusicItem.fromJson(e)).toList();
    }
    throw Exception('Failed to load fresh items (${response.statusCode})');
  }

  static Future<List<MusicItem>> getPopular({int limit = 40}) async {
    final response = await http.get(
      Uri.parse('$baseUrl/popular?limit=$limit&minViews=1'),
      headers: _headers,
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final results = data['results'] as List? ?? [];
      return results.map((e) => MusicItem.fromJson(e)).toList();
    }
    return [];
  }

  static Future<List<MusicItem>> search(String term, {int limit = 50}) async {
    if (term.trim().isEmpty) return [];
    final response = await http.get(
      Uri.parse('$baseUrl/search?term=${Uri.encodeComponent(term)}&limit=$limit&entity=musicArtist,album,song'),
      headers: _headers,
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final results = data['results'] as List? ?? [];
      return results.map((e) => MusicItem.fromJson(e)).toList();
    }
    throw Exception('Failed search query (${response.statusCode})');
  }

  static Future<List<SearchSuggestion>> suggest(String q, {int limit = 8}) async {
    if (q.trim().isEmpty) return [];
    final response = await http.get(
      Uri.parse('$baseUrl/suggest?q=${Uri.encodeComponent(q)}&limit=$limit'),
      headers: _headers,
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final suggestions = data['suggestions'] as List? ?? [];
      return suggestions.map((e) => SearchSuggestion.fromJson(e)).toList();
    }
    return [];
  }

  static Future<List<MusicItem>> lookup(dynamic id, String entity, {int limit = 200}) async {
    final cleaned = cleanId(id);
    if (cleaned.isEmpty) return [];
    final response = await http.get(
      Uri.parse('$baseUrl/lookup?id=${Uri.encodeComponent(cleaned)}&entity=$entity&limit=$limit'),
      headers: _headers,
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final results = data['results'] as List? ?? [];
      return results.map((e) => MusicItem.fromJson(e)).toList();
    }
    return [];
  }

  static Future<Map<String, dynamic>> getArtistTracks(
    dynamic id, {
    int page = 1,
    int limit = 50,
    String sort = 'album',
  }) async {
    final cleaned = cleanId(id);
    final response = await http.get(
      Uri.parse('$baseUrl/artist/tracks?id=${Uri.encodeComponent(cleaned)}&page=$page&limit=$limit&sort=${Uri.encodeComponent(sort)}'),
      headers: _headers,
    );
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final results = (data['results'] as List? ?? []).map((e) => MusicItem.fromJson(e)).toList();
      return {
        'results': results,
        'total': data['total'] ?? results.length,
        'pages': data['pages'] ?? 1,
        'hasMore': data['hasMore'] ?? false,
      };
    }
    throw Exception('Failed to load artist tracks');
  }

  static Future<Map<String, dynamic>> queueDownload({
    dynamic trackId,
    dynamic albumId,
    dynamic artistId,
    String quality = '320',
  }) async {
    final body = <String, dynamic>{
      'quality': quality,
      'skipExisting': true,
    };
    if (trackId != null) body['trackId'] = cleanId(trackId);
    if (albumId != null) body['albumId'] = cleanId(albumId);
    if (artistId != null) body['artistId'] = cleanId(artistId);

    final response = await http.post(
      Uri.parse('$baseUrl/download/add'),
      headers: _headers,
      body: json.encode(body),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body) as Map<String, dynamic>;
    }
    throw Exception('Failed to add to queue');
  }

  static Future<CrawlStatus> getCrawlStatus(dynamic trackId) async {
    final cleaned = cleanId(trackId);
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/download/status?trackId=${Uri.encodeComponent(cleaned)}'),
        headers: _headers,
      );
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return CrawlStatus.fromJson(data);
      }
    } catch (_) {}
    return CrawlStatus(downloadStatus: 'completed', percent: 100.0, found: false);
  }
}

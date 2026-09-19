class PlaylistItem {
  final String id;
  final String name;
  final List<Map<String, dynamic>> tracks;
  final int createdAt;

  PlaylistItem({
    required this.id,
    required this.name,
    required this.tracks,
    required this.createdAt,
  });

  factory PlaylistItem.fromJson(Map<String, dynamic> json) {
    return PlaylistItem(
      id: json['id'] as String,
      name: json['name'] as String,
      tracks: (json['tracks'] as List? ?? []).cast<Map<String, dynamic>>(),
      createdAt: json['createdAt'] as int? ?? DateTime.now().millisecondsSinceEpoch,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'tracks': tracks,
        'createdAt': createdAt,
      };
}

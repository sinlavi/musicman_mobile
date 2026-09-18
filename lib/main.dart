import 'package:flutter/material.dart';
import 'models/music_item.dart';
import 'services/download_manager.dart';
import 'services/storage_service.dart';
import 'theme/app_theme.dart';
import 'views/artist_album_view.dart';
import 'views/home_view.dart';
import 'views/library_view.dart';
import 'views/search_view.dart';
import 'views/track_detail_view.dart';
import 'widgets/player_widgets.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await StorageService.init();
  await DownloadManager().init();
  runApp(const MusicManApp());
}

class MusicManApp extends StatelessWidget {
  const MusicManApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MusicMan',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.dark,
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  void _navigateToItem(MusicItem item) {
    if (item.type == 'artist') {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => ArtistView(
            artist: item,
            onNavigateToItem: _navigateToItem,
          ),
        ),
      );
    } else if (item.type == 'collection') {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => AlbumView(
            album: item,
            onNavigateToItem: _navigateToItem,
          ),
        ),
      );
    } else if (item.type == 'track') {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => TrackDetailView(track: item),
        ),
      );
    }
  }

  void _showFullPlayer() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.background,
      builder: (context) => const FullPlayerSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeView(onNavigateToItem: _navigateToItem),
      SearchView(onNavigateToItem: _navigateToItem),
      LibraryView(onNavigateToItem: _navigateToItem),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            ShaderMask(
              shaderCallback: (bounds) => AppTheme.primaryGradient.createShader(bounds),
              child: const Icon(Icons.graphic_eq, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 8),
            const Text(
              'MusicMan',
              style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: -0.5),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => _showSettingsModal(context),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: IndexedStack(
                index: _currentIndex,
                children: screens,
              ),
            ),
            MiniPlayer(onTap: _showFullPlayer),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.search_outlined),
            activeIcon: Icon(Icons.search),
            label: 'Search',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.collections_bookmark_outlined),
            activeIcon: Icon(Icons.collections_bookmark),
            label: 'Library',
          ),
        ],
      ),
    );
  }

  void _showSettingsModal(BuildContext context) {
    final settings = StorageService.getSettings();

    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 16),
                    SwitchListTile(
                      title: const Text('Auto-scroll Lyrics'),
                      subtitle: const Text('Follow active line automatically'),
                      value: settings.autoScrollLyrics,
                      onChanged: (val) async {
                        settings.autoScrollLyrics = val;
                        await StorageService.saveSettings(settings);
                        setModalState(() {});
                      },
                    ),
                    SwitchListTile(
                      title: const Text('Auto-retry Downloads'),
                      subtitle: const Text('Automatically retry failed server crawls'),
                      value: settings.autoRetry,
                      onChanged: (val) async {
                        settings.autoRetry = val;
                        await StorageService.saveSettings(settings);
                        setModalState(() {});
                      },
                    ),
                    ListTile(
                      leading: const Icon(Icons.restore, color: Colors.red),
                      title: const Text('Reset All Data', style: TextStyle(color: Colors.red)),
                      subtitle: const Text('Clear local settings, likes, and playlists'),
                      onTap: () async {
                        await StorageService.resetAllData();
                        await DownloadManager().clearOfflineCache();
                        if (context.mounted) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('App data reset')),
                          );
                          setState(() {});
                        }
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

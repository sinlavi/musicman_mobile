import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/player_provider.dart';
import 'services/download_service.dart';
import 'services/storage_service.dart';
import 'views/home_view.dart';
import 'views/search_view.dart';
import 'views/library_view.dart';
import 'views/detail_view.dart';
import 'widgets/mini_player.dart';
import 'widgets/full_player_sheet.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final storageService = StorageService();
  await storageService.init();

  final downloadService = DownloadService();
  await downloadService.init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: storageService),
        ChangeNotifierProvider.value(value: downloadService),
        ChangeNotifierProvider(
          create: (_) => PlayerProvider(
            storageService: storageService,
            downloadService: downloadService,
          ),
        ),
      ],
      child: const MusicManApp(),
    ),
  );
}

class MusicManApp extends StatelessWidget {
  const MusicManApp({super.key});

  @override
  Widget build(BuildContext context) {
    final storage = context.watch<StorageService>();
    final isDark = storage.theme == 'dark';

    return MaterialApp(
      title: 'MusicMan',
      debugShowCheckedModeBanner: false,
      themeMode: isDark ? ThemeMode.dark : ThemeMode.light,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorSchemeSeed: const Color(0xFF7B2FF7),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorSchemeSeed: const Color(0xFF7B2FF7),
        scaffoldBackgroundColor: const Color(0xFF0B0B0D),
      ),
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

  void _navigateToDetail(String type, String id) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => DetailView(
          type: type,
          id: id,
          onNavigate: _navigateToDetail,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlayerProvider>();
    final storage = context.watch<StorageService>();

    final pages = [
      HomeView(onNavigate: _navigateToDetail),
      SearchView(onNavigate: _navigateToDetail),
      LibraryView(onNavigate: _navigateToDetail),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            ShaderMask(
              shaderCallback: (bounds) => const LinearGradient(
                colors: [Color(0xFF7B2FF7), Color(0xFFF107A3)],
              ).createShader(bounds),
              child: const Icon(Icons.graphic_eq, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 8),
            const Text(
              'MusicMan',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              storage.theme == 'dark' ? Icons.light_mode : Icons.dark_mode,
            ),
            onPressed: () {
              final newTheme = storage.theme == 'dark' ? 'light' : 'dark';
              storage.updateSetting('theme', newTheme);
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => _showSettingsSheet(context, storage, player),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(child: pages[_currentIndex]),
          if (player.currentTrack != null)
            MiniPlayer(
              trackMap: player.currentTrack!.toJson(),
              isPlaying: player.isPlaying,
              progress: player.duration.inSeconds > 0
                  ? player.position.inSeconds / player.duration.inSeconds
                  : 0.0,
              onTap: () => _openFullPlayer(context),
              onTogglePlay: () => player.togglePlay(),
              onNext: () => player.nextTrack(),
            ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        selectedItemColor: Theme.of(context).colorScheme.primary,
        unselectedItemColor: Colors.white54,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Search'),
          BottomNavigationBarItem(
              icon: Icon(Icons.collections_bookmark), label: 'Library'),
        ],
      ),
    );
  }

  void _openFullPlayer(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const FullPlayerSheet(),
    );
  }

  void _showSettingsSheet(
      BuildContext context, StorageService storage, PlayerProvider player) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Settings',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.speed),
              title: const Text('Playback Speed'),
              trailing: DropdownButton<double>(
                value: storage.playbackRate,
                items: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
                    .map((r) => DropdownMenuItem(
                          value: r,
                          child: Text('${r}x'),
                        ))
                    .toList(),
                onChanged: (val) {
                  if (val != null) {
                    player.setPlaybackRate(val);
                    Navigator.pop(ctx);
                  }
                },
              ),
            ),
            ListTile(
              leading: const Icon(Icons.equalizer),
              title: const Text('Equalizer Preset'),
              subtitle: Text(storage.equalizerPreset),
              onTap: () {
                Navigator.pop(ctx);
                _showEqualizerPresets(context, player);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_forever, color: Colors.red),
              title: const Text('Reset App Data', style: TextStyle(color: Colors.red)),
              onTap: () {
                Navigator.pop(ctx);
                storage.resetAll();
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showEqualizerPresets(BuildContext context, PlayerProvider player) {
    final presets = ['Normal', 'Bass Boost', 'Treble Boost', 'Vocal', 'Rock', 'Pop'];
    showDialog(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Choose Equalizer Preset'),
        children: presets
            .map((preset) => SimpleDialogOption(
                  onPressed: () {
                    player.setEqualizerPreset(preset);
                    Navigator.pop(ctx);
                  },
                  child: Text(preset),
                ))
            .toList(),
      ),
    );
  }
}

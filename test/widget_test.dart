import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:musicman/main.dart';
import 'package:musicman/services/storage_service.dart';
import 'package:musicman/services/download_service.dart';
import 'package:musicman/providers/player_provider.dart';

void main() {
  testWidgets('App renders title with providers', (WidgetTester tester) async {
    final storageService = StorageService();
    final downloadService = DownloadService();

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<StorageService>.value(value: storageService),
          ChangeNotifierProvider<DownloadService>.value(value: downloadService),
          ChangeNotifierProvider<PlayerProvider>(
            create: (_) => PlayerProvider(
              storageService: storageService,
              downloadService: downloadService,
            ),
          ),
        ],
        child: const MusicManApp(),
      ),
    );

    expect(find.text('MusicMan'), findsWidgets);
  });
}

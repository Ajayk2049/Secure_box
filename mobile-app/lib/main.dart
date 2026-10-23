import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';

import 'config.dart';
import 'view_models/auth_view_model.dart';
import 'view_models/home_view_model.dart';
import 'view_models/websocket_view_model.dart';
import 'views/auth/login_screen.dart';
import 'views/auth/register_screen.dart';
import 'views/home/home_screen.dart';
import 'views/home/history_screen.dart';
import 'views/widgets/glass_theme.dart';

import 'services/notification_service.dart';

final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await AppConfig.init();
  } catch (_) {}
  try {
    await LiquidGlassShaders.ensureLoaded();
  } catch (_) {}
  try {
    await NotificationService().initialize();
  } catch (_) {}

  runApp(const SecureBoxApp());
}

class SecureBoxApp extends StatelessWidget {
  const SecureBoxApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthViewModel()..init()),
        ChangeNotifierProvider(create: (_) => HomeViewModel()),
        ChangeNotifierProvider(create: (_) => WebSocketViewModel()),
      ],
      child: MaterialApp(
        navigatorKey: appNavigatorKey,
        title: 'Secure Box',
        debugShowCheckedModeBanner: false,
        themeMode: ThemeMode.light,
        theme: ThemeData(
          useMaterial3: true,
          brightness: Brightness.light,
          scaffoldBackgroundColor: ParcelGlassColors.lightCanvasTop,
          textTheme: GoogleFonts.plusJakartaSansTextTheme(
            ThemeData(brightness: Brightness.light).textTheme,
          ),
          colorScheme: ColorScheme.fromSeed(
            seedColor: ParcelGlassColors.amberSignal,
            brightness: Brightness.light,
            primary: ParcelGlassColors.parcelBrown,
            secondary: ParcelGlassColors.mintSignal,
          ),
        ),
        home: const AuthGate(),
        routes: {
          '/login': (context) => const LoginScreen(),
          '/register': (context) => const RegisterScreen(),
          '/home': (context) => const HomeScreen(),
          '/history': (context) => const HistoryScreen(),
        },
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthViewModel>();

    if (!auth.initialized) {
      return const Scaffold(
        backgroundColor: ParcelGlassColors.kraftCanvas,
        body: Center(
          child: CircularProgressIndicator(
            color: ParcelGlassColors.parcelBrown,
          ),
        ),
      );
    }

    if (auth.isAuthenticated) {
      return const HomeScreen();
    }

    return const LoginScreen();
  }
}

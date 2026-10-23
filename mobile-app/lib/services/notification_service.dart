import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'api_service.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {}
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

      // Request runtime notification permission (Required for Android 13+)
      final settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      debugPrint('[FCM] Notification authorization status: ${settings.authorizationStatus}');

      // Sync FCM token upon initialization
      await syncToken();

      // Listen for token rotation
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        debugPrint('[FCM] Token refreshed');
        _sendTokenToBackend(newToken);
      });

      _initialized = true;
    } catch (e) {
      debugPrint('[FCM] Initialization notice: $e');
    }
  }

  Future<void> syncToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        debugPrint('[FCM] Device Token obtained: ${token.substring(0, 10)}...');
        await _sendTokenToBackend(token);
      }
    } catch (e) {
      debugPrint('[FCM] Error fetching token: $e');
    }
  }

  Future<void> _sendTokenToBackend(String token) async {
    try {
      await ApiService.updateFcmToken(token);
    } catch (e) {
      debugPrint('[FCM] Failed to register token with backend: $e');
    }
  }
}

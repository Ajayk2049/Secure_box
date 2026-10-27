import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const AndroidOptions _androidOptions = AndroidOptions(
    encryptedSharedPreferences: true,
    resetOnError: true,
  );

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: _androidOptions,
  );

  FlutterSecureStorage get storage => _storage;

  Future<String?> _safeRead(String key) async {
    try {
      return await _storage.read(key: key).timeout(
        const Duration(seconds: 2),
        onTimeout: () => null,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _safeWrite(String key, String value) async {
    try {
      await _storage.write(key: key, value: value).timeout(
        const Duration(seconds: 2),
      );
    } catch (_) {}
  }

  Future<void> _safeDelete(String key) async {
    try {
      await _storage.delete(key: key).timeout(
        const Duration(seconds: 2),
      );
    } catch (_) {}
  }

  Future<void> saveToken(String token) async => _safeWrite('auth_token', token);
  Future<String?> getToken() async => _safeRead('auth_token');
  Future<void> deleteToken() async => _safeDelete('auth_token');

  Future<void> saveRefreshToken(String refreshToken) async => _safeWrite('refresh_token', refreshToken);
  Future<String?> getRefreshToken() async => _safeRead('refresh_token');
  Future<void> deleteRefreshToken() async => _safeDelete('refresh_token');

  Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> saveIdentifier(String identifier) async => _safeWrite('saved_identifier', identifier);
  Future<String?> getSavedIdentifier() async => _safeRead('saved_identifier');
  Future<void> clearSavedIdentifier() async => _safeDelete('saved_identifier');

  Future<void> saveUserData(String userJson) async => _safeWrite('user_profile', userJson);
  Future<String?> getUserData() async => _safeRead('user_profile');
  Future<void> deleteUserData() async => _safeDelete('user_profile');

  // --- Local Profile Avatar Emoji (ShareIt style) ---
  Future<void> saveAvatarEmoji(String? emoji) async {
    if (emoji == null || emoji.trim().isEmpty) {
      await _safeDelete('user_avatar_emoji');
    } else {
      await _safeWrite('user_avatar_emoji', emoji.trim());
    }
  }
  Future<String?> getAvatarEmoji() async => _safeRead('user_avatar_emoji');

  // --- Cached Devices ---
  Future<void> saveCachedDevices(String devicesJson) async => _safeWrite('cached_devices', devicesJson);
  Future<String?> getCachedDevices() async => _safeRead('cached_devices');
  Future<void> deleteCachedDevices() async => _safeDelete('cached_devices');

  // --- Cached Activity History (Strict 7-Day Retention Window) ---
  Future<void> saveCachedLogs(String deviceId, List<Map<String, dynamic>> logsRaw) async {
    final cutoff = DateTime.now().subtract(const Duration(days: 7));
    final validLogs = logsRaw.where((item) {
      try {
        final tsStr = item['timestamp']?.toString();
        if (tsStr == null) return false;
        final dt = DateTime.parse(tsStr);
        return dt.isAfter(cutoff);
      } catch (_) {
        return false;
      }
    }).toList();

    await _safeWrite(
      'cached_logs_${deviceId.trim().toUpperCase()}',
      jsonEncode(validLogs),
    );
  }

  Future<List<Map<String, dynamic>>?> getCachedLogs(String deviceId) async {
    final raw = await _safeRead('cached_logs_${deviceId.trim().toUpperCase()}');
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        final cutoff = DateTime.now().subtract(const Duration(days: 7));
        final validLogs = decoded.cast<Map<String, dynamic>>().where((item) {
          try {
            final tsStr = item['timestamp']?.toString();
            if (tsStr == null) return false;
            final dt = DateTime.parse(tsStr);
            return dt.isAfter(cutoff);
          } catch (_) {
            return false;
          }
        }).toList();
        return validLogs;
      }
    } catch (_) {}
    return null;
  }

  Future<void> deleteCachedLogs(String deviceId) async =>
      _safeDelete('cached_logs_${deviceId.trim().toUpperCase()}');

  /// Purges all session tokens, credentials, and cached data on logout
  Future<void> purgeAllSessionData() async {
    await deleteToken();
    await deleteRefreshToken();
    await deleteUserData();
    await deleteCachedDevices();
  }
}

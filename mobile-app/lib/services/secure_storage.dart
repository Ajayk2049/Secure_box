import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  FlutterSecureStorage get storage => _storage;

  Future<void> saveToken(String token) async {
    await _storage.write(key: 'auth_token', value: token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: 'auth_token');
  }

  Future<void> deleteToken() async {
    await _storage.delete(key: 'auth_token');
  }

  Future<void> saveRefreshToken(String refreshToken) async {
    await _storage.write(key: 'refresh_token', value: refreshToken);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: 'refresh_token');
  }

  Future<void> deleteRefreshToken() async {
    await _storage.delete(key: 'refresh_token');
  }

  Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> saveIdentifier(String identifier) async {
    await _storage.write(key: 'saved_identifier', value: identifier);
  }

  Future<String?> getSavedIdentifier() async {
    return await _storage.read(key: 'saved_identifier');
  }

  Future<void> clearSavedIdentifier() async {
    await _storage.delete(key: 'saved_identifier');
  }

  Future<void> saveUserData(String userJson) async {
    await _storage.write(key: 'user_profile', value: userJson);
  }

  Future<String?> getUserData() async {
    return await _storage.read(key: 'user_profile');
  }

  Future<void> deleteUserData() async {
    await _storage.delete(key: 'user_profile');
  }

  // --- Cached Devices ---
  Future<void> saveCachedDevices(String devicesJson) async {
    await _storage.write(key: 'cached_devices', value: devicesJson);
  }

  Future<String?> getCachedDevices() async {
    return await _storage.read(key: 'cached_devices');
  }

  Future<void> deleteCachedDevices() async {
    await _storage.delete(key: 'cached_devices');
  }

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

    await _storage.write(
      key: 'cached_logs_${deviceId.trim().toUpperCase()}',
      value: jsonEncode(validLogs),
    );
  }

  Future<List<Map<String, dynamic>>?> getCachedLogs(String deviceId) async {
    final raw = await _storage.read(key: 'cached_logs_${deviceId.trim().toUpperCase()}');
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

  Future<void> deleteCachedLogs(String deviceId) async {
    await _storage.delete(key: 'cached_logs_${deviceId.trim().toUpperCase()}');
  }

  /// Purges all session tokens, credentials, and cached data on logout
  Future<void> purgeAllSessionData() async {
    await deleteToken();
    await deleteRefreshToken();
    await deleteUserData();
    await deleteCachedDevices();
  }
}

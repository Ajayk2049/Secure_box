import 'dart:convert';
import '../models/device.model.dart';
import '../models/log.model.dart';
import 'secure_storage.dart';

class DeviceCacheManager {
  final SecureStorage _storage;

  DeviceCacheManager({SecureStorage? storage}) : _storage = storage ?? SecureStorage();

  Future<List<DeviceModel>> loadCachedDevices() async {
    try {
      final cachedJson = await _storage.getCachedDevices();
      if (cachedJson != null && cachedJson.isNotEmpty) {
        final decoded = jsonDecode(cachedJson);
        if (decoded is List && decoded.isNotEmpty) {
          return decoded.map((j) {
            final model = DeviceModel.fromJson(j);
            return model.copyWith(online: false);
          }).toList();
        }
      }
    } catch (_) {}
    return [];
  }

  Future<List<LogModel>> loadCachedLogs(String deviceId) async {
    try {
      final cached = await _storage.getCachedLogs(deviceId);
      if (cached != null && cached.isNotEmpty) {
        return cached.map((j) => LogModel.fromJson(j)).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<void> saveCachedDevices(List<dynamic> rawDevices) async {
    try {
      await _storage.saveCachedDevices(jsonEncode(rawDevices));
    } catch (_) {}
  }

  Future<void> saveCachedLogs(String deviceId, List<dynamic> rawLogs) async {
    try {
      await _storage.saveCachedLogs(
        deviceId,
        rawLogs.whereType<Map<String, dynamic>>().toList(),
      );
    } catch (_) {}
  }

  List<DeviceModel> applyRecentUnlocks(
    List<DeviceModel> freshList,
    Map<String, DateTime> recentlyUnlockedUntil,
  ) {
    final now = DateTime.now();
    recentlyUnlockedUntil.removeWhere((_, until) => now.isAfter(until));

    if (recentlyUnlockedUntil.isEmpty) return freshList;

    return freshList.map((d) {
      final idUpper = d.id.trim().toUpperCase();
      final codeUpper = d.deviceId.trim().toUpperCase();
      if (recentlyUnlockedUntil.containsKey(idUpper) || recentlyUnlockedUntil.containsKey(codeUpper)) {
        return d.copyWith(doorState: 'open', online: true);
      }
      return d;
    }).toList();
  }

  bool haveDevicesChanged(List<DeviceModel> current, List<DeviceModel> fresh) {
    if (current.length != fresh.length) return true;
    for (int i = 0; i < current.length; i++) {
      if (current[i].online != fresh[i].online ||
          current[i].doorState != fresh[i].doorState ||
          current[i].name != fresh[i].name ||
          current[i].isOwner != fresh[i].isOwner ||
          current[i].userRole != fresh[i].userRole) {
        return true;
      }
    }
    return false;
  }
}

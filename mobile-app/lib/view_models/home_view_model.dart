import 'dart:async';
import 'package:flutter/material.dart';
import '../models/device.model.dart';
import '../models/log.model.dart';
import '../services/api_service.dart';
import '../services/connectivity_service.dart';
import '../services/device_cache_manager.dart';
import '../services/websocket_service.dart';

class HomeViewModel extends ChangeNotifier {
  final ApiService _api = ApiService();
  final WebSocketService _ws = WebSocketService();
  final ConnectivityService _connectivity = ConnectivityService();
  final DeviceCacheManager _cacheManager = DeviceCacheManager();

  Timer? _pollTimer;
  StreamSubscription<String>? _sessionExpirySub;
  StreamSubscription<Map<String, dynamic>>? _wsMessageSub;
  final Map<String, DateTime> _recentlyUnlockedUntil = {};

  List<DeviceModel> _devices = [];
  List<LogModel> _logs = [];
  bool _loading = true;
  String? _error;
  String? _selectedDeviceId;
  bool _isFetchingLogs = false;
  ConnectionIssue _connectionIssue = ConnectionIssue.none;
  bool _isDiagnosing = false;
  bool _isCheckingReachability = true;

  int _failedPollAttempts = 0;
  static const int maxFailedAttempts = 3;
  bool _isInitialized = false;

  List<DeviceModel> get devices => _devices;
  List<LogModel> get logs => _logs;
  bool get loading => _loading;
  String? get error => _error;
  String? get selectedDeviceId => _selectedDeviceId;
  ConnectionIssue get connectionIssue => _connectionIssue;
  bool get isOffline => _connectionIssue != ConnectionIssue.none;
  bool get isCheckingReachability => _isCheckingReachability;

  DeviceModel? get selectedDevice {
    if (_selectedDeviceId == null) return null;
    try {
      return _devices.firstWhere((d) => d.id == _selectedDeviceId);
    } catch (_) {
      return null;
    }
  }

  Future<void> init() async {
    if (_isInitialized) return;
    _isInitialized = true;
    _isCheckingReachability = true;
    _loading = true;
    notifyListeners();

    // Listen for global session expiry events (from 401s or WS 4401 close code)
    _sessionExpirySub?.cancel();
    _sessionExpirySub = ApiService.onSessionExpired.stream.listen((_) {
      _connectionIssue = ConnectionIssue.sessionExpired;
      _devices = _devices.map((d) => d.copyWith(online: false)).toList();
      notifyListeners();
    });

    // 1. Perform fast startup connectivity diagnosis (<1.5s)
    final initialIssue = await _connectivity.checkConnectivity();
    _connectionIssue = initialIssue;
    _isCheckingReachability = false;

    if (initialIssue != ConnectionIssue.none) {
      // If device is offline on app start, load cached names as fallback with offline status
      await _loadCachedDevices();
      _devices = _devices.map((d) => d.copyWith(online: false)).toList();
      _loading = false;
      notifyListeners();
    } else {
      _ws.connect();
      _wsMessageSub?.cancel();
      _wsMessageSub = _ws.stream.listen((message) {
        _handleWebSocketMessage(message);
      });
      // Always get fresh live status directly from the server on startup
      await fetchDevices();
    }

    _setupPollTimer();
  }

  void _setupPollTimer() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _fetchDevicesSilent();
    });
  }

  Future<void> _loadCachedDevices() async {
    final cached = await _cacheManager.loadCachedDevices();
    if (cached.isNotEmpty) {
      _devices = cached;
      _selectedDeviceId ??= _devices.first.deviceId;
      notifyListeners();
      _loadCachedLogs(_selectedDeviceId!);
    }
  }

  Future<void> _loadCachedLogs(String deviceId) async {
    final cached = await _cacheManager.loadCachedLogs(deviceId);
    if (cached.isNotEmpty) {
      _logs = cached;
      notifyListeners();
    }
  }

  bool _matchesDevice(DeviceModel d, String idUpper) =>
      d.id.trim().toUpperCase() == idUpper || d.deviceId.trim().toUpperCase() == idUpper;

  void _handleWebSocketMessage(Map<String, dynamic> message) {
    final type = message['type']?.toString();
    final targetDeviceId = message['deviceId']?.toString();
    if (type == 'EMERGENCY_UNLOCK' && targetDeviceId != null) {
      fetchDeviceLogs(targetDeviceId);
    }

    const stateEvents = {
      'DEVICE_STATUS', 'DOOR_OPEN', 'EMERGENCY_UNLOCK',
      'DELIVERY_SUCCESS', 'UNLOCK_COMMAND', 'DEVICE_ONLINE', 'DEVICE_OFFLINE'
    };
    if (type == null || !stateEvents.contains(type)) return;

    if (targetDeviceId == null) {
      _fetchDevicesSilent();
      return;
    }

    final targetUpper = targetDeviceId.trim().toUpperCase();
    final newDoorState = (type == 'DOOR_OPEN' || type == 'EMERGENCY_UNLOCK' || type == 'UNLOCK_COMMAND')
        ? 'open'
        : message['doorState']?.toString();

    // Clean up temporary unlock overrides on door closure
    if (newDoorState == 'closed') {
      _recentlyUnlockedUntil.remove(targetUpper);
      for (final d in _devices) {
        if (_matchesDevice(d, targetUpper)) {
          _recentlyUnlockedUntil.remove(d.id.trim().toUpperCase());
          _recentlyUnlockedUntil.remove(d.deviceId.trim().toUpperCase());
        }
      }
    }

    final isOnline = type == 'DEVICE_ONLINE'
        ? true
        : (type == 'DEVICE_OFFLINE' ? false : message['online'] as bool?);

    final idx = _devices.indexWhere((d) => _matchesDevice(d, targetUpper));
    if (idx != -1) {
      _devices[idx] = _devices[idx].copyWith(
        doorState: newDoorState ?? _devices[idx].doorState,
        online: isOnline ?? _devices[idx].online,
      );
      notifyListeners();
    } else {
      _fetchDevicesSilent();
    }
  }

  Future<void> _fetchDevicesSilent() async {
    try {
      final devicesData = await _api.getDevices();
      _failedPollAttempts = 0;
      if (_connectionIssue != ConnectionIssue.none && _connectionIssue != ConnectionIssue.sessionExpired) {
        _connectionIssue = ConnectionIssue.none;
        notifyListeners();
      }
      final newDevices = devicesData
          .map((json) => DeviceModel.fromJson(json))
          .toList();

      _cacheManager.saveCachedDevices(devicesData);
      final updatedDevices = _cacheManager.applyRecentUnlocks(newDevices, _recentlyUnlockedUntil);

      if (_cacheManager.haveDevicesChanged(_devices, updatedDevices)) {
        _devices = updatedDevices;
        for (final d in _devices) {
          _ws.joinRoom(d.id);
          _ws.joinRoom(d.deviceId);
        }
        notifyListeners();
      }
    } catch (e) {
      final errLower = e.toString().toLowerCase();
      if (errLower.contains('401') || errLower.contains('unauthorized')) {
        _connectionIssue = ConnectionIssue.sessionExpired;
        notifyListeners();
        return;
      }
      _failedPollAttempts++;
      if (_failedPollAttempts >= maxFailedAttempts) {
        _diagnoseConnectivity();
      }
    }
  }

  Future<void> fetchDevices() async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final devicesData = await _api.getDevices();
      _failedPollAttempts = 0;
      if (_connectionIssue != ConnectionIssue.none && _connectionIssue != ConnectionIssue.sessionExpired) {
        _connectionIssue = ConnectionIssue.none;
      }
      final rawDevices = devicesData
          .map((json) => DeviceModel.fromJson(json))
          .toList();

      _cacheManager.saveCachedDevices(devicesData);
      _devices = _cacheManager.applyRecentUnlocks(rawDevices, _recentlyUnlockedUntil);

      for (final d in _devices) {
        _ws.joinRoom(d.id);
        _ws.joinRoom(d.deviceId);
      }

      _loading = false;
      notifyListeners();

      if (_devices.isNotEmpty) {
        final devId = _selectedDeviceId ?? _devices.first.deviceId;
        fetchDeviceLogs(devId);
      }
    } catch (e) {
      _error = e.toString();
      _loading = false;
      if (_devices.isEmpty) {
        await _loadCachedDevices();
      }
      _devices = _devices.map((d) => d.copyWith(online: false)).toList();
      final errLower = e.toString().toLowerCase();
      if (errLower.contains('401') || errLower.contains('unauthorized')) {
        _connectionIssue = ConnectionIssue.sessionExpired;
        notifyListeners();
      } else {
        notifyListeners();
        _diagnoseConnectivity();
      }
    }
  }

  Future<void> _diagnoseConnectivity() async {
    if (_isDiagnosing || _connectionIssue == ConnectionIssue.sessionExpired) return;
    _isDiagnosing = true;
    try {
      final issue = await _connectivity.checkConnectivity();
      if (_connectionIssue != issue) {
        _connectionIssue = issue;
        if (issue != ConnectionIssue.none) {
          _devices = _devices.map((d) => d.copyWith(online: false)).toList();
        }
        notifyListeners();
      }
    } finally {
      _isDiagnosing = false;
    }
  }

  Future<void> retryConnection() async {
    if (_connectionIssue == ConnectionIssue.sessionExpired) {
      notifyListeners();
      return;
    }
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final issue = await _connectivity.checkConnectivity();
      _connectionIssue = issue;
      if (issue == ConnectionIssue.none) {
        _failedPollAttempts = 0;
        _ws.connect();
        await fetchDevices();
      } else {
        _devices = _devices.map((d) => d.copyWith(online: false)).toList();
        _loading = false;
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> unlockDevice(String deviceId) async {
    if (isOffline || _isCheckingReachability) {
      throw Exception('Server unreachable. Unlock disabled.');
    }
    _error = null;
    final targetUpper = deviceId.trim().toUpperCase();

    final targetIndex = _devices.indexWhere((d) => _matchesDevice(d, targetUpper));
    if (targetIndex == -1) {
      throw Exception('Locker not found.');
    }
    if (!_devices[targetIndex].online) {
      throw Exception('Locker is currently offline.');
    }

    _recentlyUnlockedUntil[targetUpper] = DateTime.now().add(const Duration(seconds: 10));

    _devices[targetIndex] = _devices[targetIndex].copyWith(doorState: 'open');
    notifyListeners();

    try {
      await _api.unlockDevice(deviceId);
      Future.delayed(const Duration(milliseconds: 600), () => fetchDeviceLogs(deviceId));
      Future.delayed(const Duration(milliseconds: 1500), () => _fetchDevicesSilent());
      Future.delayed(const Duration(seconds: 4), () => _fetchDevicesSilent());
    } catch (e) {
      _recentlyUnlockedUntil.remove(targetUpper);
      _error = e.toString();
      final idx = _devices.indexWhere((d) => _matchesDevice(d, targetUpper));
      if (idx != -1) {
        _devices[idx] = _devices[idx].copyWith(doorState: 'closed');
      }
      notifyListeners();
      _diagnoseConnectivity();
      rethrow;
    }
  }

  Future<void> fetchDeviceLogs(String deviceId) async {
    _selectedDeviceId = deviceId;
    if (_isFetchingLogs) return;
    _isFetchingLogs = true;

    try {
      final logsData = await _api.getDeviceLogs(deviceId);
      _logs = logsData.map((json) => LogModel.fromJson(json)).toList();
      _ws.joinRoom(deviceId);
      notifyListeners();

      await _cacheManager.saveCachedLogs(deviceId, logsData);
    } catch (e) {
      _error = e.toString();
      final cached = await _cacheManager.loadCachedLogs(deviceId);
      if (cached.isNotEmpty) {
        _logs = cached;
      }
      notifyListeners();
    } finally {
      _isFetchingLogs = false;
    }
  }

  Future<void> pairNewDevice(String deviceId, String name) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      await _api.pairDevice(deviceId: deviceId, name: name);
      await fetchDevices();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> joinDeviceViaCode(String inviteCode) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      await _api.joinDevice(inviteCode);
      await fetchDevices();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> renameDevice(String deviceId, String newName) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      await _api.updateDeviceName(deviceId, newName);
      final index = _devices.indexWhere((d) => _matchesDevice(d, deviceId.trim().toUpperCase()));
      if (index != -1) {
        _devices[index] = _devices[index].copyWith(name: newName);
      }
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      rethrow;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _sessionExpirySub?.cancel();
    _wsMessageSub?.cancel();
    _pollTimer?.cancel();
    _ws.dispose();
    super.dispose();
  }
}

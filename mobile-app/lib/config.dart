import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AppConfig {
  static const String defaultLocalHost = '192.168.0.102:4300';
  static const String prodHost = 'api.yourdomain.com';

  static bool _isProd = false;
  static String _activeHost = defaultLocalHost;
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static const String _hostStorageKey = 'smartbox_server_host';

  static Future<void> init({bool? isProd}) async {
    final savedHost = await _storage.read(key: _hostStorageKey);
    if (savedHost != null && _isValidDevHost(savedHost)) {
      _activeHost = savedHost.trim();
      _isProd = false;
    } else {
      _activeHost = defaultLocalHost;
      _isProd = isProd ?? false;
    }
  }

  static void setEnvironment({required bool isProd}) {
    _isProd = isProd;
  }

  static bool get isProd => _isProd;

  static String get currentHost => _isProd ? prodHost : _activeHost;

  /// Validates that a host belongs to loopback, LAN, or VPS IP addresses for testing
  static bool _isValidDevHost(String host) {
    final clean = host.trim().replaceAll('http://', '').replaceAll('https://', '').replaceAll('/', '');
    final hostOnly = clean.contains(':') ? clean.split(':').first : clean;
    return hostOnly == 'localhost' ||
        hostOnly == '127.0.0.1' ||
        hostOnly == '10.0.2.2' ||
        RegExp(r'^(\d{1,3}\.){3}\d{1,3}$').hasMatch(hostOnly);
  }

  static Future<bool> updateHost(String newHost) async {
    final clean = newHost.trim().replaceAll('http://', '').replaceAll('https://', '').replaceAll('/', '');
    if (_isValidDevHost(clean)) {
      _activeHost = clean;
      _isProd = false;
      await _storage.write(key: _hostStorageKey, value: clean);
      return true;
    } else if (clean == prodHost) {
      _isProd = true;
      await _storage.write(key: _hostStorageKey, value: clean);
      return true;
    }
    return false;
  }

  static Future<void> resetToDefaultHost() async {
    _activeHost = defaultLocalHost;
    _isProd = false;
    await _storage.delete(key: _hostStorageKey);
  }

  static String get baseUrl {
    if (_isProd) return 'https://$prodHost';
    return 'http://$_activeHost';
  }

  static String get wsUrl {
    if (_isProd) return 'wss://$prodHost/ws';
    return 'ws://$_activeHost/ws';
  }
}

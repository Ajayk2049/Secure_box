class AppConfig {
  static const String serverHost = '72.61.141.178:7000';
  static const String defaultLocalHost = serverHost;
  static const String prodHost = serverHost;

  static bool _isProd = false;

  static Future<void> init({bool? isProd}) async {
    _isProd = isProd ?? false;
  }

  static void setEnvironment({required bool isProd}) {
    _isProd = isProd;
  }

  static bool get isProd => _isProd;

  static String get currentHost => serverHost;

  static String get baseUrl {
    if (_isProd) return 'https://$serverHost';
    return 'http://$serverHost';
  }

  static String get wsUrl {
    if (_isProd) return 'wss://$serverHost/ws';
    return 'ws://$serverHost/ws';
  }
}

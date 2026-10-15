import 'dart:async';
import 'dart:io';
import 'api_service.dart';

enum ConnectionIssue {
  none,
  noInternet,
  serverUnreachable,
  sessionExpired,
}

class ConnectivityService {
  static final ConnectivityService _instance = ConnectivityService._internal();
  factory ConnectivityService() => _instance;
  ConnectivityService._internal();

  final ApiService _api = ApiService();

  /// Checks whether the server is reachable or if the device lacks internet connectivity.
  Future<ConnectionIssue> checkConnectivity({Duration timeout = const Duration(milliseconds: 1500)}) async {
    try {
      // Run server health ping and internet access check concurrently for max responsiveness (<1.5s)
      final serverCheck = _api.checkHealth(null, timeout);
      final internetCheck = hasInternetAccess(timeout: timeout);

      final results = await Future.wait([serverCheck, internetCheck]);
      final isServerAlive = results[0];
      final hasInternet = results[1];

      if (isServerAlive) {
        return ConnectionIssue.none;
      }

      if (!hasInternet) {
        return ConnectionIssue.noInternet;
      }

      return ConnectionIssue.serverUnreachable;
    } catch (_) {
      return ConnectionIssue.serverUnreachable;
    }
  }

  /// Verifies if device has basic DNS/network connectivity
  Future<bool> hasInternetAccess({Duration timeout = const Duration(milliseconds: 1500)}) async {
    try {
      final result = await InternetAddress.lookup('dns.google').timeout(timeout);
      return result.isNotEmpty && result[0].rawAddress.isNotEmpty;
    } catch (_) {
      try {
        final fallback = await InternetAddress.lookup('1.1.1.1').timeout(timeout);
        return fallback.isNotEmpty && fallback[0].rawAddress.isNotEmpty;
      } catch (_) {
        return false;
      }
    }
  }
}

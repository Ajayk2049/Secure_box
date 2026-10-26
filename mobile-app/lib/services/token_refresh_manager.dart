import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../config.dart';
import 'api_service.dart';
import 'secure_storage.dart';
import 'websocket_service.dart';

/// Single-flight manager for token refresh operations.
/// Prevents concurrent refresh token race conditions and protects against
/// false-positive token reuse invalidation.
class TokenRefreshManager {
  static final TokenRefreshManager _instance = TokenRefreshManager._internal();
  factory TokenRefreshManager() => _instance;
  TokenRefreshManager._internal();

  final SecureStorage _storage = SecureStorage();
  Completer<String?>? _inFlightRefresh;

  Dio get _refreshClient {
    return Dio(BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
      },
    ));
  }

  /// Refreshes the access token using the stored refresh token.
  /// If a refresh is already in-flight, returns the pending Future instead of
  /// creating duplicate concurrent requests.
  Future<String?> refreshToken() async {
    if (_inFlightRefresh != null) {
      debugPrint('[AUTH-REFRESH] Refresh already in-flight. Joining existing request.');
      return _inFlightRefresh!.future;
    }

    final completer = Completer<String?>();
    _inFlightRefresh = completer;

    try {
      final storedRefreshToken = await _storage.getRefreshToken();
      if (storedRefreshToken == null || storedRefreshToken.isEmpty) {
        debugPrint('[AUTH-REFRESH] No refresh token found in secure storage.');
        completer.complete(null);
        return null;
      }

      debugPrint('[AUTH-REFRESH] Initiating single-flight token rotation...');
      final response = await _refreshClient.post(
        '/api/auth/refresh',
        data: {'refreshToken': storedRefreshToken},
      );

      if (response.statusCode == 200 && response.data is Map && response.data['token'] != null) {
        final newToken = response.data['token'] as String;
        final newRefreshToken = response.data['refreshToken'] as String?;

        await _storage.saveToken(newToken);
        if (newRefreshToken != null && newRefreshToken.isNotEmpty) {
          await _storage.saveRefreshToken(newRefreshToken);
        }

        debugPrint('[AUTH-REFRESH] Token rotation successful. Reconnecting WebSocket with new token.');
        WebSocketService().reconnectWithNewToken(newToken);

        completer.complete(newToken);
        return newToken;
      } else {
        completer.complete(null);
        return null;
      }
    } on DioException catch (dioErr) {
      final statusCode = dioErr.response?.statusCode;
      debugPrint('[AUTH-REFRESH] Token refresh failed with status: $statusCode');

      // ONLY expire the user session if the backend explicitly rejected the refresh token (401/403)
      if (statusCode == 401 || statusCode == 403) {
        debugPrint('[AUTH-REFRESH] Refresh token rejected by server. Cleaning credentials and notifying session expiry.');
        await _storage.deleteToken();
        await _storage.deleteRefreshToken();
        ApiService.onSessionExpired.add('Your session has expired. Please sign in again.');
      } else {
        debugPrint('[AUTH-REFRESH] Transient network or server error during refresh. Retaining credentials.');
      }

      completer.complete(null);
      return null;
    } catch (e) {
      debugPrint('[AUTH-REFRESH] Unexpected error during refresh: $e');
      completer.complete(null);
      return null;
    } finally {
      _inFlightRefresh = null;
    }
  }
}

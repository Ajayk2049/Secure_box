import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config.dart';
import 'api_service.dart';
import 'secure_storage.dart';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;
  WebSocketService._internal();

  final SecureStorage _storage = SecureStorage();
  WebSocketChannel? _channel;
  final Set<String> _joinedRooms = {};
  final StreamController<Map<String, dynamic>> _controller =
      StreamController<Map<String, dynamic>>.broadcast();

  bool _isConnected = false;
  bool _isConnecting = false;
  Timer? _reconnectTimer;
  Timer? _pingTimer;

  Stream<Map<String, dynamic>> get stream => _controller.stream;
  bool get isConnected => _isConnected;

  Future<void> connect() async {
    if (_isConnected || _isConnecting) return;
    _isConnecting = true;
    _reconnectTimer?.cancel();

    try {
      final token = await _storage.getToken();
      if (token == null || token.isEmpty) {
        debugPrint('WebSocket: No auth token found. Skipping connection.');
        _isConnecting = false;
        return;
      }

      try {
        _channel?.sink.close();
      } catch (_) {}

      final uri = Uri.parse('${AppConfig.wsUrl}?token=$token');
      final channel = WebSocketChannel.connect(uri);
      _channel = channel;

      channel.stream.listen(
        (data) {
          if (!_isConnected) {
            _isConnected = true;
            _isConnecting = false;
            _startPingTimer();
          }
          try {
            final message = jsonDecode(data.toString());
            if (message is Map<String, dynamic>) {
              if (message['type'] == 'PONG') return;
              if (message['type'] == 'ERROR') {
                final err = message['error']?.toString().toLowerCase() ?? '';
                if (err.contains('expired') || err.contains('unauthorized')) {
                  ApiService.onSessionExpired.add("Your session has expired. Please sign in again.");
                  disconnect();
                  return;
                }
              }
              _controller.add(message);
            }
          } catch (_) {}
        },
        onError: (error) {
          debugPrint('WebSocket error: $error');
          _handleDisconnect();
        },
        onDone: () {
          final code = _channel?.closeCode;
          final reason = _channel?.closeReason;
          if (code == 4401 || (reason != null && reason.toLowerCase().contains('expired'))) {
            debugPrint('WebSocket closed due to expired token (code: $code, reason: $reason)');
            ApiService.onSessionExpired.add("Your session has expired. Please sign in again.");
            disconnect();
            return;
          }
          _handleDisconnect();
        },
        cancelOnError: true,
      );

      _isConnected = true;
      _isConnecting = false;
      _startPingTimer();

      // Re-join existing rooms upon connection
      for (final room in _joinedRooms) {
        _channel?.sink.add(jsonEncode({
          'type': 'JOIN_ROOM',
          'deviceId': room,
        }));
      }
    } catch (e) {
      debugPrint('WebSocket connect exception: $e');
      _handleDisconnect();
    }
  }

  void _startPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      if (_isConnected && _channel != null) {
        try {
          _channel?.sink.add(jsonEncode({'type': 'PING'}));
        } catch (_) {}
      }
    });
  }

  void _handleDisconnect() {
    _isConnected = false;
    _isConnecting = false;
    _pingTimer?.cancel();
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 4), () {
      connect();
    });
  }

  Future<void> reconnectWithNewToken([String? freshToken]) async {
    disconnect();
    if (freshToken != null && freshToken.isNotEmpty) {
      await _storage.saveToken(freshToken);
    }
    await connect();
  }

  void joinRoom(String deviceId) {
    if (deviceId.trim().isEmpty) return;
    final clean = deviceId.trim().toUpperCase();
    _joinedRooms.add(clean);
    if (_isConnected && _channel != null) {
      try {
        _channel?.sink.add(jsonEncode({
          'type': 'JOIN_ROOM',
          'deviceId': clean,
        }));
      } catch (_) {}
    }
  }

  void disconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _pingTimer?.cancel();
    _pingTimer = null;
    _isConnected = false;
    _isConnecting = false;
    try {
      _channel?.sink.close();
    } catch (_) {}
    _channel = null;
  }

  void dispose() {
    disconnect();
    _controller.close();
  }
}

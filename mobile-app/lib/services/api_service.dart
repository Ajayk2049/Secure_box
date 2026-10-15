import 'dart:async';
import 'package:dio/dio.dart';
import '../config.dart';
import 'api_error_handler.dart';
import 'secure_storage.dart';
import 'websocket_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  static final StreamController<String> onSessionExpired = StreamController<String>.broadcast();

  Dio get _client {
    return Dio(BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: const Duration(seconds: 3),
      receiveTimeout: const Duration(seconds: 4),
    ));
  }

  final SecureStorage _storage = SecureStorage();

  Future<Dio> get authDio async {
    final token = await _storage.getToken();
    final dio = Dio(BaseOptions(
      baseUrl: AppConfig.baseUrl,
      connectTimeout: const Duration(seconds: 3),
      receiveTimeout: const Duration(seconds: 4),
      headers: {
        if (token != null) 'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    ));

    dio.interceptors.add(
      InterceptorsWrapper(
        onError: (DioException error, ErrorInterceptorHandler handler) async {
          if (error.response?.statusCode == 401 && !error.requestOptions.path.contains('/auth/refresh')) {
            try {
              final refreshToken = await _storage.getRefreshToken();
              if (refreshToken != null && refreshToken.isNotEmpty) {
                // Call /api/auth/refresh to rotate tokens
                final refreshRes = await _client.post('/api/auth/refresh', data: {
                  'refreshToken': refreshToken,
                });

                if (refreshRes.statusCode == 200 && refreshRes.data['token'] != null) {
                  final newToken = refreshRes.data['token'];
                  final newRefreshToken = refreshRes.data['refreshToken'];

                  await _storage.saveToken(newToken);
                  if (newRefreshToken != null) {
                    await _storage.saveRefreshToken(newRefreshToken);
                  }

                  // Immediately reconnect WebSocket with the rotated access token
                  WebSocketService().reconnectWithNewToken(newToken);

                  // Retry the original failed request with the new access token
                  final opts = error.requestOptions;
                  opts.headers['Authorization'] = 'Bearer $newToken';
                  final cloneReq = await dio.request(
                    opts.path,
                    options: Options(
                      method: opts.method,
                      headers: opts.headers,
                    ),
                    data: opts.data,
                    queryParameters: opts.queryParameters,
                  );
                  return handler.resolve(cloneReq);
                }
              }
            } catch (_) {
              // Token refresh failed or revoked
            }

            // Both access and refresh tokens are invalid or expired
            await _storage.deleteToken();
            await _storage.deleteRefreshToken();
            onSessionExpired.add("Your session has expired. Please sign in again.");
          }
          return handler.next(error);
        },
      ),
    );

    return dio;
  }

  // 0. Quick local Wi-Fi connection check with snappy timeout
  Future<bool> checkHealth([String? host, Duration timeout = const Duration(milliseconds: 1500)]) async {
    final targetUrl = host != null
        ? 'http://${host.replaceAll('http://', '').replaceAll('/', '')}/api/health'
        : '${AppConfig.baseUrl}/api/health';
    try {
      final res = await Dio(BaseOptions(
        connectTimeout: timeout,
        receiveTimeout: timeout,
      )).get(targetUrl);
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }


  // 1. Smart Pre-Check & Send OTP
  Future<Map<String, dynamic>> sendOtp(String phone) async {
    try {
      final response = await _client.post('/api/auth/send-otp', data: {
        'phone': phone,
      });
      return response.data;
    } on DioException catch (e) {
      if (e.response != null && e.response!.data is Map) {
        return Map<String, dynamic>.from(e.response!.data);
      }
      throw Exception(extractErrorMessage(e, 'Failed to send OTP code'));
    }
  }

  // 2. Register with OTP (+ optional Join Code)
  Future<Map<String, dynamic>> registerWithOtp({
    required String phone,
    required String otp,
    required String password,
    String? name,
    String? inviteCode,
  }) async {
    try {
      final response = await _client.post('/api/auth/register-with-otp', data: {
        'phone': phone,
        'otp': otp,
        'password': password,
        if (name != null && name.isNotEmpty) 'name': name,
        if (inviteCode != null && inviteCode.isNotEmpty) 'inviteCode': inviteCode,
      });
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Registration failed'));
    }
  }

  // 3. Login (Phone or Email + Password)
  Future<Map<String, dynamic>> login(String identifier, String password) async {
    try {
      final response = await _client.post('/api/auth/login', data: {
        'identifier': identifier,
        'password': password,
      });
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Invalid mobile number/email or password'));
    }
  }

  // 3b. Current Authenticated Profile (Session Check)
  Future<Map<String, dynamic>> getMe() async {
    try {
      final dio = await authDio;
      final response = await dio.get('/api/auth/me');
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Session expired. Please sign in again.'));
    }
  }

  // 3c. Logout (Revoke Refresh Token)
  Future<void> logout() async {
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken != null) {
        await _client.post('/api/auth/logout', data: {
          'refreshToken': refreshToken,
        });
      }
    } catch (_) {}
  }

  // 4. Device Management
  Future<List<dynamic>> getDevices() async {
    try {
      final dio = await authDio;
      final response = await dio.get('/api/devices');
      return response.data['devices'];
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to load devices'));
    }
  }

  Future<Map<String, dynamic>> pairDevice({
    required String deviceId,
    required String name,
  }) async {
    try {
      final dio = await authDio;
      final response = await dio.post('/api/devices', data: {
        'deviceId': deviceId.trim().toUpperCase(),
        'name': name.trim(),
      });
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to link locker device'));
    }
  }

  Future<void> unlockDevice(String deviceId) async {
    try {
      final dio = await authDio;
      await dio.post('/api/devices/$deviceId/unlock', data: {});
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to unlock device'));
    }
  }

  Future<List<dynamic>> getDeviceLogs(String deviceId) async {
    try {
      final dio = await authDio;
      final response = await dio.get('/api/devices/$deviceId/logs');
      return response.data['logs'];
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to load device logs'));
    }
  }

  // 5. Join Code Co-Owner System
  Future<Map<String, dynamic>> createInviteCode(String deviceId) async {
    try {
      final dio = await authDio;
      final response = await dio.post('/api/devices/$deviceId/invite', data: {});
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to create invite code'));
    }
  }

  Future<Map<String, dynamic>> joinDevice(String inviteCode) async {
    try {
      final dio = await authDio;
      final response = await dio.post('/api/devices/join', data: {
        'inviteCode': inviteCode,
      });
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to join locker'));
    }
  }

  Future<Map<String, dynamic>> updateProfile({String? name, String? email}) async {
    try {
      final dio = await authDio;
      final response = await dio.patch('/api/auth/profile', data: {
        if (name != null) 'name': name.trim(),
        if (email != null) 'email': email.trim(),
      });
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to update profile'));
    }
  }

  Future<Map<String, dynamic>> updateDeviceName(String deviceId, String name) async {
    try {
      final dio = await authDio;
      final response = await dio.patch('/api/devices/$deviceId/name', data: {
        'name': name.trim(),
      });
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to rename locker'));
    }
  }

  Future<Map<String, dynamic>> getDeviceSlots(String deviceId) async {
    try {
      final dio = await authDio;
      final response = await dio.get('/api/devices/$deviceId/slots');
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to load locker access slots'));
    }
  }

  Future<Map<String, dynamic>> removeCoOwner(String deviceId, String userId) async {
    try {
      final dio = await authDio;
      final response = await dio.delete('/api/devices/$deviceId/co-owners/$userId');
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to revoke co-owner access'));
    }
  }

  Future<Map<String, dynamic>> renameCoOwner(String deviceId, String userId, String nickname) async {
    try {
      final dio = await authDio;
      final response = await dio.patch('/api/devices/$deviceId/co-owners/$userId', data: {
        'nickname': nickname.trim(),
      });
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to rename co-owner'));
    }
  }

  Future<Map<String, dynamic>> getSlotPricing() async {
    try {
      final dio = await authDio;
      final response = await dio.get('/api/pricing/slots');
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to fetch slot pricing'));
    }
  }

  Future<Map<String, dynamic>> requestSlotUpgrade(
    String deviceId, {
    int desiredSlots = 5,
    String? plan = 'yearly',
    String? notes,
  }) async {
    try {
      final dio = await authDio;
      final response = await dio.post('/api/devices/$deviceId/slots/upgrade', data: {
        'desiredSlots': desiredSlots,
        if (plan != null) 'plan': plan,
        if (notes != null) 'notes': notes,
      });
      return response.data;
    } on DioException catch (e) {
      throw Exception(extractErrorMessage(e, 'Failed to submit slot upgrade request'));
    }
  }
}




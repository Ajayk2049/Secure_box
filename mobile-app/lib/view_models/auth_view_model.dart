import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/user.model.dart';
import '../services/api_service.dart';
import '../services/secure_storage.dart';
import '../services/websocket_service.dart';

class AuthViewModel extends ChangeNotifier {
  final ApiService _api = ApiService();
  final SecureStorage _storage = SecureStorage();

  UserModel? _user;
  bool _loading = false;
  bool _initialized = false;
  String? _error;
  String? _savedIdentifier;

  UserModel? get user => _user;
  bool get loading => _loading;
  bool get initialized => _initialized;
  String? get error => _error;
  String? get savedIdentifier => _savedIdentifier;
  bool get isAuthenticated => _user != null;

  Future<void> init() async {
    _loading = true;
    notifyListeners();

    // Listen for global session expiry events triggered by 401 responses
    ApiService.onSessionExpired.stream.listen((message) {
      _user = null;
      _error = message;
      notifyListeners();
    });

    try {
      _savedIdentifier = await _storage.getSavedIdentifier();

      final hasToken = await _storage.hasToken();
      if (hasToken) {
        try {
          final res = await _api.getMe();
          if (res['user'] != null) {
            _user = UserModel.fromJson(res['user']);
            await _storage.saveUserData(jsonEncode(res['user']));
          }
        } catch (e) {
          final errStr = e.toString().toLowerCase();
          final is401 = errStr.contains('401') || errStr.contains('unauthorized');
          if (is401) {
            // Token is expired / revoked: clean dead credentials and notify user
            await _storage.deleteToken();
            await _storage.deleteRefreshToken();
            _user = null;
            _error = "Your session has expired. Please sign in again.";
          } else {
            // Truly offline: restore cached profile
            final cached = await _storage.getUserData();
            if (cached != null) {
              try {
                _user = UserModel.fromJson(jsonDecode(cached));
              } catch (_) {}
            }
          }
        }
      }
    } catch (_) {}

    _loading = false;
    _initialized = true;
    notifyListeners();
  }

  // 1. Smart Pre-Check & Send OTP
  Future<Map<String, dynamic>> sendOtp(String phone) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.sendOtp(phone);
      _loading = false;
      notifyListeners();
      return response;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '').trim();
      _loading = false;
      notifyListeners();
      return {'success': false, 'error': _error};
    }
  }

  // 2. Register Account with OTP (+ optional Join Code)
  Future<bool> registerWithOtp({
    required String phone,
    required String otp,
    required String password,
    String? name,
    String? inviteCode,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.registerWithOtp(
        phone: phone,
        otp: otp,
        password: password,
        name: name,
        inviteCode: inviteCode,
      );
      await _storage.saveToken(response['token']);
      if (response['refreshToken'] != null) {
        await _storage.saveRefreshToken(response['refreshToken']);
      }
      await _storage.saveIdentifier(phone);
      _savedIdentifier = phone;
      if (response['user'] != null) {
        await _storage.saveUserData(jsonEncode(response['user']));
        _user = UserModel.fromJson(response['user']);
      }
      WebSocketService().reconnectWithNewToken(response['token']);
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '').trim();
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  // 3. Login (Phone or Email + Password)
  Future<bool> login(String identifier, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.login(identifier, password);
      await _storage.saveToken(response['token']);
      if (response['refreshToken'] != null) {
        await _storage.saveRefreshToken(response['refreshToken']);
      }
      await _storage.saveIdentifier(identifier);
      _savedIdentifier = identifier;
      if (response['user'] != null) {
        await _storage.saveUserData(jsonEncode(response['user']));
        _user = UserModel.fromJson(response['user']);
      }
      WebSocketService().reconnectWithNewToken(response['token']);
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '').trim();
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateProfile({String? name, String? email}) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.updateProfile(name: name, email: email);
      if (response['user'] != null) {
        await _storage.saveUserData(jsonEncode(response['user']));
        _user = UserModel.fromJson(response['user']);
      }
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '').trim();
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    WebSocketService().disconnect();
    await _api.logout();
    await _storage.purgeAllSessionData();
    _user = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}


import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../main.dart';
import '../models/user.model.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';
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
  String? _avatarEmoji;
  Timer? _errorDismissTimer;

  UserModel? get user => _user;
  bool get loading => _loading;
  bool get initialized => _initialized;
  String? get error => _error;
  String? get savedIdentifier => _savedIdentifier;
  String? get avatarEmoji => _avatarEmoji;
  bool get isAuthenticated => _user != null;

  Future<void> setAvatarEmoji(String? emoji) async {
    _avatarEmoji = (emoji != null && emoji.trim().isNotEmpty) ? emoji.trim() : null;
    await _storage.saveAvatarEmoji(_avatarEmoji);
    notifyListeners();
  }

  void setErrorWithAutoDismiss(String message, [Duration duration = const Duration(seconds: 3)]) {
    _error = message;
    _errorDismissTimer?.cancel();
    notifyListeners();
    _errorDismissTimer = Timer(duration, () {
      _error = null;
      notifyListeners();
    });
  }

  void clearError() {
    _errorDismissTimer?.cancel();
    _error = null;
    notifyListeners();
  }

  Future<void> init() async {
    _loading = true;
    notifyListeners();

    // Listen for global session expiry events triggered by 401 responses
    ApiService.onSessionExpired.stream.listen((message) {
      _user = null;
      setErrorWithAutoDismiss(message);
      // Automatically redirect to login screen on session expiry
      appNavigatorKey.currentState?.pushNamedAndRemoveUntil('/login', (route) => false);
    });

    try {
      _savedIdentifier = await _storage.getSavedIdentifier();
      _avatarEmoji = await _storage.getAvatarEmoji();

      final hasToken = await _storage.hasToken();
      if (hasToken) {
        try {
          final res = await _api.getMe();
          if (res['user'] != null) {
            _user = UserModel.fromJson(res['user']);
            await _storage.saveUserData(jsonEncode(res['user']));
            NotificationService().syncToken();
          }
        } catch (e) {
          final errStr = e.toString().toLowerCase();
          final is401 = errStr.contains('401') || errStr.contains('unauthorized');
          if (is401) {
            // Token is expired / revoked: clean dead credentials and notify user
            await _storage.deleteToken();
            await _storage.deleteRefreshToken();
            _user = null;
            setErrorWithAutoDismiss("Your session has expired. Please sign in again.");
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
      final err = e.toString().replaceAll('Exception: ', '').trim();
      setErrorWithAutoDismiss(err);
      _loading = false;
      notifyListeners();
      return {'success': false, 'error': err};
    }
  }

  // 1b. Check If Email Exists
  Future<Map<String, dynamic>> checkEmail(String email) async {
    try {
      return await _api.checkEmail(email);
    } catch (e) {
      final err = e.toString().replaceAll('Exception: ', '').trim();
      return {'exists': false, 'error': err};
    }
  }

  // 1c. Check If Phone Exists
  Future<Map<String, dynamic>> checkPhone(String phone) async {
    try {
      return await _api.checkPhone(phone);
    } catch (e) {
      final err = e.toString().replaceAll('Exception: ', '').trim();
      return {'exists': false, 'error': err};
    }
  }

  // 2. Register Account with OTP (+ optional Join Code & Email)
  Future<bool> registerWithOtp({
    required String phone,
    required String otp,
    required String password,
    String? email,
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
        email: email,
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
      clearError();
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      final err = e.toString().replaceAll('Exception: ', '').trim();
      setErrorWithAutoDismiss(err);
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
      NotificationService().syncToken();
      clearError();
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      final err = e.toString().replaceAll('Exception: ', '').trim();
      setErrorWithAutoDismiss(err);
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
      final err = e.toString().replaceAll('Exception: ', '').trim();
      setErrorWithAutoDismiss(err);
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateNotificationPreferences({
    required bool doorStatus,
    required bool lockerConnectivity,
  }) async {
    try {
      final response = await _api.updateNotificationPreferences(
        doorStatus: doorStatus,
        lockerConnectivity: lockerConnectivity,
      );
      if (response['user'] != null) {
        await _storage.saveUserData(jsonEncode(response['user']));
        _user = UserModel.fromJson(response['user']);
        notifyListeners();
      }
      return true;
    } catch (e) {
      final err = e.toString().replaceAll('Exception: ', '').trim();
      setErrorWithAutoDismiss(err);
      return false;
    }
  }

  Future<bool> placeLockerOrder({
    required String address,
    String? pincode,
    int units = 1,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.placeOrder(
        address: address,
        pincode: pincode,
        units: units,
      );
      if (response['user'] != null) {
        await _storage.saveUserData(jsonEncode(response['user']));
        _user = UserModel.fromJson(response['user']);
      }
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      final err = e.toString().replaceAll('Exception: ', '').trim();
      setErrorWithAutoDismiss(err);
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _errorDismissTimer?.cancel();
    _error = null;
    WebSocketService().disconnect(clearRooms: true);
    try {
      await _api.logout();
    } catch (_) {}
    await _storage.purgeAllSessionData();
    _user = null;
    _error = null;
    notifyListeners();
  }
}

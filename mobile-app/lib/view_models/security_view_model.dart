import 'package:flutter/foundation.dart';
import '../services/biometric_service.dart';
import '../services/secure_storage.dart';

class SecurityViewModel extends ChangeNotifier {
  final SecureStorage _storage;
  final BiometricService _biometricService;

  bool _isBiometricEnabled = false;
  bool _isPinEnabled = false;
  bool _isBiometricSupported = false;
  bool _initialized = false;

  SecurityViewModel({
    SecureStorage? storage,
    BiometricService? biometricService,
  })  : _storage = storage ?? SecureStorage(),
        _biometricService = biometricService ?? BiometricService();

  bool get isBiometricEnabled => _isBiometricEnabled;
  bool get isPinEnabled => _isPinEnabled;
  bool get isBiometricSupported => _isBiometricSupported;
  bool get isInitialized => _initialized;
  bool get isAnySecurityEnabled => _isBiometricEnabled || _isPinEnabled;

  String get securitySummaryText {
    if (_isBiometricEnabled) {
      return 'Fingerprint Active';
    } else if (_isPinEnabled) {
      return '4-Digit PIN Active';
    }
    return 'Off • Fingerprint or PIN';
  }

  Future<void> init() async {
    _isBiometricEnabled = await _storage.isBiometricUnlockEnabled();
    _isPinEnabled = await _storage.isPinUnlockEnabled();
    _isBiometricSupported = await _biometricService.canCheckBiometrics();

    // Enforce mutual exclusivity if local storage previously had both
    if (_isBiometricEnabled && _isPinEnabled) {
      await _storage.removePin();
      _isPinEnabled = false;
    }

    _initialized = true;
    notifyListeners();
  }

  /// Enables Fingerprint and automatically disables 4-digit PIN (mutual exclusivity)
  Future<bool> setBiometricEnabled(bool enable) async {
    if (enable) {
      final authenticated = await _biometricService.authenticate(
        reason: 'Verify your fingerprint to enable Biometric Unlock on this device',
      );
      if (!authenticated) {
        return false;
      }
      await _storage.setBiometricUnlockEnabled(true);
      _isBiometricEnabled = true;

      // Automatically disable PIN
      await _storage.removePin();
      _isPinEnabled = false;
    } else {
      await _storage.setBiometricUnlockEnabled(false);
      _isBiometricEnabled = false;
    }
    notifyListeners();
    return true;
  }

  Future<bool> verifyPin(String pin) async {
    final storedPin = await _storage.getPin();
    if (storedPin == null || storedPin.isEmpty) return false;
    return storedPin.trim() == pin.trim();
  }

  /// Sets up a 4-digit PIN and automatically disables Fingerprint (mutual exclusivity)
  Future<bool> setupPin(String pin) async {
    final trimmed = pin.trim();
    if (trimmed.length != 4) return false;
    await _storage.savePin(trimmed);
    _isPinEnabled = true;

    // Automatically disable Biometrics
    await _storage.setBiometricUnlockEnabled(false);
    _isBiometricEnabled = false;

    notifyListeners();
    return true;
  }

  /// Directly resets the PIN with a new 4-digit code (no old PIN required)
  Future<bool> directResetPin(String newPin) async {
    return await setupPin(newPin);
  }

  Future<void> disablePin() async {
    await _storage.removePin();
    _isPinEnabled = false;
    notifyListeners();
  }
}

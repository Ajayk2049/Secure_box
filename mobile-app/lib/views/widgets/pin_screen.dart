import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../view_models/security_view_model.dart';
import 'glass_theme.dart';
import 'pin_keypad.dart';

enum PinScreenMode { setup, unlock, reset }

class PinScreen extends StatefulWidget {
  final PinScreenMode mode;
  final String? lockerName;

  const PinScreen({
    super.key,
    required this.mode,
    this.lockerName,
  });

  /// Pushes the full-screen PIN interface onto the navigation stack
  static Future<bool?> push(
    BuildContext context, {
    required PinScreenMode mode,
    String? lockerName,
  }) {
    return Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => PinScreen(mode: mode, lockerName: lockerName),
      ),
    );
  }

  @override
  State<PinScreen> createState() => _PinScreenState();
}

class _PinScreenState extends State<PinScreen> {
  String _currentInput = '';
  String? _firstPin;
  int _step = 0; // 0: initial, 1: confirm
  String? _errorMessage;
  bool _isProcessing = false;

  late PinScreenMode _activeMode;

  @override
  void initState() {
    super.initState();
    _activeMode = widget.mode;
  }

  String get _title {
    switch (_activeMode) {
      case PinScreenMode.setup:
        return _step == 0 ? 'Create 4-Digit PIN' : 'Confirm 4-Digit PIN';
      case PinScreenMode.unlock:
        return 'Enter PIN to Unlock';
      case PinScreenMode.reset:
        return _step == 0 ? 'Enter New 4-Digit PIN' : 'Confirm New PIN';
    }
  }

  String get _subtitle {
    switch (_activeMode) {
      case PinScreenMode.setup:
        return _step == 0
            ? 'Set a 4-digit code to protect door unlock'
            : 'Re-enter your 4-digit PIN to confirm';
      case PinScreenMode.unlock:
        return widget.lockerName != null && widget.lockerName!.isNotEmpty
            ? 'Protected access for ${widget.lockerName}'
            : 'Enter your 4-digit security PIN';
      case PinScreenMode.reset:
        return _step == 0
            ? 'Enter your new 4-digit security PIN'
            : 'Re-enter your new PIN to confirm reset';
    }
  }

  void _onKeyPress(String digit) {
    if (_isProcessing || _currentInput.length >= 4) return;
    setState(() {
      _currentInput += digit;
      _errorMessage = null;
    });

    if (_currentInput.length == 4) {
      _handleFourDigitsEntered(_currentInput);
    }
  }

  void _onBackspace() {
    if (_isProcessing || _currentInput.isEmpty) return;
    setState(() {
      _currentInput = _currentInput.substring(0, _currentInput.length - 1);
      _errorMessage = null;
    });
  }

  Future<void> _handleFourDigitsEntered(String pin) async {
    final securityVM = context.read<SecurityViewModel>();
    setState(() => _isProcessing = true);

    if (_activeMode == PinScreenMode.setup || _activeMode == PinScreenMode.reset) {
      if (_step == 0) {
        await Future.delayed(const Duration(milliseconds: 150));
        if (!mounted) return;
        setState(() {
          _firstPin = pin;
          _currentInput = '';
          _step = 1;
          _isProcessing = false;
        });
      } else {
        if (pin == _firstPin) {
          final ok = await securityVM.directResetPin(pin);
          if (mounted) Navigator.pop(context, ok);
        } else {
          setState(() {
            _currentInput = '';
            _errorMessage = 'PINs do not match. Please try again.';
            _step = 0;
            _firstPin = null;
            _isProcessing = false;
          });
        }
      }
    } else if (_activeMode == PinScreenMode.unlock) {
      final ok = await securityVM.verifyPin(pin);
      if (ok) {
        if (mounted) Navigator.pop(context, true);
      } else {
        setState(() {
          _currentInput = '';
          _errorMessage = 'Incorrect PIN. Try again.';
          _isProcessing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ParcelGlassScaffold(
      child: SafeArea(
        child: Column(
          children: [
            // Top Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new, color: ParcelGlassColors.navyTitle, size: 20),
                    onPressed: () => Navigator.pop(context, false),
                  ),
                  const Spacer(),
                  Text(
                    _activeMode == PinScreenMode.reset
                        ? 'Reset PIN'
                        : (_activeMode == PinScreenMode.setup ? 'Setup PIN' : 'Verify PIN'),
                    style: const TextStyle(
                      color: ParcelGlassColors.navyTitle,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const Spacer(),
                  const SizedBox(width: 48), // Balance back button
                ],
              ),
            ),

            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 380),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Shield Emblem
                        Container(
                          width: 60,
                          height: 60,
                          decoration: BoxDecoration(
                            color: ParcelGlassColors.accentBlue.withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.dialpad_rounded, color: ParcelGlassColors.accentBlue, size: 30),
                        ),
                        const SizedBox(height: 16),

                        // Title & Subtitle
                        Text(
                          _title,
                          style: const TextStyle(
                            color: ParcelGlassColors.navyTitle,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.4,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _subtitle,
                          style: const TextStyle(
                            color: ParcelGlassColors.slateSubtitle,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 28),

                        // 4 Circular Dots
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(4, (index) {
                            final isFilled = index < _currentInput.length;
                            return Container(
                              margin: const EdgeInsets.symmetric(horizontal: 10),
                              width: 16,
                              height: 16,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isFilled
                                    ? ParcelGlassColors.accentBlue
                                    : Colors.white.withValues(alpha: 0.6),
                                border: Border.all(
                                  color: isFilled
                                      ? ParcelGlassColors.accentBlue
                                      : const Color(0xFF5E6D7E).withValues(alpha: 0.35),
                                  width: 1.8,
                                ),
                              ),
                            );
                          }),
                        ),

                        // Error Message
                        SizedBox(
                          height: 32,
                          child: Center(
                            child: _errorMessage != null
                                ? Text(
                                    _errorMessage!,
                                    style: const TextStyle(
                                      color: ParcelGlassColors.alertRed,
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                    textAlign: TextAlign.center,
                                  )
                                : null,
                          ),
                        ),

                        // Numeric Keypad
                        PinKeypad(
                          onKeyPress: _onKeyPress,
                          onBackspace: _onBackspace,
                          specialKeyChild: const Text('✕', style: TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 18, fontWeight: FontWeight.w600)),
                          onSpecialKey: () => Navigator.pop(context, false),
                        ),

                        const SizedBox(height: 20),

                        // Bottom Actions: Back to first step during Setup or Reset
                        if ((_activeMode == PinScreenMode.setup || _activeMode == PinScreenMode.reset) && _step == 1) ...[
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _step = 0;
                                _firstPin = null;
                                _currentInput = '';
                                _errorMessage = null;
                              });
                            },
                            child: const Text(
                              'Back to First Step',
                              style: TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../../../services/biometric_service.dart';
import '../../../services/secure_storage.dart';
import '../../widgets/glass_theme.dart';

class BiometricSecurityTile extends StatefulWidget {
  const BiometricSecurityTile({super.key});

  @override
  State<BiometricSecurityTile> createState() => _BiometricSecurityTileState();
}

class _BiometricSecurityTileState extends State<BiometricSecurityTile> {
  final SecureStorage _storage = SecureStorage();
  final BiometricService _biometrics = BiometricService();
  bool _enabled = false;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadState();
  }

  Future<void> _loadState() async {
    final val = await _storage.isBiometricUnlockEnabled();
    if (mounted) {
      setState(() {
        _enabled = val;
        _isLoading = false;
      });
    }
  }

  Future<void> _onToggle(bool target) async {
    if (target) {
      final canCheck = await _biometrics.canCheckBiometrics();
      if (!canCheck) {
        if (!mounted) return;
        _showToast(context, 'This device does not support biometric authentication.');
        return;
      }
      final hasEnrolled = await _biometrics.hasEnrolledBiometrics();
      if (!hasEnrolled) {
        if (!mounted) return;
        _showToast(context, 'No fingerprints enrolled. Please register a fingerprint in phone settings.');
        return;
      }

      final authenticated = await _biometrics.authenticate(
        reason: 'Verify your fingerprint to enable Biometric Unlock on this device',
      );

      if (!authenticated) {
        if (!mounted) return;
        _showToast(context, 'Biometric verification cancelled or failed.');
        return;
      }

      await _storage.setBiometricUnlockEnabled(true);
      if (mounted) {
        setState(() => _enabled = true);
        _showToast(context, 'Fingerprint unlock enabled for this phone.');
      }
    } else {
      await _storage.setBiometricUnlockEnabled(false);
      if (mounted) {
        setState(() => _enabled = false);
        _showToast(context, 'Fingerprint unlock disabled.');
      }
    }
  }

  void _showToast(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: ParcelGlassColors.navyTitle,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return LiquidParcelCard(
      useStaticGlass: true,
      borderRadius: 22,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
      child: Row(
        children: [
          const Icon(
            Icons.fingerprint_rounded,
            color: ParcelGlassColors.accentBlue,
            size: 24,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Biometric Unlock',
                  style: TextStyle(
                    color: ParcelGlassColors.navyTitle,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _enabled ? 'Requires fingerprint before door unlock' : 'Disabled (Swipe to unlock immediately)',
                  style: const TextStyle(
                    color: ParcelGlassColors.slateSubtitle,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          if (_isLoading)
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2, color: ParcelGlassColors.accentBlue),
            )
          else
            Switch.adaptive(
              value: _enabled,
              thumbColor: const WidgetStatePropertyAll(ParcelGlassColors.mintSignal),
              activeTrackColor: ParcelGlassColors.mintSignal.withValues(alpha: 0.35),
              onChanged: _onToggle,
            ),
        ],
      ),
    );
  }
}

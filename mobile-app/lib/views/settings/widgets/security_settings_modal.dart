import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../view_models/security_view_model.dart';
import '../../widgets/glass_theme.dart';
import '../../widgets/pin_screen.dart';

class SecuritySettingsModal extends StatelessWidget {
  const SecuritySettingsModal({super.key});

  static void show(BuildContext context) {
    showParcelGlassDialog(
      context: context,
      width: 340,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
      child: const SecuritySettingsModal(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final security = context.watch<SecurityViewModel>();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Title Header
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: ParcelGlassColors.accentBlue.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.shield_outlined, color: ParcelGlassColors.accentBlue, size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              'Security & Unlock',
              style: TextStyle(
                color: ParcelGlassColors.navyTitle,
                fontSize: 17,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.3,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          'Choose one security method to protect door unlock.',
          style: TextStyle(
            color: ParcelGlassColors.slateSubtitle,
            fontSize: 12.5,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 18),

        // 1. Biometric Option (Exclusive)
        _buildSecurityCard(
          context: context,
          icon: Icons.fingerprint_rounded,
          iconColor: const Color(0xFF0284C7),
          title: 'Fingerprint Unlock',
          subtitle: security.isBiometricEnabled
              ? 'Active • Scan fingerprint to unlock'
              : (security.isBiometricSupported
                  ? 'Enable fingerprint authentication'
                  : 'Fingerprint unavailable on this device'),
          isEnabled: security.isBiometricEnabled,
          canToggle: security.isBiometricSupported,
          onToggle: (val) async {
            if (!security.isBiometricSupported) return;
            await security.setBiometricEnabled(val);
          },
        ),

        const SizedBox(height: 12),

        // 2. 4-Digit PIN Option (Exclusive)
        _buildSecurityCard(
          context: context,
          icon: Icons.dialpad_rounded,
          iconColor: const Color(0xFFD97706),
          title: '4-Digit PIN Unlock',
          subtitle: security.isPinEnabled
              ? 'Active • 4-digit PIN required on unlock'
              : 'Set a 4-digit code to protect your locker',
          isEnabled: security.isPinEnabled,
          canToggle: true,
          onToggle: (val) async {
            if (val) {
              Navigator.pop(context); // Close modal first, open full-screen
              await PinScreen.push(context, mode: PinScreenMode.setup);
            } else {
              await security.disablePin();
            }
          },
          actionWidget: security.isPinEnabled
              ? Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: InkWell(
                    onTap: () {
                      Navigator.pop(context); // Close modal, open full-screen reset
                      PinScreen.push(context, mode: PinScreenMode.reset);
                    },
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.black.withValues(alpha: 0.08)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.refresh_rounded, size: 14, color: ParcelGlassColors.accentBlue),
                          SizedBox(width: 4),
                          Text('Reset PIN', style: TextStyle(color: ParcelGlassColors.accentBlue, fontSize: 11.5, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                )
              : null,
        ),

        const SizedBox(height: 20),

        // Done Button
        SizedBox(
          height: 44,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: ParcelGlassColors.navyTitle,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              elevation: 0,
            ),
            onPressed: () => Navigator.pop(context),
            child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          ),
        ),
      ],
    );
  }

  Widget _buildSecurityCard({
    required BuildContext context,
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required bool isEnabled,
    required bool canToggle,
    required ValueChanged<bool> onToggle,
    Widget? actionWidget,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isEnabled ? iconColor.withValues(alpha: 0.35) : Colors.white.withValues(alpha: 0.7),
          width: 1.2,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: ParcelGlassColors.navyTitle,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: ParcelGlassColors.slateSubtitle,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: isEnabled,
                onChanged: canToggle ? onToggle : null,
                activeTrackColor: ParcelGlassColors.mintSignal,
                thumbColor: const WidgetStatePropertyAll(Colors.white),
              ),
            ],
          ),
          if (actionWidget != null) actionWidget,
        ],
      ),
    );
  }
}

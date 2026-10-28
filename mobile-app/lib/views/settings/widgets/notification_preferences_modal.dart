import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../view_models/auth_view_model.dart';
import '../../widgets/glass_theme.dart';

class NotificationPreferencesModal extends StatefulWidget {
  const NotificationPreferencesModal({super.key});

  static Future<void> show(BuildContext context) {
    return showParcelGlassDialog(
      context: context,
      width: 340,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: const NotificationPreferencesModal(),
    );
  }

  @override
  State<NotificationPreferencesModal> createState() => _NotificationPreferencesModalState();
}

class _NotificationPreferencesModalState extends State<NotificationPreferencesModal> {
  late bool _doorStatus;
  late bool _lockerConnectivity;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final prefs = context.read<AuthViewModel>().user?.notificationPreferences;
    _doorStatus = prefs?.doorStatus ?? false;
    _lockerConnectivity = prefs?.lockerConnectivity ?? false;
  }

  Future<void> _handleSave() async {
    if (_isSaving) return;

    setState(() {
      _isSaving = true;
    });

    final auth = context.read<AuthViewModel>();
    final success = await auth.updateNotificationPreferences(
      doorStatus: _doorStatus,
      lockerConnectivity: _lockerConnectivity,
    );

    if (!mounted) return;

    setState(() {
      _isSaving = false;
    });

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Notification preferences saved successfully.'),
          backgroundColor: ParcelGlassColors.accentBlue,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.only(bottom: 20, left: 20, right: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          duration: const Duration(seconds: 2),
        ),
      );
      Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Failed to save notification preferences. Please try again.'),
          backgroundColor: Colors.redAccent,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.only(bottom: 20, left: 20, right: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Modal Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: ParcelGlassColors.accentBlue.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.notifications_active_outlined,
                    color: ParcelGlassColors.accentBlue,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'Notification Preferences',
                  style: TextStyle(
                    color: ParcelGlassColors.navyTitle,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.3,
                  ),
                ),
              ],
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 20, color: ParcelGlassColors.slateSubtitle),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
              splashRadius: 18,
              onPressed: _isSaving ? null : () => Navigator.pop(context),
            ),
          ],
        ),

        const SizedBox(height: 8),

        const Text(
          'Manage push alerts sent to your phone. By default, notifications are disabled until enabled below.',
          style: TextStyle(
            color: ParcelGlassColors.slateSubtitle,
            fontSize: 11.5,
            fontWeight: FontWeight.w500,
            height: 1.35,
          ),
        ),

        const SizedBox(height: 16),

        // Option 1: Door status Card
        _buildPreferenceCard(
          icon: Icons.sensor_door_outlined,
          title: 'Door status',
          subtitle: 'Receive instant push alerts whenever your locker is unlocked and opened.',
          value: _doorStatus,
          onChanged: _isSaving
              ? null
              : (val) => setState(() => _doorStatus = val),
        ),

        const SizedBox(height: 12),

        // Option 2: Locker connectivity Card
        _buildPreferenceCard(
          icon: Icons.wifi_tethering_rounded,
          title: 'Locker connectivity',
          subtitle: 'Get notified when your locker drops offline or reconnects back to the network.',
          value: _lockerConnectivity,
          onChanged: _isSaving
              ? null
              : (val) => setState(() => _lockerConnectivity = val),
        ),

        const SizedBox(height: 20),

        // Save & Done Button
        SizedBox(
          height: 44,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: ParcelGlassColors.navyTitle,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              elevation: 0,
            ),
            onPressed: _isSaving ? null : _handleSave,
            child: _isSaving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Text(
                    'Done',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildPreferenceCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool>? onChanged,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onChanged != null ? () => onChanged(!value) : null,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.25),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.50),
              width: 1.0,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: value
                      ? ParcelGlassColors.accentBlue.withValues(alpha: 0.15)
                      : Colors.grey.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  icon,
                  size: 20,
                  color: value ? ParcelGlassColors.accentBlue : ParcelGlassColors.slateSubtitle,
                ),
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
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: ParcelGlassColors.slateSubtitle,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Switch.adaptive(
                value: value,
                activeThumbColor: ParcelGlassColors.accentBlue,
                activeTrackColor: ParcelGlassColors.accentBlue.withValues(alpha: 0.35),
                onChanged: onChanged,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../view_models/auth_view_model.dart';
import '../../view_models/home_view_model.dart';
import '../../view_models/security_view_model.dart';
import '../widgets/glass_theme.dart';
import 'widgets/edit_profile_modal.dart';
import 'widgets/manage_users_dialog.dart';
import 'widgets/rename_device_modal.dart';
import 'widgets/notification_preferences_modal.dart';
import 'widgets/security_settings_modal.dart';
import 'widgets/setting_capsule_tile.dart';
import '../widgets/order_locker_modal.dart';
import 'widgets/settings_modals.dart';
import 'widgets/settings_profile_card.dart';
import 'widgets/settings_sign_out_button.dart';

class SettingsScreen extends StatelessWidget {
  final VoidCallback? onBackToHome;

  const SettingsScreen({super.key, this.onBackToHome});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthViewModel>();
    final home = context.watch<HomeViewModel>();
    final security = context.watch<SecurityViewModel>();

    final user = auth.user;
    final userName = user?.name ?? user?.phone ?? 'Member';
    final userPhone = user?.phone ?? '';

    // Calculate contextual ownership counts across linked devices
    final devices = home.devices;
    final ownedCount = devices.where((d) => d.isOwner).length;
    final coOwnedCount = devices.where((d) => !d.isOwner).length;

    String accountScopeText = 'Standard Account';
    if (devices.isNotEmpty) {
      final List<String> parts = [];
      if (ownedCount > 0) parts.add('$ownedCount Owned');
      if (coOwnedCount > 0) parts.add('$coOwnedCount Co-Owned');
      accountScopeText = parts.join(' • ');
    }

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(left: 24, right: 24, top: 12, bottom: 110),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 700),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: < Settings
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                child: Row(
                  children: [
                    ParcelCircleBackButton(
                      onPressed: onBackToHome ?? () => Navigator.maybePop(context),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Settings',
                      style: TextStyle(
                        color: ParcelGlassColors.navyTitle,
                        fontSize: 25,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 10),

              // User Profile & Account Summary Capsule (tap to edit profile)
              GestureDetector(
                onTap: home.isOffline ? () => _showOfflineWarning(context) : () => EditProfileModal.show(context),
                child: SettingsProfileCard(
                  userName: userName,
                  userPhone: userPhone,
                  accountScopeText: accountScopeText,
                  avatarEmoji: auth.avatarEmoji,
                ),
              ),

              // 1. Rename Smart Locker Box
              SettingCapsuleTile(
                icon: Icons.edit_note,
                title: 'Rename Secure Box',
                subtitle: home.isOffline
                    ? 'Unavailable while offline'
                    : (home.selectedDevice != null
                        ? (home.selectedDevice!.isOwner
                            ? '${home.selectedDevice!.name} (${home.selectedDevice!.deviceId})'
                            : '${home.selectedDevice!.name} • Primary Owner Only')
                        : (devices.any((d) => d.isOwner) ? 'Personalize your Secure Box name' : 'Primary Owner Only')),
                onTap: home.isOffline
                    ? () => _showOfflineWarning(context)
                    : () {
                        if (home.selectedDevice != null && !home.selectedDevice!.isOwner && !devices.any((d) => d.isOwner)) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: const Text('Only primary owners can rename this locker box.'),
                              backgroundColor: ParcelGlassColors.alertRed,
                              behavior: SnackBarBehavior.floating,
                              margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                          );
                          return;
                        }
                        RenameDeviceModal.show(context);
                      },
              ),

              // 3. Manage Users
              SettingCapsuleTile(
                icon: Icons.people_outline,
                title: 'Manage Users & Slots',
                subtitle: home.isOffline
                    ? 'Unavailable while offline'
                    : 'Manage family access and co-owner member slots',
                onTap: home.isOffline ? () => _showOfflineWarning(context) : () => ManageUsersDialog.show(context),
              ),

              // Order New Locker Box
              SettingCapsuleTile(
                icon: Icons.local_shipping_outlined,
                title: 'Order New Locker',
                subtitle: 'Order Additional Secure Box Units',
                onTap: home.isOffline
                    ? () => _showOfflineWarning(context)
                    : () => OrderLockerModal.show(context),
              ),

              // 4. Security & Authentication (Biometric & 4-Digit PIN)
              SettingCapsuleTile(
                icon: Icons.shield_outlined,
                title: 'Security',
                subtitle: security.securitySummaryText,
                onTap: () => SecuritySettingsModal.show(context),
              ),

              // 5. Notification Preferences
              SettingCapsuleTile(
                icon: Icons.notifications_none_outlined,
                title: 'Notification Preferences',
                subtitle: 'Door Status, Locker Connectivity',
                onTap: () => NotificationPreferencesModal.show(context),
              ),

              // 6. About
              SettingCapsuleTile(
                icon: Icons.info_outline,
                title: 'About',
                subtitle: 'About Secure Box',
                onTap: () => SettingsModals.showAboutModal(context),
              ),

              const SizedBox(height: 8),

              // 6. Log Out Button
              SettingsSignOutButton(
                onSignOut: () async {
                  context.read<HomeViewModel>().reset();
                  await auth.logout();
                  if (context.mounted) {
                    Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showOfflineWarning(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('This action is unavailable while the server is offline.'),
        backgroundColor: ParcelGlassColors.alertRed,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}


import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/device.model.dart';
import '../../view_models/auth_view_model.dart';
import '../../view_models/home_view_model.dart';
import '../settings/settings_screen.dart';
import '../settings/widgets/edit_profile_modal.dart';
import '../widgets/add_locker_dialog.dart';
import '../widgets/connection_warning_card.dart';
import '../widgets/glass_theme.dart';
import '../widgets/order_locker_modal.dart';
import 'widgets/co_owner_invite_sheet.dart';
import 'widgets/home_bottom_nav.dart';
import 'widgets/home_empty_state.dart';
import 'widgets/home_history_tab.dart';
import 'widgets/home_user_greeting.dart';
import 'widgets/locker_hero_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentTab = 0; // 0: Home, 1: History, 2: Settings
  String? _unlockingDeviceId;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<HomeViewModel>().init();
    });
  }

  @override
  void dispose() {
    super.dispose();
  }

  void _showAddLocker(BuildContext context) {
    if (context.read<HomeViewModel>().isOffline) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Cannot link lockers while offline. Please restore connection.'),
          backgroundColor: ParcelGlassColors.alertRed,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      );
      return;
    }
    AddLockerDialog.show(context);
  }

  void _showOrderLocker(BuildContext context) {
    if (context.read<HomeViewModel>().isOffline) {
      _showOfflineWarning(context);
      return;
    }
    OrderLockerModal.show(context);
  }

  bool _didPromptNewUser = false;

  void _maybePromptNewUser() {
    if (_didPromptNewUser) return;
    final home = context.read<HomeViewModel>();
    final auth = context.read<AuthViewModel>();

    if (!home.loading && home.devices.isEmpty && auth.user != null && auth.user?.orderStatus == null) {
      _didPromptNewUser = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _showNewUserWelcomeModal(context);
      });
    }
  }

  void _showNewUserWelcomeModal(BuildContext context) {
    showParcelGlassDialog(
      context: context,
      width: 340,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: ParcelGlassColors.parcelBrown.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.local_shipping_rounded, size: 36, color: ParcelGlassColors.parcelBrown),
          ),
          const SizedBox(height: 14),
          const Text(
            'WELCOME TO SECURE BOX',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: ParcelGlassColors.navyTitle,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'You don\'t have any lockers linked yet. Would you like to request your doorstep smart locker, or link an existing box?',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12.5, color: ParcelGlassColors.slateSubtitle, height: 1.4),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                OrderLockerModal.show(context);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: ParcelGlassColors.parcelBrown,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              icon: const Icon(Icons.add_shopping_cart, size: 18),
              label: const Text('ORDER SMART LOCKER', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                AddLockerDialog.show(context);
              },
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Colors.white.withValues(alpha: 0.80), width: 1.2),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.qr_code, size: 18, color: ParcelGlassColors.navyTitle),
              label: const Text('ENTER DEVICE CODE', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: ParcelGlassColors.navyTitle)),
            ),
          ),
        ],
      ),
    );
  }

  void _showInviteSheet(BuildContext context, String deviceId, String deviceName) {
    CoOwnerInviteSheet.show(context, deviceId, deviceName);
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

  Future<void> _handleUnlock(DeviceModel device) async {
    final homeVM = context.read<HomeViewModel>();
    if (homeVM.isOffline || homeVM.isCheckingReachability) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            homeVM.isCheckingReachability
                ? 'Connecting to server. Please wait a moment...'
                : 'Unlock unavailable: Server is currently offline or unreachable.',
          ),
          backgroundColor: ParcelGlassColors.alertRed,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      );
      return;
    }

    if (!device.online) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.cloud_off_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${device.name.isNotEmpty ? device.name : device.deviceId} is currently offline. Unlock unavailable.',
                ),
              ),
            ],
          ),
          backgroundColor: ParcelGlassColors.alertRed,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      );
      return;
    }
    setState(() => _unlockingDeviceId = device.deviceId);
    try {
      await context.read<HomeViewModel>().unlockDevice(device.deviceId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.lock_open, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text('${device.deviceId} - Door opened.'),
                ),
              ],
            ),
            backgroundColor: ParcelGlassColors.accentBlue,
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        final rawMsg = e.toString().replaceAll('Exception: ', '').trim();
        final isOffline = rawMsg.toLowerCase().contains('offline');
        final errorText = isOffline
            ? '${device.name.isNotEmpty ? device.name : device.deviceId} is offline. Please check device power and connection.'
            : (rawMsg.isNotEmpty ? rawMsg : 'Unlock failed. Please try again.');

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(
                  isOffline ? Icons.cloud_off_rounded : Icons.error_outline_rounded,
                  color: Colors.white,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(errorText),
                ),
              ],
            ),
            backgroundColor: ParcelGlassColors.alertRed,
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _unlockingDeviceId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ParcelGlassScaffold(
      child: Stack(
        children: [
          SafeArea(
            child: IndexedStack(
              index: _currentTab,
              children: [
                RepaintBoundary(child: _buildHomeTab()),
                const RepaintBoundary(child: HomeHistoryTab()),
                RepaintBoundary(
                  child: SettingsScreen(onBackToHome: () => setState(() => _currentTab = 0)),
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: MediaQuery.of(context).padding.bottom + 20,
            child: RepaintBoundary(
              child: HomeBottomNav(
                selectedIndex: _currentTab,
                onChanged: (index) {
                  if (_currentTab == index) {
                    if (index == 1) {
                      final homeVM = context.read<HomeViewModel>();
                      final devId = homeVM.selectedDevice?.deviceId ??
                          (homeVM.devices.isNotEmpty ? homeVM.devices.first.deviceId : null);
                      if (devId != null) {
                        homeVM.fetchDeviceLogs(devId);
                      }
                    }
                    return;
                  }
                  setState(() => _currentTab = index);
                  if (index == 1) {
                    final homeVM = context.read<HomeViewModel>();
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (!mounted) return;
                      final devId = homeVM.selectedDevice?.deviceId ??
                          (homeVM.devices.isNotEmpty ? homeVM.devices.first.deviceId : null);
                      if (devId != null) {
                        homeVM.fetchDeviceLogs(devId);
                      }
                    });
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHomeTab() {
    final authVM = context.watch<AuthViewModel>();
    final homeVM = context.watch<HomeViewModel>();

    final currentUser = authVM.user;
    final userName = currentUser?.name ?? currentUser?.phone ?? 'User';
    final devices = homeVM.devices;

    if (devices.isEmpty) {
      _maybePromptNewUser();
      return RefreshIndicator(
        color: ParcelGlassColors.accentBlue,
        onRefresh: () => homeVM.fetchDevices(),
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
              padding: const EdgeInsets.only(left: 18, right: 18, top: 12, bottom: 95),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight - 107),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        HomeUserGreeting(
                          userName: userName,
                          avatarEmoji: authVM.avatarEmoji,
                          showAddButton: false,
                          isOffline: homeVM.isOffline,
                          onAddLocker: () => _showAddLocker(context),
                          onProfileTap: homeVM.isOffline ? () => _showOfflineWarning(context) : () => EditProfileModal.show(context),
                        ),
                        if (homeVM.isOffline) ...[
                          const SizedBox(height: 16),
                          ConnectionWarningCard(issue: homeVM.connectionIssue),
                        ],
                      ],
                    ),
                    HomeEmptyState(
                      loading: homeVM.loading,
                      isOffline: homeVM.isOffline,
                      onAddLocker: () => _showAddLocker(context),
                      onOrderLocker: () => _showOrderLocker(context),
                    ),
                    const SizedBox(height: 10),
                  ],
                ),
              ),
            );
          },
        ),
      );
    }

    return RefreshIndicator(
      color: ParcelGlassColors.accentBlue,
      onRefresh: () => homeVM.fetchDevices(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
        padding: const EdgeInsets.only(left: 18, right: 18, top: 12, bottom: 110),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 700),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                HomeUserGreeting(
                  userName: userName,
                  avatarEmoji: authVM.avatarEmoji,
                  showAddButton: true,
                  isOffline: homeVM.isOffline,
                  onAddLocker: () => _showAddLocker(context),
                  onProfileTap: homeVM.isOffline ? () => _showOfflineWarning(context) : () => EditProfileModal.show(context),
                ),
                const SizedBox(height: 16),
                if (homeVM.isOffline) ...[
                  ConnectionWarningCard(issue: homeVM.connectionIssue),
                ],
                for (final device in devices) ...[
                  LockerHeroCard(
                    device: device,
                    isUnlocking: _unlockingDeviceId == device.deviceId || _unlockingDeviceId == device.id,
                    isOffline: homeVM.isOffline,
                    isChecking: homeVM.isCheckingReachability,
                    onUnlock: () => _handleUnlock(device),
                    onInviteCoOwner: () => _showInviteSheet(context, device.deviceId, device.name),
                  ),
                  const SizedBox(height: 12),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

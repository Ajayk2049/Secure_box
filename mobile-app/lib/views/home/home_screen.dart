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
                  child: SettingsScreen(onBackToHome: () {
                    setState(() => _currentTab = 0);
                    context.read<HomeViewModel>().setHistoryActive(false);
                  }),
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
                  final homeVM = context.read<HomeViewModel>();
                  if (_currentTab == index) {
                    if (index == 1) {
                      homeVM.setHistoryActive(true);
                      final devId = homeVM.selectedDevice?.deviceId ??
                          (homeVM.devices.isNotEmpty ? homeVM.devices.first.deviceId : null);
                      if (devId != null) {
                        homeVM.fetchDeviceLogs(devId);
                      }
                    }
                    return;
                  }
                  setState(() => _currentTab = index);
                  homeVM.setHistoryActive(index == 1);
                  if (index == 1) {
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

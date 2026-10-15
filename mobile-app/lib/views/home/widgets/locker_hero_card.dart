import 'package:flutter/material.dart';
import '../../../models/device.model.dart';
import '../../widgets/glass_theme.dart';
import '../../widgets/liquid_slide_to_unlock.dart';

class LockerHeroCard extends StatelessWidget {
  final DeviceModel device;
  final bool isUnlocking;
  final bool isOffline;
  final bool isChecking;
  final Future<void> Function() onUnlock;
  final VoidCallback onInviteCoOwner;

  const LockerHeroCard({
    super.key,
    required this.device,
    required this.isUnlocking,
    this.isOffline = false,
    this.isChecking = false,
    required this.onUnlock,
    required this.onInviteCoOwner,
  });

  @override
  Widget build(BuildContext context) {
    final isOnline = !isOffline && !isChecking && device.online;
    final isDoorOpen = device.doorState.toLowerCase() == 'open';

    return LiquidParcelCard(
      useStaticGlass: true,
      borderRadius: 26,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Device Name & Online Indicator
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      device.name.isNotEmpty ? device.name : 'Secure Box',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: ParcelGlassColors.navyTitle,
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          device.deviceId,
                          style: const TextStyle(
                            color: ParcelGlassColors.slateSubtitle,
                            fontSize: 12,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: (device.isOwner ? ParcelGlassColors.mintSignal : ParcelGlassColors.accentBlue).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: (device.isOwner ? const Color(0xFF047857) : ParcelGlassColors.accentBlue).withValues(alpha: 0.3),
                              width: 1.0,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                device.isOwner ? Icons.admin_panel_settings_rounded : Icons.group_rounded,
                                size: 11,
                                color: device.isOwner ? const Color(0xFF047857) : ParcelGlassColors.accentBlue,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                device.isOwner ? 'PRIMARY OWNER' : 'CO-OWNER',
                                style: TextStyle(
                                  color: device.isOwner ? const Color(0xFF047857) : ParcelGlassColors.accentBlue,
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isChecking
                      ? Colors.grey.withValues(alpha: 0.15)
                      : (isOnline
                          ? ParcelGlassColors.mintSignal.withValues(alpha: 0.15)
                          : Colors.amber.withValues(alpha: 0.2)),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isChecking
                        ? Colors.grey.shade400
                        : (isOnline ? ParcelGlassColors.mintSignal : Colors.amber),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: isChecking
                            ? Colors.grey.shade600
                            : (isOnline ? ParcelGlassColors.mintSignal : Colors.amber),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      isChecking ? 'CHECKING...' : (isOnline ? 'ONLINE' : 'OFFLINE'),
                      style: TextStyle(
                        color: isChecking
                            ? Colors.grey.shade700
                            : (isOnline ? ParcelGlassColors.mintSignal : const Color(0xFFB45309)),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 18),

          // Hardware Metric: Single Door status indicator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.8)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isDoorOpen ? Icons.meeting_room_outlined : Icons.lock_outline_rounded,
                  size: 20,
                  color: isDoorOpen ? ParcelGlassColors.amberSignal : ParcelGlassColors.navyTitle,
                ),
                const SizedBox(width: 8),
                Text(
                  isDoorOpen ? 'Door is open' : 'Door is closed',
                  style: TextStyle(
                    color: isDoorOpen ? ParcelGlassColors.amberSignal : ParcelGlassColors.navyTitle,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Central Hero: Slide to Unlock
          LiquidSlideToUnlock(
            isUnlocking: isUnlocking,
            isLockerOnline: isOnline,
            isUnlocked: isDoorOpen,
            enabled: !isOffline && !isChecking && isOnline,
            isChecking: isChecking,
            onUnlock: onUnlock,
          ),

          // Co-Owner invite action (Owner only)
          if (device.isOwner) ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: isOffline
                    ? () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: const Text('Cannot invite co-owners while offline. Please restore connection.'),
                            backgroundColor: ParcelGlassColors.alertRed,
                            behavior: SnackBarBehavior.floating,
                            margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        );
                      }
                    : onInviteCoOwner,
                icon: Icon(
                  Icons.person_add_alt_1,
                  size: 16,
                  color: isOffline ? Colors.black26 : ParcelGlassColors.accentBlue,
                ),
                label: Text(
                  'Invite Family / Co-Owner',
                  style: TextStyle(
                    color: isOffline ? Colors.black26 : ParcelGlassColors.accentBlue,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

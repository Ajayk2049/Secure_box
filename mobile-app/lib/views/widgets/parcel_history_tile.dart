import 'package:flutter/material.dart';
import '../../models/log.model.dart';
import 'glass_theme.dart';

class ParcelHistoryTile extends StatelessWidget {
  final LogModel log;

  const ParcelHistoryTile({
    super.key,
    required this.log,
  });

  @override
  Widget build(BuildContext context) {
    final primaryTextColor = ParcelGlassColors.textPrimary(context);
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    final actionLower = log.action.toLowerCase();
    final isEmergencyUnlock = actionLower.contains('emergency') || actionLower.contains('manual');
    final isUnlock = actionLower.contains('unlock') && !isEmergencyUnlock;
    final isLock = (actionLower.contains('door_closed') || actionLower.contains('lock') || actionLower == 'closed') &&
        !isUnlock &&
        !isEmergencyUnlock;
    final isOffline = actionLower.contains('offline');
    final isOnline = actionLower.contains('online');
    final isCoOwnerAdded = actionLower.contains('co_owner_added');
    final isCoOwnerRemoved = actionLower.contains('co_owner_removed');
    final isDelivery = actionLower.contains('delivery');

    final IconData icon = isEmergencyUnlock
        ? Icons.vpn_key_rounded
        : (isUnlock
            ? Icons.lock_open_rounded
            : (isLock
                ? Icons.lock_rounded
                : (isOffline
                    ? Icons.wifi_off_rounded
                    : (isOnline
                        ? Icons.wifi_rounded
                        : (isDelivery
                            ? Icons.inventory_2_outlined
                            : (isCoOwnerAdded
                                ? Icons.person_add_rounded
                                : (isCoOwnerRemoved
                                    ? Icons.person_remove_rounded
                                    : Icons.history_rounded)))))));

    final Color iconColor = isEmergencyUnlock
        ? ParcelGlassColors.amberSignal
        : (isUnlock
            ? ParcelGlassColors.alertRed
            : (isLock
                ? ParcelGlassColors.mintSignal
                : (isOffline
                    ? ParcelGlassColors.amberSignal
                    : (isOnline
                        ? ParcelGlassColors.accentBlue
                        : (isDelivery
                            ? const Color(0xFF6366F1)
                            : (isCoOwnerAdded
                                ? ParcelGlassColors.accentBlue
                                : (isCoOwnerRemoved
                                    ? ParcelGlassColors.alertRed
                                    : ParcelGlassColors.slateSubtitle)))))));

    String title;
    if (isEmergencyUnlock) {
      title = 'Emergency Unlock';
    } else if (isUnlock) {
      title = 'Locker Unlocked';
    } else if (isLock) {
      title = 'Locker Locked';
    } else if (isOffline) {
      title = 'Device Offline';
    } else if (isOnline) {
      title = 'Device Online';
    } else if (isDelivery) {
      title = 'Package Delivered';
    } else if (isCoOwnerAdded) {
      title = 'Co-Owner Added';
    } else if (isCoOwnerRemoved) {
      title = 'Co-Owner Removed';
    } else {
      title = _toTitleCase(log.action.replaceAll('_', ' '));
    }

    final metadata = log.metadata ?? {};
    final String? rawActor = (metadata['unlockedBy'] ??
            metadata['userName'] ??
            metadata['user'] ??
            metadata['name'])
        ?.toString();
    final String? actorName = (rawActor != null &&
            rawActor.trim().isNotEmpty &&
            !rawActor.toLowerCase().contains('sensor') &&
            !rawActor.toLowerCase().contains('latch'))
        ? rawActor.trim()
        : null;

    final localTime = log.timestamp.toLocal();
    final rawHour = localTime.hour;
    final period = rawHour >= 12 ? 'PM' : 'AM';
    final hour12 = rawHour % 12 == 0 ? 12 : rawHour % 12;
    final minute = localTime.minute.toString().padLeft(2, '0');
    final timeClock = '${hour12.toString().padLeft(2, '0')}:$minute $period';

    return RepaintBoundary(
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.65),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF3D2310).withValues(alpha: 0.08),
              blurRadius: 14,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.14),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                color: iconColor,
                size: 20,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: primaryTextColor,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (actorName != null && actorName.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      actorName.startsWith(RegExp(r'by\s+', caseSensitive: false))
                          ? actorName
                          : 'by $actorName',
                      style: TextStyle(
                        color: secondaryTextColor,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.7),
                ),
              ),
              child: Text(
                timeClock,
                style: TextStyle(
                  color: primaryTextColor,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _toTitleCase(String text) {
    if (text.isEmpty) return text;
    return text.split(' ').map((word) {
      if (word.isEmpty) return word;
      return word[0].toUpperCase() + word.substring(1).toLowerCase();
    }).join(' ');
  }
}

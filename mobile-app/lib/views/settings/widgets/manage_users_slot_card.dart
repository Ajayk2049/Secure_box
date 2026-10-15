import 'package:flutter/material.dart';
import '../../widgets/glass_theme.dart';
import '../../home/widgets/co_owner_invite_sheet.dart';

class ManageUsersSlotCard {
  static Widget buildUserSlotRow({
    required int slotNumber,
    required String name,
    required String phoneOrContact,
    required String badgeText,
    required Color badgeColor,
    bool isCoOwner = false,
    bool isOwnerView = false,
    VoidCallback? onEditName,
    VoidCallback? onRevoke,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.50),
          width: 1.0,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: badgeColor.withValues(alpha: 0.15),
            ),
            child: Center(
              child: Text(
                '$slotNumber',
                style: TextStyle(
                  color: badgeColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: ParcelGlassColors.navyTitle,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (isCoOwner && isOwnerView && onEditName != null) ...[
                      const SizedBox(width: 4),
                      InkWell(
                        onTap: onEditName,
                        borderRadius: BorderRadius.circular(6),
                        child: const Padding(
                          padding: EdgeInsets.all(2.0),
                          child: Icon(
                            Icons.edit_outlined,
                            size: 14,
                            color: ParcelGlassColors.accentBlue,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(
                      Icons.phone_android_outlined,
                      size: 11,
                      color: ParcelGlassColors.slateSubtitle,
                    ),
                    const SizedBox(width: 3),
                    Flexible(
                      child: Text(
                        phoneOrContact,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: ParcelGlassColors.slateSubtitle,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                decoration: BoxDecoration(
                  color: badgeColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  badgeText,
                  style: TextStyle(
                    color: badgeColor,
                    fontSize: 8.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
              if (isCoOwner && isOwnerView && onRevoke != null) ...[
                const SizedBox(width: 6),
                InkWell(
                  onTap: onRevoke,
                  borderRadius: BorderRadius.circular(6),
                  child: const Padding(
                    padding: EdgeInsets.all(3.0),
                    child: Icon(
                      Icons.person_remove_outlined,
                      size: 15,
                      color: ParcelGlassColors.alertRose,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  static Widget buildLockedSlotRow({required int slotNumber}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.25),
          width: 1.0,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.black12,
            ),
            child: const Center(
              child: Icon(Icons.lock_outline, size: 13, color: ParcelGlassColors.slateSubtitle),
            ),
          ),
          const SizedBox(width: 8),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Locked Slot',
                  style: TextStyle(
                    color: ParcelGlassColors.slateSubtitle,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Reserved capacity (Unlock via admin)',
                  style: TextStyle(
                    color: ParcelGlassColors.slateSubtitle,
                    fontSize: 10.5,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.black12,
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Text(
              'LOCKED',
              style: TextStyle(
                color: ParcelGlassColors.slateSubtitle,
                fontSize: 8.5,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget buildAvailableSlotRow({
    required BuildContext context,
    required int slotNumber,
    required bool isOwner,
    required String? deviceId,
    required String? deviceName,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.20),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.40),
          width: 1.0,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: ParcelGlassColors.amberSignal.withValues(alpha: 0.15),
            ),
            child: Center(
              child: Text(
                '$slotNumber',
                style: const TextStyle(
                  color: ParcelGlassColors.amberSignal,
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Empty Slot',
                  style: TextStyle(
                    color: ParcelGlassColors.navyTitle,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Available for family or co-owner',
                  style: TextStyle(
                    color: ParcelGlassColors.slateSubtitle,
                    fontSize: 10.5,
                  ),
                ),
              ],
            ),
          ),
          InkWell(
            onTap: () {
              if (deviceId != null && deviceName != null && isOwner) {
                CoOwnerInviteSheet.show(
                  context,
                  deviceId,
                  deviceName,
                );
              }
            },
            borderRadius: BorderRadius.circular(4),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: ParcelGlassColors.amberSignal.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: ParcelGlassColors.amberSignal.withValues(alpha: 0.5),
                  width: 0.8,
                ),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'AVAILABLE',
                    style: TextStyle(
                      color: ParcelGlassColors.amberSignal,
                      fontSize: 8.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                    ),
                  ),
                  SizedBox(width: 3),
                  Icon(
                    Icons.person_add_alt_1,
                    size: 10,
                    color: ParcelGlassColors.amberSignal,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

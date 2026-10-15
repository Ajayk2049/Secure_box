import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../view_models/home_view_model.dart';
import '../../../view_models/manage_users_view_model.dart';
import '../../widgets/glass_theme.dart';
import 'manage_users_header.dart';
import 'manage_users_slot_card.dart';
import 'rename_co_owner_modal.dart';
import 'revoke_co_owner_modal.dart';
import 'unlock_slots_modal.dart';

class ManageUsersDialog extends StatelessWidget {
  const ManageUsersDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showParcelGlassDialog(
      context: context,
      width: 360,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: const ManageUsersDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final home = context.read<HomeViewModel>();
    final devices = home.devices;
    final initialDevice = home.selectedDevice ?? (devices.isNotEmpty ? devices.first : null);

    return ChangeNotifierProvider(
      create: (_) => ManageUsersViewModel()..init(initialDevice),
      child: const _ManageUsersContent(),
    );
  }
}

class _ManageUsersContent extends StatelessWidget {
  const _ManageUsersContent();

  Future<void> _handleRename(BuildContext context, ManageUsersViewModel vm, String userId, String currentName) async {
    final newName = await RenameCoOwnerModal.show(context: context, currentName: currentName);
    if (newName != null && newName.isNotEmpty && context.mounted) {
      try {
        await vm.renameCoOwner(userId, newName);
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: ${e.toString()}'), backgroundColor: ParcelGlassColors.alertRose),
          );
        }
      }
    }
  }

  Future<void> _handleRevoke(BuildContext context, ManageUsersViewModel vm, String userId, String userName) async {
    final confirmed = await RevokeCoOwnerModal.show(context: context, userName: userName);
    if (confirmed == true && context.mounted) {
      try {
        await vm.revokeCoOwner(userId);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Access revoked for $userName'), backgroundColor: ParcelGlassColors.accentBlue),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed: ${e.toString()}'), backgroundColor: ParcelGlassColors.alertRose),
          );
        }
      }
    }
  }

  void _openUnlockModal(BuildContext context, ManageUsersViewModel vm) {
    if (vm.selectedDevice == null) return;
    UnlockSlotsModal.show(
      context: context,
      deviceId: vm.selectedDevice!.id,
      deviceName: vm.selectedDevice!.name,
      currentAllowed: vm.allowedSlots,
      onRequestSent: vm.fetchSlots,
    );
  }

  @override
  Widget build(BuildContext context) {
    final home = context.watch<HomeViewModel>();
    final vm = context.watch<ManageUsersViewModel>();
    final devices = home.devices;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ManageUsersHeader(
          devices: devices,
          selectedDevice: vm.selectedDevice,
          onDeviceSelected: vm.selectDevice,
        ),
        if (devices.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: Text(
                'No smart lockers linked to this account.',
                style: TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 13),
              ),
            ),
          )
        else ...[
          if (vm.isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 30),
              child: Center(
                child: CircularProgressIndicator(strokeWidth: 2, color: ParcelGlassColors.accentBlue),
              ),
            )
          else if (vm.errorMessage != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(
                vm.errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: ParcelGlassColors.alertRose, fontSize: 12),
              ),
            )
          else if (vm.slotsData != null) ...[
            _buildSlotsSummary(vm),
            const SizedBox(height: 12),
            _buildSlotList(context, vm),
            if (vm.allowedSlots < 5) ...[
              const SizedBox(height: 12),
              _buildUnlockSlotsButton(context, vm),
            ],
          ],
        ],
      ],
    );
  }

  Widget _buildSlotsSummary(ManageUsersViewModel vm) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.25),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.50)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Row(
            children: [
              Icon(Icons.shield_outlined, size: 16, color: ParcelGlassColors.accentBlue),
              SizedBox(width: 8),
              Text(
                'Locker Capacity:',
                style: TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          Text(
            '${vm.usedSlots} / ${vm.allowedSlots} Active (5 Total)',
            style: const TextStyle(
              color: ParcelGlassColors.navyTitle,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSlotList(BuildContext context, ManageUsersViewModel vm) {
    final primary = vm.primaryOwner;
    final List coOwners = vm.coOwners;
    final Map nicknames = vm.coOwnerNicknames;
    final int allowed = vm.allowedSlots;
    final bool isOwner = vm.isOwner;

    final List<Widget> cards = [];

    // Slot 1: Primary Owner
    final ownerName = primary is Map ? (primary['name'] ?? 'Primary Owner') : 'Primary Owner';
    final ownerPhone = primary is Map
        ? ((primary['phone'] != null && primary['phone'].toString().isNotEmpty)
            ? primary['phone'].toString()
            : (primary['email'] ?? ''))
        : '';

    cards.add(ManageUsersSlotCard.buildUserSlotRow(
      slotNumber: 1,
      name: ownerName,
      phoneOrContact: ownerPhone,
      badgeText: 'PRIMARY OWNER',
      badgeColor: ParcelGlassColors.accentBlue,
    ));

    // Slots 2 to 5
    for (int i = 2; i <= 5; i++) {
      final isSlotUnlocked = i <= allowed;
      final coOwnerIndex = i - 2;

      if (!isSlotUnlocked) {
        cards.add(ManageUsersSlotCard.buildLockedSlotRow(slotNumber: i));
      } else if (coOwnerIndex < coOwners.length) {
        final coOwner = coOwners[coOwnerIndex];
        final coOwnerId = coOwner is Map ? (coOwner['_id'] ?? coOwner['id'] ?? '') : coOwner.toString();
        final rawPhone = coOwner is Map ? (coOwner['phone'] ?? '') : '';
        final email = coOwner is Map ? (coOwner['email'] ?? '') : '';
        final phoneOrContact = (rawPhone.toString().isNotEmpty) ? rawPhone.toString() : email;
        final defaultName = coOwner is Map ? (coOwner['name'] ?? phoneOrContact) : phoneOrContact;
        final alias = (nicknames[coOwnerId] != null && nicknames[coOwnerId].toString().isNotEmpty)
            ? nicknames[coOwnerId]
            : defaultName;

        cards.add(ManageUsersSlotCard.buildUserSlotRow(
          slotNumber: i,
          name: alias,
          phoneOrContact: phoneOrContact,
          badgeText: 'CO-OWNER',
          badgeColor: ParcelGlassColors.mintSignal,
          isCoOwner: true,
          isOwnerView: isOwner,
          onEditName: () => _handleRename(context, vm, coOwnerId, alias),
          onRevoke: () => _handleRevoke(context, vm, coOwnerId, alias),
        ));
      } else {
        cards.add(ManageUsersSlotCard.buildAvailableSlotRow(
          context: context,
          slotNumber: i,
          isOwner: isOwner,
          deviceId: vm.selectedDevice?.deviceId,
          deviceName: vm.selectedDevice?.name,
        ));
      }
    }

    return Column(children: cards);
  }

  Widget _buildUnlockSlotsButton(BuildContext context, ManageUsersViewModel vm) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        foregroundColor: ParcelGlassColors.navyTitle,
        side: BorderSide(color: ParcelGlassColors.navyTitle.withValues(alpha: 0.35)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 12),
        backgroundColor: Colors.white.withValues(alpha: 0.15),
      ),
      onPressed: () => _openUnlockModal(context, vm),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.workspace_premium_outlined, size: 16, color: ParcelGlassColors.amberSignal),
          SizedBox(width: 8),
          Text(
            'UNLOCK MORE SLOTS (SEE PLANS)',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}

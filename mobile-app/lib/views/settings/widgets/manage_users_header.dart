import 'package:flutter/material.dart';
import '../../../models/device.model.dart';
import '../../widgets/glass_theme.dart';

class ManageUsersHeader extends StatelessWidget {
  final List<DeviceModel> devices;
  final DeviceModel? selectedDevice;
  final ValueChanged<DeviceModel> onDeviceSelected;

  const ManageUsersHeader({
    super.key,
    required this.devices,
    required this.selectedDevice,
    required this.onDeviceSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
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
                    Icons.people_outline,
                    color: ParcelGlassColors.accentBlue,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'MANAGE USERS',
                  style: TextStyle(
                    color: ParcelGlassColors.navyTitle,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
            IconButton(
              icon: const Icon(Icons.close, color: ParcelGlassColors.slateSubtitle, size: 20),
              onPressed: () => Navigator.pop(context),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ),
        const SizedBox(height: 14),
        if (devices.length > 1) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.50)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<DeviceModel>(
                value: selectedDevice != null && devices.any((d) => d.id == selectedDevice!.id)
                    ? devices.firstWhere((d) => d.id == selectedDevice!.id)
                    : devices.first,
                isExpanded: true,
                icon: const Icon(Icons.arrow_drop_down, color: ParcelGlassColors.accentBlue),
                onChanged: (DeviceModel? newDevice) {
                  if (newDevice != null) {
                    onDeviceSelected(newDevice);
                  }
                },
                items: devices.map((d) {
                  return DropdownMenuItem<DeviceModel>(
                    value: d,
                    child: Text(
                      '${d.name} (${d.deviceId})',
                      style: const TextStyle(
                        color: ParcelGlassColors.navyTitle,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

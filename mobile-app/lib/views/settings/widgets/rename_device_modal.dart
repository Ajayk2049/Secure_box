import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../models/device.model.dart';
import '../../../view_models/home_view_model.dart';
import '../../widgets/glass_theme.dart';

class RenameDeviceModal extends StatefulWidget {
  const RenameDeviceModal({super.key});

  static Future<void> show(BuildContext context) {
    return showParcelGlassDialog(
      context: context,
      width: 340,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: const RenameDeviceModal(),
    );
  }

  @override
  State<RenameDeviceModal> createState() => _RenameDeviceModalState();
}

class _RenameDeviceModalState extends State<RenameDeviceModal> {
  DeviceModel? _selectedDevice;
  late TextEditingController _nameController;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final home = context.read<HomeViewModel>();
    final owned = home.devices.where((d) => d.isOwner).toList();
    _selectedDevice = (home.selectedDevice != null && home.selectedDevice!.isOwner)
        ? home.selectedDevice
        : (owned.isNotEmpty ? owned.first : null);
    _nameController = TextEditingController(text: _selectedDevice?.name ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _handleRename() async {
    if (_selectedDevice == null || !_selectedDevice!.isOwner) return;
    final newName = _nameController.text.trim();
    if (newName.isEmpty) {
      setState(() => _errorMessage = 'Locker name cannot be empty');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final home = context.read<HomeViewModel>();
    try {
      await home.renameDevice(_selectedDevice!.id, newName);
      if (!mounted) return;
      setState(() => _isLoading = false);
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Locker renamed to "$newName"!'),
          backgroundColor: ParcelGlassColors.accentBlue,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString().replaceAll('Exception: ', '').trim();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final home = context.watch<HomeViewModel>();
    final ownedDevices = home.devices.where((d) => d.isOwner).toList();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Header
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
                    Icons.drive_file_rename_outline,
                    color: ParcelGlassColors.accentBlue,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'RENAME LOCKER',
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
        const SizedBox(height: 16),

        if (ownedDevices.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
            decoration: BoxDecoration(
              color: ParcelGlassColors.amberSignal.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: ParcelGlassColors.amberSignal.withValues(alpha: 0.35),
                width: 1.0,
              ),
            ),
            child: const Row(
              children: [
                Icon(Icons.shield_outlined, color: ParcelGlassColors.amberSignal, size: 22),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Only the primary owner can rename a locker box. You are currently connected as a co-owner.',
                    style: TextStyle(
                      color: ParcelGlassColors.navyTitle,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          )
        else ...[
          // Device Selector if multiple owned devices
          if (ownedDevices.length > 1) ...[
            const Text(
              'SELECT LOCKER BOX',
              style: TextStyle(
                color: ParcelGlassColors.slateSubtitle,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white.withValues(alpha: 0.50), width: 1.0),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<DeviceModel>(
                  value: _selectedDevice != null && ownedDevices.any((d) => d.id == _selectedDevice!.id)
                      ? ownedDevices.firstWhere((d) => d.id == _selectedDevice!.id)
                      : ownedDevices.first,
                  isExpanded: true,
                  icon: const Icon(Icons.arrow_drop_down, color: ParcelGlassColors.accentBlue),
                  onChanged: (DeviceModel? newDevice) {
                    if (newDevice != null) {
                      setState(() {
                        _selectedDevice = newDevice;
                        _nameController.text = newDevice.name;
                      });
                    }
                  },
                  items: ownedDevices.map((d) {
                    return DropdownMenuItem<DeviceModel>(
                      value: d,
                      child: Text(
                        '${d.name} (${d.deviceId})',
                        style: const TextStyle(
                          color: ParcelGlassColors.navyTitle,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Locker Device ID badge
          if (_selectedDevice != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white.withValues(alpha: 0.50), width: 1.0),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.qr_code_2, size: 16, color: ParcelGlassColors.slateSubtitle),
                  const SizedBox(width: 8),
                  Text(
                    'Device ID: ${_selectedDevice!.deviceId}',
                    style: const TextStyle(
                      color: ParcelGlassColors.slateSubtitle,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 14),

          // Name Field
          TextField(
            controller: _nameController,
            textCapitalization: TextCapitalization.words,
            style: const TextStyle(
              color: ParcelGlassColors.navyTitle,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
            decoration: InputDecoration(
              labelText: 'Locker Box Name',
              hintText: 'e.g. Front Porch Locker',
              labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 13),
              prefixIcon: const Icon(Icons.edit_note, color: ParcelGlassColors.accentBlue, size: 21),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.25),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.50), width: 1.0),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.50), width: 1.0),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: ParcelGlassColors.accentBlue, width: 1.6),
              ),
            ),
          ),


          if (_errorMessage != null) ...[
            const SizedBox(height: 10),
            Text(
              _errorMessage!,
              style: const TextStyle(color: ParcelGlassColors.alertRose, fontSize: 12.5),
            ),
          ],

          const SizedBox(height: 18),

          // Save Action Button
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleRename,
              style: ElevatedButton.styleFrom(
                backgroundColor: ParcelGlassColors.navyTitle,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'UPDATE LOCKER NAME',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
            ),
          ),
        ],
      ],
    );
  }
}

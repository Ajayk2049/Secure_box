import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../view_models/home_view_model.dart';
import 'add_locker/device_code_tab_view.dart';
import 'add_locker/join_code_tab_view.dart';
import 'glass_theme.dart';

class AddLockerDialog extends StatefulWidget {
  const AddLockerDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showParcelGlassDialog(
      context: context,
      width: 350,
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
      child: const AddLockerDialog(),
    );
  }


  @override
  State<AddLockerDialog> createState() => _AddLockerDialogState();
}

class _AddLockerDialogState extends State<AddLockerDialog> {
  int _selectedTab = 0; // 0: Hardware Device Code, 1: Family Join Code

  final _deviceIdController = TextEditingController();
  final _nameController = TextEditingController(text: 'Front Door Locker');
  final _joinCodeController = TextEditingController();

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _deviceIdController.dispose();
    _nameController.dispose();
    _joinCodeController.dispose();
    super.dispose();
  }

  Future<void> _submitDeviceCode() async {
    final deviceId = _deviceIdController.text.trim().toUpperCase();
    final name = _nameController.text.trim();

    if (deviceId.isEmpty) {
      setState(() => _errorMessage = 'Please enter Device Code (e.g. BOX_001)');
      return;
    }
    if (name.isEmpty) {
      setState(() => _errorMessage = 'Please enter a name for your locker');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      await context.read<HomeViewModel>().pairNewDevice(deviceId, name);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Locker "$deviceId" linked!'),
            backgroundColor: ParcelGlassColors.mintSignal,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  Future<void> _submitJoinCode() async {
    final joinCode = _joinCodeController.text.trim().toUpperCase().replaceAll(' ', '');
    if (joinCode.isEmpty) {
      setState(() => _errorMessage = 'Please enter Join Code');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      await context.read<HomeViewModel>().joinDeviceViaCode(joinCode);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Joined locker successfully!'),
            backgroundColor: ParcelGlassColors.mintSignal,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final primaryTextColor = ParcelGlassColors.textPrimary(context);
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: ParcelGlassColors.amberSignal.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.add_box_rounded,
                  color: ParcelGlassColors.amberSignal,
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'ADD LOCKER',
                  style: TextStyle(
                    color: primaryTextColor,
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: Icon(Icons.close, color: secondaryTextColor, size: 20),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),

          const SizedBox(height: 18),

          // Glass Tab Selector (Fast, responsive, zero shader lag)
          Container(
            height: 42,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(21),
              border: Border.all(color: Colors.white.withValues(alpha: 0.50)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() {
                      _selectedTab = 0;
                      _errorMessage = null;
                    }),
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      curve: Curves.easeOutCubic,
                      decoration: BoxDecoration(
                        color: _selectedTab == 0 ? ParcelGlassColors.navyTitle : Colors.transparent,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'Device Code',
                        style: TextStyle(
                          color: _selectedTab == 0 ? Colors.white : ParcelGlassColors.slateSubtitle,
                          fontSize: 12.5,
                          fontWeight: _selectedTab == 0 ? FontWeight.w800 : FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() {
                      _selectedTab = 1;
                      _errorMessage = null;
                    }),
                    behavior: HitTestBehavior.opaque,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      curve: Curves.easeOutCubic,
                      decoration: BoxDecoration(
                        color: _selectedTab == 1 ? ParcelGlassColors.navyTitle : Colors.transparent,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'Join Code',
                        style: TextStyle(
                          color: _selectedTab == 1 ? Colors.white : ParcelGlassColors.slateSubtitle,
                          fontSize: 12.5,
                          fontWeight: _selectedTab == 1 ? FontWeight.w800 : FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          // Tab Content
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            child: _selectedTab == 0
                ? DeviceCodeTabView(
                    key: const ValueKey('tab_device_code'),
                    deviceIdController: _deviceIdController,
                    nameController: _nameController,
                    isSubmitting: _isSubmitting,
                    onSubmit: _submitDeviceCode,
                  )
                : JoinCodeTabView(
                    key: const ValueKey('tab_join_code'),
                    joinCodeController: _joinCodeController,
                    isSubmitting: _isSubmitting,
                    onSubmit: _submitJoinCode,
                  ),
          ),

          if (_errorMessage != null) ...[
            const SizedBox(height: 12),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: ParcelGlassColors.alertRose,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      );
  }
}


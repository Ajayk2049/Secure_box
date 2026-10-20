import 'package:flutter/material.dart';
import 'package:liquid_glass_easy/liquid_glass_easy.dart';
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

          // LiquidGlassTabBar for tabs (pure text: Device Code & Join Code)
          Center(
            child: RepaintBoundary(
              child: LiquidGlassTabBar(
              width: 300,
              height: 44,
              margin: EdgeInsets.zero,
              alignment: Alignment.center,
              items: [
                LiquidGlassTabBarItem(
                  label: 'Device Code',
                  iconBuilder: (_, __) => const SizedBox.shrink(),
                ),
                LiquidGlassTabBarItem(
                  label: 'Join Code',
                  iconBuilder: (_, __) => const SizedBox.shrink(),
                ),
              ],
              selectedIndex: _selectedTab,
              onChanged: (index) => setState(() {
                _selectedTab = index;
                _errorMessage = null;
              }),
              pillStyle: LiquidGlassTabPillStyle(
                mode: LiquidGlassPillMode.both,
                color: ParcelGlassColors.accentBlue.withValues(alpha: 0.18),
                animated: true,
              ),
              itemStyle: const LiquidGlassTabItemStyle(
                selectedColor: ParcelGlassColors.accentBlue,
                unselectedColor: ParcelGlassColors.slateSubtitle,
                iconSize: 0,
                underGlassIconSize: 0,
                iconLabelGap: 0,
                labelFontSize: 13,
                selectedFontWeight: FontWeight.w800,
                unselectedFontWeight: FontWeight.w600,
              ),
              style: LiquidGlassStyle(
                shape: const LiquidGlassShape.continuousRoundedRectangle(
                  cornerRadius: 22,
                  borderWidth: 1.0,
                  borderColor: Color(0x40FFFFFF),
                ),
                appearance: LiquidGlassAppearance(
                  color: Colors.white.withValues(alpha: 0.20),
                  blur: const LiquidGlassBlur(sigmaX: 8, sigmaY: 8),
                ),
              ),
            ),
          ),
        ),

          const SizedBox(height: 18),

          // Tab Content
          SizedBox(
            height: 200,
            child: _selectedTab == 0
                ? DeviceCodeTabView(
                    deviceIdController: _deviceIdController,
                    nameController: _nameController,
                    isSubmitting: _isSubmitting,
                    onSubmit: _submitDeviceCode,
                  )
                : JoinCodeTabView(
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


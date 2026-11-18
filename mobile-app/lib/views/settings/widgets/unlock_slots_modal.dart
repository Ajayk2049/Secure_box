import 'package:flutter/material.dart';
import '../../../services/api_service.dart';
import '../../widgets/glass_theme.dart';

class UnlockSlotsModal extends StatefulWidget {
  final String deviceId;
  final String deviceName;
  final int currentAllowed;
  final VoidCallback onRequestSent;

  const UnlockSlotsModal({
    super.key,
    required this.deviceId,
    required this.deviceName,
    required this.currentAllowed,
    required this.onRequestSent,
  });

  static Future<void> show({
    required BuildContext context,
    required String deviceId,
    required String deviceName,
    required int currentAllowed,
    required VoidCallback onRequestSent,
  }) {
    return showParcelGlassDialog(
      context: context,
      width: 350,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
      child: UnlockSlotsModal(
        deviceId: deviceId,
        deviceName: deviceName,
        currentAllowed: currentAllowed,
        onRequestSent: onRequestSent,
      ),
    );
  }

  @override
  State<UnlockSlotsModal> createState() => _UnlockSlotsModalState();
}

class _UnlockSlotsModalState extends State<UnlockSlotsModal> {
  bool _isSubmitting = false;
  bool _isLoadingPricing = true;
  final int _selectedTier = 5; // 5 slots total
  String _selectedPlan = 'yearly'; // 'monthly' or 'yearly'

  int _monthlyPrice = 149;
  int _yearlyPrice = 999;
  int _savingsPercent = 44;

  @override
  void initState() {
    super.initState();
    _fetchPricing();
  }

  Future<void> _fetchPricing() async {
    try {
      final data = await ApiService().getSlotPricing();
      if (mounted) {
        setState(() {
          _monthlyPrice = (data['monthlyPrice'] as num?)?.toInt() ?? 149;
          _yearlyPrice = (data['yearlyPrice'] as num?)?.toInt() ?? 999;
          _savingsPercent = (data['savingsPercent'] as num?)?.toInt() ?? 44;
          _isLoadingPricing = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingPricing = false);
    }
  }

  Future<void> _handleSubmit() async {
    setState(() => _isSubmitting = true);
    try {
      final res = await ApiService().requestSlotUpgrade(
        widget.deviceId,
        desiredSlots: _selectedTier,
        plan: _selectedPlan,
        notes: 'Requested $_selectedPlan plan to unlock all 3 extra slots (5 total)',
      );

      if (mounted) {
        Navigator.pop(context);
        widget.onRequestSent();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res['message'] ?? 'Upgrade application submitted! Admin will contact you.'),
            backgroundColor: ParcelGlassColors.mintSignal,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: ${e.toString().replaceAll("Exception: ", "")}'),
            backgroundColor: ParcelGlassColors.alertRose,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Title Row
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: ParcelGlassColors.amberSignal.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.workspace_premium_outlined,
                    color: ParcelGlassColors.amberSignal,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'UNLOCK SLOTS',
                  style: TextStyle(
                    color: ParcelGlassColors.navyTitle,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
            const ParcelCircleCloseButton(),
          ],
        ),
        const SizedBox(height: 14),

        Text(
          'Expand your locker capacity up to 5 family or tenant member slots.',
          style: TextStyle(
            color: ParcelGlassColors.navyTitle.withValues(alpha: 0.8),
            fontSize: 12.5,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 14),

        // Plan Choice Cards
        _isLoadingPricing
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: CircularProgressIndicator(strokeWidth: 2, color: ParcelGlassColors.navyTitle),
                ),
              )
            : Row(
                children: [
                  Expanded(
                    child: _buildPlanCard(
                      planId: 'monthly',
                      title: 'Monthly',
                      price: '₹$_monthlyPrice',
                      period: '/ mo',
                      subtitle: 'Flexible family access',
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildPlanCard(
                      planId: 'yearly',
                      title: 'Annual',
                      price: '₹$_yearlyPrice',
                      period: '/ yr',
                      subtitle: 'Save $_savingsPercent% yearly',
                      isBestValue: true,
                    ),
                  ),
                ],
              ),
        const SizedBox(height: 16),

        // Benefits summary
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.25),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.40)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildFeatureRow(Icons.all_inclusive, 'Unlock all 5 user slots immediately'),
              const SizedBox(height: 6),
              _buildFeatureRow(Icons.notifications_active_outlined, 'Instant delivery alerts for all members'),
              const SizedBox(height: 6),
              _buildFeatureRow(Icons.support_agent, 'Priority locker support & device warranty'),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Action Button
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: ParcelGlassColors.navyTitle,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 13),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 0,
          ),
          onPressed: _isSubmitting ? null : _handleSubmit,
          child: _isSubmitting
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.send_rounded, size: 16),
                    SizedBox(width: 8),
                    Text(
                      'REQUEST UNLOCK FROM ADMIN',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, letterSpacing: 0.5),
                    ),
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildPlanCard({
    required String planId,
    required String title,
    required String price,
    required String period,
    required String subtitle,
    bool isBestValue = false,
  }) {
    final isSelected = _selectedPlan == planId;

    return GestureDetector(
      onTap: () => setState(() => _selectedPlan = planId),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? ParcelGlassColors.accentBlue.withValues(alpha: 0.12)
              : Colors.white.withValues(alpha: 0.25),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? ParcelGlassColors.accentBlue : Colors.white.withValues(alpha: 0.45),
            width: isSelected ? 1.8 : 1.0,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    color: isSelected ? ParcelGlassColors.accentBlue : ParcelGlassColors.navyTitle,
                    fontWeight: FontWeight.w800,
                    fontSize: 12.5,
                  ),
                ),
                if (isBestValue)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: ParcelGlassColors.amberSignal.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'SAVE 44%',
                      style: TextStyle(
                        color: ParcelGlassColors.amberSignal,
                        fontSize: 8,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  price,
                  style: const TextStyle(
                    color: ParcelGlassColors.navyTitle,
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  period,
                  style: const TextStyle(
                    color: ParcelGlassColors.slateSubtitle,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(
                color: ParcelGlassColors.slateSubtitle,
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 14, color: ParcelGlassColors.mintSignal),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              color: ParcelGlassColors.navyTitle,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

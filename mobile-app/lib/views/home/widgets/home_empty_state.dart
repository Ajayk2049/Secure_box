import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../view_models/auth_view_model.dart';
import '../../widgets/glass_theme.dart';

class HomeEmptyState extends StatelessWidget {
  final bool loading;
  final bool isOffline;
  final VoidCallback onAddLocker;
  final VoidCallback onOrderLocker;

  const HomeEmptyState({
    super.key,
    required this.loading,
    this.isOffline = false,
    required this.onAddLocker,
    required this.onOrderLocker,
  });

  void _showOfflineSnackbar(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Action unavailable while offline. Please restore connection.'),
        backgroundColor: ParcelGlassColors.alertRed,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 60),
          child: CircularProgressIndicator(color: ParcelGlassColors.accentBlue),
        ),
      );
    }

    final auth = context.watch<AuthViewModel>();
    final orderStatus = auth.user?.orderStatus;
    final hasActiveOrder = orderStatus != null && orderStatus.isNotEmpty;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 550),
        child: LiquidParcelCard(
          useStaticGlass: true,
          borderRadius: 24,
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.inventory_2_outlined, size: 44, color: ParcelGlassColors.accentBlue),
              const SizedBox(height: 12),
              const Text(
                'No Lockers Linked',
                style: TextStyle(
                  color: ParcelGlassColors.navyTitle,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Order your doorstep smart parcel locker box, or link an existing unit using your Device Code.',
                textAlign: TextAlign.center,
                style: TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 12.5),
              ),

              const SizedBox(height: 18),

              // Active Order Tracker Banner
              if (hasActiveOrder) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: ParcelGlassColors.amberSignal.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: ParcelGlassColors.amberSignal.withValues(alpha: 0.45)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.local_shipping_rounded, size: 22, color: ParcelGlassColors.amberSignal),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'ORDER STATUS: ${orderStatus.toUpperCase()}',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w900,
                                color: ParcelGlassColors.navyTitle,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              'In queue for hub dispatch. Once delivered, link below.',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: ParcelGlassColors.slateSubtitle,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // 1. Primary Action: ORDER NEW LOCKER
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isOffline ? Colors.grey.shade400 : ParcelGlassColors.parcelBrown,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  onPressed: isOffline ? () => _showOfflineSnackbar(context) : onOrderLocker,
                  icon: const Icon(Icons.local_shipping_rounded, size: 18),
                  label: Text(
                    hasActiveOrder ? 'ORDER ADDITIONAL LOCKER' : 'ORDER NEW LOCKER',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, letterSpacing: 0.5),
                  ),
                ),
              ),

              // Divider
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.60))),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      child: Text(
                        'OR LINK HARDWARE',
                        style: TextStyle(
                          fontSize: 9.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: ParcelGlassColors.slateSubtitle.withValues(alpha: 0.70),
                        ),
                      ),
                    ),
                    Expanded(child: Divider(color: Colors.white.withValues(alpha: 0.60))),
                  ],
                ),
              ),

              // 2. Secondary Action: ENTER DEVICE CODE
              SizedBox(
                width: double.infinity,
                height: 46,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isOffline ? Colors.grey.shade400 : ParcelGlassColors.accentBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  onPressed: isOffline ? () => _showOfflineSnackbar(context) : onAddLocker,
                  icon: const Icon(Icons.qr_code, size: 18),
                  label: Text(
                    isOffline ? 'LINKING UNAVAILABLE (OFFLINE)' : 'ENTER DEVICE CODE',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

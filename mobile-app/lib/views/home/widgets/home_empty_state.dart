import 'package:flutter/material.dart';
import '../../widgets/glass_theme.dart';

class HomeEmptyState extends StatelessWidget {
  final bool loading;
  final bool isOffline;
  final VoidCallback onAddLocker;

  const HomeEmptyState({
    super.key,
    required this.loading,
    this.isOffline = false,
    required this.onAddLocker,
  });

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

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 550),
        child: LiquidParcelCard(
          useStaticGlass: true,
          borderRadius: 24,
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.inventory_2_outlined, size: 48, color: ParcelGlassColors.accentBlue),
              const SizedBox(height: 14),
              const Text(
                'No Lockers Linked',
                style: TextStyle(
                  color: ParcelGlassColors.navyTitle,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Add your smart locker using the Hardware Device Code from your box sticker, or enter a Family Join Code.',
                textAlign: TextAlign.center,
                style: TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 13),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isOffline ? Colors.grey.shade400 : ParcelGlassColors.accentBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  onPressed: isOffline
                      ? () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: const Text('Cannot link lockers while offline. Please restore connection.'),
                              backgroundColor: ParcelGlassColors.alertRed,
                              behavior: SnackBarBehavior.floating,
                              margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                          );
                        }
                      : onAddLocker,
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

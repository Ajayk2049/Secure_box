import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../services/api_service.dart';
import '../../widgets/glass_theme.dart';

class CoOwnerInviteSheet {
  static void show(BuildContext context, String deviceId, String deviceName) async {
    final api = ApiService();
    try {
      final res = await api.createInviteCode(deviceId);
      final inviteCode = res['inviteCode'] ?? '';

      if (!context.mounted) return;

      showParcelGlassDialog(
        context: context,
        width: 340,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'INVITE CO-OWNER: $deviceName',
                    style: const TextStyle(
                      color: ParcelGlassColors.navyTitle,
                      fontSize: 14.5,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                const ParcelCircleCloseButton(),
              ],
            ),
            const SizedBox(height: 10),
            const Text(
              'Share this single-use code with your family member or flatmate. Valid for 24 hours:',
              style: TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 12.5),
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: ParcelGlassColors.mintSignal.withValues(alpha: 0.4),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    inviteCode,
                    style: const TextStyle(
                      fontSize: 24,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w900,
                      letterSpacing: 4.0,
                      color: ParcelGlassColors.accentBlue,
                    ),
                  ),
                  const SizedBox(width: 14),
                  IconButton(
                    icon: const Icon(Icons.copy, color: ParcelGlassColors.slateSubtitle),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: inviteCode));
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: const Text('Join code copied to clipboard!'),
                          behavior: SnackBarBehavior.floating,
                          margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      );

    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Could not generate invite: ${e.toString()}'),
            backgroundColor: ParcelGlassColors.alertRed,
            behavior: SnackBarBehavior.floating,
            margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        );
      }
    }
  }
}

import 'package:flutter/material.dart';
import '../../widgets/glass_theme.dart';

class RevokeCoOwnerModal {
  static Future<bool?> show({
    required BuildContext context,
    required String userName,
  }) {
    return showParcelGlassDialog<bool>(
      context: context,
      width: 320,
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.warning_amber_rounded, size: 20, color: ParcelGlassColors.alertRose),
              SizedBox(width: 8),
              Text(
                'REVOKE ACCESS',
                style: TextStyle(
                  color: ParcelGlassColors.alertRose,
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Are you sure you want to revoke locker access for "$userName"? They will no longer be able to open this box.',
            style: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 12.5),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ParcelGlassColors.alertRose,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Revoke', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

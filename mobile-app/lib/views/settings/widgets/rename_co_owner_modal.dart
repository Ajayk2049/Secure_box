import 'package:flutter/material.dart';
import '../../widgets/glass_theme.dart';

class RenameCoOwnerModal {
  static Future<String?> show({
    required BuildContext context,
    required String currentName,
  }) {
    final controller = TextEditingController(text: currentName);

    return showParcelGlassDialog<String>(
      context: context,
      width: 320,
      padding: const EdgeInsets.all(18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.edit, size: 18, color: ParcelGlassColors.accentBlue),
              SizedBox(width: 8),
              Text(
                'RENAME CO-OWNER',
                style: TextStyle(
                  color: ParcelGlassColors.navyTitle,
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: controller,
            textCapitalization: TextCapitalization.words,
            style: const TextStyle(
              color: ParcelGlassColors.navyTitle,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
            decoration: InputDecoration(
              labelText: 'Nickname or Alias',
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.25),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.50)),
              ),
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: ParcelGlassColors.navyTitle,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('SAVE ALIAS', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../glass_theme.dart';

class DeviceCodeTabView extends StatelessWidget {
  final TextEditingController deviceIdController;
  final TextEditingController nameController;
  final bool isSubmitting;
  final VoidCallback onSubmit;

  const DeviceCodeTabView({
    super.key,
    required this.deviceIdController,
    required this.nameController,
    required this.isSubmitting,
    required this.onSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final primaryTextColor = ParcelGlassColors.textPrimary(context);
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Device ID field
        SizedBox(
          height: 52,
          child: TextField(
            controller: deviceIdController,
            textCapitalization: TextCapitalization.characters,
            style: TextStyle(
              color: primaryTextColor,
              fontSize: 14,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
            decoration: InputDecoration(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              hintText: 'e.g. BOX_001',
              hintStyle: TextStyle(
                color: secondaryTextColor.withValues(alpha: 0.55),
                fontSize: 13.5,
              ),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.35),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(
                  color: Colors.white.withValues(alpha: 0.60),
                  width: 1.2,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(
                  color: Colors.white.withValues(alpha: 0.60),
                  width: 1.2,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: ParcelGlassColors.accentBlue,
                  width: 1.8,
                ),
              ),
            ),
          ),
        ),

        const SizedBox(height: 14),

        // Name field
        SizedBox(
          height: 52,
          child: TextField(
            controller: nameController,
            style: TextStyle(color: primaryTextColor, fontSize: 14),
            decoration: InputDecoration(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              hintText: 'e.g. Front Door Locker',
              hintStyle: TextStyle(
                color: secondaryTextColor.withValues(alpha: 0.55),
                fontSize: 13.5,
              ),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.35),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(
                  color: Colors.white.withValues(alpha: 0.60),
                  width: 1.2,
                ),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(
                  color: Colors.white.withValues(alpha: 0.60),
                  width: 1.2,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: ParcelGlassColors.accentBlue,
                  width: 1.8,
                ),
              ),
            ),
          ),
        ),

        const SizedBox(height: 18),

        // Link Locker Action Button
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: isSubmitting ? null : onSubmit,
            style: ElevatedButton.styleFrom(
              backgroundColor: ParcelGlassColors.navyTitle,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              elevation: 0,
            ),
            child: isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.link_rounded, size: 18),
                      SizedBox(width: 8),
                      Text(
                        'LINK LOCKER',
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}

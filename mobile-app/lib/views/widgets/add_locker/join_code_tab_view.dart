import 'package:flutter/material.dart';
import '../glass_theme.dart';

class JoinCodeTabView extends StatelessWidget {
  final TextEditingController joinCodeController;
  final bool isSubmitting;
  final VoidCallback onSubmit;

  const JoinCodeTabView({
    super.key,
    required this.joinCodeController,
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
        // Join Code field
        SizedBox(
          height: 52,
          child: TextField(
            controller: joinCodeController,
            textCapitalization: TextCapitalization.characters,
            style: TextStyle(
              color: primaryTextColor,
              fontSize: 15,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
              letterSpacing: 2.0,
            ),
            decoration: InputDecoration(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              hintText: 'e.g. SBX-79A2',
              hintStyle: TextStyle(
                color: secondaryTextColor.withValues(alpha: 0.55),
                fontSize: 13.5,
                letterSpacing: 0,
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

        const SizedBox(height: 10),

        Text(
          'Enter the 6-character invite code to join this locker as a co-owner.',
          style: TextStyle(
            color: secondaryTextColor.withValues(alpha: 0.75),
            fontSize: 12.5,
            height: 1.3,
          ),
        ),

        const SizedBox(height: 18),

        // Join As Co-Owner Action Button
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
                      Icon(Icons.group_add_rounded, size: 18),
                      SizedBox(width: 8),
                      Text(
                        'JOIN AS CO-OWNER',
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

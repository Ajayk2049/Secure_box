import 'package:flutter/material.dart';
import '../../widgets/glass_theme.dart';

class SettingsProfileCard extends StatelessWidget {
  final String userName;
  final String userPhone;
  final String accountScopeText;
  final String? avatarEmoji;

  const SettingsProfileCard({
    super.key,
    required this.userName,
    required this.userPhone,
    required this.accountScopeText,
    this.avatarEmoji,
  });

  @override
  Widget build(BuildContext context) {
    final hasEmoji = avatarEmoji != null && avatarEmoji!.isNotEmpty;

    return LiquidParcelCard(
      useStaticGlass: true,
      borderRadius: 22,
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: ParcelGlassColors.accentBlue.withValues(alpha: 0.15),
              shape: BoxShape.circle,
              border: Border.all(
                color: ParcelGlassColors.accentBlue.withValues(alpha: 0.35),
                width: 1.5,
              ),
            ),
            child: Center(
              child: hasEmoji
                  ? Text(
                      avatarEmoji!,
                      style: const TextStyle(fontSize: 22),
                    )
                  : Text(
                      userName.isNotEmpty ? userName[0].toUpperCase() : 'U',
                      style: const TextStyle(
                        color: ParcelGlassColors.accentBlue,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  userName,
                  style: const TextStyle(
                    color: ParcelGlassColors.navyTitle,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                if (userPhone.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    userPhone,
                    style: const TextStyle(
                      color: ParcelGlassColors.slateSubtitle,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: ParcelGlassColors.accentBlue.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    accountScopeText.toUpperCase(),
                    style: const TextStyle(
                      color: ParcelGlassColors.accentBlue,
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../../widgets/glass_theme.dart';

class HomeUserGreeting extends StatelessWidget {
  final String userName;
  final bool showAddButton;
  final bool isOffline;
  final VoidCallback onAddLocker;

  const HomeUserGreeting({
    super.key,
    required this.userName,
    required this.showAddButton,
    this.isOffline = false,
    required this.onAddLocker,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
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
            child: Text(
              userName.isNotEmpty ? userName[0].toUpperCase() : 'U',
              style: const TextStyle(
                color: ParcelGlassColors.accentBlue,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              userName,
              style: const TextStyle(
                color: ParcelGlassColors.navyTitle,
                fontSize: 17,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
              ),
            ),
            Text(
              'Secure Box Member',
              style: TextStyle(
                color: ParcelGlassColors.slateSubtitle.withValues(alpha: 0.8),
                fontSize: 12,
              ),
            ),
          ],
        ),
        const Spacer(),
        if (showAddButton)
          IconButton(
            icon: Icon(
              Icons.add_circle_outline,
              color: isOffline ? Colors.black26 : ParcelGlassColors.accentBlue,
              size: 26,
            ),
            tooltip: isOffline ? 'Unavailable while offline' : 'Add Locker',
            onPressed: isOffline
                ? () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: const Text('Cannot add lockers while offline. Please restore connection.'),
                        backgroundColor: ParcelGlassColors.alertRed,
                        behavior: SnackBarBehavior.floating,
                        margin: const EdgeInsets.only(bottom: 100, left: 20, right: 20),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    );
                  }
                : onAddLocker,
          ),
      ],
    );
  }
}

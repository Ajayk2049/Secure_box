import 'package:flutter/material.dart';
import '../../widgets/glass_theme.dart';
import '../../widgets/network_host_dialog.dart';

class AuthTopBar extends StatelessWidget {
  final VoidCallback? onHostChanged;

  const AuthTopBar({
    super.key,
    this.onHostChanged,
  });

  @override
  Widget build(BuildContext context) {
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    return Align(
      alignment: Alignment.centerRight,
      child: GestureDetector(
        onTap: () => NetworkHostDialog.show(context).then((_) => onHostChanged?.call()),
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.7),
            shape: BoxShape.circle,
            border: Border.all(
              color: Colors.black.withValues(alpha: 0.08),
              width: 1.0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Icon(Icons.settings, color: secondaryTextColor, size: 18),
        ),
      ),
    );
  }
}

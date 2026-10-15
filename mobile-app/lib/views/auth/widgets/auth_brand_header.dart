import 'package:flutter/material.dart';
import '../../widgets/glass_theme.dart';

class AuthBrandHeader extends StatelessWidget {
  const AuthBrandHeader({super.key});

  @override
  Widget build(BuildContext context) {
    final primaryTextColor = ParcelGlassColors.textPrimary(context);

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Image.asset(
          'assets/icon/icon_512.png',
          width: 44,
          height: 44,
        ),
        const SizedBox(width: 12),
        Text(
          'SECURE BOX',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: primaryTextColor,
            letterSpacing: 2.0,
          ),
        ),
      ],
    );
  }
}

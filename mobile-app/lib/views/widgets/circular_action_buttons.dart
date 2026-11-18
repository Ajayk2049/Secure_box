import 'package:flutter/material.dart';
import 'glass_theme.dart';

/// Elegant circular glass back button '<' with crisp indicator circle
class ParcelCircleBackButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Color? color;
  final double size;
  final double? iconSize;

  const ParcelCircleBackButton({
    super.key,
    this.onPressed,
    this.color,
    this.size = 36.0,
    this.iconSize,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.55),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.85),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF3D2310).withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(size / 2),
          onTap: onPressed ?? () => Navigator.pop(context),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.only(right: 1.5),
              child: Icon(
                Icons.arrow_back_ios_new_rounded,
                size: iconSize ?? (size * 0.44),
                color: color ?? ParcelGlassColors.navyTitle,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Elegant circular glass close button '✕' for modals and popups
class ParcelCircleCloseButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Color? color;
  final double size;
  final double? iconSize;

  const ParcelCircleCloseButton({
    super.key,
    this.onPressed,
    this.color,
    this.size = 32.0,
    this.iconSize,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.55),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.85),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF3D2310).withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(size / 2),
          onTap: onPressed ?? () => Navigator.pop(context),
          child: Center(
            child: Icon(
              Icons.close_rounded,
              size: iconSize ?? (size * 0.52),
              color: color ?? ParcelGlassColors.slateSubtitle,
            ),
          ),
        ),
      ),
    );
  }
}

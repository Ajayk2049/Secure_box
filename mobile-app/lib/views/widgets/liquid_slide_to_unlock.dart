import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'glass_theme.dart';

class LiquidSlideToUnlock extends StatefulWidget {
  final Future<void> Function() onUnlock;
  final bool isUnlocking;
  final bool isLockerOnline;
  final bool isUnlocked;
  final bool enabled;
  final bool isChecking;

  const LiquidSlideToUnlock({
    super.key,
    required this.onUnlock,
    this.isUnlocking = false,
    this.isLockerOnline = true,
    this.isUnlocked = false,
    this.enabled = true,
    this.isChecking = false,
  });

  @override
  State<LiquidSlideToUnlock> createState() => _LiquidSlideToUnlockState();
}

class _LiquidSlideToUnlockState extends State<LiquidSlideToUnlock>
    with SingleTickerProviderStateMixin {
  late AnimationController _snapBackController;
  Animation<double>? _snapAnimation;
  double _dragProgress = 0.0;
  bool _triggered = false;

  @override
  void initState() {
    super.initState();
    _snapBackController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    )..addListener(() {
        if (_snapAnimation != null) {
          setState(() {
            _dragProgress = _snapAnimation!.value;
          });
        }
      });
  }

  @override
  void dispose() {
    _snapBackController.dispose();
    super.dispose();
  }

  void _snapBack() {
    if (_dragProgress <= 0.0) return;
    _snapAnimation = Tween<double>(begin: _dragProgress, end: 0.0).animate(
      CurvedAnimation(parent: _snapBackController, curve: Curves.easeOutCubic),
    );
    _snapBackController.forward(from: 0.0);
  }

  void _onHorizontalDragStart(DragStartDetails details) {
    if (_snapBackController.isAnimating) {
      _snapBackController.stop();
    }
  }

  void _onHorizontalDragUpdate(DragUpdateDetails details, double trackWidth) {
    if (widget.isUnlocking || !widget.isLockerOnline || widget.isUnlocked || !widget.enabled || widget.isChecking || _triggered) return;

    const thumbSize = 52.0;
    final usableWidth = trackWidth - thumbSize - 12.0;
    if (usableWidth <= 0) return;

    setState(() {
      _dragProgress = (_dragProgress + details.delta.dx / usableWidth).clamp(0.0, 1.0);
    });

    if (_dragProgress >= 0.88 && !_triggered) {
      _triggered = true;
      HapticFeedback.heavyImpact();
      widget.onUnlock().catchError((_) {}).whenComplete(() {
        if (mounted) {
          _triggered = false;
          _snapBack();
        }
      });
    }
  }

  void _onHorizontalDragEnd(DragEndDetails details) {
    if (_triggered) return;
    _snapBack();
  }

  void _onHorizontalDragCancel() {
    if (_triggered) return;
    _snapBack();
  }

  @override
  Widget build(BuildContext context) {
    final primaryTextColor = ParcelGlassColors.textPrimary(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final trackWidth = constraints.maxWidth;
        const thumbSize = 52.0;
        const trackHeight = 64.0;
        final maxOffset = trackWidth - thumbSize - 12.0;
        final currentOffset = _dragProgress * maxOffset;

        final Color borderColor = !widget.enabled
            ? Colors.black12
            : (widget.isUnlocked
                ? ParcelGlassColors.amberSignal.withValues(alpha: 0.65)
                : (widget.isLockerOnline
                    ? ParcelGlassColors.mintSignal.withValues(alpha: 0.5)
                    : Colors.black12));

        final Color trackBgColor = !widget.enabled
            ? Colors.black.withValues(alpha: 0.04)
            : (widget.isUnlocked
                ? ParcelGlassColors.amberSignal.withValues(alpha: 0.16)
                : Colors.black.withValues(alpha: 0.05));

        final Color thumbColor = !widget.enabled
            ? Colors.grey.shade400
            : (widget.isUnlocked
                ? ParcelGlassColors.amberSignal
                : (widget.isLockerOnline
                    ? ParcelGlassColors.mintSignal
                    : Colors.grey.shade400));

        return ClipRRect(
          borderRadius: BorderRadius.circular(32),
          child: Container(
            height: trackHeight,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(32),
              color: trackBgColor,
              border: Border.all(
                color: borderColor,
                width: 1.5,
              ),
            ),
            child: Stack(
              alignment: Alignment.centerLeft,
              children: [
                // Active fill bar that expands as user drags
                if (!widget.isUnlocked && widget.isLockerOnline && widget.enabled)
                  Positioned(
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: currentOffset + thumbSize + 6,
                    child: RepaintBoundary(
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(32),
                          gradient: LinearGradient(
                            colors: [
                              ParcelGlassColors.mintSignal.withValues(alpha: 0.20),
                              ParcelGlassColors.mintSignal.withValues(alpha: 0.50),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),

                // Label positioned cleanly to not overlap the resting thumb
                Positioned.fill(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: thumbSize + 12),
                    child: Center(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: !widget.enabled
                            ? Row(
                                mainAxisSize: MainAxisSize.min,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    widget.isChecking ? Icons.sync_rounded : Icons.cloud_off_rounded,
                                    size: 14,
                                    color: Colors.black38,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    widget.isChecking
                                        ? 'CHECKING SERVER...'
                                        : (!widget.isLockerOnline
                                            ? 'LOCKER OFFLINE • UNLOCK DISABLED'
                                            : 'SERVER OFFLINE • UNLOCK DISABLED'),
                                    style: const TextStyle(
                                      color: Colors.black38,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 11,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ],
                              )
                            : widget.isUnlocking
                                ? const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.2,
                                          color: ParcelGlassColors.mintSignal,
                                        ),
                                      ),
                                      SizedBox(width: 10),
                                      Text(
                                        'OPENING SOLENOID LOCK...',
                                        style: TextStyle(
                                          color: ParcelGlassColors.mintSignal,
                                          fontWeight: FontWeight.w900,
                                          fontSize: 12,
                                          letterSpacing: 1.2,
                                        ),
                                      ),
                                    ],
                                  )
                                : widget.isUnlocked
                                    ? const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            Icons.lock_open_rounded,
                                            color: ParcelGlassColors.amberSignal,
                                            size: 18,
                                          ),
                                          SizedBox(width: 8),
                                          Text(
                                            'DOOR UNLOCKED • PUSH TO LOCK',
                                            style: TextStyle(
                                              color: ParcelGlassColors.amberSignal,
                                              fontWeight: FontWeight.w900,
                                              fontSize: 12,
                                              letterSpacing: 0.8,
                                            ),
                                          ),
                                        ],
                                      )
                                    : Text(
                                        widget.isLockerOnline
                                            ? 'SLIDE TO UNLOCK DOOR ➔'
                                            : 'LOCKER IS OFFLINE',
                                        style: TextStyle(
                                          color: widget.isLockerOnline
                                              ? primaryTextColor.withValues(alpha: (0.7 - (_dragProgress * 0.5)).clamp(0.0, 1.0))
                                              : Colors.black38,
                                          fontWeight: FontWeight.w900,
                                          fontSize: 12,
                                          letterSpacing: 1.2,
                                        ),
                                      ),
                      ),
                    ),
                  ),
                ),

                // Centered Circular Thumb Handle
                Positioned(
                  left: 6 + currentOffset,
                  top: 6,
                  bottom: 6,
                  child: RepaintBoundary(
                    child: GestureDetector(
                      onHorizontalDragStart: _onHorizontalDragStart,
                      onHorizontalDragUpdate: (d) => _onHorizontalDragUpdate(d, trackWidth),
                      onHorizontalDragEnd: _onHorizontalDragEnd,
                      onHorizontalDragCancel: _onHorizontalDragCancel,
                      child: Container(
                        width: thumbSize,
                        height: thumbSize,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: thumbColor,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.9),
                            width: 2.0,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: (widget.isUnlocked
                                      ? ParcelGlassColors.amberSignal
                                      : (widget.isLockerOnline ? ParcelGlassColors.mintSignal : Colors.black))
                                  .withValues(alpha: 0.35),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Center(
                          child: Icon(
                            widget.isUnlocked
                                ? Icons.lock_open_rounded
                                : (widget.isUnlocking
                                    ? Icons.lock_open
                                    : Icons.lock_outline),
                            color: Colors.white,
                            size: 24,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

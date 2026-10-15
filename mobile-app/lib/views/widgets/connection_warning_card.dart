import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/connectivity_service.dart';
import '../../view_models/auth_view_model.dart';
import '../../view_models/home_view_model.dart';
import 'glass_theme.dart';
import 'network_host_dialog.dart';

class ConnectionWarningCard extends StatefulWidget {
  final ConnectionIssue issue;

  const ConnectionWarningCard({
    super.key,
    required this.issue,
  });

  @override
  State<ConnectionWarningCard> createState() => _ConnectionWarningCardState();
}

class _ConnectionWarningCardState extends State<ConnectionWarningCard> {
  bool _isRetrying = false;

  Future<void> _handleRetry() async {
    setState(() => _isRetrying = true);
    try {
      await context.read<HomeViewModel>().retryConnection();
    } finally {
      if (mounted) setState(() => _isRetrying = false);
    }
  }

  void _handleReauth() {
    context.read<AuthViewModel>().logout();
    Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.issue == ConnectionIssue.none) return const SizedBox.shrink();

    final isSessionExpired = widget.issue == ConnectionIssue.sessionExpired;
    final isNoInternet = widget.issue == ConnectionIssue.noInternet;
    final label = isSessionExpired
        ? 'Session Expired • Tap to Sign In'
        : (isNoInternet ? 'Internet Not Detected' : 'Server Unreachable');
    final iconData = isSessionExpired
        ? Icons.lock_clock_rounded
        : (isNoInternet ? Icons.wifi_off_rounded : Icons.cloud_off_rounded);

    return InkWell(
      onTap: isSessionExpired ? _handleReauth : null,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2).withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: ParcelGlassColors.alertRed.withValues(alpha: 0.35),
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: ParcelGlassColors.alertRed.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: ParcelGlassColors.alertRed,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Icon(iconData, color: ParcelGlassColors.alertRed, size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  color: Color(0xFF991B1B),
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.1,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 6),
            if (isSessionExpired) ...[
              InkWell(
                onTap: _handleReauth,
                borderRadius: BorderRadius.circular(8),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Sign In',
                        style: TextStyle(
                          color: Color(0xFF991B1B),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      SizedBox(width: 2),
                      Icon(
                        Icons.arrow_forward_rounded,
                        size: 14,
                        color: Color(0xFF991B1B),
                      ),
                    ],
                  ),
                ),
              ),
            ] else ...[
              // Small retry icon button
              InkWell(
                onTap: _isRetrying ? null : _handleRetry,
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.all(4),
                  child: _isRetrying
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: ParcelGlassColors.alertRed,
                          ),
                        )
                      : const Icon(
                          Icons.refresh_rounded,
                          size: 18,
                          color: Color(0xFF991B1B),
                        ),
                ),
              ),
              const SizedBox(width: 4),
              // Small host settings gear
              InkWell(
                onTap: () => NetworkHostDialog.show(context),
                borderRadius: BorderRadius.circular(8),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(
                    Icons.tune_rounded,
                    size: 16,
                    color: Color(0xFF991B1B),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

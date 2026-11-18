import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../view_models/auth_view_model.dart';
import '../../widgets/glass_theme.dart';

class ChangePasswordDialog extends StatefulWidget {
  const ChangePasswordDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showParcelGlassDialog(
      context: context,
      width: 330,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
      child: const ChangePasswordDialog(),
    );
  }

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscureCurrent = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final current = _currentPasswordController.text;
    final newPwd = _newPasswordController.text;
    final confirm = _confirmPasswordController.text;

    if (current.isEmpty) {
      setState(() => _errorMessage = 'Please enter your current password');
      return;
    }
    if (newPwd.length < 6 || newPwd.length > 12) {
      setState(() => _errorMessage = 'New password must be between 6 and 12 characters');
      return;
    }
    if (newPwd != confirm) {
      setState(() => _errorMessage = 'New passwords do not match');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    final auth = context.read<AuthViewModel>();
    final ok = await auth.changePassword(
      currentPassword: current,
      newPassword: newPwd,
    );

    if (!mounted) return;

    if (ok) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle_outline, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Expanded(child: Text('Login password updated successfully!')),
            ],
          ),
          backgroundColor: ParcelGlassColors.mintSignal,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } else {
      setState(() {
        _isSubmitting = false;
        _errorMessage = auth.error ?? 'Failed to update password. Check your current password.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final primaryTextColor = ParcelGlassColors.textPrimary(context);
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Title Header
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: ParcelGlassColors.accentBlue.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.password_rounded, color: ParcelGlassColors.accentBlue, size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              'Change Password',
              style: TextStyle(
                color: ParcelGlassColors.navyTitle,
                fontSize: 17,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.3,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          'Update your account password using your current password.',
          style: TextStyle(
            color: ParcelGlassColors.slateSubtitle,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 16),

        // 1. Current Password Field
        TextField(
          controller: _currentPasswordController,
          obscureText: _obscureCurrent,
          style: TextStyle(color: primaryTextColor, fontSize: 13.5, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            labelText: 'Current Password',
            labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 12.5),
            prefixIcon: const Icon(Icons.lock_outline, color: ParcelGlassColors.accentBlue, size: 18),
            suffixIcon: IconButton(
              icon: Icon(_obscureCurrent ? Icons.visibility_off : Icons.visibility, color: secondaryTextColor, size: 17),
              onPressed: () => setState(() => _obscureCurrent = !_obscureCurrent),
            ),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.6),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
        const SizedBox(height: 10),

        // 2. New Password Field
        TextField(
          controller: _newPasswordController,
          obscureText: _obscureNew,
          maxLength: 12,
          style: TextStyle(color: primaryTextColor, fontSize: 13.5, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            counterText: '',
            labelText: 'New Password (6–12 chars)',
            labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 12.5),
            prefixIcon: const Icon(Icons.lock_reset, color: ParcelGlassColors.accentBlue, size: 18),
            suffixIcon: IconButton(
              icon: Icon(_obscureNew ? Icons.visibility_off : Icons.visibility, color: secondaryTextColor, size: 17),
              onPressed: () => setState(() => _obscureNew = !_obscureNew),
            ),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.6),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
        const SizedBox(height: 10),

        // 3. Confirm New Password Field
        TextField(
          controller: _confirmPasswordController,
          obscureText: _obscureConfirm,
          maxLength: 12,
          style: TextStyle(color: primaryTextColor, fontSize: 13.5, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            counterText: '',
            labelText: 'Confirm New Password',
            labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 12.5),
            prefixIcon: const Icon(Icons.check_circle_outline, color: ParcelGlassColors.accentBlue, size: 18),
            suffixIcon: IconButton(
              icon: Icon(_obscureConfirm ? Icons.visibility_off : Icons.visibility, color: secondaryTextColor, size: 17),
              onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
            ),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.6),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),

        // Error message
        if (_errorMessage != null) ...[
          const SizedBox(height: 10),
          Text(
            _errorMessage!,
            style: const TextStyle(color: ParcelGlassColors.alertRed, fontSize: 12, fontWeight: FontWeight.w600),
            textAlign: TextAlign.center,
          ),
        ],

        const SizedBox(height: 18),

        // Action Buttons
        Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 44,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: ParcelGlassColors.navyTitle,
                    side: BorderSide(color: Colors.black.withValues(alpha: 0.15)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _isSubmitting ? null : () => Navigator.pop(context),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: SizedBox(
                height: 44,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ParcelGlassColors.navyTitle,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  onPressed: _isSubmitting ? null : _handleSubmit,
                  child: _isSubmitting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('UPDATE', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

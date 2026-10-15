import 'package:flutter/material.dart';
import '../../../view_models/auth_view_model.dart';
import '../../widgets/glass_theme.dart';

class LoginFormCard extends StatefulWidget {
  final TextEditingController identifierController;
  final TextEditingController passwordController;
  final AuthViewModel auth;
  final VoidCallback onLoginSuccess;

  const LoginFormCard({
    super.key,
    required this.identifierController,
    required this.passwordController,
    required this.auth,
    required this.onLoginSuccess,
  });

  @override
  State<LoginFormCard> createState() => _LoginFormCardState();
}

class _LoginFormCardState extends State<LoginFormCard> {
  bool _obscurePassword = true;

  Future<void> _handleLogin() async {
    final id = widget.identifierController.text.trim();
    final pwd = widget.passwordController.text;
    if (id.isEmpty || pwd.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter phone/email and password')),
      );
      return;
    }

    final success = await widget.auth.login(id, pwd);
    if (!mounted) return;

    if (success) {
      widget.auth.clearError();
      widget.onLoginSuccess();
    } else {
      final errText = widget.auth.error ?? 'Invalid mobile number/email or password';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: ParcelGlassColors.alertRose,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          content: Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  errText,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final primaryTextColor = ParcelGlassColors.textPrimary(context);
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    return LiquidParcelCard(
      borderRadius: 24,
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Text(
              'SIGN IN',
              style: TextStyle(
                color: primaryTextColor,
                fontSize: 16,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.5,
              ),
            ),
          ),
          const SizedBox(height: 20),

          if (widget.auth.error != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: ParcelGlassColors.alertRose.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: ParcelGlassColors.alertRose.withValues(alpha: 0.35),
                ),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: ParcelGlassColors.alertRose, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.auth.error!,
                      style: const TextStyle(
                        color: ParcelGlassColors.alertRose,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Mobile / Email input
          TextField(
            controller: widget.identifierController,
            keyboardType: TextInputType.text,
            style: TextStyle(color: primaryTextColor, fontSize: 14, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              hintText: 'Mobile number / Email',
              hintStyle: TextStyle(
                color: secondaryTextColor.withValues(alpha: 0.6),
                fontSize: 13,
              ),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.65),
              prefixIcon: Icon(Icons.phone_iphone, color: secondaryTextColor, size: 18),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Colors.black12,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: ParcelGlassColors.mintSignal,
                  width: 1.8,
                ),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Password input
          TextField(
            controller: widget.passwordController,
            obscureText: _obscurePassword,
            style: TextStyle(color: primaryTextColor, fontSize: 14, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              hintText: 'Password',
              hintStyle: TextStyle(
                color: secondaryTextColor.withValues(alpha: 0.6),
                fontSize: 13,
              ),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.65),
              prefixIcon: Icon(Icons.lock_outline, color: secondaryTextColor, size: 18),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                  color: secondaryTextColor,
                  size: 18,
                ),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: Colors.black12,
                ),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(
                  color: ParcelGlassColors.mintSignal,
                  width: 1.8,
                ),
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Sign In Button
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: ParcelGlassColors.accentBlue,
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              onPressed: widget.auth.loading ? null : _handleLogin,
              child: widget.auth.loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Sign In',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.0,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

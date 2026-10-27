import 'package:flutter/material.dart';
import '../../../view_models/auth_view_model.dart';
import '../../widgets/glass_theme.dart';

class RegisterCredentialsStep extends StatelessWidget {
  final TextEditingController otpController;
  final TextEditingController nameController;
  final TextEditingController? emailController;
  final TextEditingController passwordController;
  final TextEditingController inviteCodeController;
  final AuthViewModel auth;
  final VoidCallback onRegister;

  const RegisterCredentialsStep({
    super.key,
    required this.otpController,
    required this.nameController,
    this.emailController,
    required this.passwordController,
    required this.inviteCodeController,
    required this.auth,
    required this.onRegister,
  });

  @override
  Widget build(BuildContext context) {
    final primaryTextColor = ParcelGlassColors.textPrimary(context);
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Text(
          'ENTER 6-DIGIT OTP',
          style: TextStyle(
            color: secondaryTextColor,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: otpController,
          keyboardType: TextInputType.number,
          style: TextStyle(
            color: primaryTextColor,
            fontSize: 16,
            fontFamily: 'monospace',
            letterSpacing: 3.0,
            fontWeight: FontWeight.bold,
          ),
          decoration: InputDecoration(
            hintText: '123456',
            hintStyle: TextStyle(
              color: secondaryTextColor.withValues(alpha: 0.4),
              letterSpacing: 3.0,
            ),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.65),
            prefixIcon: Icon(Icons.pin, color: secondaryTextColor, size: 18),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: ParcelGlassColors.mintSignal, width: 1.8),
            ),
          ),
        ),

        const SizedBox(height: 16),
        Text(
          'FULL NAME',
          style: TextStyle(
            color: secondaryTextColor,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: nameController,
          style: TextStyle(color: primaryTextColor, fontSize: 14, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: 'e.g. Rahul Sharma',
            hintStyle: TextStyle(color: secondaryTextColor.withValues(alpha: 0.5)),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.65),
            prefixIcon: Icon(Icons.person_outline, color: secondaryTextColor, size: 18),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: ParcelGlassColors.mintSignal, width: 1.8),
            ),
          ),
        ),

        const SizedBox(height: 16),
        Text(
          'EMAIL ADDRESS (OPTIONAL)',
          style: TextStyle(
            color: secondaryTextColor,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 6),
        if (emailController != null)
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: emailController!,
            builder: (context, value, _) {
              final text = value.text.trim();
              final isInvalid = text.isNotEmpty &&
                  !RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(text);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: TextStyle(color: primaryTextColor, fontSize: 14, fontWeight: FontWeight.w600),
                    decoration: InputDecoration(
                      hintText: 'name@example.com',
                      hintStyle: TextStyle(color: secondaryTextColor.withValues(alpha: 0.5)),
                      filled: true,
                      fillColor: Colors.white.withValues(alpha: 0.65),
                      prefixIcon: Icon(Icons.email_outlined, color: secondaryTextColor, size: 18),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: isInvalid
                            ? const BorderSide(color: ParcelGlassColors.alertRose, width: 1.5)
                            : const BorderSide(color: Colors.black12),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(
                          color: isInvalid ? ParcelGlassColors.alertRose : ParcelGlassColors.mintSignal,
                          width: 1.8,
                        ),
                      ),
                    ),
                  ),
                  if (isInvalid) ...[
                    const SizedBox(height: 4),
                    const Text(
                      'Please enter a valid email address (e.g. name@example.com)',
                      style: TextStyle(
                        color: ParcelGlassColors.alertRose,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              );
            },
          ),

        const SizedBox(height: 16),
        Text(
          'CREATE PASSWORD',
          style: TextStyle(
            color: secondaryTextColor,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: passwordController,
          obscureText: true,
          style: TextStyle(color: primaryTextColor, fontSize: 14, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: '••••••••',
            hintStyle: TextStyle(color: secondaryTextColor.withValues(alpha: 0.5)),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.65),
            prefixIcon: Icon(Icons.lock_outline, color: secondaryTextColor, size: 18),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: ParcelGlassColors.mintSignal, width: 1.8),
            ),
          ),
        ),

        const SizedBox(height: 16),
        Text(
          'JOIN CODE (OPTIONAL)',
          style: TextStyle(
            color: secondaryTextColor,
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: inviteCodeController,
          textCapitalization: TextCapitalization.characters,
          style: TextStyle(
            color: primaryTextColor,
            fontSize: 14,
            fontFamily: 'monospace',
            letterSpacing: 1.5,
            fontWeight: FontWeight.bold,
          ),
          decoration: InputDecoration(
            hintText: 'e.g. SBX-79A2',
            hintStyle: TextStyle(color: secondaryTextColor.withValues(alpha: 0.5)),
            helperText: 'Have a family invite code? Enter it to link immediately.',
            helperStyle: TextStyle(color: secondaryTextColor, fontSize: 11),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.65),
            prefixIcon: Icon(Icons.vpn_key_outlined, color: secondaryTextColor, size: 18),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: ParcelGlassColors.mintSignal, width: 1.8),
            ),
          ),
        ),

        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: ParcelGlassColors.accentBlue,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: auth.loading ? null : onRegister,
            child: auth.loading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                  )
                : const Text(
                    'COMPLETE REGISTRATION',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, letterSpacing: 1.2),
                  ),
          ),
        ),
      ],
    );
  }
}

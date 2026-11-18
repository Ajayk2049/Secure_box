import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../view_models/auth_view_model.dart';
import '../widgets/glass_theme.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isCheckingPhone = false;
  bool? _phoneExists;
  bool _otpSent = false;
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;
  String? _localError;

  int _cooldownSeconds = 0;
  Timer? _cooldownTimer;

  @override
  void initState() {
    super.initState();
    _phoneController.addListener(_onPhoneChanged);
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _phoneController.removeListener(_onPhoneChanged);
    _phoneController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _onPhoneChanged() {
    final clean = _phoneController.text.trim().replaceAll(RegExp(r'\D'), '');
    if (clean.length == 10) {
      _checkPhoneNumber(clean);
    } else {
      if (_phoneExists != null) {
        setState(() {
          _phoneExists = null;
          _otpSent = false;
          _localError = null;
        });
      }
    }
  }

  Future<void> _checkPhoneNumber(String phone) async {
    setState(() {
      _isCheckingPhone = true;
      _localError = null;
    });

    final auth = context.read<AuthViewModel>();
    final exists = await auth.checkPhoneExists(phone);

    if (!mounted) return;
    setState(() {
      _isCheckingPhone = false;
      _phoneExists = exists;
    });
  }

  void _startCooldown([int seconds = 60]) {
    _cooldownTimer?.cancel();
    setState(() => _cooldownSeconds = seconds);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_cooldownSeconds <= 1) {
        timer.cancel();
        if (mounted) setState(() => _cooldownSeconds = 0);
      } else {
        if (mounted) setState(() => _cooldownSeconds--);
      }
    });
  }

  Future<void> _handleSendOtp() async {
    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\D'), '');
    if (phone.length != 10) return;

    final auth = context.read<AuthViewModel>();
    final ok = await auth.sendResetOtp(phone);
    if (!mounted) return;

    if (ok) {
      setState(() {
        _otpSent = true;
        _localError = null;
      });
      _startCooldown();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('OTP sent to your mobile number'),
          backgroundColor: ParcelGlassColors.accentBlue,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } else {
      setState(() => _localError = auth.error ?? 'Failed to send OTP');
    }
  }

  Future<void> _handleResetPassword() async {
    final phone = _phoneController.text.trim().replaceAll(RegExp(r'\D'), '');
    final otp = _otpController.text.trim();
    final pwd = _passwordController.text;
    final confirm = _confirmPasswordController.text;

    if (phone.length != 10) {
      setState(() => _localError = 'Enter a valid 10-digit mobile number');
      return;
    }
    if (otp.length < 4) {
      setState(() => _localError = 'Enter the verification OTP');
      return;
    }
    if (pwd.length < 6 || pwd.length > 12) {
      setState(() => _localError = 'Password must be 6 to 12 characters');
      return;
    }
    if (pwd != confirm) {
      setState(() => _localError = 'Passwords do not match');
      return;
    }

    final auth = context.read<AuthViewModel>();
    final ok = await auth.resetPassword(phone: phone, otp: otp, newPassword: pwd);
    if (!mounted) return;

    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Row(
            children: [
              Icon(Icons.check_circle_outline, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Expanded(child: Text('Password reset successfully! Please sign in.')),
            ],
          ),
          backgroundColor: ParcelGlassColors.mintSignal,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false, arguments: phone);
    } else {
      setState(() => _localError = auth.error ?? 'Failed to reset password');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthViewModel>();
    final primaryTextColor = ParcelGlassColors.textPrimary(context);
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    return ParcelGlassScaffold(
      child: SafeArea(
        child: Column(
          children: [
            // Top Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  ParcelCircleBackButton(
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Spacer(),
                  const Text(
                    'Forgot Password',
                    style: TextStyle(
                      color: ParcelGlassColors.navyTitle,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const Spacer(),
                  const SizedBox(width: 48),
                ],
              ),
            ),

            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Header Icon
                        Center(
                          child: Container(
                            width: 60,
                            height: 60,
                            decoration: BoxDecoration(
                              color: ParcelGlassColors.accentBlue.withValues(alpha: 0.12),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.lock_reset_rounded, color: ParcelGlassColors.accentBlue, size: 30),
                          ),
                        ),
                        const SizedBox(height: 16),

                        const Text(
                          'Reset Your Password',
                          style: TextStyle(
                            color: ParcelGlassColors.navyTitle,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.4,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Enter your 10-digit mobile number to verify your account and set a new password.',
                          style: TextStyle(
                            color: ParcelGlassColors.slateSubtitle,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            height: 1.35,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 24),

                        // Card Container
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.55),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 1.4),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 16,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // 1. Mobile Number Field
                              TextField(
                                controller: _phoneController,
                                keyboardType: TextInputType.phone,
                                enabled: !_otpSent,
                                maxLength: 10,
                                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                style: TextStyle(color: primaryTextColor, fontSize: 14, fontWeight: FontWeight.w600),
                                decoration: InputDecoration(
                                  counterText: '',
                                  labelText: 'Mobile Number',
                                  labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 13),
                                  prefixIcon: const Icon(Icons.phone_iphone_rounded, color: ParcelGlassColors.accentBlue, size: 19),
                                  prefixText: '+91 ',
                                  prefixStyle: TextStyle(color: primaryTextColor, fontWeight: FontWeight.w700),
                                  suffixIcon: _isCheckingPhone
                                      ? const Padding(
                                          padding: EdgeInsets.all(12),
                                          child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                                        )
                                      : (_phoneExists == true
                                          ? const Icon(Icons.check_circle, color: ParcelGlassColors.mintSignal, size: 20)
                                          : null),
                                  filled: true,
                                  fillColor: Colors.white.withValues(alpha: 0.7),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                                ),
                              ),

                              // Account not present in DB alert + Sign Up button
                              if (_phoneExists == false && !_isCheckingPhone) ...[
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEF2F2),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: const Color(0xFFFCA5A5)),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Row(
                                        children: [
                                          Icon(Icons.info_outline, color: ParcelGlassColors.alertRed, size: 18),
                                          SizedBox(width: 8),
                                          Expanded(
                                            child: Text(
                                              'No account found with this mobile number.',
                                              style: TextStyle(color: ParcelGlassColors.alertRed, fontSize: 12.5, fontWeight: FontWeight.w700),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      SizedBox(
                                        width: double.infinity,
                                        height: 38,
                                        child: ElevatedButton(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: ParcelGlassColors.navyTitle,
                                            foregroundColor: Colors.white,
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                            elevation: 0,
                                          ),
                                          onPressed: () {
                                            Navigator.pushReplacementNamed(context, '/register');
                                          },
                                          child: const Text('CREATE AN ACCOUNT / SIGN UP', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],

                              // Send OTP Button (when phone is verified in DB and OTP not yet sent)
                              if (_phoneExists == true && !_otpSent) ...[
                                const SizedBox(height: 14),
                                SizedBox(
                                  height: 48,
                                  child: ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: ParcelGlassColors.accentBlue,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                      elevation: 0,
                                    ),
                                    onPressed: auth.loading ? null : _handleSendOtp,
                                    child: auth.loading
                                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                        : const Text('SEND VERIFICATION OTP', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                                  ),
                                ),
                              ],

                              // 2. OTP and Password Fields (after OTP sent)
                              if (_otpSent) ...[
                                const SizedBox(height: 14),
                                TextField(
                                  controller: _otpController,
                                  keyboardType: TextInputType.number,
                                  maxLength: 6,
                                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                  style: TextStyle(color: primaryTextColor, fontSize: 14, fontWeight: FontWeight.w600),
                                  decoration: InputDecoration(
                                    counterText: '',
                                    labelText: 'Enter OTP Code',
                                    labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 13),
                                    prefixIcon: const Icon(Icons.mark_email_read_outlined, color: ParcelGlassColors.accentBlue, size: 19),
                                    filled: true,
                                    fillColor: Colors.white.withValues(alpha: 0.7),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                                  ),
                                ),
                                const SizedBox(height: 8),

                                // Cooldown / Resend Row
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    if (_cooldownSeconds > 0)
                                      Text(
                                        'Resend OTP in ${_cooldownSeconds}s',
                                        style: TextStyle(color: secondaryTextColor, fontSize: 12, fontWeight: FontWeight.w600),
                                      )
                                    else
                                      TextButton(
                                        onPressed: auth.loading ? null : _handleSendOtp,
                                        style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero),
                                        child: const Text('Resend OTP', style: TextStyle(color: ParcelGlassColors.accentBlue, fontSize: 12, fontWeight: FontWeight.w700)),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 12),

                                // New Password
                                TextField(
                                  controller: _passwordController,
                                  obscureText: _obscureNewPassword,
                                  maxLength: 12,
                                  style: TextStyle(color: primaryTextColor, fontSize: 14, fontWeight: FontWeight.w600),
                                  decoration: InputDecoration(
                                    counterText: '',
                                    labelText: 'New Password (6–12 chars)',
                                    labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 13),
                                    prefixIcon: const Icon(Icons.lock_outline, color: ParcelGlassColors.accentBlue, size: 19),
                                    suffixIcon: IconButton(
                                      icon: Icon(_obscureNewPassword ? Icons.visibility_off : Icons.visibility, color: secondaryTextColor, size: 18),
                                      onPressed: () => setState(() => _obscureNewPassword = !_obscureNewPassword),
                                    ),
                                    filled: true,
                                    fillColor: Colors.white.withValues(alpha: 0.7),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                                  ),
                                ),
                                const SizedBox(height: 14),

                                // Confirm Password
                                TextField(
                                  controller: _confirmPasswordController,
                                  obscureText: _obscureConfirmPassword,
                                  maxLength: 12,
                                  style: TextStyle(color: primaryTextColor, fontSize: 14, fontWeight: FontWeight.w600),
                                  decoration: InputDecoration(
                                    counterText: '',
                                    labelText: 'Confirm Password',
                                    labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 13),
                                    prefixIcon: const Icon(Icons.lock_reset, color: ParcelGlassColors.accentBlue, size: 19),
                                    suffixIcon: IconButton(
                                      icon: Icon(_obscureConfirmPassword ? Icons.visibility_off : Icons.visibility, color: secondaryTextColor, size: 18),
                                      onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                                    ),
                                    filled: true,
                                    fillColor: Colors.white.withValues(alpha: 0.7),
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                                  ),
                                ),
                                const SizedBox(height: 18),

                                // Submit Reset Password Button
                                SizedBox(
                                  height: 48,
                                  child: ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: ParcelGlassColors.navyTitle,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                      elevation: 0,
                                    ),
                                    onPressed: auth.loading ? null : _handleResetPassword,
                                    child: auth.loading
                                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                        : const Text('UPDATE PASSWORD', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                                  ),
                                ),
                              ],

                              // Inline Error Message
                              if (_localError != null) ...[
                                const SizedBox(height: 12),
                                Text(
                                  _localError!,
                                  style: const TextStyle(color: ParcelGlassColors.alertRed, fontSize: 12.5, fontWeight: FontWeight.w600),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

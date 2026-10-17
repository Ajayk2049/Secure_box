import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../view_models/auth_view_model.dart';
import '../widgets/glass_theme.dart';
import 'widgets/auth_top_bar.dart';
import 'widgets/register_credentials_step.dart';
import 'widgets/register_phone_otp_step.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _inviteCodeController = TextEditingController();

  bool _otpSent = false;
  String? _infoMessage;
  int _cooldownSeconds = 0;
  Timer? _cooldownTimer;

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _phoneController.dispose();
    _emailController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _inviteCodeController.dispose();
    super.dispose();
  }

  void _startCooldown([int seconds = 60]) {
    _cooldownTimer?.cancel();
    setState(() {
      _cooldownSeconds = seconds;
    });
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_cooldownSeconds <= 1) {
        timer.cancel();
        if (mounted) {
          setState(() {
            _cooldownSeconds = 0;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _cooldownSeconds--;
          });
        }
      }
    });
  }

  void _handleSendOtp(AuthViewModel auth) async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty || phone.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid 10-digit mobile number')),
      );
      return;
    }

    // Pre-check if phone already exists before requesting OTP to avoid wasting SMS OTPs
    final phoneCheck = await auth.checkPhone(phone);
    if (!mounted) return;

    if (phoneCheck['exists'] == true) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Account Already Exists', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Text(
            phoneCheck['error'] ?? 'An account with this mobile number already exists. Please sign in instead.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: ParcelGlassColors.mintSignal,
                foregroundColor: Colors.black,
              ),
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.pushReplacementNamed(context, '/login', arguments: phone);
              },
              child: const Text('Sign In Instead', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
      return;
    }

    final result = await auth.sendOtp(phone);
    if (!mounted) return;

    if (result['exists'] == true) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Account Already Exists', style: TextStyle(fontWeight: FontWeight.bold)),
          content: Text(
            result['error'] ?? 'An account with this mobile number already exists. Please sign in instead.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: ParcelGlassColors.mintSignal,
                foregroundColor: Colors.black,
              ),
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.pushReplacementNamed(context, '/login', arguments: phone);
              },
              child: const Text('Sign In Instead', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
      return;
    }

    if (result['success'] == true) {
      _startCooldown(60);
      setState(() {
        _otpSent = true;
        _infoMessage = result['message'] ?? 'OTP verification code sent!';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_infoMessage!),
          backgroundColor: ParcelGlassColors.amberSignal,
        ),
      );
    } else {
      if (result['cooldownRemaining'] != null) {
        final waitSec = int.tryParse(result['cooldownRemaining'].toString()) ?? 60;
        _startCooldown(waitSec);
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['error'] ?? 'Failed to send OTP'),
          backgroundColor: ParcelGlassColors.alertRose,
        ),
      );
    }
  }

  void _handleRegister(AuthViewModel auth) async {
    final email = _emailController.text.trim().toLowerCase();
    if (email.isNotEmpty) {
      final emailCheck = await auth.checkEmail(email);
      if (!mounted) return;
      if (emailCheck['exists'] == true) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('Account Already Exists', style: TextStyle(fontWeight: FontWeight.bold)),
            content: Text(
              emailCheck['message'] ?? 'An account with this email address already exists. Please sign in instead.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: ParcelGlassColors.mintSignal,
                  foregroundColor: Colors.black,
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pushReplacementNamed(context, '/login', arguments: email);
                },
                child: const Text('Sign In Instead', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
        return;
      }
    }

    final success = await auth.registerWithOtp(
      phone: _phoneController.text.trim(),
      otp: _otpController.text.trim(),
      password: _passwordController.text,
      email: email.isNotEmpty ? email : null,
      name: _nameController.text.trim(),
      inviteCode: _inviteCodeController.text.trim(),
    );

    if (success && mounted) {
      Navigator.pushReplacementNamed(context, '/home');
    } else if (!success && mounted) {
      final err = auth.error ?? '';
      if (err.toLowerCase().contains('already exists')) {
        final prefill = err.toLowerCase().contains('email') && email.isNotEmpty
            ? email
            : _phoneController.text.trim();
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text('Account Already Exists', style: TextStyle(fontWeight: FontWeight.bold)),
            content: Text(err),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: ParcelGlassColors.mintSignal,
                  foregroundColor: Colors.black,
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pushReplacementNamed(context, '/login', arguments: prefill);
                },
                child: const Text('Sign In Instead', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthViewModel>();
    final primaryTextColor = ParcelGlassColors.textPrimary(context);
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    return ParcelGlassScaffold(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            children: [
              // Top Bar: Wi-Fi Server Indicator
              AuthTopBar(
                onHostChanged: () => setState(() {}),
              ),

              const SizedBox(height: 16),

              Text(
                'SECURE BOX',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: primaryTextColor,
                  letterSpacing: 2.0,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Member Registration & Locker Access',
                style: TextStyle(color: secondaryTextColor, fontSize: 13),
              ),

              const SizedBox(height: 24),

              // Registration Glass Card
              LiquidParcelCard(
                borderRadius: 24,
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'CREATE ACCOUNT',
                      style: TextStyle(
                        color: primaryTextColor,
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (auth.error != null) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: ParcelGlassColors.alertRose.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: ParcelGlassColors.alertRose.withValues(alpha: 0.35)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: ParcelGlassColors.alertRose, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                auth.error!,
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

                    RegisterPhoneOtpStep(
                      phoneController: _phoneController,
                      otpSent: _otpSent,
                      cooldownSeconds: _cooldownSeconds,
                      auth: auth,
                      onSendOtp: () => _handleSendOtp(auth),
                    ),

                    if (_otpSent)
                      RegisterCredentialsStep(
                        otpController: _otpController,
                        nameController: _nameController,
                        emailController: _emailController,
                        passwordController: _passwordController,
                        inviteCodeController: _inviteCodeController,
                        auth: auth,
                        onRegister: () => _handleRegister(auth),
                      ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              TextButton(
                onPressed: () => Navigator.pop(context),
                child: RichText(
                  text: TextSpan(
                    text: 'Already have an account? ',
                    style: TextStyle(color: secondaryTextColor, fontSize: 13),
                    children: const [
                      TextSpan(
                        text: 'Sign In',
                        style: TextStyle(color: ParcelGlassColors.mintSignal, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

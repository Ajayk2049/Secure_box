import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../view_models/auth_view_model.dart';
import '../widgets/glass_theme.dart';
import 'widgets/auth_brand_header.dart';
import 'widgets/auth_top_bar.dart';
import 'widgets/login_form_card.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final args = ModalRoute.of(context)?.settings.arguments;
        if (args is String && args.isNotEmpty) {
          _identifierController.text = args;
        } else {
          final auth = context.read<AuthViewModel>();
          if (auth.savedIdentifier != null && auth.savedIdentifier!.isNotEmpty) {
            _identifierController.text = auth.savedIdentifier!;
          }
        }
      }
    });
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthViewModel>();
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    return ParcelGlassScaffold(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Top Bar: Wi-Fi Server Indicator
              AuthTopBar(
                onHostChanged: () => setState(() {}),
              ),

              const SizedBox(height: 28),

              // Hero Brand Emblem & Subtitle
              const AuthBrandHeader(),

              const SizedBox(height: 28),

              // Liquid Glass Login Card
              LoginFormCard(
                identifierController: _identifierController,
                passwordController: _passwordController,
                auth: auth,
                onLoginSuccess: () {
                  Navigator.pushReplacementNamed(context, '/home');
                },
              ),

              const SizedBox(height: 20),

              // Create Account Link
              TextButton(
                onPressed: () => Navigator.pushNamed(context, '/register'),
                child: RichText(
                  text: TextSpan(
                    text: 'Need a new account? ',
                    style: TextStyle(color: secondaryTextColor, fontSize: 13),
                    children: const [
                      TextSpan(
                        text: 'Register / Join',
                        style: TextStyle(
                          color: ParcelGlassColors.mintSignal,
                          fontWeight: FontWeight.bold,
                        ),
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

// Deprecated: Auth top bar with server configuration has been removed.
import 'package:flutter/material.dart';

class AuthTopBar extends StatelessWidget {
  final VoidCallback? onHostChanged;
  const AuthTopBar({super.key, this.onHostChanged});
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

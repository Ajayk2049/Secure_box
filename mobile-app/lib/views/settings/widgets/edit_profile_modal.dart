import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../view_models/auth_view_model.dart';
import '../../widgets/glass_theme.dart';
import 'avatar_emoji_picker.dart';

class EditProfileModal extends StatefulWidget {
  const EditProfileModal({super.key});

  static Future<void> show(BuildContext context) {
    return showParcelGlassDialog(
      context: context,
      width: 340,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: const EditProfileModal(),
    );
  }

  @override
  State<EditProfileModal> createState() => _EditProfileModalState();
}

class _EditProfileModalState extends State<EditProfileModal> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _emailController;
  String? _selectedEmoji;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthViewModel>();
    _nameController = TextEditingController(text: auth.user?.name ?? '');
    _emailController = TextEditingController(text: auth.user?.email ?? '');
    _selectedEmoji = auth.avatarEmoji;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final auth = context.read<AuthViewModel>();
    
    // Save local avatar emoji immediately
    await auth.setAvatarEmoji(_selectedEmoji);

    final newName = _nameController.text.trim();
    final newEmail = _emailController.text.trim();
    final currentName = auth.user?.name ?? '';
    final currentEmail = auth.user?.email ?? '';

    bool success = true;
    if (newName != currentName || newEmail != currentEmail) {
      success = await auth.updateProfile(
        name: newName,
        email: newEmail,
      );
    }

    if (!mounted) return;

    setState(() {
      _isLoading = false;
    });

    if (success) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Profile updated successfully!'),
          backgroundColor: ParcelGlassColors.accentBlue,
        ),
      );
    } else {
      setState(() {
        _errorMessage = auth.error ?? 'Failed to update profile';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthViewModel>();
    final phone = auth.user?.phone ?? 'Verified Mobile';

    return Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      color: ParcelGlassColors.accentBlue.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.person_outline,
                      color: ParcelGlassColors.accentBlue,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'EDIT PROFILE',
                    style: TextStyle(
                      color: ParcelGlassColors.navyTitle,
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close, color: ParcelGlassColors.slateSubtitle, size: 20),
                onPressed: () => Navigator.pop(context),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Avatar Emoji Picker
          AvatarEmojiPicker(
            selectedEmoji: _selectedEmoji,
            defaultInitial: (auth.user?.name != null && auth.user!.name!.isNotEmpty)
                ? auth.user!.name![0].toUpperCase()
                : 'U',
            onEmojiChanged: (emoji) {
              setState(() {
                _selectedEmoji = emoji;
              });
            },
          ),
          const SizedBox(height: 16),

          // Phone (locked identifier)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.50), width: 1.0),
            ),
            child: Row(
              children: [
                const Icon(Icons.phone_android, size: 18, color: ParcelGlassColors.slateSubtitle),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    phone,
                    style: const TextStyle(
                      color: ParcelGlassColors.slateSubtitle,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
                const Icon(Icons.lock_outline, size: 16, color: ParcelGlassColors.slateSubtitle),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Name Field
          TextFormField(
            controller: _nameController,
            textCapitalization: TextCapitalization.words,
            style: const TextStyle(
              color: ParcelGlassColors.navyTitle,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
            decoration: InputDecoration(
              labelText: 'Full Name',
              labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 13),
              prefixIcon: const Icon(Icons.badge_outlined, color: ParcelGlassColors.accentBlue, size: 19),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.25),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.50), width: 1.0),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.50), width: 1.0),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: ParcelGlassColors.accentBlue, width: 1.6),
              ),
            ),
            validator: (val) {
              if (val == null || val.trim().isEmpty) {
                return 'Name cannot be empty';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),

          // Email Field
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: const TextStyle(
              color: ParcelGlassColors.navyTitle,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
            decoration: InputDecoration(
              labelText: 'Email Address',
              labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 13),
              prefixIcon: const Icon(Icons.email_outlined, color: ParcelGlassColors.accentBlue, size: 19),
              filled: true,
              fillColor: Colors.white.withValues(alpha: 0.25),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.50), width: 1.0),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.50), width: 1.0),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: ParcelGlassColors.accentBlue, width: 1.6),
              ),
            ),

            validator: (val) {
              if (val != null && val.trim().isNotEmpty) {
                final emailRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
                if (!emailRegex.hasMatch(val.trim())) {
                  return 'Enter a valid email address';
                }
              }
              return null;
            },
          ),

          if (_errorMessage != null) ...[
            const SizedBox(height: 10),
            Text(
              _errorMessage!,
              style: const TextStyle(color: ParcelGlassColors.alertRose, fontSize: 12.5),
            ),
          ],

          const SizedBox(height: 18),

          // Save Action Button
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _handleSave,
              style: ElevatedButton.styleFrom(
                backgroundColor: ParcelGlassColors.navyTitle,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              child: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'SAVE CHANGES',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../../widgets/glass_theme.dart';

class AvatarEmojiPicker extends StatefulWidget {
  final String? selectedEmoji;
  final String defaultInitial;
  final ValueChanged<String?> onEmojiChanged;

  const AvatarEmojiPicker({
    super.key,
    required this.selectedEmoji,
    required this.defaultInitial,
    required this.onEmojiChanged,
  });

  static const List<String> presetEmojis = [
    '📦', '🛡️', '⚡', '🚀', '🤖', '👑',
    '🎯', '🌟', '🥷', '💎', '🦊', '🦁',
    '🐯', '🐼', '🦅', '🐺', '🦉', '🐬',
    '☕', '🎮',
  ];

  @override
  State<AvatarEmojiPicker> createState() => _AvatarEmojiPickerState();
}

class _AvatarEmojiPickerState extends State<AvatarEmojiPicker> {
  late String? _currentEmoji;

  @override
  void initState() {
    super.initState();
    _currentEmoji = widget.selectedEmoji;
  }

  @override
  void didUpdateWidget(covariant AvatarEmojiPicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedEmoji != widget.selectedEmoji) {
      setState(() {
        _currentEmoji = widget.selectedEmoji;
      });
    }
  }

  void _selectEmoji(String? emoji) {
    setState(() {
      _currentEmoji = emoji;
    });
    widget.onEmojiChanged(emoji);
  }

  void _showCustomEmojiDialog(BuildContext context) {
    final controller = TextEditingController();
    showParcelGlassDialog(
      context: context,
      width: 300,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      child: StatefulBuilder(
        builder: (ctx, setDialogState) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'CUSTOM EMOJI',
                    style: TextStyle(
                      color: ParcelGlassColors.navyTitle,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.5,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: ParcelGlassColors.slateSubtitle, size: 18),
                    onPressed: () => Navigator.pop(ctx),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              const Text(
                'Type or paste any emoji from your keyboard:',
                style: TextStyle(
                  color: ParcelGlassColors.slateSubtitle,
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: controller,
                autofocus: true,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 36),
                onChanged: (val) {
                  final chars = val.characters;
                  if (chars.length > 1) {
                    final single = chars.first.toString();
                    controller.value = TextEditingValue(
                      text: single,
                      selection: TextSelection.collapsed(offset: single.length),
                    );
                  }
                  setDialogState(() {});
                },
                decoration: InputDecoration(
                  hintText: '😀',
                  filled: true,
                  fillColor: Colors.white.withValues(alpha: 0.35),
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  helperText: 'Strictly 1 emoji allowed',
                  helperStyle: const TextStyle(
                    color: ParcelGlassColors.slateSubtitle,
                    fontSize: 11,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.5)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.5)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: ParcelGlassColors.accentBlue, width: 1.6),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 42,
                child: ElevatedButton(
                  onPressed: controller.text.trim().isEmpty
                      ? null
                      : () {
                          final text = controller.text.trim();
                          if (text.isNotEmpty) {
                            final singleEmoji = text.characters.first.toString();
                            _selectEmoji(singleEmoji);
                          }
                          Navigator.pop(ctx);
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ParcelGlassColors.navyTitle,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: ParcelGlassColors.navyTitle.withValues(alpha: 0.35),
                    disabledForegroundColor: Colors.white54,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'USE EMOJI',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasEmoji = _currentEmoji != null && _currentEmoji!.isNotEmpty;

    return Column(
      children: [
        // Large Avatar Preview Circle
        GestureDetector(
          onTap: () => _showCustomEmojiDialog(context),
          child: Stack(
            alignment: Alignment.bottomRight,
            children: [
              Container(
                width: 68,
                height: 68,
                decoration: BoxDecoration(
                  color: ParcelGlassColors.accentBlue.withValues(alpha: 0.14),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: ParcelGlassColors.accentBlue.withValues(alpha: 0.40),
                    width: 2.0,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: ParcelGlassColors.accentBlue.withValues(alpha: 0.12),
                      blurRadius: 10,
                      spreadRadius: 1,
                    ),
                  ],
                ),
                child: Center(
                  child: hasEmoji
                      ? Text(
                          _currentEmoji!,
                          style: const TextStyle(fontSize: 34),
                        )
                      : Text(
                          widget.defaultInitial,
                          style: const TextStyle(
                            color: ParcelGlassColors.accentBlue,
                            fontWeight: FontWeight.w900,
                            fontSize: 28,
                          ),
                        ),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: ParcelGlassColors.navyTitle,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                child: const Icon(
                  Icons.edit,
                  color: Colors.white,
                  size: 11,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Select Avatar Emoji',
          style: TextStyle(
            color: ParcelGlassColors.slateSubtitle,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 10),

        // Horizontal Preset Emojis Selector
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            children: [
              // Reset to Initials Option
              _buildChip(
                isSelected: !hasEmoji,
                child: Text(
                  widget.defaultInitial,
                  style: TextStyle(
                    color: !hasEmoji ? ParcelGlassColors.accentBlue : ParcelGlassColors.navyTitle,
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                  ),
                ),
                onTap: () => _selectEmoji(null),
                tooltip: 'Use Initials',
              ),
              // Preset Emojis
              ...AvatarEmojiPicker.presetEmojis.map((emoji) {
                final isSelected = _currentEmoji == emoji;
                return _buildChip(
                  isSelected: isSelected,
                  child: Text(
                    emoji,
                    style: const TextStyle(fontSize: 20),
                  ),
                  onTap: () => _selectEmoji(emoji),
                );
              }),
              // Custom Keyboard Emoji Trigger
              _buildChip(
                isSelected: hasEmoji && !AvatarEmojiPicker.presetEmojis.contains(_currentEmoji),
                child: const Icon(
                  Icons.add_reaction_outlined,
                  size: 20,
                  color: ParcelGlassColors.accentBlue,
                ),
                onTap: () => _showCustomEmojiDialog(context),
                tooltip: 'Custom Emoji',
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildChip({
    required bool isSelected,
    required Widget child,
    required VoidCallback onTap,
    String? tooltip,
  }) {
    final chip = GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 44,
        height: 44,
        margin: const EdgeInsets.only(right: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? ParcelGlassColors.accentBlue.withValues(alpha: 0.18)
              : Colors.white.withValues(alpha: 0.25),
          shape: BoxShape.circle,
          border: Border.all(
            color: isSelected
                ? ParcelGlassColors.accentBlue
                : Colors.white.withValues(alpha: 0.50),
            width: isSelected ? 1.8 : 1.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: ParcelGlassColors.accentBlue.withValues(alpha: 0.16),
                    blurRadius: 6,
                  ),
                ]
              : null,
        ),
        child: Center(child: child),
      ),
    );

    if (tooltip != null) {
      return Tooltip(message: tooltip, child: chip);
    }
    return chip;
  }
}

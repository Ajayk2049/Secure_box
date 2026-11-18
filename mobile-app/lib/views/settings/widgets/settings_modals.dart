import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../widgets/glass_theme.dart';

class SettingsModals {
  static void showAboutModal(BuildContext context) {
    showParcelGlassDialog(
      context: context,
      width: 330,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header with logo/icon, title, powered by, and circle close button
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.asset(
                  'assets/icon/icon_512.png',
                  width: 38,
                  height: 38,
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Secure box',
                      style: TextStyle(
                        color: ParcelGlassColors.navyTitle,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.3,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Powered by Aibotink Pvt Ltd',
                      style: TextStyle(
                        color: ParcelGlassColors.slateSubtitle,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const ParcelCircleCloseButton(),
            ],
          ),
          const SizedBox(height: 18),

          // Contact & Web Links
          _actionTile(
            icon: Icons.language_rounded,
            iconColor: ParcelGlassColors.accentBlue,
            label: 'Website',
            value: 'aibotink.com',
            onTap: () => _launchUri('https://aibotink.com'),
          ),
          const SizedBox(height: 10),

          _actionTile(
            icon: Icons.mail_outline_rounded,
            iconColor: ParcelGlassColors.mintSignal,
            label: 'Email',
            value: 'mail@aibotink.com',
            onTap: () => _launchUri('mailto:mail@aibotink.com'),
          ),
          const SizedBox(height: 10),

          _actionTile(
            icon: Icons.phone_outlined,
            iconColor: ParcelGlassColors.amberSignal,
            label: 'Phone',
            value: '+91 8088499962',
            onTap: () => _launchUri('tel:+918088499962'),
          ),
        ],
      ),
    );
  }

  static Future<void> _launchUri(String uriString) async {
    try {
      final uri = Uri.parse(uriString);
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        await launchUrl(uri);
      }
    } catch (_) {
      // Gracefully handle if app not installed or invalid scheme
    }
  }

  static Widget _actionTile({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.65),
          width: 1.1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF3D2310).withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, size: 16, color: iconColor),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        label,
                        style: const TextStyle(
                          color: ParcelGlassColors.slateSubtitle,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.2,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        value,
                        style: const TextStyle(
                          color: ParcelGlassColors.navyTitle,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 13,
                  color: ParcelGlassColors.slateSubtitle,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../../config.dart';
import '../../services/api_service.dart';
import 'glass_theme.dart';

class NetworkHostDialog extends StatefulWidget {
  const NetworkHostDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showParcelGlassDialog(
      context: context,
      width: 340,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: const NetworkHostDialog(),
    );
  }

  @override
  State<NetworkHostDialog> createState() => _NetworkHostDialogState();
}

class _NetworkHostDialogState extends State<NetworkHostDialog> {
  late TextEditingController _hostController;
  bool _testing = false;
  bool? _isHealthy;
  String _statusMessage = '';

  @override
  void initState() {
    super.initState();
    _hostController = TextEditingController(text: AppConfig.currentHost);
    _testConnection();
  }

  @override
  void dispose() {
    _hostController.dispose();
    super.dispose();
  }

  Future<void> _testConnection([String? hostToTest]) async {
    final host = (hostToTest ?? _hostController.text).trim();
    if (host.isEmpty) return;

    setState(() {
      _testing = true;
      _isHealthy = null;
      _statusMessage = 'Pinging http://$host/api/health...';
    });

    final ok = await ApiService().checkHealth(host);

    if (mounted) {
      setState(() {
        _testing = false;
        _isHealthy = ok;
        _statusMessage = ok
            ? 'Connected! Local backend is healthy and responding.'
            : 'Could not connect. Ensure backend is running and phone is on the same Wi-Fi.';
      });
    }
  }

  Future<void> _saveAndApply() async {
    final newHost = _hostController.text.trim();
    if (newHost.isNotEmpty) {
      final success = await AppConfig.updateHost(newHost);
      if (!success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Host rejected: Only local LAN/loopback addresses (192.168.x, 10.x, localhost) are permitted in dev mode.'),
            backgroundColor: ParcelGlassColors.alertRose,
          ),
        );
        return;
      }
    }
    if (mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Server set to: ${AppConfig.baseUrl}'),
          backgroundColor: ParcelGlassColors.accentBlue,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
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
                    Icons.wifi,
                    color: ParcelGlassColors.accentBlue,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 10),
                const Text(
                  'SERVER HOST',
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

        // Host Input Field
        TextFormField(
          controller: _hostController,
          style: const TextStyle(
            color: ParcelGlassColors.navyTitle,
            fontFamily: 'monospace',
            fontWeight: FontWeight.bold,
            fontSize: 13.5,
          ),
          decoration: InputDecoration(
            labelText: 'BACKEND HOST & PORT',
            hintText: '72.61.141.178:7000',
            labelStyle: const TextStyle(color: ParcelGlassColors.slateSubtitle, fontSize: 11.5, fontWeight: FontWeight.bold),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.25),
            prefixIcon: const Icon(Icons.dns, color: ParcelGlassColors.accentBlue, size: 18),
            suffixIcon: IconButton(
              icon: _testing
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: ParcelGlassColors.accentBlue,
                      ),
                    )
                  : const Icon(Icons.refresh, color: ParcelGlassColors.accentBlue, size: 20),
              onPressed: _testing ? null : () => _testConnection(),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
        ),


        const SizedBox(height: 10),

        // Quick Presets
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            _presetChip('72.61.141.178:7000', 'VPS Cloud'),
            _presetChip('192.168.0.101:4300', 'Local Wi-Fi'),
            _presetChip('localhost:4300', 'Localhost'),
          ],
        ),

        const SizedBox(height: 12),

        // Status Banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: _isHealthy == true
                ? ParcelGlassColors.mintSignal.withValues(alpha: 0.12)
                : _isHealthy == false
                    ? ParcelGlassColors.alertRose.withValues(alpha: 0.12)
                    : ParcelGlassColors.amberSignal.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: _isHealthy == true
                  ? ParcelGlassColors.mintSignal.withValues(alpha: 0.35)
                  : _isHealthy == false
                      ? ParcelGlassColors.alertRose.withValues(alpha: 0.35)
                      : ParcelGlassColors.amberSignal.withValues(alpha: 0.35),
            ),
          ),
          child: Row(
            children: [
              Icon(
                _isHealthy == true
                    ? Icons.check_circle
                    : _isHealthy == false
                        ? Icons.error
                        : Icons.sync,
                size: 16,
                color: _isHealthy == true
                    ? ParcelGlassColors.mintSignal
                    : _isHealthy == false
                        ? ParcelGlassColors.alertRose
                        : ParcelGlassColors.amberSignal,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _statusMessage,
                  style: TextStyle(
                    color: _isHealthy == true
                        ? ParcelGlassColors.mintSignal
                        : _isHealthy == false
                            ? ParcelGlassColors.alertRose
                            : ParcelGlassColors.slateSubtitle,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 18),

        // Action Buttons
        Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 44,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: ParcelGlassColors.slateSubtitle,
                    side: BorderSide(color: Colors.white.withValues(alpha: 0.80), width: 1.2),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.bold)),
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
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    elevation: 0,
                  ),
                  onPressed: _saveAndApply,
                  child: const Text(
                    'Apply Server',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _presetChip(String host, String label) {
    final isSelected = _hostController.text.trim() == host;
    return GestureDetector(
      onTap: () {
        _hostController.text = host;
        _testConnection(host);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected
              ? ParcelGlassColors.accentBlue.withValues(alpha: 0.15)
              : Colors.white.withValues(alpha: 0.40),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected
                ? ParcelGlassColors.accentBlue
                : Colors.white.withValues(alpha: 0.70),
            width: 1.2,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? ParcelGlassColors.accentBlue : ParcelGlassColors.slateSubtitle,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

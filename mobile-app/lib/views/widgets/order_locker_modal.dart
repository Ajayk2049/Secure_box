import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../services/location_service.dart';
import '../../view_models/auth_view_model.dart';
import 'glass_theme.dart';

class OrderLockerModal extends StatefulWidget {
  const OrderLockerModal({super.key});

  static Future<void> show(BuildContext context) {
    return showParcelGlassDialog(
      context: context,
      width: 360,
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 22),
      child: const OrderLockerModal(),
    );
  }

  @override
  State<OrderLockerModal> createState() => _OrderLockerModalState();
}

class _OrderLockerModalState extends State<OrderLockerModal> {
  final _houseNoController = TextEditingController();
  final _addressController = TextEditingController();
  final _landmarkController = TextEditingController();
  final _pincodeController = TextEditingController();
  int _units = 1;
  bool _isSubmitting = false;
  bool _isLocating = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _addressController.addListener(_onAddressChanged);
    final user = context.read<AuthViewModel>().user;
    if (user?.address != null && user!.address!.isNotEmpty) {
      _addressController.text = user.address!;
    }
    if (user?.pincode != null && user!.pincode!.isNotEmpty) {
      _pincodeController.text = user.pincode!;
    }
  }

  void _onAddressChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _addressController.removeListener(_onAddressChanged);
    _houseNoController.dispose();
    _addressController.dispose();
    _landmarkController.dispose();
    _pincodeController.dispose();
    super.dispose();
  }

  bool get _isNonBangalorePin {
    final pin = _pincodeController.text.trim();
    return pin.length == 6 && !pin.startsWith('560');
  }

  Future<void> _handleAutoLocate() async {
    setState(() {
      _isLocating = true;
      _errorMessage = null;
    });

    final result = await LocationService.getCurrentAddress();
    if (!mounted) return;

    setState(() => _isLocating = false);

    if (result.hasError) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.error!),
          backgroundColor: ParcelGlassColors.alertRed,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }

    if (result.address.isNotEmpty) {
      _addressController.text = result.address;
    }
    if (result.pincode != null && result.pincode!.isNotEmpty) {
      _pincodeController.text = result.pincode!;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Row(
          children: [
            Icon(Icons.gps_fixed, color: Colors.white, size: 18),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Street & Area detected from GPS! Please enter your house/flat number.',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        backgroundColor: ParcelGlassColors.mintSignal,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _handleSubmit() async {
    final houseNo = _houseNoController.text.trim();
    final address = _addressController.text.trim();
    final landmark = _landmarkController.text.trim();
    final pincode = _pincodeController.text.trim();

    if (houseNo.isEmpty) {
      setState(() => _errorMessage = 'Please enter your house or flat number');
      return;
    }

    if (address.isEmpty) {
      setState(() => _errorMessage = 'Please enter your street or area address');
      return;
    }

    if (pincode.isEmpty) {
      setState(() => _errorMessage = 'Please enter your 6-digit PIN code');
      return;
    }

    if (pincode.length != 6) {
      setState(() => _errorMessage = 'Please enter a valid 6-digit PIN code');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    // Build the complete doorstep delivery address
    final fullAddress = [
      houseNo,
      address,
      if (landmark.isNotEmpty) 'Landmark: $landmark',
    ].join(', ');

    final auth = context.read<AuthViewModel>();
    final success = await auth.placeLockerOrder(
      address: fullAddress,
      pincode: pincode.isNotEmpty ? pincode : null,
      units: _units,
    );

    if (!mounted) return;

    if (success) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: const [
              Icon(Icons.check_circle_outline, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Locker order placed! In queue for hub preparation.',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          backgroundColor: ParcelGlassColors.mintSignal,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    } else {
      setState(() {
        _isSubmitting = false;
        _errorMessage = auth.error ?? 'Failed to submit order request';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthViewModel>().user;
    final primaryTextColor = ParcelGlassColors.textPrimary(context);
    final secondaryTextColor = ParcelGlassColors.textSecondary(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Header
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: ParcelGlassColors.parcelBrown.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.local_shipping_rounded,
                color: ParcelGlassColors.parcelBrown,
                size: 20,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'ORDER SECURE BOX',
                style: TextStyle(
                  color: primaryTextColor,
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: Icon(Icons.close, color: secondaryTextColor, size: 20),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ),

        const SizedBox(height: 12),

        // Subtitle / Recipient Badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.60)),
          ),
          child: Row(
            children: [
              const Icon(Icons.person_outline, size: 16, color: ParcelGlassColors.parcelBrown),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '${user?.name ?? "Customer"} • ${user?.phone ?? ""}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: ParcelGlassColors.navyTitle,
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // 1. House / Flat No (Mandatory)
        const Text(
          'HOUSE / FLAT NO',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.4,
            color: ParcelGlassColors.slateSubtitle,
          ),
        ),
        const SizedBox(height: 5),
        TextField(
          controller: _houseNoController,
          maxLines: 1,
          style: const TextStyle(fontSize: 13, color: ParcelGlassColors.navyTitle, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: 'Flat / Villa / House No, Apartment Name',
            hintStyle: TextStyle(fontSize: 12, color: Colors.black.withValues(alpha: 0.35)),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.45),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.65), width: 1.2),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: ParcelGlassColors.parcelBrown, width: 1.4),
            ),
          ),
        ),

        const SizedBox(height: 10),

        // 2. Street & Area Address (Mandatory, with embedded GPS)
        const Text(
          'STREET & AREA ADDRESS',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.4,
            color: ParcelGlassColors.slateSubtitle,
          ),
        ),
        const SizedBox(height: 5),
        Stack(
          alignment: Alignment.topRight,
          children: [
            TextField(
              controller: _addressController,
              maxLines: 2,
              style: const TextStyle(fontSize: 13, color: ParcelGlassColors.navyTitle, fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: 'Street name, main, cross, locality / area',
                hintStyle: TextStyle(fontSize: 12, color: Colors.black.withValues(alpha: 0.35)),
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.45),
                contentPadding: EdgeInsets.only(
                  left: 12,
                  top: 10,
                  bottom: 10,
                  right: (_addressController.text.isEmpty || _isLocating) ? 38 : 12,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.65), width: 1.2),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: ParcelGlassColors.parcelBrown, width: 1.4),
                ),
              ),
            ),
            if (_addressController.text.isEmpty || _isLocating)
              Positioned(
                top: 4,
                right: 4,
                child: Material(
                  color: Colors.transparent,
                  child: IconButton(
                    tooltip: 'Use current location',
                    onPressed: (_isLocating || _isSubmitting) ? null : _handleAutoLocate,
                    splashRadius: 18,
                    padding: const EdgeInsets.all(6),
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                    icon: _isLocating
                        ? const SizedBox(
                            width: 15,
                            height: 15,
                            child: CircularProgressIndicator(
                              strokeWidth: 1.8,
                              color: ParcelGlassColors.parcelBrown,
                            ),
                          )
                        : const Icon(
                            Icons.my_location,
                            size: 18,
                            color: ParcelGlassColors.parcelBrown,
                          ),
                  ),
                ),
              ),
          ],
        ),

        const SizedBox(height: 10),

        // 3. Landmark (Optional)
        const Text(
          'LANDMARK (OPTIONAL)',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.4,
            color: ParcelGlassColors.slateSubtitle,
          ),
        ),
        const SizedBox(height: 5),
        TextField(
          controller: _landmarkController,
          maxLines: 1,
          style: const TextStyle(fontSize: 13, color: ParcelGlassColors.navyTitle, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: 'e.g. Near Metro Station, Behind Park',
            hintStyle: TextStyle(fontSize: 12, color: Colors.black.withValues(alpha: 0.35)),
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.45),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.65), width: 1.2),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: ParcelGlassColors.parcelBrown, width: 1.4),
            ),
          ),
        ),

        const SizedBox(height: 12),

        // Pincode Field & Unit Selector Row
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Pincode Input
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'PIN CODE',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                      color: ParcelGlassColors.slateSubtitle,
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _pincodeController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    onChanged: (_) => setState(() {}),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                      color: ParcelGlassColors.navyTitle,
                    ),
                    decoration: InputDecoration(
                      hintText: '560001',
                      counterText: '',
                      hintStyle: TextStyle(fontSize: 13, color: Colors.black.withValues(alpha: 0.35)),
                      filled: true,
                      fillColor: Colors.white.withValues(alpha: 0.45),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.65), width: 1.2),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: ParcelGlassColors.parcelBrown, width: 1.4),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(width: 12),

            // Units Counter
            Expanded(
              flex: 2,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'UNITS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                      color: ParcelGlassColors.slateSubtitle,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    height: 44,
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.65), width: 1.2),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        InkWell(
                          onTap: _units > 1 ? () => setState(() => _units--) : null,
                          borderRadius: BorderRadius.circular(8),
                          child: Padding(
                            padding: const EdgeInsets.all(4),
                            child: Icon(Icons.remove, size: 16, color: _units > 1 ? ParcelGlassColors.navyTitle : Colors.grey),
                          ),
                        ),
                        Text(
                          '$_units',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: ParcelGlassColors.navyTitle),
                        ),
                        InkWell(
                          onTap: _units < 10 ? () => setState(() => _units++) : null,
                          borderRadius: BorderRadius.circular(8),
                          child: Padding(
                            padding: const EdgeInsets.all(4),
                            child: Icon(Icons.add, size: 16, color: _units < 10 ? ParcelGlassColors.navyTitle : Colors.grey),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),

        // Bangalore Non-Delivery Warning (Permits submission)
        if (_isNonBangalorePin) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: ParcelGlassColors.amberSignal.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: ParcelGlassColors.amberSignal.withValues(alpha: 0.40)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Icon(Icons.info_outline, size: 16, color: ParcelGlassColors.amberSignal),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'We are currently delivering in Bangalore only. You can still submit your request and our team will notify you as soon as service expands to your area.',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF8C4A00),
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],

        if (_errorMessage != null) ...[
          const SizedBox(height: 10),
          Text(
            _errorMessage!,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: ParcelGlassColors.alertRed,
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],

        const SizedBox(height: 18),

        // Submit Action Button (Zero Payment Required)
        SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: _isSubmitting ? null : _handleSubmit,
            style: ElevatedButton.styleFrom(
              backgroundColor: ParcelGlassColors.parcelBrown,
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text(
                    'SUBMIT LOCKER REQUEST',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.8,
                    ),
                  ),
          ),
        ),
      ],
    );
  }
}

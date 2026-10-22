import 'package:dio/dio.dart';
import 'package:geolocator/geolocator.dart';

class LocationResult {
  final String address;
  final String? pincode;
  final String? error;

  const LocationResult({required this.address, this.pincode, this.error});

  bool get hasError => error != null;
}

class LocationService {
  static final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
      headers: {'User-Agent': 'SecureBoxApp/1.0 (contact@securebox.in)'},
    ),
  );

  static Future<LocationResult> getCurrentAddress() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return const LocationResult(
          address: '',
          error: 'Location services are turned off. Please enable GPS.',
        );
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return const LocationResult(
            address: '',
            error: 'Location permission was denied.',
          );
        }
      }

      if (permission == LocationPermission.deniedForever) {
        return const LocationResult(
          address: '',
          error: 'Location permission is permanently denied. You can enter address manually or enable it in App Info settings.',
        );
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      final response = await _dio.get(
        'https://nominatim.openstreetmap.org/reverse',
        queryParameters: {
          'lat': position.latitude,
          'lon': position.longitude,
          'format': 'jsonv2',
          'addressdetails': 1,
        },
      );

      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map<String, dynamic>;
        final addr = data['address'] as Map<String, dynamic>?;

        String formattedAddress = '';
        String? pincode;

        if (addr != null) {
          final parts = <String>[];
          final building = addr['building'] ?? addr['house_number'] ?? addr['flat'];
          final road = addr['road'] ?? addr['street'] ?? addr['pedestrian'];
          final sub = addr['suburb'] ?? addr['neighbourhood'] ?? addr['residential'] ?? addr['subdistrict'];
          final city = addr['city'] ?? addr['town'] ?? addr['municipality'] ?? addr['county'];

          if (building != null && building.toString().trim().isNotEmpty) {
            parts.add(building.toString().trim());
          }
          if (road != null && road.toString().trim().isNotEmpty) {
            parts.add(road.toString().trim());
          }
          if (sub != null && sub.toString().trim().isNotEmpty) {
            parts.add(sub.toString().trim());
          }
          if (city != null && city.toString().trim().isNotEmpty) {
            parts.add(city.toString().trim());
          }

          formattedAddress = parts.isNotEmpty ? parts.join(', ') : (data['display_name']?.toString() ?? '');

          final rawPostcode = addr['postcode']?.toString();
          if (rawPostcode != null) {
            final digits = rawPostcode.replaceAll(RegExp(r'[^0-9]'), '');
            if (digits.length >= 6) {
              pincode = digits.substring(0, 6);
            } else if (digits.isNotEmpty) {
              pincode = digits;
            }
          }
        } else {
          formattedAddress = data['display_name']?.toString() ?? '';
        }

        return LocationResult(address: formattedAddress, pincode: pincode);
      }

      return const LocationResult(address: '', error: 'Could not resolve address from GPS coordinates.');
    } catch (e) {
      return LocationResult(address: '', error: 'Location error: ${e.toString().split('\n').first}');
    }
  }
}

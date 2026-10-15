import 'package:flutter/foundation.dart';
import '../models/device.model.dart';
import '../services/api_service.dart';

class ManageUsersViewModel extends ChangeNotifier {
  final ApiService _api = ApiService();

  DeviceModel? _selectedDevice;
  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _slotsData;

  DeviceModel? get selectedDevice => _selectedDevice;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  Map<String, dynamic>? get slotsData => _slotsData;

  bool get isOwner => _slotsData?['isOwner'] ?? false;
  int get allowedSlots => _slotsData?['allowedSlots'] ?? 2;
  int get usedSlots => _slotsData?['usedSlots'] ?? 1;
  dynamic get primaryOwner => _slotsData?['primaryOwner'];
  List get coOwners => _slotsData?['coOwners'] ?? [];
  Map get coOwnerNicknames => _slotsData?['coOwnerNicknames'] ?? {};

  void init(DeviceModel? device) {
    _selectedDevice = device;
    if (_selectedDevice != null) {
      fetchSlots();
    } else {
      _isLoading = false;
      notifyListeners();
    }
  }

  void selectDevice(DeviceModel newDevice) {
    if (_selectedDevice?.id == newDevice.id) return;
    _selectedDevice = newDevice;
    fetchSlots();
  }

  Future<void> fetchSlots() async {
    if (_selectedDevice == null) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await _api.getDeviceSlots(_selectedDevice!.id);
      _slotsData = res;
      _isLoading = false;
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString().replaceAll('Exception: ', '').trim();
    }
    notifyListeners();
  }

  Future<bool> renameCoOwner(String userId, String newName) async {
    if (_selectedDevice == null) return false;
    try {
      await _api.renameCoOwner(_selectedDevice!.id, userId, newName);
      await fetchSlots();
      return true;
    } catch (_) {
      rethrow;
    }
  }

  Future<bool> revokeCoOwner(String userId) async {
    if (_selectedDevice == null) return false;
    try {
      await _api.removeCoOwner(_selectedDevice!.id, userId);
      await fetchSlots();
      return true;
    } catch (_) {
      rethrow;
    }
  }
}

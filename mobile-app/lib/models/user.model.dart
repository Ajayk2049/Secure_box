class NotificationPreferences {
  final bool doorStatus;
  final bool lockerConnectivity;

  const NotificationPreferences({
    this.doorStatus = false,
    this.lockerConnectivity = false,
  });

  factory NotificationPreferences.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const NotificationPreferences(doorStatus: false, lockerConnectivity: false);
    }
    return NotificationPreferences(
      doorStatus: json['doorStatus'] == true,
      lockerConnectivity: json['lockerConnectivity'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'doorStatus': doorStatus,
      'lockerConnectivity': lockerConnectivity,
    };
  }

  NotificationPreferences copyWith({
    bool? doorStatus,
    bool? lockerConnectivity,
  }) {
    return NotificationPreferences(
      doorStatus: doorStatus ?? this.doorStatus,
      lockerConnectivity: lockerConnectivity ?? this.lockerConnectivity,
    );
  }
}

class UserModel {
  final String id;
  final String email;
  final String role;
  final String? name;
  final String? phone;
  final String? address;
  final String? pincode;
  final int? units;
  final String? orderStatus;
  final NotificationPreferences notificationPreferences;

  UserModel({
    required this.id,
    required this.email,
    required this.role,
    this.name,
    this.phone,
    this.address,
    this.pincode,
    this.units,
    this.orderStatus,
    this.notificationPreferences = const NotificationPreferences(),
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? json['_id'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'user',
      name: json['name'],
      phone: json['phone'],
      address: json['address'],
      pincode: json['pincode'],
      units: json['units'] is int ? json['units'] : (int.tryParse(json['units']?.toString() ?? '')),
      orderStatus: json['orderStatus'],
      notificationPreferences: NotificationPreferences.fromJson(
        json['notificationPreferences'] is Map<String, dynamic>
            ? json['notificationPreferences'] as Map<String, dynamic>
            : null,
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'role': role,
      'name': name,
      'phone': phone,
      'address': address,
      'pincode': pincode,
      'units': units,
      'orderStatus': orderStatus,
      'notificationPreferences': notificationPreferences.toJson(),
    };
  }

  UserModel copyWith({
    String? name,
    String? email,
    String? phone,
    String? address,
    String? pincode,
    int? units,
    String? orderStatus,
    NotificationPreferences? notificationPreferences,
  }) {
    return UserModel(
      id: id,
      email: email ?? this.email,
      role: role,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      address: address ?? this.address,
      pincode: pincode ?? this.pincode,
      units: units ?? this.units,
      orderStatus: orderStatus ?? this.orderStatus,
      notificationPreferences: notificationPreferences ?? this.notificationPreferences,
    );
  }
}


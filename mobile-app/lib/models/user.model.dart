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
    );
  }
}

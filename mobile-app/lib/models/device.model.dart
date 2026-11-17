class DeviceModel {
  final String id;
  final String deviceId;
  final String name;
  final String doorState;
  final bool online;
  final bool isOwner;
  final String userRole;
  final int? statusVersion;
  final DateTime? lastSeen;

  DeviceModel({
    required this.id,
    required this.deviceId,
    required this.name,
    required this.doorState,
    required this.online,
    this.isOwner = false,
    this.userRole = 'Co-Owner',
    this.statusVersion,
    this.lastSeen,
  });

  factory DeviceModel.fromJson(Map<String, dynamic> json) {
    final bool rawIsOwner = json['isOwner'] == true;
    final String rawUserRole = json['userRole']?.toString() ?? (rawIsOwner ? 'Owner' : 'Co-Owner');
    final rawVersion = json['statusVersion'];
    final int? parsedVersion = rawVersion is int
        ? rawVersion
        : (rawVersion != null ? int.tryParse(rawVersion.toString()) : null);
    final rawLastSeen = json['lastSeen'] ?? json['lastHeartbeat'];
    final DateTime? parsedLastSeen = rawLastSeen != null
        ? DateTime.tryParse(rawLastSeen.toString())
        : null;

    return DeviceModel(
      id: json['_id'] ?? json['id'] ?? '',
      deviceId: json['deviceId'] ?? '',
      name: json['name'] ?? '',
      doorState: json['doorState'] ?? 'closed',
      online: json['online'] ?? false,
      isOwner: rawIsOwner,
      userRole: rawUserRole,
      statusVersion: parsedVersion,
      lastSeen: parsedLastSeen,
    );
  }

  DeviceModel copyWith({
    String? id,
    String? deviceId,
    String? name,
    String? doorState,
    bool? online,
    bool? isOwner,
    String? userRole,
    int? statusVersion,
    DateTime? lastSeen,
  }) {
    return DeviceModel(
      id: id ?? this.id,
      deviceId: deviceId ?? this.deviceId,
      name: name ?? this.name,
      doorState: doorState ?? this.doorState,
      online: online ?? this.online,
      isOwner: isOwner ?? this.isOwner,
      userRole: userRole ?? this.userRole,
      statusVersion: statusVersion ?? this.statusVersion,
      lastSeen: lastSeen ?? this.lastSeen,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'deviceId': deviceId,
      'name': name,
      'doorState': doorState,
      'online': online,
      'isOwner': isOwner,
      'userRole': userRole,
      'statusVersion': statusVersion,
      'lastSeen': lastSeen?.toIso8601String(),
    };
  }
}

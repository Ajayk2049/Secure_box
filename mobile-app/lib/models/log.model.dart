class LogModel {
  final String id;
  final String deviceId;
  final String action;
  final DateTime timestamp;
  final Map<String, dynamic>? metadata;

  LogModel({
    required this.id,
    required this.deviceId,
    required this.action,
    required this.timestamp,
    this.metadata,
  });

  factory LogModel.fromJson(Map<String, dynamic> json) {
    return LogModel(
      id: json['_id'] ?? '',
      deviceId: json['deviceId'] ?? '',
      action: json['action'] ?? '',
      timestamp: DateTime.parse(json['timestamp'] ?? DateTime.now().toIso8601String()).toLocal(),
      metadata: json['metadata'],
    );
  }

  LogModel copyWith({
    String? id,
    String? deviceId,
    String? action,
    DateTime? timestamp,
    Map<String, dynamic>? metadata,
  }) {
    return LogModel(
      id: id ?? this.id,
      deviceId: deviceId ?? this.deviceId,
      action: action ?? this.action,
      timestamp: timestamp ?? this.timestamp,
      metadata: metadata ?? this.metadata,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'deviceId': deviceId,
      'action': action,
      'timestamp': timestamp.toIso8601String(),
      'metadata': metadata,
    };
  }
}

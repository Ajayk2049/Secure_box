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

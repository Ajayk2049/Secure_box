import 'package:dio/dio.dart';
import '../config.dart';

/// Helper utility to extract clean, human-friendly error messages from Dio exceptions and API responses
String extractErrorMessage(dynamic error, [String defaultMessage = 'An unexpected error occurred']) {
  if (error is DioException) {
    if (error.response?.data != null) {
      final data = error.response!.data;
      if (data is Map) {
        if (data['error'] != null && data['error'].toString().isNotEmpty) {
          return data['error'].toString();
        }
        if (data['message'] != null && data['message'].toString().isNotEmpty) {
          return data['message'].toString();
        }
      } else if (data is String && data.isNotEmpty) {
        return data;
      }
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return 'Connection timed out. Check your local Wi-Fi and server IP.';
    }
    if (error.type == DioExceptionType.connectionError) {
      return 'Cannot connect to server at ${AppConfig.baseUrl}. Please verify your Wi-Fi network and IP settings.';
    }
  }
  final str = error.toString().replaceAll('Exception: ', '').trim();
  return str.isNotEmpty ? str : defaultMessage;
}

import 'dart:convert';
import 'package:http/http.dart' as http;

class Api {
  // Android emulator: 10.0.2.2 points to the development computer.
  // For a physical phone, use your computer's LAN IP. Use HTTPS in production.
  static const String baseUrl = 'http://10.0.2.2:4000';
  static Future<List<dynamic>> getList(String path, {required String token}) async {
    final response = await http.get(Uri.parse('$baseUrl$path'), headers: {'Authorization': 'Bearer $token'});
    final data = jsonDecode(response.body);
    if (response.statusCode >= 400) throw Exception(data is Map ? (data['error'] ?? 'Request failed') : 'Request failed');
    if (data is! List) throw Exception('Unexpected response format');
    return data;
  }

  static Future<Map<String, dynamic>> request(String path, {String method = 'GET', String? token, Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (token != null) headers['Authorization'] = 'Bearer $token';
    late http.Response response;
    if (method == 'POST') {
      response = await http.post(uri, headers: headers, body: jsonEncode(body ?? {}));
    } else {
      response = await http.get(uri, headers: headers);
    }
    final data = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) throw Exception(data['error'] ?? 'Request failed (${response.statusCode})');
    return data;
  }
}

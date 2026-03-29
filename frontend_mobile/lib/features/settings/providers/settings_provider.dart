import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../features/dashboard/providers/dashboard_provider.dart';

final settingsProvider = FutureProvider<Map<String, String>>((ref) async {
  final supabase = ref.watch(supabaseProvider);
  final userEmail = supabase.auth.currentUser?.email;

  if (userEmail == null) throw Exception('User not authenticated');

  final response = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_email', userEmail);

  final Map<String, String> settings = {};
  for (var row in (response as List)) {
    settings[row['key']] = row['value'].toString();
  }
  return settings;
});

final settingsActionsProvider = Provider((ref) {
  final supabase = ref.watch(supabaseProvider);
  return SettingsActions(supabase, ref);
});

class SettingsActions {
  final SupabaseClient _supabase;
  final Ref _ref;

  SettingsActions(this._supabase, this._ref);

  Future<void> updateSettings(Map<String, String> updates) async {
    final userEmail = _supabase.auth.currentUser?.email;
    if (userEmail == null) throw Exception('User not authenticated');

    final List<Map<String, dynamic>> upserts = updates.entries.map((e) => {
      'user_email': userEmail,
      'key': e.key,
      'value': e.value,
      'updated_at': DateTime.now().toIso8601String(),
    }).toList();

    await _supabase.from('settings').upsert(upserts, onConflict: 'user_email, key');
    
    _ref.invalidate(settingsProvider);
  }
}

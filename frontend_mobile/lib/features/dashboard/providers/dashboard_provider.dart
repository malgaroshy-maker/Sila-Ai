import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../domain/models/models.dart';

final supabaseProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});

final applicationsProvider = FutureProvider<List<Application>>((ref) async {
  final supabase = ref.watch(supabaseProvider);
  final userEmail = supabase.auth.currentUser?.email;

  if (userEmail == null) throw Exception('User not authenticated');

  final response = await supabase
      .from('applications')
      .select('*, jobs!inner(*), candidates(*), analysis_results(*)')
      .eq('jobs.user_email', userEmail)
      .order('created_at', ascending: false);

  return (response as List).map((json) => Application.fromJson(json)).toList();
});

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

final jobsProvider = FutureProvider<List<Job>>((ref) async {
  final supabase = ref.watch(supabaseProvider);
  final userEmail = supabase.auth.currentUser?.email;

  if (userEmail == null) throw Exception('User not authenticated');

  final response = await supabase
      .from('jobs')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', ascending: false);

  return (response as List).map((json) => Job.fromJson(json)).toList();
});

class SearchNotifier extends Notifier<String> {
  @override
  String build() => '';
  void set(String value) => state = value;
}

final searchProvider = NotifierProvider<SearchNotifier, String>(SearchNotifier.new);

class SelectedJobNotifier extends Notifier<String?> {
  @override
  String? build() => null;
  void set(String? value) => state = value;
}

final selectedJobIdProvider = NotifierProvider<SelectedJobNotifier, String?>(SelectedJobNotifier.new);

final filteredApplicationsProvider = Provider<AsyncValue<List<Application>>>((ref) {
  final applicationsAsync = ref.watch(applicationsProvider);
  final search = ref.watch(searchProvider).toLowerCase();
  final selectedJobId = ref.watch(selectedJobIdProvider);

  return applicationsAsync.whenData((applications) {
    return applications.where((app) {
      final matchesSearch = search.isEmpty ||
          app.candidate.name.toLowerCase().contains(search) ||
          app.candidate.email.toLowerCase().contains(search);
      
      final matchesJob = selectedJobId == null || app.jobId == selectedJobId;
      
      return matchesSearch && matchesJob;
    }).toList();
  });
});

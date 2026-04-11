import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../domain/models/models.dart';

final supabaseProvider = Provider<SupabaseClient>((ref) {
  return Supabase.instance.client;
});

class ApplicationsNotifier extends Notifier<AsyncValue<List<Application>>> {
  @override
  AsyncValue<List<Application>> build() {
    // Initial fetch
    _fetch();
    
    // Subscribe to changes
    _subscribe();
    
    return const AsyncValue.loading();
  }

  Future<void> _fetch() async {
    final supabase = ref.read(supabaseProvider);
    final userEmail = supabase.auth.currentUser?.email;
    if (userEmail == null) {
      state = AsyncValue.error('Not authenticated', StackTrace.current);
      return;
    }

    try {
      final data = await _fetchFullApplications(supabase, userEmail);
      state = AsyncValue.data(data);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  void _subscribe() {
    final supabase = ref.read(supabaseProvider);
    final userEmail = supabase.auth.currentUser?.email;
    if (userEmail == null) return;

    final channel = supabase.channel('public:applications_changes');
    
    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'applications',
      callback: (payload) {
        _fetch();
      },
    ).onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'analysis_results',
      callback: (payload) {
        _fetch();
      },
    ).subscribe();

    ref.onDispose(() {
      supabase.removeChannel(channel);
    });
  }

  Future<void> refresh() => _fetch();
}

final applicationsProvider = NotifierProvider<ApplicationsNotifier, AsyncValue<List<Application>>>(
  ApplicationsNotifier.new,
);

// Helper for full fetch
Future<List<Application>> _fetchFullApplications(SupabaseClient supabase, String userEmail) async {
  final response = await supabase
      .from('applications')
      .select('*, jobs!inner(*), candidates(*), analysis_results(*)')
      .eq('jobs.user_email', userEmail)
      .order('created_at', ascending: false);

  return (response as List).map((json) => Application.fromJson(json)).toList();
}

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

final dashboardActionsProvider = Provider((ref) {
  final supabase = ref.watch(supabaseProvider);
  
  return DashboardActions(supabase, ref);
});

class DashboardActions {
  final SupabaseClient _supabase;
  final Ref _ref;

  DashboardActions(this._supabase, this._ref);

  Future<void> updateStage(String applicationId, String stage) async {
    final userEmail = _supabase.auth.currentUser?.email;
    if (userEmail == null) throw Exception('User not authenticated');

    final response = await _supabase
        .from('applications')
        .update({'pipeline_stage': stage})
        .eq('id', applicationId)
        .select()
        .maybeSingle();

    if (response == null) throw Exception('Failed to update stage');
    
    // Refresh the list
    _ref.invalidate(applicationsProvider);
  }

  Future<void> deleteCandidate(String candidateId) async {
    final userEmail = _supabase.auth.currentUser?.email;
    if (userEmail == null) throw Exception('User not authenticated');

    // 1. Fetch candidate to get CV path (mimic backend logic for safety)
    final candidateRes = await _supabase
        .from('candidates')
        .select('id, cv_url')
        .eq('id', candidateId)
        .eq('user_email', userEmail)
        .maybeSingle();

    if (candidateRes == null) throw Exception('Candidate not found');

    final String? cvUrl = candidateRes['cv_url'];

    // 2. Delete CV from storage if exists
    if (cvUrl != null && cvUrl.contains('/cv-backups/')) {
      try {
        final path = cvUrl.split('/cv-backups/').last;
        await _supabase.storage.from('cv-backups').remove([Uri.decodeComponent(path)]);
      } catch (e) {
        // Silently fail storage delete or handle separately
      }
    }

    // 3. Delete embeddings
    await _supabase
        .from('candidate_embeddings')
        .delete()
        .eq('candidate_id', candidateId);

    // 4. Delete candidate (will cascade to applications)
    await _supabase
        .from('candidates')
        .delete()
        .eq('id', candidateId)
        .eq('user_email', userEmail);

    _ref.invalidate(applicationsProvider);
  }
}

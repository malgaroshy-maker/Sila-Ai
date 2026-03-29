import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/dashboard/presentation/candidate_profile_screen.dart';
import '../../features/dashboard/domain/models/models.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/candidate',
        builder: (context, state) {
          final application = state.extra as Application;
          return CandidateProfileScreen(application: application);
        },
      ),
    ],
    redirect: (context, state) {
      final session = Supabase.instance.client.auth.currentSession;
      final goingToLogin = state.matchedLocation == '/login';

      if (session == null && !goingToLogin) {
        return '/login';
      }

      if (session != null && goingToLogin) {
        return '/dashboard';
      }

      return null;
    },
  );
});

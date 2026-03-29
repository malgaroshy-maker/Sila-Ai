import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/dashboard_provider.dart';
import 'widgets/candidate_card.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  int _currentIndex = 0;

  Future<void> _signOut() async {
    await Supabase.instance.client.auth.signOut();
    if (mounted) context.go('/login');
  }

  Widget _buildCandidatesList() {
    final applicationsAsync = ref.watch(applicationsProvider);

    return applicationsAsync.when(
      data: (applications) {
        if (applications.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.inbox, size: 64, color: Color(0xFF334155)),
                SizedBox(height: 16),
                Text(
                  'No candidates found',
                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 16),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          color: const Color(0xFF0EA5E9),
          backgroundColor: const Color(0xFF1E293B),
          onRefresh: () => ref.refresh(applicationsProvider.future),
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 16),
            itemCount: applications.length,
            itemBuilder: (context, index) {
              final app = applications[index];
              return CandidateCard(
                application: app,
                onTap: () {
                  // Navigate to candidate detail profile
                  // context.push('/candidate/${app.id}');
                },
              );
            },
          ),
        );
      },
      loading: () => const Center(
        child: CircularProgressIndicator(color: Color(0xFF0EA5E9)),
      ),
      error: (err, stack) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Color(0xFFEF4444)),
            const SizedBox(height: 16),
            Text(
              'Error loading candidates',
              style: const TextStyle(color: Color(0xFFEF4444)),
            ),
            TextButton(
              onPressed: () => ref.refresh(applicationsProvider.future),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChatTab() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.auto_awesome, size: 64, color: Color(0xFF0EA5E9)),
          SizedBox(height: 16),
          Text(
            'SILA AI Chat Assistant',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Coming soon in the next step...',
            style: TextStyle(color: Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'SILA Mobile',
          style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, size: 20),
            onPressed: _signOut,
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [_buildCandidatesList(), _buildChatTab()],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Color(0xFF1E293B), width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (i) => setState(() => _currentIndex = i),
          backgroundColor: const Color(0xFF0F172A),
          selectedItemColor: const Color(0xFF0EA5E9),
          unselectedItemColor: const Color(0xFF64748B),
          elevation: 0,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.style_outlined),
              activeIcon: Icon(Icons.style),
              label: 'Candidates',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.chat_bubble_outline),
              activeIcon: Icon(Icons.chat_bubble),
              label: 'SILA Chat',
            ),
          ],
        ),
      ),
    );
  }
}

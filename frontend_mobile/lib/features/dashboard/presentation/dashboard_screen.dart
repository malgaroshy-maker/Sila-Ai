import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../providers/dashboard_provider.dart';
import 'widgets/candidate_card.dart';
import '../../chat/presentation/chat_tab.dart';

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
    final filteredAsync = ref.watch(filteredApplicationsProvider);
    final jobsAsync = ref.watch(jobsProvider);
    final selectedJobId = ref.watch(selectedJobIdProvider);

    return Column(
      children: [
        // Search Bar
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: TextField(
            onChanged: (val) => ref.read(searchProvider.notifier).set(val),
            style: const TextStyle(color: Colors.white, fontSize: 14),
            decoration: InputDecoration(
              hintText: 'Search by name or email...',
              prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B)),
              filled: true,
              fillColor: const Color(0xFF1E293B).withValues(alpha: 0.4),
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF334155)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF334155)),
              ),
            ),
          ),
        ),

        // Job Filter Chips
        jobsAsync.when(
          data: (jobs) => SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: const Text('All Jobs', style: TextStyle(fontSize: 12)),
                    selected: selectedJobId == null,
                    onSelected: (selected) => ref.read(selectedJobIdProvider.notifier).set(null),
                    backgroundColor: const Color(0xFF1E293B),
                    selectedColor: const Color(0xFF0EA5E9).withValues(alpha: 0.2),
                    checkmarkColor: const Color(0xFF0EA5E9),
                    labelStyle: TextStyle(
                      color: selectedJobId == null ? const Color(0xFF0EA5E9) : const Color(0xFF94A3B8),
                      fontWeight: selectedJobId == null ? FontWeight.bold : FontWeight.normal,
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    side: BorderSide(
                      color: selectedJobId == null ? const Color(0xFF0EA5E9) : const Color(0xFF334155),
                    ),
                  ),
                ),
                ...jobs.map((job) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(job.title, style: const TextStyle(fontSize: 12)),
                    selected: selectedJobId == job.id,
                    onSelected: (selected) => ref.read(selectedJobIdProvider.notifier).set(selected ? job.id : null),
                    backgroundColor: const Color(0xFF1E293B),
                    selectedColor: const Color(0xFF0EA5E9).withValues(alpha: 0.2),
                    checkmarkColor: const Color(0xFF0EA5E9),
                    labelStyle: TextStyle(
                      color: selectedJobId == job.id ? const Color(0xFF0EA5E9) : const Color(0xFF94A3B8),
                      fontWeight: selectedJobId == job.id ? FontWeight.bold : FontWeight.normal,
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    side: BorderSide(
                      color: selectedJobId == job.id ? const Color(0xFF0EA5E9) : const Color(0xFF334155),
                    ),
                  ),
                )),
              ],
            ),
          ),
          loading: () => const SizedBox.shrink(),
          error: (err, stack) => const SizedBox.shrink(),
        ),

        const SizedBox(height: 8),

        Expanded(
          child: filteredAsync.when(
            data: (applications) {
              if (applications.isEmpty) {
                return const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.inbox, size: 64, color: Color(0xFF334155)),
                      SizedBox(height: 16),
                      Text(
                        'No matching candidates',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 16),
                      ),
                    ],
                  ),
                );
              }

              return RefreshIndicator(
                color: const Color(0xFF0EA5E9),
                backgroundColor: const Color(0xFF1E293B),
                onRefresh: () async {
                  await ref.read(applicationsProvider.notifier).refresh();
                  await ref.refresh(jobsProvider.future);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.only(bottom: 16),
                  itemCount: applications.length,
                  itemBuilder: (context, index) {
                    final app = applications[index];
                    return CandidateCard(
                      application: app,
                      onTap: () {
                        context.push('/candidate', extra: app);
                      },
                      onStatusChange: (newStage) async {
                        try {
                          await ref.read(dashboardActionsProvider).updateStage(app.id, newStage);
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Updated ${app.candidate.name} to $newStage')),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Failed to update: $e')),
                            );
                          }
                        }
                      },
                      onDelete: () async {
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            backgroundColor: const Color(0xFF0F172A),
                            title: const Text('Confirm Delete', style: TextStyle(color: Colors.white)),
                            content: Text('Are you sure you want to delete ${app.candidate.name}? This action cannot be undone.', style: const TextStyle(color: Color(0xFF94A3B8))),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                              TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.redAccent))),
                            ],
                          ),
                        );

                        if (confirm == true) {
                          try {
                            await ref.read(dashboardActionsProvider).deleteCandidate(app.candidateId);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Deleted ${app.candidate.name}')),
                              );
                            }
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Failed to delete: $e')),
                              );
                            }
                          }
                        }
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
                  const Text(
                    'Error loading candidates',
                    style: TextStyle(color: Color(0xFFEF4444)),
                  ),
            TextButton(
              onPressed: () => ref.read(applicationsProvider.notifier).refresh(),
              child: const Text('Retry', style: TextStyle(color: Color(0xFF94A3B8))),
            ),
                ],
              ),
            ),
          ),
        ),
      ],
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
            icon: const Icon(Icons.settings, size: 20, color: Color(0xFF64748B)),
            onPressed: () => context.push('/settings'),
          ),
          IconButton(
            icon: const Icon(Icons.logout, size: 20),
            onPressed: _signOut,
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [_buildCandidatesList(), const ChatTab()],
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

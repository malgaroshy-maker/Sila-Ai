import 'package:flutter/material.dart';
import 'package:flutter_cached_pdfview/flutter_cached_pdfview.dart';
import '../domain/models/models.dart';

class CandidateProfileScreen extends StatefulWidget {
  final Application application;

  const CandidateProfileScreen({super.key, required this.application});

  @override
  State<CandidateProfileScreen> createState() => _CandidateProfileScreenState();
}

class _CandidateProfileScreenState extends State<CandidateProfileScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _viewCV(BuildContext context) {
    final cvUrl = widget.application.candidate.cvUrl;
    if (cvUrl == null || cvUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('CV URL not available')),
      );
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => Scaffold(
          appBar: AppBar(title: Text('${widget.application.candidate.name} - CV')),
          body: const PDF().fromUrl(
            cvUrl,
            placeholder: (double progress) => Center(child: Text('$progress %')),
            errorWidget: (dynamic error) => Center(child: Text(error.toString())),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final app = widget.application;
    final res = app.analysisResult;
    final score = res?.finalScore ?? 0;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        title: Text(app.candidate.name),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF0EA5E9),
          labelColor: const Color(0xFF0EA5E9),
          unselectedLabelColor: const Color(0xFF94A3B8),
          tabs: const [
            Tab(text: 'Intelligence'),
            Tab(text: 'Overview'),
            Tab(text: 'Prep'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildIntelligenceTab(res, score),
          _buildOverviewTab(res),
          _buildPrepTab(res),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _viewCV(context),
        backgroundColor: const Color(0xFF0EA5E9),
        icon: const Icon(Icons.file_present),
        label: const Text('View CV'),
      ),
    );
  }

  Widget _buildIntelligenceTab(AnalysisResult? res, num score) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildMetricGrid(res),
          const SizedBox(height: 24),
          _buildSectionTitle('Score Summary'),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: score / 100,
            backgroundColor: const Color(0xFF1E293B),
            color: const Color(0xFF0EA5E9),
            minHeight: 12,
            borderRadius: BorderRadius.circular(6),
          ),
          const SizedBox(height: 8),
          Text(
            'Overall Match: $score%',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewTab(AnalysisResult? res) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCard(
            title: 'AI Analysis',
            content: res?.recommendation ?? 'No recommendation provided.',
            icon: Icons.psychology,
          ),
          const SizedBox(height: 20),
          _buildBulletSection('Key Strengths', res?.strengths ?? [], Colors.green),
          const SizedBox(height: 20),
          _buildBulletSection('Areas for Improvement', res?.weaknesses ?? [], Colors.red),
        ],
      ),
    );
  }

  Widget _buildPrepTab(AnalysisResult? res) {
    return const Center(
      child: Text(
        'Interview prep features coming soon',
        style: TextStyle(color: Color(0xFF94A3B8)),
      ),
    );
  }

  Widget _buildMetricGrid(AnalysisResult? res) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      childAspectRatio: 1.5,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      children: [
        _buildMiniMetric('Skills Match', '${res?.skillsScore ?? 0}%', Colors.blue),
        _buildMiniMetric('Cultural Fit', '${res?.culturalFitScore ?? 0}%', Colors.purple),
      ],
    );
  }

  Widget _buildMiniMetric(String label, String value, Color color) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label,
              style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.2,
        color: Color(0xFF94A3B8),
      ),
    );
  }

  Widget _buildCard({required String title, required String content, required IconData icon}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: const Color(0xFF0EA5E9)),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 12),
          Text(content, style: const TextStyle(fontSize: 14, height: 1.5)),
        ],
      ),
    );
  }

  Widget _buildBulletSection(String title, List<String> items, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle(title),
        const SizedBox(height: 12),
        ...items.map((item) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(item, style: const TextStyle(fontSize: 13))),
            ],
          ),
        )),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import '../../domain/models/models.dart';

class CandidateCard extends StatelessWidget {
  final Application application;
  final VoidCallback onTap;

  const CandidateCard({
    super.key,
    required this.application,
    required this.onTap,
    this.onStatusChange,
    this.onDelete,
  });

  final void Function(String)? onStatusChange;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final score = application.analysisResult?.finalScore ?? 0;

    Color scoreColor;
    if (score >= 80) {
      scoreColor = const Color(0xFF22C55E); // Green
    } else if (score >= 60) {
      scoreColor = const Color(0xFFEAB308); // Yellow
    } else {
      scoreColor = const Color(0xFFEF4444); // Red
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: const Color(
        0xFF1E293B,
      ).withValues(alpha: 0.6), // Glassmorphism-like base
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFF334155), width: 1),
      ),
      child: InkWell(
        onTap: onTap,
        onLongPress: (onStatusChange != null || onDelete != null) ? () => _showStatusSheet(context) : null,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          application.candidate.name,
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          application.job?.title ?? 'Unknown Job',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: const Color(0xFF0EA5E9),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _buildScoreBadge(score, scoreColor),
                ],
              ),
              const SizedBox(height: 16),
              if (application.analysisResult?.tags.isNotEmpty ?? false) ...[
                _buildTags(),
              ],
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildStageBadge(),
                  Row(
                    children: [
                      if (onStatusChange != null || onDelete != null)
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          icon: const Icon(Icons.more_horiz, size: 20, color: Color(0xFF64748B)),
                          onPressed: () => _showStatusSheet(context),
                        ),
                      Icon(
                        Icons.arrow_forward_ios,
                        size: 14,
                        color: theme.colorScheme.primary,
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildScoreBadge(num score, Color scoreColor) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 12,
        vertical: 8,
      ),
      decoration: BoxDecoration(
        color: scoreColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scoreColor.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Text(
            score.toString(),
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: scoreColor,
            ),
          ),
          Text(
            'Match',
            style: TextStyle(
              fontSize: 10,
              color: scoreColor.withValues(alpha: 0.8),
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTags() {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: application.analysisResult!.tags.take(3).map((tag) {
        return Container(
          padding: const EdgeInsets.symmetric(
            horizontal: 8,
            vertical: 4,
          ),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: const Color(0xFF334155)),
          ),
          child: Text(
            tag,
            style: const TextStyle(
              fontSize: 10,
              color: Color(0xFF94A3B8),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildStageBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: 8,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        application.pipelineStage.toUpperCase(),
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          letterSpacing: 1,
          color: Color(0xFF94A3B8),
        ),
      ),
    );
  }

  void _showStatusSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Actions & Pipeline',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 4),
            Text(
              'Candidate: ${application.candidate.name}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 24),
            if (onStatusChange != null) ...[
              _buildStageOption(context, 'Screening', Icons.fact_check, const Color(0xFF0EA5E9)),
              _buildStageOption(context, 'Interview', Icons.calendar_today, const Color(0xFF7C3AED)),
              _buildStageOption(context, 'Offered', Icons.star, const Color(0xFFEAB308)),
              _buildStageOption(context, 'Hired', Icons.check_circle, const Color(0xFF22C55E)),
              _buildStageOption(context, 'Rejected', Icons.cancel, const Color(0xFFEF4444)),
            ],
            if (onDelete != null) ...[
              const Divider(color: Color(0xFF1E293B), height: 32),
              ListTile(
                onTap: () {
                  Navigator.pop(context);
                  onDelete?.call();
                },
                leading: const Icon(Icons.delete_forever, color: Colors.redAccent),
                title: const Text('Delete Candidate', style: TextStyle(color: Colors.redAccent)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ],
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _buildStageOption(BuildContext context, String stage, IconData icon, Color color) {
    final isCurrent = application.pipelineStage == stage;

    return ListTile(
      onTap: () {
        Navigator.pop(context);
        onStatusChange?.call(stage);
      },
      leading: Icon(icon, color: color),
      title: Text(
        stage,
        style: TextStyle(
          color: isCurrent ? color : Colors.white,
          fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
        ),
      ),
      trailing: isCurrent ? Icon(Icons.check, color: color) : null,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
  }
}

class Candidate {
  final String id;
  final String name;
  final String email;
  final String? cvUrl;

  Candidate({
    required this.id,
    required this.name,
    required this.email,
    this.cvUrl,
  });

  factory Candidate.fromJson(Map<String, dynamic> json) {
    return Candidate(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Unknown',
      email: json['email'] ?? '',
      cvUrl: json['cv_url'],
    );
  }
}

class Job {
  final String title;
  final String userEmail;

  Job({required this.title, required this.userEmail});

  factory Job.fromJson(Map<String, dynamic> json) {
    return Job(
      title: json['title'] ?? 'Unknown Job',
      userEmail: json['user_email'] ?? '',
    );
  }
}

class AnalysisResult {
  final String id;
  final num finalScore;
  final num skillsScore;
  final num culturalFitScore;
  final String recommendation;
  final List<String> strengths;
  final List<String> weaknesses;
  final List<String> tags;

  AnalysisResult({
    required this.id,
    required this.finalScore,
    required this.skillsScore,
    required this.culturalFitScore,
    required this.recommendation,
    required this.strengths,
    required this.weaknesses,
    required this.tags,
  });

  factory AnalysisResult.fromJson(Map<String, dynamic> json) {
    return AnalysisResult(
      id: json['id'] ?? '',
      finalScore: json['final_score'] ?? 0,
      skillsScore: json['skills_score'] ?? 0,
      culturalFitScore: json['cultural_fit_score'] ?? 0,
      recommendation: json['recommendation'] ?? '',
      strengths: List<String>.from(json['strengths'] ?? []),
      weaknesses: List<String>.from(json['weaknesses'] ?? []),
      tags: List<String>.from(json['tags'] ?? []),
    );
  }
}

class Application {
  final String id;
  final String jobId;
  final String candidateId;
  final String pipelineStage;
  final String status;
  final DateTime createdAt;
  final Candidate candidate;
  final Job? job;
  final AnalysisResult? analysisResult;

  Application({
    required this.id,
    required this.jobId,
    required this.candidateId,
    required this.pipelineStage,
    required this.status,
    required this.createdAt,
    required this.candidate,
    this.job,
    this.analysisResult,
  });

  factory Application.fromJson(Map<String, dynamic> json) {
    AnalysisResult? parsedAnalysis;
    if (json['analysis_results'] != null) {
      if (json['analysis_results'] is List) {
        if ((json['analysis_results'] as List).isNotEmpty) {
          parsedAnalysis = AnalysisResult.fromJson(
            (json['analysis_results'] as List).first,
          );
        }
      } else {
        parsedAnalysis = AnalysisResult.fromJson(json['analysis_results']);
      }
    }

    return Application(
      id: json['id'] ?? '',
      jobId: json['job_id'] ?? '',
      candidateId: json['candidate_id'] ?? '',
      pipelineStage: json['pipeline_stage'] ?? 'Applied',
      status: json['status'] ?? 'pending',
      createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
      candidate: Candidate.fromJson(json['candidates'] ?? {}),
      job: json['jobs'] != null ? Job.fromJson(json['jobs']) : null,
      analysisResult: parsedAnalysis,
    );
  }
}

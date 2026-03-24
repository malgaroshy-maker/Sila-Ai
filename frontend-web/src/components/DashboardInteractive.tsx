'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import SettingsModal from './SettingsModal';
import ChatDrawer from './ChatDrawer';
import KanbanBoard from './KanbanBoard';
import AiInsights from './AiInsights';
import {
  Briefcase, Users, Plus, Upload, Bot, Settings, RefreshCw, LogOut,
  FileText, Sparkles, Loader2, FileUp, X, Globe, ChevronRight,
  Zap, Target, HelpCircle, BookOpen, Tag, AlertTriangle, CheckCircle, XCircle,
  // Icons from user's diff, merged with existing
  Search, MessageSquare, Filter, ArrowUpRight, ShieldCheck, Download, Send,
  Cpu, LayoutTemplate, Mail, TrendingUp
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string[];
}

interface AnalysisResult {
  id: string;
  final_score: number;
  skills_score: number;
  language_score: number;
  gpa_score?: number;
  ind_readiness_score: number;
  recommendation: string;
  strengths: string[];
  weaknesses: string[];
  tags?: string[];
  flags?: string[];
  interview_questions?: string[];
  training_suggestions?: string[];
  applications: {
    id: string;
    job_id: string;
    pipeline_stage: string;
    candidates: {
      name: string;
      email: string;
    };
    jobs?: {
      title: string;
      user_email: string;
    };
  };
  created_at: string;
}

interface DashboardProps {
  initialJobs: Job[];
  initialResults: AnalysisResult[];
  t: Record<string, string>;
  locale: string;
}

export default function DashboardInteractive({ initialJobs, initialResults, t, locale }: DashboardProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs || []);
  const [results, setResults] = useState<AnalysisResult[]>(initialResults || []);
  const [userEmail, setUserEmail] = useState('');
  const [view, setView] = useState<'list' | 'kanban' | 'insights'>('list');
  
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<AnalysisResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Form states
  const [jobTitle, setJobTitle] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobReqs, setJobReqs] = useState('');
  const [jobMode, setJobMode] = useState<'form' | 'ai'>('form');
  const [aiJobPrompt, setAiJobPrompt] = useState('');
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Check URL for email parameter (from OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email');
    
    // Check localStorage
    const savedEmail = localStorage.getItem('user_email');

    // If no email from URL and no saved email, redirect to login
    if (!emailFromUrl && !savedEmail) {
      window.location.href = `/${locale}/login`;
      return;
    }

    if (emailFromUrl) {
      setUserEmail(emailFromUrl);
      localStorage.setItem('user_email', emailFromUrl);
      loadData(emailFromUrl);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (savedEmail) {
      setUserEmail(savedEmail);
      loadData(savedEmail);
    }

    supabase.auth.getSession().then(({ data }: { data: { session: { user: { email?: string } | null } | null } }) => {
      const email = data.session?.user?.email;
      if (email) {
        setUserEmail(email);
        localStorage.setItem('user_email', email);
        loadData(email);

        // Realtime subscription for analysis results
        const channel = supabase
          .channel('schema-db-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'analysis_results' },
            () => {
              loadData(email);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    });
  }, []);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const handleExportPDF = async (jobId: string) => {
    if (!userEmail) return;
    try {
      const res = await fetch(`${API_URL}/reports/job/${jobId}/pdf`, {
        headers: { 'x-user-email': userEmail }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${jobId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to generate report');
      }
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const handleStageChange = async (applicationId: string, newStage: string) => {
    if (!userEmail) return;
    
    // Optimistic update
    setResults((prev: AnalysisResult[]) => prev.map((r: AnalysisResult) => 
      r.applications?.id === applicationId 
        ? { ...r, applications: { ...r.applications, pipeline_stage: newStage } }
        : r
    ));

    try {
      await fetch(`${API_URL}/candidates/applications/${applicationId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
        body: JSON.stringify({ stage: newStage })
      });
    } catch (e) {
      console.error('Stage update failed', e);
      await loadData(userEmail);
    }
  };

  const loadData = async (email: string) => {
    const { data: jobsData } = await supabase.from('jobs').select('*').eq('user_email', email).order('created_at', { ascending: false });
    const { data: resultsData } = await supabase
      .from('analysis_results')
      .select('*, applications!inner(id, job_id, candidate_id, pipeline_stage, jobs!inner(title, user_email), candidates(name, email))')
      .eq('applications.jobs.user_email', email)
      .order('created_at', { ascending: false });
      
    if (jobsData) setJobs(jobsData as Job[]);
    if (resultsData) {
      const latestResults: Record<string, AnalysisResult> = {};
      (resultsData as unknown as AnalysisResult[]).forEach((r: AnalysisResult) => {
        const appId = r.applications?.id;
        if (appId && (!latestResults[appId] || new Date(r.created_at) > new Date(latestResults[appId].created_at))) {
          latestResults[appId] = r;
        }
      });
      setResults(Object.values(latestResults));
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail) return;
    const reqsArray = jobReqs.split(',').map(r => r.trim());
    const res = await fetch(`${API_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
      body: JSON.stringify({ title: jobTitle, description: jobDesc, requirements: reqsArray })
    });
    if (res.ok) {
      const newJob = await res.json() as Job;
      setJobs([newJob, ...jobs]);
      setIsJobModalOpen(false);
      setJobTitle(''); setJobDesc(''); setJobReqs('');
    }
  };

  const handleAICreateJob = async () => {
    if (!aiJobPrompt.trim() || !userEmail) return;
    setIsCreatingJob(true);
    try {
      const res = await fetch(`${API_URL}/jobs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
        body: JSON.stringify({ prompt: aiJobPrompt })
      });
      if (res.ok) {
        const newJob = await res.json() as Job;
        setJobs([newJob, ...jobs]);
        setIsJobModalOpen(false);
        setAiJobPrompt('');
      } else {
        alert('Failed to generate job');
      }
    } catch {
      alert('Error generating job');
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleUploadCV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cvFile || !userEmail) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', cvFile);
    try {
      const res = await fetch(`${API_URL}/candidates/upload-auto`, {
        method: 'POST',
        headers: { 'x-user-email': userEmail },
        body: formData
      });
      if (res.ok) {
        setIsUploadModalOpen(false);
        setCvFile(null);
        await loadData(userEmail);
      } else {
        const err = await res.json() as { message?: string };
        alert(`Failed: ${err.message || 'Upload error'}`);
      }
    } catch (e) {
      alert('Error uploading CV');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRefreshSync = async () => {
    if (!userEmail) return;
    setIsRefreshing(true);
    try {
      await fetch(`${API_URL}/email/sync`, { 
        method: 'POST',
        headers: { 'x-user-email': userEmail }
      });
      await loadData(userEmail);
    } catch (error) {
      console.error('Refresh failed', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredResults = results
    .filter((r: AnalysisResult) => {
      if (!selectedJobId) return true;
      return r.applications?.job_id === selectedJobId;
    })
    .sort((a: AnalysisResult, b: AnalysisResult) => (b.final_score || 0) - (a.final_score || 0));

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-green-500 text-white';
    if (score >= 60) return 'from-amber-400 to-yellow-500 text-slate-900';
    return 'from-red-500 to-rose-500 text-white';
  };

  const getRecBadge = (rec: string) => {
    if (rec === 'Strong') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (rec === 'Average') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Header */}
      <header className="bg-[#0F172A]/80 backdrop-blur-xl border-b border-[#1E293B] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#0369A1] to-[#0EA5E9] bg-clip-text text-transparent">
              {t.title || 'AI Recruitment Intelligence'}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">{t.description || 'AI-Powered Recruitment'}</p>
          </div>
          <div className="flex gap-2.5">
            <button 
              onClick={handleRefreshSync} 
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${isRefreshing ? 'bg-[#0F172A] text-slate-500' : 'bg-[#0F172A] text-[#0EA5E9] hover:bg-[#1E293B] border border-[#1E293B]'}`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? (t.syncing || 'Syncing...') : (t.refresh || 'Sync')}
            </button>
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-2 bg-[#0F172A] text-slate-300 hover:bg-[#1E293B] px-3 py-2 rounded-lg text-sm font-medium border border-[#1E293B] cursor-pointer transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={() => setIsJobModalOpen(true)} className="flex items-center gap-2 bg-[#0369A1] hover:bg-[#0369A1]/80 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-lg shadow-[#0369A1]/20">
              <Plus className="w-4 h-4" />
              {t.create_job || 'New Job'}
            </button>
            <button onClick={() => setIsUploadModalOpen(true)} className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#7C3AED]/80 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-lg shadow-[#7C3AED]/20">
              <Upload className="w-4 h-4" />
              {t.upload_cv || 'Upload CV'}
            </button>
            <button onClick={() => setIsChatOpen(true)} className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#22C55E]/80 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-lg shadow-[#22C55E]/20">
              <Bot className="w-4 h-4" />
              {t.ai_chat || 'AI Chat'}
            </button>
            <button 
              onClick={() => window.location.href = `/${locale}/login`} 
              className="text-slate-500 hover:text-red-400 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E293B] flex items-center gap-3">
              <span className="bg-[#0369A1]/20 text-[#0EA5E9] p-2 rounded-lg">
                <Briefcase className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-semibold text-slate-100">{t.jobs || 'Jobs'}</h2>
              <span className="ms-auto bg-[#020617] text-slate-400 text-xs font-bold px-2.5 py-1 rounded-full">{jobs.length}</span>
            </div>
            <div className="p-3 space-y-2 max-h-[700px] overflow-y-auto">
              {(!jobs || jobs.length === 0) ? (
                <div className="text-center text-slate-500 py-12 border border-dashed border-[#1E293B] rounded-xl">
                  {t.no_jobs || 'No jobs yet'}
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedJobId(null)}
                    className={`w-full text-start px-4 py-3 rounded-xl transition-all text-sm font-medium cursor-pointer ${
                      !selectedJobId 
                        ? 'bg-[#0369A1]/20 text-[#0EA5E9] border border-[#0369A1]/30' 
                        : 'text-slate-400 hover:bg-[#1E293B] border border-transparent'
                    }`}
                  >
                    <Globe className="w-4 h-4 inline-block me-2" />
                    {t.all_jobs || 'All Jobs'}
                  </button>
                  {jobs.map((job: Job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJobId(selectedJobId === job.id ? null : job.id)}
                      className={`w-full text-start px-4 py-3.5 rounded-xl transition-all cursor-pointer group flex items-center justify-between ${
                        selectedJobId === job.id 
                          ? 'bg-[#0369A1]/20 border border-[#0369A1]/30 shadow-lg shadow-[#0369A1]/5' 
                          : 'hover:bg-[#1E293B] border border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-bold text-sm truncate ${selectedJobId === job.id ? 'text-[#0EA5E9]' : 'text-slate-200 group-hover:text-white'}`}>{job.title}</h3>
                          {selectedJobId === job.id && <Zap className="w-3 h-3 text-[#0EA5E9] animate-pulse" />}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                            <Users className="w-3 h-3" />
                            {results.filter((r: AnalysisResult) => r.applications?.job_id === job.id).length} {t.candidates || 'Candidates'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleExportPDF(job.id); }}
                          className="p-2 hover:bg-[#1E293B] rounded-lg text-slate-500 hover:text-[#0EA5E9] transition-colors"
                          title="Export PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <ChevronRight className={`w-4 h-4 transition-all ${selectedJobId === job.id ? 'rotate-90 text-[#0EA5E9]' : 'text-slate-600 group-hover:translate-x-0.5'}`} />
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Candidates Grid */}
        <div className="lg:col-span-2">
          <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E293B] flex items-center gap-3">
              <span className="bg-[#22C55E]/20 text-[#22C55E] p-2 rounded-lg">
                <Users className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-semibold text-slate-100">{t.candidates || 'Candidates'}</h2>
              <span className="ms-auto bg-[#020617] text-slate-400 text-xs font-bold px-2.5 py-1 rounded-full">{filteredResults.length}</span>
            </div>
            <div className="px-5 py-4 border-b border-[#1E293B] flex items-center gap-3">
              <button className="p-2 hover:bg-[#1E293B] rounded-lg text-slate-400">
                <Filter className="w-5 h-5" />
              </button>
              <div className="flex bg-[#0F172A] p-1 rounded-xl border border-[#1E293B]">
                <button 
                  onClick={() => setView('list')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-[#0369A1] text-white shadow-lg shadow-[#0369A1]/20' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {t.list || 'List'}
                </button>
                <button 
                  onClick={() => setView('kanban')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'kanban' ? 'bg-[#0369A1] text-white shadow-lg shadow-[#0369A1]/20' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {t.kanban || 'Kanban'}
                </button>
                <button 
                  onClick={() => setView('insights')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'insights' ? 'bg-[#0369A1] text-white shadow-lg shadow-[#0369A1]/20' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {t.insights || 'AI Insights'}
                </button>
              </div>
            </div>
            {view === 'list' ? (
              <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto">
                {(!filteredResults || filteredResults.length === 0) ? (
                  <div className="text-center text-slate-500 py-16 border border-dashed border-[#1E293B] rounded-xl">
                    {t.no_candidates || 'No candidates found'}
                  </div>
                ) : (
                  filteredResults.map((res: AnalysisResult) => {
                    const candidateName = res.applications?.candidates?.name || 'Unknown';
                    const candidateEmail = res.applications?.candidates?.email || '';
                    const jobTitle = res.applications?.jobs?.title || 'Unknown Job';
                    const score = res.final_score || 0;

                    return (
                      <div 
                        key={res.id} 
                        onClick={() => setSelectedCandidate(res)} 
                        className="bg-[#020617]/50 hover:bg-[#1E293B] border border-[#1E293B]/50 hover:border-[#1E293B] rounded-xl p-4 cursor-pointer transition-all group"
                      >
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-base text-slate-100 group-hover:text-white truncate">{candidateName}</h3>
                            {candidateEmail && <p className="text-slate-500 text-xs mt-0.5">{candidateEmail}</p>}
                            <p className="text-[#0EA5E9] text-xs font-medium mt-1">{jobTitle}</p>
                          </div>
                          <div className={`ms-3 px-3 py-1.5 rounded-lg font-bold text-sm bg-gradient-to-br ${getScoreColor(score)} shadow-lg`}>
                            {score}%
                          </div>
                        </div>
                        
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <span className="bg-[#1E293B]/50 px-2.5 py-1 rounded text-xs text-slate-300">
                            {t.skills || 'Skills'}: <strong className="text-white">{res.skills_score}</strong>
                          </span>
                          <span className="bg-[#1E293B]/50 px-2.5 py-1 rounded text-xs text-slate-300">
                            {t.language || 'Lang'}: <strong className="text-white">{res.language_score}</strong>
                          </span>
                          {res.gpa_score != null && res.gpa_score > 0 && (
                            <span className="bg-[#1E293B]/50 px-2.5 py-1 rounded text-xs text-slate-300">
                              {t.gpa || 'GPA'}: <strong className="text-white">{res.gpa_score}</strong>
                            </span>
                          )}
                          <span className="bg-[#1E293B]/50 px-2.5 py-1 rounded text-xs text-slate-300">
                            {t.readiness || 'Readiness'}: <strong className="text-white">{res.ind_readiness_score}</strong>
                          </span>
                        </div>

                        {/* Tags */}
                        {res.tags && res.tags.length > 0 && (
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            {res.tags.map((tag: string, i: number) => (
                              <span key={i} className="bg-[#0369A1]/15 text-[#0EA5E9] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#0369A1]/20 inline-flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" />{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Flags */}
                        {res.flags && res.flags.length > 0 && (
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            {res.flags.map((flag: string, i: number) => (
                              <span key={i} className="bg-amber-500/15 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/20 inline-flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" />{flag}
                              </span>
                            ))}
                          </div>
                        )}

                        {res.justification && (
                          <p className="text-slate-400 text-xs mt-3 line-clamp-2 leading-relaxed border-t border-[#1E293B]/50 pt-2.5">
                            {res.justification}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : view === 'kanban' ? (
              <KanbanBoard 
                results={results.filter((r: AnalysisResult) => !selectedJobId || r.applications.job_id === selectedJobId)} 
                onStageChange={handleStageChange}
                t={t}
                locale={locale}
              />
            ) : (
              <AiInsights userEmail={userEmail} t={t} />
            )}
          </div>
        </div>
      </main>

      {/* ====================== MODALS ====================== */}

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedCandidate(null)}>
          <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedCandidate.applications?.candidates?.name}</h2>
                {selectedCandidate.applications?.candidates?.email && (
                  <p className="text-slate-400 text-sm">{selectedCandidate.applications?.candidates?.email}</p>
                )}
                <p className="text-[#0EA5E9] font-medium text-sm mt-1">{selectedCandidate.applications?.jobs?.title}</p>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-black px-4 py-2 rounded-xl bg-gradient-to-br ${getScoreColor(selectedCandidate.final_score)}`}>
                  {selectedCandidate.final_score}%
                </div>
                <span className={`text-xs font-bold uppercase mt-2 inline-block px-3 py-1 rounded-full border ${getRecBadge(selectedCandidate.recommendation)}`}>
                  {selectedCandidate.recommendation}
                </span>
              </div>
            </div>
            
            {/* Score Bars */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: t.skills || 'Skills', value: selectedCandidate.skills_score },
                { label: t.language || 'Language', value: selectedCandidate.language_score },
                { label: t.readiness || 'Readiness', value: selectedCandidate.ind_readiness_score },
                ...(selectedCandidate.gpa_score != null && selectedCandidate.gpa_score > 0 
                  ? [{ label: t.gpa || 'GPA', value: selectedCandidate.gpa_score }] 
                  : [])
              ].map(item => (
                <div key={item.label} className="bg-[#020617] rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-white font-bold">{item.value}</span>
                  </div>
                  <div className="h-2 bg-[#1E293B] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${item.value >= 70 ? 'from-emerald-500 to-green-400' : item.value >= 40 ? 'from-amber-500 to-yellow-400' : 'from-red-500 to-rose-400'}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="bg-[#020617]/50 rounded-xl p-4 border border-[#1E293B]/50">
                <h3 className="font-semibold text-slate-200 mb-2 text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#0EA5E9]" />
                  {t.ai_justification || 'AI Justification'}
                </h3>
                <p className="text-slate-300 leading-relaxed text-sm">{selectedCandidate.justification}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                  <h3 className="font-bold text-emerald-400 mb-2 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    {t.strengths || 'Strengths'}
                  </h3>
                  <ul className="text-sm text-emerald-200/80 space-y-1">
                    {selectedCandidate.strengths?.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                  <h3 className="font-bold text-red-400 mb-2 text-sm flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {t.weaknesses || 'Weaknesses'}
                  </h3>
                  <ul className="text-sm text-red-200/80 space-y-1">
                    {selectedCandidate.weaknesses?.map((w: string, i: number) => <li key={i}>• {w}</li>)}
                  </ul>
                </div>
              </div>

              {/* Tags */}
              {selectedCandidate.tags?.length > 0 && (
                <div className="bg-[#020617]/50 rounded-xl p-4 border border-[#1E293B]/50">
                  <h3 className="font-semibold text-slate-200 mb-2 text-sm flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#0EA5E9]" />
                    {t.tags || 'Tags'}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedCandidate.tags.map((tag: string, i: number) => (
                      <span key={i} className="bg-[#0369A1]/20 text-[#0EA5E9] text-xs font-medium px-3 py-1 rounded-full border border-[#0369A1]/25">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Flags */}
              {selectedCandidate.flags?.length > 0 && (
                <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                  <h3 className="font-semibold text-amber-400 mb-2 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t.flags || 'Flags'}
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedCandidate.flags.map((flag: string, i: number) => (
                      <span key={i} className="bg-amber-500/20 text-amber-300 text-xs font-medium px-3 py-1 rounded-full border border-amber-500/25">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Interview Questions */}
              {selectedCandidate.interview_questions?.length > 0 && (
                <div className="bg-violet-500/10 rounded-xl p-4 border border-violet-500/20">
                  <h3 className="font-semibold text-violet-400 mb-2 text-sm flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    {t.interview_q || 'Interview Questions'}
                  </h3>
                  <ol className="text-sm text-violet-200/80 space-y-2 list-decimal list-inside">
                    {selectedCandidate.interview_questions.map((q: string, i: number) => <li key={i}>{q}</li>)}
                  </ol>
                </div>
              )}

              {/* Training Suggestions */}
              {selectedCandidate.training_suggestions?.length > 0 && (
                <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20">
                  <h3 className="font-semibold text-cyan-400 mb-2 text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    {t.training || 'Training Suggestions'}
                  </h3>
                  <ul className="text-sm text-cyan-200/80 space-y-1">
                    {selectedCandidate.training_suggestions.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[#1E293B] flex justify-end">
              <button onClick={() => setSelectedCandidate(null)} className="px-5 py-2 bg-[#020617] text-slate-300 hover:bg-[#1E293B] rounded-lg text-sm font-medium cursor-pointer transition-all">{t.close || 'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      {isJobModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsJobModalOpen(false)}>
          <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] p-6 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-5">{t.create_job || 'Create New Job'}</h2>
            
            {/* Tab switcher */}
            <div className="flex gap-2 mb-5">
              <button 
                onClick={() => setJobMode('form')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${jobMode === 'form' ? 'bg-[#0369A1] text-white' : 'bg-[#020617] text-slate-400'}`}
              >
                <FileText className="w-4 h-4" />
                {t.create_job_form || 'Form'}
              </button>
              <button 
                onClick={() => setJobMode('ai')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-all ${jobMode === 'ai' ? 'bg-[#22C55E] text-white' : 'bg-[#020617] text-slate-400'}`}
              >
                <Sparkles className="w-4 h-4" />
                {t.create_job_ai || 'AI Generate'}
              </button>
            </div>

            {jobMode === 'form' ? (
              <form onSubmit={handleCreateJob} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.job_title || 'Job Title'}</label>
                  <input required value={jobTitle} onChange={e=>setJobTitle(e.target.value)} className="w-full bg-[#020617] border border-[#1E293B] text-white p-2.5 rounded-lg focus:ring-2 focus:ring-[#0369A1] focus:border-transparent outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.job_desc || 'Description'}</label>
                  <textarea required value={jobDesc} onChange={e=>setJobDesc(e.target.value)} className="w-full bg-[#020617] border border-[#1E293B] text-white p-2.5 rounded-lg focus:ring-2 focus:ring-[#0369A1] focus:border-transparent outline-none" rows={3} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{t.job_reqs || 'Requirements (comma separated)'}</label>
                  <input required value={jobReqs} onChange={e=>setJobReqs(e.target.value)} className="w-full bg-[#020617] border border-[#1E293B] text-white p-2.5 rounded-lg focus:ring-2 focus:ring-[#0369A1] focus:border-transparent outline-none" placeholder={t.req_placeholder || "Node.js, 5+ years, Arabic"} />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-[#1E293B] mt-5">
                  <button type="button" onClick={() => setIsJobModalOpen(false)} className="px-4 py-2 text-slate-400 hover:bg-[#1E293B] rounded-lg text-sm cursor-pointer">{t.cancel || 'Cancel'}</button>
                  <button type="submit" className="px-5 py-2 bg-[#0369A1] text-white hover:bg-[#0369A1]/80 rounded-lg text-sm font-medium cursor-pointer transition-all">{t.create || 'Create'}</button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-400 text-sm">{t.ai_prompt_hint || 'Describe the job in natural language — AI will generate a structured posting.'}</p>
                <textarea
                  value={aiJobPrompt}
                  onChange={e => setAiJobPrompt(e.target.value)}
                  placeholder={t.job_placeholder || "e.g., I need a senior React developer with 5 years experience who speaks Arabic and English..."}
                  className="w-full bg-[#020617] border border-[#1E293B] text-white p-3 rounded-lg focus:ring-2 focus:ring-[#22C55E] focus:border-transparent outline-none"
                  rows={4}
                />
                <div className="flex justify-end gap-3 pt-4 border-t border-[#1E293B] mt-5">
                  <button type="button" onClick={() => setIsJobModalOpen(false)} className="px-4 py-2 text-slate-400 hover:bg-[#1E293B] rounded-lg text-sm cursor-pointer">{t.cancel || 'Cancel'}</button>
                  <button 
                    onClick={handleAICreateJob} 
                    disabled={isCreatingJob || !aiJobPrompt.trim()}
                    className="px-5 py-2 bg-[#22C55E] text-white hover:bg-[#22C55E]/80 rounded-lg text-sm font-medium cursor-pointer transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    {isCreatingJob ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.generating || 'Generating...'}</> : <><Sparkles className="w-4 h-4" /> {t.generate_and_create || 'Generate & Create'}</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload CV Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsUploadModalOpen(false)}>
          <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] p-6 max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-[#7C3AED]" />
              {t.upload_cv || 'Upload CV'}
            </h2>
            <p className="text-slate-400 text-sm mb-5">{t.upload_desc || 'Just drop the file — AI will extract name, email, and analyze against all jobs automatically. Supports PDF, TXT, DOCX, and Images.'}</p>
            <form onSubmit={handleUploadCV} className="space-y-4">
              <div className="border-2 border-dashed border-[#1E293B] rounded-xl p-8 text-center hover:border-[#0369A1]/50 transition-colors">
                <input 
                  type="file" 
                  accept=".pdf,.txt,.docx,.jpg,.jpeg,.png,.tiff" 
                  required 
                  onChange={e => setCvFile(e.target.files?.[0] || null)} 
                  className="w-full text-slate-300 file:me-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#0369A1] file:text-white hover:file:bg-[#0369A1]/80 cursor-pointer"
                />
                {cvFile && <p className="text-[#0EA5E9] text-sm mt-3 flex items-center justify-center gap-2"><FileText className="w-4 h-4" />{cvFile.name}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#1E293B] mt-5">
                <button type="button" onClick={() => { setIsUploadModalOpen(false); setCvFile(null); }} className="px-4 py-2 text-slate-400 hover:bg-[#1E293B] rounded-lg text-sm cursor-pointer">{t.cancel || 'Cancel'}</button>
                <button type="submit" disabled={isUploading || !cvFile} className="px-5 py-2 bg-[#7C3AED] text-white hover:bg-[#7C3AED]/80 rounded-lg text-sm font-medium cursor-pointer transition-all disabled:opacity-40 flex items-center gap-2">
                  {isUploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {t.analyzing || 'AI Analyzing...'}</>
                  ) : (
                    <><Upload className="w-4 h-4" /> {t.upload_and_analyze || 'Upload & Analyze'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        userEmail={userEmail}
        t={t}
      />

      {/* AI Chat Drawer */}
      <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} t={t} userEmail={userEmail} />
    </div>
  );
}

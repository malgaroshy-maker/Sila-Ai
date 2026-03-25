'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import SettingsModal from './SettingsModal';
import ChatDrawer from './ChatDrawer';
import KanbanBoard from './KanbanBoard';
import AiInsights from './AiInsights';
import LanguageSwitcher from './LanguageSwitcher';
import { Link } from '@/i18n/routing';
import {
  Briefcase, Users, Plus, Upload, Bot, Settings, RefreshCw, LogOut,
  FileText, Sparkles, Loader2, FileUp, X, Globe, ChevronRight,
  Zap, Target, HelpCircle, BookOpen, Tag, AlertTriangle, CheckCircle, XCircle,
  Search, MessageSquare, Filter, ArrowUpRight, ShieldCheck, Download, Send,
  Cpu, LayoutTemplate, Mail, TrendingUp
} from 'lucide-react';
import { SyncStatus } from './SyncStatus';

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
  justification?: string;
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
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user?.email) {
          setUserEmail(user.email);
          localStorage.setItem('user_email', user.email);
          await loadData(user.email);
        } else {
          // Fallback to localStorage for legacy or if session is weirdly missing but email exists
          const savedEmail = localStorage.getItem('user_email');
          if (savedEmail) {
            setUserEmail(savedEmail);
            await loadData(savedEmail);
          } else {
            // No session and no localStorage -> Definitely need to login
            window.location.href = `/${locale}/login`;
            return;
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        localStorage.setItem('user_email', session.user.email);
        loadData(session.user.email);
      }
    });

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'analysis_results' },
        () => {
          const email = localStorage.getItem('user_email');
          if (email) loadData(email);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
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
      }
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const handleStageChange = async (applicationId: string, newStage: string) => {
    if (!userEmail) return;
    setResults((prev) => prev.map((r) => 
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
      loadData(userEmail);
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
      (resultsData as unknown as AnalysisResult[]).forEach((r) => {
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
      }
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
      }
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
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredResults = results
    .filter((r) => !selectedJobId || r.applications?.job_id === selectedJobId)
    .sort((a, b) => (b.final_score || 0) - (a.final_score || 0));

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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#0369A1]/20 border-t-[#0EA5E9] rounded-full animate-spin"></div>
          <Bot className="w-8 h-8 text-[#0EA5E9] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <p className="text-slate-400 font-medium animate-pulse">{t.syncing || 'Checking session...'}</p>
      </div>
    );
  }

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
          <div className="flex items-center gap-3">
            <Link 
              href="/about" 
              className="text-slate-400 hover:text-[#0EA5E9] transition-colors p-2 rounded-lg hover:bg-[#1E293B]"
              title={t.about || 'About System'}
            >
              <HelpCircle className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-[#1E293B] mx-1" />
            <LanguageSwitcher />
            <div className="h-6 w-px bg-[#1E293B] mx-1" />
            <button 
              onClick={handleRefreshSync} 
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${isRefreshing ? 'bg-[#0F172A] text-slate-500' : 'bg-[#0F172A] text-[#0EA5E9] hover:bg-[#1E293B] border border-[#1E293B]'}`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{isRefreshing ? (t.syncing || 'Syncing...') : (t.refresh || 'Sync')}</span>
            </button>
            <button 
              onClick={() => setView(view === 'insights' ? 'list' : 'insights')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#1E293B] cursor-pointer transition-all ${view === 'insights' ? 'bg-[#0369A1] text-white underline underline-offset-4 decoration-2' : 'bg-[#0F172A] text-slate-300 hover:bg-[#1E293B]'}`}
              title={t.insights || 'AI Insights'}
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden xl:inline">{t.insights || 'Insights'}</span>
            </button>
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-2 bg-[#0F172A] text-slate-300 hover:bg-[#1E293B] px-3 py-2 rounded-lg text-sm font-medium border border-[#1E293B] cursor-pointer transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={() => setIsJobModalOpen(true)} className="flex items-center gap-2 bg-[#0369A1] hover:bg-[#0369A1]/80 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-lg shadow-[#0369A1]/20">
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">{t.create_job || 'New Job'}</span>
            </button>
            <button onClick={() => setIsUploadModalOpen(true)} className="flex items-center gap-2 bg-[#7C3AED] hover:bg-[#7C3AED]/80 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-lg shadow-[#7C3AED]/20">
              <Upload className="w-4 h-4" />
              <span className="hidden md:inline">{t.upload_cv || 'Upload CV'}</span>
            </button>
            <button onClick={() => setIsChatOpen(true)} className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#22C55E]/80 text-white px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all shadow-lg shadow-[#22C55E]/20">
              <Bot className="w-4 h-4" />
              <span className="hidden lg:inline">{t.ai_chat || 'AI Chat'}</span>
            </button>
            <button 
              onClick={async () => {
                await supabase.auth.signOut();
                localStorage.removeItem('user_email');
                window.location.href = `/${locale}/login`;
              }} 
              className="text-slate-500 hover:text-red-400 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className={`grid grid-cols-1 ${view === 'insights' ? '' : 'lg:grid-cols-3'} gap-6`}>
          {/* Jobs Sidebar - Hidden in Insights view */}
          {view !== 'insights' && (
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
                  {jobs.length === 0 ? (
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
                      {jobs.map((job) => (
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
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                              <Users className="w-3 h-3" />
                              {results.filter((r) => r.applications?.job_id === job.id).length} {t.candidates || 'Candidates'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleExportPDF(job.id); }}
                              className="p-2 hover:bg-[#1E293B] rounded-lg text-slate-500 hover:text-[#0EA5E9] transition-colors"
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
          )}
          
          {/* Main Content (Candidates or Insights) */}
          <div className={view === 'insights' ? 'lg:col-span-3' : 'lg:col-span-2'}>
            <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1E293B] flex items-center gap-3">
                <span className={view === 'insights' ? 'bg-[#0369A1]/20 text-[#0EA5E9]' : 'bg-[#22C55E]/20 text-[#22C55E]' + " p-2 rounded-lg"}>
                  {view === 'insights' ? <TrendingUp className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                </span>
                <h2 className="text-lg font-semibold text-slate-100">
                  {view === 'insights' ? (t.insights || 'AI Insights') : (t.candidates || 'Candidates')}
                </h2>
                {view !== 'insights' && (
                  <span className="ms-auto bg-[#020617] text-slate-400 text-xs font-bold px-2.5 py-1 rounded-full">{filteredResults.length}</span>
                )}
              </div>
              
              {view !== 'insights' && (
                <div className="px-5 py-4 border-b border-[#1E293B] flex items-center gap-3">
                  <button className="p-2 hover:bg-[#1E293B] rounded-lg text-slate-400">
                    <Filter className="w-5 h-5" />
                  </button>
                  <div className="flex bg-[#0F172A] p-1 rounded-xl border border-[#1E293B]">
                    <button 
                      onClick={() => setView('list')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-[#0369A1] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {t.list || 'List'}
                    </button>
                    <button 
                      onClick={() => setView('kanban')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'kanban' ? 'bg-[#0369A1] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {t.kanban || 'Kanban'}
                    </button>
                  </div>
                </div>
              )}

              {view === 'list' ? (
                <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto">
                  {filteredResults.length === 0 ? (
                    <div className="text-center text-slate-500 py-16 border border-dashed border-[#1E293B] rounded-xl">
                      {t.no_candidates || 'No candidates found'}
                    </div>
                  ) : (
                    filteredResults.map((res) => (
                      <div 
                        key={res.id} 
                        onClick={() => setSelectedCandidate(res)} 
                        className="bg-[#020617]/50 hover:bg-[#1E293B] border border-[#1E293B]/50 hover:border-[#1E293B] rounded-xl p-4 cursor-pointer transition-all group"
                      >
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-base text-slate-100 group-hover:text-white truncate">{res.applications?.candidates?.name || 'Unknown'}</h3>
                            <p className="text-[#0EA5E9] text-xs font-medium mt-1">{res.applications?.jobs?.title || 'Unknown Job'}</p>
                          </div>
                          <div className={`ms-3 px-3 py-1.5 rounded-lg font-bold text-sm bg-gradient-to-br ${getScoreColor(res.final_score || 0)} shadow-lg`}>
                            {res.final_score || 0}%
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          <span className="bg-[#1E293B]/50 px-2.5 py-1 rounded text-xs text-slate-300">
                            {t.skills || 'Skills'}: <strong className="text-white">{res.skills_score}</strong>
                          </span>
                          <span className="bg-[#1E293B]/50 px-2.5 py-1 rounded text-xs text-slate-300">
                            {t.language || 'Lang'}: <strong className="text-white">{res.language_score}</strong>
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : view === 'kanban' ? (
                <KanbanBoard 
                  results={results.filter((r) => !selectedJobId || r.applications.job_id === selectedJobId)} 
                  onStageChange={handleStageChange}
                  t={t}
                  locale={locale}
                />
              ) : (
                <AiInsights userEmail={userEmail} t={t} />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSelectedCandidate(null)}>
          <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedCandidate.applications?.candidates?.name}</h2>
                <p className="text-[#0EA5E9] font-medium text-sm mt-1">{selectedCandidate.applications?.jobs?.title}</p>
              </div>
              <div className={`text-3xl font-black px-4 py-2 rounded-xl bg-gradient-to-br ${getScoreColor(selectedCandidate.final_score)}`}>
                {selectedCandidate.final_score}%
              </div>
            </div>
            <div className="space-y-4">
              <div className="bg-[#020617]/50 rounded-xl p-4 border border-[#1E293B]/50">
                <h3 className="font-semibold text-slate-200 mb-2 text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#0EA5E9]" />
                  {t.ai_justification || 'AI Justification'}
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">{selectedCandidate.justification}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                  <h3 className="font-bold text-emerald-400 mb-2 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />{t.strengths || 'Strengths'}</h3>
                  <ul className="text-sm text-emerald-200/80 space-y-1">{selectedCandidate.strengths?.map((s, i) => <li key={i}>• {s}</li>)}</ul>
                </div>
                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                  <h3 className="font-bold text-red-400 mb-2 text-sm flex items-center gap-2"><XCircle className="w-4 h-4" />{t.weaknesses || 'Weaknesses'}</h3>
                  <ul className="text-sm text-red-200/80 space-y-1">{selectedCandidate.weaknesses?.map((w, i) => <li key={i}>• {w}</li>)}</ul>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-[#1E293B] flex justify-end">
              <button onClick={() => setSelectedCandidate(null)} className="px-5 py-2 bg-[#020617] text-slate-300 hover:bg-[#1E293B] rounded-lg text-sm">{t.close || 'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {isJobModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsJobModalOpen(false)}>
          <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-5">{t.create_job || 'Create New Job'}</h2>
            <div className="flex gap-2 mb-5">
              <button onClick={() => setJobMode('form')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${jobMode === 'form' ? 'bg-[#0369A1] text-white' : 'bg-[#020617] text-slate-400'}`}>{t.create_job_form || 'Form'}</button>
              <button onClick={() => setJobMode('ai')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${jobMode === 'ai' ? 'bg-[#22C55E] text-white' : 'bg-[#020617] text-slate-400'}`}>{t.create_job_ai || 'AI Generate'}</button>
            </div>
            {jobMode === 'form' ? (
              <form onSubmit={handleCreateJob} className="space-y-4">
                <input required value={jobTitle} onChange={e=>setJobTitle(e.target.value)} placeholder={t.job_title} className="w-full bg-[#020617] border border-[#1E293B] text-white p-2.5 rounded-lg outline-none" />
                <textarea required value={jobDesc} onChange={e=>setJobDesc(e.target.value)} placeholder={t.job_desc} className="w-full bg-[#020617] border border-[#1E293B] text-white p-2.5 rounded-lg outline-none" rows={3} />
                <input required value={jobReqs} onChange={e=>setJobReqs(e.target.value)} placeholder={t.job_reqs} className="w-full bg-[#020617] border border-[#1E293B] text-white p-2.5 rounded-lg outline-none" />
                <button type="submit" className="w-full py-2 bg-[#0369A1] text-white rounded-lg font-medium">{t.create}</button>
              </form>
            ) : (
              <div className="space-y-4">
                <textarea value={aiJobPrompt} onChange={e => setAiJobPrompt(e.target.value)} placeholder={t.job_placeholder} className="w-full bg-[#020617] border border-[#1E293B] text-white p-3 rounded-lg outline-none" rows={4} />
                <button onClick={handleAICreateJob} disabled={isCreatingJob || !aiJobPrompt.trim()} className="w-full py-2 bg-[#22C55E] text-white rounded-lg font-medium disabled:opacity-40">
                  {isCreatingJob ? t.generating : t.generate_and_create}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsUploadModalOpen(false)}>
          <div className="bg-[#0F172A] rounded-2xl border border-[#1E293B] p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><FileUp className="w-5 h-5 text-[#7C3AED]" />{t.upload_cv}</h2>
            <form onSubmit={handleUploadCV} className="space-y-4 pt-4">
              <input type="file" required onChange={e => setCvFile(e.target.files?.[0] || null)} className="w-full text-slate-300" />
              <button type="submit" disabled={isUploading || !cvFile} className="w-full py-2 bg-[#7C3AED] text-white rounded-lg font-medium disabled:opacity-40">
                {isUploading ? t.analyzing : t.upload_and_analyze}
              </button>
            </form>
          </div>
        </div>
      )}

      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} userEmail={userEmail} t={t} />
      <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} t={t} userEmail={userEmail} />
      {userEmail && <SyncStatus userEmail={userEmail} onComplete={() => loadData(userEmail)} />}
    </div>
  );
}

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
  Cpu, LayoutTemplate, Mail, TrendingUp, GraduationCap, Info
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
  is_fresh_graduate?: boolean;
  project_impact_score?: number;
  cultural_fit_score?: number;
  career_trajectory?: string;
  project_highlights?: string[];
  applications: {
    id: string;
    job_id: string;
    pipeline_stage: string;
    candidates: {
      id: string;
      name: string;
      email: string;
      cv_url?: string;
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
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<'intelligence' | 'overview' | 'prep'>('intelligence');
  const [downloadStatus, setDownloadStatus] = useState<{[key: string]: 'idle' | 'loading' | 'success'}>( {});
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');

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
        // 1. Check for email in URL query params (from backend redirect)
        const urlParams = new URLSearchParams(window.location.search);
        const urlEmail = urlParams.get('email');
        
        if (urlEmail) {
          // Found email in URL, this is our new primary session email
          setUserEmail(urlEmail);
          localStorage.setItem('user_email', urlEmail);
          
          // Clean up URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          
          await loadData(urlEmail);
          setIsAuthLoading(false);
          return;
        }

        // 2. Check Supabase session
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

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) setServerStatus('online');
        else setServerStatus('offline');
      } catch {
        setServerStatus('offline');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

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
              href="/about?from=dashboard" 
              className="text-slate-400 hover:text-[#0EA5E9] transition-colors p-2 rounded-lg hover:bg-[#1E293B]"
              title={t.about || 'About System'}
            >
              <HelpCircle className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-[#1E293B] mx-1" />
            <LanguageSwitcher />
            <div className="h-6 w-px bg-[#1E293B] mx-1" />
            
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#0F172A] rounded-full border border-[#1E293B]">
              <div className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : serverStatus === 'offline' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-amber-500 animate-pulse'}`} />
              <span className="text-[10px] font-bold text-slate-400">
                {serverStatus === 'online' ? (t.server_online || 'Online') : 
                 serverStatus === 'offline' ? (t.server_offline || 'Offline') : 
                 (t.server_checking || '...')}
              </span>
            </div>

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
                        <div key={job.id} className="space-y-1">
                          <div
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
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setExpandedJobId(expandedJobId === job.id ? null : job.id); 
                                }}
                                className={`p-2 rounded-lg transition-colors ${expandedJobId === job.id ? 'bg-[#0EA5E9]/20 text-[#0EA5E9]' : 'text-slate-500 hover:text-[#0EA5E9] hover:bg-[#1E293B]'}`}
                                title={t.job_details || 'Job Details'}
                              >
                                <Info className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleExportPDF(job.id); }}
                                className="p-2 hover:bg-[#1E293B] rounded-lg text-slate-500 hover:text-[#0EA5E9] transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <ChevronRight className={`w-4 h-4 transition-all ${selectedJobId === job.id ? 'rotate-90 text-[#0EA5E9]' : 'text-slate-600 group-hover:translate-x-0.5'}`} />
                            </div>
                          </div>
                          
                          {/* Expanded Job Details */}
                          {expandedJobId === job.id && (
                            <div className="px-4 py-3 mx-2 mb-2 bg-[#020617]/50 rounded-xl border border-[#1E293B] animate-in slide-in-from-top-2 duration-200">
                              <h4 className="text-[11px] font-bold text-[#0EA5E9] uppercase tracking-wider mb-2 flex items-center gap-2">
                                <FileText className="w-3 h-3" />
                                {t.job_desc_title || 'Description'}
                              </h4>
                              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                                {job.description}
                              </p>
                              
                              <h4 className="text-[11px] font-bold text-[#0EA5E9] uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Target className="w-3 h-3" />
                                {t.requirements_title || 'Requirements'}
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {job.requirements?.map((req, idx) => (
                                  <span key={idx} className="text-[10px] bg-[#1E293B] text-slate-300 px-2 py-0.5 rounded-md border border-[#334155]/30">
                                    {req}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
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
                <div className="p-4 space-y-4 max-h-[700px] overflow-y-auto">
                  {filteredResults.length === 0 ? (
                    <div className="text-center text-slate-500 py-16 border border-dashed border-[#1E293B] rounded-xl">
                      {t.no_candidates || 'No candidates found'}
                    </div>
                  ) : (
                    filteredResults.map((res) => (
                      <div 
                        key={res.id} 
                        onClick={() => setSelectedCandidate(res)} 
                        className="bg-[#020617]/40 hover:bg-[#1E293B]/60 border border-[#1E293B]/50 hover:border-[#0EA5E9]/30 rounded-2xl p-5 cursor-pointer transition-all group relative overflow-hidden"
                      >
                        {/* Status Backdrop Glow */}
                        <div className={`absolute top-0 end-0 w-32 h-32 opacity-10 bg-gradient-to-br transition-opacity group-hover:opacity-20 ${getScoreColor(res.final_score || 0)} blur-3xl -translate-y-12 translate-x-12`} />
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <h3 className="font-bold text-lg text-slate-100 group-hover:text-white truncate">
                                {res.applications?.candidates?.name || 'Unknown'}
                              </h3>
                              {res.is_fresh_graduate && (
                                <span className="bg-[#0EA5E9]/20 text-[#0EA5E9] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-[#0EA5E9]/30 flex items-center gap-1">
                                  <GraduationCap className="w-3 h-3" />
                                  {t.fresh_grad_badge || 'Fresh Grad'}
                                </span>
                              )}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getRecBadge(res.recommendation)}`}>
                                {res.recommendation}
                              </span>
                            </div>
                            <p className="text-slate-400 text-sm flex items-center gap-2">
                              <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                              {res.applications?.jobs?.title || 'Unknown Job'}
                            </p>
                          </div>

                          <div className="flex items-center gap-6">
                            {/* Score Metrics */}
                            <div className="hidden sm:flex items-center gap-4 border-s border-[#1E293B] ps-6">
                              <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-500 mb-0.5 uppercase tracking-tighter">{t.skills || 'Skills'}</p>
                                <p className="text-sm font-black text-white">{res.skills_score}%</p>
                              </div>
                              {res.gpa_score && (
                                <div className="text-center">
                                  <p className="text-[10px] font-bold text-slate-500 mb-0.5 uppercase tracking-tighter">{t.gpa || 'GPA'}</p>
                                  <p className="text-sm font-black text-[#0EA5E9]">{res.gpa_score}%</p>
                                </div>
                              )}
                            </div>

                            {/* Final Circle Score */}
                            <div className="flex items-center justify-center relative">
                              <svg className="w-14 h-14 -rotate-90">
                                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-[#1E293B]" />
                                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" 
                                  strokeDasharray={2 * Math.PI * 24}
                                  strokeDashoffset={2 * Math.PI * 24 * (1 - (res.final_score || 0) / 100)}
                                  className={res.final_score >= 80 ? 'text-emerald-500' : res.final_score >= 60 ? 'text-amber-500' : 'text-red-500'} 
                                />
                              </svg>
                              <span className="absolute text-[13px] font-black text-white">{res.final_score}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Tags & Flags Ribbon */}
                        <div className="mt-4 pt-4 border-t border-[#1E293B]/50 flex flex-wrap items-center gap-2">
                          {(res.tags || []).map((tag, i) => (
                            <span key={i} className="flex items-center gap-1.5 bg-[#0F172A] text-slate-400 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[#1E293B] group-hover:border-[#1E293B] transition-colors">
                              <Tag className="w-3 h-3 text-[#0EA5E9]" />
                              {tag}
                            </span>
                          ))}
                          {(res.flags || []).map((flag, i) => (
                            <span key={i} className="flex items-center gap-1.5 bg-red-500/10 text-red-400 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-red-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              {flag}
                            </span>
                          ))}
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
        <div className="fixed inset-0 bg-[#020617]/80 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-300" onClick={() => setSelectedCandidate(null)}>
          <div className="bg-[#0F172A] rounded-[2.5rem] border border-[#1E293B] shadow-2xl shadow-blue-500/10 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="p-8 bg-[#0F172A] relative shrink-0 z-20 border-b border-[#1E293B]/30 rounded-t-[2.5rem] flex flex-col gap-6">
               <div className={`absolute top-0 end-0 w-64 h-64 opacity-20 bg-gradient-to-br ${getScoreColor(selectedCandidate.final_score)} blur-3xl -translate-y-32 translate-x-32 pointer-events-none`} />
               
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center bg-gradient-to-br shadow-xl ${getScoreColor(selectedCandidate.final_score)}`}>
                       <span className="text-3xl font-black text-white">{selectedCandidate.final_score}%</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white flex items-center gap-2">
                        {selectedCandidate.applications?.candidates?.name}
                        {selectedCandidate.is_fresh_graduate && (
                          <span className="bg-[#0EA5E9]/20 text-[#0EA5E9] text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-[#0EA5E9]/30">
                            {t.fresh_grad_badge || 'Fresh Grad'}
                          </span>
                        )}
                      </h2>
                      <p className="text-slate-400 font-medium flex items-center gap-2 mt-1">
                        <Briefcase className="w-4 h-4 text-[#0EA5E9]" />
                        {selectedCandidate.applications?.jobs?.title}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedCandidate(null)} className="p-3 bg-[#1E293B] hover:bg-[#334155] text-slate-400 hover:text-white rounded-2xl transition-all">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
               </div>

               {/* Tab Navigation */}
               <div className="flex items-center gap-1 bg-[#1E293B]/30 p-1.5 rounded-2xl border border-[#1E293B]/50 max-w-md relative z-10 w-full md:w-fit">
                 <button 
                   onClick={() => setModalTab('intelligence')}
                   className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${modalTab === 'intelligence' ? 'bg-[#0369A1] text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                   <Cpu className="w-3.5 h-3.5" />
                   {t.neural_intelligence || 'Neural Intelligence'}
                 </button>
                 <button 
                   onClick={() => setModalTab('overview')}
                   className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${modalTab === 'overview' ? 'bg-[#1E293B] text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                   <LayoutTemplate className="w-3.5 h-3.5" />
                   {t.overview || 'Overview'}
                 </button>
                 <button 
                   onClick={() => setModalTab('prep')}
                   className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${modalTab === 'prep' ? 'bg-[#7C3AED] text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                 >
                   <Target className="w-3.5 h-3.5" />
                   {t.strategic_prep || 'Strategic Prep'}
                 </button>
               </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 relative z-10 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              
              {modalTab === 'intelligence' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                  {/* Scores Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#1E293B]/20 border border-[#1E293B] p-5 rounded-3xl text-center group hover:border-[#0EA5E9]/30 transition-all relative">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="relative group/tooltip">
                          <Info className="w-3 h-3 text-slate-500" />
                          <div className="absolute bottom-full mb-2 right-0 w-48 p-2 bg-[#0F172A] border border-[#1E293B] rounded-lg text-[10px] text-slate-400 font-medium invisible group-hover/tooltip:visible z-30 shadow-xl">
                            {t.cultural_fit_desc || 'AI evaluation of professional values and communication alignment.'}
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 group-hover:text-[#0EA5E9]">{t.cultural_fit || 'Cultural Fit'}</p>
                      <div className="text-3xl font-black text-white">{selectedCandidate.cultural_fit_score || 0}%</div>
                    </div>
                    <div className="bg-[#1E293B]/20 border border-[#1E293B] p-5 rounded-3xl text-center group hover:border-[#F59E0B]/30 transition-all relative">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="relative group/tooltip">
                          <Info className="w-3 h-3 text-slate-500" />
                          <div className="absolute bottom-full mb-2 right-0 w-48 p-2 bg-[#0F172A] border border-[#1E293B] rounded-lg text-[10px] text-slate-400 font-medium invisible group-hover/tooltip:visible z-30 shadow-xl">
                            {t.project_impact_desc || 'Weighted score of academic projects and real-world implementation scale.'}
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 group-hover:text-[#F59E0B]">{t.project_impact || 'Project Impact'}</p>
                      <div className="text-3xl font-black text-white">{selectedCandidate.project_impact_score || 0}%</div>
                    </div>
                    <div className="bg-[#1E293B]/20 border border-[#1E293B] p-5 rounded-3xl text-center group hover:border-[#10B981]/30 transition-all">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 group-hover:text-[#10B981]">{t.skills_match || 'Skills Match'}</p>
                      <div className="text-3xl font-black text-white">{selectedCandidate.skills_score || 0}%</div>
                    </div>
                  </div>

                  {/* Career Trajectory */}
                  <div className="bg-[#0369A1]/5 border border-[#0369A1]/20 p-6 rounded-3xl">
                    <h3 className="text-[#0EA5E9] font-bold text-sm mb-3 flex items-center gap-2">
                       <TrendingUp className="w-4 h-4" />
                       {t.career_trajectory_title || 'Career Trajectory Prediction'}
                    </h3>
                    <p className="text-slate-300 text-sm italic leading-relaxed">
                      "{selectedCandidate.career_trajectory || 'Predicting future growth path...'}"
                    </p>
                  </div>

                  {/* Project Highlights (for grads) */}
                  {selectedCandidate.project_highlights && selectedCandidate.project_highlights.length > 0 && (
                    <div className="bg-[#020617]/30 border border-[#1E293B] p-6 rounded-3xl">
                      <h3 className="text-slate-200 font-bold text-sm mb-4 flex items-center gap-2">
                         <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                         {t.project_highlights_title || 'Academic & Research Highlights'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedCandidate.project_highlights.map((h, i) => (
                          <div key={i} className="flex items-start gap-3 bg-[#1E293B]/40 p-3 rounded-2xl border border-[#334155]/30">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#0EA5E9] mt-1.5 flex-shrink-0" />
                            <span className="text-xs text-slate-300">{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {modalTab === 'overview' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                  <div className="bg-[#1E293B]/20 border border-[#1E293B] p-6 rounded-3xl">
                    <h3 className="text-slate-200 font-black text-sm mb-4 flex items-center gap-2 uppercase tracking-widest">
                       <Zap className="w-4 h-4 text-[#0EA5E9]" />
                       {t.ai_analysis || 'AI Rational Analysis'}
                    </h3>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {selectedCandidate.justification}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-3xl">
                      <h3 className="text-emerald-400 font-bold text-sm mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {t.strengths || 'Key Strengths'}
                      </h3>
                      <ul className="space-y-2">
                        {selectedCandidate.strengths?.map((s, i) => (
                          <li key={i} className="text-xs text-emerald-100/70 py-1 border-b border-emerald-500/10 last:border-0">• {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-3xl">
                      <h3 className="text-red-400 font-bold text-sm mb-3 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        {t.improvement_areas || 'Weaknesses'}
                      </h3>
                      <ul className="space-y-2">
                        {selectedCandidate.weaknesses?.map((w, i) => (
                          <li key={i} className="text-xs text-red-100/70 py-1 border-b border-red-500/10 last:border-0">• {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'prep' && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                  {/* Interview Questions */}
                  <div className="bg-[#7C3AED]/5 border border-[#7C3AED]/20 p-6 rounded-3xl">
                    <h3 className="text-[#A78BFA] font-bold text-sm mb-4 flex items-center gap-2">
                       <MessageSquare className="w-4 h-4" />
                       {t.recommended_questions || 'Neural Interview Strategy'}
                    </h3>
                    <div className="space-y-3">
                      {(selectedCandidate.interview_questions || []).map((q, i) => (
                        <div key={i} className="bg-[#1E293B]/60 p-4 rounded-2xl border border-[#7C3AED]/10 text-xs text-slate-200 leading-relaxed shadow-sm">
                          {q}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Industry-Bridge Roadmap */}
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-3xl">
                    <h3 className="text-emerald-400 font-bold text-sm mb-4 flex items-center gap-2">
                       <ArrowUpRight className="w-4 h-4" />
                       {t.industry_roadmap || 'Industry-Bridge Roadmap'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(selectedCandidate.training_suggestions || []).map((tS, i) => (
                        <div key={i} className="flex items-center gap-3 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20">
                          <BookOpen className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs text-emerald-100/80 font-medium">{tS}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-8 pt-0 border-t border-[#1E293B] bg-[#0F172A] mt-auto shrink-0 z-20">
              <div className="flex justify-between items-center mt-6">
                     <div className="flex gap-2">
                    <button 
                       onClick={async () => {
                         // selectedCandidate.applications can be an object OR an array depending on Supabase join
                         const apps = selectedCandidate.applications;
                         const app = Array.isArray(apps) ? apps[0] : apps;
                         const cand = app?.candidates;
                         const candidateId = cand?.id;
                         
                         console.log('Download Debug:', { candidateId, userEmail, app, cand });
                         
                         if (!candidateId) {
                           alert('Error: Candidate ID not found. Check console.');
                           console.error('No candidate ID found. Structure:', selectedCandidate);
                           return;
                         }

                         setDownloadStatus(prev => ({ ...prev, [candidateId]: 'loading' }));
                         const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                         const downloadUrl = `${apiBase}/candidates/${candidateId}/cv-download`;
                         
                         try {
                           const res = await fetch(downloadUrl, {
                             headers: { 'x-user-email': userEmail }
                           });

                           if (res.ok) {
                             if (res.redirected) {
                               setDownloadStatus(prev => ({ ...prev, [candidateId]: 'success' }));
                               setTimeout(() => setDownloadStatus(prev => ({ ...prev, [candidateId]: 'idle' })), 3000);
                               window.open(res.url, '_blank');
                               return;
                             }

                             const blob = await res.blob();
                             const url = window.URL.createObjectURL(blob);
                             const a = document.createElement('a');
                             a.href = url;
                             const safeName = (cand?.name || 'CV').replace(/\s+/g, '_');
                             a.download = `CV_${safeName}.pdf`;
                             document.body.appendChild(a);
                             a.click();
                             window.URL.revokeObjectURL(url);
                             setDownloadStatus(prev => ({ ...prev, [candidateId]: 'success' }));
                             setTimeout(() => setDownloadStatus(prev => ({ ...prev, [candidateId]: 'idle' })), 3000);
                           } else {
                             const fallbackUrl = cand?.cv_url;
                             if (fallbackUrl) {
                               window.open(fallbackUrl, '_blank');
                               setDownloadStatus(prev => ({ ...prev, [candidateId]: 'success' }));
                               setTimeout(() => setDownloadStatus(prev => ({ ...prev, [candidateId]: 'idle' })), 3000);
                             } else {
                               alert('Download failed. No original CV available.');
                               setDownloadStatus(prev => ({ ...prev, [candidateId]: 'idle' }));
                             }
                           }
                         } catch (err) {
                           setDownloadStatus(prev => ({ ...prev, [candidateId]: 'idle' }));
                           alert('Connection error while downloading.');
                           const fallbackUrl = cand?.cv_url;
                           if (fallbackUrl) window.open(fallbackUrl, '_blank');
                         }
                       }} 
                      className="px-6 py-2.5 bg-[#1E293B] text-slate-200 hover:text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 min-w-[160px] justify-center"
                    >
                      {/* Using optional chaining and fallback for ID check to prevent crash if undefined */}
                      {downloadStatus[(Array.isArray(selectedCandidate.applications) ? selectedCandidate.applications[0] : selectedCandidate.applications)?.candidates?.id!] === 'loading' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : downloadStatus[(Array.isArray(selectedCandidate.applications) ? selectedCandidate.applications[0] : selectedCandidate.applications)?.candidates?.id!] === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      {downloadStatus[(Array.isArray(selectedCandidate.applications) ? selectedCandidate.applications[0] : selectedCandidate.applications)?.candidates?.id!] === 'loading' ? t.downloading : 
                       downloadStatus[(Array.isArray(selectedCandidate.applications) ? selectedCandidate.applications[0] : selectedCandidate.applications)?.candidates?.id!] === 'success' ? t.downloaded : 
                       t.view_cv || 'View Original CV'}
                    </button>
                  </div>
                 <button onClick={() => setSelectedCandidate(null)} className="px-8 py-2.5 bg-white text-black hover:bg-slate-200 rounded-xl text-sm font-black transition-all">
                   {t.close || 'Done'}
                 </button>
              </div>
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
            <form onSubmit={handleUploadCV} className="space-y-6 pt-4">
              <div className="relative group">
                <input 
                  type="file" 
                  id="cv-upload"
                  required 
                  onChange={e => setCvFile(e.target.files?.[0] || null)} 
                  className="hidden" 
                />
                <label 
                  htmlFor="cv-upload"
                  className="w-full flex flex-col items-center gap-4 bg-[#020617] border-2 border-dashed border-[#1E293B] hover:border-[#7C3AED]/40 p-8 rounded-3xl cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-[#7C3AED]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-[#7C3AED]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-200 mb-1">
                      {cvFile ? cvFile.name : (t.choose_file || 'Choose File')}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {cvFile ? `${(cvFile.size / 1024 / 1024).toFixed(2)} MB` : (t.file_no_chosen || 'No file chosen')}
                    </p>
                  </div>
                </label>
              </div>
              <button 
                type="submit" 
                disabled={isUploading || !cvFile} 
                className="w-full py-3.5 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white rounded-2xl font-black text-sm shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {isUploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.analyzing}
                  </div>
                ) : (
                  t.upload_and_analyze
                )}
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

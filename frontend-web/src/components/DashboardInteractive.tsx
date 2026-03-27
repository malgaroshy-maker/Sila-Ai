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
import OnboardingModal from './OnboardingModal';
import { Trash2 } from 'lucide-react';
import QuotaMonitor from './QuotaMonitor';
import { parseAiError } from '../lib/ai-errors';

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string[];
}

interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  pipeline_stage: string;
  status: 'pending' | 'analyzed' | 'failed' | 'rejected';
  ai_error?: string;
  created_at: string;
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
  analysis_results?: {
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
  };
}

interface DashboardProps {
  initialJobs: Job[];
  initialResults: Application[];
  t: Record<string, string>;
  locale: string;
}

export default function DashboardInteractive({ initialJobs, initialResults, t, locale }: DashboardProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs || []);
  const [results, setResults] = useState<Application[]>(initialResults || []);
  const [userEmail, setUserEmail] = useState('');
  const [view, setView] = useState<'list' | 'kanban' | 'insights'>('list');
  
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Application | null>(null);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isDeletingJobId, setIsDeletingJobId] = useState<string | null>(null);
  const [isDeletingCandId, setIsDeletingCandId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [analyzingTask, setAnalyzingTask] = useState<string | null>(null);

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
    setAiError(null);
    setResults((prev) => prev.map((r) => 
      r.id === applicationId 
        ? { ...r, pipeline_stage: newStage }
        : r
    ));
    try {
      const res = await fetch(`${API_URL}/candidates/applications/${applicationId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
        body: JSON.stringify({ stage: newStage })
      });
      if (!res.ok) {
        const errData = await res.json();
        setAiError(parseAiError(errData, t));
        loadData(userEmail);
      }
    } catch (e) {
      setAiError(parseAiError(e, t));
      loadData(userEmail);
    }
  };

  const loadData = async (email: string) => {
    const { data: jobsData } = await supabase.from('jobs').select('*').eq('user_email', email).order('created_at', { ascending: false });
    
    const { data: appsData } = await supabase
      .from('applications')
      .select('*, jobs!inner(*), candidates(*), analysis_results(*)')
      .eq('jobs.user_email', email)
      .order('created_at', { ascending: false });
      
    if (jobsData) setJobs(jobsData as Job[]);
    if (appsData) {
      setResults(appsData as unknown as Application[]);
    }
  };

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) setServerStatus('online');
        else setServerStatus('offline');
      } catch {
        setServerStatus('offline');
      }
    };
    checkServerStatus();
    
    // Check if onboarding is needed
    const hasSeenOnboarding = localStorage.getItem('aris_onboarding_seen');
    if (!hasSeenOnboarding) {
      // Small delay for better UX
      setTimeout(() => setIsOnboardingOpen(true), 1500);
    }

    const interval = setInterval(checkServerStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [userEmail]);

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
        const errData = await res.json();
        setAiError(parseAiError(errData, t));
      }
    } catch (e) {
      setAiError(parseAiError(e, t));
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
        const errData = await res.json();
        setAiError(parseAiError(errData, t));
      }
    } catch (e) {
      setAiError(parseAiError(e, t));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRefreshSync = async () => {
    if (!userEmail) return;
    setIsRefreshing(true);
    setAiError(null);
    try {
      const res = await fetch(`${API_URL}/email/sync`, { 
        method: 'POST',
        headers: { 'x-user-email': userEmail }
      });
      if (!res.ok) {
        const errData = await res.json();
        setAiError(parseAiError(errData, t));
      }
      await loadData(userEmail);
    } catch (e) {
      setAiError(parseAiError(e, t));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm(t.delete_confirm_job || 'Are you sure you want to delete this job?')) return;
    
    setIsDeletingJobId(jobId);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'x-user-email': userEmail }
      });
      
      if (res.ok) {
        setJobs(jobs.filter(j => j.id !== jobId));
        setResults(results.filter(r => r.job_id !== jobId));
        if (selectedJobId === jobId) setSelectedJobId(null);
        if (expandedJobId === jobId) setExpandedJobId(null);
      }
    } catch (e) {
      console.error('Delete job failed', e);
    } finally {
      setIsDeletingJobId(null);
    }
  };

  const handleDeleteCandidate = async (candidateId: string, name: string) => {
    if (!confirm(`${t.delete_confirm_candidate || 'Are you sure you want to delete candidate'} ${name}?`)) return;
    
    setIsDeletingCandId(candidateId);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/candidates/${candidateId}`, {
        method: 'DELETE',
        headers: { 'x-user-email': userEmail }
      });
      
      if (res.ok) {
        setResults(results.filter(r => r.candidate_id !== candidateId));
        if (selectedCandidate?.candidate_id === candidateId) {
          setSelectedCandidate(null);
        }
      }
    } catch (e) {
      console.error('Delete candidate failed', e);
    } finally {
      setIsDeletingCandId(null);
    }
  };

  const filteredResults = results
    .filter((r) => {
      const matchJob = !selectedJobId || r.job_id === selectedJobId;
      const matchSearch = !searchTerm || 
        r.candidates?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.candidates?.email?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchJob && matchSearch;
    })
    .sort((a, b) => (b.analysis_results?.final_score || 0) - (a.analysis_results?.final_score || 0));

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-green-500 text-white';
    if (score >= 60) return 'from-amber-400 to-yellow-500 text-slate-900';
    return score > 0 ? 'from-red-500 to-rose-500 text-white' : 'from-slate-700 to-slate-800 text-slate-400';
  };

  const getRecBadge = (rec?: string) => {
    if (rec === 'Strong') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (rec === 'Average') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (rec === 'Weak') return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const handleRetryAnalysis = async (appId: string) => {
    if (!userEmail) return;
    setAiError(null);
    setAnalyzingTask(appId);
    try {
      const res = await fetch(`${API_URL}/candidates/applications/${appId}/analyze`, {
        method: 'POST',
        headers: { 'x-user-email': userEmail }
      });
      if (!res.ok) {
        const errData = await res.json();
        setAiError(parseAiError(errData, t));
      }
      await loadData(userEmail);
    } catch (e) {
      setAiError(parseAiError(e, t));
    } finally {
      setAnalyzingTask(null);
    }
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
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-[#0EA5E9]/30">
      <OnboardingModal 
        isOpen={isOnboardingOpen} 
        onClose={() => {
          setIsOnboardingOpen(false);
          localStorage.setItem('aris_onboarding_seen', 'true');
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        t={t}
      />

      {/* Premium Header */}
      <header className="bg-[#0F172A]/80 backdrop-blur-xl border-b border-[#1E293B] sticky top-0 z-40 transition-all duration-300 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-6">
          {/* Top Row: Brand & Status */}
          <div className="flex justify-between items-center py-4 border-b border-[#1E293B]/50">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-[#0369A1] to-[#0EA5E9] p-2 rounded-xl shadow-lg shadow-[#0EA5E9]/20">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100">
                  {t.title || 'AI Recruitment Intelligence'}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'online' ? 'bg-emerald-500 animate-pulse' : serverStatus === 'offline' ? 'bg-rose-500' : 'bg-amber-500 animate-bounce'}`} />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                    {serverStatus === 'online' ? (t.server_online || 'Online') : 
                     serverStatus === 'offline' ? (t.server_offline || 'Offline') : 
                     (t.server_checking || '...')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Consumption Indicators */}
              <div className="hidden lg:flex items-center gap-6 me-4">
                <QuotaMonitor userEmail={userEmail} t={t} />
              </div>

              <div className="h-8 w-px bg-[#1E293B] mx-2 hidden sm:block" />
              
              <Link
                href="/about?from=dashboard"
                className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-[#1E293B] rounded-xl transition-all duration-200 border border-transparent hover:border-[#1E293B]"
                title={t.about || 'About System'}
              >
                <Info className="w-5 h-5" />
              </Link>

              <LanguageSwitcher />

              <button 
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-[#1E293B] rounded-xl transition-all duration-200 border border-transparent hover:border-[#1E293B]"
                title={t.settings || 'Settings'}
              >
                <Settings className="w-5 h-5" />
              </button>

              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  localStorage.removeItem('user_email');
                  window.location.href = `/${locale}/login`;
                }} 
                className="p-2 text-slate-500 hover:text-rose-400 transition-all duration-200"
                title={t.logout || 'Logout'}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bottom Row: Actions & Navigation */}
          <div className="flex flex-col md:flex-row justify-between items-center py-3 gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
              <div className="relative group flex-1 md:flex-none">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#0EA5E9] transition-colors" />
                <input 
                  autoComplete="new-password" 
                  spellCheck="false" 
                  name="candidate_search_random_str"
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.searching || 'Search candidates...'} 
                  className="bg-[#020617]/50 border border-[#1E293B] rounded-xl ps-10 pe-4 py-2 text-sm w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all"
                />
              </div>
              
              <select 
                onChange={(e) => setSelectedJobId(e.target.value)}
                value={selectedJobId || ''}
                className="bg-[#020617]/50 border border-[#1E293B] rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9] transition-all cursor-pointer min-w-[140px] max-w-[180px] md:max-w-[220px] truncate"
              >
                <option value="">{t.all_jobs || 'All Jobs'}</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id} title={job.title}>{job.title}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
               <button 
                onClick={handleRefreshSync} 
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-[#0EA5E9] border border-[#1E293B] rounded-xl text-sm font-bold transition-all disabled:opacity-50 active:scale-95 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? (t.syncing || 'Syncing...') : (t.refresh || 'Sync')}</span>
              </button>

              <button 
                onClick={() => setView('insights')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-sm ${view === 'insights' ? 'bg-[#0369A1] text-white shadow-[#0369A1]/30 border-transparent' : 'bg-[#0F172A] text-slate-300 border border-[#1E293B] hover:bg-[#1E293B]'}`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>{t.insights || 'Insights'}</span>
              </button>

              <div className="w-px h-6 bg-[#1E293B] mx-1 hidden lg:block" />

              <button 
                onClick={() => { setAiError(null); setIsJobModalOpen(true); }} 
                className="flex items-center gap-2 bg-[#0369A1] hover:bg-[#0EA5E9] text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-[#0369A1]/20 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{t.create_job || 'New Job'}</span>
              </button>

              <button 
                onClick={() => { setAiError(null); setIsUploadModalOpen(true); }} 
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20 whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                <span>{t.upload_cv || 'Upload CV'}</span>
              </button>

              <button 
                onClick={() => setIsChatOpen(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/20 whitespace-nowrap"
              >
                <Bot className="w-4 h-4" />
                <span>{t.ai_chat || 'AI Chat'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {aiError && !isJobModalOpen && !isUploadModalOpen && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center justify-between group animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <p className="text-sm font-medium text-rose-400">{aiError}</p>
            </div>
            <button onClick={() => setAiError(null)} className="p-1 hover:bg-rose-500/20 rounded-lg transition-colors">
              <X className="w-4 h-4 text-rose-500" />
            </button>
          </div>
        </div>
      )}

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
                                {results.filter((r) => r.job_id === job.id).length} {t.candidates || 'Candidates'}
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
                                title={t.export_pdf || 'Export PDF'}
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}
                                disabled={isDeletingJobId === job.id}
                                className="p-2 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-500 transition-colors disabled:opacity-50"
                                title={t.delete || 'Delete'}
                              >
                                {isDeletingJobId === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
                        className="bg-[#0F172A]/40 backdrop-blur-md hover:bg-[#1E293B]/60 border border-white/5 hover:border-white/10 shadow-inner rounded-[2rem] p-6 cursor-pointer transition-all duration-300 group relative overflow-hidden active:scale-[0.99]"
                      >
                        {/* Status Backdrop Glow */}
                        <div className={`absolute top-0 end-0 w-48 h-48 opacity-10 bg-gradient-to-br transition-opacity duration-500 group-hover:opacity-30 ${getScoreColor(res.analysis_results?.final_score || 0)} blur-[60px] -translate-y-12 translate-x-12`} />
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-black text-xl text-white tracking-tight truncate drop-shadow-sm">
                                {res.candidates?.name || 'Unknown'}
                              </h3>
                              {res.status === 'failed' && (
                                <span className="bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-rose-500/20 flex items-center gap-1 shadow-inner" title={res.ai_error}>
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  {t.failed || 'Failed'}
                                </span>
                              )}
                              {res.status === 'pending' && (
                                <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-indigo-500/20 flex items-center gap-1 shadow-inner">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  {t.pending || 'Processing'}
                                </span>
                              )}
                              {res.analysis_results?.is_fresh_graduate && (
                                <span className="bg-[#0EA5E9]/10 text-[#0EA5E9] text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[#0EA5E9]/20 flex items-center gap-1 shadow-inner">
                                  <GraduationCap className="w-3.5 h-3.5" />
                                  {t.fresh_grad_badge || 'Fresh Grad'}
                                </span>
                              )}
                              {res.status === 'analyzed' && (
                                <span className={`text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-lg border shadow-inner ${getRecBadge(res.analysis_results?.recommendation)}`}>
                                  {res.analysis_results?.recommendation}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-3">
                              <p className="text-slate-400 text-sm font-medium flex items-center gap-2 group-hover:text-slate-300 transition-colors">
                                <Mail className="w-4 h-4 text-slate-500" />
                                {res.candidates?.email || 'No email'}
                              </p>
                              <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-700" />
                              <p className="text-slate-400 text-sm font-medium flex items-center gap-2 group-hover:text-slate-300 transition-colors">
                                <Briefcase className="w-4 h-4 text-slate-500" />
                                {res.jobs?.title || 'Unknown Job'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="relative flex items-center justify-center w-20 h-20 group-hover:scale-105 transition-transform duration-500">
                              <svg className="w-full h-full -rotate-90 drop-shadow-xl">
                                <circle
                                  cx="40" cy="40" r="36"
                                  fill="transparent"
                                  stroke="currentColor"
                                  strokeWidth="6"
                                  className="text-white/5"
                                />
                                <circle
                                  cx="40" cy="40" r="36"
                                  fill="transparent"
                                  stroke="currentColor"
                                  strokeWidth="6"
                                  strokeDasharray={226.2}
                                  strokeDashoffset={226.2 - (226.2 * (res.analysis_results?.final_score || 0)) / 100}
                                  strokeLinecap="round"
                                  className={`transition-all duration-1000 ease-out ${res.analysis_results?.final_score && res.analysis_results.final_score >= 80 ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]' : res.analysis_results?.final_score && res.analysis_results.final_score >= 60 ? 'text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]' : 'text-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.5)]'}`}
                                />
                              </svg>
                              <span className="absolute text-xl font-black text-white drop-shadow-md">{res.analysis_results?.final_score || 0}<span className="text-xs text-slate-400 font-bold">%</span></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mt-6 pt-6 border-t border-white/5 relative z-10">
                          <div className="flex items-center gap-8">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t.skills || 'Skills Match'}</span>
                              <div className="text-xl font-black text-white">{res.analysis_results?.skills_score || 0}%</div>
                            </div>
                            <div className="w-px h-10 bg-white/10" />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t.project_impact || 'Impact'}</span>
                              <div className="text-xl font-black text-white">{res.analysis_results?.project_impact_score || 0}%</div>
                            </div>
                            <div className="w-px h-10 bg-white/10 hidden sm:block" />
                            <div className="flex flex-col hidden sm:flex">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t.cultural_fit || 'Cultural Fit'}</span>
                              <div className="text-xl font-black text-white">{res.analysis_results?.cultural_fit_score || 0}%</div>
                            </div>
                          </div>

                          <div className="flex-1" />

                          <div className="flex items-center gap-3 w-full md:w-auto">
                            {(res.status === 'failed' || res.status === 'pending') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRetryAnalysis(res.id); }}
                                disabled={analyzingTask === res.id}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-inner active:scale-95"
                              >
                                {analyzingTask === res.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                {t.retry_analysis || 'Retry'}
                              </button>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteCandidate(res.candidates.id, res.candidates.name); }}
                              disabled={isDeletingCandId === res.candidates.id}
                              className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl transition-all disabled:opacity-50 shadow-inner active:scale-95"
                              title={t.delete || 'Delete'}
                            >
                              {isDeletingCandId === res.candidates.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] active:scale-95">
                              {t.view_details || 'View Details'}
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Tags & Flags Ribbon */}
                        <div className="flex flex-wrap gap-2 mt-4 relative z-10">
                          {res.analysis_results?.flags?.map((flag: string, i: number) => (
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
                <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                  <KanbanBoard 
                    results={filteredResults} 
                    onStageChange={handleStageChange}
                    onDelete={handleDeleteCandidate}
                    t={t}
                    locale={locale}
                  />
                </div>
              ) : (
                <AiInsights userEmail={userEmail} t={t} onClose={() => setView('list')} />
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
               <div className={`absolute top-0 end-0 w-64 h-64 opacity-20 bg-gradient-to-br ${getScoreColor(selectedCandidate.analysis_results?.final_score || 0)} blur-3xl -translate-y-32 translate-x-32 pointer-events-none`} />
               
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-5">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center bg-gradient-to-br shadow-xl ${getScoreColor(selectedCandidate.analysis_results?.final_score || 0)}`}>
                       <span className="text-3xl font-black text-white">{selectedCandidate.analysis_results?.final_score || 0}%</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white flex items-center gap-2">
                        {selectedCandidate.candidates?.name}
                        {selectedCandidate.analysis_results?.is_fresh_graduate && (
                          <span className="bg-[#0EA5E9]/20 text-[#0EA5E9] text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-[#0EA5E9]/30">
                            {t.fresh_grad_badge || 'Fresh Grad'}
                          </span>
                        )}
                      </h2>
                      <p className="text-slate-400 font-medium flex items-center gap-2 mt-1">
                        <Briefcase className="w-4 h-4 text-[#0EA5E9]" />
                        {selectedCandidate.jobs?.title}
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
            <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 relative z-10 no-scrollbar">
              
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
                      <div className="text-3xl font-black text-white">{selectedCandidate.analysis_results?.cultural_fit_score || 0}%</div>
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
                      <div className="text-3xl font-black text-white">{selectedCandidate.analysis_results?.project_impact_score || 0}%</div>
                    </div>
                    <div className="bg-[#10B981]/5 border border-[#10B981]/20 p-5 rounded-3xl text-center group hover:border-[#10B981]/30 transition-all">
                      <p className="text-[10px) font-black text-slate-500 uppercase tracking-widest mb-2 group-hover:text-[#10B981]">{t.skills_match || 'Skills Match'}</p>
                      <div className="text-3xl font-black text-white">{selectedCandidate.analysis_results?.skills_score || 0}%</div>
                    </div>
                    {selectedCandidate.analysis_results?.is_fresh_graduate && (
                      <div className="bg-purple-500/5 border border-purple-500/20 p-5 rounded-3xl text-center group hover:border-purple-500/30 transition-all">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 group-hover:text-purple-400">{t.gpa || 'GPA'}</p>
                        <div className="text-3xl font-black text-white">{selectedCandidate.analysis_results?.gpa_score || 0}%</div>
                      </div>
                    )}
                  </div>

                  {/* Career Trajectory */}
                  <div className="bg-[#0369A1]/5 border border-[#0369A1]/20 p-6 rounded-3xl">
                    <h3 className="text-[#0EA5E9] font-bold text-sm mb-3 flex items-center gap-2">
                       <TrendingUp className="w-4 h-4" />
                       {t.career_trajectory_title || 'Career Trajectory Prediction'}
                    </h3>
                    <p className="text-slate-300 text-sm italic leading-relaxed">
                      "{selectedCandidate.analysis_results?.career_trajectory || 'Predicting future growth path...'}"
                    </p>
                  </div>

                  {/* Project Highlights (for grads) */}
                  {selectedCandidate.analysis_results?.project_highlights && selectedCandidate.analysis_results.project_highlights.length > 0 && (
                    <div className="bg-[#020617]/30 border border-[#1E293B] p-6 rounded-3xl">
                      <h3 className="text-slate-200 font-bold text-sm mb-4 flex items-center gap-2">
                         <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                         {t.project_highlights_title || 'Academic & Research Highlights'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedCandidate.analysis_results.project_highlights.map((h: string, i: number) => (
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
                      {selectedCandidate.analysis_results?.justification}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-3xl">
                      <h3 className="text-emerald-400 font-bold text-sm mb-3 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {t.strengths || 'Key Strengths'}
                      </h3>
                      <ul className="space-y-2">
                        {selectedCandidate.analysis_results?.strengths?.map((s: string, i: number) => (
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
                        {selectedCandidate.analysis_results?.weaknesses?.map((w: string, i: number) => (
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
                      {(selectedCandidate.analysis_results?.interview_questions || []).map((q: string, i: number) => (
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
                      {(selectedCandidate.analysis_results?.training_suggestions || []).map((tS: string, i: number) => (
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
                         const candidateId = selectedCandidate.candidates?.id;
                         const cvUrl = selectedCandidate.candidates?.cv_url;
                         const candidateName = selectedCandidate.candidates?.name;
                         
                         if (!candidateId) {
                           alert('Error: Candidate ID not found.');
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
                             const safeName = (candidateName || 'CV').replace(/\s+/g, '_');
                             a.download = `CV_${safeName}.pdf`;
                             document.body.appendChild(a);
                             a.click();
                             window.URL.revokeObjectURL(url);
                             setDownloadStatus(prev => ({ ...prev, [candidateId]: 'success' }));
                             setTimeout(() => setDownloadStatus(prev => ({ ...prev, [candidateId]: 'idle' })), 3000);
                           } else {
                             if (cvUrl) {
                               window.open(cvUrl, '_blank');
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
                           if (cvUrl) window.open(cvUrl, '_blank');
                         }
                       }} 
                      className="px-6 py-2.5 bg-[#1E293B] text-slate-200 hover:text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 min-w-[160px] justify-center"
                    >
                      {downloadStatus[selectedCandidate.candidates?.id!] === 'loading' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : downloadStatus[selectedCandidate.candidates?.id!] === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      {downloadStatus[selectedCandidate.candidates?.id!] === 'loading' ? t.downloading : 
                       downloadStatus[selectedCandidate.candidates?.id!] === 'success' ? t.downloaded : 
                       t.view_cv || 'View Original CV'}
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => handleDeleteCandidate(
                        selectedCandidate.candidates?.id!, 
                        selectedCandidate.candidates?.name!
                      )}
                      className="px-6 py-2.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t.delete_candidate || 'Delete'}
                    </button>
                    <button onClick={() => setSelectedCandidate(null)} className="px-8 py-2.5 bg-white text-black hover:bg-slate-200 rounded-xl text-sm font-black transition-all">
                      {t.close || 'Done'}
                    </button>
                  </div>
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

            {aiError && (
              <div className="mb-5 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-rose-400">{aiError}</p>
              </div>
            )}
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
            
            {aiError && (
              <div className="mt-4 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                <p className="text-xs font-medium text-rose-400">{aiError}</p>
              </div>
            )}
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

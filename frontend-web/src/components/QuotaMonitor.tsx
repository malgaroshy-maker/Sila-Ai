'use client';

import { useState, useEffect } from 'react';
import { Zap, FileText, AlertCircle, RefreshCw, BarChart3 } from 'lucide-react';

interface QuotaStats {
  logs: any[];
  summary: {
    total_input: number;
    total_output: number;
    total_cost: number;
  };
  requests_used_for_model: number;
  model_id: string;
  model_display_name: string;
  is_live?: boolean;
  is_blocked?: boolean;
  approx_quota: {
    rpm_limit: number;
    tpm_limit: number;
    daily_limit: number;
    remaining_live?: number;
    reset_at?: string;
  };
}

export default function QuotaMonitor({ userEmail, t }: { userEmail: string; userStats?: any; t: any }) {
  const [stats, setStats] = useState<QuotaStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchStats = async () => {
    if (!userEmail) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/ai/usage`, {
        headers: { 'x-user-email': userEmail }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch quota stats', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Listen for manual refreshes (from SettingsModal)
    const handleRefresh = () => fetchStats();
    window.addEventListener('refresh-quota', handleRefresh);
    
    const interval = setInterval(fetchStats, 30000); // refresh every 30s
    return () => {
      clearInterval(interval);
      window.removeEventListener('refresh-quota', handleRefresh);
    };
  }, [userEmail]);

  if (!stats) return null;

  const totalTokens = stats.summary.total_input + stats.summary.total_output;
  const requestsUsedLocal = stats.requests_used_for_model;
  
  // Use Live remaining if available, else local estimate
  const remainingDaily = stats.approx_quota.remaining_live !== undefined 
    ? stats.approx_quota.remaining_live 
    : Math.max(0, stats.approx_quota.daily_limit - requestsUsedLocal);

  const dailyUsagePercent = Math.min(100, (1 - (remainingDaily / stats.approx_quota.daily_limit)) * 100);

  return (
    <div className="flex items-center gap-6">
      {/* Token Usage */}
      <div className="flex flex-col items-end">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{t.tokens_used || 'Tokens Used'}</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Zap className={`w-3 h-3 ${totalTokens > 500000 ? 'text-amber-500' : 'text-[#0EA5E9]'} fill-current opacity-20`} />
          <span className="text-xs font-mono font-bold text-slate-300">
            {totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens}
          </span>
        </div>
      </div>

      <div className="w-px h-8 bg-[#1E293B]" />

      {/* Quota Pressure / API Health */}
      <div className="flex flex-col items-end group relative cursor-help">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight flex items-center gap-1">
          {stats.is_blocked ? (
            <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-2.5 h-2.5" /> EXHAUSTED</span>
          ) : (
            <>Remaining Quota {stats.is_live && <span className="text-[8px] px-1 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20">LIVE</span>}</>
          )}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-16 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${stats.is_blocked ? 'bg-red-500' : dailyUsagePercent > 80 ? 'bg-red-500' : dailyUsagePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${100 - dailyUsagePercent}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold ${stats.is_blocked ? 'text-red-400' : 'text-slate-400'}`}>
            {remainingDaily} / {stats.approx_quota.daily_limit}
          </span>
        </div>

        {/* Hover Tooltip */}
        <div className="absolute top-full right-0 mt-2 w-52 bg-[#0F172A] border border-[#1E293B] rounded-xl p-3 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
          <h4 className="text-[10px] font-bold text-[#0EA5E9] uppercase tracking-wider mb-2 flex items-center gap-2">
            <BarChart3 className="w-3 h-3" />
            {stats.model_display_name}
          </h4>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">Daily Remaining</span>
              <span className="text-slate-200 font-mono">{remainingDaily} reqs</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">RPM Limit</span>
              <span className="text-slate-200 font-mono">{stats.approx_quota.rpm_limit}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">Daily Limit</span>
              <span className="text-slate-200 font-mono">{stats.approx_quota.daily_limit}</span>
            </div>
          </div>
          <p className="text-[9px] text-slate-500 mt-2 leading-tight">
            Limits are estimated based on Gemini Free Tier. Pro models have different limits.
          </p>
        </div>
      </div>
    </div>
  );
}

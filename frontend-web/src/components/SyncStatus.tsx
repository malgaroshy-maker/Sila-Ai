'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, AlertCircle, CheckCircle2, StopCircle } from 'lucide-react';

interface SyncStatusProps {
  userEmail: string;
  onComplete?: () => void;
}

export function SyncStatus({ userEmail, onComplete }: SyncStatusProps) {
  const t = useTranslations('Index');
  const [progress, setProgress] = useState<{
    status: string;
    total: number;
    processed: number;
    message: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!userEmail) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    // Use userEmail for the SSE stream
    const eventSource = new EventSource(`${apiUrl}/email/sync/progress/${encodeURIComponent(userEmail)}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);
        
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
           // Auto-hide after 5 seconds on terminal state
           setTimeout(() => {
              if (onComplete) onComplete();
              setProgress(null);
           }, 5000);
        }
      } catch (err) {
        console.error('SSE Parse Error:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Connection Error:', err);
      // Remove eventSource.close() to allow native browser auto-reconnect on network drop
    };

    return () => eventSource.close();
  }, [userEmail, onComplete]);

  const stopSync = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    try {
      await fetch(`${apiUrl}/email/sync/stop`, {
        method: 'POST',
        headers: { 'x-user-email': userEmail }
      });
    } catch (err) {
      console.error('Stop Sync Error:', err);
    }
  };

  if (!progress) return null;

  const percentage = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;
  
  const getStatusIcon = () => {
    switch (progress.status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'failed': return <AlertCircle className="w-5 h-5 text-rose-400" />;
      case 'stopped': return <StopCircle className="w-5 h-5 text-amber-500" />;
      default: return <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />;
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'scanning': return t('sync_reading');
      case 'analyzing': return t('sync_analyzing');
      case 'completed': return t('sync_completed');
      case 'failed': return t('sync_failed');
      case 'stopped': return t('sync_stopped');
      default: return progress.message;
    }
  };

  return (
    <div className="fixed bottom-6 end-6 z-[100] w-80 bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-5 animate-in slide-in-from-bottom-8 fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 rounded-xl border border-white/5 shadow-inner">
            {getStatusIcon()}
          </div>
          <span className="font-bold text-sm text-white tracking-wide truncate max-w-[160px]">{getStatusText()}</span>
        </div>
        {progress.status !== 'completed' && progress.status !== 'failed' && progress.status !== 'stopped' && (
          <button 
            onClick={stopSync} 
            className="p-1.5 hover:bg-rose-500/20 rounded-full text-slate-500 hover:text-rose-400 transition-colors group"
            title={t('sync_stop')}
          >
            <StopCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
          <div 
            className={`h-full transition-all duration-700 ease-out shadow-[0_0_10px_currentColor] ${
              progress.status === 'failed' ? 'bg-rose-500 text-rose-500' : 
              progress.status === 'completed' ? 'bg-emerald-400 text-emerald-400' : 'bg-indigo-500 text-indigo-500'
            }`}
            style={{ width: `${Math.max(percentage, 5)}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">
            {progress.processed} / {progress.total} {t('processed') || 'PROCESSED'}
          </span>
          <span className={`text-[10px] font-black ${
            progress.status === 'failed' ? 'text-rose-400' : 
            progress.status === 'completed' ? 'text-emerald-400' : 'text-indigo-400'
          }`}>
            {percentage.toFixed(0)}%
          </span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium truncate">
          {progress.message}
        </p>
      </div>
    </div>
  );
}

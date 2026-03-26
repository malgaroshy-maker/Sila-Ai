'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Loader2, TrendingUp, Cpu, DollarSign, Activity, X } from 'lucide-react';

interface AiUsageLog {
  created_at: string;
  total_tokens: number;
  est_cost: string;
  operation: string;
}

interface Application {
  id: string;
  status: string;
  candidates: {
    id: string;
    name: string;
  };
  jobs?: {
    title: string;
  };
  analysis_results?: {
    final_score: number;
    recommendation: string;
  };
}

export default function AiInsights({ 
  userEmail, 
  t,
  results = [],
  onClose,
  onDeleteCandidate
}: { 
  userEmail: string, 
  t: Record<string, string>,
  results?: Application[],
  onClose?: () => void,
  onDeleteCandidate?: (id: string, name: string) => Promise<void>
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AiUsageLog[]>([]);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    if (userEmail) {
      fetchUsage();
    }
  }, [userEmail]);

  const fetchUsage = async () => {
    try {
      const res = await fetch(`${API_URL}/ai/usage`, {
        headers: { 'x-user-email': userEmail }
      });
      const json = await res.json();
      setData(json.data || []);
    } catch (e) {
      console.error('Failed to fetch usage', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#0EA5E9] animate-spin mb-4" />
        <p className="text-slate-400">{t.loading || 'Loading insights...'}</p>
      </div>
    );
  }

  // Process data for charts
  const dailyData: Record<string, { date: string; tokens: number; cost: number }> = {};
  const opData: Record<string, { name: string; value: number }> = {};
  let totalCost = 0;
  let totalTokens = 0;

  const opNames: Record<string, string> = {
    'analysis': t.op_analysis || 'CV Analysis',
    'info_extraction': t.op_info_extraction || 'Data Extraction',
    'ocr': t.op_ocr || 'Image OCR',
    'job_generation': t.op_job_generation || 'Job Generation',
    'embedding': t.op_embedding || 'Vector Embedding'
  };

  data.forEach(log => {
    const date = new Date(log.created_at).toLocaleDateString();
    dailyData[date] = dailyData[date] || { date, tokens: 0, cost: 0 };
    dailyData[date].tokens += log.total_tokens;
    dailyData[date].cost += parseFloat(log.est_cost);

    const translatedOp = opNames[log.operation] || log.operation;
    opData[translatedOp] = opData[translatedOp] || { name: translatedOp, value: 0 };
    opData[translatedOp].value += parseFloat(log.est_cost);

    totalCost += parseFloat(log.est_cost);
    totalTokens += log.total_tokens;
  });

  const dailyChartData = Object.values(dailyData);
  const opChartData = Object.values(opData);
  const COLORS = ['#0EA5E9', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444'];

  // Only rank analyzed candidates
  const analyzedResults = results
    .filter(r => r.status === 'analyzed' && r.analysis_results)
    .sort((a, b) => (b.analysis_results?.final_score || 0) - (a.analysis_results?.final_score || 0));

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500 relative">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#0EA5E9]" />
          {t.ai_insights_title || 'AI Insights & Usage'}
        </h2>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#1E293B] rounded-xl transition-all duration-200 border border-[#1E293B]"
            title={t.close || 'Close'}
          >
            <X className="w-5 h-5" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#020617] p-6 rounded-2xl border border-[#1E293B] flex items-center gap-4">
          <div className="bg-[#0EA5E9]/20 p-3 rounded-xl text-[#0EA5E9]">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">{t.total_monthly_cost || 'Total Monthly Cost'}</p>
            <p className="text-2xl font-bold text-white">${totalCost.toFixed(4)}</p>
          </div>
        </div>
        <div className="bg-[#020617] p-6 rounded-2xl border border-[#1E293B] flex items-center gap-4">
          <div className="bg-[#7C3AED]/20 p-3 rounded-xl text-[#7C3AED]">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">{t.total_tokens || 'Total Tokens'}</p>
            <p className="text-2xl font-bold text-white">{totalTokens.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-[#020617] p-6 rounded-2xl border border-[#1E293B] flex items-center gap-4">
          <div className="bg-[#22C55E]/20 p-3 rounded-xl text-[#22C55E]">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">{t.requests || 'Total Requests'}</p>
            <p className="text-2xl font-bold text-white">{data.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage Chart */}
        <div className="bg-[#020617] p-6 rounded-2xl border border-[#1E293B]">
          <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#0EA5E9]" />
            {t.daily_usage || 'Daily Usage (Last 30 Days)'}
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="date" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px' }}
                  itemStyle={{ color: '#0EA5E9' }}
                />
                <Bar name={t.total_tokens || 'Tokens'} dataKey="tokens" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost by Operation */}
        <div className="bg-[#020617] p-6 rounded-2xl border border-[#1E293B]">
          <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#7C3AED]" />
            {t.usage_by_op || 'Cost by Operation'}
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={opChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {opChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Candidate Ranking with Delete */}
      <div className="bg-[#020617] p-6 rounded-2xl border border-[#1E293B]">
        <h3 className="text-lg font-semibold text-slate-100 mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          {t.candidate_ranking || 'Candidate Ranking'}
        </h3>
        <div className="space-y-4">
          {analyzedResults.slice(0, 5).map((result, idx) => (
            <div key={result.id} className="flex items-center justify-between p-4 bg-[#0F172A]/50 rounded-xl border border-[#1E293B] group hover:border-[#0EA5E9]/30 transition-all">
              <div className="flex items-center gap-4">
                <span className="text-xl font-black text-slate-700 w-6">0{idx + 1}</span>
                <div>
                  <h4 className="font-bold text-slate-200">{result.candidates.name}</h4>
                  <p className="text-xs text-slate-500">{result.jobs?.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-end">
                  <p className="text-lg font-black text-[#0EA5E9] leading-none">{result.analysis_results?.final_score}</p>
                  <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tighter">{result.analysis_results?.recommendation}</p>
                </div>
                {onDeleteCandidate && (
                  <button
                    onClick={() => onDeleteCandidate(result.candidates.id, result.candidates.name)}
                    className="p-2 bg-red-500/10 text-slate-600 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title={t.delete || 'Delete'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {analyzedResults.length === 0 && (
            <div className="text-center py-10 border border-dashed border-[#1E293B] rounded-xl text-slate-500 italic">
              {t.no_data_rank || 'No candidate data available for ranking yet.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

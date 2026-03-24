'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Loader2, TrendingUp, Cpu, DollarSign, Activity } from 'lucide-react';

export default function AiInsights({ userEmail, t }: { userEmail: string, t: any }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
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
  const dailyData: Record<string, any> = {};
  const opData: Record<string, any> = {};
  let totalCost = 0;
  let totalTokens = 0;

  data.forEach(log => {
    const date = new Date(log.created_at).toLocaleDateString();
    dailyData[date] = dailyData[date] || { date, tokens: 0, cost: 0 };
    dailyData[date].tokens += log.total_tokens;
    dailyData[date].cost += parseFloat(log.est_cost);

    opData[log.operation] = opData[log.operation] || { name: log.operation, value: 0 };
    opData[log.operation].value += parseFloat(log.est_cost);

    totalCost += parseFloat(log.est_cost);
    totalTokens += log.total_tokens;
  });

  const dailyChartData = Object.values(dailyData);
  const opChartData = Object.values(opData);
  const COLORS = ['#0EA5E9', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444'];

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      {/* Stats Overview */}
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
                <Bar dataKey="tokens" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
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
    </div>
  );
}

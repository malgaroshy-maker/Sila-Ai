'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { HelpCircle, Sparkles, ShieldCheck, ChevronRight } from 'lucide-react';

export default function LoginPage() {
  const t = useTranslations('Login');
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const handleLogin = (provider: 'google' | 'azure') => {
    setIsLoading(provider);
    const existingEmail = localStorage.getItem('user_email');
    const params = new URLSearchParams();
    if (existingEmail) params.append('userEmail', existingEmail);
    params.append('locale', locale);
    
    const query = `?${params.toString()}`;
    
    if (provider === 'google') {
      window.location.href = `${API_URL}/email/auth/google${query}`;
    } else {
      window.location.href = `${API_URL}/email/auth/microsoft${query}`;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] relative overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Immersive Neural Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] start-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] end-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      </div>

      {/* Language Switcher Corner */}
      <div className="absolute top-8 start-8 z-50">
        <LanguageSwitcher />
      </div>

      {/* Centered Auth Card */}
      <div className="relative z-10 w-full max-w-lg px-6 animate-in fade-in zoom-in-95 duration-1000">
        <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 lg:p-16 shadow-2xl shadow-black/50 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500 opacity-50" />
          
          <div className="text-center mb-12 space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 mb-4 transform hover:scale-105 transition-transform duration-500">
              <Sparkles className="text-indigo-400 h-6 w-6" />
              <span className="text-lg font-black text-white tracking-widest uppercase italic">ARIS</span>
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                {t('welcome')}
              </h1>
              <p className="text-lg text-slate-400 font-medium max-w-xs mx-auto">
                {t('subtitle')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => handleLogin('google')} 
              disabled={!!isLoading}
              className="w-full h-16 group relative flex items-center justify-between bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-white/[0.08] text-white px-8 rounded-2xl font-black text-lg transition-all duration-300 cursor-pointer disabled:opacity-50 overflow-hidden active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-xl shadow-lg transform group-hover:scale-110 transition-transform">
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
                </div>
                <span>{isLoading === 'google' ? t('connecting') : t('google')}</span>
              </div>
              <ChevronRight className={`w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors ${locale === 'ar' ? 'rotate-180' : ''}`} />
            </button>

            <button 
              disabled
              className="w-full h-16 group relative flex items-center justify-between bg-white/[0.02] border border-white/5 text-slate-500 px-8 rounded-2xl font-bold text-lg grayscale opacity-50 cursor-not-allowed"
            >
              <div className="flex items-center gap-4 text-start">
                <div className="p-2 bg-slate-800 rounded-xl">
                  <img src="https://www.svgrepo.com/show/448234/microsoft.svg" alt="Microsoft" className="w-6 h-6 opacity-50" />
                </div>
                <div className="flex flex-col leading-none">
                  <span>{t('microsoft')}</span>
                  <span className="text-[10px] font-black tracking-widest uppercase mt-1 text-slate-600">
                    {t('coming_soon')}
                  </span>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-12 space-y-8">
            <Link 
              href="/about?from=login" 
              className="group flex items-center justify-center gap-3 text-slate-400 hover:text-indigo-400 font-black transition-all"
            >
              <div className="p-2 bg-white/5 rounded-xl group-hover:bg-indigo-500/10 transition-colors">
                <HelpCircle size={18} />
              </div>
              <span className="border-b border-transparent group-hover:border-indigo-400/30 pb-0.5">{t('about')}</span>
            </Link>

            <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/5 flex items-start gap-4 text-start group hover:border-white/10 transition-colors">
              <ShieldCheck size={28} className="text-indigo-400/50 shrink-0 mt-1" />
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                {t('disclaimer')}
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-12 flex items-center justify-between text-slate-600 text-[10px] font-black uppercase tracking-widest px-4">
          <span>ARIS • v1.0</span>
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}

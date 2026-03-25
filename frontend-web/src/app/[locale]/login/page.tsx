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
    <div className="min-h-screen flex bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Left Column: Visual Storytelling (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900 shrink-0">
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/login-hero.png" 
            alt="AI Recruitment Brain" 
            className="w-full h-full object-cover opacity-60 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/40 to-transparent" />
        </div>

        <div className="relative z-10 p-16 flex flex-col justify-between w-full">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
                <Sparkles className="text-indigo-400 h-8 w-8" />
              </div>
              <span className="text-2xl font-black text-white tracking-widest uppercase italic">ARIS</span>
            </div>
            
            <div className="space-y-8 mt-12">
              <h2 className="text-5xl xl:text-7xl font-black text-white leading-[1.1] tracking-tight max-w-xl">
                The AI Brain for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400 italic">Modern Hiring.</span>
              </h2>
              <p className="text-xl text-slate-300 font-medium max-w-lg leading-relaxed">
                Connect your inbox and let our neural engine score, rank, and shortlist candidates in seconds.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl">
            <div className="space-y-2">
              <div className="text-indigo-400 font-black text-2xl tracking-tight">95%</div>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Analysis Accuracy</p>
            </div>
            <div className="space-y-2">
              <div className="text-emerald-400 font-black text-2xl tracking-tight">10x</div>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">Faster Hiring</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Auth Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16 relative bg-[#fafbfc]">
        <div className="absolute top-8 start-8 z-10 flex items-center gap-4">
          <LanguageSwitcher />
        </div>

        <div className="max-w-md w-full space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="text-center lg:text-start">
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-4">
              {t('welcome')}
            </h1>
            <p className="text-lg text-slate-500 font-medium">
              {t('subtitle')}
            </p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => handleLogin('google')} 
              disabled={!!isLoading}
              className="w-full h-16 group relative flex items-center justify-between bg-white border-2 border-slate-100 hover:border-indigo-400 hover:bg-slate-50 text-slate-900 px-8 rounded-2xl font-black text-lg transition-all duration-300 cursor-pointer disabled:opacity-50 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 active:scale-95"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-50 group-hover:scale-110 transition-transform">
                  <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
                </div>
                <span>{isLoading === 'google' ? t('connecting') : t('google')}</span>
              </div>
              <ChevronRight className={`w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors ${locale === 'ar' ? 'rotate-180' : ''}`} />
            </button>

            <button 
              disabled
              className="w-full h-16 group relative flex items-center justify-between bg-slate-50 border-2 border-slate-100/50 text-slate-400 px-8 rounded-2xl font-bold text-lg opacity-70 grayscale cursor-not-allowed"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100/50">
                  <img src="https://www.svgrepo.com/show/448234/microsoft.svg" alt="Microsoft" className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span>{t('microsoft')}</span>
                  <span className="text-[10px] font-black tracking-widest uppercase mt-1 text-slate-400">
                    {t('coming_soon')}
                  </span>
                </div>
              </div>
            </button>
          </div>

          <div className="pt-4 space-y-8">
            <Link 
              href="/about?from=login" 
              className="group flex items-center justify-center lg:justify-start gap-3 text-slate-500 hover:text-indigo-600 font-black transition-all"
            >
              <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-indigo-50 transition-colors">
                <HelpCircle size={18} />
              </div>
              <span className="underline underline-offset-4 decoration-2 decoration-slate-200 group-hover:decoration-indigo-200">{t('about')}</span>
            </Link>

            <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50 flex items-start gap-4 text-start">
              <ShieldCheck size={28} className="text-indigo-500 shrink-0 mt-1" />
              <div>
                <p className="text-xs text-slate-500 font-bold leading-relaxed">
                  {t('disclaimer')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-auto pt-16 w-full max-w-md flex items-center justify-between text-slate-400 text-[10px] font-black uppercase tracking-widest">
          <span>ARIS • v1.0</span>
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}

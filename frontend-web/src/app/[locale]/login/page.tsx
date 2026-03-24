'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Info, Sparkles, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const t = useTranslations('Login');
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const handleLogin = (provider: 'google' | 'azure') => {
    setIsLoading(provider);
    if (provider === 'google') {
      window.location.href = `${API_URL}/email/auth/google`;
    } else {
      window.location.href = `${API_URL}/email/auth/microsoft`;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fafbfc] p-6 relative overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-100/50 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-5%] left-[-5%] w-80 h-80 bg-emerald-100/40 rounded-full blur-3xl" />
      </div>

      {/* Language Switcher Corner */}
      <div className="absolute top-8 right-8 z-10">
        <LanguageSwitcher />
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 text-center relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />
          
          <div className="mb-10 space-y-4">
            <div className="inline-flex p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-2 transform group-hover:rotate-12 transition-transform duration-500">
              <Sparkles className="text-blue-600 h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mb-2 leading-tight">
                {t('welcome')}
              </h1>
              <p className="text-slate-500 font-medium text-lg">
                {t('subtitle')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => handleLogin('google')} 
              disabled={!!isLoading}
              className="w-full h-16 flex items-center justify-center gap-4 bg-white border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 text-slate-700 px-8 rounded-2xl font-bold text-lg transition-all duration-300 cursor-pointer disabled:opacity-50 group/btn shadow-sm hover:shadow-md"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6 group-hover/btn:scale-110 transition-transform" />
              <span>{isLoading === 'google' ? t('connecting') : t('google')}</span>
            </button>

            <button 
              onClick={() => handleLogin('azure')} 
              disabled={!!isLoading}
              className="w-full h-16 flex items-center justify-center gap-4 bg-white border-2 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 text-slate-700 px-8 rounded-2xl font-bold text-lg transition-all duration-300 cursor-pointer disabled:opacity-50 group/btn shadow-sm hover:shadow-md"
            >
              <img src="https://www.svgrepo.com/show/448234/microsoft.svg" alt="Microsoft" className="w-6 h-6 group-hover/btn:scale-110 transition-transform" />
              <span>{isLoading === 'azure' ? t('connecting') : t('microsoft')}</span>
            </button>
          </div>

          <Link 
            href="/about" 
            className="mt-8 flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 font-bold transition-all p-3 rounded-xl hover:bg-blue-50/50"
          >
            <Info size={18} />
            {t('about')}
          </Link>

          <div className="mt-8 pt-8 border-t border-slate-50 flex items-start gap-3 text-start text-xs text-slate-400 font-medium leading-relaxed">
            <ShieldCheck size={28} className="text-blue-200 shrink-0" />
            <p>{t('disclaimer')}</p>
          </div>
        </div>
      </div>

      <footer className="mt-12 text-slate-400 text-sm font-semibold tracking-wide flex items-center gap-4">
        <span>ARIS • AI Recruitment Intelligence</span>
        <div className="w-1 h-1 bg-slate-300 rounded-full" />
        <span>v1.0</span>
      </footer>
    </div>
  );
}

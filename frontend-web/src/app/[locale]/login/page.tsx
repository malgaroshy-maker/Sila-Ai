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
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5" />
      </div>

      {/* Language Switcher Corner */}
      <div className="absolute top-8 start-8 z-50">
        <LanguageSwitcher />
      </div>

      {/* Centered Auth Card */}
      <div className="relative z-10 w-full max-w-lg px-6 animate-in fade-in zoom-in-95 duration-1000">
        <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-8 lg:p-12 shadow-[0_8px_32px_rgb(0,0,0,0.4)] overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500 opacity-80" />
          
          <div className="text-center mb-10 space-y-5">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 shadow-inner mb-2 transform hover:scale-105 transition-transform duration-500">
              <Sparkles className="text-indigo-400 h-5 w-5" />
              <span className="text-base font-black text-slate-200 tracking-widest uppercase">ARIS</span>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {t('welcome')}
              </h1>
              <p className="text-base text-slate-400 font-medium max-w-xs mx-auto">
                {t('subtitle')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => handleLogin('google')} 
              disabled={!!isLoading}
              className="w-full h-14 group relative flex items-center justify-between bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] text-slate-200 hover:text-white px-6 rounded-xl font-bold text-base transition-all duration-300 cursor-pointer disabled:opacity-50 overflow-hidden active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="p-1.5 bg-white rounded-lg shadow-sm transform group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                    <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                  </svg>
                </div>
                <span>{isLoading === 'google' ? t('connecting') : t('google')}</span>
              </div>
              <ChevronRight className={`w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors ${locale === 'ar' ? 'rotate-180' : ''}`} />
            </button>

            <button 
              onClick={() => handleLogin('azure')} 
              disabled={!!isLoading}
              className="w-full h-14 group relative flex items-center justify-between bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] text-slate-200 hover:text-white px-6 rounded-xl font-bold text-base transition-all duration-300 cursor-pointer disabled:opacity-50 overflow-hidden active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="p-1.5 bg-white rounded-lg shadow-sm transform group-hover:scale-110 transition-transform flex items-center justify-center">
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" className="w-5 h-5">
                      <path fill="#f35325" d="M1 1h10v10H1z"/>
                      <path fill="#81bc06" d="M12 1h10v10H12z"/>
                      <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                      <path fill="#ffba08" d="M12 12h10v10H12z"/>
                   </svg>
                </div>
                <span>{isLoading === 'azure' ? t('connecting') : t('microsoft')}</span>
              </div>
              <ChevronRight className={`w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors ${locale === 'ar' ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="mt-10 space-y-6">
            <Link 
              href="/about?from=login" 
              className="group flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-indigo-400 font-bold transition-all"
            >
              <div className="p-1.5 bg-white/5 rounded-lg group-hover:bg-indigo-500/10 transition-colors">
                <HelpCircle size={16} />
              </div>
              <span className="border-b border-transparent group-hover:border-indigo-400/30 pb-0.5">{t('about')}</span>
            </Link>

            <div className="p-4 bg-[#020617]/50 rounded-2xl border border-white/5 flex items-start gap-3 text-start">
              <ShieldCheck size={20} className="text-emerald-500/70 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                {t('disclaimer')}
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-8 flex items-center justify-between text-slate-600 text-[10px] font-bold uppercase tracking-widest px-6">
          <span>ARIS • v1.0</span>
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}

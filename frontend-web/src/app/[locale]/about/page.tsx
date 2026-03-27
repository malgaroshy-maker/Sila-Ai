'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { 
  ChevronRight, Cpu, LayoutTemplate, ShieldCheck, 
  Sparkles, Mail, Globe, Zap, ArrowLeft, Terminal
} from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { Suspense, useState, useEffect } from 'react';

export default function AboutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white font-black tracking-widest uppercase animate-pulse">
        ARIS Intelligence...
      </div>
    }>
      <AboutContent />
    </Suspense>
  );
}

function AboutContent() {
  const t = useTranslations('About');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [fromOrigin, setFromOrigin] = useState<string | null>(null);

  useEffect(() => {
    const fromParam = searchParams.get('from');
    if (fromParam) {
      setFromOrigin(fromParam);
    } else if (typeof document !== 'undefined' && document.referrer && document.referrer.includes(window.location.host)) {
      const isDashboard = document.referrer.endsWith('/' + locale) || 
                          document.referrer.endsWith('/' + locale + '/') || 
                          document.referrer === window.location.origin + '/' + locale ||
                          document.referrer === window.location.origin + '/' + locale + '/';
      if (isDashboard) {
        setFromOrigin('dashboard');
      }
    }
  }, [searchParams, locale]);

  const isRtl = locale === 'ar';
  const backHref = fromOrigin === 'dashboard' ? '/' : '/login';
  const backLabel = fromOrigin === 'dashboard' ? t('back_to_dashboard') : t('back_to_login');

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-indigo-500/30 overflow-x-hidden font-sans">
      {/* Immersive Neural Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-15%] start-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-15%] end-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.04]" />
      </div>

      {/* Floating Navbar */}
      <nav className="sticky top-0 z-50 bg-[#020617]/60 backdrop-blur-3xl border-b border-white/5 py-4 px-6 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link 
            href={backHref} 
            className="flex items-center gap-3 group px-5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] transition-all active:scale-95 shadow-sm hover:shadow-md"
          >
            <div className="p-1.5 bg-indigo-500/20 rounded-lg group-hover:bg-indigo-500/30 transition-colors shadow-inner">
              <ArrowLeft size={16} className={`text-indigo-400 transition-transform ${isRtl ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
            </div>
            <span className="font-bold text-slate-300 group-hover:text-white text-xs uppercase tracking-widest hidden sm:inline transition-colors">
              {backLabel}
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shadow-inner">
              <Sparkles className="text-indigo-400 h-4 w-4" />
              <span className="text-[10px] font-black tracking-[0.2em] text-indigo-300/80 uppercase">Neural Intelligence</span>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      {/* Hero: Cognitive Vision */}
      <header className="relative pt-32 pb-48 px-6 text-center overflow-hidden">
        <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/[0.03] border border-white/10 text-indigo-400 text-xs font-black tracking-[0.4em] uppercase">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />
            {t('title')}
          </div>
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black text-white leading-[1] tracking-tighter">
            {t('subtitle')}
          </h1>
          <p className="text-xl md:text-3xl text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium">
            {t('description')}
          </p>
          <div className="pt-16">
            <div className="h-1 w-32 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto opacity-50" />
          </div>
        </div>
      </header>

      {/* Grid: The Pulse of ARIS */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="group relative p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] hover:bg-white/[0.04] hover:border-indigo-500/30 transition-all duration-500 shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-2">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-8 border border-indigo-500/20 group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all">
                <Cpu className="text-indigo-400 h-7 w-7" />
              </div>
              <h3 className="text-2xl font-black mb-4 tracking-tight text-slate-200 group-hover:text-white transition-colors">{t('feature_ai_title')}</h3>
              <p className="text-slate-400 text-base leading-relaxed font-medium">{t('feature_ai_desc')}</p>
            </div>

            <div className="group relative p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-500 shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-2">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-8 border border-emerald-500/20 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all">
                <ShieldCheck className="text-emerald-400 h-7 w-7" />
              </div>
              <h3 className="text-2xl font-black mb-4 tracking-tight text-slate-200 group-hover:text-white transition-colors">{t('feature_security_title')}</h3>
              <p className="text-slate-400 text-base leading-relaxed font-medium">{t('feature_security_desc')}</p>
            </div>

            <div className="group relative p-10 bg-white/[0.02] border border-white/5 rounded-[2.5rem] hover:bg-white/[0.04] hover:border-blue-500/30 transition-all duration-500 shadow-lg hover:shadow-blue-500/10 hover:-translate-y-2">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-8 border border-blue-500/20 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all">
                <LayoutTemplate className="text-blue-400 h-7 w-7" />
              </div>
              <h3 className="text-2xl font-black mb-4 tracking-tight text-slate-200 group-hover:text-white transition-colors">{t('feature_pipeline_title')}</h3>
              <p className="text-slate-400 text-base leading-relaxed font-medium">{t('feature_pipeline_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Atmospheric Vision */}
      <section className="py-64 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-600/5 blur-[120px] rounded-full" />
        <div className="max-w-4xl mx-auto relative z-10 text-center lg:text-start space-y-12">
          <div className="flex items-center gap-6 justify-center lg:justify-start">
            <h2 className="text-5xl font-black italic text-indigo-400 tracking-tighter">{t('vision_title')}</h2>
            <div className="flex-1 h-px bg-white/10 hidden lg:block" />
          </div>
          <p className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tight">
            {t('vision_desc')}
          </p>
          <div className="pt-6">
            <div className="w-24 h-2 bg-indigo-600 rounded-full mx-auto lg:mx-0 shadow-[0_0_20px_rgba(79,70,229,0.6)]" />
          </div>
        </div>
      </section>

      {/* Visionaries: Double Column Impact */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 space-y-3 text-center lg:text-start">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-slate-100">{t('footer_crafted')}</h2>
            <p className="text-slate-500 font-bold tracking-[0.4em] uppercase text-xs">Architects of Cognitive Recruitment</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Developer Card */}
            <div className="group relative p-10 lg:p-16 bg-white/[0.02] border border-white/5 rounded-[3rem] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500 overflow-hidden shadow-xl">
              <div className="absolute top-8 end-8">
                <div className="px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold tracking-widest uppercase shadow-sm">
                  Engineering Lead
                </div>
              </div>
              <div className="space-y-10 relative z-10">
                <div className="w-20 h-20 bg-indigo-600/10 rounded-[2rem] flex items-center justify-center border border-indigo-500/20 group-hover:bg-indigo-600/30 transition-all duration-500 shadow-lg">
                  <Terminal size={32} className="text-indigo-400 group-hover:text-white transition-colors" />
                </div>
                <div className="space-y-3">
                  <h4 className="text-4xl lg:text-5xl font-black text-slate-100 tracking-tight">{t('developer_name')}</h4>
                  <p className="text-indigo-400 font-bold tracking-[0.2em] uppercase text-[11px]">{t('developer')}</p>
                </div>
                <p className="text-xl text-slate-400 leading-relaxed font-medium border-start-4 border-indigo-500/30 ps-8">
                  {t('developer_desc')}
                </p>
              </div>
            </div>

            {/* Strategic Thinker Card */}
            <div className="group relative p-10 lg:p-16 bg-white/[0.02] border border-white/5 rounded-[3rem] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500 overflow-hidden shadow-xl">
              <div className="absolute top-8 end-8">
                <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-widest uppercase shadow-sm">
                  Strategy Chief
                </div>
              </div>
              <div className="space-y-10 relative z-10">
                <div className="w-20 h-20 bg-emerald-600/10 rounded-[2rem] flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-600/30 transition-all duration-500 shadow-lg">
                  <Globe size={32} className="text-emerald-400 group-hover:text-white transition-colors" />
                </div>
                <div className="space-y-3">
                  <h4 className="text-4xl lg:text-5xl font-black text-slate-100 tracking-tight">{t('idea_name')}</h4>
                  <p className="text-emerald-400 font-bold tracking-[0.2em] uppercase text-[11px]">{t('idea')}</p>
                </div>
                <p className="text-xl text-slate-400 leading-relaxed font-medium border-start-4 border-emerald-500/30 ps-8">
                  {t('idea_desc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Immersive CTA Footer */}
      <footer className="py-64 px-6 text-center bg-gradient-to-t from-indigo-500/[0.03] to-transparent">
        <div className="max-w-3xl mx-auto space-y-16">
          <div className="relative group inline-block">
            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <Link 
              href={backHref}
              className="relative inline-flex items-center gap-6 px-16 py-8 rounded-[2.5rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black text-2xl transition-all shadow-[0_0_50px_rgba(79,70,229,0.3)] hover:scale-105 active:scale-95"
            >
              <span>{backLabel}</span>
              <ChevronRight size={32} className={`transition-transform ${isRtl ? 'rotate-180 group-hover:-translate-x-2' : 'group-hover:translate-x-2'}`} />
            </Link>
          </div>

          <div className="pt-24 flex items-center justify-center gap-10 text-slate-700 font-black text-[11px] uppercase tracking-[0.6em]">
            <span className="hover:text-slate-400 transition-colors cursor-default">Intelligence Core</span>
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
            <span className="hover:text-slate-400 transition-colors cursor-default">Precision Built</span>
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
            <span className="hover:text-slate-400 transition-colors cursor-default">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

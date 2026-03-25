'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { 
  ChevronRight, Cpu, LayoutTemplate, ShieldCheck, 
  Sparkles, Mail, Globe, Zap, ArrowLeft
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
    } else if (document.referrer && document.referrer.includes(window.location.host)) {
      // Robust fallback: Check if referrer was the dashboard root
      if (document.referrer === window.location.origin + '/' + locale || 
          document.referrer === window.location.origin + '/' ||
          document.referrer === window.location.origin + '/' + locale + '/') {
        setFromOrigin('dashboard');
      }
    }
  }, [searchParams, locale]);

  const isRtl = locale === 'ar';
  const backHref = fromOrigin === 'dashboard' ? '/' : '/login';
  const backLabel = fromOrigin === 'dashboard' ? t('back_to_dashboard') : t('back_to_login');

  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-indigo-500/30 overflow-x-hidden font-sans pb-20">
      {/* Immersive Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-20%] start-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute bottom-[-10%] end-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#020617]/50 backdrop-blur-2xl border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link 
            href={backHref} 
            className="flex items-center gap-3 group px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
          >
            <div className="p-1.5 bg-indigo-500 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.4)]">
              <ArrowLeft size={16} className={`transition-transform ${isRtl ? 'rotate-180 group-hover:translate-x-1' : 'group-hover:-translate-x-1'}`} />
            </div>
            <span className="font-bold text-slate-300 group-hover:text-white transition-colors">
              {backLabel}
            </span>
          </Link>
          <LanguageSwitcher />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-20 lg:pt-32">
        {/* Unified Hero */}
        <div className="text-center space-y-8 mb-32 animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black tracking-widest uppercase">
            <Sparkles size={14} />
            {t('title')}
          </div>
          <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight tracking-tighter">
            {t('subtitle')}
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
            {t('description')}
          </p>
        </div>

        {/* Vertical Professional Info Cards */}
        <div className="space-y-6">
          <div className="p-8 lg:p-12 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] hover:bg-white/[0.08] transition-all duration-500">
            <h3 className="text-3xl font-black mb-8 text-white tracking-tight flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <Cpu className="text-indigo-400 h-6 w-6" />
              </div>
              {t('feature_ai_title')}
            </h3>
            <p className="text-slate-400 leading-relaxed font-medium text-lg italic ps-4 border-s-4 border-indigo-500/30">
              {t('feature_ai_desc')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] hover:bg-white/[0.08] transition-all duration-500">
              <ShieldCheck className="text-emerald-400 h-8 w-8 mb-6" />
              <h4 className="text-xl font-bold mb-3">{t('feature_security_title')}</h4>
              <p className="text-slate-400 text-sm leading-relaxed">{t('feature_security_desc')}</p>
            </div>
            <div className="p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] hover:bg-white/[0.08] transition-all duration-500">
              <LayoutTemplate className="text-blue-400 h-8 w-8 mb-6" />
              <h4 className="text-xl font-bold mb-3">{t('feature_pipeline_title')}</h4>
              <p className="text-slate-400 text-sm leading-relaxed">{t('feature_pipeline_desc')}</p>
            </div>
          </div>
        </div>

        {/* Team Section - Clean Stack */}
        <div className="mt-32 space-y-12">
          <div className="text-start space-y-4">
            <h2 className="text-3xl font-black tracking-tight text-white">{t('footer_crafted')}</h2>
            <div className="h-1 w-20 bg-indigo-500 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="group">
              <h4 className="text-2xl font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{t('developer_name')}</h4>
              <p className="text-indigo-500 font-bold text-xs uppercase tracking-widest mb-4">{t('developer')}</p>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">{t('developer_desc')}</p>
            </div>
            <div className="group">
              <h4 className="text-2xl font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">{t('idea_name')}</h4>
              <p className="text-emerald-500 font-bold text-xs uppercase tracking-widest mb-4">{t('idea')}</p>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">{t('idea_desc')}</p>
            </div>
          </div>
        </div>

        {/* Tech Stack Footer */}
        <div className="text-center pt-20 border-t border-white/5 space-y-12">
          <div className="flex items-center justify-center gap-12 flex-wrap opacity-30 hover:opacity-100 transition-opacity duration-700 grayscale hover:grayscale-0">
            <div className="flex items-center gap-3 font-black tracking-widest uppercase text-sm"><Globe size={20} /> {t('tech_next')}</div>
            <div className="flex items-center gap-3 font-black tracking-widest uppercase text-sm"><Zap size={20} /> {t('tech_tailwind')}</div>
            <div className="flex items-center gap-3 font-black tracking-widest uppercase text-sm"><Sparkles size={20} /> {t('tech_gemini')}</div>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-center items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">
              Crafted With Passion
            </div>
            <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
              © {new Date().getFullYear()} ARIS • AI Recruitment Intelligence System • Developed by {t('developer_name')}
            </p>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}

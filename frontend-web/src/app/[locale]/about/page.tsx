'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { 
  ChevronRight, Cpu, LayoutTemplate, ShieldCheck, 
  Sparkles, Mail, Globe, Zap, ArrowLeft
} from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function AboutPage() {
  const t = useTranslations('About');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const isRtl = locale === 'ar';

  const backHref = from === 'dashboard' ? '/' : '/login';
  const backLabel = from === 'dashboard' ? t('back_to_dashboard') : t('back_to_login');

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30 overflow-x-hidden font-sans">
      {/* Premium Background Visuals */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[160px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-slate-950/50 backdrop-blur-2xl border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link 
            href={backHref} 
            className="flex items-center gap-3 group px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-500/50 transition-all active:scale-95"
          >
            <div className={`p-1.5 bg-indigo-500 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.5)]`}>
              <ArrowLeft className={`text-white h-4 w-4 transition-transform ${isRtl ? 'rotate-180' : ''} group-hover:-translate-x-0.5`} />
            </div>
            <span className="font-bold text-slate-200 group-hover:text-white transition-colors">
              {backLabel}
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-16 lg:py-32">
        {/* Hero Section */}
        <div className="text-center space-y-8 mb-32 animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black tracking-widest uppercase">
            <Sparkles size={14} className="animate-spin-slow" />
            {t('title')}
          </div>
          <h1 className="text-5xl lg:text-8xl font-black bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent leading-[1.1] tracking-tighter">
            {t('subtitle')}
          </h1>
          <p className="text-xl lg:text-2xl text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium">
            {t('description')}
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-40">
          {[
            { icon: Cpu, color: 'text-indigo-400', glow: 'shadow-indigo-500/20', title: t('feature_ai_title'), desc: t('feature_ai_desc') },
            { icon: ShieldCheck, color: 'text-emerald-400', glow: 'shadow-emerald-500/20', title: t('feature_security_title'), desc: t('feature_security_desc') },
            { icon: LayoutTemplate, color: 'text-blue-400', glow: 'shadow-blue-500/20', title: t('feature_pipeline_title'), desc: t('feature_pipeline_desc') }
          ].map((feature, i) => (
            <div key={i} className="group relative p-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] hover:bg-white/[0.08] hover:border-white/20 transition-all duration-500 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/30 transition-all duration-500 shadow-2xl ${feature.glow}`}>
                <feature.icon className={`${feature.color} h-8 w-8`} />
              </div>
              <h3 className="text-2xl font-black mb-4 text-white tracking-tight">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed font-medium text-lg">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Visionaries Section */}
        <div className="relative p-1 lg:p-1 mb-40 rounded-[4rem] bg-gradient-to-br from-indigo-500/20 to-blue-500/20 shadow-2xl shadow-indigo-500/10">
          <div className="bg-slate-950 rounded-[3.9rem] p-10 lg:p-20 overflow-hidden relative">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-20">
              {/* Lead Developer */}
              <div className="space-y-10 group">
                <div className="flex items-center gap-6">
                  <div className="p-5 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
                    <Cpu className="h-10 w-10" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-white tracking-tight">{t('developer_name')}</h2>
                    <p className="text-indigo-400 font-black uppercase tracking-[0.2em] text-xs mt-1">{t('developer')}</p>
                  </div>
                </div>
                <p className="text-slate-400 leading-relaxed text-xl font-medium italic border-s-4 border-indigo-500/30 ps-6">
                  "{t('developer_desc')}"
                </p>
                <div className="flex gap-4">
                  <span className="px-5 py-2.5 bg-white/5 rounded-xl border border-white/10 text-slate-300 font-bold text-sm tracking-wide">Next.js Architect</span>
                  <span className="px-5 py-2.5 bg-white/5 rounded-xl border border-white/10 text-slate-300 font-bold text-sm tracking-wide">AI Engineer</span>
                </div>
              </div>

              {/* Concept Originator */}
              <div className="space-y-10 group">
                <div className="flex items-center gap-6">
                  <div className="p-5 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                    <Sparkles className="h-10 w-10" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-white tracking-tight">{t('idea_name')}</h2>
                    <p className="text-emerald-400 font-black uppercase tracking-[0.2em] text-xs mt-1">{t('idea')}</p>
                  </div>
                </div>
                <p className="text-slate-400 leading-relaxed text-xl font-medium italic border-s-4 border-emerald-500/30 ps-6">
                  "{t('idea_desc')}"
                </p>
                <div className="flex gap-4">
                  <div className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm font-black uppercase tracking-wider">
                    {t('role_originator')}
                  </div>
                </div>
              </div>
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

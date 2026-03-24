import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { 
  ArrowLeft, ArrowRight, Cpu, LayoutTemplate, ShieldCheck, 
  Sparkles, Code, Lightbulb, Github, Mail, Globe,
  Zap, Award
} from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function AboutPage() {
  const t = useTranslations('About');
  const locale = useLocale();
  const isRtl = locale === 'ar';

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-900 selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[5%] right-[-5%] w-[35%] h-[35%] bg-emerald-100/30 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-slate-200/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center gap-2 group transition-all"
          >
            <div className="p-2 bg-slate-900 rounded-lg group-hover:bg-blue-600 transition-colors">
              {isRtl ? <ArrowRight className="text-white h-4 w-4" /> : <ArrowLeft className="text-white h-4 w-4" />}
            </div>
            <span className="font-semibold text-slate-700 group-hover:text-blue-600">
              {t('back_to_login')}
            </span>
          </Link>

          <LanguageSwitcher />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12 lg:py-24">
        {/* Header Section */}
        <div className="text-center space-y-6 mb-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-semibold tracking-wide uppercase">
            <Sparkles size={14} />
            {t('title')}
          </div>
          <h1 className="text-4xl lg:text-6xl font-black bg-gradient-to-br from-slate-900 to-slate-600 bg-clip-text text-transparent leading-tight tracking-tight">
            AI Recruitment <br /> Intelligence System
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed font-medium">
            {t('description')}
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
          {[
            { icon: Cpu, color: 'text-blue-600', bg: 'bg-blue-50', title: 'Gemini 2.0 AI', desc: 'Advanced parsing and cognitive analysis of candidate profiles with 95% accuracy.' },
            { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', title: 'Data Security', desc: 'Enterprise-grade isolation powered by Supabase RLS and secure environment vars.' },
            { icon: LayoutTemplate, color: 'text-purple-600', bg: 'bg-purple-50', title: 'Smart Pipeline', desc: 'Beautifully responsive Kanban board designed for maximum recruitment agility.' }
          ].map((feature, i) => (
            <div key={i} className="group p-8 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-3xl hover:shadow-2xl hover:shadow-blue-200/20 transition-all duration-300 hover:-translate-y-2">
              <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform`}>
                <feature.icon className={`${feature.color} h-7 w-7`} />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">{feature.title}</h3>
              <p className="text-slate-500 leading-relaxed leading-snug">{feature.desc}</p>
            </div>
          ))}
        </div>

        {/* Team / Credits Section */}
        <div className="relative p-8 lg:p-16 mb-32 rounded-[3rem] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Developer */}
            <div className="space-y-8 bg-white/5 backdrop-blur-md p-10 rounded-[2.5rem] border border-white/10 hover:border-blue-400/30 transition-colors">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-400/20 shadow-inner">
                  <Code className="text-blue-400 h-8 w-8" />
                </div>
                <div>
                  <p className="text-blue-400/80 font-bold uppercase tracking-widest text-[10px] mb-1">{t('developer')}</p>
                  <h2 className="text-3xl font-black text-white">{t('developer_name')}</h2>
                </div>
              </div>
              <p className="text-slate-300 leading-relaxed text-lg">
                Lead Software Engineer specialized in AI-integrated ecosystems, distributed systems, and premium UI/UX design architectures.
              </p>
              <div className="flex gap-4">
                 <button className="p-3 bg-white/5 rounded-xl border border-white/10 text-white hover:bg-white hover:text-slate-900 transition-all cursor-pointer">
                  <Github size={20} />
                 </button>
                 <button className="p-3 bg-white/5 rounded-xl border border-white/10 text-white hover:bg-white hover:text-slate-900 transition-all cursor-pointer">
                  <Mail size={20} />
                 </button>
              </div>
            </div>

            {/* Idea Contributor */}
            <div className="space-y-8 bg-white/5 backdrop-blur-md p-10 rounded-[2.5rem] border border-white/10 hover:border-emerald-400/30 transition-colors">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-400/20 shadow-inner">
                  <Lightbulb className="text-emerald-400 h-8 w-8" />
                </div>
                <div>
                  <p className="text-emerald-400/80 font-bold uppercase tracking-widest text-[10px] mb-1">{t('idea')}</p>
                  <h2 className="text-3xl font-black text-white">{t('idea_name')}</h2>
                </div>
              </div>
              <p className="text-slate-300 leading-relaxed text-lg">
                Strategic visionary and Recruitment Subject Matter Expert (SME) who conceived the intelligent CV-scoring and ranking methodology.
              </p>
              <div className="flex gap-4">
                 <div className="px-6 py-3 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl text-emerald-300 text-sm font-black uppercase tracking-wider">
                   Strategy & Concept Originator
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <footer className="text-center pt-10 border-t border-slate-200/50 space-y-6">
          <div className="flex items-center justify-center gap-8 flex-wrap opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
            <div className="flex items-center gap-2 font-bold"><Globe size={18} /> Next.js 15</div>
            <div className="flex items-center gap-2 font-bold"><Zap size={18} /> Tailwind v4</div>
            <div className="flex items-center gap-2 font-bold"><Award size={18} /> Gemini 2.0</div>
          </div>
          <p className="text-slate-400 text-sm font-semibold tracking-tight">
            © {new Date().getFullYear()} ARIS - AI Recruitment Intelligence System. Crafted with passion by {t('developer_name')}.
          </p>
        </footer>
      </main>
    </div>
  );
}

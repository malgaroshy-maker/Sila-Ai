'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Settings, ArrowRight, X, Cpu, Key, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OnboardingModal({ isOpen, onClose, onOpenSettings, t = {} }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onOpenSettings: () => void,
  t?: Record<string, string> 
}) {
  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  const steps = [
    {
      title: t.welcome_title || 'Welcome to ARIS Intelligence',
      description: t.welcome_step1 || 'To start your journey, you need a Gemini API Key.',
      icon: <Key className="w-8 h-8 text-amber-400" />,
      color: 'from-amber-500/20 to-amber-600/5'
    },
    {
      title: t.ai_config || 'AI Configuration',
      description: t.welcome_step2 || 'Enter your key in the settings and select your preferred AI model.',
      icon: <Cpu className="w-8 h-8 text-[#0EA5E9]" />,
      color: 'from-[#0EA5E9]/20 to-[#0369A1]/5'
    },
    {
      title: t.welcome_step2 || 'Select Model',
      description: `${t.welcome_step2_detail || 'Free Tier: Use 3.1 Flash Lite (Fastest), 3 Flash, or 2.5 Flash.'} \n\n ${t.welcome_step2_pro || 'Best Results: 3.1 Pro (Requires Paid API Tier).'}`,
      icon: <Target className="w-8 h-8 text-blue-400" />,
      color: 'from-blue-500/20 to-blue-600/5'
    },
    {
      title: t.sync_step_title || 'Automated Sync',
      description: t.welcome_step3 || 'Once configured, ARIS will automatically scan your emails and analyze incoming CVs.',
      icon: <Mail className="w-8 h-8 text-emerald-400" />,
      color: 'from-emerald-500/20 to-emerald-600/5'
    }
  ];

  const handleNext = () => {
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      onClose();
      onOpenSettings();
    }
  };

  const isRtl = document.documentElement.dir === 'rtl';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0F172A] border border-[#1E293B] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl shadow-indigo-500/10"
      >
        <div className={`p-8 bg-gradient-to-br ${steps[step-1].color} transition-all duration-500`}>
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-slate-900/50 rounded-2xl border border-white/10">
              {steps[step-1].icon}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2">
              <X className="w-6 h-6" />
            </button>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
            {steps[step-1].title}
          </h2>
          <p className="text-slate-300 leading-relaxed text-lg">
            {steps[step-1].description}
          </p>
        </div>

        <div className="p-8 bg-[#0F172A] border-t border-[#1E293B]">
          <div className="flex items-center justify-between gap-6">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${step === i + 1 ? 'w-8 bg-[#0EA5E9]' : 'w-2 bg-slate-700'}`} 
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-[#0EA5E9] hover:bg-[#0EA5E9]/80 text-white font-bold py-3 px-8 rounded-2xl transition-all shadow-lg shadow-[#0EA5E9]/20 hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              {step === steps.length ? (t.go_to_settings || 'Open Settings') : (t.next || 'Next')}
              {isRtl ? <ArrowRight className="w-5 h-5 rotate-180" /> : <ArrowRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

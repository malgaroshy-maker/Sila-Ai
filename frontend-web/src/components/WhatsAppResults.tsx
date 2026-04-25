'use client';

import { X, MessageCircle, Clock, AlertTriangle, CheckCircle, Shield } from 'lucide-react';

interface QuestionResult {
  question_number: number;
  question_text: string;
  answer_text: string;
  response_delay_ms: number;
  naturalness_score: number;
  consistency_score: number;
  copy_paste_likelihood: number;
  ai_notes: string;
}

interface SessionResult {
  id: string;
  status: string;
  authenticity_score: number;
  authenticity_verdict: string;
  red_flags: { reason: string; severity: string }[];
  summary: string;
}

export default function WhatsAppResults({
  isOpen,
  onClose,
  session,
  questions,
  candidateName,
  t = {},
}: {
  isOpen: boolean;
  onClose: () => void;
  session: SessionResult | null;
  questions: QuestionResult[] | null;
  candidateName: string;
  t?: Record<string, string>;
}) {
  if (!isOpen || !session) return null;

  const score = session.authenticity_score || 0;
  const verdict = session.authenticity_verdict || '';
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400';
  const scoreBg = score >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' : score >= 50 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20';

  const verdictLabel = {
    genuine: t.whatsapp_verdict_genuine || 'Genuine',
    suspicious: t.whatsapp_verdict_suspicious || 'Suspicious',
    likely_fabricated: t.whatsapp_verdict_fabricated || 'Likely Fabricated',
  }[verdict] || verdict;

  const severityColor = (s: string) =>
    s === 'high' ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' :
    s === 'medium' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
    'text-slate-400 bg-slate-500/10 border-slate-500/20';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0F172A] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-[#1E293B] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1E293B] flex justify-between items-center sticky top-0 bg-[#0F172A] z-10">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-400" />
            {t.whatsapp_verification || 'WhatsApp Verification'}
            <span className="text-slate-400 text-xs font-normal">— {candidateName}</span>
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-2 rounded-lg cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Score Card */}
          <div className={`rounded-xl p-4 border ${scoreBg} flex items-center gap-4`}>
            <div className={`text-3xl font-black ${scoreColor}`}>{score}</div>
            <div>
              <div className={`text-base font-bold ${scoreColor}`}>{verdictLabel}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t.whatsapp_verdict_genuine ? '' : 'Authenticity Score'} /100</div>
            </div>
          </div>

          {/* AI Summary */}
          {session.summary && (
            <div className="bg-[#020617] rounded-xl p-3 border border-[#1E293B]">
              <h3 className="text-[10px] font-bold text-[#0EA5E9] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                {t.ai_justification || 'AI Summary'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{session.summary}</p>
            </div>
          )}

          {/* Red Flags */}
          {session.red_flags && session.red_flags.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                {t.flags || 'Red Flags'} ({session.red_flags.length})
              </h3>
              {session.red_flags.map((flag, i) => (
                <div key={i} className={`rounded-lg px-2.5 py-1.5 text-[11px] border ${severityColor(flag.severity)}`}>
                  <span className="font-bold uppercase mr-1.5">[{flag.severity}]</span>
                  {flag.reason}
                </div>
              ))}
            </div>
          )}

          {/* Questions & Answers */}
          {questions && questions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                {t.interview_q || 'Questions & Responses'}
              </h3>
              {questions.map((q) => (
                <div key={q.question_number} className="bg-[#020617] rounded-xl p-3 border border-[#1E293B] space-y-2">
                  <div>
                    <span className="text-[10px] font-bold text-[#0EA5E9] uppercase">Q{q.question_number}</span>
                    <p className="text-xs text-white mt-0.5">{q.question_text}</p>
                  </div>
                  <div className="ps-3 border-s-2 border-[#1E293B]">
                    <p className="text-xs text-slate-300">{q.answer_text || <span className="text-slate-600 italic">{'(No answer)'}</span>}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {(q.response_delay_ms / 1000).toFixed(1)}s
                    </span>
                    <span className={q.naturalness_score >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                      Natural: {q.naturalness_score}%
                    </span>
                    <span className={q.consistency_score >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                      Consistent: {q.consistency_score}%
                    </span>
                    <span className={q.copy_paste_likelihood <= 30 ? 'text-emerald-400' : 'text-rose-400'}>
                      Copy: {q.copy_paste_likelihood}%
                    </span>
                  </div>
                  {q.ai_notes && (
                    <p className="text-[10px] text-slate-500 italic">{q.ai_notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 flex justify-end">
          <button onClick={onClose} className="bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold py-2 px-4 rounded-xl cursor-pointer transition-all text-xs">
            {t.close || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

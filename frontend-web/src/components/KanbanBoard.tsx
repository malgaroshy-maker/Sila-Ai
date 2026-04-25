'use client';

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Mail, Clock, 
  Loader2, GraduationCap, Trash2, AlertTriangle, MessageCircle
} from 'lucide-react';

const STAGES = [
  { id: 'Applied', label: 'Applied', color: 'slate' },
  { id: 'Screening', label: 'Screening', color: 'blue' },
  { id: 'WhatsApp Verification', label: 'WhatsApp', color: 'green' },
  { id: 'Interview', label: 'Interview', color: 'indigo' },
  { id: 'Offered', label: 'Offered', color: 'amber' },
  { id: 'Hired', label: 'Hired', color: 'emerald' },
  { id: 'Rejected', label: 'Rejected', color: 'rose' },
];

interface Application {
  id: string;
  job_id: string;
  candidate_id: string;
  pipeline_stage: string;
  status: 'pending' | 'analyzed' | 'failed' | 'rejected';
  ai_error?: string;
  created_at: string;
  candidates: {
    id: string;
    name: string;
    email: string;
  };
  analysis_results?: {
    final_score: number;
    recommendation: string;
    is_fresh_graduate?: boolean;
    gpa_score?: number;
    tags?: string[];
  };
}

interface KanbanProps {
  results: Application[];
  onStageChange: (applicationId: string, newStage: string) => Promise<void>;
  onDelete?: (candidateId: string, name: string) => Promise<void>;
  onVerifyWhatsapp?: (applicationId: string) => Promise<void>;
  onViewWhatsappResults?: (applicationId: string) => void;
  t: Record<string, string>;
  locale?: string;
  selectedCandidateIds?: Set<string>;
  onSelectCandidate?: (candidateId: string, checked: boolean) => void;
}

export default function KanbanBoard({ results, onStageChange, onDelete, onVerifyWhatsapp, onViewWhatsappResults, t, locale = 'en', selectedCandidateIds = new Set(), onSelectCandidate }: KanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const grouped = useMemo(() => {
    const map: Record<string, Application[]> = {};
    STAGES.forEach(s => map[s.id] = []);
    results.forEach(r => {
      const stage = r.pipeline_stage || 'Applied';
      if (map[stage]) map[stage].push(r);
      else map['Applied'].push(r);
    });
    return map;
  }, [results]);

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: { active: { id: string | number }, over: { id: string | number } | null }) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      let newStage: string | null = null;
      
      if (STAGES.find(s => s.id === over.id)) {
        newStage = over.id as string;
      } else {
        const overResult = results.find(r => r.id === over.id);
        if (overResult) {
          newStage = overResult.pipeline_stage || 'Applied';
        }
      }

      if (newStage) {
        const activeResult = results.find(r => r.id === active.id);
        if (activeResult && activeResult.pipeline_stage !== newStage) {
          onStageChange(activeResult.id, newStage);
        }
      }
    }
    setActiveId(null);
  };

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-6 min-h-[calc(100vh-280px)]">
        {STAGES.map(stage => (
          <KanbanColumn 
            key={stage.id} 
            stage={stage} 
            items={grouped[stage.id]} 
            t={t}
            onDelete={onDelete}
            onVerifyWhatsapp={onVerifyWhatsapp}
            onViewWhatsappResults={onViewWhatsappResults}
            locale={locale}
            selectedCandidateIds={selectedCandidateIds}
            onSelectCandidate={onSelectCandidate}
          />
        ))}
      </div>
      
      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: { active: { opacity: '0.5' } }
        })
      }}>
        {activeId ? (
          <div className="w-[280px] bg-[#1E293B] border border-[#0369A1]/50 rounded-xl p-4 shadow-2xl scale-105 rotate-2">
            <CandidateCard 
              result={results.find(r => r.id === activeId)} 
              onDelete={onDelete}
              isOverlay 
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({ stage, items, t, onDelete, onVerifyWhatsapp, onViewWhatsappResults, locale, selectedCandidateIds, onSelectCandidate }: { stage: { id: string, label: string, color: string }, items: Application[], t: Record<string, string>, onDelete?: (id: string, name: string) => Promise<void>, onVerifyWhatsapp?: (applicationId: string) => Promise<void>, onViewWhatsappResults?: (applicationId: string) => void, locale?: string, selectedCandidateIds?: Set<string>, onSelectCandidate?: (id: string, checked: boolean) => void }) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <div className="flex-shrink-0 w-[300px] flex flex-col gap-3">
      <div className="flex items-center justify-between px-2 mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stage.color === 'emerald' ? 'bg-emerald-500' : stage.color === 'rose' ? 'bg-rose-500' : 'bg-[#0EA5E9]'}`} />
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">{t[stage.id.toLowerCase()] || stage.label}</h3>
          <span className="bg-[#1E293B] text-slate-400 text-[10px] px-2 py-0.5 rounded-full border border-slate-800">
            {items.length}
          </span>
        </div>
      </div>

      <div 
        ref={setNodeRef}
        className="flex-1 bg-[#0F172A]/50 border border-[#1E293B] rounded-2xl p-2 min-h-[400px] transition-colors hover:border-[#334155]/50 overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-hide"
      >
        <SortableContext 
          id={stage.id} 
          items={items.map(i => i.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {items.map(item => (
              <SortableCandidateCard key={item.id} result={item} onDelete={onDelete} onVerifyWhatsapp={onVerifyWhatsapp} onViewWhatsappResults={onViewWhatsappResults} locale={locale} isSelected={selectedCandidateIds?.has(item.candidate_id)} onSelect={onSelectCandidate} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

function SortableCandidateCard({ result, onDelete, onVerifyWhatsapp, onViewWhatsappResults, locale, isSelected, onSelect }: { result: Application, onDelete?: (id: string, name: string) => Promise<void>, onVerifyWhatsapp?: (applicationId: string) => Promise<void>, onViewWhatsappResults?: (applicationId: string) => void, locale?: string, isSelected?: boolean, onSelect?: (id: string, checked: boolean) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: result.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CandidateCard result={result} onDelete={onDelete} onVerifyWhatsapp={onVerifyWhatsapp} onViewWhatsappResults={onViewWhatsappResults} locale={locale} isSelected={isSelected} onSelect={onSelect} />
    </div>
  );
}

function CandidateCard({ result, onDelete, onVerifyWhatsapp, onViewWhatsappResults, isOverlay = false, locale = 'en', isSelected = false, onSelect }: { result: Application | undefined, onDelete?: (id: string, name: string) => Promise<void>, onVerifyWhatsapp?: (applicationId: string) => Promise<void>, onViewWhatsappResults?: (applicationId: string) => void, isOverlay?: boolean, locale?: string, isSelected?: boolean, onSelect?: (id: string, checked: boolean) => void }) {
  if (!result || !result.candidates) return null;
  const candidate = result.candidates;
  const score = result.analysis_results?.final_score || 0;
  const status = result.status;
  
  const scoreColor = score >= 80 ? 'text-[#22C55E]' : score >= 60 ? 'text-[#EAB308]' : 'text-[#EF4444]';

  return (
    <div className={`bg-[#020617]/40 border ${isSelected ? 'border-[#0EA5E9]/80 ring-1 ring-[#0EA5E9]/50 bg-[#0EA5E9]/5' : 'border-[#1E293B]/50'} rounded-xl p-4 transition-all hover:border-[#0EA5E9]/30 hover:shadow-lg hover:shadow-[#0EA5E9]/5 cursor-grab active:cursor-grabbing group relative overflow-hidden ${isOverlay ? 'scale-105 rotate-2 shadow-2xl bg-[#1E293B]' : ''}`}>
      {onSelect && (
        <div className="absolute top-2 start-2 z-10" onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            className="w-4 h-4 rounded border-slate-600 text-[#0EA5E9] focus:ring-[#0EA5E9] bg-slate-800"
            checked={isSelected}
            onChange={(e) => onSelect(candidate.id, e.target.checked)}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
      {/* Background Score Glow */}
      {status === 'analyzed' && (
        <div className={`absolute top-0 end-0 w-16 h-16 opacity-5 bg-gradient-to-br ${score >= 80 ? 'from-emerald-500' : score >= 60 ? 'from-amber-500' : 'from-red-500'} blur-2xl -translate-y-8 translate-x-8`} />
      )}

      <div className="flex items-start justify-between gap-3 mb-2 relative z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <h4 className="font-bold text-slate-100 text-sm truncate group-hover:text-white transition-colors">
              {candidate.name}
            </h4>
            {result.analysis_results?.is_fresh_graduate && (
              <span className="bg-[#0EA5E9]/20 text-[#0EA5E9] text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-[#0EA5E9]/30 flex items-center gap-1">
                <GraduationCap className="w-2.5 h-2.5" />
                {result.analysis_results.gpa_score ? `${result.analysis_results.gpa_score}%` : ''}
              </span>
            )}
            {status === 'failed' && (
              <span className="bg-rose-500/20 text-rose-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-rose-500/30 flex items-center gap-1" title={result.ai_error}>
                <AlertTriangle className="w-2.5 h-2.5" />
                !
              </span>
            )}
            {status === 'pending' && (
              <span className="bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
            <Mail className="w-2.5 h-2.5 text-slate-600" />
            {candidate.email}
          </p>
        </div>
        <div className={`text-base font-black ${scoreColor} leading-none flex items-center gap-2`}>
          {status === 'analyzed' ? score : '--'}
          {onDelete && !isOverlay && (
            <button
              onClick={(e) => {
                e.stopPropagation(); 
                if (candidate.id) {
                  onDelete(candidate.id, candidate.name); 
                }
              }}
              className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-600 hover:text-red-500 transition-colors pointer-events-auto"
              title="Delete Candidate"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-3 relative z-10">
        {result.analysis_results?.tags?.slice(0, 2).map((tag: string, i: number) => (
          <span key={i} className="px-1.5 py-0.5 bg-[#0F172A] text-slate-400 text-[9px] font-medium rounded-md border border-[#1E293B] uppercase group-hover:border-[#334155]">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[#1E293B]/50 relative z-10">
        <div className="flex items-center gap-1">
          {status === 'failed' ? (
            <div className="text-rose-400 text-[9px] font-bold truncate max-w-[150px]">
               Critical AI Error
            </div>
          ) : status === 'pending' ? (
            <div className="text-amber-400 text-[9px] font-bold">
               AI Processing...
            </div>
          ) : (
            <div className={`ps-2.5 pe-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
              result.analysis_results?.recommendation === 'Strong' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
              result.analysis_results?.recommendation === 'Average' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
              'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {result.analysis_results?.recommendation || 'N/A'}
            </div>
          )}
        </div>
        {onViewWhatsappResults && result.pipeline_stage === 'WhatsApp Verification' && (
          <button
            onClick={(e) => { e.stopPropagation(); onViewWhatsappResults(result.id); }}
            className="px-2 py-0.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded-md text-[9px] font-bold transition-colors cursor-pointer"
          >
            {t.whatsapp_verification || 'View Results'}
          </button>
        )}
        {onVerifyWhatsapp && result.pipeline_stage !== 'WhatsApp Verification' && (
          <button
            onClick={(e) => { e.stopPropagation(); onVerifyWhatsapp(result.id); }}
            className="flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-400 rounded-lg text-[9px] font-bold hover:bg-green-600/30 transition-colors cursor-pointer"
            title="Verify via WhatsApp"
          >
            <MessageCircle className="w-3 h-3" />
          </button>
        )}
        <div className="text-[9px] font-medium text-slate-600 group-hover:text-slate-400 transition-colors">
          {new Date(result.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

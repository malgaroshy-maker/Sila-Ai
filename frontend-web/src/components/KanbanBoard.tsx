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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, User, Mail, Star, 
  CheckCircle2, XCircle, Clock, 
  MessageSquare, Award, Loader2, GraduationCap, Trash2
} from 'lucide-react';

const STAGES = [
  { id: 'Applied', label: 'Applied', color: 'slate' },
  { id: 'Screening', label: 'Screening', color: 'blue' },
  { id: 'Interview', label: 'Interview', color: 'indigo' },
  { id: 'Offered', label: 'Offered', color: 'amber' },
  { id: 'Hired', label: 'Hired', color: 'emerald' },
  { id: 'Rejected', label: 'Rejected', color: 'rose' },
];

interface AnalysisResult {
  id: string;
  final_score: number;
  skills_score: number;
  language_score: number;
  gpa_score?: number;
  ind_readiness_score: number;
  recommendation: string;
  strengths: string[];
  weaknesses: string[];
  tags?: string[];
  flags?: string[];
  interview_questions?: string[];
  training_suggestions?: string[];
  justification?: string;
  is_fresh_graduate?: boolean;
  applications: {
    id: string;
    job_id: string;
    pipeline_stage: string;
    candidates: {
      id: string;
      name: string;
      email: string;
    };
  };
  created_at: string;
}

interface KanbanProps {
  results: AnalysisResult[];
  onStageChange: (applicationId: string, newStage: string) => Promise<void>;
  onDelete?: (candidateId: string, name: string) => Promise<void>;
  t: Record<string, string>;
  locale?: string;
}

export default function KanbanBoard({ results, onStageChange, onDelete, t, locale = 'en' }: KanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const grouped = useMemo(() => {
    const map: Record<string, AnalysisResult[]> = {};
    STAGES.forEach(s => map[s.id] = []);
    results.forEach(r => {
      const stage = r.applications.pipeline_stage || 'Applied';
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
      // Find where we dropped
      let newStage: string | null = null;
      
      if (STAGES.find(s => s.id === over.id)) {
        // Dropped directly on a column
        newStage = over.id as string;
      } else {
        // Dropped on another item, find its column
        const overResult = results.find(r => r.id === over.id);
        if (overResult) {
          newStage = overResult.applications.pipeline_stage || 'Applied';
        }
      }

      if (newStage) {
        const activeResult = results.find(r => r.id === active.id);
        if (activeResult && activeResult.applications.pipeline_stage !== newStage) {
          onStageChange(activeResult.applications.id, newStage);
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
            locale={locale}
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

function KanbanColumn({ stage, items, t, onDelete, locale }: { stage: { id: string, label: string, color: string }, items: AnalysisResult[], t: Record<string, string>, onDelete?: (id: string, name: string) => Promise<void>, locale?: string }) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  });

  const getStageColor = (color: string) => {
    const colors: Record<string, string> = {
      slate: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
      blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      indigo: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
      amber: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
      emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
      rose: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    };
    return colors[color] || colors.slate;
  };

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
              <SortableCandidateCard key={item.id} result={item} onDelete={onDelete} locale={locale} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

function SortableCandidateCard({ result, onDelete, locale }: { result: AnalysisResult, onDelete?: (id: string, name: string) => Promise<void>, locale?: string }) {
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
      <CandidateCard result={result} onDelete={onDelete} locale={locale} />
    </div>
  );
}

function CandidateCard({ result, onDelete, isOverlay = false, locale = 'en' }: { result: AnalysisResult | undefined, onDelete?: (id: string, name: string) => Promise<void>, isOverlay?: boolean, locale?: string }) {
  if (!result) return null;
  const candidate = result.applications.candidates;
  const score = result.final_score;
  const scoreColor = score >= 80 ? 'text-[#22C55E]' : score >= 60 ? 'text-[#EAB308]' : 'text-[#EF4444]';

  return (
    <div className={`bg-[#020617]/40 border border-[#1E293B]/50 rounded-xl p-4 transition-all hover:border-[#0EA5E9]/30 hover:shadow-lg hover:shadow-[#0EA5E9]/5 cursor-grab active:cursor-grabbing group relative overflow-hidden ${isOverlay ? 'scale-105 rotate-2 shadow-2xl bg-[#1E293B]' : ''}`}>
      {/* Background Score Glow */}
      <div className={`absolute top-0 end-0 w-16 h-16 opacity-5 bg-gradient-to-br ${score >= 80 ? 'from-emerald-500' : score >= 60 ? 'from-amber-500' : 'from-red-500'} blur-2xl -translate-y-8 translate-x-8`} />

      <div className="flex items-start justify-between gap-3 mb-2 relative z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <h4 className="font-bold text-slate-100 text-sm truncate group-hover:text-white transition-colors">
              {candidate.name}
            </h4>
            {result.is_fresh_graduate && (
              <span className="bg-[#0EA5E9]/20 text-[#0EA5E9] text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border border-[#0EA5E9]/30 flex items-center gap-1">
                <GraduationCap className="w-2.5 h-2.5" />
                {result.gpa_score ? `${result.gpa_score}%` : ''}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
            <Mail className="w-2.5 h-2.5 text-slate-600" />
            {candidate.email}
          </p>
        </div>
        <div className={`text-base font-black ${scoreColor} leading-none flex items-center gap-2`}>
          {score}
          {onDelete && !isOverlay && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(result.applications.candidates.id, candidate.name);
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
        {result.tags?.slice(0, 2).map((tag: string, i: number) => (
          <span key={i} className="px-1.5 py-0.5 bg-[#0F172A] text-slate-400 text-[9px] font-medium rounded-md border border-[#1E293B] uppercase group-hover:border-[#334155]">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[#1E293B]/50 relative z-10">
        <div className="flex items-center gap-1">
          <div className={`ps-2.5 pe-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
            result.recommendation === 'Strong' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
            result.recommendation === 'Average' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
            'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {result.recommendation}
          </div>
        </div>
        <div className="text-[9px] font-medium text-slate-600 group-hover:text-slate-400 transition-colors">
          {new Date(result.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { X, Key, Cpu, Save, Loader2, Mail, LayoutTemplate, RefreshCw, Bell, Shield, Languages, Target, History } from 'lucide-react';

interface Model {
  model_id: string;
  display_name: string;
  category: string;
  is_preview?: boolean;
  badge?: string;
}

export default function SettingsModal({ isOpen, onClose, userEmail, t = {} }: { isOpen: boolean, onClose: () => void, userEmail: string, t?: Record<string, string> }) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [aiMode, setAiMode] = useState<'balanced' | 'strict'>('balanced');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [exceptionalThreshold, setExceptionalThreshold] = useState(90);
  const [rejectThreshold, setRejectThreshold] = useState(50);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'update' | 'skip' | 'new'>('update');
  const [analysisLanguage, setAnalysisLanguage] = useState<'BH' | 'EN' | 'AR'>('BH');
  const [chatLanguage, setChatLanguage] = useState<'BH' | 'EN' | 'AR'>('BH');
  const [evaluationFocus, setEvaluationFocus] = useState<'balanced' | 'technical' | 'career'>('balanced');
  const [syncFrequency, setSyncFrequency] = useState<'manual' | '1h' | '6h' | '24h'>('6h');
  const [maskPii, setMaskPii] = useState(true);
  const [provider, setProvider] = useState<string>('google');
  const [connectedEmail, setConnectedEmail] = useState<string>('');
  
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const isLoading = isSettingsLoading || isModelsLoading;
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen && userEmail) {
      fetchSettings();
    }
  }, [isOpen, userEmail]);

  const fetchSettings = async () => {
    if (!userEmail) return;
    console.log('Fetching settings for:', userEmail);
    setIsSettingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/settings`, {
        headers: { 'x-user-email': userEmail }
      });
      const data = await res.json();
      setApiKey(data.gemini_api_key || '');
      setSelectedModel(data.gemini_model || '');
      
      if (data) {
        setAiMode(data.ai_mode || 'balanced');
        setWebhookUrl(data.webhook_url || '');
        setExceptionalThreshold(parseInt(data.exceptional_threshold) || 90);
        setRejectThreshold(parseInt(data.reject_threshold) || 50);
        setDuplicateStrategy(data.duplicate_strategy || 'update');
        setAnalysisLanguage(data.analysis_language || 'BH');
        setChatLanguage(data.chat_language || 'BH');
        setEvaluationFocus(data.evaluation_focus || 'balanced');
        setSyncFrequency(data.sync_frequency || '6h');
        setMaskPii(data.mask_pii !== false); // Default to true
        setProvider(data.email_provider || 'google');
        setConnectedEmail(data.connected_email || userEmail);
      }
      
      if (data.gemini_api_key) {
        fetchModels(data.gemini_api_key);
      }
    } catch (e) {
      console.error('Failed to fetch settings', e);
    } finally {
      setIsSettingsLoading(false);
    }
  };

  const fetchModels = async (key: string) => {
    // We now fetch the curated catalog from our own backend
    setIsModelsLoading(true);
    try {
      const res = await fetch(`${API_URL}/ai/models`, {
        headers: { 'x-user-email': userEmail }
      });
      if (!res.ok) throw new Error('Failed to fetch model catalog');
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setAvailableModels(data);
        const modelExists = data.some(m => m.model_id === selectedModel);
        if (data.length > 0 && (!selectedModel || !modelExists)) {
          if (!selectedModel) {
            setSelectedModel(data[0].model_id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch models', e);
    } finally {
      setIsModelsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey) {
      setMessage('API Key is required to save settings.');
      return;
    }
    setIsSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/settings/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
        body: JSON.stringify({
          gemini_api_key: apiKey,
          gemini_model: selectedModel,
          ai_mode: aiMode,
          webhook_url: webhookUrl,
          exceptional_threshold: exceptionalThreshold.toString(),
          reject_threshold: rejectThreshold.toString(),
          duplicate_strategy: duplicateStrategy,
          analysis_language: analysisLanguage,
          chat_language: chatLanguage,
          evaluation_focus: evaluationFocus,
          sync_frequency: syncFrequency,
          mask_pii: maskPii
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save');
      }
      
      setMessage('Settings saved successfully!');
      // Trigger a refresh event for the QuotaMonitor component to update immediately
      window.dispatchEvent(new CustomEvent('refresh-quota'));
      setTimeout(() => onClose(), 1500);
    } catch (e: any) {
      setMessage(`Save failed: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0F172A] rounded-2xl w-full max-w-md shadow-2xl border border-[#1E293B] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#1E293B] flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="bg-[#0369A1]/20 text-[#0EA5E9] p-2 rounded-lg">
              <Cpu className="w-5 h-5" />
            </span>
            {t.settings || 'Settings'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-2 rounded-lg cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {connectedEmail && (
            <div className={`rounded-2xl p-4 border flex items-center justify-between shadow-sm transition-all ${provider === 'microsoft' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl shadow-inner ${provider === 'microsoft' ? 'bg-white/10' : 'bg-indigo-500/20'}`}>
                  {provider === 'microsoft' ? (
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" className="w-5 h-5 drop-shadow-sm">
                        <path fill="#f35325" d="M1 1h10v10H1z"/>
                        <path fill="#81bc06" d="M12 1h10v10H12z"/>
                        <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                        <path fill="#ffba08" d="M12 12h10v10H12z"/>
                     </svg>
                  ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 drop-shadow-sm">
                        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                        <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
                        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                     </svg>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-0.5">{t.account_connected || 'Connected Account'}</p>
                  <p className="text-sm font-black text-slate-200">{connectedEmail}</p>
                </div>
              </div>
            </div>
          )}

          {/* Section: AI Configuration */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-[#0EA5E9] uppercase tracking-widest flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              {t.ai_config || 'AI Configuration'}
            </h3>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-slate-400" />
                {t.api_key || 'Gemini API Key'}
              </label>
                <input 
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onBlur={() => fetchModels(apiKey)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-2.5 rounded-lg border border-[#1E293B] bg-[#020617] text-white focus:ring-2 focus:ring-[#0369A1] outline-none transition-all placeholder-slate-500"
                />
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#0EA5E9] hover:text-[#38BDF8] flex items-center gap-1 mt-1 transition-colors w-fit"
                >
                  <Key className="w-3 h-3" />
                  {t.get_api_key_link || t.api_key_hint || 'Get your API key from Google AI Studio'}
                </a>
              </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Target className="w-4 h-4 text-slate-400" />
                  {t.ai_model || 'AI Model'}
                </label>
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#1E293B] bg-[#020617] text-white focus:ring-1 focus:ring-[#0369A1] outline-none transition-all cursor-pointer"
                >
                  {availableModels.length > 0 ? (
                    <>
                      {/* Grouping by Category */}
                      {Array.from(new Set(availableModels.map(m => m.category))).map(cat => (
                        <optgroup key={cat} label={t[`category_${cat.toLowerCase().replace(/\s+/g, '_')}`] || cat} className="bg-[#0F172A] text-[#0EA5E9] font-bold">
                          {availableModels.filter(m => m.category === cat).map(m => (
                            <option key={m.model_id} value={m.model_id} className="text-white bg-[#020617]">
                              {m.display_name} {m.is_preview ? `(${t.preview || 'Preview'})` : ''} {m.badge ? `(${t[`badge_${m.badge.toLowerCase()}`] || m.badge})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </>
                  ) : (
                    <option value="models/gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite (Curating...)</option>
                  )}
                </select>
              </div>
              <button 
                type="button"
                onClick={() => fetchModels(apiKey)}
                disabled={isLoading || !apiKey}
                className="p-2.5 bg-[#1E293B] hover:bg-[#334155] rounded-lg text-slate-300 transition-colors self-end h-[42px]"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{t.analysis_language || 'Analysis Lang'}</label>
                <select 
                  value={analysisLanguage}
                  onChange={(e) => setAnalysisLanguage(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-[#1E293B] bg-[#020617] text-white text-sm"
                >
                  <option value="BH">{t.lang_bh || 'Bilingual'}</option>
                  <option value="EN">{t.lang_en || 'English'}</option>
                  <option value="AR">{t.lang_ar || 'Arabic'}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{t.chat_language || 'Chat Lang'}</label>
                <select 
                  value={chatLanguage}
                  onChange={(e) => setChatLanguage(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-[#1E293B] bg-[#020617] text-white text-sm"
                >
                  <option value="BH">{t.lang_bh || 'Bilingual'}</option>
                  <option value="EN">{t.lang_en || 'English'}</option>
                  <option value="AR">{t.lang_ar || 'Arabic'}</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{t.evaluation_focus || 'AI Evaluation Focus'}</label>
              <select 
                value={evaluationFocus}
                onChange={(e) => setEvaluationFocus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-[#1E293B] bg-[#020617] text-white text-sm"
              >
                <option value="balanced">{t.focus_balanced || 'Balanced'}</option>
                <option value="technical">{t.focus_technical || 'Technical'}</option>
                <option value="career">{t.focus_career || 'Career'}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">{t.ai_behavior || 'AI Behavior Mode'}</label>
              <div className="flex rounded-lg border border-[#1E293B] overflow-hidden p-1 bg-[#020617]">
                <button
                  onClick={() => setAiMode('balanced')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${aiMode === 'balanced' ? 'bg-[#0369A1] text-white' : 'text-slate-400'}`}
                >
                  {t.balanced || 'Balanced'}
                </button>
                <button
                  onClick={() => setAiMode('strict')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${aiMode === 'strict' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}
                >
                  {t.strict || 'Strict'}
                </button>
              </div>
            </div>
          </div>

          {/* Section: Notifications & Thresholds */}
          <div className="space-y-4 pt-4 border-t border-[#1E293B]">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {t.notifications || 'Notifications & Thresholds'}
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-300">{t.exceptional_threshold || 'Exceptional Score'}</label>
                  <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg shadow-inner">{exceptionalThreshold}%</span>
                </div>
                <input 
                  type="range" min="70" max="100" step="1"
                  value={exceptionalThreshold}
                  onChange={(e) => setExceptionalThreshold(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-indigo-500 shadow-inner"
                />
                <p className="text-[10px] font-medium text-slate-500 italic">{t.threshold_hint || 'Triggers email alerts for candidates scoring above this.'}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-300">{t.reject_threshold || 'Auto-Reject Below'}</label>
                  <span className="text-xs font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg shadow-inner">{rejectThreshold}%</span>
                </div>
                <input 
                  type="range" min="0" max="60" step="1"
                  value={rejectThreshold}
                  onChange={(e) => setRejectThreshold(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-rose-500 shadow-inner"
                />
                <p className="text-[10px] font-medium text-slate-500 italic">{t.reject_hint || 'Moves candidates below this score to rejected status.'}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">{t.webhook_title || 'Webhook Alert URL'}</label>
                <input 
                  type="url" 
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg px-4 py-2 text-sm text-slate-200 focus:border-[#0EA5E9] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Data & Sync */}
          <div className="space-y-4 pt-4 border-t border-[#1E293B]">
            <h3 className="text-xs font-bold text-teal-500 uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {t.data_privacy || 'Data & Sync'}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{t.duplicate_strategy || 'Duplicates'}</label>
                <select 
                  value={duplicateStrategy}
                  onChange={(e) => setDuplicateStrategy(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-[#1E293B] bg-[#020617] text-white text-sm"
                >
                  <option value="update">{t.strategy_update || 'Update'}</option>
                  <option value="skip">{t.strategy_skip || 'Skip'}</option>
                  <option value="new">{t.strategy_new || 'Separate'}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{t.sync_frequency || 'Sync Freq'}</label>
                <select 
                  value={syncFrequency}
                  onChange={(e) => setSyncFrequency(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-[#1E293B] bg-[#020617] text-white text-sm"
                >
                  <option value="manual">{t.sync_manual || 'Manual'}</option>
                  <option value="1h">{t.sync_1h || '1 Hour'}</option>
                  <option value="6h">{t.sync_6h || '6 Hours'}</option>
                  <option value="24h">{t.sync_24h || 'Daily'}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#020617] rounded-xl border border-[#1E293B]">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-white">{t.mask_pii || 'Privacy Masking'}</p>
                <p className="text-[10px] text-slate-500">{t.privacy_hint || 'Hides PII in AI reports.'}</p>
              </div>
              <button 
                onClick={() => setMaskPii(!maskPii)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${maskPii ? 'bg-[#0EA5E9]' : 'bg-[#1E293B]'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${maskPii ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {message && (
            <p className={`text-sm font-medium ${message.includes('success') ? 'text-[#22C55E]' : 'text-red-400'}`}>
              {message}
            </p>
          )}

          <div className="p-6 border-t border-white/5 bg-[#020617]/50 rounded-b-[2rem] flex gap-3">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl cursor-pointer transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-[0.98]"
            >
              {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> {t.saving || 'Saving...'}</> : <><Save className="w-5 h-5" /> {t.save_settings || t.save || 'Save Settings'}</>}
            </button>
            <button 
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold py-3.5 px-4 rounded-xl cursor-pointer transition-all active:scale-[0.98]"
            >
              {t.cancel || 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

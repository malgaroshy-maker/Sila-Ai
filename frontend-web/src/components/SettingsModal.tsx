'use client';

import { useState, useEffect } from 'react';
import { X, Key, Cpu, Save, Loader2, Mail, LayoutTemplate, RefreshCw } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, userEmail, t = {} }: { isOpen: boolean, onClose: () => void, userEmail: string, t?: any }) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [aiMode, setAiMode] = useState<'balanced' | 'strict'>('balanced');
  const [webhookUrl, setWebhookUrl] = useState('');
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
    if (!key || !userEmail) {
      setAvailableModels([]);
      return;
    }
    console.log('Fetching models for:', userEmail, 'with key:', key);
    setIsModelsLoading(true);
    try {
      const res = await fetch(`${API_URL}/settings/models?apiKey=${key}`, {
        headers: { 'x-user-email': userEmail }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Invalid API key or network error');
      }
      const data = await res.json();
      console.log('Models found:', data);
      if (Array.isArray(data)) {
        setAvailableModels(data);
        if (data.length > 0 && !selectedModel) {
          setSelectedModel(data[0].name);
        }
      }
    } catch (e) {
      console.error('Failed to fetch models', e);
      setAvailableModels([]);
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
          webhook_url: webhookUrl
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save');
      }
      
      setMessage('Settings saved successfully!');
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
        
        <div className="p-6 space-y-5">
          {userEmail && (
            <div className="bg-[#0369A1]/10 rounded-xl p-4 border border-[#0369A1]/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-[#0369A1]/20 p-2 rounded-lg">
                  <Mail className="w-5 h-5 text-[#0EA5E9]" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium tracking-wider uppercase mb-0.5">{t.account_connected || 'Connected Account'}</p>
                  <p className="text-sm font-bold text-white">{userEmail}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">{t.webhook_title || 'Webhook Alert URL'}</label>
              <div className="flex gap-2">
                <input 
                  type="url" 
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full bg-[#0F172A] border border-[#1E293B] rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-[#0EA5E9] transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed italic">
                {t.webhook_hint || 'Optional: We will send candidates with score 90%+ to this URL.'}
              </p>
            </div>

          <div className="space-y-2 pt-2">
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
            <p className="text-[10px] text-slate-500 italic mt-1">
              {t.api_key_hint || 'Get your free Gemini API key from'} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[#0EA5E9] hover:underline">Google AI Studio</a>
            </p>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-400" />
                {t.ai_model || 'AI Model'}
              </label>
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-[#1E293B] bg-[#020617] text-white focus:ring-1 focus:ring-[#0369A1] outline-none transition-all cursor-pointer"
              >
                {availableModels.length > 0 ? (
                  availableModels.map((m) => (
                    <option key={m.name} value={m.name}>{m.displayName || m.name}</option>
                  ))
                ) : (
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Default)</option>
                )}
              </select>
            </div>
            <button 
              type="button"
              onClick={() => fetchModels(apiKey)}
              disabled={isLoading || !apiKey}
              className="p-2.5 bg-[#1E293B] hover:bg-[#334155] rounded-lg text-slate-300 transition-colors self-end h-[42px]"
              title={t.reload_models || 'Reload Models'}
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 italic mt-1">
            {isLoading ? (t.checking_models || 'Checking API models...') : availableModels.length > 0 ? `${availableModels.length} ${t.models_found || 'models found'}.` : 'Showing system default model.'}
          </p>

          <div className="space-y-2 pt-2">
            <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-slate-400" />
              {t.ai_behavior || 'AI Behavior Mode'}
            </label>
            <div className="flex rounded-lg border border-[#1E293B] overflow-hidden p-1 bg-[#020617]">
              <button
                disabled={isLoading}
                onClick={() => setAiMode('balanced')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  aiMode === 'balanced' 
                    ? 'bg-[#0369A1] text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]/50'
                }`}
              >
                {t.balanced || 'Balanced'}
              </button>
              <button
                disabled={isLoading}
                onClick={() => setAiMode('strict')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  aiMode === 'strict' 
                    ? 'bg-rose-500 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1E293B]/50'
                }`}
              >
                {t.strict || 'Strict'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 px-1">
              {aiMode === 'balanced' 
                ? (t.balanced_desc || 'Balanced mode gracefully evaluates missing requirements.') 
                : (t.strict_desc || 'Strict mode severely penalizes missing key skills.')}
            </p>
          </div>

          {message && (
            <p className={`text-sm font-medium ${message.includes('success') ? 'text-[#22C55E]' : 'text-red-400'}`}>
              {message}
            </p>
          )}

          <div className="pt-4 border-t border-[#1E293B] flex gap-3">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 bg-[#0369A1] hover:bg-[#0369A1]/80 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg cursor-pointer transition-all shadow-lg shadow-[#0369A1]/20"
            >
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.saving || 'Saving...'}</> : <><Save className="w-4 h-4" /> {t.save || 'Save'}</>}
            </button>
            <button 
              onClick={onClose}
              className="flex-1 bg-[#020617] hover:bg-[#1E293B] text-slate-300 font-semibold py-2.5 px-4 rounded-lg cursor-pointer transition-all"
            >
              {t.cancel || 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

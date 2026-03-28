'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Brain, Trash2, X, Send, Trophy, BarChart3, Target, HelpCircle, MessageSquare, Plus, History, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BrandLogo from './BrandLogo';
import BrandSpinner from './BrandSpinner';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    suggestions?: Array<{
      label: string;
      prompt: string;
      action?: string;
    }>;
  };
}

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
}

export default function ChatDrawer({ isOpen, onClose, t, userEmail }: { isOpen: boolean; onClose: () => void; t?: Record<string, string>; userEmail: string; }) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load sessions on mount
  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/chat/sessions`, {
        headers: { 'x-user-email': userEmail }
      });
      const data = await res.json();
      setSessions(data || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const loadSession = async (id: string) => {
    setIsInitialLoading(true);
    setActiveSessionId(id);
    try {
      const res = await fetch(`${API_URL}/chat/sessions/${id}/messages`, {
        headers: { 'x-user-email': userEmail }
      });
      const data = await res.json();
      setMessages(data.map((m: any) => ({
        role: m.role,
        content: m.content,
        metadata: m.metadata
      })));
      // Close sidebar on mobile after selection
      if (window.innerWidth < 768) setShowSidebar(false);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setShowSidebar(false);
    inputRef.current?.focus();
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t?.chat_delete_confirm || 'Delete this conversation?')) return;
    
    try {
      await fetch(`${API_URL}/chat/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'x-user-email': userEmail }
      });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const setQuickPrompt = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const sendMessage = async (overrideMessage?: string) => {
    const textToSend = overrideMessage || input.trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ 
        role: m.role === 'user' ? 'user' : 'model', 
        text: m.content 
      }));

      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
        body: JSON.stringify({ 
          message: textToSend, 
          history,
          sessionId: activeSessionId 
        })
      });

      const data = await res.json();
      
      if (!activeSessionId && data.sessionId) {
        setActiveSessionId(data.sessionId);
        fetchSessions(); // Refresh sidebar title
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response || (t?.chat_no_response || 'No response'),
        metadata: data.suggestions ? { suggestions: data.suggestions } : undefined
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: (t?.chat_error || 'Connection error. Please try again.') }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { icon: <Trophy className="w-4 h-4 text-amber-400" />, text: t?.chat_prompt_1 || 'Best 3 candidates' },
    { icon: <BarChart3 className="w-4 h-4 text-[#0EA5E9]" />, text: t?.chat_prompt_2 || 'Compare all candidates' },
    { icon: <Target className="w-4 h-4 text-[#22C55E]" />, text: t?.chat_prompt_3 || 'Who fits culture best?' },
    { icon: <HelpCircle className="w-4 h-4 text-violet-400" />, text: t?.chat_prompt_4 || 'Suggest interview questions' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      {/* Drawer Container */}
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-4xl bg-[#0F172A] flex shadow-2xl h-full"
      >
        {/* Recent Chats Sidebar */}
        <AnimatePresence initial={false}>
          {showSidebar && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-e border-[#1E293B] bg-[#020617]/50 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
                  <History className="w-4 h-4" />
                  {t?.chat_sessions || 'Recent Chats'}
                </div>
                <button 
                  onClick={startNewChat}
                  className="p-1.5 hover:bg-[#1E293B] rounded-lg text-[#22C55E] transition-colors"
                  title={t?.chat_new || "New Chat"}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">{t?.chat_no_sessions || 'No recent chats'}</p>
                  </div>
                ) : (
                  sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => loadSession(s.id)}
                      className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-start text-sm transition-all ${
                        activeSessionId === s.id 
                          ? 'bg-[#0369A1]/20 text-[#0EA5E9] border border-[#0369A1]/30' 
                          : 'text-slate-400 hover:bg-[#1E293B] hover:text-slate-200'
                      }`}
                    >
                      <MessageSquare className={`w-4 h-4 flex-shrink-0 ${activeSessionId === s.id ? 'text-[#0EA5E9]' : 'text-slate-600'}`} />
                      <span className="flex-1 truncate font-medium">{s.title || 'Untitled Chat'}</span>
                      <X 
                        className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all" 
                        onClick={(e) => deleteSession(e, s.id)}
                      />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3 bg-background/50 backdrop-blur-md">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 -ms-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
              title={t?.chat_history || "Toggle History"}
            >
              <History className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <BrandLogo size="sm" />
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white truncate">{t?.chat_title || 'SILA Assistant'}</h2>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{t?.chat_subtitle || 'Neural Recruitment Engine'}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {activeSessionId && (
                <button onClick={() => { setMessages([]); setActiveSessionId(null); }} className="text-slate-500 hover:text-amber-400 p-2 rounded-lg transition-colors" title={t?.chat_clear || "Clear"}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="text-slate-500 hover:text-white p-2 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {messages.length === 0 && !isInitialLoading && (
              <div className="max-w-md mx-auto text-center py-12">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-6 flex justify-center"
                >
                  <BrandLogo size="lg" />
                </motion.div>
                <h3 className="text-xl font-bold text-white mb-2">{t?.chat_empty_title || 'SILA Intelligence'}</h3>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">{t?.chat_empty_desc || 'I have access to your candidate database. Ask me to compare, summarize, or suggest next steps.'}</p>
                
                <div className="grid grid-cols-1 gap-2">
                  {quickPrompts.map((prompt, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => setQuickPrompt(prompt.text)}
                      className="flex items-center gap-3 w-full text-start px-4 py-3 bg-[#020617]/50 hover:bg-[#1E293B] border border-[#1E293B]/50 rounded-xl text-slate-300 text-sm transition-all group"
                    >
                      <span className="p-1.5 rounded-lg bg-[#1E293B] group-hover:bg-[#0369A1]/20 transition-colors">
                        {prompt.icon}
                      </span>
                      <span className="flex-1 font-medium">{prompt.text}</span>
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#0EA5E9] transition-all" />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {isInitialLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <BrandSpinner size={48} />
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-[#0369A1] text-white rounded-br-sm'
                        : 'bg-[#020617] text-slate-200 border border-[#1E293B] rounded-bl-sm'
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>

                    {/* Meta-Actions (Suggestions) */}
                    {msg.role === 'assistant' && msg.metadata?.suggestions && msg.metadata.suggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-500 delay-300">
                        {msg.metadata.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => sendMessage(suggestion.prompt)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#22C55E]/10 hover:bg-[#22C55E]/20 border border-[#22C55E]/30 rounded-full text-[#22C55E] text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                          >
                            <Target className="w-3 h-3" />
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="max-w-3xl mx-auto flex justify-start">
                <div className="bg-[#020617] border border-[#1E293B] px-5 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse" />
                    <span className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse delay-75" />
                    <span className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse delay-150" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 sm:p-6 border-t border-[#1E293B] bg-[#0F172A]">
            <div className="max-w-3xl mx-auto flex gap-3">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={t?.chat_placeholder || "Ask about candidates..."}
                  className="w-full bg-[#020617] border border-[#1E293B] text-white text-sm ps-4 pe-12 py-3.5 rounded-xl focus:ring-2 focus:ring-[#0369A1] focus:border-transparent outline-none placeholder-slate-500 transition-all"
                  disabled={isLoading || isInitialLoading}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                  ) : (
                    <Bot className="w-5 h-5 text-slate-700" />
                  )}
                </div>
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || isInitialLoading || !input.trim()}
                className="bg-[#0369A1] hover:bg-[#0EA5E9] disabled:opacity-30 disabled:hover:bg-[#0369A1] text-white p-3.5 rounded-xl shadow-lg shadow-[#0369A1]/20 transition-all active:scale-95"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="max-w-3xl mx-auto mt-2 text-[10px] text-slate-500 text-center uppercase tracking-widest font-bold opacity-50">SILA Neural Assistant v2.0</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

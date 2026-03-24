'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Brain, Trash2, X, Send, Trophy, BarChart3, Target, HelpCircle } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export default function ChatDrawer({ isOpen, onClose, t, userEmail }: { isOpen: boolean; onClose: () => void; t?: Record<string, string>; userEmail: string; }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-email': userEmail },
        body: JSON.stringify({ message: trimmed, history })
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.response || (t?.chat_no_response || 'No response') }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: (t?.chat_error || 'Connection error. Please try again.') }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { icon: <Trophy className="w-4 h-4 text-amber-400" />, text: t?.chat_prompt_1 || 'Best 3 candidates' },
    { icon: <BarChart3 className="w-4 h-4 text-[#0EA5E9]" />, text: t?.chat_prompt_2 || 'Compare all candidates' },
    { icon: <Target className="w-4 h-4 text-[#22C55E]" />, text: t?.chat_prompt_3 || 'Who is ready to work immediately?' },
    { icon: <HelpCircle className="w-4 h-4 text-violet-400" />, text: t?.chat_prompt_4 || 'Suggest interview questions for top candidate' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-[#0F172A] border-s border-[#1E293B] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1E293B] flex items-center gap-3">
          <span className="bg-[#22C55E]/20 text-[#22C55E] p-2 rounded-lg">
            <Bot className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">{t?.chat_title || 'AI Recruitment Assistant'}</h2>
            <p className="text-slate-500 text-xs">{t?.chat_subtitle || 'Ask anything about your candidates'}</p>
          </div>
          <button onClick={() => { setMessages([]); }} className="text-slate-500 hover:text-amber-400 p-2 rounded-lg cursor-pointer transition-colors" title={t?.chat_clear || "Clear chat"}>
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-2 rounded-lg cursor-pointer transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#22C55E]/10 mb-4">
                <Brain className="w-8 h-8 text-[#22C55E]" />
              </div>
              <h3 className="text-slate-300 font-semibold mb-2">{t?.chat_empty_title || 'AI Recruitment Brain'}</h3>
              <p className="text-slate-500 text-sm mb-6">{t?.chat_empty_desc || 'I have access to all your candidates and analysis data. Ask me anything!'}</p>
              <div className="space-y-2">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(prompt.text); }}
                    className="flex items-center gap-3 w-full text-start px-4 py-2.5 bg-[#020617]/50 hover:bg-[#1E293B] border border-[#1E293B]/50 rounded-lg text-slate-300 text-sm cursor-pointer transition-all"
                  >
                    {prompt.icon}
                    {prompt.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#0369A1] text-white rounded-br-md'
                  : 'bg-[#020617] text-slate-200 border border-[#1E293B] rounded-bl-md'
              }`}>
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#020617] border border-[#1E293B] px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#1E293B]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={t?.chat_placeholder || "Ask about candidates..."}
              className="flex-1 bg-[#020617] border border-[#1E293B] text-white text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#0369A1] focus:border-transparent outline-none placeholder-slate-500"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="bg-[#0369A1] hover:bg-[#0369A1]/80 disabled:opacity-40 text-white px-4 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

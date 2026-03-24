'use client';

import { supabase } from '../../../lib/supabase';
import { useState } from 'react';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const handleLogin = (provider: 'google' | 'azure') => {
    setIsLoading(provider);
    if (provider === 'google') {
      window.location.href = `${API_URL}/email/auth/google`;
    } else {
      window.location.href = `${API_URL}/email/auth/microsoft`;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-indigo-900 mb-2">Welcome Back</h1>
          <p className="text-gray-500">Sign in to the AI Recruitment System</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => handleLogin('google')} 
            disabled={!!isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            {isLoading === 'google' ? 'Connecting...' : 'Continue with Google (Gmail)'}
          </button>

          <button 
            onClick={() => handleLogin('azure')} 
            disabled={!!isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <img src="https://www.svgrepo.com/show/448234/microsoft.svg" alt="Microsoft" className="w-5 h-5" />
            {isLoading === 'azure' ? 'Connecting...' : 'Continue with Microsoft (Outlook)'}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-sm text-gray-400">
          Continuing will grant read access to your inbox for automated CV extraction.
        </div>
      </div>
    </div>
  );
}

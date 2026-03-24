import {setRequestLocale} from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import DashboardInteractive from '../../components/DashboardInteractive';

export const dynamic = 'force-dynamic';

export default async function Index({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!url || !key || !apiUrl) {
    const missing = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!key) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!apiUrl) missing.push('NEXT_PUBLIC_API_URL');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Please add them in Vercel and redeploy.`);
  }

  try {
    // Server-side Auth Guard using @supabase/ssr
    const cookieStore = await cookies();
    const supabase = createServerClient(
      url,
      key,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    // This call might throw if env vars are missing
    await supabase.auth.getUser();

    return <DashboardClient locale={locale} />;
  } catch (error) {
    console.error('Root Page Error:', error);
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Application Error</h1>
          <p className="text-slate-400 mb-6">
            Failed to initialize the recruitment dashboard. This is usually caused by missing environment variables (Supabase URL/Key).
          </p>
          <div className="bg-[#0F172A] p-4 rounded-lg border border-[#1E293B] text-xs text-left overflow-auto">
            <code>{String(error)}</code>
          </div>
        </div>
      </div>
    );
  }
}

async function DashboardClient({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'Index' });

  const jobs: any[] = [];
  const results: any[] = [];

  const keys = [
    'title', 'description', 'jobs', 'candidates', 'create_job', 'upload_cv', 
    'analysis_results', 'ai_chat', 'logout', 'settings', 'create_job_form', 
    'create_job_ai', 'job_title', 'job_desc', 'job_reqs', 'cancel', 'create', 
    'ai_prompt_hint', 'generating', 'generate_and_create', 'upload_desc', 
    'select_cv', 'upload_and_analyze', 'skills', 'language', 'gpa', 'readiness', 
    'ai_justification', 'strengths', 'weaknesses', 'tags', 'flags', 'interview_q', 
    'training', 'close', 'chat_title', 'chat_subtitle', 'chat_clear', 
    'chat_empty_title', 'chat_empty_desc', 'chat_placeholder', 'chat_no_response', 
    'chat_error', 'chat_prompt_1', 'chat_prompt_2', 'chat_prompt_3', 
    'chat_prompt_4', 'job_placeholder', 'req_placeholder',
    // New keys for localization fixes
    'kanban', 'list', 'applied', 'screening', 'interview', 'offered', 'hired', 
    'rejected', 'all_jobs', 'refresh', 'webhook_title', 'webhook_hint',
    'api_key', 'api_key_hint', 'ai_model', 'ai_behavior', 'balanced', 'strict', 'balanced_desc', 'strict_desc',
    'save', 'reload_models', 'checking_models', 'models_found', 'account_connected',
    'no_jobs', 'no_candidates', 'syncing', 'saving', 'insights'
  ];
  
  const translations: Record<string, string> = {};
  keys.forEach(k => {
    try { translations[k] = t(k as any); } catch { translations[k] = k; }
  });

  return <DashboardInteractive initialJobs={jobs || []} initialResults={results || []} t={translations} locale={locale} />;
}

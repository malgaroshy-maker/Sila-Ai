import {setRequestLocale} from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import DashboardInteractive from '../../components/DashboardInteractive';

export default async function Index({
  params
}: {
  params: Promise<{locale: string}>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Server-side Auth Guard using @supabase/ssr
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Note: Since the app also uses localStorage for user_email, 
  // we might still allow entry if there's no supabase user but the client-side check will handle the rest.
  // But for "automatically go to login", this is a good first step.
  // Actually, if we don't have a supabase user, we can't be sure, so we might skip redirection here 
  // and do it in DashboardInteractive if even localStorage is empty.
  
  return <DashboardClient locale={locale} />;
}

async function DashboardClient({ locale }: { locale: string }) {
  const t = await getTranslations('Index');

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
    'no_jobs', 'no_candidates', 'syncing', 'saving'
  ];
  
  const translations: Record<string, string> = {};
  keys.forEach(k => {
    try { translations[k] = t(k as any); } catch {}
  });

  return <DashboardInteractive initialJobs={jobs || []} initialResults={results || []} t={translations} locale={locale} />;
}

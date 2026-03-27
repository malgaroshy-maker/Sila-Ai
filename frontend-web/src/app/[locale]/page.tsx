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
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 text-center font-sans">
        <div className="max-w-md">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Application Error</h1>
          <p className="text-slate-400 mb-6 font-medium">
            Failed to initialize the recruitment dashboard. This is usually caused by missing environment variables (Supabase URL/Key) or authentication failure.
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
    'title', 'description', 'upload_cv', 'jobs', 'candidates', 'create_job', 'dashboard', 
    'analysis_results', 'ai_chat', 'logout', 'settings', 'create_job_form', 'create_job_ai', 
    'job_title', 'job_desc', 'job_reqs', 'cancel', 'create', 'ai_prompt_hint', 'generating', 
    'generate_and_create', 'upload_desc', 'select_cv', 'upload_and_analyze', 'skills', 
    'language', 'gpa', 'readiness', 'ai_justification', 'strengths', 'weaknesses', 'tags', 
    'flags', 'interview_q', 'training', 'close', 'chat_title', 'chat_subtitle', 'chat_clear', 
    'chat_empty_title', 'chat_empty_desc', 'chat_placeholder', 'chat_no_response', 
    'chat_error', 'chat_prompt_1', 'chat_prompt_2', 'chat_prompt_3', 'chat_prompt_4', 
    'job_placeholder', 'req_placeholder', 'kanban', 'list', 'applied', 'screening', 
    'interview', 'offered', 'hired', 'rejected', 'api_key', 'api_key_hint', 'ai_model', 
    'ai_behavior', 'balanced', 'strict', 'balanced_desc', 'strict_desc', 'save', 
    'reload_models', 'checking_models', 'models_found', 'account_connected', 'no_jobs', 
    'no_candidates', 'syncing', 'saving', 'insights', 'about', 'ai_config', 
    'job_details', 'requirements_title', 'job_desc_title', 'show_more', 'show_less', 
    'neural_intelligence', 'overview', 'strategic_prep', 'cultural_fit', 'project_impact', 
    'skills_match', 'career_trajectory_title', 'project_highlights_title', 'ai_analysis', 
    'recommended_questions', 'industry_roadmap', 'intelligence_pulse', 'fresh_grad_badge', 
    'fit_index', 'trajectory', 'highlights', 'academic_pulse', 'industry_readiness', 
    'cultural_fit_desc', 'project_impact_desc', 'view_cv', 'file_no_chosen', 'choose_file', 
    'downloading', 'downloaded', 'server_online', 'server_offline', 'server_checking', 
    'tokens_used', 'cvs_processed', 'industry_roadmap', 'improvement_areas',
    'welcome_title', 'welcome_step1', 'welcome_step2', 'welcome_step2_detail', 
    'welcome_step2_pro', 'welcome_step3', 'next', 'got_it', 'go_to_settings', 
    'sync_step_title', 'delete_confirm_job', 'delete_confirm_candidate', 'delete_candidate',
    'sync_frequency', 'analysis_language', 'chat_language', 'evaluation_focus',
    'duplicate_strategy', 'mask_pii', 'privacy_hint', 'threshold_hint', 'reject_hint',
    'exceptional_threshold', 'reject_threshold', 'webhook_title', 'webhook_hint',
    'notifications', 'data_privacy', 'strategy_update', 'strategy_skip', 'strategy_new',
    'lang_bh', 'lang_en', 'lang_ar', 'focus_balanced', 'focus_technical', 'focus_career',
    'sync_manual', 'sync_1h', 'sync_6h', 'sync_24h', 'badge_fastest', 'badge_strongest',
    'preview', 'save_settings', 'get_api_key_link', 'category_free_tier', 'category_trial', 
    'category_experimental', 'category_legacy', 'error_ai_failed', 'error_unknown', 
    'error_download_failed', 'error_connection_download'
  ];
  
  const translations: Record<string, string> = {};
  keys.forEach(k => {
    translations[k] = t(k);
  });

  return <DashboardInteractive initialJobs={jobs || []} initialResults={results || []} t={translations} locale={locale} />;
}

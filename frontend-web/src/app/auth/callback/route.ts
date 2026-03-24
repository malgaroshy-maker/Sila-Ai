import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    
    // Check if we got provider tokens
    if (data.session && data.session.provider_token) {
      // Send the provider_token and provider_refresh_token to our NestJS API
      // to store in the email_accounts table!
      try {
        await fetch(`${API_URL}/email/store-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: data.session.user.app_metadata.provider, // 'google' or 'azure'
            emailAddress: data.session.user.email,
            accessToken: data.session.provider_token,
            refreshToken: data.session.provider_refresh_token || null
          })
        });
      } catch (e) {
        console.error('Failed to sync provider token to backend:', e);
      }
    }
  }

  // URL to redirect to after sign in process completes
  // In Arabic locale by default
  return NextResponse.redirect(new URL('/ar', request.url))
}

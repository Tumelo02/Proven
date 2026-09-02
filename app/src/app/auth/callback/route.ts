import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

function safeNext(value: string | null): string {
  if (value?.startsWith('/') && !value.startsWith('//')) return value;
  return '/dashboard';
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeNext(requestUrl.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/sign-in?error=invalid-link', requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/sign-in?error=expired-link', requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { email, action, userId, fullName } = await request.json();

  try {
    const admin = createAdminClient();

    if (action === 'check') {
      // Get all users and find the one with matching email
      const { data: authData } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      const authUser = authData?.users.find((u) => u.email === email);

      if (!authUser) {
        return Response.json({
          status: 'NOT_FOUND',
          message: `No auth user found for ${email}`,
        });
      }

      // Check if profile exists
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      return Response.json({
        status: profile ? 'EXISTS' : 'MISSING',
        authUserId: authUser.id,
        email: authUser.email,
        profile: profile || null,
        createdAt: authUser.created_at,
      });
    }

    if (action === 'create') {
      const { data, error } = await admin.from('profiles').insert({
        id: userId,
        email,
        full_name: fullName,
      });

      if (error) {
        return Response.json({ success: false, error: error.message });
      }

      return Response.json({ success: true, message: 'Profile created' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: String(error) },
      { status: 500 },
    );
  }
}

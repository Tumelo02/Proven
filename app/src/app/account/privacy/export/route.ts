import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordEvent } from '@/lib/audit';

/**
 * POPIA section 23: a person may ask what is held about them and receive it.
 *
 * A route handler rather than a server action, because the answer is a file to
 * download rather than a screen to render. The gathering is done by the
 * `export_my_data` database function, which reads `auth.uid()` itself, so this
 * endpoint cannot be aimed at another person's records: there is no id to
 * tamper with in the request at all.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('export_my_data');

  if (error) {
    return NextResponse.json(
      { error: 'Could not prepare your data export.', detail: error.message },
      { status: 500 },
    );
  }

  await recordEvent({
    action: 'personal_data.exported',
    entityType: 'profile',
    entityId: user.id,
    severity: 'notice',
    detail: { reason: 'POPIA section 23 request' },
  });

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="proven-my-data-${stamp}.json"`,
      /* A copy of someone's financial records should not sit in a shared cache. */
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

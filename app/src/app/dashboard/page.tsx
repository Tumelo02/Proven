import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile, getMyBusinesses, getMyOrganisations } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/(auth)/actions';

/**
 * The front door after signing in.
 *
 * Someone who holds only one role is sent straight there: making a person
 * choose between one option is a wasted click. Only a user who is both an
 * entrepreneur and a funder sees the picker, and that is the screen "Switch
 * role" returns them to.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* Not signed in at all: back to the front door. */
  if (!user) redirect('/sign-in');

  const profile = await getCurrentProfile();

  /* Signed in, but no profile row. Only reachable if the `handle_new_user`
     trigger is missing, i.e. migration 3 has not run. Redirecting to sign-in
     here would bounce the user between two pages forever, so say what is
     wrong instead. */
  if (!profile) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Almost there</h1>
          <p className="sub">Your account works, but its profile is missing.</p>
          <div className="notice error">
            Signed in as {user.email}, with no matching profile row. That means
            the database is not fully set up: the trigger that creates a profile
            for every account lives in migration 3.
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            See <code>supabase/SETUP.md</code>, step 2, then sign in again.
          </p>
          <form action={signOut} style={{ marginTop: 14 }}>
            <button className="btn ghost block" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  const [businesses, orgs] = await Promise.all([getMyBusinesses(), getMyOrganisations()]);

  const hasBusinesses = businesses.length > 0;
  const hasOrgs = orgs.length > 0;

  /* Everyone goes straight to the one place they work.

     Proven staff land on the admin panel, even when they also belong to an
     organisation. Those are two different jobs: running the platform means
     seeing who is enrolled and whether they are reporting, never a funder's
     figures. Offering both on one screen invites a habit that the audit trail
     is built to catch. Anyone who does hold both can still reach the other
     side from the admin panel, deliberately rather than by default. */
  if (profile.is_platform_admin) redirect('/admin');

  if (!hasBusinesses && !hasOrgs) redirect('/businesses/new');
  if (hasBusinesses && !hasOrgs) redirect(`/business/${businesses[0]!.id}`);
  if (!hasBusinesses && hasOrgs) redirect(`/funder/${orgs[0]!.org.id}`);

  /* Only reached by someone who genuinely runs a business AND sits on a
     funder's staff, which is rare and worth asking about. */

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <h1>Welcome back, {profile.full_name || 'there'}</h1>
        <p className="sub">Choose where you would like to go.</p>

        <div style={{ display: 'grid', gap: 12 }}>
          {profile.is_platform_admin && (
            <Link className="btn navy block" href="/admin">
              Proven admin, everything across the platform
            </Link>
          )}

          {/* Only shown when there is something in them: an admin who owns no
              business should not see an empty heading. */}
          {hasBusinesses && (
            <section>
              <h3 style={{ fontSize: 13, marginBottom: 8 }}>Your businesses</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {businesses.map((b) => (
                  <Link key={b.id} className="btn ghost block" href={`/business/${b.id}`}>
                    {b.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {hasOrgs && (
            <section>
              <h3 style={{ fontSize: 13, marginBottom: 8, marginTop: 8 }}>
                Organisations you belong to
              </h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {orgs.map(({ org, role }) => (
                  <Link key={org.id} className="btn ghost block" href={`/funder/${org.id}`}>
                    {org.name}
                    {role === 'admin' && <span className="pill blue">Admin</span>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <Link className="btn block" href="/businesses/new">
            Add another business
          </Link>
        </div>

        <div className="auth-foot" style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
          <Link href="/account/privacy">Your data and privacy</Link>
          <form action={signOut}>
            <button
              type="submit"
              style={{
                background: 'none',
                border: 0,
                color: 'var(--muted)',
                font: 'inherit',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

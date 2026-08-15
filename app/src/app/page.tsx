import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Story } from './story';
import './home.css';

/**
 * The home page.
 *
 * Why Proven exists, told as a story: four beats of one business failing while
 * nobody is watching. The platform itself is one click further on, at
 * `/platform`.
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* Someone already signed in goes to their own dashboard: the front door
     should never be a dead end for a returning user. */
  if (user) redirect('/dashboard');

  return (
    <>
      <div className="topnav">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size
            brand mark; next/image would add a loader for no benefit here. */}
        <img
          className="mark"
          src="/assets/logo_only__1_-removebg-preview.png"
          alt="Proven logo"
        />
        <div className="nm">Proven</div>
      </div>

      <section className="hero">
        <div className="wrap">
          <div className="step">Turning Potential into Proof</div>
          <h1>A business can start failing long before anyone sees it.</h1>
          <p className="lede">
            Funding creates potential. But between check-ins, problems can grow
            silently.
          </p>

          {/* The pitch is told by clicking, not by reading. */}
          <Story />

          <p className="closer">
            <b>Proven breaks the gap.</b>
            By making business performance visible while there is still time to
            act, to the entrepreneur and the funder at the same time.
          </p>

          <div className="hero-cta">
            <Link className="cta primary" href="/platform">
              Open the platform
            </Link>
            <span className="cta-note">
              Choose your view next, entrepreneur or funder
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

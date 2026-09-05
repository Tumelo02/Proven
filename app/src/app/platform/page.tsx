import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import '../landing.css';

/**
 * The landing screen: the five-step journey, and the two entry points.
 *
 * A role picker rather than a menu. An entrepreneur and a funder need
 * different first screens, so the choice is made before sign-in.
 */

/* Each icon depicts its own step: a receipt for recording activity, an eye for
   visibility, and so on through to the badge for credit readiness. Inline SVG,
   so there is no icon font to load.

   The sequence starts at everyday trading, not at funding: a business earns
   its record first, and credit is what that record eventually unlocks. */
const STEPS = [
  {
    key: 'record-activity',
    label: 'Record Activity',
    path: (
      <>
        <path d="M6 3.2h12v17.6l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.8V3.2Z" />
        <path d="M9.2 8h5.6M9.2 12h5.6" />
      </>
    ),
  },
  {
    key: 'visibility',
    label: 'Visibility',
    path: (
      <>
        <path className="eye-outline" d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
        <circle className="eye-pupil" cx="12" cy="12" r="2.6" />
      </>
    ),
  },
  {
    key: 'guidance',
    label: 'Guidance',
    path: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path className="needle" d="M15.2 8.8 13.4 13.4 8.8 15.2l1.8-4.6 4.6-1.8Z" />
      </>
    ),
  },
  {
    key: 'record',
    label: 'Verified Track Record',
    path: (
      <>
        <path d="M6 3.5h9L19 7.5v13H6v-17Z" />
        <path d="M14.6 3.6v4.2h4.2" />
        <path className="tick" d="m9.2 14 2.1 2.1 4-4" />
      </>
    ),
  },
  {
    key: 'readiness',
    label: 'Credit Readiness',
    path: (
      <>
        <circle cx="12" cy="9.4" r="5.4" />
        <path d="m9.6 8.9 1.7 1.7 3-3" />
        <path d="m8.7 14.6-1.3 6 4.6-2.4 4.6 2.4-1.3-6" />
      </>
    ),
  },
];

/**
 * Deliberately does NOT redirect a signed-in user away.
 *
 * This is the screen a demonstration returns to when switching between the
 * entrepreneur and the funder view, so it has to stay reachable while signed
 * in. `/` sends returning users to their dashboard; this one does not.
 */
export default async function PlatformPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="landing">
      {/* Pinned to the corner rather than sitting in the flow, so it costs the
          centred column no vertical space. */}
      <Link className="to-launch" href="/">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ width: 14, height: 14 }}
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Back to Home
      </Link>

      <div className="mark">
        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size
            brand mark; next/image would add a loader for no benefit here. */}
        <img src="/assets/logo_only__1_-removebg-preview.png" alt="Proven logo" />
      </div>
      <div className="brandname">PROVEN</div>
      <div className="brandtag">Turning Activity into Proof</div>

      <h1>Prove your business is working.</h1>
      <p className="tagline">
        Everyday trading becomes a verified digital record, so a business that
        is already viable can finally show it.
      </p>

      <div className="journey">
        {STEPS.map((step, i) => (
          <div key={step.key} style={{ display: 'contents' }}>
            {/* Focusable, so the animations are reachable by keyboard as well
                as by pointer. */}
            <div className="step" data-step={step.key} tabIndex={0}>
              <div className="dot">
                <svg
                  className="ico"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {step.path}
                </svg>
                {step.key === 'readiness' && (
                  <span className="spark" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                <span className="no">{i + 1}</span>
              </div>
              <div className="lbl">{step.label}</div>
            </div>

            {i < STEPS.length - 1 && (
              <div className="arrow" aria-hidden="true">
                <svg
                  viewBox="0 0 34 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 6h27" strokeDasharray="3 3" />
                  <path d="m26.5 1.8 4.8 4.2-4.8 4.2" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="twosided-line">
        One system. Two views. The same evidence.
      </p>

      <div className="role-picks">
        <Link className="role-btn accent" href="/sign-in?role=entrepreneur">
          <div className="rb-ico">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3.6 9.4 5 4.6h14l1.4 4.8" />
              <path d="M4.6 9.4h14.8v9.8H4.6z" />
              <path d="M9.4 19.2v-5h5.2v5" />
            </svg>
          </div>
          <div className="rb-title">Enter as Entrepreneur</div>
          <div className="rb-sub">
            Record what your business does, see your own health score, and build
            a verified track record.
          </div>
        </Link>

        <Link className="role-btn" href="/sign-in?role=funder">
          <div className="rb-ico">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3.2 20.4h17.6" />
              <path d="M4.8 20.4v-6.2M9.6 20.4V9.4M14.4 20.4v-8.2M19.2 20.4V5.6" />
              <path d="m4.8 11.2 4.8-4.4 4.8 2.6 5.4-5.2" />
              <path d="M15.6 3.9h4.2v4.2" />
            </svg>
          </div>
          <div className="rb-title">Enter as Funder</div>
          <div className="rb-sub">
            Review verified evidence from the businesses you back, and see which
            are ready for what&rsquo;s next.
          </div>
        </Link>
      </div>

      <p className="landing-foot">
        {user ? (
          <>
            Already signed in. <Link href="/dashboard">Go to your dashboard</Link>
          </>
        ) : (
          <>
            Running your own business?{' '}
            <Link href="/sign-up">Create an account</Link>, funded or not.
          </>
        )}
        {/* Safe to show: `/admin` returns not-found to anyone without the
            platform-admin flag, which cannot be granted through the app. */}
        <br />
        <Link href="/admin" style={{ opacity: 0.75 }}>
          Proven staff
        </Link>
      </p>
    </div>
  );
}

import Link from 'next/link';
import { POLICY_VERSION } from '@/lib/policy';

export const metadata = {
  title: 'Privacy notice · Proven',
};

/**
 * The privacy notice, written to satisfy POPIA's "notification to data subject"
 * (section 18): what is collected, why, who sees it, for how long, and how to
 * get it back or have it removed.
 *
 * Deliberately plain. The people agreeing to this are entrepreneurs, often on a
 * phone, sometimes not reading in their first language, and a notice nobody can
 * read is not informed consent whatever its legal wording says.
 */
export default function PrivacyPage() {
  return (
    <div className="auth-page">
      <article className="auth-card" style={{ maxWidth: 720, textAlign: 'left' }}>
        <h1>Privacy notice</h1>
        <p className="sub">
          Version {POLICY_VERSION}. This explains what Proven holds about you and
          what you can do about it.
        </p>

        <h2>Who is responsible</h2>
        <p>
          Proven is the responsible party for the information described here,
          under the Protection of Personal Information Act, 2013 (POPIA).
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>About you:</strong> your name and email address.
          </li>
          <li>
            <strong>About your business:</strong> its name, industry, where it
            trades, when it started, and how many people work there.
          </li>
          <li>
            <strong>Your figures:</strong> monthly sales, expenses and customer
            counts, and the individual transactions you log.
          </li>
          <li>
            <strong>Your documents:</strong> receipts, invoices and deposit slips
            you attach as evidence.
          </li>
        </ul>

        <h2>Why we hold it</h2>
        <p>
          To calculate your score, show you where your business stands, and build
          a track record you can take to a funder. That is the whole purpose. We
          do not sell it, and we do not use it for advertising.
        </p>

        <h2>Who else can see it</h2>
        <p>
          <strong>A funder sees your figures only if you ask to be linked to them
          and they confirm it.</strong> Until both of those have happened they see
          nothing at all. You can see exactly who has access from your dashboard.
        </p>
        <p>
          A funder can never change your numbers. Their access is read-only,
          because evidence that someone else can edit proves nothing.
        </p>
        <p>
          Proven staff can see that you are enrolled and whether you are
          reporting, and can check documents you submit as evidence.
        </p>

        <h2>How long we keep it</h2>
        <p>
          While your business is active, and then for <strong>seven years</strong>{' '}
          after your last reported figures. That period matches the retention
          already required of financial records by SARS and the Companies Act, so
          a shorter one would leave you unable to meet your own obligations.
        </p>
        <p>Consent records are kept longer, so that lawful collection stays provable.</p>

        <h2>Your rights</h2>
        <ul>
          <li>
            <strong>Get a copy.</strong> Download everything Proven holds about
            you, at any time, from your dashboard.
          </li>
          <li>
            <strong>Correct it.</strong> Your figures and business details are
            yours to edit.
          </li>
          <li>
            <strong>Withdraw consent.</strong> Disconnect a funder whenever you
            choose. They keep no live access from that moment.
          </li>
          <li>
            <strong>Leave.</strong> Close your account and have your personal
            information erased, subject to the retention period above.
          </li>
          <li>
            <strong>Complain.</strong> To us first, and to the Information
            Regulator of South Africa if we do not resolve it.
          </li>
        </ul>

        <h2 id="cookies">Cookies</h2>
        <p>
          Proven sets one cookie: the session that keeps you signed in between
          pages. Without it you would have to log in again on every screen.
        </p>
        <p>
          <strong>We do not use tracking, analytics or advertising cookies.</strong>{' '}
          Nothing here follows you to another site, builds an advertising
          profile, or is sold to anyone. Because the session cookie is required
          for the service to function at all, we do not ask you to accept or
          decline it — there is no working version of Proven without it — but we
          are telling you plainly that it exists and exactly what it does.
        </p>

        <h2>Security</h2>
        <p>
          Access is enforced by the database itself, not only by the app, so a
          mistake in our code cannot expose one business&apos;s figures to another.
          Documents are stored privately and served through short-lived links that
          expire.
        </p>
        <p>
          Every connection to Proven is encrypted in transit (HTTPS), and your
          browser is instructed to never fall back to an unencrypted connection.
          Everything we store is encrypted at rest by our infrastructure
          provider. Repeated wrong sign-in attempts against an account are
          limited automatically.
        </p>

        <h2>Changes</h2>
        <p>
          If this notice changes materially we will ask you to agree again. Your
          existing consent stays attached to the version you actually agreed to.
        </p>

        <p className="auth-foot">
          <Link href="/legal/terms">Terms of use</Link> · <Link href="/sign-up">Back to sign up</Link>
        </p>
      </article>
    </div>
  );
}

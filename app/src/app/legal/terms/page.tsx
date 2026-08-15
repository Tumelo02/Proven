import Link from 'next/link';
import { POLICY_VERSION } from '@/lib/policy';

export const metadata = {
  title: 'Terms of use · Proven',
};

/**
 * Terms of use. Kept short and specific on the two points that actually matter
 * for this product: a score is evidence rather than a credit decision, and the
 * figures belong to the entrepreneur who entered them.
 */
export default function TermsPage() {
  return (
    <div className="auth-page">
      <article className="auth-card" style={{ maxWidth: 720, textAlign: 'left' }}>
        <h1>Terms of use</h1>
        <p className="sub">Version {POLICY_VERSION}.</p>

        <h2>What Proven does</h2>
        <p>
          Proven records what your business reports each month and turns it into a
          score and a track record. It is a record-keeping and reporting tool.
        </p>

        <h2>What Proven is not</h2>
        <p>
          <strong>Proven is not a credit provider and does not lend money.</strong>{' '}
          A score is not a credit decision, an approval, or a promise of funding.
          Funders make their own decisions on their own criteria, and a high score
          does not oblige anyone to fund you.
        </p>
        <p>
          Proven is not a financial adviser. The guidance shown is generated from
          your own figures and is a prompt to look at something, not professional
          advice.
        </p>

        <h2>Your figures are yours</h2>
        <p>
          You keep ownership of everything you enter. You can export it or take it
          elsewhere at any time. Proven does not sell it.
        </p>
        <p>
          You are responsible for the accuracy of what you report. Proven records
          that evidence exists; it does not certify that a document is genuine.
          Deliberately false figures may end your access, and a funder relying on
          them may take their own action.
        </p>

        <h2>Funders</h2>
        <p>
          A funder can see your figures only after you request a link and they
          confirm it. You may disconnect a funder at any time. Their access is
          read-only throughout.
        </p>

        <h2>Your account</h2>
        <p>
          Keep your password to yourself, and tell us if you think someone else
          has it. You must be entitled to act for the business you enrol.
        </p>

        <h2>Availability</h2>
        <p>
          We try to keep Proven running and your data safe, but we do not
          guarantee uninterrupted service. Keep your own copies of anything you
          cannot afford to lose. Nothing here excludes liability that cannot
          lawfully be excluded.
        </p>

        <h2>Ending it</h2>
        <p>
          You can close your account whenever you like. See the{' '}
          <Link href="/legal/privacy">privacy notice</Link> for what happens to
          your information afterwards.
        </p>

        <h2>Governing law</h2>
        <p>These terms are governed by the law of the Republic of South Africa.</p>

        <p className="auth-foot">
          <Link href="/legal/privacy">Privacy notice</Link> ·{' '}
          <Link href="/sign-up">Back to sign up</Link>
        </p>
      </article>
    </div>
  );
}

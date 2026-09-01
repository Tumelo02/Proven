import { signOut } from '@/app/(auth)/actions';
import '../workspace.css';

export default function AccessDisabledPage() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 560 }}>
        <h1>Access disabled</h1>
        <p className="sub">
          Access to your Proven account has been disabled by the platform administrator.
        </p>
        <p>
          Your business records have not been deleted. Please contact Proven administration
          to review your access and confirm what needs to happen next.
        </p>
        <form action={signOut}>
          <button className="btn block" type="submit">Sign out</button>
        </form>
      </div>
    </div>
  );
}
import { notFound } from 'next/navigation';
import {
  getBusinessShell,
  getBusinessTeam,
  getMyBusinessAccess,
  getMyOrganisations,
  getScoredBusiness,
} from '@/lib/queries';
import { EntrepreneurShell } from '../shell';
import { AddTeamMember, EditMemberForm } from './team-forms';
import { ROLE_LABEL, ROLE_BLURB } from './roles';
import '../../../workspace.css';
import '../../../admin.css';

const ROLE_CHIP: Record<string, string> = {
  manager: 'green',
  editor: 'blue',
  viewer: 'grey',
};

/**
 * Who else may use this business.
 *
 * A business is rarely one person. A partner, a bookkeeper, the person who
 * actually serves the customers — until now they either shared the owner's
 * password or did not use Proven at all. The first makes the audit trail a
 * work of fiction; the second means the record is only as complete as one
 * person's time.
 *
 * Owner-only, and the check is real: the page 404s for anyone else, and every
 * write it offers goes through a database function that refuses a caller who
 * does not own the business. Hiding the screen alone would be theatre.
 */
export default async function BusinessTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [shell, access, orgs, scored] = await Promise.all([
    getBusinessShell(id),
    getMyBusinessAccess(id),
    getMyOrganisations(),
    getScoredBusiness(id),
  ]);

  if (!shell) notFound();

  /* Same reasoning as the admin panel: somebody who may not manage the team
     should not learn that this route exists. */
  if (!access.canManageTeam) notFound();

  const team = await getBusinessTeam(id);

  return (
    <EntrepreneurShell
      businessId={id}
      active="team"
      showSwitchRole={orgs.length > 0}
      {...(scored
        ? {
            guidanceCount: scored.guidance.length,
            guidanceAlarm: scored.guidance.some((g) => g.sev === 'red' || g.sev === 'yellow'),
          }
        : {})}
    >
      <div className="statstrip">
        <div className="s">
          <div className="l">People with access</div>
          <div className="v">{team.length + 1}</div>
          <div className="f">Including you</div>
        </div>
        <div className="s">
          <div className="l">Managers</div>
          <div className="v">{team.filter((m) => m.role === 'manager').length}</div>
          <div className="f">Figures, profile and funding</div>
        </div>
        <div className="s">
          <div className="l">Editors</div>
          <div className="v">{team.filter((m) => m.role === 'editor').length}</div>
          <div className="f">Log the day-to-day</div>
        </div>
        <div className="s">
          <div className="l">Viewers</div>
          <div className="v">{team.filter((m) => m.role === 'viewer').length}</div>
          <div className="f">Read only, change nothing</div>
        </div>
      </div>

      <AddTeamMember businessId={id} />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Everyone with access</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {team.length + 1} {team.length === 0 ? 'person' : 'people'}
          </span>
        </div>

        <div className="staff-list">
          {/* The owner, stated rather than listed as a role. Ownership is not
              something the team can grant or take away, so it does not belong
              among rows that have a Remove button. */}
          <div className="staff-row">
            <div className="team-owner-row">
              <span className="staff-row-main">
                <b>{shell.business.owner_email || shell.business.owner_name || 'You'}</b>
                <span className="chip grey">You</span>
              </span>
              <span className="chip blue">Owner</span>
              <span className="tiny muted staff-row-caps">
                Everything, including who else may use this business
              </span>
            </div>
          </div>

          {team.map((member) => (
            <details className="staff-row" key={member.profile.id}>
              <summary>
                <span className="staff-row-main">
                  <b>{member.profile.email}</b>
                  {member.profile.full_name && (
                    <span className="tiny muted"> · {member.profile.full_name}</span>
                  )}
                </span>
                <span className={`chip ${ROLE_CHIP[member.role] ?? 'grey'}`}>
                  {ROLE_LABEL[member.role]}
                </span>
                <span className="tiny muted staff-row-caps">{ROLE_BLURB[member.role]}</span>
              </summary>

              <div className="staff-row-body">
                {member.note && (
                  <p className="tiny muted" style={{ marginTop: 0 }}>
                    {member.note}
                  </p>
                )}
                <EditMemberForm
                  businessId={id}
                  userId={member.profile.id}
                  email={member.profile.email}
                  currentRole={member.role}
                  currentNote={member.note}
                />
              </div>
            </details>
          ))}
        </div>

        {team.length === 0 && (
          <div className="panel-body">
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Nobody else has access yet. Adding someone means they use their
              own account, so the record shows who logged what.
            </p>
          </div>
        )}
      </div>

      <p className="tiny muted">
        Everyone here signs in as themselves. That is the point: a shared
        password would make the record say one person did everything, and a
        record that cannot say who did what is not evidence. Roles are enforced
        by the database, not by this screen — someone who may not change a
        figure cannot change it by going around the interface either.
      </p>
    </EntrepreneurShell>
  );
}

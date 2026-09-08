import { notFound } from 'next/navigation';
import { getMyStaffAccess, getStaffMembers } from '@/lib/queries';
import { requireAdmin } from '../guard';
import { AdminShell } from '../admin-shell';
import { AddStaff } from './add-staff';
import { StaffRoleForm, RemoveStaffForm, ROLE_LABEL, ROLE_BLURB, CAPABILITIES } from './staff-form';
import '../../workspace.css';
import '../../admin.css';

const ROLE_CHIP: Record<string, string> = {
  owner: 'blue',
  manager: 'green',
  reviewer: 'yellow',
  analyst: 'grey',
};

/**
 * Who works on the platform, and what each of them may do.
 *
 * Owner-only, and the check is real: the page 404s for anyone else, and every
 * write it offers goes through a database function that refuses a caller who
 * is not an owner. Hiding the screen alone would be theatre.
 *
 * The one thing deliberately absent is a way to grant "manage staff" as a
 * capability. That power is the owner role and nothing else, because a limited
 * admin who could hand it out could hand it to themselves.
 */
export default async function AdminStaffPage() {
  const { profile, badges, hide } = await requireAdmin({ intelligence: false });
  const access = await getMyStaffAccess();

  /* Same reasoning as the rest of the panel: a staff account that may not
     manage other staff should not learn that this route exists. */
  if (!access.isOwner) notFound();

  const staff = await getStaffMembers();
  const owners = staff.filter((s) => s.role === 'owner').length;

  return (
    <AdminShell
      active="staff"
      email={profile.email}
      badges={badges}
      hide={hide}
      title="Staff and access"
      subtitle="Who works on Proven, and what each of them may do"
    >
      <div className="statstrip">
        <div className="s">
          <div className="l">Staff accounts</div>
          <div className="v">{staff.length}</div>
          <div className="f">With access to this panel</div>
        </div>
        <div className="s">
          <div className="l">Owners</div>
          <div className="v">{owners}</div>
          <div className="f">Can manage staff</div>
        </div>
        <div className="s">
          <div className="l">Reviewers</div>
          <div className="v">{staff.filter((s) => s.role === 'reviewer').length}</div>
          <div className="f">Check evidence</div>
        </div>
        <div className="s">
          <div className="l">Read-only</div>
          <div className="v">{staff.filter((s) => s.role === 'analyst').length}</div>
          <div className="f">Analysts, who change nothing</div>
        </div>
      </div>

      <AddStaff />

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h3>Everyone with access</h3>
          <span className="hint" style={{ marginLeft: 'auto' }}>
            {staff.length} account{staff.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Not paged. Every row here carries its own forms, which are Client
            Components, and handing that subtree through another client
            component to be sliced is the indirection that broke this page. The
            roster is also the one admin list with a natural ceiling — it is
            Proven's own staff, not the platform's businesses — so there is
            nothing here for a pager to save. */}
        <div className="staff-list">
          {staff.map((member) => {
                const isSelf = member.profile.id === profile.id;
                const held = CAPABILITIES.filter(
                  (c) => member.capabilities[c.key as keyof typeof member.capabilities],
                );

                return (
                  <details className="staff-row" key={member.profile.id}>
                    <summary>
                      <span className="staff-row-main">
                        <b>{member.profile.email}</b>
                        {member.profile.full_name && (
                          <span className="tiny muted"> · {member.profile.full_name}</span>
                        )}
                        {isSelf && <span className="chip grey">You</span>}
                      </span>
                      <span className={`chip ${ROLE_CHIP[member.role] ?? 'grey'}`}>
                        {ROLE_LABEL[member.role]}
                      </span>
                      <span className="tiny muted staff-row-caps">
                        {member.role === 'owner'
                          ? 'Everything'
                          : held.length === 0
                            ? 'Read-only'
                            : held.map((c) => c.label).join(' · ')}
                      </span>
                    </summary>

                    <div className="staff-row-body">
                      <p className="tiny muted" style={{ marginTop: 0 }}>
                        {ROLE_BLURB[member.role]}
                        {member.note && ` — ${member.note}`}
                      </p>

                      <StaffRoleForm
                        userId={member.profile.id}
                        email={member.profile.email}
                        currentRole={member.role}
                        currentCapabilities={member.capabilities}
                        currentNote={member.note}
                        isSelf={isSelf}
                      />

                      {!isSelf && (
                        <div className="staff-row-danger">
                          <RemoveStaffForm
                            userId={member.profile.id}
                            email={member.profile.email}
                          />
                        </div>
                      )}
                    </div>
                </details>
              );
            })}
        </div>
      </div>

      <p className="tiny muted">
        Roles are enforced by the database, not by this screen. A staff account
        that may not do something cannot do it by calling the API directly
        either: the functions behind these forms check the caller is an owner
        before they change anything, and every change here is written to the
        audit trail as an alert.
      </p>
    </AdminShell>
  );
}

import { setMilestoneStatus } from '@/app/businesses/actions';
import type { Milestone } from '@/lib/database.types';

const STATUS_TEXT = {
  done: 'Completed',
  delayed: 'Running late',
  current: 'Working on it now',
  pending: 'Not started yet',
} as const;

/**
 * One stage: a numbered circle, its label, and what state it is in.
 *
 * The two actions appear only on the stage being worked on, because marking a
 * finished or unstarted stage complete means nothing. Plain forms, so this
 * works without JavaScript: a business owner may be on a cheap phone.
 */
export function MilestoneRow({
  milestone,
  businessId,
  index,
}: {
  milestone: Milestone;
  businessId: string;
  index: number;
}) {
  const active = milestone.status === 'current' || milestone.status === 'delayed';

  return (
    <div className={`milestone-row ${milestone.status}`}>
      <div className="mnum">{milestone.status === 'done' ? '✔' : index + 1}</div>

      <div className="mlabel">
        {milestone.label}
        <div className="tiny muted" style={{ fontWeight: 500 }}>
          {STATUS_TEXT[milestone.status]}
        </div>
      </div>

      {active && (
        <div className="mactions">
          <form action={setMilestoneStatus}>
            <input type="hidden" name="milestone_id" value={milestone.id} />
            <input type="hidden" name="business_id" value={businessId} />
            <input type="hidden" name="status" value="done" />
            <button className="btn sm" type="submit">
              Mark complete
            </button>
          </form>

          <form action={setMilestoneStatus}>
            <input type="hidden" name="milestone_id" value={milestone.id} />
            <input type="hidden" name="business_id" value={businessId} />
            <input type="hidden" name="status" value="delayed" />
            <button className="btn ghost sm" type="submit">
              Mark delayed
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

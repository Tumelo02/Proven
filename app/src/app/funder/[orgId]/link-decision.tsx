import { decideLinkRequest } from '@/app/funder/actions';

/**
 * Confirm or decline a business's request to be linked.
 *
 * Two separate submit buttons on one form rather than a dropdown: confirming
 * grants a funder sight of someone's financial records, and that should take a
 * deliberate click on a button that says what it does.
 */
export function LinkDecision({ linkId, orgId }: { linkId: string; orgId: string }) {
  return (
    <form action={decideLinkRequest} className="row" style={{ gap: 8 }}>
      <input type="hidden" name="link_id" value={linkId} />
      <input type="hidden" name="org_id" value={orgId} />

      <button className="btn sm" type="submit" name="decision" value="confirmed">
        Confirm
      </button>
      <button className="btn ghost sm" type="submit" name="decision" value="rejected">
        Decline
      </button>
    </form>
  );
}

/**
 * Data access, in one place.
 *
 * Every query runs as the signed-in user, so row-level security decides what
 * comes back. None of these functions filter by owner or organisation
 * themselves: doing so in application code would create a second, weaker copy
 * of rules the database already enforces, and the two would eventually drift.
 */

import 'server-only';

import {
  computeHealth,
  creditReadiness,
  decisionFor,
  getGuidance,
  reportingStatus,
  scoreDelta,
  toBusinessInput,
  trendOf,
  type BusinessInput,
  type CreditReadinessResult,
  type Decision,
  type GuidanceItem,
  type HealthResult,
  type ReportingState,
  type Trend,
} from '@proven/engine';

import { createClient } from '@/lib/supabase/server';
import type {
  AuditSeverity,
  AuditTrailRow,
  Business,
  Database,
  Document,
  FollowUp,
  FundingLink,
  Milestone,
  OrgContact,
  OrgRole,
  Organisation,
  Profile,
  ReportingPeriod,
  ReviewStatus,
  StaffCount,
  StaffRole,
  TeamMember,
  Transaction,
} from '@/lib/database.types';

/** A business with its scores worked out, ready to render. */
export interface ScoredBusiness {
  business: Business;
  input: BusinessInput;
  health: HealthResult;
  readiness: CreditReadinessResult;
  decision: Decision;
  guidance: GuidanceItem[];
  delta: number;
  trend: Trend;
  periods: ReportingPeriod[];
  transactions: Transaction[];
  milestones: Milestone[];
  funder: Organisation | null;
  /**
   * The organisation's own committed figure where it has recorded one, falling
   * back to what the business stated when it asked. The funder's number is the
   * more reliable of the two, so it wins.
   */
  fundingAmount: number | null;
  /** The confirmed link itself, for the funder's own support terms. */
  fundingLink: FundingLink | null;
  /** Transaction ids that have a document attached, for evidence coverage. */
  documentedTransactionIds: string[];
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data ?? null;
}

/** Businesses the signed-in user owns. */
export async function getMyBusinesses(): Promise<Business[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true });

  return data ?? [];
}

/** Organisations the signed-in user belongs to, with their role. */
export async function getMyOrganisations(): Promise<
  { org: Organisation; role: 'member' | 'admin' }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('memberships')
    .select('role, organisations(*)')
    .returns<{ role: 'member' | 'admin'; organisations: Organisation }[]>();

  return (data ?? [])
    .filter((row) => row.organisations)
    .map((row) => ({ org: row.organisations, role: row.role }));
}

/** Every organisation, for the picker when a business names its funder. */
export async function listOrganisations(): Promise<Organisation[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('organisations').select('*').order('name');
  return data ?? [];
}

/**
 * One business with everything needed to show it.
 *
 * Returns null when the business does not exist *or* the user may not see it.
 * The two are deliberately indistinguishable: a different message for "exists
 * but not yours" would confirm which business IDs are real.
 */
export async function getScoredBusiness(businessId: string): Promise<ScoredBusiness | null> {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (!business) return null;

  const [periodsRes, transactionsRes, milestonesRes, linkRes, docsRes] = await Promise.all([
    supabase
      .from('reporting_periods')
      .select('*')
      .eq('business_id', businessId)
      .order('period_month', { ascending: true }),
    supabase
      .from('transactions')
      .select('*')
      .eq('business_id', businessId)
      .order('occurred_on', { ascending: false }),
    supabase
      .from('milestones')
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('funding_links')
      .select('*, organisations(*)')
      .eq('business_id', businessId)
      .eq('status', 'confirmed')
      .maybeSingle()
      .returns<(FundingLink & { organisations: Organisation }) | null>(),
    /* Which entries have evidence behind them. Reached through the parent
       transaction, so a funder sees only its own businesses' documents.

       Rejected documents are excluded: one that was turned down leaves the
       entry unbacked again, so coverage has to drop until a replacement
       arrives. Counting it would report evidence that a reviewer has already
       said does not stand up. */
    supabase
      .from('documents')
      .select('transaction_id, transactions!inner(business_id)')
      .eq('transactions.business_id', businessId)
      .neq('review_status', 'rejected')
      .returns<{ transaction_id: string }[]>(),
  ]);

  const periods = periodsRes.data ?? [];
  const transactions = transactionsRes.data ?? [];
  const milestones = milestonesRes.data ?? [];

  const input = toBusinessInput({ periods, milestones, transactions });

  /* A business with no reported months yet cannot be scored: the engine needs
     at least one period to divide by. Callers render the "no figures yet"
     state from `periods.length === 0`. */
  if (!periods.length) {
    return null;
  }

  return {
    business,
    input,
    health: computeHealth(input),
    readiness: creditReadiness(input),
    decision: decisionFor(input),
    guidance: getGuidance(input),
    delta: scoreDelta(input),
    trend: trendOf(input),
    periods,
    transactions,
    milestones,
    funder: linkRes.data?.organisations ?? null,
    /* The organisation's own figure first: what the business typed when asking
       is a claim, and the funder's record is the one they report upward. */
    fundingAmount: linkRes.data?.committed_amount
      ? Number(linkRes.data.committed_amount)
      : linkRes.data?.amount
        ? Number(linkRes.data.amount)
        : null,
    fundingLink: linkRes.data ?? null,
    documentedTransactionIds: (docsRes.data ?? []).map((d) => d.transaction_id),
  };
}

/** A transaction with whatever document is attached to it, if any. */
export interface TransactionWithDoc {
  transaction: Transaction;
  document: Document | null;
}

/**
 * Transactions for a business, each with its supporting document.
 *
 * Documents are fetched alongside rather than joined in SQL, because a
 * transaction may have several and the newest is the one that counts.
 */
export async function getTransactionsWithDocs(
  businessId: string,
  limit = 50,
): Promise<TransactionWithDoc[]> {
  const supabase = await createClient();

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('business_id', businessId)
    .order('occurred_on', { ascending: false })
    .limit(limit);

  const rows = transactions ?? [];
  if (!rows.length) return [];

  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .in(
      'transaction_id',
      rows.map((t) => t.id),
    )
    .order('uploaded_at', { ascending: false });

  return rows.map((transaction) => ({
    transaction,
    document: (docs ?? []).find((d) => d.transaction_id === transaction.id) ?? null,
  }));
}

/** Raw rows for a business, for screens that must handle the no-figures case. */
export async function getBusinessShell(businessId: string): Promise<{
  business: Business;
  periods: ReportingPeriod[];
  milestones: Milestone[];
} | null> {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (!business) return null;

  const [periodsRes, milestonesRes] = await Promise.all([
    supabase
      .from('reporting_periods')
      .select('*')
      .eq('business_id', businessId)
      .order('period_month', { ascending: true }),
    supabase
      .from('milestones')
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true }),
  ]);

  return {
    business,
    periods: periodsRes.data ?? [],
    milestones: milestonesRes.data ?? [],
  };
}

/**
 * Everything the profile page shows: the business, its people, and headcount
 * by month.
 *
 * `profile_completeness` is computed in the database rather than here, so the
 * entrepreneur's nudge and the funder's "how much of this is filled in" read
 * from one definition instead of two that can drift.
 */
export async function getBusinessProfile(businessId: string): Promise<{
  business: Business;
  team: TeamMember[];
  staffCounts: StaffCount[];
  completeness: number;
  logoUrl: string | null;
} | null> {
  const supabase = await createClient();

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (!business) return null;

  const [teamRes, staffRes, completenessRes] = await Promise.all([
    supabase
      .from('team_members')
      .select('*')
      .eq('business_id', businessId)
      .order('started_on', { ascending: true, nullsFirst: false }),
    supabase
      .from('staff_counts')
      .select('*')
      .eq('business_id', businessId)
      .order('period_month', { ascending: true }),
    supabase.rpc('profile_completeness', { target_business_id: businessId }),
  ]);

  return {
    business,
    team: teamRes.data ?? [],
    staffCounts: staffRes.data ?? [],
    completeness: typeof completenessRes.data === 'number' ? completenessRes.data : 0,
    logoUrl: await getLogoUrl(business.logo_path),
  };
}

/**
 * An organisation's own profile: identity, contact, and the counts a funder
 * reads back to themselves.
 *
 * The counts are computed here rather than stored: a number in a profile row
 * goes stale the moment a business is added.
 */
export async function getOrgProfile(orgId: string): Promise<{
  org: Organisation;
  contact: OrgContact | null;
  logoUrl: string | null;
  businessCount: number;
  isAdmin: boolean;
} | null> {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (!org) return null;

  const [contactRes, linksRes, orgs] = await Promise.all([
    supabase.from('org_contacts').select('*').eq('org_id', orgId).maybeSingle(),
    supabase
      .from('funding_links')
      .select('business_id')
      .eq('org_id', orgId)
      .eq('status', 'confirmed'),
    getMyOrganisations(),
  ]);

  return {
    org,
    contact: contactRes.data ?? null,
    logoUrl: await getLogoUrl(org.logo_path),
    businessCount: linksRes.data?.length ?? 0,
    isAdmin: orgs.some((o) => o.org.id === orgId && o.role === 'admin'),
  };
}

/**
 * This organisation's follow-ups on one business, most recent first.
 *
 * Row-level security already limits these to the caller's own organisations,
 * so there is no org filter here beyond the one asked for.
 */
export async function getFollowUps(
  businessId: string,
  orgId: string,
): Promise<FollowUp[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('follow_ups')
    .select('*')
    .eq('business_id', businessId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

/**
 * A short-lived link to a logo.
 *
 * Signed rather than public, like every other uploaded file: the bucket is
 * private, so a public URL is not available even if one were wanted. An hour
 * is long enough for a page view and short enough that a copied link is not a
 * lasting handle on the object.
 */
export async function getLogoUrl(logoPath: string | null): Promise<string | null> {
  if (!logoPath) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from('logos').createSignedUrl(logoPath, 60 * 60);
  return data?.signedUrl ?? null;
}

/**
 * Signed logo links for a whole portfolio, keyed by storage path.
 *
 * One batched call rather than one per business: signing thirty URLs in
 * sequence would add thirty round trips to a page that is otherwise a single
 * query.
 */
export async function getLogoUrls(
  paths: (string | null)[],
): Promise<Record<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  if (wanted.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase.storage.from('logos').createSignedUrls(wanted, 60 * 60);

  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}

/**
 * The portfolio for an organisation: every business it has a confirmed link
 * to, scored.
 *
 * Businesses are fetched through `funding_links`, which is also exactly what
 * the security rules allow, so an organisation cannot see a business whose
 * link it has not confirmed.
 */
export async function getPortfolio(orgId: string): Promise<ScoredBusiness[]> {
  const supabase = await createClient();

  const { data: links } = await supabase
    .from('funding_links')
    .select('business_id')
    .eq('org_id', orgId)
    .eq('status', 'confirmed');

  const ids = (links ?? []).map((l) => l.business_id);
  if (!ids.length) return [];

  const scored = await Promise.all(ids.map((id) => getScoredBusiness(id)));
  return scored.filter((b): b is ScoredBusiness => b !== null);
}

/** Link requests awaiting this organisation's decision. */
export async function getPendingLinkRequests(
  orgId: string,
): Promise<(FundingLink & { businesses: Business })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('funding_links')
    .select('*, businesses(*)')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .returns<(FundingLink & { businesses: Business })[]>();

  return data ?? [];
}

/* ---------------------------------------------------------------------------
   Platform admin
   ---------------------------------------------------------------------------
   Proven's own view across every organisation. Reads only: administrative
   writes go through separate, audited paths. Every query still runs as the
   signed-in user, so if `is_platform_admin` is false the security rules return
   nothing and these come back empty rather than leaking.
   --------------------------------------------------------------------------- */

export interface PlatformStats {
  users: number;
  organisations: number;
  businesses: number;
  funded: number;
  unfunded: number;
  applicants: number;
  /** Businesses with at least one month of figures reported. */
  reporting: number;
  periods: number;
}

export interface OrgSummary {
  org: Organisation;
  members: number;
  confirmed: number;
  pending: number;
}

export interface AdminBusinessRow {
  business: Business;
  funderName: string | null;
  linkStatus: string | null;
  months: number;
  creatorEmail: string | null;
}

/** True when the signed-in user is Proven staff. */
export async function isPlatformAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.is_platform_admin === true;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const supabase = await createClient();

  /* `head: true` with an exact count asks Postgres for the number only, with
     no rows sent back: these are dashboard tiles, not lists. */
  const [users, orgs, businesses, funded, unfunded, applicants, periods] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('organisations').select('*', { count: 'exact', head: true }),
    supabase.from('businesses').select('*', { count: 'exact', head: true }),
    supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('funding_status', 'funded'),
    supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('funding_status', 'unfunded'),
    supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('funding_status', 'applicant'),
    supabase.from('reporting_periods').select('*', { count: 'exact', head: true }),
  ]);

  /* How many businesses have actually reported at least once, which is the
     number that matters: an enrolled business with no figures is not yet
     being helped by anything. */
  const { data: reportingRows } = await supabase
    .from('reporting_periods')
    .select('business_id');
  const reporting = new Set((reportingRows ?? []).map((r) => r.business_id)).size;

  return {
    users: users.count ?? 0,
    organisations: orgs.count ?? 0,
    businesses: businesses.count ?? 0,
    funded: funded.count ?? 0,
    unfunded: unfunded.count ?? 0,
    applicants: applicants.count ?? 0,
    reporting,
    periods: periods.count ?? 0,
  };
}

/** Every organisation, with how many people and businesses it has. */
/**
 * Organisations with their commercial standing, for the admin panel only.
 *
 * Read through the view rather than the table, so the one place these columns
 * are selected is obvious. A funder should never see their own account status
 * on a screen they opened for something else.
 */
export async function getOrgAccounts(): Promise<
  Database['public']['Views']['admin_org_accounts']['Row'][]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('admin_org_accounts')
    .select('*')
    .order('name');
  return data ?? [];
}

export async function getOrgSummaries(): Promise<OrgSummary[]> {
  const supabase = await createClient();

  const [orgsRes, membersRes, linksRes] = await Promise.all([
    supabase.from('organisations').select('*').order('name'),
    supabase.from('memberships').select('org_id'),
    supabase.from('funding_links').select('org_id, status'),
  ]);

  const members = membersRes.data ?? [];
  const links = linksRes.data ?? [];

  return (orgsRes.data ?? []).map((org) => ({
    org,
    members: members.filter((m) => m.org_id === org.id).length,
    confirmed: links.filter((l) => l.org_id === org.id && l.status === 'confirmed').length,
    pending: links.filter((l) => l.org_id === org.id && l.status === 'pending').length,
  }));
}

/**
 * One organisation and the businesses attached to it, for Proven staff.
 *
 * The admin panel opens on organisations rather than on every business,
 * because a platform with fifty funders and a thousand businesses is unusable
 * as one flat list. This is what a row opens into.
 */
export async function getOrgDetail(orgId: string): Promise<{
  org: Organisation;
  contact: OrgContact | null;
  logoUrl: string | null;
  members: { profile: Profile; role: OrgRole }[];
  businesses: AdminBusinessRow[];
  pending: number;
} | null> {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (!org) return null;

  const [contactRes, membershipRes, linksRes] = await Promise.all([
    supabase.from('org_contacts').select('*').eq('org_id', orgId).maybeSingle(),
    supabase
      .from('memberships')
      .select('role, profiles(*)')
      .eq('org_id', orgId)
      .returns<{ role: OrgRole; profiles: Profile }[]>(),
    supabase
      .from('funding_links')
      .select('business_id, status, amount, businesses(*)')
      .eq('org_id', orgId)
      .returns<
        { business_id: string; status: string; amount: string | null; businesses: Business }[]
      >(),
  ]);

  const links = linksRes.data ?? [];
  const confirmed = links.filter((l) => l.status === 'confirmed');

  /* Reported months per business, so staff can see who enrolled and then went
     quiet. Enrolment is not the same as being helped. */
  const periodsRes = await supabase
    .from('reporting_periods')
    .select('business_id')
    .in(
      'business_id',
      confirmed.length ? confirmed.map((l) => l.business_id) : ['00000000-0000-0000-0000-000000000000'],
    );

  const periods = periodsRes.data ?? [];

  return {
    org,
    contact: contactRes.data ?? null,
    logoUrl: await getLogoUrl(org.logo_path),
    members: (membershipRes.data ?? []).map((m) => ({ profile: m.profiles, role: m.role })),
    businesses: confirmed.map((l) => ({
      business: l.businesses,
      funderName: org.name,
      linkStatus: l.status,
      months: periods.filter((p) => p.business_id === l.business_id).length,
      creatorEmail: l.businesses.owner_email ?? null,
    })),
    pending: links.filter((l) => l.status === 'pending').length,
  };
}

/**
 * The audit trail, newest first.
 *
 * Row-level security decides what comes back: Proven staff see everything, an
 * organisation's admins see their own organisation's events, everyone else
 * sees nothing. No filtering here beyond what the caller asked for.
 */
export async function getAuditTrail(opts?: {
  orgId?: string;
  severity?: AuditSeverity;
  limit?: number;
}): Promise<AuditTrailRow[]> {
  const supabase = await createClient();

  let q = supabase
    .from('audit_trail')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 200);

  if (opts?.orgId) q = q.eq('org_id', opts.orgId);
  if (opts?.severity) q = q.eq('severity', opts.severity);

  const { data } = await q;
  return data ?? [];
}

/** Every business on the platform, funded or not, with its funder if it has one. */
export async function getAllBusinesses(): Promise<AdminBusinessRow[]> {
  const supabase = await createClient();

  const [bizRes, linksRes, periodsRes, profilesRes] = await Promise.all([
    supabase.from('businesses').select('*').order('created_at', { ascending: false }),
    supabase
      .from('funding_links')
      .select('business_id, status, organisations(name)')
      .returns<{ business_id: string; status: string; organisations: { name: string } | null }[]>(),
    supabase.from('reporting_periods').select('business_id'),
    supabase.from('profiles').select('id, email'),
  ]);

  const links = linksRes.data ?? [];
  const periods = periodsRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile.email]));

  return (bizRes.data ?? []).map((business) => {
    /* A confirmed link is the one that counts; a pending one is shown as
       pending rather than as a funder, because it grants nothing yet. */
    const link =
      links.find((l) => l.business_id === business.id && l.status === 'confirmed') ??
      links.find((l) => l.business_id === business.id);

    return {
      business,
      funderName: link?.status === 'confirmed' ? (link.organisations?.name ?? null) : null,
      linkStatus: link?.status ?? null,
      months: periods.filter((p) => p.business_id === business.id).length,
      creatorEmail: profileById.get(business.owner_id) ?? business.owner_email ?? null,
    };
  });
}

/** A document awaiting review, with everything needed to judge it. */
export interface ReviewItem {
  document: Document;
  transaction: Transaction;
  business: Business;
  /** Short-lived link to the file itself. */
  url: string | null;
}

/**
 * Documents waiting for Proven staff to check them.
 *
 * Returns the transaction each one claims to evidence alongside it, because
 * the question being answered is not "is this a real receipt" but "does this
 * receipt match what was logged".
 */
export async function getReviewQueue(
  status: ReviewStatus = 'pending',
  limit = 50,
): Promise<ReviewItem[]> {
  const supabase = await createClient();

  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('review_status', status)
    .order('uploaded_at', { ascending: true })
    .limit(limit);

  if (!docs?.length) return [];

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .in(
      'id',
      docs.map((d) => d.transaction_id),
    );

  const businessIds = [...new Set((transactions ?? []).map((t) => t.business_id))];
  const { data: businesses } = await supabase
    .from('businesses')
    .select('*')
    .in('id', businessIds);

  const { data: urls } = await supabase.storage
    .from('proofs')
    .createSignedUrls(
      docs.map((d) => d.storage_path),
      60 * 10,
    );

  const urlByPath = new Map<string, string>();
  for (const u of urls ?? []) {
    if (u.path && u.signedUrl) urlByPath.set(u.path, u.signedUrl);
  }

  const items: ReviewItem[] = [];
  for (const document of docs) {
    const transaction = (transactions ?? []).find((t) => t.id === document.transaction_id);
    if (!transaction) continue;
    const business = (businesses ?? []).find((b) => b.id === transaction.business_id);
    if (!business) continue;

    items.push({
      document,
      transaction,
      business,
      url: urlByPath.get(document.storage_path) ?? null,
    });
  }

  return items;
}

/** How many documents are waiting, for the badge on the admin nav. */
export async function getPendingReviewCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('review_status', 'pending');
  return count ?? 0;
}

/** Funding links for one business, whatever their state, for the owner's view. */
export async function getBusinessLinks(
  businessId: string,
): Promise<(FundingLink & { organisations: Organisation })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('funding_links')
    .select('*, organisations(*)')
    .eq('business_id', businessId)
    .returns<(FundingLink & { organisations: Organisation })[]>();

  return data ?? [];
}

/* ---------------------------------------------------------------------------
   Admin intelligence
   ---------------------------------------------------------------------------

   Everything the staff panel needs to answer "who is doing well, who needs an
   eye, and what is waiting on us" in one pass over the platform.

   Deliberately one query rather than one per business. Scoring the whole
   platform by calling `getScoredBusiness` in a loop would be a round trip per
   row, which is fine for the ten demo businesses and unusable at a thousand.
   The three tables are read whole, grouped in memory, and scored with the same
   engine the entrepreneur and funder sides use, so a business cannot read as
   healthy here and at risk there.
   --------------------------------------------------------------------------- */

/** One business as the admin panel sees it: identity, standing, and score. */
export interface AdminInsightRow {
  business: Business;
  funderName: string | null;
  linkStatus: string | null;
  months: number;
  /** Null when the business has never reported: unscored, not scored zero. */
  score: number | null;
  tier: 'green' | 'yellow' | 'red' | null;
  trend: Trend | null;
  delta: number;
  /** Whether the month this reporting cycle covers has been sent. */
  reportingState: ReportingState;
  reportingLabel: string;
  /** Latest reported month, ISO date, for recency ordering. */
  lastReported: string | null;
  documents: number;
  pendingDocuments: number;
  rejectedDocuments: number;
  /** The account that created it, for chasing a business that went quiet. */
  creatorEmail: string | null;
}

export interface AdminIntelligence {
  rows: AdminInsightRow[];
  /** Businesses created per month, oldest first, for the enrolment chart. */
  enrolment: { month: string; businesses: number; reporting: number }[];
  documentsPending: number;
  documentsVerified: number;
  documentsRejected: number;
  pendingLinks: number;
}

export async function getAdminIntelligence(): Promise<AdminIntelligence> {
  const supabase = await createClient();

  const [bizRes, periodsRes, milestonesRes, linksRes, docsRes, profilesRes] = await Promise.all([
    supabase.from('businesses').select('*').order('created_at', { ascending: false }),
    supabase
      .from('reporting_periods')
      .select('*')
      .order('period_month', { ascending: true }),
    supabase.from('milestones').select('*').order('sort_order', { ascending: true }),
    supabase
      .from('funding_links')
      .select('business_id, status, organisations(name)')
      .returns<{ business_id: string; status: string; organisations: { name: string } | null }[]>(),
    /* Joined through the parent transaction, because a document knows which
       entry it evidences but not which business that entry belongs to. */
    supabase
      .from('documents')
      .select('review_status, transactions!inner(business_id)')
      .returns<{ review_status: ReviewStatus; transactions: { business_id: string } }[]>(),
    supabase.from('profiles').select('id, email'),
  ]);

  const businesses = bizRes.data ?? [];
  const periods = periodsRes.data ?? [];
  const milestones = milestonesRes.data ?? [];
  const links = linksRes.data ?? [];
  const docs = docsRes.data ?? [];
  const profileEmail = new Map((profilesRes.data ?? []).map((p) => [p.id, p.email]));

  /* Grouped once into maps rather than filtered per business inside the loop,
     which would be quadratic over the platform. */
  const periodsBy = new Map<string, ReportingPeriod[]>();
  for (const p of periods) {
    const list = periodsBy.get(p.business_id);
    if (list) list.push(p);
    else periodsBy.set(p.business_id, [p]);
  }

  const milestonesBy = new Map<string, Milestone[]>();
  for (const m of milestones) {
    const list = milestonesBy.get(m.business_id);
    if (list) list.push(m);
    else milestonesBy.set(m.business_id, [m]);
  }

  const docsBy = new Map<string, { pending: number; verified: number; rejected: number }>();
  for (const d of docs) {
    const id = d.transactions?.business_id;
    if (!id) continue;
    const entry = docsBy.get(id) ?? { pending: 0, verified: 0, rejected: 0 };
    if (d.review_status === 'pending') entry.pending += 1;
    else if (d.review_status === 'verified') entry.verified += 1;
    else if (d.review_status === 'rejected') entry.rejected += 1;
    docsBy.set(id, entry);
  }

  const rows: AdminInsightRow[] = businesses.map((business) => {
    const own = periodsBy.get(business.id) ?? [];
    const input = toBusinessInput({
      periods: own,
      milestones: milestonesBy.get(business.id) ?? [],
      transactions: [],
    });

    const link =
      links.find((l) => l.business_id === business.id && l.status === 'confirmed') ??
      links.find((l) => l.business_id === business.id);

    const counts = docsBy.get(business.id) ?? { pending: 0, verified: 0, rejected: 0 };
    const rep = reportingStatus(input);
    const scored = own.length > 0;
    const health = scored ? computeHealth(input) : null;

    return {
      business,
      funderName: link?.status === 'confirmed' ? (link.organisations?.name ?? null) : null,
      linkStatus: link?.status ?? null,
      months: own.length,
      score: health ? health.score : null,
      tier: health ? health.tier : null,
      trend: scored ? trendOf(input) : null,
      delta: scored ? scoreDelta(input) : 0,
      reportingState: rep.state,
      reportingLabel: rep.label,
      lastReported: own.length ? own[own.length - 1]!.period_month : null,
      documents: counts.pending + counts.verified + counts.rejected,
      pendingDocuments: counts.pending,
      rejectedDocuments: counts.rejected,
      creatorEmail: profileEmail.get(business.owner_id) ?? business.owner_email ?? null,
    };
  });

  /* Platform growth, month by month.

     Two things are being counted, and both belong on the same axis:

       `businesses` — how many are on the platform by that month. A business
         counts from whichever came first, the month it signed up or the
         earliest month it has figures for. A business that joined this week
         and back-filled 2024 has genuinely been trading since 2024, and its
         record proves it.

       `reporting` — how many of those actually have figures for that month.

     The gap between them is the record that is not being kept: businesses on
     the platform with nothing filed for that month. That is the number the
     caption calls out, so the chart has to be able to show it.

     Two earlier versions each got half of this. Counting both series on
     sign-up date collapsed every business into one week and drew a single
     point. Counting both on the reported month dropped the twelve businesses
     that have never reported anything, so the chart contradicted its own
     caption by leaving them out entirely. The months axis now spans both
     sources, which is why September appears with everyone enrolled even though
     nobody has filed September figures yet — they are not due until October. */
  const monthKey = (iso: string) => iso.slice(0, 7);

  const reportedMonths = new Map<string, Set<string>>();
  for (const [businessId, own] of periodsBy) {
    reportedMonths.set(businessId, new Set(own.map((r) => monthKey(r.period_month))));
  }

  /* When each business starts counting: the earlier of signing up and its
     oldest reported month. */
  const startedBy = new Map<string, string>();
  for (const business of businesses) {
    const signup = monthKey(business.created_at);
    const covered = reportedMonths.get(business.id);
    const earliest = covered && covered.size ? [...covered].sort()[0]! : signup;
    startedBy.set(business.id, earliest < signup ? earliest : signup);
  }

  /* Every month either timeline touches, so a sign-up with no figures yet is
     still a month on the chart. */
  const months = [
    ...new Set([
      ...startedBy.values(),
      ...[...reportedMonths.values()].flatMap((set) => [...set]),
    ]),
  ].sort();

  const enrolment = months.map((month) => ({
    month: `${month}-01`,
    businesses: [...startedBy.values()].filter((m) => m <= month).length,
    reporting: [...reportedMonths.entries()].filter(
      ([id, covered]) => (startedBy.get(id) ?? '9999') <= month && covered.has(month),
    ).length,
  }));

  return {
    rows,
    enrolment,
    documentsPending: docs.filter((d) => d.review_status === 'pending').length,
    documentsVerified: docs.filter((d) => d.review_status === 'verified').length,
    documentsRejected: docs.filter((d) => d.review_status === 'rejected').length,
    pendingLinks: links.filter((l) => l.status === 'pending').length,
  };
}

/* ---------------------------------------------------------------------------
   Staff roles
   --------------------------------------------------------------------------- */

export interface StaffMember {
  profile: Profile;
  role: StaffRole;
  capabilities: {
    review_evidence: boolean;
    manage_businesses: boolean;
    manage_organisations: boolean;
    view_commercial: boolean;
    view_audit: boolean;
  };
  note: string;
  createdAt: string | null;
}

/**
 * What the signed-in staff account may do.
 *
 * Read from the database rather than worked out here, so the answer the
 * interface uses to hide a control is the same answer the database gives when
 * that control is used anyway. Hiding a button is a courtesy; `staff_can` and
 * the SECURITY DEFINER functions are the actual boundary.
 *
 * A staff account with no roster row is an owner, which is what keeps an
 * existing single-admin install working after the roles migration.
 */
export async function getMyStaffAccess(): Promise<{
  isOwner: boolean;
  role: StaffRole;
  can: StaffMember['capabilities'];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allow = {
    review_evidence: true,
    manage_businesses: true,
    manage_organisations: true,
    view_commercial: true,
    view_audit: true,
  };

  if (!user) {
    return { isOwner: false, role: 'analyst', can: { ...allow, review_evidence: false } };
  }

  const { data } = await supabase
    .from('staff_roles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data || data.role === 'owner') {
    return { isOwner: true, role: 'owner', can: allow };
  }

  return {
    isOwner: false,
    role: data.role,
    can: {
      review_evidence: data.can_review_evidence,
      manage_businesses: data.can_manage_businesses,
      manage_organisations: data.can_manage_organisations,
      view_commercial: data.can_view_commercial,
      view_audit: data.can_view_audit,
    },
  };
}

/** Everyone with staff access, for the roster screen. */
export async function getStaffMembers(): Promise<StaffMember[]> {
  const supabase = await createClient();

  const [profilesRes, rolesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('is_platform_admin', true).order('email'),
    supabase.from('staff_roles').select('*'),
  ]);

  const roles = new Map((rolesRes.data ?? []).map((r) => [r.user_id, r]));

  return (profilesRes.data ?? []).map((profile) => {
    const row = roles.get(profile.id);

    /* No row means an account that predates the roles migration, which
       `is_staff_owner` treats as an owner. Shown that way here too, rather
       than as some lesser role the database would not actually enforce. */
    if (!row) {
      return {
        profile,
        role: 'owner' as StaffRole,
        capabilities: {
          review_evidence: true,
          manage_businesses: true,
          manage_organisations: true,
          view_commercial: true,
          view_audit: true,
        },
        note: '',
        createdAt: null,
      };
    }

    return {
      profile,
      role: row.role,
      capabilities: {
        review_evidence: row.can_review_evidence,
        manage_businesses: row.can_manage_businesses,
        manage_organisations: row.can_manage_organisations,
        view_commercial: row.can_view_commercial,
        view_audit: row.can_view_audit,
      },
      note: row.note,
      createdAt: row.created_at,
    };
  });
}

/** Accounts that could be given staff access, for the add-someone picker. */
export async function findProfilesByEmail(term: string): Promise<Profile[]> {
  const trimmed = term.trim();
  if (trimmed.length < 3) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .ilike('email', `%${trimmed}%`)
    .eq('is_platform_admin', false)
    .order('email')
    .limit(10);

  return data ?? [];
}

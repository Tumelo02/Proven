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
  scoreDelta,
  toBusinessInput,
  trendOf,
  type BusinessInput,
  type CreditReadinessResult,
  type Decision,
  type GuidanceItem,
  type HealthResult,
  type Trend,
} from '@proven/engine';

import { createClient } from '@/lib/supabase/server';
import type {
  Business,
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
  /** From the confirmed funding link, when there is one. */
  fundingAmount: number | null;
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
    fundingAmount: linkRes.data?.amount ? Number(linkRes.data.amount) : null,
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
    })),
    pending: links.filter((l) => l.status === 'pending').length,
  };
}

/** Every business on the platform, funded or not, with its funder if it has one. */
export async function getAllBusinesses(): Promise<AdminBusinessRow[]> {
  const supabase = await createClient();

  const [bizRes, linksRes, periodsRes] = await Promise.all([
    supabase.from('businesses').select('*').order('created_at', { ascending: false }),
    supabase
      .from('funding_links')
      .select('business_id, status, organisations(name)')
      .returns<{ business_id: string; status: string; organisations: { name: string } | null }[]>(),
    supabase.from('reporting_periods').select('business_id'),
  ]);

  const links = linksRes.data ?? [];
  const periods = periodsRes.data ?? [];

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

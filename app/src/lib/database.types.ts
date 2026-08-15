/**
 * Database types, mirroring `supabase/migrations/`.
 *
 * Hand-written rather than generated, so the shapes stay readable and carry
 * the same comments as the schema. If a column changes, it changes here in the
 * same commit, and every query touching it becomes a compile error.
 */

export type ReportStatus = 'on-time' | 'late' | 'missed';
export type HealthTier = 'green' | 'yellow' | 'red';
export type MilestoneStatus = 'done' | 'current' | 'delayed' | 'pending';
export type TransactionType = 'revenue' | 'expense';
export type FundingStatus = 'unfunded' | 'applicant' | 'funded' | 'exited';
export type OrgRole = 'member' | 'admin';
export type ReviewStatus = 'pending' | 'verified' | 'rejected';

export type RejectReason =
  | 'unreadable'
  | 'amount_mismatch'
  | 'date_mismatch'
  | 'wrong_document'
  | 'not_a_receipt'
  | 'duplicate'
  | 'other';

/**
 * One wording per reason, used by the reviewer choosing it and by the
 * entrepreneur reading it. Written as the fix rather than as the fault: the
 * point is to tell someone what to do next, not to tell them off.
 */
export const REJECT_REASONS: Record<
  RejectReason,
  { label: string; toBusiness: string }
> = {
  unreadable: {
    label: 'Too blurred or cropped to read',
    toBusiness:
      'We could not read this clearly. Take the photo again in better light, with all four corners of the receipt in frame.',
  },
  amount_mismatch: {
    label: 'Amount does not match the entry',
    toBusiness:
      'The amount on this document is different from the amount you logged. Check the entry, or attach the receipt that matches it.',
  },
  date_mismatch: {
    label: 'Date is for a different period',
    toBusiness:
      'This document is dated outside the month you logged it against. Attach the one for that month, or correct the date on the entry.',
  },
  wrong_document: {
    label: 'Receipt is for something else',
    toBusiness:
      'This document does not appear to relate to the entry it is attached to. Attach the receipt or invoice for this particular cost.',
  },
  not_a_receipt: {
    label: 'Not a receipt or invoice',
    toBusiness:
      'This is not a receipt or invoice. Sales need a till summary or deposit slip; costs need a receipt or an invoice.',
  },
  duplicate: {
    label: 'Already attached to another entry',
    toBusiness:
      'This same document is already attached to another entry. Each entry needs its own receipt.',
  },
  other: {
    label: 'Something else',
    toBusiness: 'This document could not be accepted. See the note below.',
  },
};
export type LinkStatus = 'pending' | 'confirmed' | 'rejected';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  is_platform_admin: boolean;
  created_at: string;
}

/**
 * What kind of organisation this is.
 *
 * Drives vocabulary, not permissions: an incubator runs a "programme" where a
 * funder makes a "grant", but every type has the same powers.
 */
export type OrgType = 'funder' | 'incubator' | 'accelerator' | 'government' | 'other';

export type Organisation = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  org_type: OrgType;
  /** Object path in the `logos` bucket, always under the `org/` prefix. */
  logo_path: string | null;
  tagline: string;
  website: string;
  province: string;
}

/**
 * Who to speak to at an organisation.
 *
 * Separate from `organisations` because that table is readable by every
 * signed-in user, and a named person's direct line is not public information.
 * Visible to the organisation's own members and to businesses it has a
 * confirmed link to.
 */
export type OrgContact = {
  org_id: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  updated_at: string;
}

export type Membership = {
  id: string;
  user_id: string;
  org_id: string;
  role: OrgRole;
  created_at: string;
}

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  industry: string;
  region: string;
  funding_status: FundingStatus;
  started_on: string | null;
  staff_count: number;
  team_roles: string;
  created_at: string;
  /* When these records may be erased, set when a business is closed. Null
     while it is still active. See the POPIA migration. */
  retention_until: string | null;

  /* Profile. All optional: a business must be able to enrol and report its
     first month without filling any of this in. */
  tagline: string;
  description: string;
  /* Object path in the private `logos` bucket, never a URL. */
  logo_path: string | null;
  owner_name: string;
  owner_role: string;
  owner_phone: string;
  owner_email: string;
  address_line: string;
  city: string;
  province: string;
  postal_code: string;
  registration_number: string;
  tax_number: string;
  vat_number: string;
  bbbee_level: string;
  website: string;
  social_handle: string;
}

/** How someone is employed. Mirrors the `employment_type` enum. */
export type EmploymentType = 'full_time' | 'part_time' | 'casual' | 'volunteer' | 'owner';

/**
 * One person in a business.
 *
 * Rows rather than the free-text `businesses.team_roles`, because "how many
 * jobs does this business support" is the question every development funder
 * reports upward, and a text blob cannot be counted.
 */
export type TeamMember = {
  id: string;
  business_id: string;
  full_name: string;
  role: string;
  employment_type: EmploymentType;
  started_on: string | null;
  /* Null while they are still there. What makes headcount answerable for a
     past date rather than only for today. */
  left_on: string | null;
  created_at: string;
  /* An owner is a team member with this set, rather than a separate kind of
     record, so headcount and ownership never disagree about who is here. */
  is_owner: boolean;
  /* Share held, or null for an owner whose split has not been stated. Many
     partnerships have never written it down. */
  ownership_pct: number | null;
};

/**
 * An organisation's own record of acting on a flagged business.
 *
 * Never visible to the entrepreneur, and never to another funder of the same
 * business: this is the funder's working note, not a judgement added to the
 * business's record.
 */
export type FollowUp = {
  id: string;
  business_id: string;
  org_id: string;
  actor_id: string;
  note: string;
  /** The score at the moment of the follow-up, so a later reader can see what
      the funder was reacting to rather than what is true today. */
  score_at: number | null;
  created_at: string;
};

/** Headcount for one month, so job creation reads as a trend. */
export type StaffCount = {
  id: string;
  business_id: string;
  period_month: string;
  full_time: number;
  part_time: number;
  casual: number;
  created_at: string;
};

export type FundingLink = {
  id: string;
  business_id: string;
  org_id: string;
  status: LinkStatus;
  requested_by: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  amount: string | null;
  funded_on: string | null;
  terms: string;
  created_at: string;
}

export type ReportingPeriod = {
  id: string;
  business_id: string;
  period_month: string;
  revenue: string;
  expenses: string;
  customers: number;
  status: ReportStatus;
  submitted_at: string | null;
  created_at: string;
}

export type Transaction = {
  id: string;
  business_id: string;
  period_id: string | null;
  type: TransactionType;
  description: string;
  category: string;
  amount: string;
  occurred_on: string;
  created_at: string;
}

export type Document = {
  id: string;
  transaction_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  /* Set only when `review_status` is `rejected`, enforced by a CHECK: a
     rejection that does not say why is a flag, not guidance. */
  reject_reason: RejectReason | null;
  reject_note: string;
  uploaded_at: string;
}

export type Milestone = {
  id: string;
  business_id: string;
  label: string;
  status: MilestoneStatus;
  sort_order: number;
  target_date: string | null;
  completed_on: string | null;
  created_at: string;
}

export type ScoreSnapshot = {
  id: string;
  business_id: string;
  computed_at: string;
  health_score: string;
  health_tier: HealthTier;
  health_factors: Record<string, number>;
  credit_score: string;
  credit_band: string;
  engine_version: string;
}

/**
 * Shape the Supabase client is generic over, so `.from('x')` is checked.
 *
 * Every table needs a `Relationships` key: the client's `GenericTable` requires
 * it, and without it the whole schema silently fails to match and every query
 * degrades to `never`. Left empty because the joins used here (`select
 * '*, organisations(*)'`) are typed explicitly at the call site with
 * `.returns<T>()`.
 */
type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type AuditSeverity = 'info' | 'notice' | 'alert';

export type AuditLogEntry = {
  id: string;
  actor_id: string | null;
  /** Copied at the time, so the row still names someone after account deletion. */
  actor_email: string;
  org_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown>;
  severity: AuditSeverity;
  ip_address: string;
  user_agent: string;
  created_at: string;
};

/** `audit_log` with actor and organisation names already resolved. */
export type AuditTrailRow = {
  id: string;
  created_at: string;
  severity: AuditSeverity;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown>;
  actor_id: string | null;
  actor_name: string;
  actor_email: string;
  org_id: string | null;
  org_name: string | null;
  ip_address: string;
  user_agent: string;
};

/** What a person can be asked to agree to. Mirrors the `consent_kind` enum. */
export type ConsentKind = 'terms' | 'privacy' | 'share_with_funder' | 'whatsapp';

/**
 * One recorded agreement or withdrawal.
 *
 * Append-only: withdrawing consent inserts a row with `granted: false` rather
 * than editing the row that granted it, so what someone agreed to at the time
 * stays answerable. `subject_id` is deliberately not a foreign key, because the
 * record has to outlive the account it describes.
 */
export type Consent = {
  id: string;
  subject_id: string;
  subject_email: string;
  kind: ConsentKind;
  granted: boolean;
  policy_version: string;
  source: string;
  created_at: string;
};

/**
 * Every row above is a `type`, not an `interface`, and must stay that way.
 * The client constrains each table to `Record<string, unknown>`; an interface
 * has no implicit index signature and so fails that constraint, which makes
 * the whole schema fall back to `never` and every query lose its types. The
 * failure is silent: the errors surface at each call site, not here.
 */
export type Database = {
  /* Read by the Supabase client to pick its PostgREST behaviour. Generated
     type files carry it; without it the client cannot resolve the schema. */
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      profiles: Table<Profile, Partial<Profile> & { id: string; email: string }, Partial<Profile>>;
      organisations: Table<
        Organisation,
        Pick<Organisation, 'name' | 'slug'> & Partial<Omit<Organisation, 'id' | 'created_at'>>,
        Partial<Organisation>
      >;
      org_contacts: Table<
        OrgContact,
        Pick<OrgContact, 'org_id'> & Partial<Omit<OrgContact, 'updated_at'>>,
        Partial<OrgContact>
      >;
      memberships: Table<Membership, Omit<Membership, 'id' | 'created_at'>, Partial<Membership>>;
      /* Enrolment supplies only the six original columns. Everything else,
         `retention_until` and the whole profile, is filled in later or never,
         so requiring any of it here would make adding a business a form nobody
         finishes. Every one has a database default. */
      businesses: Table<
        Business,
        Pick<Business, 'owner_id' | 'name'> & Partial<Omit<Business, 'id' | 'created_at'>>,
        Partial<Business>
      >;
      funding_links: Table<FundingLink, Omit<FundingLink, 'id' | 'created_at'>, Partial<FundingLink>>;
      reporting_periods: Table<ReportingPeriod, Omit<ReportingPeriod, 'id' | 'created_at'>, Partial<ReportingPeriod>>;
      transactions: Table<Transaction, Omit<Transaction, 'id' | 'created_at'>, Partial<Transaction>>;
      documents: Table<Document, Omit<Document, 'id' | 'uploaded_at'>, Partial<Document>>;
      milestones: Table<Milestone, Omit<Milestone, 'id' | 'created_at'>, Partial<Milestone>>;
      score_snapshots: Table<ScoreSnapshot, Omit<ScoreSnapshot, 'id'>, Partial<ScoreSnapshot>>;
      audit_log: Table<
        AuditLogEntry,
        Omit<AuditLogEntry, 'id' | 'created_at'>,
        Partial<AuditLogEntry>
      >;
      /* Update is `never`: the table has no UPDATE policy, so allowing the
         shape here would compile a call that silently writes nothing. */
      consents: Table<Consent, Omit<Consent, 'id' | 'created_at'>, never>;
      team_members: Table<
        TeamMember,
        Pick<TeamMember, 'business_id' | 'full_name'> &
          Partial<Omit<TeamMember, 'id' | 'created_at'>>,
        Partial<TeamMember>
      >;
      staff_counts: Table<
        StaffCount,
        Pick<StaffCount, 'business_id' | 'period_month'> &
          Partial<Omit<StaffCount, 'id' | 'created_at'>>,
        Partial<StaffCount>
      >;
      /* Update is `never`: there is no UPDATE policy, deliberately. A working
         record that can be quietly rewritten is worth less than one that can
         only be added to. */
      follow_ups: Table<
        FollowUp,
        Pick<FollowUp, 'business_id' | 'org_id' | 'actor_id'> &
          Partial<Omit<FollowUp, 'id' | 'created_at'>>,
        never
      >;
    };
    /* Empty objects, NOT `Record<string, ...>`. An index signature here makes
       every string a valid view name, so `.from('businesses')` matches the
       view overload before the table one and the row type resolves to `never`.
       Add views by name, as below. */
    Views: {
      audit_trail: {
        Row: AuditTrailRow;
        Relationships: [];
      };
    };
    Functions: {
      /* Gathers everything held about the caller, for POPIA section 23. Takes
         no arguments on purpose: it reads `auth.uid()` itself, so there is no
         id in the request that could be pointed at somebody else. */
      export_my_data: {
        Args: Record<string, never>;
        Returns: Record<string, unknown>;
      };
      close_business: {
        Args: { target_business_id: string };
        Returns: undefined;
      };
      profile_completeness: {
        Args: { target_business_id: string };
        Returns: number;
      };
    };
    Enums: {
      report_status: ReportStatus;
      health_tier: HealthTier;
      milestone_status: MilestoneStatus;
      transaction_type: TransactionType;
      funding_status: FundingStatus;
      org_role: OrgRole;
      review_status: ReviewStatus;
      link_status: LinkStatus;
      consent_kind: ConsentKind;
      employment_type: EmploymentType;
      org_type: OrgType;
    };
    CompositeTypes: Record<string, never>;
  };
}

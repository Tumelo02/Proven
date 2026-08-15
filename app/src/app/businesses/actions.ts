'use server';

/**
 * Business enrolment and monthly reporting.
 *
 * Nothing here checks who the user is: the security rules already limit every
 * write to a business the user owns. Re-checking in application code would be
 * a second, weaker copy of the same rule.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { attachDocument } from './documents';
import type { ReportStatus } from '@/lib/database.types';

export interface FormState {
  error?: string;
  message?: string;
}

function toMoney(value: FormDataEntryValue | null): number {
  const n = Number.parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Normalise a `<input type="month">` value to the first of that month. */
function monthToDate(value: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  return `${value}-01`;
}

export async function createBusiness(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get('name') ?? '').trim();
  const industry = String(formData.get('industry') ?? '').trim();
  const region = String(formData.get('region') ?? '').trim();
  const isFunded = formData.get('is_funded') === 'yes';
  const orgId = String(formData.get('org_id') ?? '').trim();

  if (!name) return { error: 'Give your business a name.' };

  /* A business that says it is funded has to say by whom: an unattached
     "funded" business is a claim with nothing behind it. */
  if (isFunded && !orgId) {
    return { error: 'Choose the organisation that funded your business.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data: business, error } = await supabase
    .from('businesses')
    .insert({
      owner_id: user.id,
      name,
      industry,
      region,
      /* `applicant` until the organisation confirms, never `funded` on the
         business's say-so alone. The trigger flips it when they confirm. */
      funding_status: isFunded ? 'applicant' : 'unfunded',
      started_on: String(formData.get('started_on') ?? '') || null,
      staff_count: Number.parseInt(String(formData.get('staff_count') ?? '0'), 10) || 0,
      team_roles: String(formData.get('team_roles') ?? '').trim(),
    })
    .select()
    .single();

  if (error || !business) {
    return { error: error?.message ?? 'Could not create the business. Try again.' };
  }

  if (isFunded && orgId) {
    const { error: linkError } = await supabase.from('funding_links').insert({
      business_id: business.id,
      org_id: orgId,
      status: 'pending',
      requested_by: user.id,
      amount: String(toMoney(formData.get('amount'))),
      funded_on: String(formData.get('funded_on') ?? '') || null,
      terms: '',
      confirmed_by: null,
      confirmed_at: null,
    });

    if (linkError) {
      /* The business exists and is usable; only the link failed. Say so
         precisely rather than implying the whole enrolment failed. */
      return {
        error:
          'Your business was created, but the request to your funder could not be sent. You can send it again from the business page.',
      };
    }
  }

  revalidatePath('/dashboard');
  redirect(`/business/${business.id}`);
}

/** Log or update one month's figures. */
export async function saveMonth(_prev: FormState, formData: FormData): Promise<FormState> {
  const businessId = String(formData.get('business_id') ?? '');
  const month = monthToDate(String(formData.get('period_month') ?? ''));

  if (!businessId) return { error: 'Missing business.' };
  if (!month) return { error: 'Choose the month these figures are for.' };

  const revenue = toMoney(formData.get('revenue'));
  const expenses = toMoney(formData.get('expenses'));
  const customers = Number.parseInt(String(formData.get('customers') ?? '0'), 10) || 0;
  const status = String(formData.get('status') ?? 'on-time') as ReportStatus;

  const supabase = await createClient();

  /* One row per business per month, so re-submitting a month corrects it
     rather than creating a duplicate the score would count twice. */
  const { error } = await supabase.from('reporting_periods').upsert(
    {
      business_id: businessId,
      period_month: month,
      revenue: String(revenue),
      expenses: String(expenses),
      customers,
      status,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'business_id,period_month' },
  );

  if (error) return { error: error.message };

  revalidatePath(`/business/${businessId}`);
  return { message: 'Figures saved. Your score has been updated.' };
}

export async function addTransaction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = String(formData.get('business_id') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const amount = toMoney(formData.get('amount'));
  const type = String(formData.get('type') ?? 'expense') as 'revenue' | 'expense';
  const occurredOn = String(formData.get('occurred_on') ?? '');

  if (!businessId) return { error: 'Missing business.' };
  if (!description) return { error: 'Describe what this was for.' };
  if (amount <= 0) return { error: 'Enter an amount greater than zero.' };
  if (!occurredOn) return { error: 'Choose the date.' };

  const supabase = await createClient();

  /* Attach to the month it falls in, so guidance can name this month's
     largest cost without guessing. */
  const monthStart = `${occurredOn.slice(0, 7)}-01`;
  const { data: period } = await supabase
    .from('reporting_periods')
    .select('id')
    .eq('business_id', businessId)
    .eq('period_month', monthStart)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from('transactions')
    .insert({
      business_id: businessId,
      period_id: period?.id ?? null,
      type,
      description,
      category: String(formData.get('category') ?? '').trim(),
      amount: String(amount),
      occurred_on: occurredOn,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  /* A receipt chosen alongside the entry is attached in the same step, so
     logging a cost and proving it is one action rather than two. */
  const file = formData.get('file');
  if (created && file instanceof File && file.size > 0) {
    const proof = new FormData();
    proof.set('transaction_id', created.id);
    proof.set('business_id', businessId);
    proof.set('file', file);

    const result = await attachDocument({}, proof);
    if (result.error) {
      /* The entry is saved and usable; only the receipt failed. Say which,
         rather than implying the whole thing was lost. */
      revalidatePath(`/business/${businessId}`, 'layout');
      return { error: `Entry added, but the receipt did not attach: ${result.error}` };
    }
  }

  revalidatePath(`/business/${businessId}`, 'layout');
  return { message: 'Entry added.' };
}

/**
 * Turn this month's logged transactions into a finished month.
 *
 * The figures are not typed in: they are the sum of what has already been
 * entered, which is the point of logging transactions at all. Asking someone
 * to total their own entries would invite a number that disagrees with them.
 */
export async function submitMonth(_prev: FormState, formData: FormData): Promise<FormState> {
  const businessId = String(formData.get('business_id') ?? '');
  const monthValue = String(formData.get('period_month') ?? '');
  const month = monthToDate(monthValue);

  if (!businessId) return { error: 'Missing business.' };
  if (!month) return { error: 'Choose the month these figures are for.' };

  const customers = Number.parseInt(String(formData.get('customers') ?? '0'), 10) || 0;
  const stageUpdate = String(formData.get('stage_update') ?? 'unchanged');

  const supabase = await createClient();

  /* Everything logged in that calendar month, whether or not it was attached
     to a period row at the time. */
  const monthPrefix = month.slice(0, 7);
  const { data: entries } = await supabase
    .from('transactions')
    .select('type, amount, occurred_on')
    .eq('business_id', businessId)
    .gte('occurred_on', `${monthPrefix}-01`)
    .lte('occurred_on', `${monthPrefix}-31`);

  let revenue = 0;
  let expenses = 0;
  for (const t of entries ?? []) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'revenue') revenue += amt;
    else expenses += amt;
  }

  /* On time if it arrives by the 15th of the month after the one reported;
     the same rule the reporting bar states, so the two can never disagree. */
  const due = new Date(`${month}T00:00:00Z`);
  due.setUTCMonth(due.getUTCMonth() + 1);
  due.setUTCDate(15);
  const status: ReportStatus = new Date() <= due ? 'on-time' : 'late';

  const { error } = await supabase.from('reporting_periods').upsert(
    {
      business_id: businessId,
      period_month: month,
      revenue: String(revenue),
      expenses: String(expenses),
      customers,
      status,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: 'business_id,period_month' },
  );

  if (error) return { error: error.message };

  /* An optional stage change, sent with the figures rather than as a separate
     errand: the two are one check-in in the entrepreneur's mind. */
  if (stageUpdate === 'complete' || stageUpdate === 'delayed') {
    const { data: stage } = await supabase
      .from('milestones')
      .select('id')
      .eq('business_id', businessId)
      .in('status', ['current', 'delayed'])
      .order('sort_order')
      .limit(1)
      .maybeSingle();

    if (stage) {
      await supabase
        .from('milestones')
        .update({
          status: stageUpdate === 'complete' ? 'done' : 'delayed',
          completed_on:
            stageUpdate === 'complete' ? new Date().toISOString().slice(0, 10) : null,
        })
        .eq('id', stage.id);

      /* Finishing a stage starts the next one, so the journey never stalls
         with nothing in progress. */
      if (stageUpdate === 'complete') {
        const { data: next } = await supabase
          .from('milestones')
          .select('id')
          .eq('business_id', businessId)
          .eq('status', 'pending')
          .order('sort_order')
          .limit(1)
          .maybeSingle();
        if (next) {
          await supabase.from('milestones').update({ status: 'current' }).eq('id', next.id);
        }
      }
    }
  }

  revalidatePath(`/business/${businessId}`, 'layout');
  return { message: `${monthValue} submitted. Your score has been updated.` };
}

/** Move a stage between not-started, in-progress, late and done. */
export async function setMilestoneStatus(formData: FormData): Promise<void> {
  const milestoneId = String(formData.get('milestone_id') ?? '');
  const businessId = String(formData.get('business_id') ?? '');
  const status = String(formData.get('status') ?? '') as
    | 'done'
    | 'current'
    | 'delayed'
    | 'pending';

  if (!milestoneId || !businessId) return;

  const supabase = await createClient();
  await supabase
    .from('milestones')
    .update({
      status,
      completed_on: status === 'done' ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', milestoneId);

  revalidatePath(`/business/${businessId}/milestones`);
  revalidatePath(`/business/${businessId}`);
}

/** Ask an organisation to confirm it funds this business. */
export async function requestFunderLink(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const businessId = String(formData.get('business_id') ?? '');
  const orgId = String(formData.get('org_id') ?? '');

  if (!businessId || !orgId) return { error: 'Choose an organisation.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { error } = await supabase.from('funding_links').insert({
    business_id: businessId,
    org_id: orgId,
    status: 'pending',
    requested_by: user.id,
    amount: String(toMoney(formData.get('amount'))),
    funded_on: String(formData.get('funded_on') ?? '') || null,
    terms: '',
    confirmed_by: null,
    confirmed_at: null,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'You have already sent a request to that organisation.' };
    }
    return { error: error.message };
  }

  await supabase
    .from('businesses')
    .update({ funding_status: 'applicant' })
    .eq('id', businessId);

  revalidatePath(`/business/${businessId}`);
  return { message: 'Request sent. The organisation will confirm it.' };
}

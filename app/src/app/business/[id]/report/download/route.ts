import { NextResponse } from 'next/server';
import { getBusinessReport, defaultRange, rangeLabel } from '../report-data';
import { recordEvent } from '@/lib/audit';
import { buildWorkbook, XLSX_CONTENT_TYPE, type Cell, type SheetStyle } from '@/lib/xlsx';

/**
 * The financial report as a real Excel workbook.
 *
 * Genuinely `.xlsx`, not SpreadsheetML wearing an `.xls` name. The previous
 * version served XML under a `.xls` extension, so Excel checked the bytes,
 * found `<?xml` where the old binary format's signature should be, and warned
 * that the file "could be corrupted or unsafe" before it would open. A
 * business sending its financials to a bank should never have to talk somebody
 * past a security warning.
 *
 * Laid out as the statement on screen is — months across, lines of the account
 * down — so the download and the page say the same thing in the same shape.
 *
 * Row-level security does the access check: the query runs as the signed-in
 * user, so asking for a business they may not see returns nothing and this
 * answers 404, the same answer a business that does not exist gives.
 */

/* Styles, referenced by index. Kept few on purpose: a report needs a handful
   of looks, not one per cell. */
const S = {
  title: 0,
  subtitle: 1,
  head: 2,
  line: 3,
  indent: 4,
  group: 5,
  money: 6,
  moneyGood: 7,
  moneyBad: 8,
  percent: 9,
  number: 10,
  totalMoney: 11,
  totalText: 12,
  result: 13,
};

const STYLES: SheetStyle[] = [
  { bold: true, size: 16, colour: '0A2540' }, // title
  { size: 10, colour: '5D6F88' }, // subtitle
  { bold: true, colour: 'FFFFFF', fill: '0A2540' }, // head
  { bold: true, colour: '0A2540' }, // line
  { colour: '5D6F88' }, // indent
  { bold: true, colour: '0A2540', fill: 'EEF2F8' }, // group
  { format: 'money' }, // money
  { format: 'money', colour: '12805C' }, // moneyGood
  { format: 'money', colour: 'C0322B' }, // moneyBad
  { format: 'percent' }, // percent
  {}, // number
  { bold: true, format: 'money', fill: 'EEF2F8' }, // totalMoney
  { bold: true, fill: 'EEF2F8' }, // totalText
  { bold: true, format: 'money', border: 'both' }, // result
];

function text(value: string, style?: number): Cell {
  return { value, ...(style === undefined ? {} : { style }) };
}

function num(value: number | null, style: number): Cell {
  return value === null ? { value: null } : { value, style };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);

  const month = /^\d{4}-\d{2}$/;
  const fallback = defaultRange();
  const rawFrom = url.searchParams.get('from');
  const rawTo = url.searchParams.get('to');
  const from = rawFrom && month.test(rawFrom) ? rawFrom : fallback.from;
  const to = rawTo && month.test(rawTo) ? rawTo : fallback.to;

  const report = await getBusinessReport(id, from, to);
  if (!report) {
    return new NextResponse('Not found', { status: 404 });
  }

  const t = report.totals;
  const lines = report.lines;
  const rows: Cell[][] = [];

  rows.push([text(report.businessName, S.title)]);
  rows.push([text(`Financial report · ${rangeLabel(from, to)}`, S.subtitle)]);
  rows.push([text(`Generated ${report.generatedOn} · Proven`, S.subtitle)]);
  rows.push([]);

  /* Months across the top, matching the statement on screen. */
  rows.push([
    text('Line', S.head),
    ...lines.map((l) => text(l.label, S.head)),
    text('Total', S.head),
  ]);

  const blanks = lines.map(() => text(''));

  rows.push([text('Income', S.group), ...blanks, text('', S.group)]);
  rows.push([
    text('Money in', S.indent),
    ...lines.map((l) => num(l.revenue, S.money)),
    num(t.revenue, S.totalMoney),
  ]);

  rows.push([text('Costs', S.group), ...blanks, text('', S.group)]);
  for (const s of report.spending) {
    rows.push([
      text(s.category, S.indent),
      ...lines.map((l) => {
        const v = s.byMonth[l.month.slice(0, 7)] ?? 0;
        /* Blank, not zero: a month with no cost in this line is not a month
           that spent nothing on it. */
        return v > 0 ? num(v, S.money) : text('');
      }),
      num(s.total, S.money),
    ]);
  }
  rows.push([
    text('Total costs', S.line),
    ...lines.map((l) => num(l.expenses, S.money)),
    num(t.expenses, S.totalMoney),
  ]);

  rows.push([
    text('Left over', S.line),
    ...lines.map((l) => num(l.profit, l.profit >= 0 ? S.moneyGood : S.moneyBad)),
    num(t.profit, S.result),
  ]);
  rows.push([
    text('Margin', S.indent),
    ...lines.map((l) => (l.revenue > 0 ? num(l.margin, S.percent) : text(''))),
    t.revenue > 0 ? num(t.margin, S.percent) : text(''),
  ]);

  /* The cash position. Profit says how the month went; this says what is
     actually in the account, and a loan or a big purchase pulls them apart. */
  rows.push([text('In the bank', S.group), ...blanks, text('', S.group)]);
  rows.push([
    text('Available balance', S.indent),
    ...lines.map((l) => num(l.availableBalance, S.money)),
    report.latestBalance?.available != null
      ? num(report.latestBalance.available, S.totalMoney)
      : text(''),
  ]);

  rows.push([
    text('Customers', S.indent),
    ...lines.map((l) => num(l.customers, S.number)),
    num(t.customers, S.totalText),
  ]);

  rows.push([]);
  rows.push([text('Summary', S.group)]);
  rows.push([text('Months reported', S.indent), num(t.months, S.number)]);
  rows.push([text('Profitable months', S.indent), num(t.profitableMonths, S.number)]);
  rows.push([text('Months at a loss', S.indent), num(t.lossMonths, S.number)]);
  rows.push([text('Average money in', S.indent), num(t.averageRevenue, S.money)]);
  rows.push([text('Average money out', S.indent), num(t.averageExpenses, S.money)]);
  rows.push([
    text('Best month', S.indent),
    text(t.bestMonth ? t.bestMonth.label : '—'),
  ]);
  rows.push([
    text('Hardest month', S.indent),
    text(t.worstMonth ? t.worstMonth.label : '—'),
  ]);
  /* Health score, credit readiness and evidence coverage are deliberately not
     here. They are Proven's reading of the figures rather than the figures
     themselves, and this sheet goes to a bank that will form its own view from
     the numbers above. They remain on the screen, where the business can see
     what its record is earning. */

  rows.push([]);
  rows.push([
    text(
      'Every figure comes from the months this business reported. Nothing is estimated.',
      S.subtitle,
    ),
  ]);

  const workbook = buildWorkbook({
    sheetName: 'Financial report',
    rows,
    styles: STYLES,
  });

  /* Who downloaded their own figures, and for what period. A business reading
     its own record is unremarkable, so this is `info` rather than an alert —
     but it is still part of the trail. */
  await recordEvent({
    action: 'business.report_exported',
    entityType: 'business',
    entityId: id,
    severity: 'info',
    detail: { from, to, months: lines.length },
  });

  const safeName = report.businessName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${safeName}-report-${from}-to-${to}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}

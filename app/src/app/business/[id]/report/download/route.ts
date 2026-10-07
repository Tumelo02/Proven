import { NextResponse } from 'next/server';
import { getBusinessReport, defaultRange, rangeLabel } from '../report-data';
import { recordEvent } from '@/lib/audit';

/**
 * The financial report as a styled Excel workbook.
 *
 * SpreadsheetML 2003 rather than CSV, matching the funder export: it carries
 * the title block, the totals, column widths and the colours, so what opens is
 * a report a bank would accept rather than a wall of commas. Excel, Google
 * Sheets and Numbers all read it, and it needs no library to write.
 *
 * Row-level security does the access check. The query runs as the signed-in
 * user, so asking for a business they may not see returns nothing and this
 * answers 404 — the same answer a business that does not exist gives, which is
 * deliberate.
 */

function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cell(value: string | number, style: string, type: 'String' | 'Number' = 'String') {
  return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${esc(value)}</Data></Cell>`;
}

function row(cells: string): string {
  return `<Row>${cells}</Row>`;
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

  const header = row(
    ['Month', 'Money in', 'Money out', 'Left over', 'Margin', 'Customers']
      .map((h) => cell(h, 'head'))
      .join(''),
  );

  const body = report.lines
    .map((l) =>
      row(
        cell(l.label, 'text') +
          cell(l.revenue, 'money', 'Number') +
          cell(l.expenses, 'money', 'Number') +
          cell(l.profit, l.profit >= 0 ? 'moneyGood' : 'moneyBad', 'Number') +
          cell(l.revenue > 0 ? l.margin : '', l.revenue > 0 ? 'pct' : 'text', l.revenue > 0 ? 'Number' : 'String') +
          cell(l.customers, 'text', 'Number'),
      ),
    )
    .join('');

  const totalRow = row(
    cell('Total', 'head') +
      cell(t.revenue, 'totalMoney', 'Number') +
      cell(t.expenses, 'totalMoney', 'Number') +
      cell(t.profit, t.profit >= 0 ? 'totalGood' : 'totalBad', 'Number') +
      cell(t.revenue > 0 ? t.margin : '', t.revenue > 0 ? 'totalPct' : 'head', t.revenue > 0 ? 'Number' : 'String') +
      cell(t.customers, 'head', 'Number'),
  );

  const spendRows = report.spending.length
    ? row(cell('Where the money went', 'section') + cell('', 'section') + cell('', 'section')) +
      row(['Category', 'Total', 'Share'].map((h) => cell(h, 'head')).join('')) +
      report.spending
        .map((s) =>
          row(
            cell(s.category, 'text') +
              cell(s.total, 'money', 'Number') +
              cell(s.share, 'pct', 'Number'),
          ),
        )
        .join('')
    : '';

  const summary =
    row(cell('Summary', 'section') + cell('', 'section')) +
    row(cell('Months reported', 'text') + cell(t.months, 'text', 'Number')) +
    row(cell('Profitable months', 'text') + cell(t.profitableMonths, 'text', 'Number')) +
    row(cell('Months at a loss', 'text') + cell(t.lossMonths, 'text', 'Number')) +
    row(cell('Average money in', 'text') + cell(t.averageRevenue, 'money', 'Number')) +
    row(cell('Average money out', 'text') + cell(t.averageExpenses, 'money', 'Number')) +
    row(
      cell('Best month', 'text') +
        cell(t.bestMonth ? `${t.bestMonth.label}` : '—', 'text'),
    ) +
    row(
      cell('Hardest month', 'text') +
        cell(t.worstMonth ? `${t.worstMonth.label}` : '—', 'text'),
    ) +
    row(cell('Health score', 'text') + cell(report.score ?? '—', 'text')) +
    row(cell('Credit readiness', 'text') + cell(report.readiness ?? '—', 'text')) +
    row(cell('Backed by evidence', 'text') + cell(`${report.evidencePct}%`, 'text'));

  const xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="title"><Font ss:Size="15" ss:Bold="1" ss:Color="#0A2540"/></Style>
  <Style ss:ID="sub"><Font ss:Size="10" ss:Color="#5D6F88"/></Style>
  <Style ss:ID="section"><Font ss:Size="11" ss:Bold="1" ss:Color="#0A2540"/>
   <Interior ss:Color="#EEF2F8" ss:Pattern="Solid"/></Style>
  <Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#0A2540" ss:Pattern="Solid"/></Style>
  <Style ss:ID="text"><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="money"><NumberFormat ss:Format="&quot;R&quot;#,##0.00"/></Style>
  <Style ss:ID="moneyGood"><NumberFormat ss:Format="&quot;R&quot;#,##0.00"/>
   <Font ss:Color="#12805C"/></Style>
  <Style ss:ID="moneyBad"><NumberFormat ss:Format="&quot;R&quot;#,##0.00"/>
   <Font ss:Color="#C0322B"/></Style>
  <Style ss:ID="pct"><NumberFormat ss:Format="0.0%"/></Style>
  <Style ss:ID="totalMoney"><Font ss:Bold="1"/><NumberFormat ss:Format="&quot;R&quot;#,##0.00"/>
   <Interior ss:Color="#EEF2F8" ss:Pattern="Solid"/></Style>
  <Style ss:ID="totalGood"><Font ss:Bold="1" ss:Color="#12805C"/>
   <NumberFormat ss:Format="&quot;R&quot;#,##0.00"/>
   <Interior ss:Color="#EEF2F8" ss:Pattern="Solid"/></Style>
  <Style ss:ID="totalBad"><Font ss:Bold="1" ss:Color="#C0322B"/>
   <NumberFormat ss:Format="&quot;R&quot;#,##0.00"/>
   <Interior ss:Color="#EEF2F8" ss:Pattern="Solid"/></Style>
  <Style ss:ID="totalPct"><Font ss:Bold="1"/><NumberFormat ss:Format="0.0%"/>
   <Interior ss:Color="#EEF2F8" ss:Pattern="Solid"/></Style>
 </Styles>
 <Worksheet ss:Name="Financial report">
  <Table>
   <Column ss:Width="130"/><Column ss:Width="95"/><Column ss:Width="95"/>
   <Column ss:Width="95"/><Column ss:Width="70"/><Column ss:Width="80"/>
   ${row(cell(report.businessName, 'title'))}
   ${row(cell(`Financial report · ${rangeLabel(from, to)}`, 'sub'))}
   ${row(cell(`Generated ${report.generatedOn} · Proven`, 'sub'))}
   ${row('')}
   ${header}
   ${body}
   ${totalRow}
   ${row('')}
   ${summary}
   ${row('')}
   ${spendRows}
   ${row('')}
   ${row(cell('Every figure comes from the months this business reported. Nothing is estimated.', 'sub'))}
  </Table>
 </Worksheet>
</Workbook>`;

  /* Who downloaded their own figures, and for what period. A business reading
     its own record is unremarkable, so this is `info` rather than an alert —
     but it is still part of the trail. */
  await recordEvent({
    action: 'business.report_exported',
    entityType: 'business',
    entityId: id,
    severity: 'info',
    detail: { from, to, months: report.lines.length },
  });

  const safeName = report.businessName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}-report-${from}-to-${to}.xls"`,
      'Cache-Control': 'no-store',
    },
  });
}

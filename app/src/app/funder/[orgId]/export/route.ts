import { NextResponse } from 'next/server';
import { getReportData } from '../report-data';

/**
 * The portfolio as a styled Excel workbook.
 *
 * SpreadsheetML 2003 rather than CSV: it carries the title block, the summary,
 * column widths and the band colours, so what a funder opens looks like a
 * report rather than a data dump. Excel, Google Sheets and Numbers all read it,
 * and it needs no library to write.
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

const HEAD = [
  'Business',
  'Owner',
  'Industry',
  'Region',
  'Grant',
  'Released %',
  'Score',
  'Band',
  'Credit readiness',
  'Reporting',
  'Evidence %',
  'Jobs',
  'Months',
];

const WIDTHS = [190, 130, 120, 110, 90, 70, 60, 70, 150, 100, 90, 60, 70];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const data = await getReportData(orgId);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const spacer = '<Row ss:Height="8"/>';

  const xml =
    '<?xml version="1.0"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ' +
    'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles>' +
      /* Protection is a cell property in SpreadsheetML, so it is set on the
         default style and inherited by every cell rather than repeated. */
      '<Style ss:ID="Default"><Font ss:FontName="Arial" ss:Size="10"/>' +
        '<Alignment ss:Vertical="Center"/><Protection ss:Protected="1"/></Style>' +
      '<Style ss:ID="title"><Font ss:FontName="Arial" ss:Size="18" ss:Bold="1" ss:Color="#0A2540"/></Style>' +
      '<Style ss:ID="tagline"><Font ss:FontName="Arial" ss:Size="10" ss:Italic="1" ss:Color="#0B7C8C"/></Style>' +
      '<Style ss:ID="meta"><Font ss:FontName="Arial" ss:Size="9" ss:Color="#5D6F88"/></Style>' +
      '<Style ss:ID="section"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>' +
        '<Interior ss:Color="#0A2540" ss:Pattern="Solid"/>' +
        '<Alignment ss:Vertical="Center"/></Style>' +
      '<Style ss:ID="sumlbl"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#0A2540"/></Style>' +
      '<Style ss:ID="sumval"><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1"/></Style>' +
      '<Style ss:ID="summoney"><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1"/>' +
        '<NumberFormat ss:Format="&quot;R&quot;#,##0"/></Style>' +
      '<Style ss:ID="hdr"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>' +
        '<Interior ss:Color="#0A2540" ss:Pattern="Solid"/>' +
        '<Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>' +
      '<Style ss:ID="td"><Font ss:FontName="Arial" ss:Size="10"/>' +
        '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDE5F0"/></Borders></Style>' +
      '<Style ss:ID="tdnum" ss:Parent="td"><Alignment ss:Horizontal="Right"/></Style>' +
      '<Style ss:ID="tdmoney" ss:Parent="td"><NumberFormat ss:Format="&quot;R&quot;#,##0"/>' +
        '<Alignment ss:Horizontal="Right"/></Style>' +
      '<Style ss:ID="tdlate" ss:Parent="td"><Font ss:FontName="Arial" ss:Size="10" ss:Color="#C0322B"/></Style>' +
      '<Style ss:ID="green" ss:Parent="td"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#12805C"/>' +
        '<Interior ss:Color="#E3F6EE" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>' +
      '<Style ss:ID="yellow" ss:Parent="td"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#A86A00"/>' +
        '<Interior ss:Color="#FDF1DC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>' +
      '<Style ss:ID="red" ss:Parent="td"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#C0322B"/>' +
        '<Interior ss:Color="#FDEAE8" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>' +
      '<Style ss:ID="note"><Font ss:FontName="Arial" ss:Size="8" ss:Italic="1" ss:Color="#8B9BB0"/></Style>' +
    '</Styles>' +
    '<Worksheet ss:Name="Portfolio"><Table>' +
      WIDTHS.map((w) => `<Column ss:Width="${w}"/>`).join('') +

      /* Title block */
      `<Row ss:Height="30">${cell('PROVEN, Portfolio Report', 'title')}</Row>` +
      `<Row>${cell('Turning Potential into Proof', 'tagline')}</Row>` +
      `<Row>${cell(`Generated ${data.generatedOn} · ${data.orgName} · ${data.total} funded businesses`, 'meta')}</Row>` +
      spacer +

      /* Summary block */
      `<Row ss:Height="20"><Cell ss:StyleID="section" ss:MergeAcross="5"><Data ss:Type="String">SUMMARY</Data></Cell></Row>` +
      `<Row>${cell('Total funding', 'sumlbl')}<Cell ss:StyleID="summoney"><Data ss:Type="Number">${data.totalFunding}</Data></Cell></Row>` +
      `<Row>${cell('Jobs supported', 'sumlbl')}${cell(data.jobs, 'sumval', 'Number')}</Row>` +
      `<Row>${cell('Portfolio health', 'sumlbl')}${cell(`${data.avgScore}/100`, 'sumval')}</Row>` +
      `<Row>${cell('Needs attention', 'sumlbl')}${cell(data.needAttention, 'sumval', 'Number')}</Row>` +
      `<Row>${cell('Healthy / Watch / At risk', 'sumlbl')}${cell(
        `${data.counts.green} / ${data.counts.yellow} / ${data.counts.red}`,
        'sumval',
      )}</Row>` +
      spacer +

      /* Business table, by health score */
      `<Row ss:Height="20"><Cell ss:StyleID="section" ss:MergeAcross="${HEAD.length - 1}">` +
        '<Data ss:Type="String">FUNDED BUSINESSES, by health score</Data></Cell></Row>' +
      `<Row ss:Height="28">${HEAD.map((h) => cell(h, 'hdr')).join('')}</Row>` +
      data.rows
        .map(
          (r) =>
            '<Row>' +
            cell(r.name, 'td') +
            cell(r.owner, 'td') +
            cell(r.industry, 'td') +
            cell(r.region, 'td') +
            (r.grant === null
              ? cell('—', 'tdnum')
              : `<Cell ss:StyleID="tdmoney"><Data ss:Type="Number">${r.grant}</Data></Cell>`) +
            cell(r.released, 'tdnum', 'Number') +
            cell(r.score, 'tdnum', 'Number') +
            cell(r.band, r.tier) +
            cell(r.readiness, 'td') +
            cell(r.reporting, r.reportingLate ? 'tdlate' : 'td') +
            cell(r.coverage, 'tdnum', 'Number') +
            cell(r.jobs, 'tdnum', 'Number') +
            cell(r.months, 'tdnum', 'Number') +
            '</Row>',
        )
        .join('') +
      spacer +
      `<Row><Cell ss:StyleID="note" ss:MergeAcross="${HEAD.length - 1}"><Data ss:Type="String">` +
        esc(
          'Scores are calculated from four weighted measures: sales trend 35%, spending control 25%, ' +
            'reporting consistency 20%, customer growth 20%. Credit readiness is evidence to support, ' +
            'not replace, a formal credit assessment.',
        ) +
      '</Data></Cell></Row>' +
      /* Says where the file came from, on the sheet itself. A spreadsheet gets
         forwarded and renamed; the attribution has to travel with it. */
      `<Row><Cell ss:StyleID="note" ss:MergeAcross="${HEAD.length - 1}"><Data ss:Type="String">` +
        esc(
          `Generated by Proven on ${data.generatedOn} for ${data.orgName}. ` +
            'Figures are reported by each business. This sheet is a read-only extract: ' +
            'editing it changes nothing in Proven.',
        ) +
      '</Data></Cell></Row>' +
    '</Table>' +
    '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">' +
      '<FreezePanes/><SplitHorizontal>13</SplitHorizontal><TopRowBottomPane>13</TopRowBottomPane>' +
      '<ActivePane>2</ActivePane>' +
      /* Protected, so the figures are not altered by an accidental keystroke on
         the way to somebody's board. Not a security control, the file is on
         their machine, but it makes the sheet read-only by default and says so
         when someone tries to type in it. */
      '<Protected/>' +
    '</WorksheetOptions></Worksheet></Workbook>';

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      'Content-Disposition': `attachment; filename="proven-portfolio-${stamp}.xls"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

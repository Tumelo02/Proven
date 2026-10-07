import 'server-only';

import { deflateRawSync } from 'node:zlib';
import zlib from 'node:zlib';

/**
 * A real `.xlsx` writer, in about two hundred lines and with no dependency.
 *
 * Proven used to serve SpreadsheetML 2003 — an XML dialect — under a `.xls`
 * name. Excel checks the bytes rather than the name, finds `<?xml` where a
 * `.xls` must begin with the OLE2 magic number, and warns that "the file
 * format and extension don't match … the file could be corrupted or unsafe"
 * before it will open. A business sending its financials to a bank should
 * never have to talk somebody past a security warning, so the file is now
 * genuinely what it claims to be.
 *
 * An `.xlsx` is a ZIP of XML parts. Node can deflate and checksum, which is
 * everything a ZIP needs, so the whole thing is written here rather than
 * pulling in a spreadsheet library for one download.
 *
 * Deliberately a small subset: one sheet, strings and numbers, bold, colour,
 * fills, money and percentage formats, column widths. That is what a financial
 * report needs and nothing more.
 */

/* --------------------------------------------------------------------------
   ZIP
   -------------------------------------------------------------------------- */

/**
 * CRC-32, as a ZIP entry requires.
 *
 * `zlib.crc32` only exists from Node 20.15, and the deployment target is not
 * pinned, so a small table-driven implementation stands in where it is
 * missing. A corrupt download on an older runtime would be a worse bug than
 * the warning this whole file exists to remove.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  const native = (zlib as unknown as { crc32?: (b: Buffer) => number }).crc32;
  if (typeof native === 'function') return native(buf);

  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

/** DOS timestamp. A fixed date keeps two runs of the same report identical. */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = deflateRawSync(entry.data, { level: 9 });
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0); // local file header
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra field length
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0); // central directory header
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    locals.push(local, compressed);
    centrals.push(central);
    offset += local.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
}

/* --------------------------------------------------------------------------
   Sheet contents
   -------------------------------------------------------------------------- */

export type CellValue = string | number | null;

export interface Cell {
  value: CellValue;
  /** Index into the `styles` passed to `buildWorkbook`. */
  style?: number;
}

export interface SheetStyle {
  bold?: boolean;
  /** Six hex digits, no hash. */
  colour?: string;
  fill?: string;
  size?: number;
  /** `money`, `percent` or plain. */
  format?: 'money' | 'percent';
  border?: 'top' | 'bottom' | 'both';
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** `A1`, `B2`, … from zero-based indices. */
function ref(row: number, col: number): string {
  let name = '';
  let n = col;
  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${name}${row + 1}`;
}

/**
 * Build a single-sheet workbook.
 *
 * Styles are passed once and referenced by index, which is how the format
 * itself works: a spreadsheet with four hundred cells should carry a handful
 * of style definitions rather than four hundred.
 */
export function buildWorkbook({
  sheetName,
  rows,
  styles,
  columnWidths,
}: {
  sheetName: string;
  rows: Cell[][];
  styles: SheetStyle[];
  columnWidths?: number[];
}): Buffer {
  /* Inline strings rather than a shared string table: the table saves space on
     a sheet that repeats the same words thousands of times, which a financial
     report does not, and it costs a second file and an index to maintain. */
  const sheetRows = rows
    .map((cells, r) => {
      const body = cells
        .map((cell, c) => {
          if (cell.value === null || cell.value === '') return '';
          const s = cell.style ? ` s="${cell.style}"` : '';
          if (typeof cell.value === 'number') {
            return `<c r="${ref(r, c)}"${s}><v>${cell.value}</v></c>`;
          }
          return `<c r="${ref(r, c)}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(
            String(cell.value),
          )}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${body}</row>`;
    })
    .join('');

  const cols = columnWidths?.length
    ? `<cols>${columnWidths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';

  /* Number formats start at 164: everything below that is reserved by the
     format for its built-ins. */
  const numFmts = [
    { id: 164, code: '&quot;R&quot;#,##0.00' },
    { id: 165, code: '0.0%' },
  ];

  const fonts = [
    '<font><sz val="11"/><name val="Calibri"/></font>',
    ...styles.map((s) => {
      const bold = s.bold ? '<b/>' : '';
      const colour = s.colour ? `<color rgb="FF${s.colour}"/>` : '';
      const size = `<sz val="${s.size ?? 11}"/>`;
      return `<font>${bold}${size}${colour}<name val="Calibri"/></font>`;
    }),
  ];

  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    ...styles.map((s) =>
      s.fill
        ? `<fill><patternFill patternType="solid"><fgColor rgb="FF${s.fill}"/><bgColor indexed="64"/></patternFill></fill>`
        : '<fill><patternFill patternType="none"/></fill>',
    ),
  ];

  const borders = [
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    ...styles.map((s) => {
      const top = s.border === 'top' || s.border === 'both' ? '<top style="thin"/>' : '<top/>';
      const bottom =
        s.border === 'bottom' || s.border === 'both' ? '<bottom style="thin"/>' : '<bottom/>';
      return `<border><left/><right/>${top}${bottom}<diagonal/></border>`;
    }),
  ];

  const cellXfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    ...styles.map((s, i) => {
      const numFmtId = s.format === 'money' ? 164 : s.format === 'percent' ? 165 : 0;
      return `<xf numFmtId="${numFmtId}" fontId="${i + 1}" fillId="${i + 2}" borderId="${
        i + 1
      }" xfId="0" applyFont="1" applyFill="1" applyBorder="1"${
        numFmtId ? ' applyNumberFormat="1"' : ''
      }/>`;
    }),
  ];

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="${numFmts.length}">${numFmts
    .map((f) => `<numFmt numFmtId="${f.id}" formatCode="${f.code}"/>`)
    .join('')}</numFmts>
<fonts count="${fonts.length}">${fonts.join('')}</fonts>
<fills count="${fills.length}">${fills.join('')}</fills>
<borders count="${borders.length}">${borders.join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${cellXfs.length}">${cellXfs.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${sheetRows}</sheetData></worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
    { name: 'xl/workbook.xml', data: Buffer.from(workbookXml, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels, 'utf8') },
    { name: 'xl/styles.xml', data: Buffer.from(stylesXml, 'utf8') },
    { name: 'xl/worksheets/sheet1.xml', data: Buffer.from(sheetXml, 'utf8') },
  ]);
}

/** The MIME type a real `.xlsx` must be served as. */
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

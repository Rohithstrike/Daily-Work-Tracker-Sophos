/**
 * Excel workbook generation.
 *
 * ExcelJS is large, so it is imported dynamically: the Today page never
 * downloads it. Only visiting Reports and pressing Export pulls the chunk.
 *
 * Styling aims for a shareable, management-quality appearance: a merged title
 * band, coloured section headers, zebra-striped data rows, grouped priority
 * columns, emphasised totals and sensible number/column formatting.
 */

import { ACTIVITY_RULES, PRIORITIES, PRIORITISED_TYPES, ACTIVITY_TYPES } from '@/lib/activityRules';
import { toAppError } from '@/lib/errors';
import { priorityColumnKey, type ReportData } from '@/services/reportService';
import { formatDuration } from '@/utils/duration';
import { monthName } from '@/utils/date';
import { monthlyReportFilename, rangeReportFilename, dailyReportFilename } from '@/utils/filename';

type Workbook = import('exceljs').Workbook;
type Worksheet = import('exceljs').Worksheet;
type Row = import('exceljs').Row;

/* --------------------------------------------------------------- palette */

const INK = 'FF1E293B'; // slate-800  - title band, table headers
const INK_SOFT = 'FF334155'; // slate-700  - section headings
const BRAND = 'FF4F46E5'; // indigo-600 - accents
const BRAND_TINT = 'FFEEF2FF'; // indigo-50  - totals rows
const ZEBRA = 'FFF8FAFC'; // slate-50   - alternating rows
const PRIORITY_TINT = 'FFF1F5F9'; // slate-100  - priority column group
const NOTES_TINT = 'FFFFFBEB'; // amber-50   - notes column
const BORDER = 'FFCBD5E1'; // slate-300
const WHITE = 'FFFFFFFF';
const MUTED_TEXT = 'FF64748B'; // slate-500

export async function generateWorkbook(report: ReportData): Promise<Blob> {
  try {
    const ExcelJS = await import('exceljs');
    const workbook: Workbook = new ExcelJS.Workbook();
    workbook.creator = 'Workday Activity Tracker';
    workbook.created = new Date(report.meta.generatedAt);

    buildMonthlySummarySheet(workbook, report);
    buildDailySummarySheet(workbook, report);
    buildActivityLogSheet(workbook, report);
    buildBreakLogSheet(workbook, report);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  } catch (error) {
    throw toAppError(error, 'generateReport');
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function monthFilename(prefix: string, year: number, month: number): string {
  return monthlyReportFilename(prefix, monthName(month), year);
}

export function rangeFilename(prefix: string, start: string, endInclusive: string): string {
  return rangeReportFilename(prefix, start, endInclusive);
}

export function dayFilename(prefix: string, workDate: string): string {
  return dailyReportFilename(prefix, workDate);
}

/* ------------------------------------------------ sheet 1: summary ----- */

function buildMonthlySummarySheet(workbook: Workbook, report: ReportData): void {
  const sheet = workbook.addWorksheet('Monthly Summary', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
  });
  sheet.columns = [
    { key: 'label', width: 36 },
    { key: 'value', width: 28 },
  ];

  const { summary, meta } = report;

  titleBand(sheet, meta.title, meta.subtitle, 2);

  sectionHeading(sheet, 'Period');
  keyValue(sheet, 'Month', meta.title);
  keyValue(sheet, 'Range', `${meta.range.start} to ${meta.endInclusive}`);
  keyValue(sheet, 'Timezone', meta.timezone);
  keyValue(
    sheet,
    'Generated',
    new Date(meta.generatedAt).toISOString().replace('T', ' ').slice(0, 16),
  );

  sectionHeading(sheet, 'Days');
  keyValue(sheet, 'Working days', summary.workingDays, 'number');
  keyValue(sheet, 'Completed days', summary.completedDays, 'number');
  keyValue(sheet, 'Incomplete days', summary.incompleteDays, 'number');

  sectionHeading(sheet, 'Time');
  keyValue(sheet, 'Total work time', formatDuration(summary.totalWorkSeconds));
  keyValue(sheet, 'Total lunch time', formatDuration(summary.totalBreakSeconds));

  sectionHeading(sheet, 'Category totals');
  for (const type of ACTIVITY_TYPES) {
    keyValue(sheet, ACTIVITY_RULES[type].label, summary.categoryTotals[type], 'number');
  }
  emphasise(keyValue(sheet, 'Total items', summary.totalQuantity, 'number'), BRAND_TINT);

  sectionHeading(sheet, 'Priority totals (Case, AR, Dupe, Peer Review)');
  for (const priority of PRIORITIES) {
    keyValue(sheet, priority, summary.priorityTotals[priority], 'number');
  }

  sheet.eachRow((row) => {
    row.alignment = { ...row.alignment, vertical: 'middle' };
  });
}

/* ------------------------------------------- sheet 2: daily summary ---- */

function buildDailySummarySheet(workbook: Workbook, report: ReportData): void {
  const sheet = workbook.addWorksheet('Daily Summary', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1, showGridLines: false }],
  });

  const columns = [
    { header: 'Date', key: 'dateLabel', width: 14 },
    { header: 'Day', key: 'day', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
    ...ACTIVITY_TYPES.map((type) => ({
      header: ACTIVITY_RULES[type].label,
      key: `cat_${type}`,
      width: Math.max(10, ACTIVITY_RULES[type].label.length + 2),
    })),
    ...PRIORITISED_TYPES.flatMap((type) =>
      PRIORITIES.map((priority) => ({
        header: priorityColumnKey(type, priority),
        key: `pri_${type}_${priority}`,
        width: Math.max(10, priorityColumnKey(type, priority).length + 1),
      })),
    ),
    { header: 'Work duration', key: 'workDuration', width: 15 },
    { header: 'Lunch duration', key: 'lunchDuration', width: 15 },
    { header: 'Notes', key: 'notes', width: 52 },
  ];
  sheet.columns = columns;
  styleHeaderRow(sheet.getRow(1));

  const firstPriorityColumn = 4 + ACTIVITY_TYPES.length;
  const lastPriorityColumn = firstPriorityColumn + PRIORITISED_TYPES.length * PRIORITIES.length - 1;
  const notesColumn = columns.length;

  for (const [index, row] of report.dailyRows.entries()) {
    const values: Record<string, string | number> = {
      dateLabel: row.dateLabel,
      day: row.day,
      status: row.status,
      workDuration: row.workDuration,
      lunchDuration: row.lunchDuration,
      notes: row.notes,
    };
    for (const type of ACTIVITY_TYPES) values[`cat_${type}`] = row.categories[type];
    for (const type of PRIORITISED_TYPES) {
      for (const priority of PRIORITIES) {
        values[`pri_${type}_${priority}`] =
          row.priorityByType[priorityColumnKey(type, priority)] ?? 0;
      }
    }

    const added = sheet.addRow(values);
    styleDataRow(added, index);
    centreNumbers(added, 4, lastPriorityColumn);
    tintRange(added, firstPriorityColumn, lastPriorityColumn, PRIORITY_TINT, index);
    tintRange(added, notesColumn, notesColumn, NOTES_TINT, index);
    added.getCell(notesColumn).alignment = { wrapText: true, vertical: 'top' };
    colourStatusCell(added.getCell(3), row.status);
  }

  if (report.dailyRows.length === 0) {
    emptyNotice(sheet, 'No data available for this period.', columns.length);
  } else {
    const totals: Record<string, string | number> = {
      dateLabel: 'Totals',
      day: '',
      status: `${report.summary.workingDays} days`,
      workDuration: formatDuration(report.summary.totalWorkSeconds),
      lunchDuration: formatDuration(report.summary.totalBreakSeconds),
      notes: '',
    };
    for (const type of ACTIVITY_TYPES) totals[`cat_${type}`] = report.summary.categoryTotals[type];
    for (const type of PRIORITISED_TYPES) {
      for (const priority of PRIORITIES) {
        totals[`pri_${type}_${priority}`] = report.summary.categoryPriorityTotals[type][priority];
      }
    }
    const totalsRow = sheet.addRow(totals);
    emphasise(totalsRow, BRAND_TINT);
    centreNumbers(totalsRow, 4, lastPriorityColumn);
  }

  addAutoFilter(sheet, columns.length);
}

/* ---------------------------------------- sheet 3: detailed activity --- */

function buildActivityLogSheet(workbook: Workbook, report: ReportData): void {
  const sheet = workbook.addWorksheet('Detailed Activity Log', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  });
  const columns = [
    { header: 'Date', key: 'dateLabel', width: 14 },
    { header: 'Start time', key: 'start', width: 12 },
    { header: 'End time', key: 'end', width: 12 },
    { header: 'Duration', key: 'duration', width: 12 },
    { header: 'Activity type', key: 'type', width: 22 },
    { header: 'Priority', key: 'priority', width: 10 },
    { header: 'Quantity', key: 'quantity', width: 10 },
    { header: 'Notes', key: 'notes', width: 56 },
  ];
  sheet.columns = columns;
  styleHeaderRow(sheet.getRow(1));

  if (report.activityRows.length === 0) {
    emptyNotice(sheet, 'No activities recorded for this period.', columns.length);
  } else {
    for (const [index, row] of report.activityRows.entries()) {
      const added = sheet.addRow({
        dateLabel: row.dateLabel,
        start: row.start,
        end: row.end,
        duration: row.duration,
        type: row.type,
        priority: row.priority,
        quantity: row.quantity,
        notes: row.notes,
      });
      styleDataRow(added, index);
      centreNumbers(added, 2, 4);
      added.getCell(6).alignment = { horizontal: 'center' };
      added.getCell(7).alignment = { horizontal: 'center' };
      colourPriorityCell(added.getCell(6), row.priority);
      // Notes (case numbers, "CX replied", etc.) are tinted and wrapped so they
      // stay readable without widening the whole sheet.
      added.getCell(8).alignment = { wrapText: true, vertical: 'top' };
      if (row.notes) tintRange(added, 8, 8, NOTES_TINT, index);
    }

    const totalsRow = sheet.addRow({
      dateLabel: 'Totals',
      type: `${report.activityRows.length} entries`,
      quantity: report.summary.totalQuantity,
    });
    emphasise(totalsRow, BRAND_TINT);
    totalsRow.getCell(7).alignment = { horizontal: 'center' };
  }

  addAutoFilter(sheet, columns.length);
}

/* ------------------------------------------------ sheet 4: breaks ------ */

function buildBreakLogSheet(workbook: Workbook, report: ReportData): void {
  const sheet = workbook.addWorksheet('Break Log', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  });
  const columns = [
    { header: 'Date', key: 'dateLabel', width: 14 },
    { header: 'Break type', key: 'type', width: 14 },
    { header: 'Start time', key: 'start', width: 12 },
    { header: 'End time', key: 'end', width: 12 },
    { header: 'Duration', key: 'duration', width: 12 },
  ];
  sheet.columns = columns;
  styleHeaderRow(sheet.getRow(1));

  if (report.breakRows.length === 0) {
    emptyNotice(sheet, 'No breaks recorded for this period.', columns.length);
  } else {
    for (const [index, row] of report.breakRows.entries()) {
      const added = sheet.addRow({
        dateLabel: row.dateLabel,
        type: row.type,
        start: row.start,
        end: row.end,
        duration: row.duration,
      });
      styleDataRow(added, index);
      centreNumbers(added, 3, 5);
    }
    const totalsRow = sheet.addRow({
      dateLabel: 'Totals',
      type: `${report.breakRows.length} breaks`,
      duration: formatDuration(report.summary.totalBreakSeconds),
    });
    emphasise(totalsRow, BRAND_TINT);
  }

  addAutoFilter(sheet, columns.length);
}

/* --------------------------------------------------------------- styling */

function titleBand(sheet: Worksheet, title: string, subtitle: string, span: number): void {
  const titleRow = sheet.addRow([title]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, span);
  titleRow.height = 30;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { bold: true, size: 15, color: { argb: WHITE } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const subtitleRow = sheet.addRow([subtitle]);
  sheet.mergeCells(subtitleRow.number, 1, subtitleRow.number, span);
  subtitleRow.height = 20;
  const subtitleCell = subtitleRow.getCell(1);
  subtitleCell.font = { italic: true, size: 11, color: { argb: WHITE } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  sheet.addRow([]);
}

function sectionHeading(sheet: Worksheet, label: string): void {
  const row = sheet.addRow([label, '']);
  row.height = 22;
  for (let column = 1; column <= 2; column += 1) {
    const cell = row.getCell(column);
    cell.font = { bold: true, size: 11, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK_SOFT } };
    cell.alignment = { vertical: 'middle', indent: column === 1 ? 1 : 0 };
    cell.border = thinBorder();
  }
}

function keyValue(
  sheet: Worksheet,
  label: string,
  value: string | number,
  kind: 'text' | 'number' = 'text',
): Row {
  const row = sheet.addRow([label, value]);
  const labelCell = row.getCell(1);
  const valueCell = row.getCell(2);

  labelCell.font = { color: { argb: INK_SOFT } };
  labelCell.alignment = { vertical: 'middle', indent: 1 };
  valueCell.font = { bold: true, color: { argb: INK } };
  valueCell.alignment = { vertical: 'middle', horizontal: kind === 'number' ? 'center' : 'left' };
  if (kind === 'number') valueCell.numFmt = '0';

  row.eachCell((cell) => {
    cell.border = thinBorder();
  });
  return row;
}

function styleHeaderRow(row: Row): void {
  row.font = { bold: true, size: 11, color: { argb: WHITE } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 30;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
    cell.border = thinBorder();
  });
}

/** Zebra striping plus borders on every cell of a data row. */
function styleDataRow(row: Row, index: number): void {
  row.height = 20;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = thinBorder();
    cell.alignment = { vertical: 'middle', ...cell.alignment };
    if (index % 2 === 1) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    }
  });
}

function centreNumbers(row: Row, from: number, to: number): void {
  for (let column = from; column <= to; column += 1) {
    const cell = row.getCell(column);
    cell.alignment = { ...cell.alignment, horizontal: 'center', vertical: 'middle' };
    if (typeof cell.value === 'number') cell.numFmt = '0';
  }
}

/** Tints a column group so related columns read as one block. */
function tintRange(row: Row, from: number, to: number, colour: string, index: number): void {
  if (index % 2 === 1) return; // keep the zebra stripe on alternating rows
  for (let column = from; column <= to; column += 1) {
    row.getCell(column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colour } };
  }
}

function colourStatusCell(cell: ReturnType<Row['getCell']>, status: string): void {
  cell.alignment = { ...cell.alignment, horizontal: 'center', vertical: 'middle' };
  cell.font = {
    bold: true,
    color: { argb: status === 'Completed' ? 'FF047857' : 'FFB45309' }, // emerald-700 / amber-700
  };
}

function colourPriorityCell(cell: ReturnType<Row['getCell']>, priority: string): void {
  const colours: Record<string, string> = {
    P1: 'FFB91C1C', // red-700
    P2: 'FFB45309', // amber-700
    P3: 'FF0369A1', // sky-700
    P4: 'FF475569', // slate-600
  };
  const colour = colours[priority];
  if (colour) cell.font = { bold: true, color: { argb: colour } };
  else cell.font = { color: { argb: MUTED_TEXT } };
}

function emphasise(row: Row, fill: string = BRAND_TINT): void {
  row.height = 22;
  row.font = { bold: true, color: { argb: INK } };
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.border = { ...thinBorder(), top: { style: 'medium', color: { argb: BRAND } } };
    cell.alignment = { vertical: 'middle', ...cell.alignment };
  });
}

function emptyNotice(sheet: Worksheet, message: string, span: number): void {
  const row = sheet.addRow([message]);
  sheet.mergeCells(row.number, 1, row.number, span);
  row.height = 24;
  const cell = row.getCell(1);
  cell.font = { italic: true, color: { argb: MUTED_TEXT } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  cell.border = thinBorder();
}

function addAutoFilter(sheet: Worksheet, columnCount: number): void {
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, columnCount) },
  };
}

function thinBorder() {
  const style = { style: 'thin' as const, color: { argb: BORDER } };
  return { top: style, left: style, bottom: style, right: style };
}

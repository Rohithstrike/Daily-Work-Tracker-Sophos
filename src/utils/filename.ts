/** Filesystem-safe export filenames. */

const INVALID_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]/g;

export function sanitiseFilename(input: string): string {
  const cleaned = input
    .replace(INVALID_CHARACTERS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'report';
}

export function monthlyReportFilename(prefix: string, monthLabel: string, year: number): string {
  return `${sanitiseFilename(`${prefix} ${monthLabel} ${year}`)}.xlsx`;
}

export function rangeReportFilename(prefix: string, start: string, endInclusive: string): string {
  return `${sanitiseFilename(`${prefix} ${start} - ${endInclusive}`)}.xlsx`;
}

export function dailyReportFilename(prefix: string, workDate: string): string {
  return `${sanitiseFilename(`${prefix} ${workDate}`)}.xlsx`;
}

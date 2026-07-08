export function formatRupiah(value: number): string {
  return Math.trunc(value || 0).toLocaleString('id-ID');
}

export function safeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function formatPdfDate(value: string | Date | null | undefined): string {
  if (!value) return '-';

  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

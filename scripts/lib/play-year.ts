export function isValidPlayYear(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}(-\d{4})?$/.test(value)) return false;
  const m = value.match(/^(\d{4})-(\d{4})$/);
  if (!m) return true;
  return Number(m[1]) <= Number(m[2]);
}

export const PLAY_YEAR_HINT = '4 位年份或区间(如 2024 或 2021-2026)';

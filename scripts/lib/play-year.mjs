// 游玩年份格式校验:单年(如 "2024")或区间(如 "2021-2026",起点 ≤ 终点)。
// CLI(add-review)与 CSV 导回(csv-to-json)两个通道共用,格式规则只此一份。
// Steam Web API 不提供"在哪几年玩过",play_year 是纯手写字段。

export function isValidPlayYear(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}(-\d{4})?$/.test(value)) return false;
  const m = value.match(/^(\d{4})-(\d{4})$/);
  if (!m) return true;
  return Number(m[1]) <= Number(m[2]);
}

export const PLAY_YEAR_HINT = '4 位年份或区间(如 2024 或 2021-2026)';

// Turning "next month" into something the file can hold.
//
// The format keeps one `due:` field whose precision is its own shape: a day
// (2026-09-15), an ISO week (2026-W36), or a month (2026-09). So a vague
// intention stays vague in the file instead of being rounded to a day nobody
// picked, and it still sorts and still says when it is late.

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.toISOString().slice(0, 10);

/** ISO week string for a date: the year of its Thursday, and its week number. */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // to that week's Thursday
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - jan1) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

const shift = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

export const PRESETS = [
  { key: '', label: 'No date' },
  { key: 'today', label: 'Today', value: () => iso(new Date()) },
  { key: 'tomorrow', label: 'Tomorrow', value: () => iso(shift(1)) },
  { key: 'this-week', label: 'This week', value: () => isoWeek(new Date()) },
  { key: 'next-week', label: 'Next week', value: () => isoWeek(shift(7)) },
  { key: 'this-month', label: 'This month', value: () => new Date().toISOString().slice(0, 7) },
  {
    key: 'next-month',
    label: 'Next month',
    value: () => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    },
  },
  { key: 'exact', label: 'Pick a day…' },
];

/** How a stored value reads on screen. Precision is visible: "Sept" is not "12 Sept". */
export function dueLabel(due) {
  if (!due) return null;
  const week = due.match(/^(\d{4})-W(\d{2})$/);
  if (week) return `week ${Number(week[2])}`;
  const parts = due.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return months[Number(parts[1]) - 1];
  return `${Number(parts[2])} ${months[Number(parts[1]) - 1]}`;
}

export const isExactDay = (due) => Boolean(due && /^\d{4}-\d{2}-\d{2}$/.test(due));

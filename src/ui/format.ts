import type { IsoDate } from '../domain/dates';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parts(date: IsoDate) {
  const d = new Date(`${date}T12:00:00Z`);
  return { day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()]!, weekday: WEEKDAYS[d.getUTCDay()]!, year: d.getUTCFullYear() };
}

/** "Mon 12 Oct" */
export function formatDate(date: IsoDate): string {
  const p = parts(date);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "12 Oct" */
export function formatShortDate(date: IsoDate): string {
  const p = parts(date);
  return `${p.day} ${p.month}`;
}

export function formatDose(amount: number, unit: string): string {
  return `${Number.isInteger(amount) ? amount : amount.toFixed(1)} ${unit}`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

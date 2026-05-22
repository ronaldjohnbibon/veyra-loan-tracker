import type { Timestamp } from 'firebase/firestore';

const currency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

export function fromCents(cents: number) {
  return cents / 100;
}

export function formatCurrency(amount: number) {
  return currency.format(amount);
}

export function formatMoney(cents: number) {
  return formatCurrency(fromCents(cents));
}

export function formatDate(value: string | Date | Timestamp | null | undefined) {
  if (!value) return '-';
  const date =
    typeof value === 'string'
      ? new Date(`${value}T00:00:00`)
      : value instanceof Date
        ? value
        : value.toDate();

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function todayInputValue() {
  const today = new Date();
  const timezoneOffsetMs = today.getTimezoneOffset() * 60 * 1000;
  return new Date(today.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

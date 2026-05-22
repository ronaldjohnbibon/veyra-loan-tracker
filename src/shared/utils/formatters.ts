import type { Timestamp } from 'firebase/firestore';

const currency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

export function fromCents(cents: number) {
  return cents / 100;
}

export function formatMoney(cents: number) {
  return currency.format(fromCents(cents));
}

export function formatDate(value: string | Timestamp | null | undefined) {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : value.toDate();
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

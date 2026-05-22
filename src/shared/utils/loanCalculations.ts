export function toCents(value: number | string) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

export function flatInterestCents(principalCents: number, ratePercent: number) {
  return Math.round(principalCents * (ratePercent / 100));
}

export function totalDueCents(principalCents: number, interestRatePercent: number) {
  return principalCents + flatInterestCents(principalCents, interestRatePercent);
}

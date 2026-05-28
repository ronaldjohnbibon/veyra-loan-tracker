import type { LoanStatus } from '@/modules/loans/types';

export interface FinancialSettings {
  totalInvestmentCents: number;
  usedInvestmentCents: number;
  availableInvestmentCents: number;
  ownerInterestSharePercent: number;
  assistantInterestSharePercent: number;
}

export interface FinancialSettingsInput {
  totalInvestment: string;
  ownerInterestSharePercent: string;
  assistantInterestSharePercent: string;
}

export interface LoanFinancialLike {
  principalAmount?: number;
  principalCents?: number;
  interestAmount?: number;
  interestCents?: number;
  totalPaid?: number;
  paidCents?: number;
  status?: LoanStatus;
  isDeleted?: boolean;
}

export const defaultFinancialSettings: FinancialSettings = {
  totalInvestmentCents: 0,
  usedInvestmentCents: 0,
  availableInvestmentCents: 0,
  ownerInterestSharePercent: 100,
  assistantInterestSharePercent: 0,
};

function cents(value: number | null | undefined) {
  return Math.max(0, Math.round(value ?? 0));
}

export function normalizeFinancialSettings(settings?: Partial<FinancialSettings> | null): FinancialSettings {
  const totalInvestmentCents = cents(settings?.totalInvestmentCents);
  const usedInvestmentCents = cents(settings?.usedInvestmentCents);
  return {
    totalInvestmentCents,
    usedInvestmentCents,
    availableInvestmentCents: totalInvestmentCents - usedInvestmentCents,
    ownerInterestSharePercent: Number(settings?.ownerInterestSharePercent ?? defaultFinancialSettings.ownerInterestSharePercent),
    assistantInterestSharePercent: Number(settings?.assistantInterestSharePercent ?? defaultFinancialSettings.assistantInterestSharePercent),
  };
}

export function validateSharePercentages(ownerPercent: number, assistantPercent: number) {
  if (!Number.isFinite(ownerPercent) || !Number.isFinite(assistantPercent)) {
    throw new Error('Interest share percentages must be valid numbers.');
  }

  if (ownerPercent < 0 || assistantPercent < 0) {
    throw new Error('Interest share percentages cannot be negative.');
  }

  if (Math.round((ownerPercent + assistantPercent) * 100) !== 10000) {
    throw new Error('Owner and assistant shares must total 100%.');
  }
}

export function calculateAvailableInvestmentCents(totalInvestmentCents: number, usedInvestmentCents: number) {
  return Math.round(totalInvestmentCents) - Math.round(usedInvestmentCents);
}

export function loanInvestmentUsageCents(loan: LoanFinancialLike) {
  // Only loans that are still out with borrowers use investment capital.
  if (loan.isDeleted === true || loan.status === 'cancelled' || loan.status === 'paid') return 0;
  const principalCents = cents(loan.principalCents ?? loan.principalAmount);
  const interestCents = cents(loan.interestCents ?? loan.interestAmount);
  const paidCents = cents(loan.paidCents ?? loan.totalPaid);
  if (paidCents >= principalCents + interestCents) return 0;
  return principalCents;
}

export function calculateInterestCollectedCents(loan: LoanFinancialLike) {
  const principalCents = cents(loan.principalCents ?? loan.principalAmount);
  const interestCents = cents(loan.interestCents ?? loan.interestAmount);
  const paidCents = cents(loan.paidCents ?? loan.totalPaid);

  // Principal is returned before interest is counted as collected earnings.
  return Math.min(interestCents, Math.max(0, paidCents - principalCents));
}

export function calculateInterestCollectedDeltaCents(loan: LoanFinancialLike, paymentDeltaCents: number) {
  const paidBefore = cents(loan.paidCents ?? loan.totalPaid);
  const paidAfter = Math.max(0, paidBefore + Math.round(paymentDeltaCents || 0));
  return calculateInterestCollectedCents({ ...loan, paidCents: paidAfter }) - calculateInterestCollectedCents({ ...loan, paidCents: paidBefore });
}

export function calculateInterestShareBreakdown(interestCollectedCents: number, settings: FinancialSettings) {
  validateSharePercentages(settings.ownerInterestSharePercent, settings.assistantInterestSharePercent);
  const collectedCents = cents(interestCollectedCents);
  const assistantInterestShareCents = Math.round(collectedCents * (settings.assistantInterestSharePercent / 100));
  const ownerInterestShareCents = collectedCents - assistantInterestShareCents;

  return {
    interestCollectedCents: collectedCents,
    ownerInterestShareCents,
    assistantInterestShareCents,
    ownerInterestSharePercent: settings.ownerInterestSharePercent,
    assistantInterestSharePercent: settings.assistantInterestSharePercent,
  };
}

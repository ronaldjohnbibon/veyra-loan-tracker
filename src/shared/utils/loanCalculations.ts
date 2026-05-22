export function toCents(value: number | string) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

export function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  const [year, month, day] = value.split('-').map(Number);
  return (
    Number.isFinite(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function flatInterestCents(principalCents: number, ratePercent: number) {
  return Math.round(principalCents * (ratePercent / 100));
}

export function totalDueCents(principalCents: number, interestRatePercent: number) {
  return principalCents + flatInterestCents(principalCents, interestRatePercent);
}

export type CalculatedLoanStatus = 'active' | 'paid' | 'overdue' | 'cancelled';

export interface LoanCalculationInput {
  principalCents: number;
  interestRatePercent: number;
  paidCents?: number;
  dueDate: string;
  currentStatus?: CalculatedLoanStatus;
}

export interface LoanLike {
  principalAmount?: number;
  principalCents?: number;
  interestRate?: number;
  interestRatePercent?: number;
  totalPayable?: number;
  totalDueCents?: number;
  totalPaid?: number;
  paidCents?: number;
  remainingBalance?: number;
  remainingCents?: number;
  dueDate?: string;
  status?: CalculatedLoanStatus;
}

export function isPastDueDate(dueDate: string, today = new Date()) {
  if (!dueDate) return false;
  const todayValue = new Date(today);
  todayValue.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  return due < todayValue;
}

export function calculateLoanStatus(
  dueDate: string,
  remainingCents: number,
  currentStatus?: CalculatedLoanStatus,
): CalculatedLoanStatus {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (remainingCents <= 0) return 'paid';
  if (isPastDueDate(dueDate)) return 'overdue';
  return 'active';
}

export function calculateRemainingBalance(totalPayable: number, totalPaid: number) {
  return Math.max(0, Math.round(totalPayable || 0) - Math.max(0, Math.round(totalPaid || 0)));
}

export function getLoanStatus(loan: LoanLike): CalculatedLoanStatus {
  const totalPayable = loan.totalDueCents ?? loan.totalPayable ?? 0;
  const totalPaid = loan.paidCents ?? loan.totalPaid ?? 0;
  const remainingBalance = loan.remainingCents ?? loan.remainingBalance ?? calculateRemainingBalance(totalPayable, totalPaid);

  return calculateLoanStatus(loan.dueDate ?? '', remainingBalance, loan.status);
}

export function canAcceptPayment(loan: LoanLike, amountPaid: number) {
  const amount = Math.round(amountPaid || 0);
  const remainingBalance =
    loan.remainingCents ??
    loan.remainingBalance ??
    calculateRemainingBalance(loan.totalDueCents ?? loan.totalPayable ?? 0, loan.paidCents ?? loan.totalPaid ?? 0);

  return getLoanStatus(loan) !== 'cancelled' && amount > 0 && amount <= remainingBalance;
}

export function calculateLoanValues(input: LoanCalculationInput): {
  principalCents: number;
  principalAmount: number;
  interestRatePercent: number;
  interestRate: number;
  interestCents: number;
  interestAmount: number;
  totalDueCents: number;
  totalPayable: number;
  paidCents: number;
  totalPaid: number;
  remainingCents: number;
  remainingBalance: number;
  status: CalculatedLoanStatus;
};
export function calculateLoanValues(
  principalAmount: number,
  interestRate: number,
  totalPaid?: number,
): {
  interestAmount: number;
  totalPayable: number;
  remainingBalance: number;
};
export function calculateLoanValues(
  inputOrPrincipalAmount: LoanCalculationInput | number,
  interestRate = 0,
  totalPaid = 0,
) {
  const isSimpleCall = typeof inputOrPrincipalAmount === 'number';
  const input =
    isSimpleCall
      ? {
          principalCents: inputOrPrincipalAmount,
          interestRatePercent: interestRate,
          paidCents: totalPaid,
          dueDate: '',
        }
      : inputOrPrincipalAmount;

  const principalCents = Math.max(0, Math.round(input.principalCents || 0));
  const interestRatePercent = Math.max(0, Number(input.interestRatePercent || 0));
  const interestCents = flatInterestCents(principalCents, interestRatePercent);
  const total = principalCents + interestCents;
  const paidCents = Math.max(0, Math.round(input.paidCents || 0));
  const remainingCents = calculateRemainingBalance(total, paidCents);
  const status = getLoanStatus({
    totalDueCents: total,
    paidCents,
    remainingCents,
    dueDate: input.dueDate,
    status: input.currentStatus,
  });

  if (isSimpleCall) {
    return {
      interestAmount: interestCents,
      totalPayable: total,
      remainingBalance: remainingCents,
    };
  }

  return {
    principalCents,
    principalAmount: principalCents,
    interestRatePercent,
    interestRate: interestRatePercent,
    interestCents,
    interestAmount: interestCents,
    totalDueCents: total,
    totalPayable: total,
    paidCents,
    totalPaid: paidCents,
    remainingCents,
    remainingBalance: remainingCents,
    status,
  };
}

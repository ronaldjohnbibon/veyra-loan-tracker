import { calculateLoanValues } from '@/shared/utils/loanCalculations';
import type { WithId } from '@/shared/types/audit';
import type { Loan, LoanStatus } from '@/modules/loans/types';

export type DashboardLoan = WithId<Loan> & {
  dashboardStatus: LoanStatus;
  dashboardPrincipalCents: number;
  dashboardTotalPayableCents: number;
  dashboardPaidCents: number;
  dashboardRemainingCents: number;
};

export type DashboardSummary = {
  totalMoneyLentCents: number;
  totalExpectedCollectionCents: number;
  totalCollectedCents: number;
  totalRemainingBalanceCents: number;
  activeLoanCount: number;
  paidLoanCount: number;
  overdueLoanCount: number;
  borrowerCount: number;
};

const countedStatuses = new Set<LoanStatus>(['active', 'paid', 'overdue']);

function cents(value: number | null | undefined) {
  return Math.max(0, Math.round(value ?? 0));
}

export function toDashboardLoan(loan: WithId<Loan>): DashboardLoan {
  const values = calculateLoanValues({
    principalCents: cents(loan.principalAmount ?? loan.principalCents),
    interestRatePercent: Number(loan.interestRate ?? loan.interestRatePercent ?? 0),
    paidCents: cents(loan.totalPaid ?? loan.paidCents),
    dueDate: loan.dueDate,
    currentStatus: loan.status,
  });

  return {
    ...loan,
    dashboardStatus: values.status,
    dashboardPrincipalCents: values.principalAmount,
    dashboardTotalPayableCents: values.totalPayable,
    dashboardPaidCents: values.totalPaid,
    dashboardRemainingCents: values.remainingBalance,
  };
}

export function isCountedLoan(loan: DashboardLoan) {
  return countedStatuses.has(loan.dashboardStatus);
}

export function buildDashboardSummary(loans: DashboardLoan[], borrowerCount: number): DashboardSummary {
  const countedLoans = loans.filter(isCountedLoan);
  const openLoans = countedLoans.filter(
    (loan) => loan.dashboardStatus === 'active' || loan.dashboardStatus === 'overdue',
  );

  return {
    totalMoneyLentCents: countedLoans.reduce((sum, loan) => sum + loan.dashboardPrincipalCents, 0),
    totalExpectedCollectionCents: countedLoans.reduce((sum, loan) => sum + loan.dashboardTotalPayableCents, 0),
    totalCollectedCents: countedLoans.reduce((sum, loan) => sum + loan.dashboardPaidCents, 0),
    totalRemainingBalanceCents: openLoans.reduce((sum, loan) => sum + loan.dashboardRemainingCents, 0),
    activeLoanCount: countedLoans.filter((loan) => loan.dashboardStatus === 'active').length,
    paidLoanCount: countedLoans.filter((loan) => loan.dashboardStatus === 'paid').length,
    overdueLoanCount: countedLoans.filter((loan) => loan.dashboardStatus === 'overdue').length,
    borrowerCount,
  };
}

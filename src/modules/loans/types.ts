import type { AuditInfo } from '@/shared/types/audit';

export type LoanStatus = 'active' | 'paid' | 'cancelled';

export type Loan = AuditInfo & {
  borrowerId: string;
  borrowerName: string;
  principalCents: number;
  interestRatePercent: number;
  interestCents: number;
  totalDueCents: number;
  paidCents: number;
  remainingCents: number;
  loanDate: string;
  dueDate: string;
  status: LoanStatus;
  notes: string;
};

export type LoanInput = {
  borrowerId: string;
  borrowerName: string;
  principal: string;
  interestRatePercent: string;
  loanDate: string;
  dueDate: string;
  notes: string;
};

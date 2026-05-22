import type { Timestamp } from 'firebase/firestore';

export type DateValue = Timestamp | string;
export type LoanStatus = 'active' | 'paid' | 'overdue' | 'cancelled';

export interface Loan {
  id?: string;
  borrowerId: string;
  principalAmount: number;
  interestRate: number;
  interestAmount: number;
  totalPayable: number;
  totalPaid: number;
  remainingBalance: number;
  loanDate: string;
  dueDate: string;
  status: LoanStatus;
  notes: string;
  createdBy?: string;
  createdAt?: DateValue;
  updatedBy?: string;
  updatedAt?: DateValue;
  isDeleted?: boolean;
  deletedBy?: string | null;
  deletedAt?: DateValue | null;
  deleteReason?: string | null;

  borrowerName: string;
  principalCents: number;
  interestRatePercent: number;
  interestCents: number;
  totalDueCents: number;
  paidCents: number;
  remainingCents: number;
}

export interface LoanInput {
  borrowerId: string;
  borrowerName: string;
  principal: string;
  interestRatePercent: string;
  loanDate: string;
  dueDate: string;
  status?: LoanStatus;
  notes: string;
}

export interface LoanUpdateInput extends LoanInput {
  totalPaid?: number;
  paidCents?: number;
  status?: LoanStatus;
}

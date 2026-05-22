import type { AuditInfo } from '@/shared/types/audit';

export type PaymentStatus = 'applied' | 'cancelled';

export type Payment = AuditInfo & {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  amountCents: number;
  paymentDate: string;
  notes: string;
  status: PaymentStatus;
};

export type PaymentInput = {
  amount: string;
  paymentDate: string;
  notes: string;
};

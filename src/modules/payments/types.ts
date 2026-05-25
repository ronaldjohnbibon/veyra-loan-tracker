import type { Timestamp } from 'firebase/firestore';

export type DateValue = Timestamp | string;
export type PaymentStatus = 'applied' | 'cancelled';

export interface Payment {
  id?: string;
  loanId: string;
  borrowerId: string;
  amountPaid: number;
  paymentDate: string;
  notes: string;
  createdBy?: string;
  createdAt?: DateValue;
  updatedBy?: string;
  updatedAt?: DateValue;
  isDeleted?: boolean;
  deletedBy?: string | null;
  deletedAt?: DateValue | null;
  deleteReason?: string | null;
  isCancelled?: boolean;
  cancelledBy?: string | null;
  cancelledAt?: DateValue | null;
  cancellationReason?: string | null;

  borrowerName: string;
  amountCents: number;
  status: PaymentStatus;
}

export interface PaymentInput {
  amount: string;
  paymentDate: string;
  notes: string;
}

export interface PaymentCancelInput {
  reason: string;
}

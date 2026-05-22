import type { Timestamp } from 'firebase/firestore';

export type DateValue = Timestamp | string;

export interface Borrower {
  id?: string;
  name: string;
  contactNumber: string;
  address: string;
  notes: string;
  createdBy?: string;
  createdAt?: DateValue;
  updatedBy?: string;
  updatedAt?: DateValue;
  isDeleted?: boolean;
  deletedBy?: string | null;
  deletedAt?: DateValue | null;
  deleteReason?: string | null;

  phone?: string;
  status?: 'active' | 'inactive';
}

export interface BorrowerInput {
  name: string;
  contactNumber: string;
  address: string;
  notes: string;
}

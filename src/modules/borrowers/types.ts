import type { AuditInfo } from '@/shared/types/audit';

export type Borrower = AuditInfo & {
  name: string;
  phone: string;
  address: string;
  notes: string;
  status: 'active' | 'inactive';
};

export type BorrowerInput = {
  name: string;
  phone: string;
  address: string;
  notes: string;
};

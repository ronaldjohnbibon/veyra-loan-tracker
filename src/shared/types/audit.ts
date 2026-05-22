import type { Timestamp } from 'firebase/firestore';

export type AuditInfo = {
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  deletedAt?: Timestamp | null;
  deletedBy?: string | null;
  cancelledAt?: Timestamp | null;
  cancelledBy?: string | null;
};

export type WithId<T> = T & { id: string };

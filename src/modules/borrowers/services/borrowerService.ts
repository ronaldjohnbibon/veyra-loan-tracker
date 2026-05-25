import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/app/firebase/firebase';
import { createAudit, deleteAudit, restoreAudit, updateAudit } from '@/shared/utils/audit';
import { commitBatchedUpdates, type BatchedUpdate } from '@/shared/utils/firestoreBatches';
import { getLoanStatus } from '@/shared/utils/loanCalculations';
import { finishFirestoreWrite, isDeviceOnline } from '@/shared/services/offlineSyncService';
import type { WithId } from '@/shared/types/audit';
import type { Loan } from '@/modules/loans/types';
import type { Borrower, BorrowerInput } from '../types';

const borrowersRef = collection(db, 'borrowers');
const loansRef = collection(db, 'loans');
const paymentsRef = collection(db, 'payments');

function borrowerFromDoc(snapshot: Awaited<ReturnType<typeof getDocs>>['docs'][number]) {
  const data = snapshot.data() as Borrower;
  return {
    id: snapshot.id,
    ...data,
    contactNumber: data.contactNumber || data.phone || '',
    address: data.address || '',
    notes: data.notes || '',
  };
}

function activeBorrowersQuery() {
  return query(borrowersRef, where('isDeleted', '==', false));
}

function deletedBorrowersQuery() {
  return query(borrowersRef, where('isDeleted', '==', true));
}

function borrowerLoansQuery(borrowerId: string) {
  return query(loansRef, where('borrowerId', '==', borrowerId));
}

function borrowerPaymentsQuery(borrowerId: string) {
  return query(paymentsRef, where('borrowerId', '==', borrowerId));
}

function sortBorrowersByName(borrowers: WithId<Borrower>[]) {
  return [...borrowers].sort((first, second) => first.name.localeCompare(second.name));
}

function borrowerPayload(input: BorrowerInput) {
  return {
    name: input.name.trim(),
    contactNumber: input.contactNumber.trim(),
    address: input.address.trim(),
    notes: input.notes.trim(),
  };
}

function softDeleteData(user: User, deleteReason: string) {
  return {
    isDeleted: true,
    deleteReason: deleteReason.trim() || null,
    ...deleteAudit(user),
  };
}

export function watchBorrowers(callback: (borrowers: WithId<Borrower>[]) => void) {
  const q = activeBorrowersQuery();
  return onSnapshot(
    q,
    (snapshot) => {
      callback(sortBorrowersByName(snapshot.docs.map(borrowerFromDoc)));
    },
    (error) => {
      console.error('Unable to load borrowers.', error);
      callback([]);
    },
  );
}

// Watches only soft-deleted borrowers for the trash page.
export function watchDeletedBorrowers(callback: (borrowers: WithId<Borrower>[]) => void) {
  const q = deletedBorrowersQuery();
  return onSnapshot(
    q,
    (snapshot) => {
      callback(sortBorrowersByName(snapshot.docs.map(borrowerFromDoc)));
    },
    (error) => {
      console.error('Unable to load deleted borrowers.', error);
      callback([]);
    },
  );
}

export async function listBorrowers() {
  const q = activeBorrowersQuery();
  const snapshot = isDeviceOnline() ? await getDocs(q) : await getDocsFromCache(q);
  return sortBorrowersByName(snapshot.docs.map(borrowerFromDoc));
}

export async function getBorrower(id: string) {
  const borrowerRef = doc(db, 'borrowers', id);
  const snapshot = isDeviceOnline() ? await getDoc(borrowerRef) : await getDocFromCache(borrowerRef);
  if (!snapshot.exists()) return null;
  const borrower = borrowerFromDoc(snapshot);
  return borrower.isDeleted ? null : borrower;
}

export async function createBorrower(input: BorrowerInput, user: User) {
  const borrowerRef = doc(borrowersRef);
  await finishFirestoreWrite('Create borrower', setDoc(borrowerRef, {
    ...borrowerPayload(input),
    status: 'active',
    isDeleted: false,
    deleteReason: null,
    ...createAudit(user),
  }));
  return borrowerRef.id;
}

export async function updateBorrower(id: string, input: BorrowerInput, user: User) {
  await finishFirestoreWrite('Update borrower', updateDoc(doc(db, 'borrowers', id), {
    ...borrowerPayload(input),
    ...updateAudit(user),
  }));
}

export async function softDeleteBorrower(id: string, user: User, deleteReason = '') {
  const loansQuery = borrowerLoansQuery(id);
  const paymentsQuery = borrowerPaymentsQuery(id);
  const [loansSnapshot, paymentsSnapshot] = await Promise.all([
    isDeviceOnline() ? getDocs(loansQuery) : getDocsFromCache(loansQuery),
    isDeviceOnline() ? getDocs(paymentsQuery) : getDocsFromCache(paymentsQuery),
  ]);
  const deleted = softDeleteData(user, deleteReason);
  const updates: BatchedUpdate[] = [
    {
      ref: doc(db, 'borrowers', id),
      data: {
        status: 'inactive',
        ...deleted,
      },
    },
    ...loansSnapshot.docs.map((loan) => ({
      ref: loan.ref,
      data: {
        status: 'cancelled',
        ...deleted,
      },
    })),
    ...paymentsSnapshot.docs.map((payment) => ({
      ref: payment.ref,
      data: deleted,
    })),
  ];

  await commitBatchedUpdates(updates);
}

export async function restoreBorrower(id: string, user: User) {
  const borrowerRef = doc(db, 'borrowers', id);
  const borrowerSnapshot = isDeviceOnline() ? await getDoc(borrowerRef) : await getDocFromCache(borrowerRef);
  if (!borrowerSnapshot.exists()) throw new Error('Borrower was not found.');

  const loansQuery = borrowerLoansQuery(id);
  const paymentsQuery = borrowerPaymentsQuery(id);
  const [loansSnapshot, paymentsSnapshot] = await Promise.all([
    isDeviceOnline() ? getDocs(loansQuery) : getDocsFromCache(loansQuery),
    isDeviceOnline() ? getDocs(paymentsQuery) : getDocsFromCache(paymentsQuery),
  ]);
  const restored = {
    isDeleted: false,
    ...restoreAudit(user),
  };
  const updates: BatchedUpdate[] = [
    {
      ref: borrowerSnapshot.ref,
      data: {
        status: 'active',
        ...restored,
      },
    },
    ...loansSnapshot.docs.map((loanSnapshot) => {
      const loan = loanSnapshot.data() as Loan;
      return {
        ref: loanSnapshot.ref,
        data: {
          status: getLoanStatus({ ...loan, status: undefined }),
          ...restored,
        },
      };
    }),
    ...paymentsSnapshot.docs.map((payment) => ({
      ref: payment.ref,
      data: restored,
    })),
  ];

  await commitBatchedUpdates(updates);
}

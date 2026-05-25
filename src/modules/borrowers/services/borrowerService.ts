import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/app/firebase/firebase';
import { createAudit, deleteAudit, restoreAudit, updateAudit } from '@/shared/utils/audit';
import { commitBatchedUpdates, type BatchedUpdate } from '@/shared/utils/firestoreBatches';
import { getLoanStatus } from '@/shared/utils/loanCalculations';
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
  const snapshot = await getDocs(activeBorrowersQuery());
  return sortBorrowersByName(snapshot.docs.map(borrowerFromDoc));
}

export async function getBorrower(id: string) {
  const snapshot = await getDoc(doc(db, 'borrowers', id));
  if (!snapshot.exists()) return null;
  const borrower = borrowerFromDoc(snapshot);
  return borrower.isDeleted ? null : borrower;
}

export async function createBorrower(input: BorrowerInput, user: User) {
  const borrower = await addDoc(borrowersRef, {
    ...borrowerPayload(input),
    status: 'active',
    isDeleted: false,
    deleteReason: null,
    ...createAudit(user),
  });
  return borrower.id;
}

export async function updateBorrower(id: string, input: BorrowerInput, user: User) {
  await updateDoc(doc(db, 'borrowers', id), {
    ...borrowerPayload(input),
    ...updateAudit(user),
  });
}

export async function softDeleteBorrower(id: string, user: User, deleteReason = '') {
  const [loansSnapshot, paymentsSnapshot] = await Promise.all([
    getDocs(borrowerLoansQuery(id)),
    getDocs(borrowerPaymentsQuery(id)),
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
  const borrowerSnapshot = await getDoc(doc(db, 'borrowers', id));
  if (!borrowerSnapshot.exists()) throw new Error('Borrower was not found.');

  const [loansSnapshot, paymentsSnapshot] = await Promise.all([
    getDocs(borrowerLoansQuery(id)),
    getDocs(borrowerPaymentsQuery(id)),
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

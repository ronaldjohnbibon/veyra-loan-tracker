import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/app/firebase/firebase';
import { createAudit, updateAudit } from '@/shared/utils/audit';
import type { WithId } from '@/shared/types/audit';
import type { Borrower, BorrowerInput } from '../types';

const borrowersRef = collection(db, 'borrowers');

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
  await updateDoc(doc(db, 'borrowers', id), {
    status: 'inactive',
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: user.uid,
    deleteReason: deleteReason.trim() || null,
    ...updateAudit(user),
  });
}

import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db } from '@/app/firebase/firebase';
import { createAudit, deleteAudit, updateAudit } from '@/shared/utils/audit';
import type { WithId } from '@/shared/types/audit';
import type { Borrower, BorrowerInput } from '../types';

const borrowersRef = collection(db, 'borrowers');

export function watchBorrowers(callback: (borrowers: WithId<Borrower>[]) => void) {
  const user = auth.currentUser;
  if (!user) {
    callback([]);
    return () => {};
  }

  const q = query(borrowersRef, where('createdBy', '==', user.uid), where('deletedAt', '==', null));
  return onSnapshot(
    q,
    (snapshot) => {
      const borrowers = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as Borrower) }))
        .sort((first, second) => first.name.localeCompare(second.name));
      callback(borrowers);
    },
    (error) => {
      console.error('Unable to load borrowers.', error);
      callback([]);
    },
  );
}

export async function getBorrower(id: string) {
  const snapshot = await getDoc(doc(db, 'borrowers', id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Borrower) };
}

export async function createBorrower(input: BorrowerInput, user: User) {
  await addDoc(borrowersRef, {
    ...input,
    status: 'active',
    ...createAudit(user),
  });
}

export async function updateBorrower(id: string, input: BorrowerInput, user: User) {
  await updateDoc(doc(db, 'borrowers', id), {
    ...input,
    ...updateAudit(user),
  });
}

export async function softDeleteBorrower(id: string, user: User) {
  await updateDoc(doc(db, 'borrowers', id), {
    status: 'inactive',
    ...deleteAudit(user),
  });
}

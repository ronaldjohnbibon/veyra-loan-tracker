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
import { cancelAudit, createAudit, updateAudit } from '@/shared/utils/audit';
import { flatInterestCents, toCents, totalDueCents } from '@/shared/utils/loanCalculations';
import type { WithId } from '@/shared/types/audit';
import type { Loan, LoanInput } from '../types';

const loansRef = collection(db, 'loans');

export function watchLoans(callback: (loans: WithId<Loan>[]) => void) {
  const user = auth.currentUser;
  if (!user) {
    callback([]);
    return () => {};
  }

  const q = query(loansRef, where('createdBy', '==', user.uid), where('status', 'in', ['active', 'paid']));
  return onSnapshot(
    q,
    (snapshot) => {
      const loans = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as Loan) }))
        .sort((first, second) => first.dueDate.localeCompare(second.dueDate));
      callback(loans);
    },
    (error) => {
      console.error('Unable to load loans.', error);
      callback([]);
    },
  );
}

export function watchBorrowerLoans(borrowerId: string, callback: (loans: WithId<Loan>[]) => void) {
  const user = auth.currentUser;
  if (!user) {
    callback([]);
    return () => {};
  }

  const q = query(loansRef, where('createdBy', '==', user.uid), where('borrowerId', '==', borrowerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const loans = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as Loan) }))
        .filter((loan) => loan.status === 'active' || loan.status === 'paid')
        .sort((first, second) => first.dueDate.localeCompare(second.dueDate));
      callback(loans);
    },
    (error) => {
      console.error('Unable to load borrower loans.', error);
      callback([]);
    },
  );
}

export async function getLoan(id: string) {
  const snapshot = await getDoc(doc(db, 'loans', id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as Loan) };
}

export async function createLoan(input: LoanInput, user: User) {
  const principalCents = toCents(input.principal);
  const interestRatePercent = Number(input.interestRatePercent || 0);
  const interestCents = flatInterestCents(principalCents, interestRatePercent);
  const total = totalDueCents(principalCents, interestRatePercent);

  await addDoc(loansRef, {
    borrowerId: input.borrowerId,
    borrowerName: input.borrowerName,
    principalCents,
    interestRatePercent,
    interestCents,
    totalDueCents: total,
    paidCents: 0,
    remainingCents: total,
    loanDate: input.loanDate,
    dueDate: input.dueDate,
    status: 'active',
    notes: input.notes.trim(),
    cancelledAt: null,
    cancelledBy: null,
    ...createAudit(user),
  });
}

export async function updateLoanNotes(id: string, notes: string, user: User) {
  await updateDoc(doc(db, 'loans', id), {
    notes: notes.trim(),
    ...updateAudit(user),
  });
}

export async function cancelLoan(id: string, user: User) {
  await updateDoc(doc(db, 'loans', id), {
    status: 'cancelled',
    ...cancelAudit(user),
  });
}

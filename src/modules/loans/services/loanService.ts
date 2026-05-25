import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/app/firebase/firebase';
import { createAudit, createLocalAudit, deleteAudit, deleteLocalAudit, restoreAudit, restoreLocalAudit, updateAudit, updateLocalAudit } from '@/shared/utils/audit';
import { commitBatchedUpdates, type BatchedUpdate } from '@/shared/utils/firestoreBatches';
import { calculateLoanValues, getLoanStatus, isValidDateInput, toCents } from '@/shared/utils/loanCalculations';
import { finishFirestoreRead, finishFirestoreWrite } from '@/shared/services/offlineSyncService';
import { clearSyncedLocalRecords, getLocalRecord, mergeLocalRecord, mergeLocalRecords, patchLocalRecord, writeLocalRecord } from '@/shared/services/localDataCache';
import type { WithId } from '@/shared/types/audit';
import type { Loan, LoanInput, LoanUpdateInput } from '../types';

const loansRef = collection(db, 'loans');
const paymentsRef = collection(db, 'payments');

function loanFromDoc(snapshot: Awaited<ReturnType<typeof getDocs>>['docs'][number]) {
  return { id: snapshot.id, ...(snapshot.data() as Loan) };
}

function activeLoansQuery() {
  return query(loansRef, orderBy('dueDate'));
}

function deletedLoansQuery() {
  return query(loansRef, where('isDeleted', '==', true));
}

function loanPaymentsCascadeQuery(loanId: string) {
  return query(paymentsRef, where('loanId', '==', loanId));
}

function visibleLoans(loans: WithId<Loan>[]) {
  return loans.filter((loan) => loan.isDeleted !== true);
}

function deletedLoans(loans: WithId<Loan>[]) {
  return loans.filter((loan) => loan.isDeleted === true);
}

function validateLoanInput(input: LoanInput) {
  const principalCents = toCents(input.principal);
  const interestRatePercent = Number(input.interestRatePercent || 0);

  if (principalCents <= 0) throw new Error('Principal must be greater than zero.');
  if (!Number.isFinite(interestRatePercent) || interestRatePercent < 0) throw new Error('Interest rate must be zero or greater.');
  if (!isValidDateInput(input.loanDate) || !isValidDateInput(input.dueDate)) throw new Error('Loan dates must be valid.');
  if (input.dueDate < input.loanDate) throw new Error('Due date cannot be before the loan date.');

  return { principalCents, interestRatePercent };
}

function softDeleteData(user: User, deleteReason: string) {
  return {
    isDeleted: true,
    deleteReason: deleteReason.trim() || null,
    ...deleteAudit(user),
  };
}

function localSoftDeleteData(user: User, deleteReason: string) {
  return {
    isDeleted: true,
    deleteReason: deleteReason.trim() || null,
    ...deleteLocalAudit(user),
  };
}

async function assertBorrowerCanReceiveLoan(borrowerId: string) {
  const localBorrower = getLocalRecord<{ isDeleted?: boolean }>('borrowers', borrowerId);
  const borrowerRef = doc(db, 'borrowers', borrowerId);
  let borrowerSnapshot: Awaited<ReturnType<typeof getDoc>>;
  try {
    borrowerSnapshot = await finishFirestoreRead(getDoc(borrowerRef), () => getDocFromCache(borrowerRef));
  } catch {
    if (localBorrower?.full && localBorrower.data.isDeleted !== true) return;
    throw new Error('Borrower was not found.');
  }

  if (!borrowerSnapshot.exists() && localBorrower?.full && localBorrower.data.isDeleted !== true) return;
  const borrower = borrowerSnapshot.data() as { isDeleted?: boolean } | undefined;
  if (!borrowerSnapshot.exists() || borrower?.isDeleted === true) {
    throw new Error('Borrower was not found.');
  }
}

export function calculateLoanBalanceAfterPayment(loan: Loan, paymentDeltaCents: number) {
  const currentPaidCents = loan.paidCents ?? loan.totalPaid ?? 0;
  const totalDueCents = loan.totalDueCents ?? loan.totalPayable ?? 0;
  const paidCents = Math.min(totalDueCents, Math.max(0, currentPaidCents + paymentDeltaCents));
  return calculateLoanValues({
    principalCents: loan.principalCents ?? loan.principalAmount ?? 0,
    interestRatePercent: loan.interestRatePercent ?? loan.interestRate ?? 0,
    paidCents,
    dueDate: loan.dueDate,
    currentStatus: loan.status,
  });
}

export function watchLoans(callback: (loans: WithId<Loan>[]) => void) {
  const q = activeLoansQuery();
  return onSnapshot(
    q,
    (snapshot) => {
      clearSyncedLocalRecords('loans', snapshot.docs.filter((item) => !item.metadata.hasPendingWrites).map((item) => item.id));
      callback(visibleLoans(mergeLocalRecords('loans', snapshot.docs.map(loanFromDoc))));
    },
    (error) => {
      console.error('Unable to load loans.', error);
      callback([]);
    },
  );
}

// Watches only soft-deleted loans for the trash page.
export function watchDeletedLoans(callback: (loans: WithId<Loan>[]) => void) {
  const q = deletedLoansQuery();
  return onSnapshot(
    q,
    (snapshot) => {
      clearSyncedLocalRecords('loans', snapshot.docs.filter((item) => !item.metadata.hasPendingWrites).map((item) => item.id));
      callback([...deletedLoans(mergeLocalRecords('loans', snapshot.docs.map(loanFromDoc)))]
        .sort((first, second) => first.dueDate.localeCompare(second.dueDate)));
    },
    (error) => {
      console.error('Unable to load deleted loans.', error);
      callback([]);
    },
  );
}

export function watchBorrowerLoans(borrowerId: string, callback: (loans: WithId<Loan>[]) => void) {
  const q = activeLoansQuery();
  return onSnapshot(
    q,
    (snapshot) => {
      clearSyncedLocalRecords('loans', snapshot.docs.filter((item) => !item.metadata.hasPendingWrites).map((item) => item.id));
      callback(visibleLoans(mergeLocalRecords('loans', snapshot.docs.map(loanFromDoc))).filter((loan) => loan.borrowerId === borrowerId));
    },
    (error) => {
      console.error('Unable to load borrower loans.', error);
      callback([]);
    },
  );
}

export async function listLoans() {
  const q = activeLoansQuery();
  const snapshot = await finishFirestoreRead(getDocs(q), () => getDocsFromCache(q));
  return visibleLoans(mergeLocalRecords('loans', snapshot.docs.map(loanFromDoc)));
}

export async function listBorrowerLoans(borrowerId: string) {
  const q = activeLoansQuery();
  const snapshot = await finishFirestoreRead(getDocs(q), () => getDocsFromCache(q));
  return visibleLoans(mergeLocalRecords('loans', snapshot.docs.map(loanFromDoc))).filter((loan) => loan.borrowerId === borrowerId);
}

export async function getLoan(id: string) {
  const local = getLocalRecord<Loan>('loans', id);
  const loanRef = doc(db, 'loans', id);
  let snapshot: Awaited<ReturnType<typeof getDoc>> | null = null;
  try {
    snapshot = await finishFirestoreRead(getDoc(loanRef), () => getDocFromCache(loanRef));
  } catch {
    if (local?.full) return local.data.isDeleted === true ? null : ({ id, ...local.data } as WithId<Loan>);
    throw new Error('Loan was not found.');
  }

  if (!snapshot.exists()) {
    if (local?.full) return local.data.isDeleted === true ? null : ({ id, ...local.data } as WithId<Loan>);
    return null;
  }

  const loan = mergeLocalRecord('loans', { id: snapshot.id, ...(snapshot.data() as Loan) });
  return loan.isDeleted ? null : loan;
}

export async function createLoan(input: LoanInput, user: User) {
  await assertBorrowerCanReceiveLoan(input.borrowerId);
  const { principalCents, interestRatePercent } = validateLoanInput(input);
  const values = calculateLoanValues({
    principalCents,
    interestRatePercent,
    paidCents: 0,
    dueDate: input.dueDate,
  });

  const loanRef = doc(loansRef);
  const data = {
    borrowerId: input.borrowerId,
    borrowerName: input.borrowerName,
    ...values,
    loanDate: input.loanDate,
    dueDate: input.dueDate,
    notes: input.notes.trim(),
    isDeleted: false,
    deleteReason: null,
    cancelledAt: null,
    cancelledBy: null,
  };
  writeLocalRecord<Loan>('loans', loanRef.id, {
    ...data,
    ...createLocalAudit(user),
  });
  await finishFirestoreWrite('Create loan', setDoc(loanRef, {
    ...data,
    ...createAudit(user),
  }));
  return loanRef.id;
}

export async function updateLoan(id: string, input: LoanUpdateInput, user: User) {
  const existing = await getLoan(id);
  if (!existing) throw new Error('Loan was not found.');
  await assertBorrowerCanReceiveLoan(input.borrowerId);

  const { principalCents, interestRatePercent } = validateLoanInput(input);
  const paidCents = input.paidCents ?? existing.paidCents ?? existing.totalPaid ?? 0;
  const values = calculateLoanValues({
    principalCents,
    interestRatePercent,
    paidCents,
    dueDate: input.dueDate,
    currentStatus: existing.status === 'cancelled' ? 'cancelled' : input.status,
  });

  patchLocalRecord<Loan>('loans', id, {
    borrowerId: input.borrowerId,
    borrowerName: input.borrowerName,
    ...values,
    loanDate: input.loanDate,
    dueDate: input.dueDate,
    notes: input.notes.trim(),
    ...updateLocalAudit(user),
  });
  await finishFirestoreWrite('Update loan', updateDoc(doc(db, 'loans', id), {
    borrowerId: input.borrowerId,
    borrowerName: input.borrowerName,
    ...values,
    loanDate: input.loanDate,
    dueDate: input.dueDate,
    notes: input.notes.trim(),
    ...updateAudit(user),
  }));
}

export async function updateLoanNotes(id: string, notes: string, user: User) {
  patchLocalRecord<Loan>('loans', id, {
    notes: notes.trim(),
    ...updateLocalAudit(user),
  });
  await finishFirestoreWrite('Update loan notes', updateDoc(doc(db, 'loans', id), {
    notes: notes.trim(),
    ...updateAudit(user),
  }));
}

export async function cancelLoan(id: string, user: User) {
  await softDeleteLoan(id, user);
}

export async function softDeleteLoan(id: string, user: User, deleteReason = '') {
  const paymentsQuery = loanPaymentsCascadeQuery(id);
  const paymentsSnapshot = await finishFirestoreRead(getDocs(paymentsQuery), () => getDocsFromCache(paymentsQuery));
  const deleted = softDeleteData(user, deleteReason);
  const localDeleted = localSoftDeleteData(user, deleteReason);
  patchLocalRecord<Loan>('loans', id, {
    status: 'cancelled',
    ...localDeleted,
  });
  paymentsSnapshot.docs.forEach((payment) => {
    patchLocalRecord('payments', payment.id, localDeleted);
  });

  await commitBatchedUpdates([
    {
      ref: doc(db, 'loans', id),
      data: {
        status: 'cancelled',
        ...deleted,
      },
    },
    ...paymentsSnapshot.docs.map((payment) => ({
      ref: payment.ref,
      data: deleted,
    })),
  ]);
}

export async function restoreLoan(id: string, user: User) {
  const loanRef = doc(db, 'loans', id);
  const loanSnapshot = await finishFirestoreRead(getDoc(loanRef), () => getDocFromCache(loanRef));
  if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

  const loan = loanSnapshot.data() as Loan;
  const borrowerRef = doc(db, 'borrowers', loan.borrowerId);
  const borrowerSnapshot = await finishFirestoreRead(getDoc(borrowerRef), () => getDocFromCache(borrowerRef));
  if (!borrowerSnapshot.exists() || borrowerSnapshot.data().isDeleted === true) {
    throw new Error('Restore the borrower before restoring this loan.');
  }

  const paymentsQuery = loanPaymentsCascadeQuery(id);
  const paymentsSnapshot = await finishFirestoreRead(getDocs(paymentsQuery), () => getDocsFromCache(paymentsQuery));
  const restored = {
    isDeleted: false,
    ...restoreAudit(user),
  };
  const localRestored = {
    isDeleted: false,
    ...restoreLocalAudit(user),
  };
  patchLocalRecord<Loan>('loans', id, {
    status: getLoanStatus({ ...loan, status: undefined }),
    ...localRestored,
  });
  paymentsSnapshot.docs.forEach((payment) => {
    patchLocalRecord('payments', payment.id, localRestored);
  });
  const updates: BatchedUpdate[] = [
    {
      ref: loanSnapshot.ref,
      data: {
        status: getLoanStatus({ ...loan, status: undefined }),
        ...restored,
      },
    },
    ...paymentsSnapshot.docs.map((payment) => ({
      ref: payment.ref,
      data: restored,
    })),
  ];

  await commitBatchedUpdates(updates);
}

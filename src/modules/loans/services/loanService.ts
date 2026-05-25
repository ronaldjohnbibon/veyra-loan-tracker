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
import { createAudit, deleteAudit, restoreAudit, updateAudit } from '@/shared/utils/audit';
import { commitBatchedUpdates, type BatchedUpdate } from '@/shared/utils/firestoreBatches';
import { calculateLoanValues, getLoanStatus, isValidDateInput, toCents } from '@/shared/utils/loanCalculations';
import { finishFirestoreWrite, isDeviceOnline } from '@/shared/services/offlineSyncService';
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

async function assertBorrowerCanReceiveLoan(borrowerId: string) {
  const borrowerRef = doc(db, 'borrowers', borrowerId);
  const borrowerSnapshot = isDeviceOnline() ? await getDoc(borrowerRef) : await getDocFromCache(borrowerRef);
  if (!borrowerSnapshot.exists() || borrowerSnapshot.data().isDeleted === true) {
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
      callback(visibleLoans(snapshot.docs.map(loanFromDoc)));
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
      callback([...snapshot.docs.map(loanFromDoc)].sort((first, second) => first.dueDate.localeCompare(second.dueDate)));
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
      callback(visibleLoans(snapshot.docs.map(loanFromDoc)).filter((loan) => loan.borrowerId === borrowerId));
    },
    (error) => {
      console.error('Unable to load borrower loans.', error);
      callback([]);
    },
  );
}

export async function listLoans() {
  const q = activeLoansQuery();
  const snapshot = isDeviceOnline() ? await getDocs(q) : await getDocsFromCache(q);
  return visibleLoans(snapshot.docs.map(loanFromDoc));
}

export async function listBorrowerLoans(borrowerId: string) {
  const q = activeLoansQuery();
  const snapshot = isDeviceOnline() ? await getDocs(q) : await getDocsFromCache(q);
  return visibleLoans(snapshot.docs.map(loanFromDoc)).filter((loan) => loan.borrowerId === borrowerId);
}

export async function getLoan(id: string) {
  const loanRef = doc(db, 'loans', id);
  const snapshot = isDeviceOnline() ? await getDoc(loanRef) : await getDocFromCache(loanRef);
  if (!snapshot.exists()) return null;
  const loan = { id: snapshot.id, ...(snapshot.data() as Loan) };
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
  await finishFirestoreWrite('Create loan', setDoc(loanRef, {
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
  const paymentsSnapshot = isDeviceOnline() ? await getDocs(paymentsQuery) : await getDocsFromCache(paymentsQuery);
  const deleted = softDeleteData(user, deleteReason);

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
  const loanSnapshot = isDeviceOnline() ? await getDoc(loanRef) : await getDocFromCache(loanRef);
  if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

  const loan = loanSnapshot.data() as Loan;
  const borrowerRef = doc(db, 'borrowers', loan.borrowerId);
  const borrowerSnapshot = isDeviceOnline() ? await getDoc(borrowerRef) : await getDocFromCache(borrowerRef);
  if (!borrowerSnapshot.exists() || borrowerSnapshot.data().isDeleted === true) {
    throw new Error('Restore the borrower before restoring this loan.');
  }

  const paymentsQuery = loanPaymentsCascadeQuery(id);
  const paymentsSnapshot = isDeviceOnline() ? await getDocs(paymentsQuery) : await getDocsFromCache(paymentsQuery);
  const restored = {
    isDeleted: false,
    ...restoreAudit(user),
  };
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

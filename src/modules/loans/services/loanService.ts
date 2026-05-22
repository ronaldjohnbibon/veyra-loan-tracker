import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/app/firebase/firebase';
import { createAudit, updateAudit } from '@/shared/utils/audit';
import { calculateLoanValues, isValidDateInput, toCents } from '@/shared/utils/loanCalculations';
import type { WithId } from '@/shared/types/audit';
import type { Loan, LoanInput, LoanUpdateInput } from '../types';

const loansRef = collection(db, 'loans');

function loanFromDoc(snapshot: Awaited<ReturnType<typeof getDocs>>['docs'][number]) {
  return { id: snapshot.id, ...(snapshot.data() as Loan) };
}

function activeLoansQuery() {
  return query(loansRef, orderBy('dueDate'));
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
  const snapshot = await getDocs(activeLoansQuery());
  return visibleLoans(snapshot.docs.map(loanFromDoc));
}

export async function listBorrowerLoans(borrowerId: string) {
  const snapshot = await getDocs(activeLoansQuery());
  return visibleLoans(snapshot.docs.map(loanFromDoc)).filter((loan) => loan.borrowerId === borrowerId);
}

export async function getLoan(id: string) {
  const snapshot = await getDoc(doc(db, 'loans', id));
  if (!snapshot.exists()) return null;
  const loan = { id: snapshot.id, ...(snapshot.data() as Loan) };
  return loan.isDeleted ? null : loan;
}

export async function createLoan(input: LoanInput, user: User) {
  const { principalCents, interestRatePercent } = validateLoanInput(input);
  const values = calculateLoanValues({
    principalCents,
    interestRatePercent,
    paidCents: 0,
    dueDate: input.dueDate,
  });

  const loan = await addDoc(loansRef, {
    borrowerId: input.borrowerId,
    borrowerName: input.borrowerName,
    ...values,
    loanDate: input.loanDate,
    dueDate: input.dueDate,
    notes: input.notes.trim(),
    isDeleted: false,
    cancelledAt: null,
    cancelledBy: null,
    ...createAudit(user),
  });
  return loan.id;
}

export async function updateLoan(id: string, input: LoanUpdateInput, user: User) {
  const existing = await getLoan(id);
  if (!existing) throw new Error('Loan was not found.');

  const { principalCents, interestRatePercent } = validateLoanInput(input);
  const paidCents = input.paidCents ?? existing.paidCents ?? existing.totalPaid ?? 0;
  const values = calculateLoanValues({
    principalCents,
    interestRatePercent,
    paidCents,
    dueDate: input.dueDate,
    currentStatus: existing.status === 'cancelled' ? 'cancelled' : input.status,
  });

  await updateDoc(doc(db, 'loans', id), {
    borrowerId: input.borrowerId,
    borrowerName: input.borrowerName,
    ...values,
    loanDate: input.loanDate,
    dueDate: input.dueDate,
    notes: input.notes.trim(),
    ...updateAudit(user),
  });
}

export async function updateLoanNotes(id: string, notes: string, user: User) {
  await updateDoc(doc(db, 'loans', id), {
    notes: notes.trim(),
    ...updateAudit(user),
  });
}

export async function cancelLoan(id: string, user: User) {
  await softDeleteLoan(id, user);
}

export async function softDeleteLoan(id: string, user: User, deleteReason = '') {
  await updateDoc(doc(db, 'loans', id), {
    status: 'cancelled',
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: user.uid,
    deleteReason: deleteReason.trim() || null,
    ...updateAudit(user),
  });
}

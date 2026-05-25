import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/app/firebase/firebase';
import { cancelAudit, createAudit, deleteAudit, restoreAudit, updateAudit } from '@/shared/utils/audit';
import { canAcceptPayment, isValidDateInput, toCents } from '@/shared/utils/loanCalculations';
import type { Loan } from '@/modules/loans/types';
import { calculateLoanBalanceAfterPayment } from '@/modules/loans/services/loanService';
import { getUserProfile } from '@/modules/auth/services/authService';
import { finishFirestoreWrite, isDeviceOnline } from '@/shared/services/offlineSyncService';
import type { WithId } from '@/shared/types/audit';
import type { Payment, PaymentCancelInput, PaymentInput } from '../types';

const paymentsRef = collection(db, 'payments');

function paymentFromDoc(snapshot: Awaited<ReturnType<typeof getDocs>>['docs'][number]) {
  return { id: snapshot.id, ...(snapshot.data() as Payment) };
}

function loanPaymentsQuery(loanId: string) {
  return query(paymentsRef, where('isDeleted', '==', false), where('loanId', '==', loanId));
}

function allPaymentsQuery() {
  return query(paymentsRef, where('isDeleted', '==', false));
}

function deletedPaymentsQuery() {
  return query(paymentsRef, where('isDeleted', '==', true));
}

function sortPaymentsByDate(payments: WithId<Payment>[]) {
  return [...payments].sort((first, second) => second.paymentDate.localeCompare(first.paymentDate));
}

function appliedAmountCents(payment: Payment) {
  return payment.amountCents ?? payment.amountPaid ?? 0;
}

function softDeleteData(user: User, deleteReason: string) {
  return {
    isDeleted: true,
    deleteReason: deleteReason.trim() || null,
    ...deleteAudit(user),
  };
}

async function assertOwnerCanCancelPayments(user: User) {
  if (!isDeviceOnline()) return;
  const profile = await getUserProfile(user.uid);
  if (profile?.role !== 'owner') throw new Error('Only owners can cancel payments.');
}

async function getLoanSnapshotForWrite(loanId: string) {
  const loanRef = doc(db, 'loans', loanId);
  return isDeviceOnline() ? getDoc(loanRef) : getDocFromCache(loanRef);
}

async function getPaymentSnapshotForWrite(paymentId: string) {
  const paymentRef = doc(db, 'payments', paymentId);
  return isDeviceOnline() ? getDoc(paymentRef) : getDocFromCache(paymentRef);
}

export function watchLoanPayments(loanId: string, callback: (payments: WithId<Payment>[]) => void) {
  const q = loanPaymentsQuery(loanId);
  return onSnapshot(
    q,
    (snapshot) => {
      callback(sortPaymentsByDate(snapshot.docs.map(paymentFromDoc)));
    },
    (error) => {
      console.error('Unable to load loan payments.', error);
      callback([]);
    },
  );
}

export async function listLoanPayments(loanId: string) {
  const q = loanPaymentsQuery(loanId);
  const snapshot = isDeviceOnline() ? await getDocs(q) : await getDocsFromCache(q);
  return sortPaymentsByDate(snapshot.docs.map(paymentFromDoc));
}

export function watchPayments(callback: (payments: WithId<Payment>[]) => void) {
  const q = allPaymentsQuery();
  return onSnapshot(
    q,
    (snapshot) => {
      callback(sortPaymentsByDate(snapshot.docs.map(paymentFromDoc)));
    },
    (error) => {
      console.error('Unable to load payments.', error);
      callback([]);
    },
  );
}

// Watches only soft-deleted payments for the trash page.
export function watchDeletedPayments(callback: (payments: WithId<Payment>[]) => void) {
  const q = deletedPaymentsQuery();
  return onSnapshot(
    q,
    (snapshot) => {
      callback(sortPaymentsByDate(snapshot.docs.map(paymentFromDoc)));
    },
    (error) => {
      console.error('Unable to load deleted payments.', error);
      callback([]);
    },
  );
}

export async function listPayments() {
  const q = allPaymentsQuery();
  const snapshot = isDeviceOnline() ? await getDocs(q) : await getDocsFromCache(q);
  return sortPaymentsByDate(snapshot.docs.map(paymentFromDoc));
}

export async function getPayment(id: string) {
  const paymentRef = doc(db, 'payments', id);
  const snapshot = isDeviceOnline() ? await getDoc(paymentRef) : await getDocFromCache(paymentRef);
  if (!snapshot.exists()) return null;
  const payment = { id: snapshot.id, ...(snapshot.data() as Payment) };
  return payment.isDeleted ? null : payment;
}

export async function createPayment(loanId: string, input: PaymentInput, user: User) {
  const amountCents = toCents(input.amount);
  if (amountCents <= 0) throw new Error('Payment amount must be greater than zero.');
  if (!isValidDateInput(input.paymentDate)) throw new Error('Payment date must be valid.');

  const paymentRef = doc(paymentsRef);

  if (!isDeviceOnline()) {
    const loanRef = doc(db, 'loans', loanId);
    const loanSnapshot = await getLoanSnapshotForWrite(loanId);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    if (loan.isDeleted === true) throw new Error('Loan was not found.');
    if (!canAcceptPayment(loan, amountCents)) {
      const remainingCents = loan.remainingCents ?? loan.remainingBalance ?? 0;
      if (amountCents > remainingCents) throw new Error('Payment cannot be more than the remaining balance.');
      throw new Error('Only active or overdue loans can receive payments.');
    }

    const nextBalance = calculateLoanBalanceAfterPayment(loan, amountCents);
    const batch = writeBatch(db);
    batch.set(paymentRef, {
      loanId,
      borrowerId: loan.borrowerId,
      borrowerName: loan.borrowerName,
      amountCents,
      amountPaid: amountCents,
      paymentDate: input.paymentDate,
      notes: input.notes.trim(),
      status: 'applied',
      isDeleted: false,
      isCancelled: false,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      ...createAudit(user),
    });
    batch.update(loanRef, {
      ...nextBalance,
      totalPaid: nextBalance.paidCents,
      remainingBalance: nextBalance.remainingCents,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });

    await finishFirestoreWrite('Record payment', batch.commit());
    return;
  }

  await finishFirestoreWrite('Record payment', runTransaction(db, async (transaction) => {
    const loanRef = doc(db, 'loans', loanId);
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    if (loan.isDeleted === true) throw new Error('Loan was not found.');
    if (!canAcceptPayment(loan, amountCents)) {
      const remainingCents = loan.remainingCents ?? loan.remainingBalance ?? 0;
      if (amountCents <= 0) throw new Error('Payment amount must be greater than zero.');
      if (amountCents > remainingCents) throw new Error('Payment cannot be more than the remaining balance.');
      throw new Error('Only active or overdue loans can receive payments.');
    }

    const nextBalance = calculateLoanBalanceAfterPayment(loan, amountCents);

    transaction.set(paymentRef, {
      loanId,
      borrowerId: loan.borrowerId,
      borrowerName: loan.borrowerName,
      amountCents,
      amountPaid: amountCents,
      paymentDate: input.paymentDate,
      notes: input.notes.trim(),
      status: 'applied',
      isDeleted: false,
      isCancelled: false,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      ...createAudit(user),
    });

    transaction.update(loanRef, {
      ...nextBalance,
      totalPaid: nextBalance.paidCents,
      remainingBalance: nextBalance.remainingCents,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  }));
}

export async function updatePaymentNotes(id: string, notes: string, user: User) {
  await finishFirestoreWrite('Update payment notes', updateDoc(doc(db, 'payments', id), {
    notes: notes.trim(),
    ...updateAudit(user),
  }));
}

export async function cancelPayment(paymentId: string, user: User, input: PaymentCancelInput) {
  await assertOwnerCanCancelPayments(user);
  const cancellationReason = input.reason.trim();
  if (!cancellationReason) throw new Error('Cancellation reason is required.');

  if (!isDeviceOnline()) {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnapshot = await getPaymentSnapshotForWrite(paymentId);
    if (!paymentSnapshot.exists()) throw new Error('Payment was not found.');

    const payment = paymentSnapshot.data() as Payment;
    if (payment.isDeleted === true) throw new Error('Payment was not found.');
    if (payment.status === 'cancelled' || payment.isCancelled) return;

    const loanRef = doc(db, 'loans', payment.loanId);
    const loanSnapshot = await getLoanSnapshotForWrite(payment.loanId);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    const nextBalance = calculateLoanBalanceAfterPayment(loan, -appliedAmountCents(payment));
    const batch = writeBatch(db);
    batch.update(paymentRef, {
      status: 'cancelled',
      isCancelled: true,
      cancellationReason,
      ...cancelAudit(user),
    });
    batch.update(loanRef, {
      ...nextBalance,
      totalPaid: nextBalance.paidCents,
      remainingBalance: nextBalance.remainingCents,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });

    await finishFirestoreWrite('Cancel payment', batch.commit());
    return;
  }

  await finishFirestoreWrite('Cancel payment', runTransaction(db, async (transaction) => {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists()) throw new Error('Payment was not found.');

    const payment = paymentSnapshot.data() as Payment;
    if (payment.isDeleted === true) throw new Error('Payment was not found.');
    if (payment.status === 'cancelled' || payment.isCancelled) return;

    const loanRef = doc(db, 'loans', payment.loanId);
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    const nextBalance = calculateLoanBalanceAfterPayment(loan, -appliedAmountCents(payment));

    transaction.update(paymentRef, {
      status: 'cancelled',
      isCancelled: true,
      cancellationReason,
      ...cancelAudit(user),
    });

    transaction.update(loanRef, {
      ...nextBalance,
      totalPaid: nextBalance.paidCents,
      remainingBalance: nextBalance.remainingCents,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  }));
}

export async function softDeletePayment(paymentId: string, user: User, deleteReason = '') {
  await assertOwnerCanCancelPayments(user);

  if (!isDeviceOnline()) {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnapshot = await getPaymentSnapshotForWrite(paymentId);
    if (!paymentSnapshot.exists()) throw new Error('Payment was not found.');

    const payment = paymentSnapshot.data() as Payment;
    if (payment.isDeleted === true) return;

    const loanRef = doc(db, 'loans', payment.loanId);
    const loanSnapshot = await getLoanSnapshotForWrite(payment.loanId);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    const shouldAdjustLoan = loan.isDeleted !== true && payment.status === 'applied' && payment.isCancelled !== true;
    const nextBalance = shouldAdjustLoan ? calculateLoanBalanceAfterPayment(loan, -appliedAmountCents(payment)) : null;
    const batch = writeBatch(db);
    batch.update(paymentRef, softDeleteData(user, deleteReason));

    if (nextBalance) {
      batch.update(loanRef, {
        ...nextBalance,
        totalPaid: nextBalance.paidCents,
        remainingBalance: nextBalance.remainingCents,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
    }

    await finishFirestoreWrite('Delete payment', batch.commit());
    return;
  }

  await finishFirestoreWrite('Delete payment', runTransaction(db, async (transaction) => {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists()) throw new Error('Payment was not found.');

    const payment = paymentSnapshot.data() as Payment;
    if (payment.isDeleted === true) return;

    const loanRef = doc(db, 'loans', payment.loanId);
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    const shouldAdjustLoan = loan.isDeleted !== true && payment.status === 'applied' && payment.isCancelled !== true;
    const nextBalance = shouldAdjustLoan ? calculateLoanBalanceAfterPayment(loan, -appliedAmountCents(payment)) : null;

    transaction.update(paymentRef, softDeleteData(user, deleteReason));

    if (nextBalance) {
      transaction.update(loanRef, {
        ...nextBalance,
        totalPaid: nextBalance.paidCents,
        remainingBalance: nextBalance.remainingCents,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
    }
  }));
}

export async function restorePayment(paymentId: string, user: User) {
  await assertOwnerCanCancelPayments(user);

  if (!isDeviceOnline()) {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnapshot = await getPaymentSnapshotForWrite(paymentId);
    if (!paymentSnapshot.exists()) throw new Error('Payment was not found.');

    const payment = paymentSnapshot.data() as Payment;
    if (payment.isDeleted !== true) return;

    const loanRef = doc(db, 'loans', payment.loanId);
    const loanSnapshot = await getLoanSnapshotForWrite(payment.loanId);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    if (loan.isDeleted === true) throw new Error('Restore the loan before restoring this payment.');

    const shouldAdjustLoan = payment.status === 'applied' && payment.isCancelled !== true;
    const amountCents = appliedAmountCents(payment);
    if (shouldAdjustLoan && !canAcceptPayment(loan, amountCents)) {
      throw new Error('Payment cannot be restored because it exceeds the remaining balance.');
    }

    const batch = writeBatch(db);
    batch.update(paymentRef, {
      isDeleted: false,
      ...restoreAudit(user),
    });

    if (shouldAdjustLoan) {
      const nextBalance = calculateLoanBalanceAfterPayment(loan, amountCents);
      batch.update(loanRef, {
        ...nextBalance,
        totalPaid: nextBalance.paidCents,
        remainingBalance: nextBalance.remainingCents,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
    }

    await finishFirestoreWrite('Restore payment', batch.commit());
    return;
  }

  await finishFirestoreWrite('Restore payment', runTransaction(db, async (transaction) => {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists()) throw new Error('Payment was not found.');

    const payment = paymentSnapshot.data() as Payment;
    if (payment.isDeleted !== true) return;

    const loanRef = doc(db, 'loans', payment.loanId);
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    if (loan.isDeleted === true) throw new Error('Restore the loan before restoring this payment.');

    const shouldAdjustLoan = payment.status === 'applied' && payment.isCancelled !== true;
    const amountCents = appliedAmountCents(payment);
    if (shouldAdjustLoan && !canAcceptPayment(loan, amountCents)) {
      throw new Error('Payment cannot be restored because it exceeds the remaining balance.');
    }

    transaction.update(paymentRef, {
      isDeleted: false,
      ...restoreAudit(user),
    });

    if (shouldAdjustLoan) {
      const nextBalance = calculateLoanBalanceAfterPayment(loan, amountCents);
      transaction.update(loanRef, {
        ...nextBalance,
        totalPaid: nextBalance.paidCents,
        remainingBalance: nextBalance.remainingCents,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
    }
  }));
}

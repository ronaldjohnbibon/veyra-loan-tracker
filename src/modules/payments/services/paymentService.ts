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
import { cancelAudit, cancelLocalAudit, createAudit, createLocalAudit, deleteAudit, deleteLocalAudit, restoreAudit, restoreLocalAudit, updateAudit, updateLocalAudit } from '@/shared/utils/audit';
import { canAcceptPayment, isValidDateInput, toCents } from '@/shared/utils/loanCalculations';
import { calculateInterestCollectedDeltaCents, calculateInterestShareBreakdown, loanInvestmentUsageCents, normalizeFinancialSettings } from '@/shared/utils/financialCalculations';
import type { Loan } from '@/modules/loans/types';
import { calculateLoanBalanceAfterPayment } from '@/modules/loans/services/loanService';
import { getUserProfile } from '@/modules/auth/services/authService';
import { buildInvestmentSettingsUpdate, financialSettingsRef, getFinancialSettings } from '@/modules/settings/services/financialSettingsService';
import { finishFirestoreRead, finishFirestoreWrite, isDeviceOnline } from '@/shared/services/offlineSyncService';
import { clearSyncedLocalRecords, getLocalRecord, mergeLocalRecord, mergeLocalRecords, patchLocalRecord, writeLocalRecord } from '@/shared/services/localDataCache';
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

function activePayments(payments: WithId<Payment>[]) {
  return payments.filter((payment) => payment.isDeleted !== true);
}

function deletedPayments(payments: WithId<Payment>[]) {
  return payments.filter((payment) => payment.isDeleted === true);
}

function appliedAmountCents(payment: Payment) {
  return payment.amountCents ?? payment.amountPaid ?? 0;
}

function loanInvestmentDeltaCents(beforeLoan: Loan, afterLoan: Loan) {
  return loanInvestmentUsageCents(afterLoan) - loanInvestmentUsageCents(beforeLoan);
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

async function assertOwnerCanCancelPayments(user: User) {
  if (!isDeviceOnline()) return;
  const profile = await getUserProfile(user.uid);
  if (profile?.role !== 'owner') throw new Error('Only owners can cancel payments.');
}

async function getLoanSnapshotForWrite(loanId: string) {
  const loanRef = doc(db, 'loans', loanId);
  return finishFirestoreRead(getDoc(loanRef), () => getDocFromCache(loanRef));
}

async function getPaymentSnapshotForWrite(paymentId: string) {
  const paymentRef = doc(db, 'payments', paymentId);
  return finishFirestoreRead(getDoc(paymentRef), () => getDocFromCache(paymentRef));
}

async function getLoanForWrite(loanId: string) {
  const local = getLocalRecord<Loan>('loans', loanId);
  const snapshot = await getLoanSnapshotForWrite(loanId).catch((error) => {
    if (local?.full) return null;
    throw error;
  });

  if (!snapshot?.exists()) {
    if (local?.full) return { id: loanId, ...local.data } as WithId<Loan>;
    throw new Error('Loan was not found.');
  }

  return mergeLocalRecord('loans', { id: snapshot.id, ...(snapshot.data() as Loan) });
}

export function watchLoanPayments(loanId: string, callback: (payments: WithId<Payment>[]) => void) {
  const q = loanPaymentsQuery(loanId);
  return onSnapshot(
    q,
    (snapshot) => {
      clearSyncedLocalRecords('payments', snapshot.docs.filter((item) => !item.metadata.hasPendingWrites).map((item) => item.id));
      callback(sortPaymentsByDate(activePayments(mergeLocalRecords('payments', snapshot.docs.map(paymentFromDoc)))));
    },
    (error) => {
      console.error('Unable to load loan payments.', error);
      callback([]);
    },
  );
}

export async function listLoanPayments(loanId: string) {
  const q = loanPaymentsQuery(loanId);
  const snapshot = await finishFirestoreRead(getDocs(q), () => getDocsFromCache(q));
  return sortPaymentsByDate(activePayments(mergeLocalRecords('payments', snapshot.docs.map(paymentFromDoc))));
}

export function watchPayments(callback: (payments: WithId<Payment>[]) => void) {
  const q = allPaymentsQuery();
  return onSnapshot(
    q,
    (snapshot) => {
      clearSyncedLocalRecords('payments', snapshot.docs.filter((item) => !item.metadata.hasPendingWrites).map((item) => item.id));
      callback(sortPaymentsByDate(activePayments(mergeLocalRecords('payments', snapshot.docs.map(paymentFromDoc)))));
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
      clearSyncedLocalRecords('payments', snapshot.docs.filter((item) => !item.metadata.hasPendingWrites).map((item) => item.id));
      callback(sortPaymentsByDate(deletedPayments(mergeLocalRecords('payments', snapshot.docs.map(paymentFromDoc)))));
    },
    (error) => {
      console.error('Unable to load deleted payments.', error);
      callback([]);
    },
  );
}

export async function listPayments() {
  const q = allPaymentsQuery();
  const snapshot = await finishFirestoreRead(getDocs(q), () => getDocsFromCache(q));
  return sortPaymentsByDate(activePayments(mergeLocalRecords('payments', snapshot.docs.map(paymentFromDoc))));
}

export async function getPayment(id: string) {
  const local = getLocalRecord<Payment>('payments', id);
  const paymentRef = doc(db, 'payments', id);
  let snapshot: Awaited<ReturnType<typeof getDoc>> | null = null;
  try {
    snapshot = await finishFirestoreRead(getDoc(paymentRef), () => getDocFromCache(paymentRef));
  } catch {
    if (local?.full) return local.data.isDeleted === true ? null : ({ id, ...local.data } as WithId<Payment>);
    throw new Error('Payment was not found.');
  }

  if (!snapshot.exists()) {
    if (local?.full) return local.data.isDeleted === true ? null : ({ id, ...local.data } as WithId<Payment>);
    return null;
  }

  const payment = mergeLocalRecord('payments', { id: snapshot.id, ...(snapshot.data() as Payment) });
  return payment.isDeleted ? null : payment;
}

export async function createPayment(loanId: string, input: PaymentInput, user: User) {
  const amountCents = toCents(input.amount);
  if (amountCents <= 0) throw new Error('Payment amount must be greater than zero.');
  if (!isValidDateInput(input.paymentDate)) throw new Error('Payment date must be valid.');

  const paymentRef = doc(paymentsRef);
  const loanRef = doc(db, 'loans', loanId);
  const loan = await getLoanForWrite(loanId);
  if (loan.isDeleted === true) throw new Error('Loan was not found.');
  if (!canAcceptPayment(loan, amountCents)) {
    const remainingCents = loan.remainingCents ?? loan.remainingBalance ?? 0;
    if (amountCents > remainingCents) throw new Error('Payment cannot be more than the remaining balance.');
    throw new Error('Only active or overdue loans can receive payments.');
  }

  const nextBalance = calculateLoanBalanceAfterPayment(loan, amountCents);
  const settings = await getFinancialSettings();
  const interestShares = calculateInterestShareBreakdown(calculateInterestCollectedDeltaCents(loan, amountCents), settings);
  const usedInvestmentDeltaCents = loanInvestmentDeltaCents(loan, { ...loan, ...nextBalance });
  const data = {
    loanId,
    borrowerId: loan.borrowerId,
    borrowerName: loan.borrowerName,
    amountCents,
    amountPaid: amountCents,
    paymentDate: input.paymentDate,
    notes: input.notes.trim(),
    status: 'applied' as const,
    isDeleted: false,
    isCancelled: false,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    ...interestShares,
  };

  writeLocalRecord<Payment>('payments', paymentRef.id, {
    ...data,
    ...createLocalAudit(user),
  });
  patchLocalRecord<Loan>('loans', loanId, {
    ...nextBalance,
    totalPaid: nextBalance.paidCents,
    remainingBalance: nextBalance.remainingCents,
    ...updateLocalAudit(user),
  });

  if (!isDeviceOnline() || getLocalRecord<Loan>('loans', loanId)) {
    const batch = writeBatch(db);
    batch.set(paymentRef, {
      ...data,
      ...createAudit(user),
    });
    batch.update(loanRef, {
      ...nextBalance,
      totalPaid: nextBalance.paidCents,
      remainingBalance: nextBalance.remainingCents,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
    if (usedInvestmentDeltaCents !== 0) {
      batch.set(financialSettingsRef, buildInvestmentSettingsUpdate(settings, usedInvestmentDeltaCents, user), { merge: true });
    }

    await finishFirestoreWrite('Record payment', batch.commit());
    return;
  }

  await finishFirestoreWrite('Record payment', runTransaction(db, async (transaction) => {
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const serverLoan = loanSnapshot.data() as Loan;
    if (serverLoan.isDeleted === true) throw new Error('Loan was not found.');
    if (!canAcceptPayment(serverLoan, amountCents)) {
      const remainingCents = serverLoan.remainingCents ?? serverLoan.remainingBalance ?? 0;
      if (amountCents <= 0) throw new Error('Payment amount must be greater than zero.');
      if (amountCents > remainingCents) throw new Error('Payment cannot be more than the remaining balance.');
      throw new Error('Only active or overdue loans can receive payments.');
    }

    const serverNextBalance = calculateLoanBalanceAfterPayment(serverLoan, amountCents);
    const settingsSnapshot = await transaction.get(financialSettingsRef);
    const serverSettings = normalizeFinancialSettings(settingsSnapshot.exists() ? settingsSnapshot.data() : null);
    const serverInterestShares = calculateInterestShareBreakdown(calculateInterestCollectedDeltaCents(serverLoan, amountCents), serverSettings);
    const serverUsedInvestmentDeltaCents = loanInvestmentDeltaCents(serverLoan, { ...serverLoan, ...serverNextBalance });

    transaction.set(paymentRef, {
      ...data,
      borrowerId: serverLoan.borrowerId,
      borrowerName: serverLoan.borrowerName,
      ...serverInterestShares,
      ...createAudit(user),
    });

    transaction.update(loanRef, {
      ...serverNextBalance,
      totalPaid: serverNextBalance.paidCents,
      remainingBalance: serverNextBalance.remainingCents,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
    if (serverUsedInvestmentDeltaCents !== 0) {
      transaction.set(financialSettingsRef, buildInvestmentSettingsUpdate(serverSettings, serverUsedInvestmentDeltaCents, user), { merge: true });
    }
  }));
}

export async function updatePaymentNotes(id: string, notes: string, user: User) {
  patchLocalRecord<Payment>('payments', id, {
    notes: notes.trim(),
    ...updateLocalAudit(user),
  });
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

    const payment = mergeLocalRecord('payments', { id: paymentSnapshot.id, ...(paymentSnapshot.data() as Payment) });
    if (payment.isDeleted === true) throw new Error('Payment was not found.');
    if (payment.status === 'cancelled' || payment.isCancelled) return;

    const loanRef = doc(db, 'loans', payment.loanId);
    const loanSnapshot = await getLoanSnapshotForWrite(payment.loanId);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = mergeLocalRecord('loans', { id: loanSnapshot.id, ...(loanSnapshot.data() as Loan) });
    const nextBalance = calculateLoanBalanceAfterPayment(loan, -appliedAmountCents(payment));
    const settings = await getFinancialSettings();
    const usedInvestmentDeltaCents = loanInvestmentDeltaCents(loan, { ...loan, ...nextBalance });
    patchLocalRecord<Payment>('payments', paymentId, {
      status: 'cancelled',
      isCancelled: true,
      cancellationReason,
      ...cancelLocalAudit(user),
    });
    patchLocalRecord<Loan>('loans', payment.loanId, {
      ...nextBalance,
      totalPaid: nextBalance.paidCents,
      remainingBalance: nextBalance.remainingCents,
      ...updateLocalAudit(user),
    });
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
    if (usedInvestmentDeltaCents !== 0) {
      batch.set(financialSettingsRef, buildInvestmentSettingsUpdate(settings, usedInvestmentDeltaCents, user), { merge: true });
    }

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
    const settingsSnapshot = await transaction.get(financialSettingsRef);
    const settings = normalizeFinancialSettings(settingsSnapshot.exists() ? settingsSnapshot.data() : null);
    const usedInvestmentDeltaCents = loanInvestmentDeltaCents(loan, { ...loan, ...nextBalance });
    patchLocalRecord<Payment>('payments', paymentId, {
      status: 'cancelled',
      isCancelled: true,
      cancellationReason,
      ...cancelLocalAudit(user),
    });
    patchLocalRecord<Loan>('loans', payment.loanId, {
      ...nextBalance,
      totalPaid: nextBalance.paidCents,
      remainingBalance: nextBalance.remainingCents,
      ...updateLocalAudit(user),
    });

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
    if (usedInvestmentDeltaCents !== 0) {
      transaction.set(financialSettingsRef, buildInvestmentSettingsUpdate(settings, usedInvestmentDeltaCents, user), { merge: true });
    }
  }));
}

export async function softDeletePayment(paymentId: string, user: User, deleteReason = '') {
  await assertOwnerCanCancelPayments(user);

  if (!isDeviceOnline()) {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnapshot = await getPaymentSnapshotForWrite(paymentId);
    if (!paymentSnapshot.exists()) throw new Error('Payment was not found.');

    const payment = mergeLocalRecord('payments', { id: paymentSnapshot.id, ...(paymentSnapshot.data() as Payment) });
    if (payment.isDeleted === true) return;

    const loanRef = doc(db, 'loans', payment.loanId);
    const loanSnapshot = await getLoanSnapshotForWrite(payment.loanId);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = mergeLocalRecord('loans', { id: loanSnapshot.id, ...(loanSnapshot.data() as Loan) });
    const shouldAdjustLoan = loan.isDeleted !== true && payment.status === 'applied' && payment.isCancelled !== true;
    const nextBalance = shouldAdjustLoan ? calculateLoanBalanceAfterPayment(loan, -appliedAmountCents(payment)) : null;
    const settings = await getFinancialSettings();
    const usedInvestmentDeltaCents = nextBalance ? loanInvestmentDeltaCents(loan, { ...loan, ...nextBalance }) : 0;
    patchLocalRecord<Payment>('payments', paymentId, localSoftDeleteData(user, deleteReason));
    if (nextBalance) {
      patchLocalRecord<Loan>('loans', payment.loanId, {
        ...nextBalance,
        totalPaid: nextBalance.paidCents,
        remainingBalance: nextBalance.remainingCents,
        ...updateLocalAudit(user),
      });
    }
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
    if (usedInvestmentDeltaCents !== 0) {
      batch.set(financialSettingsRef, buildInvestmentSettingsUpdate(settings, usedInvestmentDeltaCents, user), { merge: true });
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
    const settingsSnapshot = await transaction.get(financialSettingsRef);
    const settings = normalizeFinancialSettings(settingsSnapshot.exists() ? settingsSnapshot.data() : null);
    const usedInvestmentDeltaCents = nextBalance ? loanInvestmentDeltaCents(loan, { ...loan, ...nextBalance }) : 0;
    patchLocalRecord<Payment>('payments', paymentId, localSoftDeleteData(user, deleteReason));
    if (nextBalance) {
      patchLocalRecord<Loan>('loans', payment.loanId, {
        ...nextBalance,
        totalPaid: nextBalance.paidCents,
        remainingBalance: nextBalance.remainingCents,
        ...updateLocalAudit(user),
      });
    }

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
    if (usedInvestmentDeltaCents !== 0) {
      transaction.set(financialSettingsRef, buildInvestmentSettingsUpdate(settings, usedInvestmentDeltaCents, user), { merge: true });
    }
  }));
}

export async function restorePayment(paymentId: string, user: User) {
  await assertOwnerCanCancelPayments(user);

  if (!isDeviceOnline()) {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnapshot = await getPaymentSnapshotForWrite(paymentId);
    if (!paymentSnapshot.exists()) throw new Error('Payment was not found.');

    const payment = mergeLocalRecord('payments', { id: paymentSnapshot.id, ...(paymentSnapshot.data() as Payment) });
    if (payment.isDeleted !== true) return;

    const loanRef = doc(db, 'loans', payment.loanId);
    const loanSnapshot = await getLoanSnapshotForWrite(payment.loanId);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = mergeLocalRecord('loans', { id: loanSnapshot.id, ...(loanSnapshot.data() as Loan) });
    if (loan.isDeleted === true) throw new Error('Restore the loan before restoring this payment.');

    const shouldAdjustLoan = payment.status === 'applied' && payment.isCancelled !== true;
    const amountCents = appliedAmountCents(payment);
    if (shouldAdjustLoan && !canAcceptPayment(loan, amountCents)) {
      throw new Error('Payment cannot be restored because it exceeds the remaining balance.');
    }

    patchLocalRecord<Payment>('payments', paymentId, {
      isDeleted: false,
      ...restoreLocalAudit(user),
    });
    const batch = writeBatch(db);
    batch.update(paymentRef, {
      isDeleted: false,
      ...restoreAudit(user),
    });

    if (shouldAdjustLoan) {
      const nextBalance = calculateLoanBalanceAfterPayment(loan, amountCents);
      const settings = await getFinancialSettings();
      const usedInvestmentDeltaCents = loanInvestmentDeltaCents(loan, { ...loan, ...nextBalance });
      patchLocalRecord<Loan>('loans', payment.loanId, {
        ...nextBalance,
        totalPaid: nextBalance.paidCents,
        remainingBalance: nextBalance.remainingCents,
        ...updateLocalAudit(user),
      });
      batch.update(loanRef, {
        ...nextBalance,
        totalPaid: nextBalance.paidCents,
        remainingBalance: nextBalance.remainingCents,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      if (usedInvestmentDeltaCents !== 0) {
        batch.set(financialSettingsRef, buildInvestmentSettingsUpdate(settings, usedInvestmentDeltaCents, user), { merge: true });
      }
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

    const nextBalance = shouldAdjustLoan ? calculateLoanBalanceAfterPayment(loan, amountCents) : null;
    const settingsSnapshot = shouldAdjustLoan ? await transaction.get(financialSettingsRef) : null;
    const settings = normalizeFinancialSettings(settingsSnapshot?.exists() ? settingsSnapshot.data() : null);
    const usedInvestmentDeltaCents = nextBalance ? loanInvestmentDeltaCents(loan, { ...loan, ...nextBalance }) : 0;

    patchLocalRecord<Payment>('payments', paymentId, {
      isDeleted: false,
      ...restoreLocalAudit(user),
    });
    transaction.update(paymentRef, {
      isDeleted: false,
      ...restoreAudit(user),
    });

    if (nextBalance) {
      patchLocalRecord<Loan>('loans', payment.loanId, {
        ...nextBalance,
        totalPaid: nextBalance.paidCents,
        remainingBalance: nextBalance.remainingCents,
        ...updateLocalAudit(user),
      });
      transaction.update(loanRef, {
        ...nextBalance,
        totalPaid: nextBalance.paidCents,
        remainingBalance: nextBalance.remainingCents,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
      if (usedInvestmentDeltaCents !== 0) {
        transaction.set(financialSettingsRef, buildInvestmentSettingsUpdate(settings, usedInvestmentDeltaCents, user), { merge: true });
      }
    }
  }));
}

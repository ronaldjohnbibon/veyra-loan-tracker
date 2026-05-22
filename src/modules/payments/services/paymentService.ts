import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/app/firebase/firebase';
import { cancelAudit, createAudit, updateAudit } from '@/shared/utils/audit';
import { canAcceptPayment, toCents } from '@/shared/utils/loanCalculations';
import type { Loan } from '@/modules/loans/types';
import { calculateLoanBalanceAfterPayment } from '@/modules/loans/services/loanService';
import { getUserProfile } from '@/modules/auth/services/authService';
import type { WithId } from '@/shared/types/audit';
import type { Payment, PaymentCancelInput, PaymentInput } from '../types';

const paymentsRef = collection(db, 'payments');

function paymentFromDoc(snapshot: Awaited<ReturnType<typeof getDocs>>['docs'][number]) {
  return { id: snapshot.id, ...(snapshot.data() as Payment) };
}

function loanPaymentsQuery(loanId: string) {
  return query(paymentsRef, where('isDeleted', '==', false), where('loanId', '==', loanId), orderBy('paymentDate', 'desc'));
}

function allPaymentsQuery() {
  return query(paymentsRef, where('isDeleted', '==', false), orderBy('paymentDate', 'desc'));
}

function appliedAmountCents(payment: Payment) {
  return payment.amountCents ?? payment.amountPaid ?? 0;
}

async function assertOwnerCanCancelPayments(user: User) {
  const profile = await getUserProfile(user.uid);
  if (profile?.role !== 'owner') throw new Error('Only owners can cancel payments.');
}

export function watchLoanPayments(loanId: string, callback: (payments: WithId<Payment>[]) => void) {
  const q = loanPaymentsQuery(loanId);
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map(paymentFromDoc));
    },
    (error) => {
      console.error('Unable to load loan payments.', error);
      callback([]);
    },
  );
}

export async function listLoanPayments(loanId: string) {
  const snapshot = await getDocs(loanPaymentsQuery(loanId));
  return snapshot.docs.map(paymentFromDoc);
}

export function watchPayments(callback: (payments: WithId<Payment>[]) => void) {
  const q = allPaymentsQuery();
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map(paymentFromDoc));
    },
    (error) => {
      console.error('Unable to load payments.', error);
      callback([]);
    },
  );
}

export async function listPayments() {
  const snapshot = await getDocs(allPaymentsQuery());
  return snapshot.docs.map(paymentFromDoc);
}

export async function getPayment(id: string) {
  const snapshot = await getDoc(doc(db, 'payments', id));
  if (!snapshot.exists()) return null;
  const payment = { id: snapshot.id, ...(snapshot.data() as Payment) };
  return payment.isDeleted ? null : payment;
}

export async function createPayment(loanId: string, input: PaymentInput, user: User) {
  const amountCents = toCents(input.amount);
  if (amountCents <= 0) throw new Error('Payment amount must be greater than zero.');

  await runTransaction(db, async (transaction) => {
    const loanRef = doc(db, 'loans', loanId);
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    if (!canAcceptPayment(loan, amountCents)) {
      const remainingCents = loan.remainingCents ?? loan.remainingBalance ?? 0;
      if (amountCents <= 0) throw new Error('Payment amount must be greater than zero.');
      if (amountCents > remainingCents) throw new Error('Payment cannot be more than the remaining balance.');
      throw new Error('Only active or overdue loans can receive payments.');
    }

    const nextBalance = calculateLoanBalanceAfterPayment(loan, amountCents);
    const paymentRef = doc(paymentsRef);

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
  });
}

export async function updatePaymentNotes(id: string, notes: string, user: User) {
  await updateDoc(doc(db, 'payments', id), {
    notes: notes.trim(),
    ...updateAudit(user),
  });
}

export async function cancelPayment(paymentId: string, user: User, input: PaymentCancelInput) {
  await assertOwnerCanCancelPayments(user);
  const cancellationReason = input.reason.trim();
  if (!cancellationReason) throw new Error('Cancellation reason is required.');

  await runTransaction(db, async (transaction) => {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists()) throw new Error('Payment was not found.');

    const payment = paymentSnapshot.data() as Payment;
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
  });
}

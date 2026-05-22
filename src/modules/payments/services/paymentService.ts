import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db } from '@/app/firebase/firebase';
import { cancelAudit, createAudit } from '@/shared/utils/audit';
import { toCents } from '@/shared/utils/loanCalculations';
import type { Loan } from '@/modules/loans/types';
import type { WithId } from '@/shared/types/audit';
import type { Payment, PaymentInput } from '../types';

const paymentsRef = collection(db, 'payments');

export function watchLoanPayments(loanId: string, callback: (payments: WithId<Payment>[]) => void) {
  const user = auth.currentUser;
  if (!user) {
    callback([]);
    return () => {};
  }

  const q = query(paymentsRef, where('createdBy', '==', user.uid), where('loanId', '==', loanId));
  return onSnapshot(
    q,
    (snapshot) => {
      const payments = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as Payment) }))
        .sort((first, second) => second.paymentDate.localeCompare(first.paymentDate));
      callback(payments);
    },
    (error) => {
      console.error('Unable to load loan payments.', error);
      callback([]);
    },
  );
}

export async function createPayment(loanId: string, input: PaymentInput, user: User) {
  const amountCents = toCents(input.amount);
  if (amountCents <= 0) throw new Error('Payment amount must be greater than zero.');

  await runTransaction(db, async (transaction) => {
    const loanRef = doc(db, 'loans', loanId);
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    if (loan.status !== 'active') throw new Error('Only active loans can receive payments.');
    if (amountCents > loan.remainingCents) throw new Error('Payment cannot be more than the remaining balance.');

    const remainingCents = loan.remainingCents - amountCents;
    const paidCents = loan.paidCents + amountCents;
    const paymentRef = doc(paymentsRef);

    transaction.set(paymentRef, {
      loanId,
      borrowerId: loan.borrowerId,
      borrowerName: loan.borrowerName,
      amountCents,
      paymentDate: input.paymentDate,
      notes: input.notes.trim(),
      status: 'applied',
      cancelledAt: null,
      cancelledBy: null,
      ...createAudit(user),
    });

    transaction.update(loanRef, {
      paidCents,
      remainingCents,
      status: remainingCents === 0 ? 'paid' : 'active',
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  });
}

export async function cancelPayment(paymentId: string, user: User) {
  await runTransaction(db, async (transaction) => {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists()) throw new Error('Payment was not found.');

    const payment = paymentSnapshot.data() as Payment;
    if (payment.status === 'cancelled') return;

    const loanRef = doc(db, 'loans', payment.loanId);
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) throw new Error('Loan was not found.');

    const loan = loanSnapshot.data() as Loan;
    const paidCents = Math.max(0, loan.paidCents - payment.amountCents);
    const remainingCents = loan.remainingCents + payment.amountCents;

    transaction.update(paymentRef, {
      status: 'cancelled',
      ...cancelAudit(user),
    });

    transaction.update(loanRef, {
      paidCents,
      remainingCents,
      status: loan.status === 'cancelled' ? 'cancelled' : 'active',
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  });
}

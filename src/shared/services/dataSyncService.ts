import { collection, doc, getDocs, query, serverTimestamp, updateDoc, waitForPendingWrites, where } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/app/firebase/firebase';
import { calculateLoanValues } from '@/shared/utils/loanCalculations';
import type { Loan } from '@/modules/loans/types';
import type { Payment } from '@/modules/payments/types';

const loansRef = collection(db, 'loans');
const paymentsRef = collection(db, 'payments');

function amountCents(payment: Payment) {
  return payment.amountCents ?? payment.amountPaid ?? 0;
}

function activeAppliedPayment(payment: Payment) {
  return payment.isDeleted !== true && payment.isCancelled !== true && payment.status !== 'cancelled';
}

function totalsDiffer(loan: Loan, paidCents: number, remainingCents: number, status: string) {
  return (
    (loan.paidCents ?? loan.totalPaid ?? 0) !== paidCents ||
    (loan.totalPaid ?? loan.paidCents ?? 0) !== paidCents ||
    (loan.remainingCents ?? loan.remainingBalance ?? 0) !== remainingCents ||
    (loan.remainingBalance ?? loan.remainingCents ?? 0) !== remainingCents ||
    loan.status !== status
  );
}

// Rebuilds loan balances from payment records after pending offline writes reach Firestore.
export async function reconcileLoanPaymentTotals(user: User) {
  await waitForPendingWrites(db);

  const [loanSnapshot, paymentSnapshot] = await Promise.all([
    getDocs(loansRef),
    getDocs(query(paymentsRef, where('isDeleted', '==', false))),
  ]);
  const paymentsByLoan = new Map<string, Payment[]>();

  paymentSnapshot.docs.forEach((paymentDoc) => {
    const payment = paymentDoc.data() as Payment;
    if (!activeAppliedPayment(payment)) return;

    const loanPayments = paymentsByLoan.get(payment.loanId) || [];
    loanPayments.push(payment);
    paymentsByLoan.set(payment.loanId, loanPayments);
  });

  for (const loanDoc of loanSnapshot.docs) {
    const loan = loanDoc.data() as Loan;
    if (loan.isDeleted === true || loan.status === 'cancelled') continue;

    const paidCents = (paymentsByLoan.get(loanDoc.id) || []).reduce((sum, payment) => sum + amountCents(payment), 0);
    const values = calculateLoanValues({
      principalCents: loan.principalCents ?? loan.principalAmount ?? 0,
      interestRatePercent: loan.interestRatePercent ?? loan.interestRate ?? 0,
      paidCents,
      dueDate: loan.dueDate,
    });

    if (!totalsDiffer(loan, values.paidCents, values.remainingCents, values.status)) continue;

    await updateDoc(doc(db, 'loans', loanDoc.id), {
      ...values,
      totalPaid: values.paidCents,
      remainingBalance: values.remainingCents,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  }
}

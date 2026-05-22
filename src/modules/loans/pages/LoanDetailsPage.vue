<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/loans" />
        </ion-buttons>
        <ion-title>{{ loan?.borrowerName || 'Loan' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="loan" :router-link="`/loans/${props.id}/edit`">Edit</ion-button>
          <ion-button v-if="loan && canDeleteLoan" color="danger" @click="deleteCurrentLoan">Delete</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <LoadingState v-if="loading" />
        <template v-else-if="loan">
          <div class="metric-grid">
            <div class="metric">
              <span>Principal</span>
              <strong>{{ formatCurrency(fromCents(loan.principalCents)) }}</strong>
            </div>
            <div class="metric">
              <span>Interest</span>
              <strong>{{ formatCurrency(fromCents(loan.interestCents)) }}</strong>
            </div>
            <div class="metric">
              <span>Total Payable</span>
              <strong>{{ formatCurrency(fromCents(loan.totalDueCents)) }}</strong>
            </div>
            <div class="metric">
              <span>Paid</span>
              <strong>{{ formatCurrency(fromCents(loan.paidCents)) }}</strong>
            </div>
            <div class="metric">
              <span>Remaining</span>
              <strong>{{ formatCurrency(fromCents(loan.remainingCents)) }}</strong>
            </div>
          </div>

          <ion-list class="record-list loan-meta" lines="full">
            <ion-item>
              <ion-label>Borrower</ion-label>
              <ion-note slot="end">{{ loan.borrowerName || 'Unknown borrower' }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>Status</ion-label>
              <ion-note slot="end">{{ loanStatus }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>Loan Date</ion-label>
              <ion-note slot="end">{{ formatDate(loan.loanDate) }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>Due Date</ion-label>
              <ion-note slot="end">{{ formatDate(loan.dueDate) }}</ion-note>
            </ion-item>
            <ion-item>
              <ion-label>Flat Interest</ion-label>
              <ion-note slot="end">{{ loan.interestRatePercent }}%</ion-note>
            </ion-item>
            <ion-item v-if="loan.notes">
              <ion-label>
                <span>Notes</span>
                <strong>{{ loan.notes }}</strong>
              </ion-label>
            </ion-item>
          </ion-list>

          <ion-button v-if="canRecordPayment" expand="block" @click="showPayment = true">Record Payment</ion-button>

          <ion-text v-if="error" color="danger">
            <p>{{ error }}</p>
          </ion-text>

          <h2>Payments</h2>
          <PaymentList :payments="payments" :can-cancel="canCancelPayments" @cancel="cancelCurrentPayment" />
        </template>
        <EmptyState v-else message="Loan not found." />
      </div>

      <ion-modal :is-open="showPayment" @didDismiss="showPayment = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Record Payment</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showPayment = false">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <PaymentForm ref="paymentForm" :saving="savingPayment" :max-amount-cents="remainingPaymentLimitCents" @submit="addPayment" />
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { formatCurrency, formatDate, fromCents } from '@/shared/utils/formatters';
import { canAcceptPayment, getLoanStatus } from '@/shared/utils/loanCalculations';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import PaymentForm from '@/modules/payments/components/PaymentForm.vue';
import PaymentList from '@/modules/payments/components/PaymentList.vue';
import { cancelPayment, createPayment, watchLoanPayments } from '@/modules/payments/services/paymentService';
import type { Payment, PaymentInput } from '@/modules/payments/types';
import type { WithId } from '@/shared/types/audit';
import { getLoan, softDeleteLoan } from '../services/loanService';
import type { Loan } from '../types';

const props = defineProps<{
  id: string;
}>();

const authStore = useAuthStore();
const router = useRouter();
const loan = ref<WithId<Loan> | null>(null);
const payments = ref<WithId<Payment>[]>([]);
const loading = ref(true);
const showPayment = ref(false);
const error = ref('');
const savingPayment = ref(false);
const paymentForm = ref<InstanceType<typeof PaymentForm> | null>(null);
let stopPayments = () => {};

onMounted(async () => {
  await refreshLoan();
  loading.value = false;
  stopPayments = watchLoanPayments(props.id, (items) => {
    payments.value = items;
  });
});

onUnmounted(() => stopPayments());

async function refreshLoan() {
  loan.value = await getLoan(props.id);
}

async function addPayment(input: PaymentInput) {
  if (!authStore.state.user || savingPayment.value) return;
  error.value = '';
  savingPayment.value = true;
  try {
    await createPayment(props.id, input, authStore.state.user);
    await refreshLoan();
    paymentForm.value?.reset();
    showPayment.value = false;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to record payment.';
  } finally {
    savingPayment.value = false;
  }
}

async function cancelCurrentPayment(paymentId: string) {
  if (!authStore.state.user || !canCancelPayments.value) return;
  const reason = window.prompt('Cancellation reason');
  if (!reason) return;

  error.value = '';
  try {
    await cancelPayment(paymentId, authStore.state.user, { reason });
    await refreshLoan();
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to cancel payment.';
  }
}

const loanStatus = computed(() => (loan.value ? getLoanStatus(loan.value) : 'active'));
const canRecordPayment = computed(() => (loan.value ? canAcceptPayment(loan.value, 1) : false));
const canCancelPayments = computed(() => authStore.isOwner());
const canDeleteLoan = computed(() => authStore.isOwner());
const remainingPaymentLimitCents = computed(() => loan.value?.remainingCents ?? loan.value?.remainingBalance ?? 0);

async function deleteCurrentLoan() {
  if (!authStore.state.user || !canDeleteLoan.value || !window.confirm('Soft delete this loan? Payment records will remain.')) return;
  const reason = window.prompt('Optional delete reason') || '';
  await softDeleteLoan(props.id, authStore.state.user, reason);
  router.replace('/loans');
}
</script>

<style scoped>
.loan-meta {
  margin: 16px 0;
}

h2 {
  font-size: 1.1rem;
  margin: 24px 0 12px;
}

.loan-meta ion-label {
  white-space: normal;
}

.loan-meta span {
  color: var(--app-muted);
  display: block;
  font-size: 0.8rem;
  margin-bottom: 6px;
}

.loan-meta strong {
  color: var(--ion-text-color);
  font-weight: 500;
}
</style>

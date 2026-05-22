<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/loans" />
        </ion-buttons>
        <ion-title>{{ loan?.borrowerName || 'Loan' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="loan?.status === 'active'" color="danger" @click="cancelCurrentLoan">Cancel Loan</ion-button>
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
              <strong>{{ formatMoney(loan.principalCents) }}</strong>
            </div>
            <div class="metric">
              <span>Interest</span>
              <strong>{{ formatMoney(loan.interestCents) }}</strong>
            </div>
            <div class="metric">
              <span>Paid</span>
              <strong>{{ formatMoney(loan.paidCents) }}</strong>
            </div>
            <div class="metric">
              <span>Remaining</span>
              <strong>{{ formatMoney(loan.remainingCents) }}</strong>
            </div>
          </div>

          <ion-list class="record-list loan-meta" lines="full">
            <ion-item>
              <ion-label>Status</ion-label>
              <ion-note slot="end">{{ loan.status }}</ion-note>
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
          </ion-list>

          <ion-button v-if="loan.status === 'active'" expand="block" @click="showPayment = true">Record Payment</ion-button>

          <ion-text v-if="error" color="danger">
            <p>{{ error }}</p>
          </ion-text>

          <h2>Payments</h2>
          <PaymentList :payments="payments" @cancel="cancelCurrentPayment" />
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
          <PaymentForm @submit="addPayment" />
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
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
import { formatDate, formatMoney } from '@/shared/utils/formatters';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import PaymentForm from '@/modules/payments/components/PaymentForm.vue';
import PaymentList from '@/modules/payments/components/PaymentList.vue';
import { cancelPayment, createPayment, watchLoanPayments } from '@/modules/payments/services/paymentService';
import type { Payment, PaymentInput } from '@/modules/payments/types';
import type { WithId } from '@/shared/types/audit';
import { cancelLoan, getLoan } from '../services/loanService';
import type { Loan } from '../types';

const props = defineProps<{
  id: string;
}>();

const authStore = useAuthStore();
const loan = ref<WithId<Loan> | null>(null);
const payments = ref<WithId<Payment>[]>([]);
const loading = ref(true);
const showPayment = ref(false);
const error = ref('');
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
  if (!authStore.state.user) return;
  error.value = '';
  try {
    await createPayment(props.id, input, authStore.state.user);
    await refreshLoan();
    showPayment.value = false;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to record payment.';
  }
}

async function cancelCurrentPayment(paymentId: string) {
  if (!authStore.state.user || !window.confirm('Cancel this payment and restore the loan balance?')) return;
  await cancelPayment(paymentId, authStore.state.user);
  await refreshLoan();
}

async function cancelCurrentLoan() {
  if (!authStore.state.user || !window.confirm('Cancel this loan? Payment records will remain.')) return;
  await cancelLoan(props.id, authStore.state.user);
  await refreshLoan();
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
</style>

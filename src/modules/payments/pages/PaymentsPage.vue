<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Payments</ion-title>
        <ion-buttons slot="end">
          <ion-button class="toolbar-button" fill="clear" router-link="/dashboard">Dashboard</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <div class="page-intro">
          <h1>Payments</h1>
          <p>Track applied and cancelled collections across all loans.</p>
        </div>

        <LoadingState v-if="loading" />
        <ion-text v-else-if="error" color="danger">
          <p>{{ error }}</p>
        </ion-text>
        <template v-else>
          <div class="metric-grid ion-margin-bottom">
            <div class="metric">
              <span>Collected</span>
              <strong>{{ formatCurrency(fromCents(totalCollectedCents)) }}</strong>
            </div>
            <div class="metric">
              <span>Interest Collected</span>
              <strong>{{ formatCurrency(fromCents(totalInterestCollectedCents)) }}</strong>
            </div>
            <div class="metric">
              <span>Owner Earnings</span>
              <strong>{{ formatCurrency(fromCents(totalOwnerEarningsCents)) }}</strong>
            </div>
            <div class="metric">
              <span>Assistant Earnings</span>
              <strong>{{ formatCurrency(fromCents(totalAssistantEarningsCents)) }}</strong>
            </div>
            <div class="metric">
              <span>Applied Payments</span>
              <strong>{{ appliedCount }}</strong>
            </div>
            <div class="metric">
              <span>Cancelled</span>
              <strong>{{ cancelledCount }}</strong>
            </div>
          </div>

          <EmptyState v-if="payments.length === 0" message="No payments recorded." />
          <ion-list v-else class="record-list" lines="full">
            <ion-item v-for="payment in payments" :key="payment.id" :router-link="`/loans/${payment.loanId}`" detail>
              <ion-label>
                <h2>{{ payment.borrowerName || 'Unknown borrower' }}</h2>
                <p>Loan {{ payment.loanId }}</p>
                <p>{{ formatDate(payment.paymentDate) }}</p>
              </ion-label>
              <ion-note slot="end" :color="isCancelled(payment) ? 'medium' : undefined">
                {{ formatCurrency(fromCents(payment.amountCents ?? payment.amountPaid)) }}
                <span v-if="isCancelled(payment)">cancelled</span>
              </ion-note>
            </ion-item>
          </ion-list>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { toFirebaseErrorMessage } from '@/shared/utils/firebaseErrors';
import { formatCurrency, formatDate, fromCents } from '@/shared/utils/formatters';
import type { WithId } from '@/shared/types/audit';
import type { Payment } from '../types';
import { watchPayments } from '../services/paymentService';

const payments = ref<WithId<Payment>[]>([]);
const loading = ref(true);
const error = ref('');
let stopPayments = () => {};
const authStore = useAuthStore();
const router = useRouter();

const appliedPayments = computed(() => payments.value.filter((payment) => !isCancelled(payment)));
const appliedCount = computed(() => appliedPayments.value.length);
const cancelledCount = computed(() => payments.value.length - appliedPayments.value.length);
const totalCollectedCents = computed(() =>
  appliedPayments.value.reduce((sum, payment) => sum + (payment.amountCents ?? payment.amountPaid ?? 0), 0),
);
const totalInterestCollectedCents = computed(() =>
  appliedPayments.value.reduce((sum, payment) => sum + (payment.interestCollectedCents ?? 0), 0),
);
const totalOwnerEarningsCents = computed(() =>
  appliedPayments.value.reduce((sum, payment) => sum + (payment.ownerInterestShareCents ?? 0), 0),
);
const totalAssistantEarningsCents = computed(() =>
  appliedPayments.value.reduce((sum, payment) => sum + (payment.assistantInterestShareCents ?? 0), 0),
);

onMounted(async () => {
  const user = await authStore.waitUntilReady();
  if (!user) {
    loading.value = false;
    router.replace('/login');
    return;
  }

  try {
    stopPayments = watchPayments((items) => {
      payments.value = items;
      loading.value = false;
    });
  } catch (caught) {
    error.value = toFirebaseErrorMessage(caught, 'Unable to load payments.');
    loading.value = false;
  }
});

onUnmounted(() => stopPayments());

function isCancelled(payment: Payment) {
  return payment.isCancelled === true || payment.status === 'cancelled';
}
</script>

<style scoped>
ion-note {
  display: grid;
  gap: 4px;
  justify-items: end;
  white-space: nowrap;
}

ion-note span {
  font-size: 0.75rem;
  text-transform: uppercase;
}
</style>

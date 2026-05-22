<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Payments</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/dashboard">Dashboard</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <LoadingState v-if="loading" />
        <template v-else>
          <div class="metric-grid">
            <div class="metric">
              <span>Collected</span>
              <strong>{{ formatCurrency(fromCents(totalCollectedCents)) }}</strong>
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
import { IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonNote, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { formatCurrency, formatDate, fromCents } from '@/shared/utils/formatters';
import type { WithId } from '@/shared/types/audit';
import type { Payment } from '../types';
import { watchPayments } from '../services/paymentService';

const payments = ref<WithId<Payment>[]>([]);
const loading = ref(true);
let stopPayments = () => {};

const appliedPayments = computed(() => payments.value.filter((payment) => !isCancelled(payment)));
const appliedCount = computed(() => appliedPayments.value.length);
const cancelledCount = computed(() => payments.value.length - appliedPayments.value.length);
const totalCollectedCents = computed(() =>
  appliedPayments.value.reduce((sum, payment) => sum + (payment.amountCents ?? payment.amountPaid ?? 0), 0),
);

onMounted(() => {
  stopPayments = watchPayments((items) => {
    payments.value = items;
    loading.value = false;
  });
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

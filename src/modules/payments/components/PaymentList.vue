<template>
  <EmptyState v-if="payments.length === 0" message="No payments recorded." />
  <ion-list v-else class="record-list" lines="full">
    <ion-item v-for="payment in payments" :key="payment.id">
      <ion-label>
        <h2 :class="{ cancelled: isCancelled(payment) }">
          {{ formatCurrency(fromCents(payment.amountCents ?? payment.amountPaid)) }}
        </h2>
        <p>
          {{ formatDate(payment.paymentDate) }} -
          <ion-text :color="isCancelled(payment) ? 'danger' : 'success'">
            {{ isCancelled(payment) ? 'cancelled' : 'applied' }}
          </ion-text>
        </p>
        <p v-if="payment.interestCollectedCents">
          Interest {{ formatCurrency(fromCents(payment.interestCollectedCents)) }}:
          Owner {{ formatCurrency(fromCents(payment.ownerInterestShareCents ?? 0)) }},
          Assistant {{ formatCurrency(fromCents(payment.assistantInterestShareCents ?? 0)) }}
        </p>
        <p v-if="isCancelled(payment) && payment.cancellationReason">Reason: {{ payment.cancellationReason }}</p>
        <p v-if="payment.notes">{{ payment.notes }}</p>
      </ion-label>
      <ion-button v-if="canCancel && !isCancelled(payment)" fill="outline" color="danger" @click="$emit('cancel', payment.id)">
        Cancel
      </ion-button>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import { IonButton, IonItem, IonLabel, IonList, IonText } from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import { formatCurrency, formatDate, fromCents } from '@/shared/utils/formatters';
import type { WithId } from '@/shared/types/audit';
import type { Payment } from '../types';

defineProps<{
  payments: WithId<Payment>[];
  canCancel?: boolean;
}>();

defineEmits<{
  cancel: [paymentId: string];
}>();

function isCancelled(payment: Payment) {
  return payment.isCancelled === true || payment.status === 'cancelled';
}
</script>

<style scoped>
.cancelled {
  color: var(--ion-color-medium);
  text-decoration: line-through;
}

ion-label h2 {
  font-size: 1rem;
  margin: 0 0 6px;
}

ion-label p {
  margin: 3px 0;
}
</style>

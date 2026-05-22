<template>
  <EmptyState v-if="payments.length === 0" message="No payments recorded." />
  <ion-list v-else class="record-list" lines="full">
    <ion-item v-for="payment in payments" :key="payment.id">
      <ion-label>
        <h2>{{ formatMoney(payment.amountCents) }}</h2>
        <p>{{ formatDate(payment.paymentDate) }} · {{ payment.status }}</p>
        <p v-if="payment.notes">{{ payment.notes }}</p>
      </ion-label>
      <ion-button v-if="payment.status === 'applied'" fill="clear" color="danger" @click="$emit('cancel', payment.id)">
        Cancel
      </ion-button>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import { IonButton, IonItem, IonLabel, IonList } from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import { formatDate, formatMoney } from '@/shared/utils/formatters';
import type { WithId } from '@/shared/types/audit';
import type { Payment } from '../types';

defineProps<{
  payments: WithId<Payment>[];
}>();

defineEmits<{
  cancel: [paymentId: string];
}>();
</script>

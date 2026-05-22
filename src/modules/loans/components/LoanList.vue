<template>
  <EmptyState v-if="loans.length === 0" message="No loans found." />
  <ion-list v-else class="record-list" lines="full">
    <ion-item v-for="loan in loans" :key="loan.id" :router-link="`/loans/${loan.id}`">
      <ion-label>
        <h2>{{ loan.borrowerName }}</h2>
        <p>Due {{ formatDate(loan.dueDate) }} · Remaining {{ formatMoney(loan.remainingCents) }}</p>
      </ion-label>
      <ion-badge :color="loan.status === 'paid' ? 'success' : 'primary'">{{ loan.status }}</ion-badge>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import { IonBadge, IonItem, IonLabel, IonList } from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import { formatDate, formatMoney } from '@/shared/utils/formatters';
import type { WithId } from '@/shared/types/audit';
import type { Loan } from '../types';

defineProps<{
  loans: WithId<Loan>[];
}>();
</script>

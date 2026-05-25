<template>
  <EmptyState v-if="loans.length === 0" message="No loans found." />
  <ion-list v-else class="record-list" lines="full">
    <ion-item v-for="loan in loans" :key="loan.id" :router-link="`/loans/${loan.id}`" detail>
      <ion-label>
        <h2>{{ loan.borrowerName || 'Unknown borrower' }}</h2>
        <p>Principal {{ formatCurrency(fromCents(loan.principalCents)) }} / Total {{ formatCurrency(fromCents(loan.totalDueCents)) }}</p>
        <p>Paid {{ formatCurrency(fromCents(loan.paidCents)) }} / Remaining {{ formatCurrency(fromCents(loan.remainingCents)) }}</p>
        <p>Due {{ formatDate(loan.dueDate) }}</p>
      </ion-label>
      <ion-badge :color="statusColor(getLoanStatus(loan))">{{ getLoanStatus(loan) }}</ion-badge>
    </ion-item>
  </ion-list>
</template>

<script setup lang="ts">
import { IonBadge, IonItem, IonLabel, IonList } from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import { formatCurrency, formatDate, fromCents } from '@/shared/utils/formatters';
import { getLoanStatus } from '@/shared/utils/loanCalculations';
import type { WithId } from '@/shared/types/audit';
import type { Loan, LoanStatus } from '../types';

defineProps<{
  loans: WithId<Loan>[];
}>();

function statusColor(status: LoanStatus) {
  if (status === 'paid') return 'success';
  if (status === 'overdue') return 'warning';
  if (status === 'cancelled') return 'medium';
  return 'primary';
}
</script>

<style scoped>
ion-label h2 {
  font-size: 1rem;
  margin: 0 0 6px;
}

ion-label p {
  margin: 3px 0;
}

ion-badge {
  margin-left: 10px;
}
</style>

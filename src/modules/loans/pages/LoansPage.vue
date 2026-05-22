<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Loans</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/dashboard">Dashboard</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <ion-button expand="block" router-link="/loans/new">Add Loan</ion-button>
        <ion-segment v-model="statusFilter" value="all" class="loan-filter">
          <ion-segment-button value="all">All</ion-segment-button>
          <ion-segment-button value="active">Active</ion-segment-button>
          <ion-segment-button value="paid">Paid</ion-segment-button>
          <ion-segment-button value="overdue">Overdue</ion-segment-button>
        </ion-segment>
        <LoadingState v-if="loading" />
        <LoanList v-else :loans="filteredLoans" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { getLoanStatus } from '@/shared/utils/loanCalculations';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import type { WithId } from '@/shared/types/audit';
import LoanList from '../components/LoanList.vue';
import { watchLoans } from '../services/loanService';
import type { Loan, LoanStatus } from '../types';

const authStore = useAuthStore();
const router = useRouter();
const loans = ref<WithId<Loan>[]>([]);
const loading = ref(true);
const statusFilter = ref<'all' | LoanStatus>('all');
let stopLoans = () => {};

const filteredLoans = computed(() => {
  if (statusFilter.value === 'all') return loans.value;
  return loans.value.filter((loan) => getLoanStatus(loan) === statusFilter.value);
});

onMounted(async () => {
  const user = await authStore.waitUntilReady();
  if (!user) {
    loading.value = false;
    router.replace('/login');
    return;
  }

  stopLoans = watchLoans((items) => {
    loans.value = items;
    loading.value = false;
  });
});

onUnmounted(() => {
  stopLoans();
});
</script>

<style scoped>
.loan-filter {
  margin: 12px 0;
}
</style>

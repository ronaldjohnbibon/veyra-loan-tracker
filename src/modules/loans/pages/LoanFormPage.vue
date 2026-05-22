<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/loans" />
        </ion-buttons>
        <ion-title>{{ loanId ? 'Edit Loan' : 'New Loan' }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <LoadingState v-if="loading" />
        <LoanForm
          v-else
          :borrowers="borrowers"
          :initial-borrower-id="initialBorrowerId"
          :initial-loan="loan"
          @submit="saveLoan"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { watchBorrowers } from '@/modules/borrowers/services/borrowerService';
import type { Borrower } from '@/modules/borrowers/types';
import type { WithId } from '@/shared/types/audit';
import LoanForm from '../components/LoanForm.vue';
import { createLoan, getLoan, updateLoan } from '../services/loanService';
import type { Loan, LoanInput } from '../types';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const borrowers = ref<WithId<Borrower>[]>([]);
const loan = ref<WithId<Loan> | null>(null);
const loading = ref(true);
const loanId = typeof route.params.id === 'string' ? route.params.id : undefined;
const initialBorrowerId = typeof route.query.borrowerId === 'string' ? route.query.borrowerId : undefined;
let stopBorrowers = () => {};

onMounted(async () => {
  const user = await authStore.waitUntilReady();
  if (!user) {
    router.replace('/login');
    return;
  }

  if (loanId) {
    loan.value = await getLoan(loanId);
    if (!loan.value) {
      loading.value = false;
      return;
    }
  }

  stopBorrowers = watchBorrowers((items) => {
    borrowers.value = items;
    loading.value = false;
  });
});

onUnmounted(() => stopBorrowers());

async function saveLoan(input: LoanInput) {
  if (!authStore.state.user) return;
  if (loanId) {
    await updateLoan(loanId, input, authStore.state.user);
    router.replace(`/loans/${loanId}`);
    return;
  }

  const id = await createLoan(input, authStore.state.user);
  router.replace(`/loans/${id}`);
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/loans" />
        </ion-buttons>
        <ion-title>New Loan</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <LoadingState v-if="loading" />
        <LoanForm v-else :borrowers="borrowers" @submit="saveLoan" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { watchBorrowers } from '@/modules/borrowers/services/borrowerService';
import type { Borrower } from '@/modules/borrowers/types';
import type { WithId } from '@/shared/types/audit';
import LoanForm from '../components/LoanForm.vue';
import { createLoan } from '../services/loanService';
import type { LoanInput } from '../types';

const authStore = useAuthStore();
const router = useRouter();
const borrowers = ref<WithId<Borrower>[]>([]);
const loading = ref(true);
let stopBorrowers = () => {};

onMounted(() => {
  stopBorrowers = watchBorrowers((items) => {
    borrowers.value = items;
    loading.value = false;
  });
});

onUnmounted(() => stopBorrowers());

async function saveLoan(input: LoanInput) {
  if (!authStore.state.user) return;
  await createLoan(input, authStore.state.user);
  router.replace('/loans');
}
</script>

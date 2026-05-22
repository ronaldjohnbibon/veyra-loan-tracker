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
        <LoadingState v-if="loading" />
        <LoanList v-else :loans="loans" />
      </div>

      <ion-modal :is-open="showCreate" @didDismiss="showCreate = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>New Loan</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showCreate = false">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <LoanForm :borrowers="borrowers" @submit="addLoan" />
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { watchBorrowers } from '@/modules/borrowers/services/borrowerService';
import type { Borrower } from '@/modules/borrowers/types';
import type { WithId } from '@/shared/types/audit';
import LoanForm from '../components/LoanForm.vue';
import LoanList from '../components/LoanList.vue';
import { createLoan, watchLoans } from '../services/loanService';
import type { Loan, LoanInput } from '../types';

const authStore = useAuthStore();
const router = useRouter();
const loans = ref<WithId<Loan>[]>([]);
const borrowers = ref<WithId<Borrower>[]>([]);
const loading = ref(true);
const showCreate = ref(false);
let stopLoans = () => {};
let stopBorrowers = () => {};

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
  stopBorrowers = watchBorrowers((items) => {
    borrowers.value = items;
  });
});

onUnmounted(() => {
  stopLoans();
  stopBorrowers();
});

async function addLoan(input: LoanInput) {
  if (!authStore.state.user) return;
  await createLoan(input, authStore.state.user);
  showCreate.value = false;
}
</script>

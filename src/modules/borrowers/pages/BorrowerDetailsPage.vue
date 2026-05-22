<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/borrowers" />
        </ion-buttons>
        <ion-title>{{ borrower?.name || 'Borrower' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="borrower" color="danger" @click="deleteBorrower">Delete</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <LoadingState v-if="loading" />
        <template v-else-if="borrower">
          <BorrowerForm :model-value="borrowerInput" submit-label="Update Borrower" @submit="saveBorrower" />

          <h2>Loans</h2>
          <LoanList :loans="loans" />
        </template>
        <EmptyState v-else message="Borrower not found." />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import LoanList from '@/modules/loans/components/LoanList.vue';
import { watchBorrowerLoans } from '@/modules/loans/services/loanService';
import type { Loan } from '@/modules/loans/types';
import type { WithId } from '@/shared/types/audit';
import BorrowerForm from '../components/BorrowerForm.vue';
import { getBorrower, softDeleteBorrower, updateBorrower } from '../services/borrowerService';
import type { Borrower, BorrowerInput } from '../types';

const props = defineProps<{
  id: string;
}>();

const router = useRouter();
const authStore = useAuthStore();
const borrower = ref<WithId<Borrower> | null>(null);
const loans = ref<WithId<Loan>[]>([]);
const loading = ref(true);
let stopLoans = () => {};

const borrowerInput = computed<BorrowerInput>(() => ({
  name: borrower.value?.name || '',
  phone: borrower.value?.phone || '',
  address: borrower.value?.address || '',
  notes: borrower.value?.notes || '',
}));

onMounted(async () => {
  borrower.value = await getBorrower(props.id);
  loading.value = false;
  stopLoans = watchBorrowerLoans(props.id, (items) => {
    loans.value = items;
  });
});

onUnmounted(() => stopLoans());

async function saveBorrower(input: BorrowerInput) {
  if (!authStore.state.user) return;
  await updateBorrower(props.id, input, authStore.state.user);
  borrower.value = await getBorrower(props.id);
}

async function deleteBorrower() {
  if (!authStore.state.user || !window.confirm('Soft delete this borrower? Financial records will remain.')) return;
  await softDeleteBorrower(props.id, authStore.state.user);
  router.replace('/borrowers');
}
</script>

<style scoped>
h2 {
  font-size: 1.1rem;
  margin: 24px 0 12px;
}
</style>

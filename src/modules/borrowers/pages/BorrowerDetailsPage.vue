<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/borrowers" />
        </ion-buttons>
        <ion-title>{{ borrower?.name || 'Borrower' }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="borrower" :router-link="`/borrowers/${props.id}/edit`">Edit</ion-button>
          <ion-button v-if="borrower && canDeleteBorrower" color="danger" @click="deleteBorrower">Delete</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <LoadingState v-if="loading" />
        <template v-else-if="borrower">
          <ion-list class="record-list borrower-details" lines="full">
            <ion-item>
              <ion-label>
                <span>Name</span>
                <strong>{{ borrower.name }}</strong>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <span>Contact Number</span>
                <strong>{{ borrower.contactNumber || 'Not provided' }}</strong>
              </ion-label>
            </ion-item>
            <ion-item>
              <ion-label>
                <span>Address</span>
                <strong>{{ borrower.address || 'Not provided' }}</strong>
              </ion-label>
            </ion-item>
            <ion-item v-if="borrower.notes">
              <ion-label>
                <span>Notes</span>
                <strong>{{ borrower.notes }}</strong>
              </ion-label>
            </ion-item>
          </ion-list>

          <div class="section-heading">
            <h2>Loans</h2>
            <ion-button size="small" :router-link="{ path: '/loans/new', query: { borrowerId: props.id } }">New Loan</ion-button>
          </div>
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
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import LoanList from '@/modules/loans/components/LoanList.vue';
import { watchBorrowerLoans } from '@/modules/loans/services/loanService';
import type { Loan } from '@/modules/loans/types';
import type { WithId } from '@/shared/types/audit';
import { getBorrower, softDeleteBorrower } from '../services/borrowerService';
import type { Borrower } from '../types';

const props = defineProps<{
  id: string;
}>();

const router = useRouter();
const authStore = useAuthStore();
const borrower = ref<WithId<Borrower> | null>(null);
const loans = ref<WithId<Loan>[]>([]);
const loading = ref(true);
let stopLoans = () => {};
const canDeleteBorrower = computed(() => authStore.isOwner());

onMounted(async () => {
  const user = await authStore.waitUntilReady();
  if (!user) {
    router.replace('/login');
    return;
  }

  borrower.value = await getBorrower(props.id);
  loading.value = false;
  stopLoans = watchBorrowerLoans(props.id, (items) => {
    loans.value = items;
  });
});

onUnmounted(() => stopLoans());

async function deleteBorrower() {
  if (!authStore.state.user || !canDeleteBorrower.value || !window.confirm('Soft delete this borrower? Financial records will remain.')) return;
  const reason = window.prompt('Optional delete reason') || '';
  await softDeleteBorrower(props.id, authStore.state.user, reason);
  router.replace('/borrowers');
}
</script>

<style scoped>
.section-heading {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 24px 0 12px;
}

.section-heading h2 {
  font-size: 1.1rem;
  margin: 0;
}

.borrower-details ion-label {
  display: grid;
  gap: 6px;
  white-space: normal;
}

.borrower-details span {
  color: var(--app-muted);
  font-size: 0.8rem;
}

.borrower-details strong {
  color: var(--ion-text-color);
  font-weight: 600;
}
</style>

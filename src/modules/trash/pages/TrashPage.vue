<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Deleted Data</ion-title>
        <ion-buttons slot="end">
          <ion-button class="toolbar-button" fill="clear" router-link="/settings">Settings</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <div class="page-intro">
          <h1>Deleted Data</h1>
          <p>Restore soft-deleted borrowers, loans, and payments.</p>
        </div>

        <ion-segment v-model="activeTab" class="trash-tabs">
          <ion-segment-button value="borrowers">
            <ion-label>Borrowers ({{ deletedBorrowers.length }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="loans">
            <ion-label>Loans ({{ deletedLoans.length }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="payments">
            <ion-label>Payments ({{ deletedPayments.length }})</ion-label>
          </ion-segment-button>
        </ion-segment>

        <LoadingState v-if="loading" />
        <template v-else>
          <ion-text v-if="restoreError" color="danger">
            <p class="restore-message">{{ restoreError }}</p>
          </ion-text>
          <ion-text v-if="restoreSuccess" color="success">
            <p class="restore-message">{{ restoreSuccess }}</p>
          </ion-text>

          <template v-if="activeTab === 'borrowers'">
            <EmptyState v-if="deletedBorrowers.length === 0" message="No deleted borrowers." />
            <ion-list v-else class="record-list trash-list" lines="full">
              <ion-item v-for="borrower in deletedBorrowers" :key="borrower.id">
                <ion-label>
                  <h2>{{ borrower.name }}</h2>
                  <p>{{ borrower.contactNumber || 'No contact number' }}</p>
                  <p>Deleted {{ formatDate(borrower.deletedAt) }}</p>
                  <p>Reason: {{ reasonText(borrower.deleteReason) }}</p>
                </ion-label>
                <ion-button
                  slot="end"
                  fill="outline"
                  size="small"
                  :disabled="isRestoring(`borrower:${borrower.id}`)"
                  @click="restoreBorrowerItem(borrower)"
                >
                  <ion-icon slot="start" :icon="refreshOutline" />
                  Restore
                </ion-button>
              </ion-item>
            </ion-list>
          </template>

          <template v-if="activeTab === 'loans'">
            <EmptyState v-if="deletedLoans.length === 0" message="No deleted loans." />
            <ion-list v-else class="record-list trash-list" lines="full">
              <ion-item v-for="loan in deletedLoans" :key="loan.id">
                <ion-label>
                  <h2>{{ loan.borrowerName || 'Unknown borrower' }}</h2>
                  <p>Principal {{ formatMoney(loan.principalCents ?? loan.principalAmount ?? 0) }}</p>
                  <p>Due {{ formatDate(loan.dueDate) }} &middot; Deleted {{ formatDate(loan.deletedAt) }}</p>
                  <p>Reason: {{ reasonText(loan.deleteReason) }}</p>
                </ion-label>
                <ion-button
                  slot="end"
                  fill="outline"
                  size="small"
                  :disabled="isRestoring(`loan:${loan.id}`)"
                  @click="restoreLoanItem(loan)"
                >
                  <ion-icon slot="start" :icon="refreshOutline" />
                  Restore
                </ion-button>
              </ion-item>
            </ion-list>
          </template>

          <template v-if="activeTab === 'payments'">
            <EmptyState v-if="deletedPayments.length === 0" message="No deleted payments." />
            <ion-list v-else class="record-list trash-list" lines="full">
              <ion-item v-for="payment in deletedPayments" :key="payment.id">
                <ion-label>
                  <h2>{{ payment.borrowerName || 'Unknown borrower' }}</h2>
                  <p>{{ formatMoney(payment.amountCents ?? payment.amountPaid ?? 0) }} paid {{ formatDate(payment.paymentDate) }}</p>
                  <p>Loan {{ payment.loanId }} &middot; Deleted {{ formatDate(payment.deletedAt) }}</p>
                  <p>Reason: {{ reasonText(payment.deleteReason) }}</p>
                </ion-label>
                <ion-button
                  slot="end"
                  fill="outline"
                  size="small"
                  :disabled="isRestoring(`payment:${payment.id}`)"
                  @click="restorePaymentItem(payment)"
                >
                  <ion-icon slot="start" :icon="refreshOutline" />
                  Restore
                </ion-button>
              </ion-item>
            </ion-list>
          </template>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { refreshOutline } from 'ionicons/icons';
import EmptyState from '@/shared/components/EmptyState.vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { restoreBorrower, watchDeletedBorrowers } from '@/modules/borrowers/services/borrowerService';
import { restoreLoan, watchDeletedLoans } from '@/modules/loans/services/loanService';
import { restorePayment, watchDeletedPayments } from '@/modules/payments/services/paymentService';
import { toFirebaseErrorMessage } from '@/shared/utils/firebaseErrors';
import { formatDate, formatMoney } from '@/shared/utils/formatters';
import type { WithId } from '@/shared/types/audit';
import type { Borrower } from '@/modules/borrowers/types';
import type { Loan } from '@/modules/loans/types';
import type { Payment } from '@/modules/payments/types';

type TrashTab = 'borrowers' | 'loans' | 'payments';

const authStore = useAuthStore();
const router = useRouter();
const activeTab = ref<TrashTab>('borrowers');
const deletedBorrowers = ref<WithId<Borrower>[]>([]);
const deletedLoans = ref<WithId<Loan>[]>([]);
const deletedPayments = ref<WithId<Payment>[]>([]);
const loaded = reactive({
  borrowers: false,
  loans: false,
  payments: false,
});
const restoringKey = ref('');
const restoreError = ref('');
const restoreSuccess = ref('');
let stopBorrowers = () => {};
let stopLoans = () => {};
let stopPayments = () => {};

const loading = computed(() => !loaded.borrowers || !loaded.loans || !loaded.payments);

onMounted(async () => {
  const user = await authStore.waitUntilReady();
  if (!user) {
    router.replace('/login');
    return;
  }

  if (!authStore.isOwner()) {
    router.replace('/dashboard');
    return;
  }

  // Load each trash section from deleted-only Firestore queries.
  stopBorrowers = watchDeletedBorrowers((items) => {
    deletedBorrowers.value = items;
    loaded.borrowers = true;
  });
  stopLoans = watchDeletedLoans((items) => {
    deletedLoans.value = items;
    loaded.loans = true;
  });
  stopPayments = watchDeletedPayments((items) => {
    deletedPayments.value = items;
    loaded.payments = true;
  });
});

onUnmounted(() => {
  stopBorrowers();
  stopLoans();
  stopPayments();
});

function reasonText(reason: string | null | undefined) {
  return reason?.trim() || 'No reason provided.';
}

function isRestoring(key: string) {
  return restoringKey.value === key;
}

function clearRestoreMessages() {
  restoreError.value = '';
  restoreSuccess.value = '';
}

async function restoreBorrowerItem(borrower: WithId<Borrower>) {
  if (!authStore.state.user || restoringKey.value) return;

  clearRestoreMessages();
  restoringKey.value = `borrower:${borrower.id}`;
  try {
    await restoreBorrower(borrower.id, authStore.state.user);
    restoreSuccess.value = `${borrower.name} has been restored.`;
  } catch (caught) {
    restoreError.value = toFirebaseErrorMessage(caught, 'Unable to restore borrower.');
  } finally {
    restoringKey.value = '';
  }
}

async function restoreLoanItem(loan: WithId<Loan>) {
  if (!authStore.state.user || restoringKey.value) return;

  clearRestoreMessages();
  restoringKey.value = `loan:${loan.id}`;
  try {
    await restoreLoan(loan.id, authStore.state.user);
    restoreSuccess.value = `${loan.borrowerName || 'Loan'} has been restored.`;
  } catch (caught) {
    restoreError.value = toFirebaseErrorMessage(caught, 'Unable to restore loan.');
  } finally {
    restoringKey.value = '';
  }
}

async function restorePaymentItem(payment: WithId<Payment>) {
  if (!authStore.state.user || restoringKey.value) return;

  clearRestoreMessages();
  restoringKey.value = `payment:${payment.id}`;
  try {
    await restorePayment(payment.id, authStore.state.user);
    restoreSuccess.value = `Payment for ${payment.borrowerName || 'unknown borrower'} has been restored.`;
  } catch (caught) {
    restoreError.value = toFirebaseErrorMessage(caught, 'Unable to restore payment.');
  } finally {
    restoringKey.value = '';
  }
}
</script>

<style scoped>
.trash-tabs {
  margin-bottom: 14px;
}

.restore-message {
  font-size: 0.9rem;
  line-height: 1.4;
  margin: 0 0 12px;
}

.trash-list ion-label {
  white-space: normal;
}

.trash-list ion-button {
  margin-left: 12px;
}

@media (max-width: 560px) {
  .trash-list ion-button {
    margin: 10px 0 0;
  }

  .trash-list ion-item {
    --inner-padding-end: 12px;
  }
}
</style>

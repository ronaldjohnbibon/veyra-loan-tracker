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
        <div class="page-intro">
          <h1>{{ loanId ? 'Edit Loan' : 'New Loan' }}</h1>
          <p>{{ loanId ? 'Adjust the loan details while preserving payment history.' : 'Create a loan with calculated interest and due balance.' }}</p>
        </div>

        <LoadingState v-if="loading" />
        <ion-text v-else-if="error" color="danger">
          <p>{{ error }}</p>
        </ion-text>
        <LoanForm
          v-else
          :borrowers="borrowers"
          :initial-borrower-id="initialBorrowerId"
          :initial-loan="loan"
          :available-investment-cents="availableInvestmentForLoanCents"
          @submit="saveLoan"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { watchBorrowers } from '@/modules/borrowers/services/borrowerService';
import { toFirebaseErrorMessage } from '@/shared/utils/firebaseErrors';
import { defaultFinancialSettings, loanInvestmentUsageCents, type FinancialSettings } from '@/shared/utils/financialCalculations';
import { watchFinancialSettings } from '@/modules/settings/services/financialSettingsService';
import type { Borrower } from '@/modules/borrowers/types';
import type { WithId } from '@/shared/types/audit';
import LoanForm from '../components/LoanForm.vue';
import { createLoan, getLoan, updateLoan, watchLoans } from '../services/loanService';
import type { Loan, LoanInput } from '../types';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();
const borrowers = ref<WithId<Borrower>[]>([]);
const loan = ref<WithId<Loan> | null>(null);
const loans = ref<WithId<Loan>[]>([]);
const financialSettings = ref<FinancialSettings>(defaultFinancialSettings);
const loading = ref(true);
const error = ref('');
const loanId = typeof route.params.id === 'string' ? route.params.id : undefined;
const initialBorrowerId = typeof route.query.borrowerId === 'string' ? route.query.borrowerId : undefined;
let stopBorrowers = () => {};
let stopFinancialSettings = () => {};
let stopLoans = () => {};

const availableInvestmentForLoanCents = computed(() =>
  financialSettings.value.totalInvestmentCents -
  loans.value.reduce((sum, item) => sum + loanInvestmentUsageCents(item), 0) +
  (loan.value ? loanInvestmentUsageCents(loan.value) : 0),
);

onMounted(async () => {
  const user = await authStore.waitUntilReady();
  if (!user) {
    router.replace('/login');
    return;
  }

  try {
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
    stopFinancialSettings = watchFinancialSettings((settings) => {
      financialSettings.value = settings;
    });
    stopLoans = watchLoans((items) => {
      loans.value = items;
    });
  } catch (caught) {
    error.value = toFirebaseErrorMessage(caught, 'Unable to load loan form.');
    loading.value = false;
  }
});

onUnmounted(() => {
  stopBorrowers();
  stopFinancialSettings();
  stopLoans();
});

async function saveLoan(input: LoanInput) {
  if (!authStore.state.user) return;
  error.value = '';
  try {
    if (loanId) {
      await updateLoan(loanId, input, authStore.state.user);
      router.replace(`/loans/${loanId}`);
      return;
    }

    const id = await createLoan(input, authStore.state.user);
    router.replace(`/loans/${id}`);
  } catch (caught) {
    error.value = toFirebaseErrorMessage(caught, 'Unable to save loan.');
  }
}
</script>

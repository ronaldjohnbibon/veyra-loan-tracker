<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Veyra</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="logout">Logout</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <div class="metric-grid">
          <div class="metric">
            <span>Active Loans</span>
            <strong>{{ activeLoans.length }}</strong>
          </div>
          <div class="metric">
            <span>Total Principal</span>
            <strong>{{ formatMoney(totalPrincipal) }}</strong>
          </div>
          <div class="metric">
            <span>Remaining</span>
            <strong>{{ formatMoney(totalRemaining) }}</strong>
          </div>
          <div class="metric">
            <span>Collected</span>
            <strong>{{ formatMoney(totalPaid) }}</strong>
          </div>
        </div>

        <ion-grid class="nav-grid">
          <ion-row>
            <ion-col size="6" size-md="3">
              <ion-button expand="block" router-link="/borrowers">Borrowers</ion-button>
            </ion-col>
            <ion-col size="6" size-md="3">
              <ion-button expand="block" router-link="/loans">Loans</ion-button>
            </ion-col>
            <ion-col size="6" size-md="3">
              <ion-button expand="block" router-link="/payments">Payments</ion-button>
            </ion-col>
            <ion-col size="6" size-md="3">
              <ion-button expand="block" router-link="/settings">Settings</ion-button>
            </ion-col>
          </ion-row>
        </ion-grid>

        <h2>Upcoming Due Dates</h2>
        <LoadingState v-if="loading" />
        <LoanList v-else :loans="upcomingLoans" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonButton, IonButtons, IonCol, IonContent, IonGrid, IonHeader, IonPage, IonRow, IonTitle, IonToolbar } from '@ionic/vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { formatMoney } from '@/shared/utils/formatters';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import LoanList from '@/modules/loans/components/LoanList.vue';
import { watchLoans } from '@/modules/loans/services/loanService';
import type { Loan } from '@/modules/loans/types';
import type { WithId } from '@/shared/types/audit';

const router = useRouter();
const authStore = useAuthStore();
const loans = ref<WithId<Loan>[]>([]);
const loading = ref(true);
let stop = () => {};

const activeLoans = computed(() => loans.value.filter((loan) => loan.status === 'active'));
const upcomingLoans = computed(() => activeLoans.value.slice(0, 8));
const totalPrincipal = computed(() => activeLoans.value.reduce((sum, loan) => sum + loan.principalCents, 0));
const totalRemaining = computed(() => activeLoans.value.reduce((sum, loan) => sum + loan.remainingCents, 0));
const totalPaid = computed(() => loans.value.reduce((sum, loan) => sum + loan.paidCents, 0));

onMounted(async () => {
  const user = await authStore.waitUntilReady();
  if (!user) {
    loading.value = false;
    router.replace('/login');
    return;
  }

  stop = watchLoans((items) => {
    loans.value = items;
    loading.value = false;
  });
});

onUnmounted(() => stop());

async function logout() {
  await authStore.logout();
  router.replace('/login');
}
</script>

<style scoped>
.nav-grid {
  margin: 16px 0 8px;
  padding: 0;
}

h2 {
  font-size: 1.1rem;
  margin: 20px 0 12px;
}
</style>

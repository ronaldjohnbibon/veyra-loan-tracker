<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Veyra</ion-title>
        <ion-buttons slot="end">
          <ion-button class="toolbar-button" fill="clear" @click="logout">
            <ion-icon slot="start" :icon="logOutOutline" />
            Logout
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <div class="page-intro">
          <h1>Dashboard</h1>
          <p>Monitor lending activity, upcoming collections, and overdue balances.</p>
        </div>

        <LoadingState v-if="loading" />
        <template v-else>
          <EmptyState v-if="hasNoRecords" message="No dashboard records yet." />

          <template v-else>
            <section class="summary-grid" aria-label="Dashboard summary">
              <ion-card v-for="metric in summaryCards" :key="metric.label" class="summary-card">
                <ion-card-header>
                  <ion-card-subtitle>{{ metric.label }}</ion-card-subtitle>
                  <ion-card-title>{{ metric.value }}</ion-card-title>
                </ion-card-header>
              </ion-card>
            </section>

            <ion-grid class="nav-grid">
              <ion-row>
                <ion-col size="6" size-md="3">
                  <ion-button expand="block" fill="outline" router-link="/borrowers">
                    <ion-icon slot="start" :icon="peopleOutline" />
                    Borrowers
                  </ion-button>
                </ion-col>
                <ion-col size="6" size-md="3">
                  <ion-button expand="block" fill="outline" router-link="/loans">
                    <ion-icon slot="start" :icon="cashOutline" />
                    Loans
                  </ion-button>
                </ion-col>
                <ion-col size="6" size-md="3">
                  <ion-button expand="block" fill="outline" router-link="/payments">
                    <ion-icon slot="start" :icon="cardOutline" />
                    Payments
                  </ion-button>
                </ion-col>
                <ion-col size="6" size-md="3">
                  <ion-button expand="block" fill="outline" router-link="/settings">
                    <ion-icon slot="start" :icon="settingsOutline" />
                    Settings
                  </ion-button>
                </ion-col>
              </ion-row>
            </ion-grid>

            <section class="loan-section">
              <div class="section-heading">
                <h2>Upcoming Due Loans</h2>
                <ion-note>{{ upcomingLoans.length }} open</ion-note>
              </div>
              <EmptyState v-if="upcomingLoans.length === 0" message="No upcoming due loans." />
              <ion-list v-else class="record-list" lines="full">
                <ion-item v-for="loan in upcomingLoans" :key="loan.id" :router-link="`/loans/${loan.id}`" detail>
                  <ion-label>
                    <h3>{{ loan.borrowerName || 'Unknown borrower' }}</h3>
                    <p>Due {{ formatDate(loan.dueDate) }}</p>
                    <p>
                      Remaining {{ formatCurrency(fromCents(loan.dashboardRemainingCents)) }} of
                      {{ formatCurrency(fromCents(loan.dashboardTotalPayableCents)) }}
                    </p>
                  </ion-label>
                  <ion-note slot="end">
                    <strong>{{ formatCurrency(fromCents(loan.dashboardPrincipalCents)) }}</strong>
                    <ion-badge :color="statusColor(loan.dashboardStatus)">{{ loan.dashboardStatus }}</ion-badge>
                  </ion-note>
                </ion-item>
              </ion-list>
            </section>

            <section class="loan-section">
              <div class="section-heading">
                <h2>Overdue Loans</h2>
                <ion-note color="warning">{{ overdueLoans.length }} overdue</ion-note>
              </div>
              <EmptyState v-if="overdueLoans.length === 0" message="No overdue loans." />
              <ion-list v-else class="record-list" lines="full">
                <ion-item v-for="loan in overdueLoans" :key="loan.id" :router-link="`/loans/${loan.id}`" detail>
                  <ion-label>
                    <h3>{{ loan.borrowerName || 'Unknown borrower' }}</h3>
                    <p>Due {{ formatDate(loan.dueDate) }}</p>
                    <p>
                      Remaining {{ formatCurrency(fromCents(loan.dashboardRemainingCents)) }} of
                      {{ formatCurrency(fromCents(loan.dashboardTotalPayableCents)) }}
                    </p>
                  </ion-label>
                  <ion-note slot="end">
                    <strong>{{ formatCurrency(fromCents(loan.dashboardPrincipalCents)) }}</strong>
                    <ion-badge :color="statusColor(loan.dashboardStatus)">{{ loan.dashboardStatus }}</ion-badge>
                  </ion-note>
                </ion-item>
              </ion-list>
            </section>
          </template>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { cardOutline, cashOutline, logOutOutline, peopleOutline, settingsOutline } from 'ionicons/icons';
import EmptyState from '@/shared/components/EmptyState.vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { formatCurrency, formatDate, fromCents } from '@/shared/utils/formatters';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { watchLoans } from '@/modules/loans/services/loanService';
import { watchBorrowers } from '@/modules/borrowers/services/borrowerService';
import { watchFinancialSettings } from '@/modules/settings/services/financialSettingsService';
import type { Loan } from '@/modules/loans/types';
import type { Borrower } from '@/modules/borrowers/types';
import type { WithId } from '@/shared/types/audit';
import { defaultFinancialSettings, type FinancialSettings } from '@/shared/utils/financialCalculations';
import {
  buildDashboardSummary,
  isCountedLoan,
  toDashboardLoan,
  type DashboardLoan,
} from '../services/dashboardService';

const router = useRouter();
const authStore = useAuthStore();
const loans = ref<WithId<Loan>[]>([]);
const borrowers = ref<WithId<Borrower>[]>([]);
const financialSettings = ref<FinancialSettings>(defaultFinancialSettings);
const loansLoaded = ref(false);
const borrowersLoaded = ref(false);
const settingsLoaded = ref(false);
let stopLoans = () => {};
let stopBorrowers = () => {};
let stopFinancialSettings = () => {};

const loading = computed(() => !loansLoaded.value || !borrowersLoaded.value || !settingsLoaded.value);
const activeBorrowerIds = computed(() => new Set(borrowers.value.map((borrower) => borrower.id)));
const dashboardLoans = computed(() =>
  loans.value
    .filter((loan) => loan.status !== 'cancelled')
    .filter((loan) => activeBorrowerIds.value.has(loan.borrowerId))
    .map(toDashboardLoan),
);
const countedLoans = computed(() => dashboardLoans.value.filter(isCountedLoan));
const summary = computed(() => buildDashboardSummary(dashboardLoans.value, borrowers.value.length, financialSettings.value));
const hasNoRecords = computed(() => countedLoans.value.length === 0 && borrowers.value.length === 0 && summary.value.totalInvestmentCents === 0);
const upcomingLoans = computed(() =>
  countedLoans.value
    .filter((loan) => loan.dashboardStatus === 'active')
    .sort(byDueDate)
    .slice(0, 8),
);
const overdueLoans = computed(() =>
  countedLoans.value
    .filter((loan) => loan.dashboardStatus === 'overdue')
    .sort(byDueDate)
    .slice(0, 8),
);
const summaryCards = computed(() => [
  { label: 'Total Investment', value: formatCurrency(fromCents(summary.value.totalInvestmentCents)) },
  { label: 'Used Investment', value: formatCurrency(fromCents(summary.value.usedInvestmentCents)) },
  { label: 'Remaining Investment', value: formatCurrency(fromCents(summary.value.availableInvestmentCents)) },
  { label: 'Total Money Lent', value: formatCurrency(fromCents(summary.value.totalMoneyLentCents)) },
  { label: 'Total Expected Collection', value: formatCurrency(fromCents(summary.value.totalExpectedCollectionCents)) },
  { label: 'Total Collected', value: formatCurrency(fromCents(summary.value.totalCollectedCents)) },
  { label: 'Interest Collected', value: formatCurrency(fromCents(summary.value.totalInterestCollectedCents)) },
  { label: 'Owner Earnings', value: formatCurrency(fromCents(summary.value.totalOwnerEarningsCents)) },
  { label: 'Assistant Earnings', value: formatCurrency(fromCents(summary.value.totalAssistantEarningsCents)) },
  { label: 'Total Remaining Balance', value: formatCurrency(fromCents(summary.value.totalRemainingBalanceCents)) },
  { label: 'Active Loans', value: String(summary.value.activeLoanCount) },
  { label: 'Paid Loans', value: String(summary.value.paidLoanCount) },
  { label: 'Overdue Loans', value: String(summary.value.overdueLoanCount) },
  { label: 'Borrowers', value: String(summary.value.borrowerCount) },
]);

onMounted(async () => {
  const user = await authStore.waitUntilReady();
  if (!user) {
    loansLoaded.value = true;
    borrowersLoaded.value = true;
    settingsLoaded.value = true;
    router.replace('/login');
    return;
  }

  stopLoans = watchLoans((items) => {
    loans.value = items;
    loansLoaded.value = true;
  });

  stopBorrowers = watchBorrowers((items) => {
    borrowers.value = items;
    borrowersLoaded.value = true;
  });

  stopFinancialSettings = watchFinancialSettings((settings) => {
    financialSettings.value = settings;
    settingsLoaded.value = true;
  });
});

onUnmounted(() => {
  stopLoans();
  stopBorrowers();
  stopFinancialSettings();
});

async function logout() {
  await authStore.logout();
  router.replace('/login');
}

function byDueDate(a: DashboardLoan, b: DashboardLoan) {
  return a.dueDate.localeCompare(b.dueDate);
}

function statusColor(status: DashboardLoan['dashboardStatus']) {
  if (status === 'paid') return 'success';
  if (status === 'overdue') return 'warning';
  if (status === 'cancelled') return 'medium';
  return 'primary';
}
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(172px, 1fr));
  gap: 12px;
}

.summary-card {
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow-soft);
  margin: 0;
  background: var(--app-surface);
}

.summary-card ion-card-header {
  padding: 16px;
}

.summary-card ion-card-subtitle {
  color: var(--app-muted);
  font-size: 0.78rem;
  font-weight: 750;
  letter-spacing: 0;
  text-transform: none;
}

.summary-card ion-card-title {
  color: var(--ion-text-color);
  font-size: 1.22rem;
  font-weight: 850;
  line-height: 1.25;
  margin-top: 8px;
}

.nav-grid {
  margin: 16px 0 4px;
  padding: 0;
}

ion-note {
  display: grid;
  gap: 6px;
  justify-items: end;
  white-space: nowrap;
}

ion-note ion-badge {
  width: fit-content;
}

ion-label h3 {
  font-size: 1rem;
  font-weight: 650;
  margin: 0 0 6px;
}

@media (max-width: 520px) {
  ion-note {
    justify-items: start;
    margin-top: 8px;
  }
}
</style>

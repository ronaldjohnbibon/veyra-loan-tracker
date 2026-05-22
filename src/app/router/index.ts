import { createRouter, createWebHistory } from '@ionic/vue-router';
import LoginPage from '@/modules/auth/pages/LoginPage.vue';
import DashboardPage from '@/modules/dashboard/pages/DashboardPage.vue';
import BorrowersPage from '@/modules/borrowers/pages/BorrowersPage.vue';
import BorrowerFormPage from '@/modules/borrowers/pages/BorrowerFormPage.vue';
import BorrowerDetailsPage from '@/modules/borrowers/pages/BorrowerDetailsPage.vue';
import LoansPage from '@/modules/loans/pages/LoansPage.vue';
import LoanFormPage from '@/modules/loans/pages/LoanFormPage.vue';
import LoanDetailsPage from '@/modules/loans/pages/LoanDetailsPage.vue';
import PaymentsPage from '@/modules/payments/pages/PaymentsPage.vue';
import SettingsPage from '@/modules/settings/pages/SettingsPage.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: LoginPage, meta: { public: true } },
    { path: '/dashboard', component: DashboardPage },
    { path: '/borrowers', component: BorrowersPage },
    { path: '/borrowers/new', component: BorrowerFormPage },
    { path: '/borrowers/:id', component: BorrowerDetailsPage, props: true },
    { path: '/loans', component: LoansPage },
    { path: '/loans/new', component: LoanFormPage },
    { path: '/loans/:id', component: LoanDetailsPage, props: true },
    { path: '/payments', component: PaymentsPage },
    { path: '/settings', component: SettingsPage },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const user = await authStore.waitUntilReady();

  if (!to.meta.public && !user) {
    return '/login';
  }

  if (to.path === '/login' && user) {
    return '/dashboard';
  }

  return true;
});

export default router;

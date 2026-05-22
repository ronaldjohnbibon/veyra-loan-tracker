import { createRouter, createWebHistory } from '@ionic/vue-router';
import AppLayout from '@/app/layout/AppLayout.vue';
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

const protectedRouteMeta = { requiresAuth: true };

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: LoginPage, meta: { publicOnly: true } },
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: 'dashboard', component: DashboardPage, meta: protectedRouteMeta },
        { path: 'borrowers', component: BorrowersPage, meta: protectedRouteMeta },
        { path: 'borrowers/new', component: BorrowerFormPage, meta: protectedRouteMeta },
        { path: 'borrowers/:id/edit', component: BorrowerFormPage, props: true, meta: protectedRouteMeta },
        { path: 'borrowers/:id', component: BorrowerDetailsPage, props: true, meta: protectedRouteMeta },
        { path: 'loans', component: LoansPage, meta: protectedRouteMeta },
        { path: 'loans/new', component: LoanFormPage, meta: protectedRouteMeta },
        { path: 'loans/:id/edit', component: LoanFormPage, props: true, meta: protectedRouteMeta },
        { path: 'loans/:id', component: LoanDetailsPage, props: true, meta: protectedRouteMeta },
        { path: 'payments', component: PaymentsPage, meta: protectedRouteMeta },
        { path: 'settings', component: SettingsPage, meta: protectedRouteMeta },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const user = await authStore.waitUntilReady();

  if (to.meta.requiresAuth && !user) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  if (to.meta.publicOnly && user) {
    return { path: '/dashboard' };
  }

  return true;
});

export default router;

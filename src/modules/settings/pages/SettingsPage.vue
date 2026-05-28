<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Settings</ion-title>
        <ion-buttons slot="end">
          <ion-button class="toolbar-button" fill="clear" router-link="/dashboard">Dashboard</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <div class="page-intro">
          <h1>Settings</h1>
          <p>Manage account access for this device.</p>
        </div>

        <ion-list class="settings-list" lines="full">
          <ion-item>
            <ion-label>
              <h2>{{ currentName }}</h2>
              <p>{{ currentEmail }}</p>
            </ion-label>
            <ion-note slot="end">{{ currentRole }}</ion-note>
          </ion-item>

          <ion-item>
            <ion-label>
              <h2>Account</h2>
              <p>Sign out of this device.</p>
            </ion-label>
            <ion-button slot="end" color="danger" fill="outline" :disabled="isLoggingOut" @click="logout">
              Logout
            </ion-button>
          </ion-item>
        </ion-list>

        <template v-if="isOwner">
          <div class="section-heading">
            <h2>Owner Tools</h2>
          </div>

          <ion-list class="settings-list" lines="full">
            <ion-item router-link="/trash" detail>
              <ion-label>
                <h2>Deleted Data</h2>
                <p>Review and restore soft-deleted records.</p>
              </ion-label>
              <ion-icon slot="end" :icon="trashOutline" />
            </ion-item>
          </ion-list>

          <div class="section-heading">
            <h2>Financial Tracking</h2>
          </div>

          <div class="metric-grid settings-metrics">
            <div class="metric">
              <span>Total Investment</span>
              <strong>{{ formatCurrency(fromCents(financialSettings.totalInvestmentCents)) }}</strong>
            </div>
            <div class="metric">
              <span>Used Investment</span>
              <strong>{{ formatCurrency(fromCents(usedInvestmentCents)) }}</strong>
            </div>
            <div class="metric">
              <span>Remaining Available</span>
              <strong>{{ formatCurrency(fromCents(availableInvestmentCents)) }}</strong>
            </div>
          </div>

          <form class="form-grid finance-form" @submit.prevent="saveFinancialConfig">
            <ion-list class="form-card" lines="full">
              <ion-item>
                <ion-input
                  v-model="financeForm.totalInvestment"
                  label="Total Investment"
                  label-placement="stacked"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </ion-item>
              <ion-item>
                <ion-input
                  v-model="financeForm.ownerInterestSharePercent"
                  label="Owner Share of Interest %"
                  label-placement="stacked"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                />
              </ion-item>
              <ion-item>
                <ion-input
                  v-model="financeForm.assistantInterestSharePercent"
                  label="Assistant Share of Interest %"
                  label-placement="stacked"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                />
              </ion-item>
            </ion-list>

            <ion-text v-if="financeError" color="danger">
              <p class="form-message">{{ financeError }}</p>
            </ion-text>
            <ion-text v-if="financeSuccess" color="success">
              <p class="form-message">{{ financeSuccess }}</p>
            </ion-text>

            <ion-button expand="block" type="submit" :disabled="isSavingFinance">
              <ion-spinner v-if="isSavingFinance" name="crescent" />
              <template v-else>Save Financial Settings</template>
            </ion-button>
          </form>

          <div class="section-heading">
            <h2>System Users</h2>
          </div>

          <form class="form-grid user-form" @submit.prevent="saveUser">
            <ion-list class="form-card" lines="full">
              <ion-item>
                <ion-input v-model="form.name" label="Name" label-placement="stacked" required />
              </ion-item>
              <ion-item>
                <ion-input
                  v-model="form.email"
                  label="Email"
                  label-placement="stacked"
                  type="email"
                  autocomplete="email"
                  required
                />
              </ion-item>
              <ion-item>
                <ion-input
                  v-model="form.password"
                  label="Temporary Password"
                  label-placement="stacked"
                  type="password"
                  autocomplete="new-password"
                  required
                />
              </ion-item>
              <ion-item>
                <ion-select v-model="form.role" label="Role" label-placement="stacked" interface="popover">
                  <ion-select-option v-for="role in roleOptions" :key="role.value" :value="role.value">
                    {{ role.label }}
                  </ion-select-option>
                </ion-select>
              </ion-item>
            </ion-list>

            <ion-text v-if="createError" color="danger">
              <p class="form-message">{{ createError }}</p>
            </ion-text>
            <ion-text v-if="createSuccess" color="success">
              <p class="form-message">{{ createSuccess }}</p>
            </ion-text>

            <ion-button expand="block" type="submit" :disabled="isCreatingUser">
              <ion-spinner v-if="isCreatingUser" name="crescent" />
              <template v-else>
                <ion-icon slot="start" :icon="personAddOutline" />
                <span>Create User</span>
              </template>
            </ion-button>
          </form>

          <ion-list class="settings-list user-list" lines="full">
            <ion-item v-if="usersLoading">
              <ion-label>
                <h2>Loading users</h2>
                <p>Fetching system access records.</p>
              </ion-label>
            </ion-item>
            <ion-item v-else-if="systemUsers.length === 0">
              <ion-label>
                <h2>No system users</h2>
                <p>Create a login user to grant access.</p>
              </ion-label>
            </ion-item>
            <template v-else>
              <ion-item v-for="user in systemUsers" :key="user.id">
                <ion-label>
                  <h2>{{ user.name }}</h2>
                  <p>{{ user.email }}</p>
                </ion-label>
                <ion-note slot="end">{{ roleLabel(user.role) }}</ion-note>
              </ion-item>
            </template>
          </ion-list>
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
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { personAddOutline, trashOutline } from 'ionicons/icons';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import { createSystemUser, watchSystemUsers } from '@/modules/auth/services/authService';
import { USER_ROLES, type SystemUserInput, type UserProfile, type UserRole } from '@/modules/auth/types';
import { watchLoans } from '@/modules/loans/services/loanService';
import type { Loan } from '@/modules/loans/types';
import type { WithId } from '@/shared/types/audit';
import { toFirebaseErrorMessage } from '@/shared/utils/firebaseErrors';
import { formatCurrency, fromCents } from '@/shared/utils/formatters';
import { defaultFinancialSettings, loanInvestmentUsageCents, type FinancialSettings, type FinancialSettingsInput } from '@/shared/utils/financialCalculations';
import { saveFinancialSettings, watchFinancialSettings } from '../services/financialSettingsService';

const router = useRouter();
const authStore = useAuthStore();
const isLoggingOut = ref(false);
const isCreatingUser = ref(false);
const isSavingFinance = ref(false);
const usersLoading = ref(false);
const systemUsers = ref<UserProfile[]>([]);
const financialSettings = ref<FinancialSettings>(defaultFinancialSettings);
const loans = ref<WithId<Loan>[]>([]);
const createError = ref('');
const createSuccess = ref('');
const financeError = ref('');
const financeSuccess = ref('');
const form = reactive<SystemUserInput>({
  name: '',
  email: '',
  password: '',
  role: 'assistant',
});
const financeForm = reactive<FinancialSettingsInput>({
  totalInvestment: '0',
  ownerInterestSharePercent: '100',
  assistantInterestSharePercent: '0',
});
let stopUsers = () => {};
let stopFinancialSettings = () => {};
let stopLoans = () => {};

const currentName = computed(() => authStore.state.profile?.name || authStore.state.user?.displayName || 'Signed in user');
const currentEmail = computed(() => authStore.state.profile?.email || authStore.state.user?.email || 'No email');
const currentRole = computed(() => roleLabel(authStore.state.profile?.role || 'unknown'));
const isOwner = computed(() => authStore.isOwner());
const roleOptions = USER_ROLES.map((role) => ({ value: role, label: roleLabel(role) }));
const usedInvestmentCents = computed(() => loans.value.reduce((sum, loan) => sum + loanInvestmentUsageCents(loan), 0));
const availableInvestmentCents = computed(() => financialSettings.value.totalInvestmentCents - usedInvestmentCents.value);

onMounted(async () => {
  await authStore.waitUntilReady();
  if (!isOwner.value) return;

  usersLoading.value = true;
  stopFinancialSettings = watchFinancialSettings((settings) => {
    financialSettings.value = settings;
    financeForm.totalInvestment = String(fromCents(settings.totalInvestmentCents));
    financeForm.ownerInterestSharePercent = String(settings.ownerInterestSharePercent);
    financeForm.assistantInterestSharePercent = String(settings.assistantInterestSharePercent);
  });
  stopLoans = watchLoans((items) => {
    loans.value = items;
  });
  stopUsers = watchSystemUsers((users) => {
    systemUsers.value = users;
    usersLoading.value = false;
  });
});

onUnmounted(() => {
  stopUsers();
  stopFinancialSettings();
  stopLoans();
});

function roleLabel(role: UserRole | string) {
  if (role === 'owner') return 'Owner';
  if (role === 'assistant') return 'Assistant';
  return role;
}

function resetForm() {
  form.name = '';
  form.email = '';
  form.password = '';
  form.role = 'assistant';
}

function validateUserForm() {
  if (!form.name.trim()) return 'Name is required.';
  if (!form.email.trim()) return 'Email is required.';
  if (form.password.length < 6) return 'Temporary password must be at least 6 characters.';
  return '';
}

async function saveUser() {
  if (!authStore.state.user || isCreatingUser.value) return;

  createError.value = validateUserForm();
  createSuccess.value = '';
  if (createError.value) return;

  isCreatingUser.value = true;
  try {
    await createSystemUser(form, authStore.state.user);
    createSuccess.value = `${form.name.trim()} can now sign in.`;
    resetForm();
  } catch (caught) {
    createError.value = toFirebaseErrorMessage(caught, 'Unable to create user.');
  } finally {
    isCreatingUser.value = false;
  }
}

async function saveFinancialConfig() {
  if (!authStore.state.user || isSavingFinance.value) return;

  financeError.value = '';
  financeSuccess.value = '';
  isSavingFinance.value = true;
  try {
    await saveFinancialSettings(financeForm, {
      ...financialSettings.value,
      usedInvestmentCents: usedInvestmentCents.value,
      availableInvestmentCents: availableInvestmentCents.value,
    }, authStore.state.user);
    financeSuccess.value = 'Financial settings saved.';
  } catch (caught) {
    financeError.value = toFirebaseErrorMessage(caught, 'Unable to save financial settings.');
  } finally {
    isSavingFinance.value = false;
  }
}

async function logout() {
  if (isLoggingOut.value) return;

  isLoggingOut.value = true;
  await authStore.logout();
  router.replace('/login');
}
</script>

<style scoped>
.settings-list {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow-soft);
  overflow: hidden;
}

ion-item {
  --background: transparent;
}

ion-label h2 {
  font-size: 1rem;
  font-weight: 650;
  margin: 0 0 4px;
}

ion-label p {
  color: var(--app-muted);
}

.user-form {
  margin-bottom: 16px;
}

.finance-form,
.settings-metrics {
  margin-bottom: 16px;
}

.user-list {
  margin-top: 16px;
}

.form-message {
  font-size: 0.86rem;
  line-height: 1.4;
  margin: 0;
}
</style>

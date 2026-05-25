<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Sign In</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="login-shell">
        <form class="login-panel" @submit.prevent="submit">
          <img class="brand-mark" src="/app-icon.png" alt="Veyra Loan Tracker" />
          <div class="login-copy">
            <h1>Veyra Lending</h1>
            <p>Sign in to manage borrowers, loans, payments, and balances.</p>
          </div>

          <ion-item class="input-item">
            <ion-input v-model="email" label="Email" label-placement="stacked" type="email" autocomplete="email" />
          </ion-item>
          <ion-item class="input-item">
            <ion-input
              v-model="password"
              label="Password"
              label-placement="stacked"
              type="password"
              autocomplete="current-password"
            />
          </ion-item>

          <ion-text v-if="error" color="danger">
            <p>{{ error }}</p>
          </ion-text>

          <ion-button expand="block" type="submit" :disabled="loading">
            <ion-spinner v-if="loading" name="crescent" />
            <template v-else>
              <ion-icon slot="start" :icon="logInOutline" />
              <span>Sign In</span>
            </template>
          </ion-button>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { logInOutline } from 'ionicons/icons';
import { toFirebaseErrorMessage } from '@/shared/utils/firebaseErrors';
import { useAuthStore } from '../stores/authStore';

const authStore = useAuthStore();
const router = useRouter();
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  loading.value = true;

  try {
    await authStore.login(email.value.trim(), password.value);
    router.replace('/dashboard');
  } catch (caught) {
    error.value = toFirebaseErrorMessage(caught, 'Unable to sign in. Check the email and password.');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-shell {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 28px 18px;
}

.login-panel {
  width: min(420px, 100%);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 24px;
  box-shadow: var(--app-shadow);
  display: grid;
  gap: 14px;
  padding: 28px;
}

.brand-mark {
  border-radius: 18px;
  height: 52px;
  object-fit: cover;
  width: 52px;
}

.login-copy {
  margin-bottom: 8px;
}

h1 {
  color: var(--ion-text-color);
  margin: 0 0 8px;
  font-size: 1.75rem;
  font-weight: 850;
  letter-spacing: 0;
  line-height: 1.1;
}

p {
  color: var(--app-muted);
  line-height: 1.45;
  margin: 0;
}

.input-item {
  --background: var(--app-surface-soft);
  --border-color: transparent;
  --border-radius: 14px;
  border: 1px solid var(--app-border);
  border-radius: 14px;
}

@media (max-width: 420px) {
  .login-panel {
    padding: 24px 20px;
  }
}
</style>

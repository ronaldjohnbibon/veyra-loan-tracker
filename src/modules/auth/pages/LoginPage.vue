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
          <h1>Veyra Lending</h1>
          <p>Sign in to manage borrowers, loans, payments, and balances.</p>

          <ion-item>
            <ion-input v-model="email" label="Email" label-placement="stacked" type="email" autocomplete="email" />
          </ion-item>
          <ion-item>
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
            <span v-else>Sign In</span>
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
  IonInput,
  IonItem,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
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
  } catch {
    error.value = 'Unable to sign in. Check the email and password.';
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
  padding: 20px;
}

.login-panel {
  width: min(420px, 100%);
  background: #ffffff;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 24px;
}

h1 {
  margin: 0 0 8px;
  font-size: 1.7rem;
}

p {
  color: var(--app-muted);
}
</style>

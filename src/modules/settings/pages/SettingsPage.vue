<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Settings</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/dashboard">Dashboard</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <EmptyState message="Settings for Firebase, preferences, and account options can live here." />

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
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';

const router = useRouter();
const authStore = useAuthStore();
const isLoggingOut = ref(false);
const currentName = computed(() => authStore.state.profile?.name || authStore.state.user?.displayName || 'Signed in user');
const currentEmail = computed(() => authStore.state.profile?.email || authStore.state.user?.email || 'No email');
const currentRole = computed(() => authStore.state.profile?.role || 'unknown');

async function logout() {
  if (isLoggingOut.value) return;

  isLoggingOut.value = true;
  await authStore.logout();
  router.replace('/login');
}
</script>

<style scoped>
.settings-list {
  background: transparent;
  margin-top: 18px;
}

ion-item {
  --background: #ffffff;
  --border-radius: 8px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

ion-label h2 {
  font-size: 1rem;
  font-weight: 650;
  margin: 0 0 4px;
}

ion-label p {
  color: var(--app-muted);
}
</style>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Borrowers</ion-title>
        <ion-buttons slot="end">
          <ion-button router-link="/dashboard">Dashboard</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <ion-button expand="block" router-link="/borrowers/new">Add Borrower</ion-button>

        <LoadingState v-if="loading" />
        <EmptyState v-else-if="borrowers.length === 0" message="No borrowers yet." />
        <ion-list v-else class="record-list" lines="full">
          <ion-item v-for="borrower in borrowers" :key="borrower.id" :router-link="`/borrowers/${borrower.id}`">
            <ion-label>
              <h2>{{ borrower.name }}</h2>
              <p>{{ borrower.phone || 'No phone number' }}</p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <ion-modal :is-open="showCreate" @didDismiss="showCreate = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>New Borrower</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="showCreate = false">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <BorrowerForm @submit="addBorrower" />
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import EmptyState from '@/shared/components/EmptyState.vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import type { WithId } from '@/shared/types/audit';
import BorrowerForm from '../components/BorrowerForm.vue';
import { createBorrower, watchBorrowers } from '../services/borrowerService';
import type { Borrower, BorrowerInput } from '../types';

const authStore = useAuthStore();
const router = useRouter();
const borrowers = ref<WithId<Borrower>[]>([]);
const loading = ref(true);
const showCreate = ref(false);
let stop = () => {};

onMounted(async () => {
  const user = await authStore.waitUntilReady();
  if (!user) {
    loading.value = false;
    router.replace('/login');
    return;
  }

  stop = watchBorrowers((items) => {
    borrowers.value = items;
    loading.value = false;
  });
});

onUnmounted(() => stop());

async function addBorrower(input: BorrowerInput) {
  if (!authStore.state.user) return;
  await createBorrower(input, authStore.state.user);
  showCreate.value = false;
}
</script>

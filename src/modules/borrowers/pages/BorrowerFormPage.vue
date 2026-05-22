<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/borrowers" />
        </ion-buttons>
        <ion-title>New Borrower</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <BorrowerForm submit-label="Create Borrower" @submit="saveBorrower" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import BorrowerForm from '../components/BorrowerForm.vue';
import { createBorrower } from '../services/borrowerService';
import type { BorrowerInput } from '../types';

const authStore = useAuthStore();
const router = useRouter();

async function saveBorrower(input: BorrowerInput) {
  if (!authStore.state.user) return;
  await createBorrower(input, authStore.state.user);
  router.replace('/borrowers');
}
</script>

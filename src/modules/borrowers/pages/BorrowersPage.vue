<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Borrowers</ion-title>
        <ion-buttons slot="end">
          <ion-button class="toolbar-button" fill="clear" router-link="/dashboard">Dashboard</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <div class="page-intro">
          <h1>Borrowers</h1>
          <p>Keep borrower contact details and active loan relationships organized.</p>
        </div>

        <div class="action-row">
          <ion-searchbar v-model="search" class="borrower-search" placeholder="Search borrower name" :debounce="150" />
          <ion-button router-link="/borrowers/new">
            <ion-icon slot="start" :icon="personAddOutline" />
            Add Borrower
          </ion-button>
        </div>

        <LoadingState v-if="loading" />
        <EmptyState v-else-if="filteredBorrowers.length === 0" :message="emptyMessage" />
        <ion-list v-else class="record-list" lines="full">
          <ion-item v-for="borrower in filteredBorrowers" :key="borrower.id" :router-link="`/borrowers/${borrower.id}`" detail>
            <ion-label>
              <h2>{{ borrower.name }}</h2>
              <p>{{ borrower.contactNumber || 'No contact number' }}</p>
              <p>{{ borrower.address || 'No address' }}</p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { personAddOutline } from 'ionicons/icons';
import EmptyState from '@/shared/components/EmptyState.vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import type { WithId } from '@/shared/types/audit';
import { watchBorrowers } from '../services/borrowerService';
import type { Borrower } from '../types';

const authStore = useAuthStore();
const router = useRouter();
const borrowers = ref<WithId<Borrower>[]>([]);
const loading = ref(true);
const search = ref('');
let stop = () => {};

const filteredBorrowers = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return borrowers.value;
  return borrowers.value.filter((borrower) => borrower.name.toLowerCase().includes(term));
});

const emptyMessage = computed(() => (search.value.trim() ? 'No borrowers match your search.' : 'No borrowers yet.'));

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
</script>

<style scoped>
.borrower-search {
  padding: 0;
}
</style>

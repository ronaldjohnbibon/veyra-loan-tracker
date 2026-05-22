<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/borrowers" />
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="page-content">
      <div class="content-wrap">
        <LoadingState v-if="loading" />
        <ion-text v-else-if="error" color="danger">
          <p>{{ error }}</p>
        </ion-text>
        <EmptyState v-else-if="id && !borrower" message="Borrower not found." />
        <BorrowerForm v-else :model-value="borrowerInput" :submit-label="submitLabel" @submit="saveBorrower" />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonText, IonTitle, IonToolbar } from '@ionic/vue';
import { useAuthStore } from '@/modules/auth/stores/authStore';
import EmptyState from '@/shared/components/EmptyState.vue';
import LoadingState from '@/shared/components/LoadingState.vue';
import { toFirebaseErrorMessage } from '@/shared/utils/firebaseErrors';
import type { WithId } from '@/shared/types/audit';
import BorrowerForm from '../components/BorrowerForm.vue';
import { createBorrower, getBorrower, updateBorrower } from '../services/borrowerService';
import type { Borrower, BorrowerInput } from '../types';

const props = defineProps<{
  id?: string;
}>();

const authStore = useAuthStore();
const router = useRouter();
const borrower = ref<WithId<Borrower> | null>(null);
const loading = ref(false);
const error = ref('');

const pageTitle = computed(() => (props.id ? 'Edit Borrower' : 'New Borrower'));
const submitLabel = computed(() => (props.id ? 'Update Borrower' : 'Create Borrower'));
const borrowerInput = computed<BorrowerInput | undefined>(() => {
  if (!borrower.value) return undefined;
  return {
    name: borrower.value.name,
    contactNumber: borrower.value.contactNumber,
    address: borrower.value.address,
    notes: borrower.value.notes,
  };
});

onMounted(async () => {
  const user = await authStore.waitUntilReady();
  if (!user) {
    router.replace('/login');
    return;
  }

  if (!props.id) return;
  loading.value = true;
  try {
    borrower.value = await getBorrower(props.id);
  } catch (caught) {
    error.value = toFirebaseErrorMessage(caught, 'Unable to load borrower.');
  } finally {
    loading.value = false;
  }
});

async function saveBorrower(input: BorrowerInput) {
  if (!authStore.state.user) return;
  error.value = '';
  try {
    if (props.id) {
      await updateBorrower(props.id, input, authStore.state.user);
      router.replace(`/borrowers/${props.id}`);
      return;
    }

    const borrowerId = await createBorrower(input, authStore.state.user);
    router.replace(`/borrowers/${borrowerId}`);
  } catch (caught) {
    error.value = toFirebaseErrorMessage(caught, 'Unable to save borrower.');
  }
}
</script>

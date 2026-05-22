<template>
  <form class="form-grid" @submit.prevent="submit">
    <ion-list lines="full">
      <ion-item>
        <ion-input v-model="form.name" label="Name" label-placement="stacked" required />
      </ion-item>
      <ion-text v-if="nameError" color="danger" class="field-error">{{ nameError }}</ion-text>
      <ion-item>
        <ion-input v-model="form.contactNumber" label="Contact Number" label-placement="stacked" type="tel" />
      </ion-item>
      <ion-item>
        <ion-textarea v-model="form.address" label="Address" label-placement="stacked" auto-grow />
      </ion-item>
      <ion-item>
        <ion-textarea v-model="form.notes" label="Notes" label-placement="stacked" auto-grow />
      </ion-item>
    </ion-list>

    <ion-button expand="block" type="submit">{{ submitLabel }}</ion-button>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { IonButton, IonInput, IonItem, IonList, IonText, IonTextarea } from '@ionic/vue';
import type { BorrowerInput } from '../types';

const props = withDefaults(
  defineProps<{
    modelValue?: BorrowerInput;
    submitLabel?: string;
  }>(),
  {
    submitLabel: 'Save Borrower',
  },
);

const emit = defineEmits<{
  submit: [value: BorrowerInput];
}>();

const form = reactive<BorrowerInput>({
  name: '',
  contactNumber: '',
  address: '',
  notes: '',
});
const nameError = ref('');

watch(
  () => props.modelValue,
  (value) => {
    if (!value) return;
    form.name = value.name;
    form.contactNumber = value.contactNumber;
    form.address = value.address;
    form.notes = value.notes;
  },
  { immediate: true },
);

function submit() {
  nameError.value = '';
  if (!form.name.trim()) {
    nameError.value = 'Borrower name is required.';
    return;
  }

  emit('submit', {
    name: form.name.trim(),
    contactNumber: form.contactNumber.trim(),
    address: form.address.trim(),
    notes: form.notes.trim(),
  });
}
</script>

<style scoped>
.field-error {
  display: block;
  font-size: 0.82rem;
  padding: 6px 16px 0;
}
</style>

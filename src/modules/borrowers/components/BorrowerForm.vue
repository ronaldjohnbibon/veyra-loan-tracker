<template>
  <form class="form-grid" @submit.prevent="submit">
    <ion-list lines="full">
      <ion-item>
        <ion-input v-model="form.name" label="Name" label-placement="stacked" required />
      </ion-item>
      <ion-item>
        <ion-input v-model="form.phone" label="Phone" label-placement="stacked" type="tel" />
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
import { reactive, watch } from 'vue';
import { IonButton, IonInput, IonItem, IonList, IonTextarea } from '@ionic/vue';
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
  phone: '',
  address: '',
  notes: '',
});

watch(
  () => props.modelValue,
  (value) => {
    if (!value) return;
    form.name = value.name;
    form.phone = value.phone;
    form.address = value.address;
    form.notes = value.notes;
  },
  { immediate: true },
);

function submit() {
  emit('submit', {
    name: form.name.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    notes: form.notes.trim(),
  });
}
</script>

<template>
  <form class="form-grid" @submit.prevent="submit">
    <ion-list lines="full">
      <ion-item>
        <ion-input v-model="form.amount" label="Amount" label-placement="stacked" type="number" min="0" step="0.01" required />
      </ion-item>
      <ion-item>
        <ion-input v-model="form.paymentDate" label="Payment Date" label-placement="stacked" type="date" required />
      </ion-item>
      <ion-item>
        <ion-textarea v-model="form.notes" label="Notes" label-placement="stacked" auto-grow />
      </ion-item>
    </ion-list>

    <ion-button expand="block" type="submit">Apply Payment</ion-button>
  </form>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { IonButton, IonInput, IonItem, IonList, IonTextarea } from '@ionic/vue';
import { todayInputValue } from '@/shared/utils/formatters';
import type { PaymentInput } from '../types';

const emit = defineEmits<{
  submit: [value: PaymentInput];
}>();

const form = reactive<PaymentInput>({
  amount: '',
  paymentDate: todayInputValue(),
  notes: '',
});

function submit() {
  emit('submit', {
    amount: form.amount,
    paymentDate: form.paymentDate,
    notes: form.notes.trim(),
  });

  form.amount = '';
  form.notes = '';
}
</script>

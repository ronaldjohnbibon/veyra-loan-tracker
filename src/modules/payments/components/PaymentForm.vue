<template>
  <form class="form-grid" @submit.prevent="submit">
    <ion-list lines="full">
      <ion-item>
        <ion-input
          v-model="form.amount"
          label="Amount"
          label-placement="stacked"
          type="number"
          min="0.01"
          :max="maxAmount"
          step="0.01"
          required
        />
      </ion-item>
      <ion-item>
        <ion-input v-model="form.paymentDate" label="Payment Date" label-placement="stacked" type="date" required />
      </ion-item>
      <ion-item>
        <ion-textarea v-model="form.notes" label="Notes" label-placement="stacked" auto-grow />
      </ion-item>
    </ion-list>

    <ion-text v-if="validationError" color="danger">
      <p>{{ validationError }}</p>
    </ion-text>

    <ion-button expand="block" type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Apply Payment' }}</ion-button>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { IonButton, IonInput, IonItem, IonList, IonText, IonTextarea } from '@ionic/vue';
import { todayInputValue } from '@/shared/utils/formatters';
import { canAcceptPayment, toCents } from '@/shared/utils/loanCalculations';
import type { PaymentInput } from '../types';

const props = defineProps<{
  saving?: boolean;
  maxAmountCents?: number;
}>();

const emit = defineEmits<{
  submit: [value: PaymentInput];
}>();

const form = reactive<PaymentInput>({
  amount: '',
  paymentDate: todayInputValue(),
  notes: '',
});

const validationError = ref('');
const maxAmount = computed(() => (props.maxAmountCents ? (props.maxAmountCents / 100).toFixed(2) : undefined));

function submit() {
  if (props.saving) return;
  validationError.value = '';

  const amountCents = toCents(form.amount);
  const paymentLimit = { remainingCents: props.maxAmountCents ?? Number.MAX_SAFE_INTEGER, status: 'active' } as const;
  if (!canAcceptPayment(paymentLimit, amountCents)) {
    if (amountCents > (props.maxAmountCents ?? 0)) {
      validationError.value = 'Payment cannot be more than the remaining balance.';
      return;
    }

    validationError.value = 'Payment amount must be greater than zero.';
    return;
  }

  emit('submit', {
    amount: form.amount,
    paymentDate: form.paymentDate,
    notes: form.notes.trim(),
  });
}

function reset() {
  form.amount = '';
  form.paymentDate = todayInputValue();
  form.notes = '';
  validationError.value = '';
}

defineExpose({ reset });
</script>

<template>
  <form class="form-grid" @submit.prevent="submit">
    <ion-list lines="full">
      <ion-item>
        <ion-select v-model="form.borrowerId" label="Borrower" label-placement="stacked" required>
          <ion-select-option v-for="borrower in borrowers" :key="borrower.id" :value="borrower.id">
            {{ borrower.name }}
          </ion-select-option>
        </ion-select>
      </ion-item>
      <ion-item>
        <ion-input v-model="form.principal" label="Principal" label-placement="stacked" type="number" min="0" step="0.01" required />
      </ion-item>
      <ion-item>
        <ion-input
          v-model="form.interestRatePercent"
          label="Flat Interest %"
          label-placement="stacked"
          type="number"
          min="0"
          step="0.01"
          required
        />
      </ion-item>
      <ion-item>
        <ion-input v-model="form.loanDate" label="Loan Date" label-placement="stacked" type="date" required />
      </ion-item>
      <ion-item>
        <ion-input v-model="form.dueDate" label="Due Date" label-placement="stacked" type="date" required />
      </ion-item>
      <ion-item>
        <ion-textarea v-model="form.notes" label="Notes" label-placement="stacked" auto-grow />
      </ion-item>
    </ion-list>

    <ion-button expand="block" type="submit" :disabled="borrowers.length === 0">Save Loan</ion-button>
  </form>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { IonButton, IonInput, IonItem, IonList, IonSelect, IonSelectOption, IonTextarea } from '@ionic/vue';
import { todayInputValue } from '@/shared/utils/formatters';
import type { WithId } from '@/shared/types/audit';
import type { Borrower } from '@/modules/borrowers/types';
import type { LoanInput } from '../types';

const props = defineProps<{
  borrowers: WithId<Borrower>[];
}>();

const emit = defineEmits<{
  submit: [value: LoanInput];
}>();

const form = reactive({
  borrowerId: '',
  principal: '',
  interestRatePercent: '',
  loanDate: todayInputValue(),
  dueDate: todayInputValue(),
  notes: '',
});

function submit() {
  const borrower = props.borrowers.find((item) => item.id === form.borrowerId);
  if (!borrower) return;

  emit('submit', {
    ...form,
    borrowerName: borrower.name,
  });

  form.principal = '';
  form.interestRatePercent = '';
  form.notes = '';
}
</script>

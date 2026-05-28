<template>
  <form class="form-grid" @submit.prevent="submit">
    <ion-list class="form-card" lines="full">
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

    <ion-list class="calculation-preview form-card" lines="full">
      <ion-item>
        <ion-label>Interest</ion-label>
        <ion-note slot="end">{{ formatCurrency(fromCents(preview.interestCents)) }}</ion-note>
      </ion-item>
      <ion-item>
        <ion-label>Total Payable</ion-label>
        <ion-note slot="end">{{ formatCurrency(fromCents(preview.totalDueCents)) }}</ion-note>
      </ion-item>
      <ion-item>
        <ion-label>Total Paid</ion-label>
        <ion-note slot="end">{{ formatCurrency(fromCents(preview.paidCents)) }}</ion-note>
      </ion-item>
      <ion-item>
        <ion-label>Remaining Balance</ion-label>
        <ion-note slot="end">{{ formatCurrency(fromCents(preview.remainingCents)) }}</ion-note>
      </ion-item>
      <ion-item>
        <ion-label>Status</ion-label>
        <ion-note slot="end">{{ preview.status }}</ion-note>
      </ion-item>
      <ion-item>
        <ion-label>Available Investment</ion-label>
        <ion-note slot="end">{{ formatCurrency(fromCents(availableInvestmentCents)) }}</ion-note>
      </ion-item>
    </ion-list>

    <ion-text v-if="validationError" color="danger">
      <p>{{ validationError }}</p>
    </ion-text>

    <ion-button expand="block" type="submit" :disabled="borrowers.length === 0 || !hasEnoughInvestment">Save Loan</ion-button>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { IonButton, IonInput, IonItem, IonLabel, IonList, IonNote, IonSelect, IonSelectOption, IonText, IonTextarea } from '@ionic/vue';
import { formatCurrency, fromCents, todayInputValue } from '@/shared/utils/formatters';
import { calculateLoanValues, isValidDateInput, toCents } from '@/shared/utils/loanCalculations';
import type { WithId } from '@/shared/types/audit';
import type { Borrower } from '@/modules/borrowers/types';
import type { Loan, LoanInput, LoanStatus } from '../types';

const props = defineProps<{
  borrowers: WithId<Borrower>[];
  initialBorrowerId?: string;
  initialLoan?: WithId<Loan> | null;
  availableInvestmentCents?: number;
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
  status: 'active' as LoanStatus,
  notes: '',
});
const validationError = ref('');

const preview = computed(() =>
  calculateLoanValues({
    principalCents: toCents(form.principal),
    interestRatePercent: Number(form.interestRatePercent || 0),
    paidCents: props.initialLoan?.paidCents ?? 0,
    dueDate: form.dueDate,
    currentStatus: form.status,
  }),
);
const availableInvestmentCents = computed(() => props.availableInvestmentCents ?? 0);
const hasEnoughInvestment = computed(() => toCents(form.principal) <= availableInvestmentCents.value);

watch(
  () => [props.initialLoan, props.initialBorrowerId, props.borrowers.length] as const,
  ([loan, borrowerId]) => {
    if (loan) {
      form.borrowerId = loan.borrowerId;
      form.principal = String(fromCents(loan.principalCents));
      form.interestRatePercent = String(loan.interestRatePercent);
      form.loanDate = loan.loanDate;
      form.dueDate = loan.dueDate;
      form.status = loan.status;
      form.notes = loan.notes;
      return;
    }

    if (borrowerId && !form.borrowerId && props.borrowers.some((borrower) => borrower.id === borrowerId)) {
      form.borrowerId = borrowerId;
    }
  },
  { immediate: true },
);

function submit() {
  validationError.value = '';
  const principalCents = toCents(form.principal);
  const interestRatePercent = Number(form.interestRatePercent || 0);

  if (principalCents <= 0) {
    validationError.value = 'Principal must be greater than zero.';
    return;
  }

  if (!Number.isFinite(interestRatePercent) || interestRatePercent < 0) {
    validationError.value = 'Interest rate must be zero or greater.';
    return;
  }

  if (!hasEnoughInvestment.value) {
    validationError.value = 'Available investment is insufficient for this loan.';
    return;
  }

  if (!isValidDateInput(form.loanDate) || !isValidDateInput(form.dueDate)) {
    validationError.value = 'Loan dates must be valid.';
    return;
  }

  if (form.dueDate < form.loanDate) {
    validationError.value = 'Due date cannot be before the loan date.';
    return;
  }

  const borrower = props.borrowers.find((item) => item.id === form.borrowerId);
  if (!borrower) return;

  emit('submit', {
    borrowerId: form.borrowerId,
    principal: form.principal,
    interestRatePercent: form.interestRatePercent,
    loanDate: form.loanDate,
    dueDate: form.dueDate,
    notes: form.notes,
    borrowerName: borrower.name,
  });
}
</script>

<style scoped>
.calculation-preview {
  margin: 2px 0;
}

.calculation-preview ion-note {
  color: var(--ion-text-color);
  font-weight: 750;
}
</style>

import { doc, getDoc, getDocFromCache, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/app/firebase/firebase';
import { finishFirestoreRead, finishFirestoreWrite } from '@/shared/services/offlineSyncService';
import {
  calculateAvailableInvestmentCents,
  defaultFinancialSettings,
  normalizeFinancialSettings,
  validateSharePercentages,
  type FinancialSettings,
  type FinancialSettingsInput,
} from '@/shared/utils/financialCalculations';
import { toCents } from '@/shared/utils/loanCalculations';

export const financialSettingsRef = doc(db, 'settings', 'financial');

export function watchFinancialSettings(callback: (settings: FinancialSettings) => void) {
  return onSnapshot(
    financialSettingsRef,
    (snapshot) => {
      callback(normalizeFinancialSettings(snapshot.exists() ? snapshot.data() : defaultFinancialSettings));
    },
    (error) => {
      console.error('Unable to load financial settings.', error);
      callback(defaultFinancialSettings);
    },
  );
}

export async function getFinancialSettings() {
  const snapshot = await finishFirestoreRead(getDoc(financialSettingsRef), () => getDocFromCache(financialSettingsRef));
  return normalizeFinancialSettings(snapshot.exists() ? snapshot.data() : defaultFinancialSettings);
}

export async function saveFinancialSettings(input: FinancialSettingsInput, current: FinancialSettings, user: User) {
  const totalInvestmentCents = toCents(input.totalInvestment);
  const ownerInterestSharePercent = Number(input.ownerInterestSharePercent || 0);
  const assistantInterestSharePercent = Number(input.assistantInterestSharePercent || 0);

  if (totalInvestmentCents < 0) throw new Error('Total investment cannot be negative.');
  if (totalInvestmentCents < current.usedInvestmentCents) {
    throw new Error('Total investment cannot be less than used investment.');
  }

  validateSharePercentages(ownerInterestSharePercent, assistantInterestSharePercent);

  const data = {
    totalInvestmentCents,
    usedInvestmentCents: current.usedInvestmentCents,
    availableInvestmentCents: calculateAvailableInvestmentCents(totalInvestmentCents, current.usedInvestmentCents),
    ownerInterestSharePercent,
    assistantInterestSharePercent,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  };

  await finishFirestoreWrite('Save financial settings', setDoc(financialSettingsRef, data, { merge: true }));
}

export function buildInvestmentSettingsUpdate(
  settings: FinancialSettings,
  usedInvestmentDeltaCents: number,
  user: User,
) {
  // Recomputes the stored investment balances after a loan capital change.
  const usedInvestmentCents = Math.max(0, settings.usedInvestmentCents + Math.round(usedInvestmentDeltaCents || 0));
  return {
    totalInvestmentCents: settings.totalInvestmentCents,
    usedInvestmentCents,
    availableInvestmentCents: calculateAvailableInvestmentCents(settings.totalInvestmentCents, usedInvestmentCents),
    ownerInterestSharePercent: settings.ownerInterestSharePercent,
    assistantInterestSharePercent: settings.assistantInterestSharePercent,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  };
}

export async function updateInvestmentUsage(usedInvestmentDeltaCents: number, user: User) {
  if (usedInvestmentDeltaCents === 0) return;

  const current = await getFinancialSettings();
  await finishFirestoreWrite(
    'Update investment usage',
    setDoc(financialSettingsRef, buildInvestmentSettingsUpdate(current, usedInvestmentDeltaCents, user), { merge: true }),
  );
}

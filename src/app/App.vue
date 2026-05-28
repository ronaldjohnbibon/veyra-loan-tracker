<template>
  <ion-app>
    <div v-if="showSyncBanner" class="sync-banner" :class="{ offline: !offlineSyncState.isOnline }">
      {{ syncMessage }}
    </div>
    <div v-if="showSyncOverlay" class="sync-overlay" role="status" aria-live="polite">
      <div class="sync-loader">
        <ion-spinner name="crescent" />
        <p>Syncing latest records...</p>
      </div>
    </div>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { IonApp, IonRouterOutlet, IonSpinner } from '@ionic/vue';
import { getCurrentUser } from '@/modules/auth/services/authService';
import { reconcileLoanPaymentTotals } from '@/shared/services/dataSyncService';
import {
  initializeOfflineSync,
  offlineSyncState,
  registerNetworkConnectionCheck,
  registerOnlineSync,
} from '@/shared/services/offlineSyncService';

let stopOnlineSync = () => {};
let stopNetworkConnectionCheck = () => {};
const networkCheckUrl = 'https://www.gstatic.com/generate_204';
const networkCheckTimeoutMs = 3000;

const showSyncBanner = computed(
  () => !offlineSyncState.isOnline || offlineSyncState.issueCount > 0,
);
const syncMessage = computed(() => {
  if (!offlineSyncState.isOnline) return 'Offline mode. Changes are saved on this device and will sync when you reconnect.';
  return 'Some changes need attention. Check your connection and try again.';
});
const showSyncOverlay = computed(() => offlineSyncState.isOnline && offlineSyncState.isSyncing);

async function hasRealNetworkConnection() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (typeof fetch === 'undefined' || typeof AbortController === 'undefined') return true;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), networkCheckTimeoutMs);

  try {
    // Confirm an external request can complete before reconnect sync starts.
    await fetch(`${networkCheckUrl}?ts=${Date.now()}`, {
      cache: 'no-store',
      mode: 'no-cors',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

onMounted(() => {
  stopNetworkConnectionCheck = registerNetworkConnectionCheck(hasRealNetworkConnection);
  initializeOfflineSync();
  stopOnlineSync = registerOnlineSync(async () => {
    const user = getCurrentUser();
    if (user) {
      await reconcileLoanPaymentTotals(user);
    }
  });
});

onUnmounted(() => {
  stopOnlineSync();
  stopNetworkConnectionCheck();
});
</script>

<style scoped>
.sync-banner {
  background: #fff7ed;
  border-bottom: 1px solid #fed7aa;
  color: #9a3412;
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.35;
  padding: max(env(safe-area-inset-top), 8px) 14px 8px;
  text-align: center;
  z-index: 10;
}

.sync-banner.offline {
  background: #eff6ff;
  border-bottom-color: #bfdbfe;
  color: #1d4ed8;
}

.sync-overlay {
  align-items: center;
  background: rgba(245, 247, 251, 0.86);
  backdrop-filter: blur(10px);
  display: grid;
  inset: 0;
  justify-items: center;
  padding: 24px;
  pointer-events: all;
  position: fixed;
  z-index: 10000;
}

.sync-loader {
  align-items: center;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow);
  color: var(--app-muted);
  display: grid;
  gap: 14px;
  justify-items: center;
  max-width: 320px;
  padding: 28px 24px;
  text-align: center;
  width: min(100%, 320px);
}

.sync-loader ion-spinner {
  color: var(--ion-color-primary);
  height: 34px;
  width: 34px;
}

.sync-loader p {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.35;
  margin: 0;
}

@media (prefers-color-scheme: dark) {
  .sync-overlay {
    background: rgba(15, 23, 42, 0.82);
  }
}
</style>

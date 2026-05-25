<template>
  <ion-app>
    <div v-if="showSyncBanner" class="sync-banner" :class="{ offline: !offlineSyncState.isOnline }">
      {{ syncMessage }}
    </div>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { getCurrentUser } from '@/modules/auth/services/authService';
import { reconcileLoanPaymentTotals } from '@/shared/services/dataSyncService';
import { initializeOfflineSync, offlineSyncState, registerOnlineSync } from '@/shared/services/offlineSyncService';

let stopOnlineSync = () => {};

const showSyncBanner = computed(
  () => !offlineSyncState.isOnline || offlineSyncState.isSyncing || offlineSyncState.issueCount > 0,
);
const syncMessage = computed(() => {
  if (!offlineSyncState.isOnline) return 'Offline mode. Changes are saved on this device and will sync when you reconnect.';
  if (offlineSyncState.isSyncing) return 'Syncing local changes...';
  return 'Some changes need attention. Check your connection and try again.';
});

onMounted(() => {
  initializeOfflineSync();
  stopOnlineSync = registerOnlineSync(async () => {
    const user = getCurrentUser();
    if (user) {
      await reconcileLoanPaymentTotals(user);
    }
  });
});

onUnmounted(() => stopOnlineSync());
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
</style>

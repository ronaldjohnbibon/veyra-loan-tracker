<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />

      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="dashboard" href="/dashboard">
          <ion-icon :icon="speedometerOutline" />
          <ion-label>Dashboard</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="borrowers" href="/borrowers">
          <ion-icon :icon="peopleOutline" />
          <ion-label>Borrowers</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="loans" href="/loans">
          <ion-icon :icon="cashOutline" />
          <ion-label>Loans</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="payments" href="/payments">
          <ion-icon :icon="cardOutline" />
          <ion-label>Payments</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="settings" href="/settings">
          <ion-icon :icon="settingsOutline" />
          <ion-label>Settings</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { cashOutline, cardOutline, peopleOutline, settingsOutline, speedometerOutline } from 'ionicons/icons';
import { IonIcon, IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue';
</script>

<style scoped>
ion-tab-bar {
  --background: var(--ion-toolbar-background);
  border-top: 1px solid var(--app-border);
  box-shadow: 0 -12px 28px rgba(15, 23, 42, 0.06);
  min-height: 66px;
  padding-bottom: max(env(safe-area-inset-bottom), 6px);
  padding-top: 5px;
}

ion-tab-button {
  --color: var(--app-muted);
  --color-selected: var(--ion-color-primary);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0;
}

ion-icon {
  font-size: 1.32rem;
  margin-bottom: 2px;
}
</style>

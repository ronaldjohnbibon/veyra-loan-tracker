<template>
  <div class="loading-state" role="status" aria-live="polite">
    <ion-spinner name="crescent" />
    <p>Loading latest records...</p>
  </div>
</template>

<script setup lang="ts">
import { IonSpinner } from '@ionic/vue';
</script>

<style scoped>
.loading-state {
  align-items: center;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow-soft);
  color: var(--app-muted);
  display: grid;
  gap: 12px;
  justify-items: center;
  margin: 10px 0;
  padding: 34px 18px;
  text-align: center;
}

p {
  font-size: 0.9rem;
  margin: 0;
}
</style>

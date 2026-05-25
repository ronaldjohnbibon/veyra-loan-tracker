<template>
  <div class="empty-state">
    <ion-icon :icon="documentTextOutline" aria-hidden="true" />
    <p>{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import { documentTextOutline } from 'ionicons/icons';

defineProps<{
  message: string;
}>();
</script>

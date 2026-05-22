<template>
  <ion-page>
    <ion-content class="page-content">
      <slot />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
</script>

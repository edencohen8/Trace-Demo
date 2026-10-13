<script setup>
import LensOverview from './LensOverview.vue';
import LensTimeline from './LensTimeline.vue';
import EvidenceInspector from './EvidenceInspector.vue';
</script>
<template>
  <div class="lens-variant variant-1">
    <LensOverview mode="line"/>
    <LensTimeline mode="unified"/>
    <EvidenceInspector mode="split"/>
  </div>
</template>
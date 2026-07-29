<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="transactions-page">
    <h1>Transactions</h1>
    <p class="subtitle">Upload a bank statement to import transactions.</p>

    <RouterLink to="/transactions/upload" class="upload-button">Upload</RouterLink>
  </div>
</template>

<style scoped>
.transactions-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.transactions-page h1 {
  margin: 0 0 4px;
}

.subtitle {
  margin: 0 0 24px;
  color: var(--text);
}

.upload-button {
  display: inline-block;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 500;
  text-decoration: none;
}

.upload-button:hover,
.upload-button:focus-visible {
  filter: brightness(0.94);
}
</style>

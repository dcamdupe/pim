<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <header class="navbar">
    <RouterLink to="/dashboard" class="logo">
      <span class="mark">P</span>
      Pim
    </RouterLink>

    <div class="spacer"></div>

    <RouterLink to="/settings" class="icon-btn" title="Settings" aria-label="Settings">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 2v3M12 19v3M22 12h-3M5 12H2M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12M19.07 19.07l-2.12-2.12M7.05 7.05 4.93 4.93"
        />
      </svg>
    </RouterLink>

    <div class="profile" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    </div>
  </header>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 18px;
  color: var(--text-h);
  text-decoration: none;
}

.logo .mark {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
}

.spacer {
  flex: 1;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: var(--text);
  text-decoration: none;
}

.icon-btn:hover,
.icon-btn:focus-visible {
  background: var(--border);
  color: var(--text-h);
}

.profile {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--border);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

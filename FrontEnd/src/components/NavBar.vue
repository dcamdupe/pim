<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

function onLogout() {
  authStore.clearToken()
  router.push('/login')
}
</script>

<template>
  <header class="navbar">
    <RouterLink to="/dashboard" class="logo">
      <span class="mark">P</span>
      Pim
    </RouterLink>

    <nav class="tabs">
      <RouterLink to="/dashboard" class="tab">Dashboard</RouterLink>
      <RouterLink to="/transactions" class="tab">Transactions</RouterLink>
    </nav>

    <div class="spacer"></div>

    <RouterLink to="/settings" class="icon-btn" title="Settings" aria-label="Settings">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="12" cy="12" r="6.2" />
        <circle cx="12" cy="12" r="2.2" />
        <g fill="currentColor" stroke="none">
          <rect x="10.7" y="1.3" width="2.6" height="4.2" rx="1" />
          <rect x="10.7" y="1.3" width="2.6" height="4.2" rx="1" transform="rotate(45 12 12)" />
          <rect x="10.7" y="1.3" width="2.6" height="4.2" rx="1" transform="rotate(90 12 12)" />
          <rect x="10.7" y="1.3" width="2.6" height="4.2" rx="1" transform="rotate(135 12 12)" />
          <rect x="10.7" y="1.3" width="2.6" height="4.2" rx="1" transform="rotate(180 12 12)" />
          <rect x="10.7" y="1.3" width="2.6" height="4.2" rx="1" transform="rotate(225 12 12)" />
          <rect x="10.7" y="1.3" width="2.6" height="4.2" rx="1" transform="rotate(270 12 12)" />
          <rect x="10.7" y="1.3" width="2.6" height="4.2" rx="1" transform="rotate(315 12 12)" />
        </g>
      </svg>
    </RouterLink>

    <div class="profile-wrap">
      <button type="button" class="profile" aria-haspopup="menu" aria-label="Account menu">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      </button>

      <div class="menu" role="menu">
        <button type="button" class="menu-item" role="menuitem" @click="onLogout">Logout</button>
      </div>
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

.tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--page-bg);
  border-radius: 12px;
}

.tab {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  text-decoration: none;
}

.tab:hover,
.tab:focus-visible {
  color: var(--text-h);
}

.tab.router-link-active {
  background: var(--bg);
  color: var(--text-h);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
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

.profile-wrap {
  position: relative;
}

.profile {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--border);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile:hover,
.profile:focus-visible {
  color: var(--text-h);
  filter: none;
}

.menu {
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 140px;
  padding: 6px;
  margin-top: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.12s ease;
}

/* Bridges the visual gap above so hover doesn't drop between the avatar and the menu. */
.menu::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  height: 8px;
}

.profile-wrap:hover .menu,
.profile-wrap:focus-within .menu {
  opacity: 1;
  visibility: visible;
}

.menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-h);
  font-size: 14px;
}

.menu-item:hover,
.menu-item:focus-visible {
  background: var(--field-bg);
  filter: none;
}
</style>

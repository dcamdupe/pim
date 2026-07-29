import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import SettingsView from '../views/SettingsView.vue'
import TransactionsView from '../views/TransactionsView.vue'
import TransactionUploadView from '../views/TransactionUploadView.vue'
import { useAuthStore } from '../stores/auth'
import { resolveNavigation } from './guard'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/transactions',
      name: 'transactions',
      component: TransactionsView,
    },
    {
      path: '/transactions/upload',
      name: 'transactionUpload',
      component: TransactionUploadView,
    },
  ],
})

router.beforeEach((to) => resolveNavigation(to.name, useAuthStore().isAuthenticated))

export default router

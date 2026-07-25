import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)

  function setToken(value: string) {
    token.value = value
  }

  return { token, setToken }
})

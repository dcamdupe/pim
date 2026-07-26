<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../services/authService'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const emailInput = ref<HTMLInputElement | null>(null)
const emailError = ref('')
const passwordError = ref('')
const formError = ref('')
const isSubmitting = ref(false)

function validate(): boolean {
  if (!email.value.trim()) {
    emailError.value = 'Email is required.'
  } else if (!emailInput.value?.validity.valid) {
    emailError.value = 'Enter a valid email address.'
  } else {
    emailError.value = ''
  }
  passwordError.value = password.value ? '' : 'Password is required.'
  return !emailError.value && !passwordError.value
}

async function onSubmit() {
  formError.value = ''
  if (!validate()) {
    return
  }

  isSubmitting.value = true
  try {
    const token = await login(email.value, password.value)
    authStore.setToken(token)
    router.push('/dashboard')
  } catch {
    formError.value = 'Invalid login or password.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-form" novalidate @submit.prevent="onSubmit">
      <h1>Log in</h1>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" ref="emailInput" v-model="email" type="email" autocomplete="email" />
        <p v-if="emailError" class="field-error">{{ emailError }}</p>
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" />
        <p v-if="passwordError" class="field-error">{{ passwordError }}</p>
      </div>

      <p v-if="formError" class="form-error">{{ formError }}</p>

      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Logging in…' : 'Log in' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 320px;
  max-width: 100%;
  padding: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.login-form h1 {
  margin: 0;
  font-size: 24px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

label {
  font-size: 14px;
  color: var(--text-h);
}

input {
  font: inherit;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text-h);
}

.field-error,
.form-error {
  margin: 0;
  font-size: 13px;
  color: #d33;
}

button {
  font: inherit;
  padding: 10px;
  border: none;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>

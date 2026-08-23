<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login } from '../services/authService'
import { beginGoogleLogin } from '../services/auth/cognitoAuthService'
import { warmCachesAfterLogin } from '../services/auth/postLogin'
import { authProvider } from '../config/auth'
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
    warmCachesAfterLogin()
    router.push('/dashboard')
  } catch {
    formError.value = 'Invalid login or password.'
  } finally {
    isSubmitting.value = false
  }
}

async function onGoogleLogin() {
  formError.value = ''
  isSubmitting.value = true
  try {
    // Navigates away to the Hosted UI - isSubmitting/formError never get to matter beyond a
    // failure to even start the redirect (e.g. a Web Crypto API issue).
    await beginGoogleLogin()
  } catch {
    formError.value = 'Could not start sign-in. Please try again.'
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div v-if="authProvider === 'cognito'" class="login-form">
      <h1>Log in</h1>
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <button type="button" class="google-btn" :disabled="isSubmitting" @click="onGoogleLogin">
        <svg class="google-btn-icon" viewBox="0 0 20 20" aria-hidden="true">
          <path fill="#4285F4" d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z" />
          <path fill="#34A853" d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45c-.87.59-2 .94-3.46.94-2.66 0-4.92-1.79-5.73-4.2H1.02v2.53A9.99 9.99 0 0010 20z" />
          <path fill="#FBBC05" d="M4.27 11.87A5.99 5.99 0 013.96 10c0-.65.11-1.29.31-1.87V5.6H1.02A9.99 9.99 0 000 10c0 1.61.39 3.14 1.02 4.4l3.25-2.53z" />
          <path fill="#EA4335" d="M10 3.96c1.47 0 2.79.51 3.83 1.5l2.87-2.87C14.95.99 12.7 0 10 0 6.09 0 2.7 2.24 1.02 5.6l3.25 2.53C5.08 5.73 7.34 3.96 10 3.96z" />
        </svg>
        <span>{{ isSubmitting ? 'Redirecting…' : 'Sign in with Google' }}</span>
      </button>
    </div>

    <form v-else class="login-form" novalidate @submit.prevent="onSubmit">
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

.field-error,
.form-error {
  margin: 0;
  font-size: 13px;
  color: #d33;
}

button {
  width: 100%;
}

/* Google's standard "Sign in with Google" branded button spec. */
.google-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 40px;
  background: #fff;
  border: 1px solid #747775;
  border-radius: 4px;
  font-family: Roboto, arial, sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #1f1f1f;
  cursor: pointer;
}

.google-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.google-btn-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
</style>

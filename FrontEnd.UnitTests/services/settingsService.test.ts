import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getSettings, saveSettings, SettingsRequestFailedError } from '../../FrontEnd/src/services/settingsService'
import { useAuthStore } from '../../FrontEnd/src/stores/auth'

describe('settingsService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().token = 'a-jwt'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getSettings', () => {
    it('fetches /settings with the bearer token and returns the accounts and minTransactionDate', async () => {
      const accounts = [{ name: 'Everyday', number: '123456', type: 'Transaction' }]
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accounts, minTransactionDate: '2026-06-10' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await getSettings()

      expect(result).toEqual({ accounts, minTransactionDate: '2026-06-10' })
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/settings$/),
        expect.objectContaining({ headers: { Authorization: 'Bearer a-jwt' } }),
      )
    })

    it('throws SettingsRequestFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(getSettings()).rejects.toBeInstanceOf(SettingsRequestFailedError)
    })
  })

  describe('saveSettings', () => {
    it('PUTs the accounts with the bearer token', async () => {
      const accounts = [{ name: 'Everyday', number: '123456', type: 'Transaction' as const }]
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await saveSettings(accounts)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/settings$/),
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a-jwt' },
          body: JSON.stringify({ accounts }),
        }),
      )
    })

    it('throws SettingsRequestFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(saveSettings([])).rejects.toBeInstanceOf(SettingsRequestFailedError)
    })
  })
})

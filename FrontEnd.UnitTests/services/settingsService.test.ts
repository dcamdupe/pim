import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  getSettings,
  saveSettings,
  deleteAccount,
  addCategory,
  deleteCategory,
  SettingsRequestFailedError,
} from '../../FrontEnd/src/services/settingsService'
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
    it('fetches /settings with the bearer token and returns the accounts, categories and minTransactionDate', async () => {
      const accounts = [{ name: 'Everyday', number: '123456', type: 'Transaction' }]
      const categories = [{ name: 'Groceries', colour: '#00ff00' }]
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accounts, categories, minTransactionDate: '2026-06-10' }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await getSettings()

      expect(result).toEqual({ accounts, categories, minTransactionDate: '2026-06-10' })
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

  describe('deleteAccount', () => {
    it('DELETEs the account with the bearer token', async () => {
      const account = { name: 'Everyday', number: '123456', type: 'Transaction' as const }
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await deleteAccount(account)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/settings\/account$/),
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a-jwt' },
          body: JSON.stringify(account),
        }),
      )
    })

    it('throws SettingsRequestFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(deleteAccount({ name: 'Everyday', number: '123456', type: 'Transaction' })).rejects.toBeInstanceOf(
        SettingsRequestFailedError,
      )
    })
  })

  describe('addCategory', () => {
    it('POSTs the category with the bearer token', async () => {
      const category = { name: 'Groceries', colour: '#00ff00' }
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await addCategory(category)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/settings\/category$/),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a-jwt' },
          body: JSON.stringify(category),
        }),
      )
    })

    it('throws SettingsRequestFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(addCategory({ name: 'Groceries', colour: '#00ff00' })).rejects.toBeInstanceOf(SettingsRequestFailedError)
    })
  })

  describe('deleteCategory', () => {
    it('DELETEs the category with the bearer token', async () => {
      const category = { name: 'Groceries', colour: '#00ff00' }
      const fetchMock = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', fetchMock)

      await deleteCategory(category)

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/settings\/category$/),
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a-jwt' },
          body: JSON.stringify(category),
        }),
      )
    })

    it('throws SettingsRequestFailedError when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      await expect(deleteCategory({ name: 'Groceries', colour: '#00ff00' })).rejects.toBeInstanceOf(SettingsRequestFailedError)
    })
  })
})

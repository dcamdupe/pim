import { refreshTransactionDescriptions } from '../transactionDescriptionsService'
import { useSettingsStore } from '../../stores/settings'

// Shared by both login paths (local email/password and Cognito's Hosted UI callback) - best-effort
// cache warm, a failure here shouldn't block getting into the app. A forced refresh(), not load() -
// the settings/transactions storage keys aren't scoped per-user, so a stale cache left behind by a
// previous session in this browser must not be trusted just because it exists.
export function warmCachesAfterLogin(): void {
  void refreshTransactionDescriptions().catch(() => {})
  void useSettingsStore().refresh().catch(() => {})
}

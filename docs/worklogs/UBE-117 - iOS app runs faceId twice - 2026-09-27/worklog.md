# UBE-117 - Why does the iOS app run faceId twice

- Linear: https://linear.app/uberconcept/issue/UBE-117/why-does-the-ios-app-run-faceid-twice
- Branch: `UBE-117/ios-app-runs-faceid-twice`
- Status: Todo

## Description

On launch with a stored refresh token, the iOS app shows the Face ID prompt twice instead of once.
The Linear issue has no further description. Biometric unlock was added in UBE-105.

Relevant code:
- `iosApp/iosApp/Views/LoginView.swift` - auto-unlocks in `.task` when `state == .locked`.
- `iosApp/iosApp/Services/SessionController.swift` - `unlock()` reads the refresh token from the
  Keychain (triggers Face ID), then refreshes the Cognito session.
- `iosApp/iosApp/Services/KeychainStore.swift` - `read` (biometric-gated), `contains` (attributes-only
  query, meant not to prompt).
- `iosApp/iosApp/Services/BiometricAuth.swift` - `canEvaluatePolicy` availability check.

Candidate causes (to confirm, not yet verified):
1. `LoginView.task` running more than once (view re-created/re-appearing, e.g. around the system
   Face ID sheet taking the scene inactive), with `unlock()` being re-entered after the first
   completes.
2. `KeychainStore.contains` prompting - an attributes query on a `.biometryCurrentSet` item has no
   `kSecUseAuthenticationUI` skip / non-interactive `LAContext`, so it may authenticate at init.
3. The synchronous `SecItemCopyMatching` in `read` running on the main actor, so the `isAuthenticating`
   guard and UI don't behave as expected.
4. A second prompt after unlock (e.g. Cognito refresh failing with a non-`refreshFailed` error, or a
   second Keychain read elsewhere).

## Plan

1. Reproduce on a device and add temporary logging (`os.Logger`) around `SessionController.init`,
   `KeychainStore.contains`/`read`, `unlock()` entry/exit and `LoginView.task` to see which call
   triggers each prompt.
2. Fix the confirmed cause, e.g.:
   - make `contains` explicitly non-interactive (`LAContext` with `interactionNotAllowed = true`),
     and/or
   - ensure the auto-unlock runs only once per launch (a flag on `SessionController` rather than
     relying on `.task` lifetime), and/or
   - move the blocking Keychain read off the main actor.
3. Remove temporary logging, keep only the fix.
4. Verify on device: cold launch → single Face ID prompt → signed in; cancel → stays locked with no
   second prompt; "Unlock with Face ID" button still works after cancel.
5. Build the iOS app to confirm no warnings/errors.

## Checklist

- [x] Create branch and worklog
- [x] Confirm plan with user
- [x] Reproduce and log which call(s) trigger each Face ID prompt
  - [x] Add temporary `os.Logger` logging (subsystem `com.uberconcept.pim`, category `auth`) - builds clean
  - [x] User runs on device and shares log output
- [x] Identify root cause and record it here
  - Only one Keychain read (status 0) per launch, but it ran on the main thread *before the scene
    became active* (all scenePhase changes were delivered after the read returned). Working theory:
    requesting biometrics before the app is active makes iOS show Face ID twice.
  - **Disproven** (Prompt 7): with the read deferred until active and off the main thread, the double
    prompt still happens. The app still does exactly one Keychain read / one biometric request per
    launch, so the second prompt is likely not coming from app code.
  - New lead (Prompt 8): no iOS app lock, and the first prompt appears *before* the login screen -
    i.e. during `SessionController.init`. `KeychainStore.contains`'s attributes-only query had no
    non-interactive context, so it can trigger the item's biometric prompt (blocking until done,
    then returning 0). Fix: pass an `LAContext` with `interactionNotAllowed = true` (candidate 2).
  - **Confirmed** (Prompt 9): `contains` now returns -25308 (`errSecInteractionNotAllowed`) without
    prompting; single Face ID prompt on device.
- [x] Implement fix
  - Root-cause fix: `KeychainStore.contains` uses a non-interactive `LAContext`.
  - `LoginView`: replaced `.task` auto-unlock with a trigger on `scenePhase == .active` (onAppear +
    onChange), via an unstructured `Task` so the prompt's own inactive/active can't cancel it.
  - `SessionController.autoUnlockIfNeeded()`: once-per-launch guard.
  - `SessionController.unlock()`: Keychain read moved to `Task.detached` (off the main thread).
- [x] Remove temporary logging
- [x] Build iOS app cleanly
- [ ] Verify on device (single prompt, cancel, manual unlock)
  - [x] Single prompt (Prompt 9)
  - [ ] Cancel stays locked, no second prompt
  - [ ] Manual "Unlock with Face ID" after cancel
- [x] Untrack committed Xcode xcuserdata files (`git rm --cached`)
- [x] Commit (after approval)

## Log

### Prompt 1
> start a worklog for UBE-117

**Response:** Fetched UBE-117 from Linear (no description), reviewed the iOS biometric unlock code
from UBE-105, created branch `UBE-117/ios-app-runs-faceid-twice` off `main` and this worklog with
candidate causes and a plan. Asked user to confirm the plan before starting.

### Prompt 2
> yes, go ahead

**Response:** Added temporary logging (marked `UBE-117 temp`) to `SessionController` (init, unlock
entry/steps/failure), `KeychainStore` (`read`/`contains` start + OSStatus) and `LoginView`
(onAppear/onDisappear, scenePhase, `.task`, unlock button tap). Simulator build succeeds. Face ID
can't be exercised from here, so asked the user to run on device and share the `auth` log output.

### Prompt 3
> just ran the app

**Response:** No log output included yet - asked the user to paste the `[auth]` console lines.

### Prompt 4
> I see nothing in the console

**Response:** Likely cause: relaunching from the home screen detaches Xcode's debugger, so the
cold-launch logs never reach Xcode's console. Suggested scheme "Wait for the executable to be
launched" or streaming the device in Console.app.

### Prompt 5
> (pasted log) contains status=0 -> init state=locked -> LoginView onAppear -> .task isLocked=true ->
> unlock() called -> KeychainStore.read start main=true (log ends here)

**Response:** Findings so far: `contains` doesn't prompt (candidate 2 ruled out); `.task`/`unlock()`
ran once (candidate 1 not seen); the Keychain read runs on the main thread and no further lines
(no `read status`, no `scenePhase` changes) were logged, i.e. the main thread is blocked during the
prompt (candidate 3 likely). Asked whether the log continued after Face ID completed and how the two
prompts looked.

### Prompt 6
> Ran this again. Full logs: (contains status=0 -> init locked -> onAppear -> .task -> unlock() ->
> read start main=true -> read status=0 -> refreshing -> scenePhase active/inactive/active ->
> refresh ok -> signedIn -> onDisappear)

**Response:** One read only, but it ran (blocking the main thread) before the scene was active.
Implemented fix: auto-unlock deferred until `scenePhase == .active` (once per launch) and the
Keychain read moved off the main thread. Kept diagnostic logging for the verification run.
Simulator build succeeds. Asked user to re-test on device.

### Prompt 7
> ran this again. The double login happened again: (onAppear scenePhase=inactive -> active ->
> unlock() -> read start main=false -> inactive -> read status=0 -> active -> signedIn)

**Response:** Fix didn't help - theory disproven. Logs show one biometric request per launch and a
single inactive period. Suspect the other prompt is outside the app's code: iOS 18 "Require Face ID"
app lock on the PIM icon, or a failed first Face ID attempt retrying within the same prompt. Asked
the user when the first prompt appears and whether "Require Face ID" is enabled for PIM.

### Prompt 8
> "Don't Require Face Id" does not appear on a long press. The first face id appears before the
> login screen, but the login screen loads behind it while it's completing

**Response:** First prompt happens before any UI, so it's `KeychainStore.contains` in
`SessionController.init` - the attributes query still invokes the biometric access control. Made it
non-interactive (`LAContext.interactionNotAllowed = true`; `errSecInteractionNotAllowed` already
treated as "exists"). Simulator build succeeds. Asked user to re-test on device.

### Prompt 9
> It looks like it's fixed. These are the logs: (contains status=-25308 -> ... -> single read -> signedIn)

**Response:** Confirmed root cause (`contains` prompting). Removed all temporary logging, corrected
the `autoUnlockIfNeeded` comment, simulator build succeeds. Kept the deferred auto-unlock and
off-main Keychain read (tested config; no UI freeze during the prompt). Asked user to check the cancel
and manual-unlock cases and approve a commit.

### Prompt 10
> why is ".../UserInterfaceState.xcuserstate" still turning up in commits? We fixed the .gitignore file

**Response:** The `.gitignore` rule matches (line 64), but `.gitignore` only affects untracked files.
Two xcuserdata files were committed before the rule existed (0af6af6, a950b76), so git still tracks
them. Fix: `git rm --cached` both files (keeps them on disk). Awaiting approval.

### Prompt 11
> yes, run it and include it in the commit

**Response:** Untracked both xcuserdata files (kept on disk, now covered by `.gitignore`) and
committed them with the Face ID fix and this worklog. Cancel / manual-unlock device checks are still
open.

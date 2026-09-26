# UBE-115 - Update npm for downloader

Linear: https://linear.app/uberconcept/issue/UBE-115/update-npm-for-downloader
Branch: `UBE-115/update-npm-for-downloader`

## Description

The FileDownloader logs: `New major version of npm available! 11.16.0 -> 12.1.0`. Update npm used
by the downloader to 12.x so the notice goes away and the downloader runs on the current npm major.

## Plan

1. Confirm where the notice comes from - the Docker image (`mcr.microsoft.com/playwright:v1.62.1-noble`
   ships Node + npm 11) and/or the local dev machine.
2. In `FileDownloader/Dockerfile`, upgrade npm to 12.x before `npm ci`
   (`RUN npm install -g npm@12`), pinned to a major to keep builds reproducible.
3. Regenerate `FileDownloader/package-lock.json` with npm 12 locally if the lockfile format changes,
   so `npm ci` in the image doesn't complain.
4. Build the image locally (arm64, as per `build-and-deploy-pi.sh`) and confirm `npm ci` and
   `npx camoufox-js fetch` succeed and the notice is gone.
5. Update the local dev machine's npm (`npm install -g npm@12`) if the notice also appears there.

## Checklist

- [x] Identify where the npm notice is logged (image vs local) - image: base image ships node 24.18.1 / npm 11.16.0; local is npm 10.9.8 (no notice)
- [x] Upgrade npm to 12.x in `FileDownloader/Dockerfile`
- [x] Regenerate `package-lock.json` with npm 12 (if needed) - not needed, `npm ci` succeeds with existing lockfile (v3)
- [x] Build the Docker image and verify `npm ci` / camoufox fetch succeed
- [x] Verify the npm update notice no longer appears - image now npm 12.1.0; npm 12 instead logs `npm notice run ...` lines for npx
- [x] Update local npm (if needed) - not needed, local npm 10.9.8 shows no notice

## Notes

- Uncommitted local debug edits to `FileDownloader/download.ts` (Westpac/TMBank disabled) and
  `FileDownloader/downloaders/amex.ts` (headless: false) were carried over from the UBE-114 branch -
  not part of this change. They have since been removed from the working tree (not by Claude).

## Session log

**Prompt:** start a worklog for UBE-115

**Response:** Fetched UBE-115 from Linear, created branch `UBE-115/update-npm-for-downloader` off
`main`, and created this worklog. Awaiting confirmation of the plan before starting work.

**Prompt:** start

**Response:** Confirmed the notice comes from the Docker base image (`playwright:v1.62.1-noble`,
node 24.18.1 / npm 11.16.0); local npm is 10.9.8. npm 12 supports node `^24.15.0`. Added
`RUN npm install -g npm@12` to `FileDownloader/Dockerfile` before `npm ci`. arm64 image builds,
`npm ci` works with the existing lockfile, image reports npm 12.1.0 and the update notice is gone.
npm 12 now logs `npm notice run ...` lines when `npx` runs.

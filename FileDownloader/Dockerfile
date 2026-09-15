# Matches the installed @playwright/test version (1.62.1) - the image ships Node, Chromium, and
# every OS-level dependency Chromium needs, already correctly matched to that Playwright version.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Camoufox (used by the Amex downloader) ships its own Firefox build, fetched here into a fixed
# path rather than the ephemeral ~/.cache. buildx picks the arm64 asset when built --platform arm64.
ENV CAMOUFOX_INSTALL_DIR=/opt/camoufox
RUN npx camoufox-js fetch

COPY . .
RUN chmod +x download.sh

# .env is copied in as part of the build context - decrypt-env.sh must be run before building
# so a plaintext .env exists to copy (see build-and-deploy-pi.sh).
CMD ["./download.sh"]

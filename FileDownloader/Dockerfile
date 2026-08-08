# Matches the installed @playwright/test version (1.62.1) - the image ships Node, Chromium, and
# every OS-level dependency Chromium needs, already correctly matched to that Playwright version.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chmod +x download.sh

# .env is copied in as part of the build context - decrypt-env.sh must be run before building
# so a plaintext .env exists to copy (see build-and-deploy-pi.sh).
CMD ["./download.sh"]

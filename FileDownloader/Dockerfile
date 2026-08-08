# Matches the installed @playwright/test version (1.62.1) - the image ships Node, Chromium, and
# every OS-level dependency Chromium needs, already correctly matched to that Playwright version.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chmod +x download.sh

# No .env is copied in (see .dockerignore) - either mount one at runtime
# (`docker run -v $(pwd)/.env:/app/.env ...`) or leave it out entirely and
# config.ts falls back to AWS Secrets Manager ("pim_data"), which is the
# expected path when this runs somewhere with a real AWS role (e.g. ECS/Fargate).
CMD ["./download.sh"]

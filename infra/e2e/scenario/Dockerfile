# Runner for the phase 5 scenario; browsers come with the image, matching @playwright/test in package.json.
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /scenario
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY playwright.config.ts tsconfig.json ./
COPY tests ./tests
CMD ["npx", "playwright", "test"]

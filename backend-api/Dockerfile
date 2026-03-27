# syntax=docker/dockerfile:1

# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --no-audit --no-fund --loglevel=error
COPY . .
RUN npm run build

# Stage 2: Final Production Image
FROM node:20-slim
WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Re-install only production dependencies in the final image
# This is usually faster than pruning and results in the smallest possible image
RUN npm ci --omit=dev --no-audit --no-fund --loglevel=error

# Chromium settings
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

EXPOSE 5000
CMD ["node", "dist/main.js"]

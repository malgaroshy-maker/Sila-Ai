# syntax=docker/dockerfile:1

# Stage 1: Base & Dependencies
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g npm@latest

# Stage 2: Install ALL dependencies
FROM base AS deps
COPY package*.json ./
RUN npm ci --no-audit --no-fund --loglevel=error

# Stage 3: Build the app
FROM deps AS builder
COPY . .
RUN npm run build

# Stage 4: Install only production dependencies
FROM base AS prod-deps
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund --loglevel=error

# Stage 5: Final Production Image
FROM node:20-slim
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Chromium settings
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

EXPOSE 5000
CMD ["node", "dist/main.js"]

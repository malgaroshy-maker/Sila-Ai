# syntax=docker/dockerfile:1

# Stage 1: Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Update npm to latest
RUN npm install -g npm@latest

COPY package*.json ./
# Install all dependencies (including devDependencies)
RUN npm ci --no-audit --no-fund --loglevel=error

COPY . .
RUN npm run build

# Stage 2: Production dependencies stage
FROM node:20-slim AS prod-deps

WORKDIR /app
COPY package*.json ./
# Install only production dependencies
RUN npm ci --omit=dev --no-audit --no-fund --loglevel=error

# Stage 3: Final Production Image
FROM node:20-slim

WORKDIR /app

# Copy production artifacts and production node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules

# Verify build output
RUN ls -R ./dist

# Chromium for Puppeteer (using Sparticuz)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

EXPOSE 5000

CMD ["node", "dist/main.js"]

# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@latest

# Copy package files and install all dependencies (including devDependencies)
COPY package*.json ./
RUN npm ci --no-audit --no-fund --loglevel=error

# Copy application code and build
COPY . .
RUN npm run build

# Prune devDependencies to keep the image small
RUN npm prune --production

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy only production artifacts and node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Verify build output
RUN ls -R ./dist

# Chromium for Puppeteer (using Sparticuz)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

EXPOSE 5000

CMD ["node", "dist/main.js"]

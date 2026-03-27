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

COPY package*.json ./
RUN npm ci --no-audit --no-fund --loglevel=error

COPY . .
RUN npm run build
# Remove devDependencies to shrink production image size
RUN npm prune --production

# Production stage
FROM node:20-slim

WORKDIR /app

# We no longer need the massive OS apt-get install block 
# because we will use @sparticuz/chromium which brings its own binary

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Verify build output
RUN ls -R ./dist

EXPOSE 5000

# Try to run main.js from dist or dist/src
CMD ["sh", "-c", "[ -f dist/main.js ] && node dist/main.js || node dist/src/main.js"]
